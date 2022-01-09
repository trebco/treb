
// treb imports
import {
  Grid, GridEvent, SerializeOptions, Annotation,
  BorderConstants, SheetChangeEvent, GridOptions, Sheet, GridSelection, CellEvent,
} from 'treb-grid';

import { Parser, DecimalMarkType, ArgumentSeparatorType, QuotedSheetNameRegex } from 'treb-parser';
import { LeafVertex } from 'treb-calculator';
import { Calculator } from 'treb-calculator';

import {
  IsCellAddress, Localization, Style, ICellAddress, Area, IArea, CellValue,
  IsFlatData, IsFlatDataArray, Rectangle, IsComplex, ComplexToString, Complex, ExtendedUnion, IRectangle
} from 'treb-base-types';

import { EventSource, Yield } from 'treb-utils';
import { NumberFormatCache, ValueParser, NumberFormat } from 'treb-format';

// local
import { ProgressDialog, DialogType } from './progress-dialog';
import { EmbeddedSpreadsheetOptions, DefaultOptions, ExportOptions } from './options';
import { TREBDocument, SaveFileType, LoadSource, EmbeddedSheetEvent } from './types';

import { SelectionState, Toolbar } from './toolbar';

// this is a circular reference. this seems like a bad idea, 
// but it's legal in typescript. not sure how I feel about this.

// import { APIv1 } from './API/api-v1';

// TYPE ONLY
// type Chart = import('../../treb-charts/src/index').Chart;

import { Chart, ChartFunctions } from 'treb-charts';

// 3d party modules
import * as FileSaver from 'file-saver';

// style
// import 'treb-grid/style/grid.scss';
import '../style/embed.scss';

// what is this? if these are being used outside of grid they should be exported
import { SerializedModel } from 'treb-grid/src/types/data_model';
import { FreezePane, SerializedSheet } from 'treb-grid/src/types/sheet_types';

/**
 * options for saving files. we add the option for JSON formatting.
 */
export interface SaveOptions extends SerializeOptions {

  /** pretty json formatting */
  pretty?: boolean;
  
}

interface UndoEntry {
  data: string;
  selection?: string;
}

enum CalculationOptions {
  automatic,
  manual,
}

/**
 * @internal
 */
export interface ToolbarCtl {
  Show: (show: boolean) => void;
}

enum SemanticVersionElement {
  major, minor, patch,
}

interface SemanticVersionComparison {
  match: number;
  level?: SemanticVersionElement;
}

// for updated API functions

/**
 * type represents a reference passed in to API functions. it can be an
 * address object, or a string. 
 */
export type AddressReference = string | ICellAddress;

/**
 * type represents a reference passed in to API functions. it can be an
 * address object, an area (range) object, or a string. 
 */
export type RangeReference = string | ICellAddress | IArea;

/**
 * options for the LoadDocument method
 */
export interface LoadDocumentOptions {
  scroll?: string|ICellAddress,
  flush?: boolean,
  recalculate?: boolean,
  override_sheet?: string,

  /** @internal */
  override_selection?: GridSelection,

  /** @internal */
  source?: LoadSource,
}

/**
 * options for the GetRange method
 */
export interface GetRangeOptions {

  /** 
   * return formatted values (apply number formats and return strings)
   */
  formatted?: boolean;

  /** 
   * return formulas instead of values. formula takes precedence over
   * "formatted"; if you pass both, returned values will *not* be formatted.
   * 
   * FIXME: that should throw?
   */
  formula?: boolean;

}

/**
 * options for the SetRange method
 */
export interface SetRangeOptions {

  /** transpose rectangular array before inserting */
  transpose?: boolean;

  /** recycle values (R-style) */
  recycle?: boolean;

  /** apply as an array (as if you pressed ctrl+shift+enter) */
  array?: boolean;

  /** spill over */
  spill?: boolean;

}

/**
 * options for the ScrollTo method.
 * 
 * @remarks 
 * 
 * this method was renamed because of a conflict with a DOM type,
 * which was causing problems with the documentation generator.
 */
export interface SheetScrollOptions {

  /** scroll in x-direction. defaults to true. */
  x?: boolean;

  /** scroll in y-direction. defaults to true. */
  y?: boolean;

  /** 
   * smooth scrolling, if supported. we use scrollTo so support is as here:
   * https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTo
   */
  smooth?: boolean;
}

///

/**
 * embedded spreadsheet
 */
export class EmbeddedSpreadsheetBase<CalcType extends Calculator = Calculator> { 

  /** @internal */
  public static treb_base_path = '';

  /** @internal */
  public static treb_language = '';

  /* * 
   * what is this? does not seem to be used anymore
   * 
   * @internal 
   */
  // public static treb_script_host = '';

  /** @internal */
  public static treb_embedded_script_path = '';

  /** @internal */
  public static enable_engine = false;

  // / * * @internal * /
  // public static enable_utils = false;

  /** @internal */
  public static enable_formatter = false;

  /**
   * this flag will be set on LoadDocument. the intent is to be able to
   * know if you have loaded a network document, which may happen before you
   * have the chance to subscribe to events
   * 
   * FIXME: we need to nail down the semantics of this. what does it mean if
   * you call reset? 
   * 
   * @internal
   */
  public loaded = false;

  /**
   * @internal
   */
  public toolbar_ctl?: ToolbarCtl;

  /**
   * @internal
   * 
   * this is not public (in the API, at least), for the moment, but 
   * it is accessible. not sure which way we're going to go with this.
   */
  public get Localization(): Localization {
    return Localization;
  }

  protected events = new EventSource<{type: string}>();

  /** 
   * automatic/manual 
   * why is this protected? is there some reason we don't want people to use it?
   */
  protected calculation = CalculationOptions.automatic;

  /**
   * this might be something that should travel with the document,
   * as a way to compare different versions... something to think
   * about. we could certainly preserve/restore it on save/load.
   */
  protected file_version = 0;

  /** 
   * this is recordkeeping for "dirty" marking, which also supports
   * undo. if we preserve the file version this will have to track.
   */
  protected last_save_version = 0;

  /**
   * calculator may be overloaded. the pattern we settled on is 
   * the constructor affirmatively assigns it via a method. use that
   * method to do the override.
   * 
   * @internal
   */
  protected calculator: CalcType;

  /**
   */
  protected grid: Grid;

  protected options: EmbeddedSpreadsheetOptions;

  /**
   * dialog is assigned in the constructor, only if there's a containing
   * element (i.e. not when we're just using the engine)
   */
  protected dialog?: ProgressDialog;

  protected toolbar?: Toolbar;

  /**
   * this is the current selection style, which we delta and apply when
   * there's a toolbar command. it seems like we're keeping this information
   * in two places, though, here and in the toolbar. could consolidate? (...)
   */
  protected active_selection_style?: Style.Properties;

  /** localized parser instance. we're sharing. */
  protected get parser(): Parser {
    return this.calculator.parser;
  }

  protected node?: HTMLElement;

  /**
   * export worker (no longer using worker-loader).
   * export worker is loaded on demand, not by default.
   */
  protected export_worker?: Worker;

  /**
   * keep track of what we've registered, for external libraries
   * (currently charts), which is per sheet instance.
   */
  // protected registered_libraries: { [index: string]: any } = {};
  protected registered_libraries: Record<string, boolean> = {};

  /**
   * undo pointer points to the next insert spot. that means that when
   * you push an undo operation, it goes into the slot [undo_pointer].
   *
   * that means if you want to undo, and the pointer is at X, you need
   * to go to the state X-2 -- because X-1 is effectively the _current_ state.
   * and also if you do that (undo), you decrement the pointer by 1.
   *
   * this is confusing.
   */
  private undo_pointer = 0;
  private undo_stack: UndoEntry[] = [];

  /**
   * ...
   */
  private last_selection?: string;


  /** 
   * this was added for riskamp.com; it doesn't track modified, really, because
   * it doesn't reflect saves. we need to do that but leave this one as-is for
   * backwards compatibility.
   * 
   * @internal
   */
  public get modified(): boolean {
    return this.undo_stack.length !== 1;
  }

  /** document name (metadata) */
  public get document_name(): string | undefined {
    return this.grid.model.document_name;
  }

  /** document name (metadata) */
  public set document_name(name: string | undefined) {
    this.grid.model.document_name = name;
    this.DocumentChange();
  }

  /** opaque user data (metadata) */
  public get user_data(): unknown {
    return this.grid.model.user_data;
  }

  /** opaque user data (metadata) */
  public set user_data(data: unknown) {
    this.grid.model.user_data = data;
    this.DocumentChange();
  }

  /** current grid scale */
  public get scale(): number {
    return this.grid.scale;
  }

  /** current grid scale */
  public set scale(value: number) {
    this.grid.scale = value;
  }

  /** headless state */
  public get headless(): boolean {
    return this.grid.headless;
  }

  /** headless state */
  public set headless(value: boolean) {
    if (this.grid.headless !== value) {
      this.grid.headless = value;
      if (!value) {
        this.grid.Update(true);
        this.RebuildAllAnnotations();
      }
    }
  }

  /**
   * constructor takes spreadsheet options
   * @internal
   */
  constructor(options: EmbeddedSpreadsheetOptions, type: (new () => CalcType)) {

    // super();

    // consolidate options w/ defaults. note that this does not
    // support nested options, for that you need a proper merge

    this.options = { ...DefaultOptions, ...options };

    // set these options ASAP, they are static to the relevant classes

    /* option is deprecated
    if (this.options.complex) {
      // Parser.support_complex_numbers = true;
    }
    */

    if (typeof this.options.imaginary_value === 'string') {
      NumberFormat.imaginary_character = this.options.imaginary_value;
    }

    let network_document = this.options.network_document;

    // optionally data from storage, with fallback

    let data: string | undefined;
    let source: LoadSource | undefined;

    if (this.options.storage_key && !this.options.toll_initial_load) {
      data = localStorage.getItem(this.options.storage_key) || undefined;
      if (data) {
        source = LoadSource.LOCAL_STORAGE;
      }

      if (!data && this.options.alternate_document) {
        network_document = this.options.alternate_document;
      }

      window.addEventListener('beforeunload', () => {
        if (this.options.storage_key) {
          this.SaveLocalStorage(this.options.storage_key);
        }
      });

    }

    let container: HTMLElement | undefined;

    if (typeof this.options.container === 'string') {
      container = document.getElementById(this.options.container) as HTMLElement;
    }
    else if (this.options.container) {
      container = this.options.container;
    }

    // create + init grid

    const grid_options: GridOptions = {
      // expand: false,

      insert_function_button: false, // do we have this?
      in_cell_editor: true, // if this is always true, why is it an option?
      repaint_on_cell_change: false,
      scrollbars: this.options.scrollbars,
      markdown: !!this.options.markdown,

      formula_bar: this.options.formula_bar,
      expand_formula_button: this.options.expand_formula_button,
      tab_bar: this.options.tab_bar,
      add_tab: this.options.add_tab,
      delete_tab: this.options.delete_tab,
      expand: this.options.expand,

    };

    if (this.options.scale) {
      grid_options.initial_scale = this.options.scale;
    }

    // what is happening here? this is dumb

    //    if (typeof this.options.formula_bar !== 'undefined') {
    //      grid_options.formula_bar = this.options.formula_bar;
    //    }

    //    if (this.options.expand_formula_button) {
    //      grid_options.expand_formula_button = this.options.expand_formula_button;
    //    }

    // if (this.options.scrollbars) 
    // {
    //  console.info("TOS?", this.options.scrollbars, typeof this.options.scrollbars);
    //  grid_options.scrollbars = !!this.options.scrollbars;
    // }

    //    if (typeof this.options.tab_bar !== 'undefined') {
    //      grid_options.tab_bar = this.options.tab_bar;
    //    }

    if (this.options.scale_control) {

      grid_options.scale_control = true;
      grid_options.tab_bar = true; // implied, not auto

      if (this.options.persist_scale) {
        if (this.options.persist_scale === true) {
          grid_options.persist_scale_key = 'spreadsheet-scale';
        }
        else {
          grid_options.persist_scale_key = 'spreadsheet-scale-' + this.options.persist_scale;
        }

        // persisted scale should _not_ override parameter/option... only
        // set here if option is blank... actually, no, that's not right.
        // persisted scale should override parameter, because if you do NOT
        // want that behavior you can just disable persisting. so there are 
        // clear ways to accomplish any of

        // (1) no initial scale, persist
        // (2) initial scale, don't persist (revert to parameter)
        // (3) initial scale but persist and use persisted value if available

        // if (!this.options.scale_control) {
        const json = localStorage.getItem(grid_options.persist_scale_key);
        if (json) {
          try {
            const obj = JSON.parse(json);
            grid_options.initial_scale = obj.scale || 1;
          }
          catch (e) {
            console.warn('parsing persisted scale failed');
          }
        }

      }

    }

    this.grid = new Grid(grid_options);

    if (this.options.headless) {
      this.grid.headless = true; // FIXME: move into grid options
    }

    // we're now gating this on container to support fully headless operation

    if (container) {

      // we used to set a class on this node, but grid will set 
      // "treb-main treb-theme" and some other stuff, we can use those
      // as necessary

      this.node = document.createElement('div');
      container.appendChild(this.node);

      // handle key. TODO: move undo to grid (makes more sense)

      container.addEventListener('keydown', this.HandleKeyDown.bind(this));

      const toll_initial_render = !!(data || this.options.network_document);

      this.grid.Initialize(this.node, toll_initial_render);

      // dnd

      if (this.options.dnd) {
        this.node.addEventListener('dragenter', (event) => this.HandleDrag(event));
        this.node.addEventListener('dragover', (event) => this.HandleDrag(event));
        this.node.addEventListener('drop', (event) => this.HandleDrop(event));
      }

      // set up grid events

      this.grid.grid_events.Subscribe((event) => {

        switch (event.type) {

          case 'error':
            this.dialog?.ShowDialog({
              type: DialogType.error,
              message: event.message,
              title: event.title, // || 'Error',
              timeout: 3000,
              close_box: true,
            });
            break;

          case 'selection':
            // console.info('selection event');
            this.UpdateSelection(event.selection);
            this.UpdateSelectionStyle(event.selection);
            break;

          case 'sheet-change':
            this.OnSheetChange(event);
            this.UpdateSelectionStyle();
            break;

          case 'data':
            {

              // because this is async (more than once), we can't expect the 
              // selection event to happen after the PushUndo call. we need
              // to preserve the current selection and pass it through.

              const cached_selection = this.last_selection;

              ((this.calculation === CalculationOptions.automatic) ?
                this.Recalculate(event) : Promise.resolve()).then(() => {
                  this.DocumentChange(cached_selection);
                });

              /*
              if (this.calculation === CalculationOptions.automatic) {
                this.Recalculate(event).then(() => {
                  this.DocumentChange(cached_selection);
                });
              }
              else {
                Promise.resolve().then(() => this.DocumentChange(cached_selection));
              }
              */

            }
            break;

          case 'style':
            this.DocumentChange();
            this.UpdateDocumentStyles(false);
            this.UpdateSelectionStyle();
            break;

          case 'scale':
            this.RebuildAllAnnotations();
            break;

          case 'annotation':
            // FIXME: maybe need to update vertices (on create, update, delete,
            // not on move or resize)

            if (event.annotation) {

              this.DocumentChange();
              switch (event.event) {
                case 'create':
                  this.InflateAnnotation(event.annotation);
                  this.calculator.UpdateAnnotations(event.annotation);
                  this.grid.AnnotationUpdated(event.annotation);
                  break;
                case 'delete':
                  this.calculator.RemoveAnnotation(event.annotation); // clean up vertex
                  break;
                case 'update':
                  if (event.annotation.update_callback) {
                    event.annotation.update_callback();
                    this.grid.AnnotationUpdated(event.annotation);
                  }
                  else {
                    console.info('annotation update event without update callback');
                  }
                  this.calculator.UpdateAnnotations(event.annotation);
                  break;
                case 'resize':
                  if (event.annotation.resize_callback) {
                    event.annotation.resize_callback();
                    this.grid.AnnotationUpdated(event.annotation);
                  }
                  break;
              }

            }
            else {
              console.info('annotation event without annotation');
            }
            break;

          case 'structure':
            this.DocumentChange();
            if (event.rebuild_required) {
              this.calculator.Reset();
            }
            this.UpdateSelectionStyle();
            break;

          case 'cell-event':
            this.HandleCellEvent(event);
            break;

        }
      });

      if (this.options.prompt_save) {
        window.addEventListener('beforeunload', (event) => {
          if (this.last_save_version !== this.file_version) {
            event.preventDefault();
            event.returnValue = '';
          }
        });
      }

    }
    else {
      console.info('not initializing grid; don\'t call UI functions');
      this.grid.headless = true; // ensure
    }

    // this.calculator = this.InitCalculator();
    this.calculator = new type();

    // FIXME: this should yield so we can subscribe to events before the initial load

    if (data) {
      this.LoadDocument(JSON.parse(data), 
        { recalculate: !!this.options.recalculate, source});
    }
    else if (!network_document) {

      // no data and no network document -- we need to connect the grid model
      // and the calculator, which would otherwise happen on document load

      this.calculator.RebuildClean(this.grid.model, true);

    }

    this.FlushUndo();

    // FIXME: this is deprecated [what?]
    // [this is now a file property, not an option]

    // if (options.freeze_rows || options.freeze_columns) {
    //  this.grid.Freeze(options.freeze_rows || 0, options.freeze_columns || 0);
    // }

    // if (typeof options.show_headers !== 'undefined') {
    this.grid.ShowHeaders(this.options.headers);
    // }

    // optionally scroll grid on create (async -- why?)

    if (this.options.scroll && !this.options.network_document) {
      const address = this.options.scroll;
      requestAnimationFrame(() => {
        this.ScrollTo(address);
      });
    }

    // init AC

    this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());

    // dev
    if (this.options.global_name) {

      // there has to be a simpler way to do this
      // (that comment was written when this was slightly worse; still bad though)

      (self as (typeof self & Record<string, unknown>))[this.options.global_name] = this;

    }

    if (network_document) {
      this.LoadNetworkDocument(network_document, this.options);
    }

    // create mask dialog

    if (container) {
      this.dialog = new ProgressDialog(container);
    }

    /*
    // testing dialog
    requestAnimationFrame(() => {
      this.dialog?.ShowDialog({
        title: 'Dramatic error occurred',
        message: 'Goon fahoon. Tacos the game!',
        close_box: true,
      });
    });
    */

  }

  /**
   * we need to load relative resources. we can't access the path of this
   * script, but because it has to be added via a script tag -- either
   * statically or dynamically -- we should be able to get it.
   *
   * it is possible that the script tag goes away, but if we sniff on first
   * script execution, we can probably assume it's still there -- because the
   * client won't have had a chance to remove it yet.
   * 
   * @internal
   */
  public static BuildPath(): void {
    const tags = document.querySelectorAll('script');

    // FIXME: fragile!
    const default_script_name = process.env.BUILD_ENTRY_MAIN || '';
    const rex = new RegExp(default_script_name);

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < tags.length; i++) {

      const tag = tags[i];
      const src = tag.src; // fully-qualified here [FIXME: IE11?]

      /*
      if (src && /\?.*?engine/i.test(src)) {
        console.info('s', src);
        this.enable_engine = true;
      }
      */

      if (src && rex.test(src)) {

        /*
        if (src && /\?.*?utils/i.test(src)) {
          this.enable_utils = true;
        }
        */

        if (src && /\?.*?engine/i.test(src)) {
          this.enable_engine = true;
        }

        if (src && /\?.*?format/i.test(src)) {
          this.enable_formatter = true;
        }

        this.treb_embedded_script_path = src;
        this.treb_base_path = src.replace(new RegExp(default_script_name + '.*$'), '');

        return;
      }

    }

  }
  
  // --- public internal methods -----------------------------------------------

  // these are methods that are public for whatever reason, but we don't want
  // them published to any public API. if we ever get around to encapsulating
  // the API, leave these out.

  /** 
   * this is public because it's created by the composite sheet. 
   * FIXME: perhaps there's a better way to do that? via message passing? (...) 
   * 
   * @internal
   */
   public CreateToolbar(container: HTMLElement): Toolbar {
    this.toolbar = new Toolbar(container, this.options, this.grid.theme);
    this.toolbar.Subscribe((event) => {

      let updated_style: Style.Properties = {};

      const insert_annotation = (func: string) => {
        const selection = this.grid.GetSelection();
        if (selection && !selection.empty) {
          const label = selection.area.spreadsheet_label;
          this.InsertAnnotation(`=${func}(${label},,"${label}")`);
        }
      };

      if (event.type === 'format') {
        updated_style.number_format = event.format || 'General';
      }
      else if (event.type === 'font-size') {

        // NOTE we're doing this a little differently; not using
        // updated style because we also want to resize rows, and
        // we want those things to be a single transaction.

        const selection = this.grid.GetSelection();
        const area = this.grid.RealArea(selection.area);

        this.grid.ApplyStyle(undefined, event.style, true);
        const rows: number[] = [];
        for (let row = area.start.row; row <= area.end.row; row++) {
          rows.push(row);
        }
        this.grid.SetRowHeight(rows, undefined, false);

      }
      else if (event.type === 'button') {
        switch (event.command) {

          case 'font-scale':

            // above we handle 'font-size' events; this comes from a dropdown,
            // so we're handling it inline, but we want the same behavior.
            // FIXME: break out

            {
              const selection = this.grid.GetSelection();
              const area = this.grid.RealArea(selection.area);
              const scale = Number(event.data?.scale || 1);

              if (scale && !isNaN(scale)) {
                this.grid.ApplyStyle(undefined, {
                  //font_size_unit: 'em', font_size_value: scale 
                  font_size: {
                    unit: 'em', value: scale,
                  },
                }, true);
                const rows: number[] = [];
                for (let row = area.start.row; row <= area.end.row; row++) {
                  rows.push(row);
                }
                this.grid.SetRowHeight(rows, undefined, false);
              }
            }
            break;

          case 'update-comment':
            this.SetNote(undefined, event.data?.comment || '');
            break;

          case 'clear-comment':
            this.SetNote(undefined, '');
            break;

          case 'border':
            {
              let width = 1;
              let border = (event.data?.border || '').replace(/^border-/, '');

              if (border === 'double-bottom') {
                border = 'bottom';
                width = 2;
              }

              if (border) {
                this.grid.ApplyBorders2(
                  undefined,
                  border,
                  event.data?.color || undefined,
                  width,
                );
              }

            }
            break;

          case 'color':
          case 'background-color':
          case 'foreground-color':
          case 'border-color':

            switch (event.data?.target) {
              case 'border':
                updated_style.border_top_fill =
                  updated_style.border_bottom_fill =
                  updated_style.border_left_fill =
                  updated_style.border_right_fill = event.data?.color || {};
                break;
              case 'foreground':

                // empty would work here because it means "use default"; but
                // if we set it explicitly, it can be removed on composite delta
                updated_style.text = event.data?.color || { theme: 1 };

                break;
              case 'background':

                // FIXME: theme colors
                updated_style.fill = event.data?.color || {};
                break;
            }
            break;

          // why are these calling grid methods? should we contain this in some way? (...)

          case 'insert-row': this.InsertRows(); break;
          case 'insert-column': this.InsertColumns(); break;
          case 'delete-row': this.DeleteRows(); break;
          case 'delete-column': this.DeleteColumns(); break;
          case 'insert-sheet': this.grid.InsertSheet(); break;
          case 'delete-sheet': this.grid.DeleteSheet(); break;

          case 'freeze':
            {
              const freeze = this.grid.GetFreeze();
              if (freeze.rows || freeze.columns) {
                this.Freeze(0, 0);
              }
              else {
                this.FreezeSelection();
              }
            }
            break;

          case 'insert-image': this.InsertImage(); break;

          case 'donut-chart': insert_annotation('Donut.Chart'); break;
          case 'column-chart': insert_annotation('Column.Chart'); break;
          case 'bar-chart': insert_annotation('Bar.Chart'); break;
          case 'line-chart': insert_annotation('Line.Chart'); break;

          case 'increase-decimal':
          case 'decrease-decimal':
            if (this.active_selection_style) {
              const format = NumberFormatCache.Get(this.active_selection_style.number_format || 'General');
              if (format.date_format) { break; }
              const clone = new NumberFormat(format.pattern);
              if (event.command === 'increase-decimal') {
                clone.IncreaseDecimal();
              }
              else {
                clone.DecreaseDecimal();
              }
              updated_style.number_format = clone.toString();
            }
            break;

          case 'merge':
            this.grid.MergeCells();
            break
          case 'unmerge':
            this.grid.UnmergeCells();
            break;

          case 'lock':
            updated_style = {
              locked:
                this.active_selection_style ?
                  !this.active_selection_style.locked : true,
            };
            break;

          case 'wrap':
            updated_style = {
              wrap: this.active_selection_style ?
                !this.active_selection_style.wrap : true,
            };
            break;

          case 'align-left':
            updated_style = { horizontal_align: Style.HorizontalAlign.Left };
            break;
          case 'align-center':
            updated_style = { horizontal_align: Style.HorizontalAlign.Center };
            break;
          case 'align-right':
            updated_style = { horizontal_align: Style.HorizontalAlign.Right };
            break;

          case 'align-top':
            updated_style = { vertical_align: Style.VerticalAlign.Top };
            break;
          case 'align-middle':
            updated_style = { vertical_align: Style.VerticalAlign.Middle };
            break;
          case 'align-bottom':
            updated_style = { vertical_align: Style.VerticalAlign.Bottom };
            break;

          case 'reset':
            this.Reset();
            break;
          case 'import-desktop':
            this.LoadLocalFile();
            break;
          //case 'import-url':
          //  this.ImportURL();
          //  break;
          case 'save-json':
            this.SaveLocalFile();
            break;
          case 'save-csv':
            this.SaveLocalFile(SaveFileType.csv);
            break;
          case 'export-xlsx':
            this.Export();
            break;

          case 'recalculate':
            this.Recalculate();
            break;

          default:
            console.info('unhandled', event.command);
            break;
        }
      }

      if (Object.keys(updated_style).length) {
        this.grid.ApplyStyle(undefined, updated_style, true);
      }

      this.Focus();

    });

    this.UpdateDocumentStyles(false);
    this.UpdateSelectionStyle(undefined);

    return this.toolbar;
  }

  /** 
   * Create (and return) a Chart object.
   * 
   * @privateRemarks
   * 
   * This method was created for RAW, no one else should need it. But it's
   * not really an internal method, because it's used by outside clients.
   * 
   * @internal
   */
   public CreateChart(): Chart {

    // FIXME: we should just always do this

    if (!this.registered_libraries['treb-charts']) {
      this.calculator.RegisterFunction(ChartFunctions);
      this.registered_libraries['treb-charts'] = true;
      this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());
    }

    return new Chart();
  }

  // --- public API methods ----------------------------------------------------

  /**
   * Use this function to batch multiple document changes. Essentially the 
   * grid stops broadcasting events for the duration of the function call, 
   * and collects them instead. After the function call we update as necessary.
   * 
   * @public
   */
  public async Batch(func: () => void, paint = false): Promise<void> {

    // API v1 OK

    const cached_selection = this.last_selection;
    const events = this.grid.Batch(func, paint);

    let recalc = false;
    let reset = false;

    // FIXME: annotation events
    // TODO: annotation events

    // FIXME: sheet change events (affects annotations)
    // TODO: sheet change events (affects annotations)

    for (const event of events) {
      if (event.type === 'data') {
        recalc = true;
      }
      else if (event.type === 'structure') {
        if (event.rebuild_required) reset = true;
      }
    }

    if (reset) {
      this.calculator.Reset();
    }

    if (recalc || reset) {
      await this.Recalculate();
      this.DocumentChange(cached_selection);
    }

  }

  /** set freeze area */
  public Freeze(rows = 0, columns = 0): void {
    this.grid.Freeze(rows, columns, true);
  }

  /** freeze at current selection */
  public FreezeSelection(): void {

    const selection = this.grid.GetSelection();
    if (selection.empty) {
      this.grid.Freeze(0, 0);
    }
    else {
      const area = selection.area as Area;
      if (area.entire_sheet) {
        // ?
      }
      else if (area.entire_row) {
        this.grid.Freeze(area.end.row + 1, 0);
      }
      else if (area.entire_column) {
        this.grid.Freeze(0, area.end.column + 1);
      }
      else {
        this.grid.Freeze(area.end.row + 1, area.end.column + 1);
      }
    }

  }

  /** return current freeze area */
  public GetFreeze(): FreezePane { return this.grid.GetFreeze(); }

  /**
   * Update theme from CSS. Because the spreadsheet is painted, not
   * rendered, you need to notifiy us if external style (CSS) properties
   * have changed. We will update and repaint.
   */
  public UpdateTheme(): void {

    // API v1 OK

    // not sure about the override thing, since we now do CSS theme
    // UPDATE: dropping override parameter (extra theme properties)

    this.grid.UpdateTheme(undefined);
    if (this.toolbar) {
      this.toolbar.UpdateTheme(this.grid.theme);
    }

  }

  /**
   * Get sheet ID, by name (sheet name) or index. This may be useful for
   * constructing references programatically. 
   * 
   * @remarks
   * 
   * Sheet IDs are positive integers. IDs are ephemeral, they should not be 
   * retained after a document is closed or reloaded. They will likely (almost)
   * always be the same, but that's not guaranteed, so don't rely on them. 
   * 
   * @param sheet - sheet name or index. sheet names are matched case-insensitively.
   * 
   * @returns ID, or undefined if the index is not found (0 is not a valid 
   * sheet ID, so you can test for falsy).
   * 
   * @public
   */
  public GetSheetID(sheet: string|number): number|undefined {

    // API v1 OK

    if (typeof sheet === 'number') {
      const model_sheet = this.grid.model.sheets[sheet];
      if (model_sheet) { return model_sheet.id; }
    }
    else {
      const name = sheet.toUpperCase();
      for (const sheet of this.grid.model.sheets) {
        if (sheet.name.toUpperCase() === name) {
          return sheet.id;
        }
      }
    }

    return undefined;
  }

  /**
   * Add a sheet, optionally named. 
   */
  public AddSheet(name?: string): void {
    this.grid.AddSheet(name);

    // before you do anything else you probably need to reset the calculator.
    // that was causing errors when adding sheet via the grid method and then
    // calling InsertAnnotation.
    //
    // the reason is that calling AddSheet will trigger a calculator reset,
    // but asynchronously; if you are going to call other API methods we should
    // do this now. the additional reset won't be a problem (?)

    this.calculator.Reset();
  }

  /**
   * Insert an annotation node. Usually this means inserting a chart.
   * 
   * @param formula - annotation formula. For charts, the chart formula.
   * @param type - annotation type. Defaults to `treb-chart`.
   * @param rect - coordinates, or a range reference for layout.
   */
  public InsertAnnotation(formula: string, type = 'treb-chart', rect?: IRectangle|RangeReference): void {

    let target: IRectangle | Partial<Area> | undefined;

    if (rect) {
      target = Rectangle.IsRectangle(rect) ? rect : this.calculator.ResolveArea(rect);
    }

    const { x, y } = this.grid.GetScrollOffset();
    const scale = this.grid.scale || 1;

    this.grid.CreateAnnotation({
      type,
      formula,
    }, undefined, undefined, target || { top: y / scale + 30, left: x / scale + 30, width: 300, height: 300 });

  }

  /**
   * Insert an image. This method will open a file chooser and (if an image
   * is selected) insert the image into the document.
   * 
   * @privateRemarks
   * 
   * Should we have a separate method that takes either an Image (node) or 
   * a data URI? 
   */
  public async InsertImage(file?: File): Promise<void> {

    if (!file) {
      file = await this.SelectFile('.png, .jpg, .jpeg, .gif, .svg');
    }

    if (!file) { return; }

    if (this.options.max_file_size && file.size > this.options.max_file_size) {
      this.dialog?.ShowDialog({
        type: DialogType.error,
        message: 'This file exceeds the allowed image size. Please try a smaller image.',
        title: 'Error adding image',
        timeout: 3000,
        close_box: true,
      });
      return;
    }

    const reference = file;

    await new Promise<void>((resolve, reject) => {

      const reader = new FileReader();

      reader.onload = async () => {

        try {
          if (reader.result) {
            let contents: string;
            if (typeof reader.result === 'string') {
              contents = reader.result;
            }
            else {
              contents = '';
              const bytes = new Uint8Array(reader.result);
              for (let i = 0; i < bytes.byteLength; i++) {
                contents += String.fromCharCode(bytes[i]);
              }
            }

            const img = document.createElement('img');
            img.src = contents;

            // this is to let the browser figure out the image size.
            // we should maybe use requestAnimationFrame? 

            await Promise.resolve();

            // note: this works, somewhat contrary to expectations,
            // probably because there are some async calls; hence the
            // src attribute is set before it's inflated. 

            const annotation = this.grid.CreateAnnotation({
              type: 'image',
              formula: '',
            }, undefined, undefined, {
              top: 30,
              left: 30,
              width: img.width || 300,
              height: img.height || 300
            });

            annotation.data.src = contents;
            annotation.data.original_size = { width: img.width || 300, height: img.height || 300 };

          }

          resolve();
          
        }
        catch (err) {
          reject(err);
        }
      };

      reader.onabort = () => { reject('Aborted'); };
      reader.onerror = () => { reject('File error'); };

      // need a nontrivial delay to allow IE to re-render.
      // FIXME: this should be done async, possibly in a worker

      setTimeout(() => {
        reader.readAsDataURL(reference);
      }, 100);

    });


  }

  /** 
   * Rename a sheet. 
   * 
   * @param index - old name or index of sheet. leave undefined to use 
   * current active sheet.
   * 
   * @public
   */
  public RenameSheet(index: string|number|undefined, new_name: string): void {

    // API v1 OK

    let sheet: Sheet|undefined;

    if (typeof index === 'number') {
      sheet = this.grid.model.sheets[index];
      if (!sheet) { return; }
    }
    else if (typeof index === 'string') {
      const uc = index.toUpperCase();
      for (const test of this.grid.model.sheets) {
        if (test.name.toUpperCase() === uc) {
          sheet = test;
          break;
        }
      }
      if (!sheet) { return; }
    }

    this.grid.RenameSheet(sheet, new_name);

  }

  /**
   * Delete a sheet. 
   * 
   * @param index - sheet name or index. Leave undefined to delete the active sheet.
   * 
   * @public
   */
  public DeleteSheet(index?: string|number): void {

    // API v1 OK

    if (typeof index === 'string') {
      index = index.toLowerCase();
      for (let i = 0; i < this.grid.model.sheets.length; i++) {
        const sheet = this.grid.model.sheets[i];
        if (sheet.name.toLowerCase() === index) {
          this.grid.DeleteSheet(i);
          break;
        }
      }
    }
    else {
      this.grid.DeleteSheet(index); // index or undefined
    }

    this.calculator.Reset();
  }

  /** 
   * Show or hide sheet. This is a replacement for the `ShowSheet` method, 
   * because that name is somewhat ambiguous.
   * 
   * @param index - sheet name or index.
   * 
   * @public
   */
  public HideSheet(index: number | string = 0, hide = true): void {

    // API v1 OK

    this.grid.ShowSheet(index, !hide);
  }

  /**
   * Show or hide sheet.
   * 
   * @param index - sheet name or index.
   * 
   * @see HideSheet
   * @deprecated Use `HideSheet` instead.
   */
  public ShowSheet(index: number | string = 0, show = true): void {

    // API v1 OK

    this.grid.ShowSheet(index, show);
  }

  /**
   * Activate sheet.
   * 
   * @param index - sheet name or index.
   * 
   * @public
   */
  public ActivateSheet(index: number | string): void {

    // API v1 OK

    this.grid.ActivateSheet(index);
  }

  /**
   * Set width of column(s).
   * 
   * @param column - column, or columns (array), or undefined means all columns
   * @param width - desired width (can be 0) or undefined means 'auto-size'
   * 
   * @privateRemarks
   * 
   * TODO: this method assumes the current sheet. we need a method that can
   * (optionally) specify a sheet.
   * 
   * @public
   */
  public SetColumnWidth(column?: number | number[], width?: number): void {

    // API v1 OK

    this.grid.SetColumnWidth(column, width);
  }

  /**
   * Set height of row(s).
   * 
   * @param row - row, or rows (array), or undefined means all rows
   * @param height - desired height (can be 0) or undefined means 'auto-size'
   * 
   * @privateRemarks
   * 
   * TODO: this method assumes the current sheet. we need a method that can
   * (optionally) specify a sheet.
   * 
   * @public
   */
  public SetRowHeight(row?: number | number[], height?: number): void {

    // API v1 OK

    this.grid.SetRowHeight(row, height);
  }

  /**
   * Insert row(s).
   * 
   * @param before_row - leave undefined to use current selection.
   * 
   * @public
   */
  public InsertRows(before_row?: number, count = 1): void {

    if (typeof before_row === 'undefined') {
      const selection = this.grid.GetSelection();
      if (selection.empty) { return; }
      const area = selection.area;
      before_row = area.entire_column ? 0 : area.start.row;
    }

    this.grid.InsertRows(before_row, count);
  }

  /**
   * Insert column(s).
   * 
   * @param before_column - leave undefined to use current selection.
   * 
   * @public
   */
  public InsertColumns(before_column?: number, count = 1): void {

    if (typeof before_column === 'undefined') {
      const selection = this.grid.GetSelection();
      if (selection.empty) { return; }
      const area = selection.area;
      before_column = area.entire_row ? 0 : area.start.column;    
    }

    this.grid.InsertColumns(before_column, count);
  }

  /**
   * Delete row(s).
   * 
   * @param start_row - leave undefined to use current selection. in this
   * case the `count` parameter will be ignored and all rows in the selection
   * will be deleted.
   */
  public DeleteRows(start_row?: number, count = 1): void {

    if (typeof start_row === 'undefined') {
      const selection = this.grid.GetSelection();
      if (selection.empty) { return; }
      const area = selection.area;
      start_row = area.entire_column ? 0 : area.start.row;
      count = area.rows;
    }

    this.grid.InsertRows(start_row, -count);
  }

  /**
   * Delete columns(s).
   * 
   * @param start_column - leave undefined to use current selection. in this
   * case the `count` parameter will be ignored and all columns in the 
   * selection will be deleted.
   */
  public DeleteColumns(start_column?: number, count = 1): void {

    if (typeof start_column === 'undefined') {
      const selection = this.grid.GetSelection();
      if (selection.empty) { return; }
      const area = selection.area;
      start_column = area.entire_row ? 0 : area.start.column;    
      count = area.columns;
    }

    this.grid.InsertColumns(start_column, -count);    
  }

  /**
   * Merge cells in range.
   * 
   * @param range - target range. leave undefined to use current selection.
   * 
   * @public
   */
  public MergeCells(range?: RangeReference): void {

    // API v1 OK

    this.grid.MergeCells(range ? this.calculator.ResolveArea(range) : undefined);
  }

  /**
   * Unmerge cells in range.
   * 
   * @param range - target range. leave undefined to use current selection.
   * 
   * @public
   */
   public UnmergeCells(range?: RangeReference): void {

    // API v1 OK

    this.grid.UnmergeCells(range ? this.calculator.ResolveArea(range) : undefined);
  }

  /** 
   * Export XLSX as a blob. This is intended for electron clients, who may
   * implement their own file save routines (because they have access to the
   * filesystem).
   * 
   * @internal
   */
  public async ExportBlob(): Promise<Blob> {

    if (!this.export_worker) {
      const worker_name = process.env.BUILD_ENTRY_EXPORT_WORKER || '';
      this.export_worker = await this.LoadWorker(worker_name);
    }

    return new Promise<Blob>((resolve, reject) => {

      if (this.export_worker) {
        this.export_worker.onmessage = (event) => {
          resolve(event.data ? event.data.blob : undefined);
        };
        this.export_worker.onerror = (event) => {
          console.error('export worker error');
          console.info(event);
          reject(event);
        };

        // FIXME: type

        const serialized: SerializedModel = this.grid.Serialize({
          rendered_values: true,
          expand_arrays: true,
          export_colors: true,
          decorated_cells: true,
        });

        // why do _we_ put this in, instead of the grid method? 
        serialized.decimal_mark = Localization.decimal_separator;

        this.export_worker.postMessage({
          command: 'export', 
          sheet: serialized, 
          decorated: this.calculator.DecoratedFunctionList(),
        });

      }
      else {
        reject('worker failed');
      }

    });
  }

  /**
   * Export to XLSX file. 
   * 
   * @remarks 
   * 
   * this requires a bunch of processing -- one, we do this in a worker, and 
   * two, it's demand loaded so we don't bloat up this embed script.
   */
  public Export(): void {

    // API v1 OK

    // it might be nice to merge the workers, but since export is (presumably)
    // rare the separation is better. might be able to do some common-chunking
    // with webpack (although I'm not sure how well that plays w/ ts).

    this.ExportBlob().then((blob) => {

      let filename = 'export';
      if (this.grid.model.document_name) {
        filename = this.grid.model.document_name.toLowerCase().replace(/\s+/g, '-');
      }

      if (blob) {
        FileSaver.saveAs(blob, filename + '.xlsx', { autoBom: false });
        this.last_save_version = this.file_version; // even though it's an export, consider it clean
      }

    }).catch(err => {

      if (/invalid uri/i.test(err.message)) {
        this.dialog?.ShowDialog({
          title: 'Error exporting file',
          close_box: true,
          message: 'The worker cannot run from the filesystem, please use a web server.',
          timeout: 3000,
          type: DialogType.error,
        });
      }

      // rethrow
      throw (err);
    });
  }

  /** 
   * Return "live" reference to selection.
   * 
   * @internal
   */
  public GetSelectionReference(): GridSelection {

    // API v1 OK

    return this.grid.GetSelection();
  }

  /**
   * Focus the grid.
   * 
   * @public
   */
  public Focus(): void {

    // API v1 OK

    this.grid.Focus();
  }

  /**
   * Update layout and repaint if necessary.
   * 
   * @remarks 
   * 
   * Call this method when the container is resized. It's not necessary
   * if the resize is triggered by our resize handle, only if the container
   * is resized externally.
   * 
   * @public
   */
  public Resize(): void {

    // API v1 OK

    this.grid.UpdateLayout();
    this.Publish({ type: 'resize' });
  }

  /** 
   * Clear/reset sheet. This will reset the undo stack as well, 
   * so it cannot be undone.
   * 
   * @public
   */
  public Reset(): void {

    // API v1 OK

    this.grid.Clear();
    this.ResetInternal();
    this.calculator.AttachModel(this.grid.model); // for leaf nodes
    this.Publish({ type: 'reset' });
  }

  /** 
   * load a document from from local storage, using the given key.
   * this method will also set the local option for the storage key, so the 
   * document will potentially be saved on modification.
   */
  public LoadFromLocalStorage(key: string): boolean {

    // API v1 OK

    // FIXME: this is weird, why do we have a method for this, why
    // does it modify the key, and so on

    this.options.storage_key = key;
    const json = localStorage.getItem(key);

    if (json) {
      try {
        const data = JSON.parse(json);
        this.LoadDocument(data, { source: LoadSource.LOCAL_STORAGE });
        return true;
      }
      catch (err) {
        console.error(err);
      }
    }

    return false; // not loaded or error

  }

  /**
   * load a network document by URI. CORS headers must be set appropriately
   * on documents originating from different hosts.
   */
  public async LoadNetworkDocument(uri: string, options?: EmbeddedSpreadsheetOptions): Promise<void> {

    const scroll = options ? options.scroll : undefined;
    const recalculate = options ? !!options.recalculate : false;
    const override_sheet = options ? options.sheet : undefined;

    // NOTE: dropping fetch, in favor of XHR; fetch requires a
    // pretty large polyfill for IE11, not worth it

    const csv = /csv(?:$|\?|&)/i.test(uri);
    const tsv = /tsv(?:$|\?|&)/i.test(uri);

    try {

      let response = await this.Fetch(uri);

      if (typeof response === 'string') {
        if (csv) {
          this.LoadCSV(response, LoadSource.NETWORK_FILE);
        }
        else if (tsv) {
          // ...
          throw new Error('tsv not supported (TODO)');
        }
        else {

          // FIXME: support anti-hijack headers if desired
          // (something like &&&START&&& or for(;;);)

          // FIXME: why? the data is fully accessible once it's
          // been loaded in here. this is silly and unecessary.

          if (response.substr(0, 11) === '&&&START&&&') {
            response = response.substr(11);
          }
          else if (response.substr(0, 8) === 'for(;;);') {
            response = response.substr(8);
          }

          const json = JSON.parse(response);
          this.LoadDocument(json, { scroll, recalculate, override_sheet, source: LoadSource.NETWORK_FILE });

        }
      }

    }
    catch (err) {
      console.info('error loading network document', uri);
      console.error(err);
      this.dialog?.ShowDialog({
        title: 'Error loading file',
        close_box: true,
        message: 'The network document returned an error',
        type: DialogType.error,
        timeout: 3000,
      });
      this.Reset();
    }

  }

  /** 
   * Load a desktop file. This method will show a file chooser and open 
   * the selected file (if any). 
   * 
   * @returns boolean, where true indicates we have successfully loaded a file.
   * false could be a load error or user cancel from the dialog.
   * 
   * @public
   */
  public async LoadLocalFile(): Promise<boolean> {

    // API v1 OK

    const file = await (this.SelectFile(
      '.treb, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json'));

    if (file) {

      try {
        await this.LoadFileInternal(file, LoadSource.LOCAL_FILE);
        return true;
      }
      catch (err) {
        this.dialog?.ShowDialog({
          title: 'Error reading file',
          close_box: true,
          message: 'Please make sure your file is a valid XLSX, CSV or TREB file.',
          type: DialogType.error,
          timeout: 3000,
        });
        return false;
      }

    }

    return false;

  }

  /**
   * Export sheet as CSV/TSV. This is an internal method called by the save 
   * document methods, but you can call it directly if you want the text as 
   * a string.
   * 
   * @returns string
   * 
   * @public
   */
  public ExportDelimited(options: ExportOptions = {}): string {

    // API v1 OK

    // set default delimiter (we used to have an object for this,
    // that seems unecessary)

    options = { delimiter: ',', ...options, };

    if (!options.delimiter || (options.delimiter !== ',' && options.delimiter !== '\t')) {
      throw new Error('invalid delimiter');
    }

    let sheet: Sheet | undefined = this.grid.model.active_sheet;

    switch (typeof options.sheet) {

      case 'undefined':
        break;

      case 'string':
        sheet = undefined;
        for (const compare of this.grid.model.sheets) {
          if (compare.name === options.sheet) {
            sheet = compare;
          }
        }
        break;

      case 'number':
        sheet = this.grid.model.sheets[options.sheet];
        break;

      default:
        sheet = undefined;
        break;

    }

    if (!sheet) {
      throw new Error('invalid sheet identifier');
    }

    const serialized_data = sheet.cells.toJSON({
      nested: false,
      expand_arrays: true,
      calculated_value: true,
    });

    const columns: string[] = [];
    for (let i = 0; i < serialized_data.columns; i++) { columns.push(''); }

    const rows: string[][] = [];
    for (let i = 0; i < serialized_data.rows; i++) {
      rows.push(columns.slice(0));
    }

    const delim_regex = new RegExp(`[\t\n\r"${options.delimiter}]`);

    // we know this is true -- would be nice to get the type system to
    // recognize that in some fashion. might be too complicated given that
    // it uses flags, though.

    if (IsFlatDataArray(serialized_data.data)) {

      for (const element of serialized_data.data) {
        let value = '';
        if ((!options.formulas) && typeof element.calculated !== 'undefined') {
          value = IsComplex(element.calculated) ?
            ComplexToString(element.calculated) :
            element.calculated.toString();
        }
        else if (typeof element.value === 'string' && element.value[0] === '\'') {
          value = element.value.substr(1);
        }
        else if (typeof element.value !== 'undefined') {
          value = IsComplex(element.value) ?
            ComplexToString(element.value) :
            element.value.toString();
        }

        if (delim_regex.test(value)) {

          // 1: escape any internal quotes
          value = value.replace(/"/g, '""');

          // 2: quote
          value = '"' + value + '"';

        }

        rows[element.row][element.column] = value;
      }

    }

    return rows.map(row => row.join(options.delimiter)).join('\r\n');

  }

  /** 
   * Save the current document to a desktop file. 
   * 
   * @param filename Filename or extension to use the document name.
   * 
   * @public
   */
  public SaveLocalFile(
    filename: string = SaveFileType.treb,
    additional_options: SaveOptions = {}): void {

    // API v1 OK

    const document_name = this.grid.model.document_name || 'document'; // FIXME: options

    let data: TREBDocument;
    let text: string;

    const parts = filename.split(/\./).filter(test => test.trim().length);
    const type = parts.length ? parts[parts.length - 1].toLowerCase() : SaveFileType.treb;

    if (parts.length <= 1) {
      if ((type === SaveFileType.csv || type === SaveFileType.tsv) && this.grid.model.sheets.length > 1) {
        const active_sheet = this.grid.model.active_sheet.name;
        filename = (document_name + '-' + active_sheet).toLowerCase().replace(/\W+/g, '-') + '.' + type;
      }
      else {
        filename = (document_name).toLowerCase().replace(/\W+/g, '-') + '.' + type;
      }
    }

    switch (type) {

      case SaveFileType.csv:
        text = this.ExportDelimited({ delimiter: ',' });
        break;

      case SaveFileType.tsv:
        text = this.ExportDelimited({ delimiter: '\t' });
        break;

      case SaveFileType.treb:
      case SaveFileType.json:
        data = this.SerializeDocument({
          // preserve_simulation_data,
          ...additional_options,
        } as SerializeOptions);
        text = JSON.stringify(data, undefined, additional_options.pretty ? 2 : undefined);
        this.last_save_version = this.file_version; // clean

        break;

      default:

        // special case: you pass in "gorge", and you want "gorge.treb".
        // FIXME: why on earth would we want to support that?

        /*
        if (parts.length === 1) {
          filename = parts[0] + '.treb';
          data = this.SerializeDocument(preserve_simulation_data);
          text = JSON.stringify(data, undefined, pretty ? 2 : undefined);
        }
        else {
          throw new Error('invalid file type');
        }
        */
        throw new Error('invalid file type');

    }

    if (text && filename) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      FileSaver.saveAs(blob, filename, { autoBom: false });
    }

  }

  /** 
   * Load CSV from string. This is used internally when loading network 
   * documents and local files, but you can call it directly if you have 
   * a CSV file as text.
   * 
   * @public
   */
  public LoadCSV(csv: string, source?: LoadSource): void {

    // API v1 OK

    // TODO: add a 'user' or 'API' load source, and set that 
    // as default so it's used when called directly

    this.grid.FromCSV(csv);
    this.ResetInternal();
    this.grid.Update(true);
    this.Publish({ type: 'load', source });
    this.UpdateDocumentStyles();

  }

  /** 
   * get or set the current scroll offset. scroll offset is automatically 
   * saved if you save the document or switch tabs; this is for saving/
   * restoring scroll if you cache the containing element.
   */
  public ScrollOffset(offset?: {x: number, y: number}): {x: number, y:number} | undefined {
    if (typeof offset !== 'undefined') {
      this.grid.SetScrollOffset(offset);
    }
    else {
      return this.grid.GetScrollOffset();
    }
  }

  /**
   * unserialize document from data.
   *
   * @privateRemarks
   * 
   * UPDATE: will no longer recalculate on load if the "rendered_values"
   * flag is set in the document (assuming it's correct), because we can
   * display those values.
   * 
   * UPDATE: default scroll to A1 in open sheet
   * 
   */
  public LoadDocument(data: TREBDocument, options: LoadDocumentOptions = {}): void {

    // API v1 OK

    /*
    the old parameters, for reference:

    data: TREBDocument,
    // scroll: string | ICellAddress = { row: 0, column: 0 },
    // flush = true,
    // recalculate = false,
    // override_sheet?: string,
    // override_selection?: GridSelection,
    // source?: LoadSource,

    */

    // set default options (matching old method parameters)

    // Q: why was there a default scroll parameter? shouldn't we just
    // leave what was in the model? (...)

    options = {
      scroll: {row: 0, column: 0},
      flush: true,
      recalculate: false,
      ...options,
    };

    if (options.override_selection) {
      if (data.sheet_data) {
        const sheets = Array.isArray(data.sheet_data) ?
          data.sheet_data : [data.sheet_data];

        for (const sheet of sheets) {
          if (sheet.id === options.override_selection.target.sheet_id) {
            sheet.selection = options.override_selection;
            break;
          }
        }
      }
    }

    this.ImportDocumentData(data, options.override_sheet);

    // this.additional_cells = [];
    this.calculator.Reset();

    // in order to support leaf vertices, we need calculator to have a valid
    // reference to cells. this happens in calculation, but if we don't calculate
    // we need to attach directly.

    // UPDATE: we can use the rebuild/clean method to do this, it will ensure
    // cells are attached

    // NOTE: accessing grid.cells, find a better approach

    // so what is happening here is we call update, which triggers a delayed
    // repaint/relayout. then we call rebuildclean, which does the initial
    // graph build. BUT, after that, the event from the grid relayout winds
    // up back in here, and we flush the grid. we need to either ignore this
    // event or suppress it.

    // I guess what we really need is to figure out if that event is actually
    // necessary, at least from that point. if we could drop it that would
    // resolve this problem in the cleanest way.

    // UPDATE: recalculate if there are volatile cells in the model.
    // FIXME: optional? parameter? (...)

    if (data.rendered_values && !options.recalculate) {
      this.grid.Update();
      this.calculator.RebuildClean(this.grid.model, true);
    }
    else {
      // console.info('load recalc');
      this.Recalculate();
    }

    // the note regarding leaves (above) is important for annotations, which
    // use leaf nodes to manage dependencies. so make sure cells are attached.

    this.InflateAnnotations();

    if (options.flush) {
      this.FlushUndo();

      // this.file_version = this.last_save_version = 0; // reset

    }

    this.Publish({ type: 'load', source: options.source }); // FIXME: should not happen on undo...
    this.UpdateDocumentStyles();
    this.loaded = true;

    if (options.scroll) {
      const scroll = options.scroll;
      Yield().then(() => this.ScrollTo(scroll));
    }

  }

  /**
   * Set note (comment) in cell.
   * 
   * @param address target address, or leave undefined to use current selection.
   * @param note note text, or leave undefined to clear existing note.
   */
  public SetNote(address: AddressReference|undefined, note?: string): void {

    // API v1 OK

    if (typeof address === 'string') {
      const reference = this.calculator.ResolveAddress(address);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    this.grid.SetNote(address, note);

  }

  /** 
   * Delete a macro function.
   * 
   * @public
   */
  public RemoveFunction(name: string): void {

    // API v1 OK

    const uppercase = name.toUpperCase();
    const keys = Object.keys(this.grid.model.macro_functions);
    for (const key of keys) {
      if (key.toUpperCase() === uppercase) {
        delete this.grid.model.macro_functions[key];
      }
    }

    this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());

  }

  /**
   * Create a macro function.
   * 
   * @public
   */
  public DefineFunction(name: string, argument_names: string | string[] = '', function_def = '0'): void {

    // API v1 OK

    // name must start with a letter, use letters numbers underscore dot

    if (!name.length || /^[^A-Za-z]/.test(name) || /[^\w_.]/.test(name)) {
      throw new Error('invalid function name');
    }

    // FIXME: watch collision with function names
    // ...

    if (typeof argument_names === 'string') {
      argument_names = argument_names ?
        argument_names.split(this.parser.argument_separator).map(arg => arg.trim()) : [];
    }

    for (const name of argument_names) {
      if (!name.length || /^[^A-Za-z]/.test(name) || /[^\w_.]/.test(name)) {
        throw new Error('invalid argument name');
      }
    }

    // overwrite
    this.RemoveFunction(name);

    this.grid.model.macro_functions[name.toUpperCase()] = {
      name,
      function_def,
      argument_names,
      expression: this.parser.Parse(function_def).expression,
    };

    this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());

  }


  /**
   * Serialize document to a plain javascript object. The result is suitable
   * for converting to JSON. This method is used by the SaveLocalFile and 
   * SaveLocalStorage methods, but you can call it directly if you want to 
   * save the document some other way.
   * 
   * @privateRemarks
   * 
   * serialize document; optionally include any MC data
   * optionally preserve rendered values
   * UPDATE: default rendered values -> true
   * 
   * @public
   */
  public SerializeDocument(options: SerializeOptions = {}): TREBDocument {

    // API v1 OK

    // add default for shrink, which can be overridden w/ explicit false

    const grid_data = this.grid.Serialize({
      shrink: true, ...options,
    });

    // NOTE: these are not really env vars. we replace them at build time
    // via a webpack plugin. using the env syntax lets them look "real" at
    // analysis time. got that trick from svelte.

    const serialized: TREBDocument = {
      app: process.env.BUILD_NAME || '',
      version: process.env.BUILD_VERSION || '',
      name: this.grid.model.document_name, // may be undefined
      user_data: this.grid.model.user_data, // may be undefined
      decimal_mark: Localization.decimal_separator,
      ...grid_data,
    };

    if (options.rendered_values) {
      serialized.rendered_values = true;
    }

    return serialized;

  }

  /** 
   * Recalculate sheet.
   * 
   * @privateRemarks
   * 
   * the event parameter should not be used if this is called
   * as an API function, remove it from typings
   * 
   * @public
   */
  public async Recalculate(event?: GridEvent): Promise<void> {

    // API v1 OK

    let area: Area | undefined;
    if (event && event.type === 'data' && event.area) {
      area = event.area;
    }

    this.calculator.Calculate(this.grid.model, area);

    this.grid.Update(true); // , area);
    this.UpdateAnnotations();
    this.Publish({ type: 'data' });

  }

  /**
   * Save document to local storage. 
   * 
   * @param key optional storage key. if omitted, the method will use
   * the key from local options (set at create time).
   */
  public SaveLocalStorage(key = this.options.storage_key): void {

    // API v1 OK

    // the signature is OK for the API, but I'm not sure the 
    // semantics are correct. this is not symmetrical with the
    // load method, because that one sets local option and this 
    // one does not.

    if (!key) {
      console.warn('not saving, no key'); // FIXME: throw?
      return;
    }

    const json = JSON.stringify(this.SerializeDocument({
      preserve_simulation_data: true,
      rendered_values: true,
      expand_arrays: true,
    } as SerializeOptions));

    localStorage.setItem(key, json);

  }

  /**
   * Revert state one level from the undo stack.
   * 
   * @public
   */
  public Undo(): void {

    // API v1 OK

    if (this.undo_pointer <= 1) {
      console.warn('nothing to undo');
      return;
    }

    const undo_entry = this.undo_stack[(--this.undo_pointer) - 1];

    // const undo_selection_set = this.undo_selection_stack[this.undo_pointer]; // <-- pointer already decremented
    // const undo_selection = undo_selection_set ? undo_selection_set[1] : undefined;
    // console.info("* undo selection", undo_selection);

    // UPDATE: we are storing calculated values in serialized data
    // in the undo stack. so we don't need to recalculate; paint immediately.
    // prevents flickering.

    const selection: GridSelection | undefined =
      undo_entry.selection ? JSON.parse(undo_entry.selection) : undefined

    // console.info('selection?', undo_entry.selection);

    this.LoadDocument(JSON.parse(undo_entry.data), {
      flush: false,
      override_selection: selection,
      source: LoadSource.UNDO,
    }); 
    // undefined, false, undefined, undefined, selection, LoadSource.UNDO);

    this.file_version--; // decrement

  }


  /** 
   * Show the about dialog.
   * 
   * @public
   */
  public About(): void {

    // API v1 OK

    this.dialog?.ShowDialog({
      type: DialogType.about,
    });
  }

  /** 
   * Scroll to the given address. In the current implementation this method
   * will not change sheets, although it probably should if the reference
   * is to a different sheet.
   * 
   * @public
   */
  public ScrollTo(address: AddressReference, options: SheetScrollOptions = {}): void {

    // API v1 OK

    if (typeof address === 'string') {
      const reference = this.calculator.ResolveAddress(address);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    // the grid method has defaults, but it's not obvious what 
    // they are and they're not visible through interfaces (?)

    // in any case we can set them here explicitly

    options = {
      x: true,
      y: true,
      smooth: false,
      ...options,
    };

    this.grid.ScrollTo(address, options.x, options.y, options.smooth);

  }

  /** 
   * Resolve a string address/range to an address or area (range) object. 
   * 
   * @param reference A string like "A1" or "Sheet1!B2:C3". If a sheet name 
   * is not included, the current active sheet is used. You can also pass a 
   * named range as reference.
   * 
   * @public
   */
  public Resolve(reference: string): ICellAddress | IArea | undefined {

    // API v1 OK

    // FIXME: although we might change the name...

    // is : a legal character in sheet names? even quoted? [A: no]

    // FIXME: we're using the sheet EnsureAddress method, but that should
    // move either in here or into some sort of helper class

    const result = this.calculator.ResolveAddress(reference);

    if (IsCellAddress(result)) {
      return result.sheet_id ? result : undefined;
    }

    return result.start.sheet_id ? result : undefined;

  }

  /**
   * Evaluate an arbitrary expression in the spreadsheet. You should generally
   * use sheet names when referring to cells, to avoid ambiguity. Otherwise
   * cell references will resolve to the active sheet.
   * 
   * @public
   */
  public Evaluate(expression: string): CellValue | CellValue[][] {

    // API v1 OK

    return this.calculator.Evaluate(expression);
  }

  /**
   * Returns the current selection, as a string address or range. 
   * 
   * @param qualified include sheet name in result. default true.
   * 
   * @returns selection as a string, or empty string if there's no selection.
   * 
   * @public
   */
  public GetSelection(qualified = true): string {

    // API v1 OK

    const ref = this.grid.GetSelection();

    if (ref.empty) {
      return '';
    }

    let range = '';

    if (ref.area.count > 1) {
      range = Area.CellAddressToLabel(ref.area.start) + ':' +
        Area.CellAddressToLabel(ref.area.end);
    }
    else {
      range = Area.CellAddressToLabel(ref.area.start);
    }

    if (!qualified) {
      return range;
    }

    // is there a function to resolve sheet? actually, don't we know that
    // the active selection must be on the active sheet? (...)

    const sheet_id = ref.area.start.sheet_id || this.grid.active_sheet.id;
    const sheet_name = this.ResolveSheetName(sheet_id, true);

    return sheet_name ? sheet_name + '!' + range : range;

  }


  /**
   * Parse a string and return a number (if possible).
   * 
   * @privateRemarks
   *
   * We're using ValueParser, which the one used when you type into a grid
   * (not the Parser parser). It's intended to handle things that would look
   * wrong in functions, like currency symbols.
   * 
   * @public
   */
  public ParseNumber(text: string): number | Complex | boolean | string | undefined {

    // API v1 OK

    /*

    ...why not?

    const expr = this.parser.Parse(text);
    if (expr.expression?.type === 'complex') {
      return {
        real: expr.expression.real,
        imaginary: expr.expression.imaginary,
      };
    }
    */

    return ValueParser.TryParse(text).value;

  }

  /**
   * Format a number with an arbitrary formatter.
   *
   * @privateRemarks
   * 
   * FIXME: should this support complex numbers? not sure...
   * 
   * @public
   */
  public FormatNumber(value: number, format = 'General'): string {

    // API v1 OK

    return NumberFormatCache.Get(format).Format(value);
  }

  /**
   * Apply borders to range. 
   * 
   * @param range pass `undefined` as range to apply to current selection.
   * 
   * @remarks 
   * 
   * Borders are part of style, but setting/removing borders is more 
   * complicated than setting other style properties. usually you want
   * things to apply to ranges, rather than individual cells. removing
   * borders needs to consider neighbor borders. and so on.
   * 
   * @public
   */
  public ApplyBorders(range: RangeReference|undefined, borders: BorderConstants, width = 1): void {

    // API v1 OK

    // the grid method can take an empty area, although it probably
    // should not, since we're wrapping up all the grid API methods.

    // still for now we can take advantage of that and skip the check.

    this.grid.ApplyBorders(range ? this.calculator.ResolveArea(range) : undefined, borders, undefined, width);

  }

  /**
   * Apply style to range. 
   * 
   * @param range pass `undefined` as range to apply to current selection.
   * @param delta apply over existing properties. default true.
   * 
   * @remarks
   * 
   * Don't use this method to set borders, use `ApplyBorders`.
   * 
   * @public
   */
  public ApplyStyle(range?: RangeReference, style: Style.Properties = {}, delta = true): void {

    // ditto re: grid method taking undefined target

    this.grid.ApplyStyle(
      range ? this.calculator.ResolveArea(range) : undefined, style, delta);
  }

  /**
   * Remove a named range (removes the name, not the range).
   * 
   * @public
   */
  public ClearName(name: string): void {

    // API v1 OK

    // FIXME: why do we have DefineName and ClearName, instead of 
    // just passing undefined for the target range? (...)

    // A: because that means "use selection". although that's not necessarily
    // a good idea...

    // NOTE: AC is handled internally
    this.grid.SetName(name);

  }

  /**
   * Create a named range. 
   * 
   * @param range leave undefined to use current selection
   * 
   * @public
   */
  public DefineName(name: string, range?: RangeReference): void {

    // API v1 OK

    if (!range) {
      const selection = this.GetSelectionReference();
      if (!selection.empty) {
        range = selection.area;
      }
      else {
        throw new Error('invalid reference');
      }
    }

    // NOTE: AC is handled internally

    this.grid.SetName(name, this.calculator.ResolveArea(range));

  }

  /**
   * define a named expression
   * 
   * @internal
   */
  public DefineNamedExpression(name: string, expression: string): void {
    this.grid.SetName(name, undefined, expression);
  }

  /**
   * Set or remove a link in a cell. 
   * 
   * @param target http/https URL or a spreadsheet reference (as text). set blank to remove link.
   * 
   * @public
   */
  public SetLink(address?: AddressReference, target = ''): void {

    // API v1 OK

    if (typeof address === 'string') {
      const reference = this.calculator.ResolveAddress(address);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    if (!address) {
      const selection = this.GetSelectionReference();
      if (selection.empty) {
        return;
      }
      address = selection.target;
    }

    this.grid.SetLink(address, target);

  }

  /**
   * Select a range.
   * 
   * @public
   */
  public Select(range: RangeReference): void {

    // API v1 OK

    // FIXME: what if the range is on another sheet? (...)

    this.grid.SelectRange(this.calculator.ResolveArea(range));
  }


  /** 
   * 
   * @param range target range. leave undefined to use current selection.
   * 
   * @public
   */
  public GetRange(range?: RangeReference, options: GetRangeOptions = {}): CellValue|CellValue[][] {

    // API v1 OK

    if (!range) {
      const selection = this.GetSelectionReference();
      if (!selection.empty) {
        range = selection.area;
      }
    }

    return range ?
      this.grid.GetRange(this.calculator.ResolveAddress(range), options.formula, options.formatted) : undefined;

  }

  /**
   * Set data in range.
   * 
   * @param range target range. leave undefined to use current selection.
   * 
   * @public
   */
  public SetRange(range?: RangeReference, data: CellValue|CellValue[][] = undefined, options: SetRangeOptions = {}): void {

    // API v1 OK

    if (!range) {
      const selection = this.GetSelectionReference();
      if (!selection.empty) {
        range = selection.area;
      }
    }

    if (range) {
      const area = this.calculator.ResolveArea(range);

      if (options.spill && Array.isArray(data)) {
        const rows = data.length;
        const columns = Math.max(0, ...data.map(row => row.length));
        const target = { 
          row: area.start.row + rows + 1, 
          column: area.start.column + columns + 1,
        }
        area.ConsumeAddress(target);
      }

      return this.grid.SetRange(
        area, data, options.recycle, options.transpose, options.array);
    }

  }

  /**
   * Subscribe to spreadsheet events
   * @param subscriber - callback function
   * @returns a token used to cancel the subscription
   */
  public Subscribe(subscriber: (event: EmbeddedSheetEvent) => void): number {
    return this.events.Subscribe(subscriber as (event: {type: string}) => void);
  }

  /**
   * Cancel subscription
   * @param token - the token returned from `Subscribe`
   */
  public Cancel(token: number): void {
    this.events.Cancel(token);
  }

  // --- internal (protected) methods ------------------------------------------

  protected Publish(event: EmbeddedSheetEvent): void {
    this.events.Publish(event);
  }

  /**
   *
   */
   protected async ImportXLSX(data: string, source: LoadSource): Promise<Blob | void> {

    if (!this.export_worker) {
      const worker_name = process.env.BUILD_ENTRY_EXPORT_WORKER || '';
      this.export_worker = await this.LoadWorker(worker_name);
    }

    // this originally returned a Promise<Blob> but the actual
    // code path always calls resolve(), so it should probably be
    // Promise<void>. for the time I'm punting but this should be 
    // cleaned up. FIXME

    return new Promise<Blob | void>((resolve, reject) => {
      if (this.export_worker) {

        this.dialog?.ShowDialog({
          message: 'Importing XLSX...'
        });

        this.export_worker.onmessage = (event) => {
          if (event.data) {

            if (event.data.status === 'error') {
              return reject(event.data.error || 'unknown error');
            }

            this.grid.FromImportData(event.data.results);

            this.ResetInternal();
            this.grid.Update();

            // this one _is_ the grid cells

            this.calculator.AttachModel(this.grid.model);
            this.Publish({ type: 'load', source, });
            this.UpdateDocumentStyles();

            // add to support import charts

            this.InflateAnnotations();

          }
          else {
            return reject('unknown error (missing data)');
          }

          this.dialog?.HideDialog();
          resolve();
        };
        this.export_worker.onerror = (event) => {
          console.error('import worker error');
          console.info(event);
          reject(event);
        };
        this.export_worker.postMessage({
          command: 'import', data,
        });
      }
      else {
        reject('worker failed');
      }

    });

  }

  /**
   * some local cleanup, gets called in various import/load/reset functions
   * this is shrinking to the point of being unecessary... although we are
   * possibly overloading it.
   */
  protected ResetInternal(): void {
    // this.additional_cells = [];
    this.calculator.Reset();
    this.FlushUndo();

    this.file_version = this.last_save_version = 0;
  }

  protected HandleCellEvent(event: CellEvent): void {

    const type = event.data?.type;
    if (type === 'hyperlink') {

      const hyperlink_error = 'hyperlink invalid target';
      const data = event.data.data || '';

      if (typeof data === 'string') {

        if (/^https{0,1}:\/\//i.test(data)) {

          if (!this.options.hyperlinks) {
            console.warn('hyperlinks are disabled');
            return;
          }

          const a = document.createElement('a');
          a.setAttribute('target', this.options.hyperlinks);
          a.setAttribute('href', data);
          a.setAttribute('noreferrer', 'true');
          a.setAttribute('nofollow', 'true');
          a.click();

          return;

        }
        else {

          const parse_result = this.parser.Parse(data);
          if (parse_result.expression) {

            // probably can always allow reference links

            if (parse_result.expression.type === 'address') {
              if (parse_result.expression.sheet || parse_result.expression.sheet_id) {
                this.ActivateSheet((parse_result.expression.sheet || parse_result.expression.sheet_id) as string | number);
              }
              this.Select(data);
              return;
            }
            else if (parse_result.expression.type === 'range') {
              if (parse_result.expression.start.sheet || parse_result.expression.start.sheet_id) {
                this.ActivateSheet((parse_result.expression.start.sheet || parse_result.expression.start.sheet_id) as string | number);
              }
              this.Select(data);
              return;
            }

          }
        }

        console.warn(hyperlink_error, 2);
        return;

      }
    }
  }


  protected OnSheetChange(event: SheetChangeEvent): void {

    // call annotation method(s) on any annotations in active sheet

    // we stopped sending the 'create' event on sheet change, so
    // now we have to inflate them on sheet change

    for (const annotation of event.activate.annotations) {
      // if (annotation.update_callback) {
      //   annotation.update_callback();
      // }

      this.InflateAnnotation(annotation);
      this.calculator.UpdateAnnotations(annotation);

    }

    // we also need to update annotations that are already inflated
    // [FIXME: merge this code]

    this.UpdateAnnotations();

  }

  protected HandleDrag(event: DragEvent): void {
    if (event.dataTransfer && event.dataTransfer.types) {

      // this is for IE11, types is not an array

      if (event.dataTransfer.types.some && event.dataTransfer.types.some((check) => check === 'Files')) {
        event.preventDefault();
      }
      else {
        for (let i = 0; i < event.dataTransfer.types.length; i++) {
          if (event.dataTransfer.types[i] === 'files') {
            event.preventDefault();
            return;
          }
        }
      }
    }
  }

  protected HandleDrop(event: DragEvent): void {

    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
      event.preventDefault();
      const file = event.dataTransfer.files[0];

      if (/^image/.test(file.type)) {
        this.InsertImage(file);
      }
      else {
        this.LoadFileInternal(file, LoadSource.DRAG_AND_DROP).then(() => {
          // ...
        }).catch((err) => {
          this.dialog?.ShowDialog({
            title: 'Error reading file',
            close_box: true,
            message: 'Please make sure your file is a valid XLSX, CSV or TREB file.',
            type: DialogType.error,
            timeout: 3000,
          });
          console.error(err);
        });
      }
    }
  }

  /**
   * replacement for fetch
   * FIXME: move to utils or other lib
   * FIXME: we don't need to do this for ES6, presumably...
   * can this move into the legacy/modern code? or is there a polyfill? (...)
   */
  protected async Fetch(uri: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject('load error');
      xhr.ontimeout = () => reject('timeout');
      xhr.open('GET', uri);
      xhr.send();
    });
  }


  /**
   * show file chooser and resolve with the selected file, or undefined
   */
  protected SelectFile(accept?: string): Promise<File | undefined> {

    return new Promise((resolve) => {

      const file_chooser = document.createElement('input');
      file_chooser.type = 'file';

      if (accept) {
        file_chooser.accept = accept;
      }

      // so the thing here is there is no way to trap a "cancel" event
      // from the file chooser. if you are waiting on a promise, that will
      // just get orphaned forever. 

      // it's not the end of the world, really, to leave a few of these 
      // dangling, but this should allow it to clean up.

      // the concept is that since file chooser is modal, there will never
      // be a focus event until the modal is closed. unfortunately the focus
      // event comes _before_ any input or change event from the file input,
      // so we have to wait.

      // tested Cr, FF, IE11
      // update: works in Safari, although oddly not if you call the API
      // function from the console. not sure if that's a browserstack thing.

      // eslint-disable-next-line prefer-const
      let finalize: (file?: File) => void;
      let timeout: NodeJS.Timeout|undefined;

      // if you get a focus event, allow some reasonable time for the 
      // corresponding change event. realistically this should be immediate,
      // but as long as there's not a lot of logic waiting on a cancel, it 
      // doesn't really matter.

      const window_focus = () => {

        // prevent this from accidentally being called more than once
        window.removeEventListener('focus', window_focus);
        timeout = setTimeout(finalize, 250);
      }

      const change_handler = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined; // necessary?
        }
        finalize(file_chooser.files ? file_chooser.files[0] : undefined);
      }

      // our finalize method cleans up and resolves

      finalize = (file?: File) => {
        file_chooser.removeEventListener('change', change_handler);
        window.removeEventListener('focus', window_focus);
        resolve(file);
      };

      file_chooser.addEventListener('change', change_handler);
      window.addEventListener('focus', window_focus);

      file_chooser.click();


    });

  }

  /** called when we have a file to write to */
  protected LoadFileInternal(file: File, source: LoadSource): Promise<void> {

    if (!file) { return Promise.resolve(); }

    const reader = new FileReader();

    return new Promise<void>((resolve, reject) => {

      // FIXME: worker?
      // FIXME: is this not getting called for CSVs? (...)

      const finalize = (err?: string) => {
        reader.onload = null;
        reader.onabort = null;
        reader.onerror = null;
        // this.busy = false;
        if (err) reject(err);
        else resolve();
      };

      reader.onload = () => {

        try {
          if (reader.result) {
            if (/\.csv$/i.test(file.name)) {
              this.LoadCSV(reader.result as string, source);
            }
            else if (/\.xls[xm]$/i.test(file.name)) {
              let contents: string;

              if (typeof reader.result === 'string') {
                contents = reader.result;
              }
              else {  // IE11

                /* can break on large blob
                contents = String.fromCharCode.apply(null,
                  (new Uint8Array(reader.result as ArrayBuffer) as any));
                */

                // FIXME: chunk

                contents = '';
                const bytes = new Uint8Array(reader.result);
                for (let i = 0; i < bytes.byteLength; i++) {
                  contents += String.fromCharCode(bytes[i]);
                }

              }

              this.ImportXLSX(contents, source).then(() => finalize()).catch(err => finalize(err));

              return;
            }
            else {
              const data = JSON.parse(reader.result as string);
              this.LoadDocument(data, { source });
            }
          }
          finalize();
        }
        catch (err) {
          finalize((err as { toString: () => string })?.toString());
        }
      };

      reader.onabort = () => { finalize('Aborted'); };
      reader.onerror = () => { finalize('File error'); };

      // need a nontrivial delay to allow IE to re-render.
      // FIXME: this should be done async, possibly in a worker

      setTimeout(() => {
        if (/\.xlsx$/i.test(file.name)) {
          if (reader.readAsBinaryString) {
            reader.readAsBinaryString(file);
          }
          else {
            reader.readAsArrayBuffer(file); // IE11
          }
        }
        else {
          reader.readAsText(file);
        }
      }, 100);

    });

  }


  /** testing
   *
   * this is called after recalc, check any annotations
   * (just sparklines atm) and update if necessary.
   */
  protected UpdateAnnotations(): void {
    for (const annotation of this.grid.model.active_sheet.annotations) {
      if (annotation.temp.vertex) {
        const vertex = annotation.temp.vertex as LeafVertex;
        if (vertex.state_id !== annotation.temp.state) {
          annotation.temp.state = vertex.state_id;
          if (annotation.update_callback) {
            annotation.update_callback();
          }
          this.grid.AnnotationUpdated(annotation);
        }
      }
    }
  }

  /*
  public SetHeadless(headless = true): void {
    if (this.grid.headless === headless) {
      return;
    }

    this.grid.headless = headless;
    if (!headless) {
      this.grid.Update(true);
      this.RebuildAllAnnotations();
      // this.InflateAnnotations();
    }
  }
  */

  /**
   * this method should be called after changing the headless flag
   */
  protected RebuildAllAnnotations(): void {
    for (const annotation of this.grid.model.active_sheet.annotations) {
      this.InflateAnnotation(annotation);
      if (annotation.resize_callback) {
        annotation.resize_callback();
      }
      if (annotation.update_callback) {
        annotation.update_callback();
      }
    }
  }

  /**
   * inflate all annotations. intended to be called after a document
   * load (including undo), which does not send `create` events.
   * 
   * FIXME: why is this public?
   */
  protected InflateAnnotations(): void {
    for (const annotation of this.grid.model.active_sheet.annotations) {
      this.InflateAnnotation(annotation);
    }
  }

  protected InflateAnnotation(annotation: Annotation): void {

    if (this.grid.headless) { return; }

    // only inflate once, to prevent overwriting instance methods

    if (annotation.inflated) {

      // I don't think we're using dirty anymore... actually we still
      // need it right now. it gets _set_ on express scale change, so
      // when we switch back to this sheet it will be updated even though
      // the data has not changed.

      // assuming rendering charts is fairly cheap, the alternative would
      // be to just always repaint. OTOH what is the cost of this flag?

      if (annotation.dirty) {

        if (annotation.resize_callback) {
          annotation.resize_callback();
        }
        annotation.dirty = false;
      }
      return;
    }

    annotation.inflated = true;

    if (annotation.dirty) {
      annotation.dirty = false;
    }

    if (annotation.content_node && annotation.data) {

      if (annotation.type === 'treb-chart') {

        // if (!(self as any).TREB || !(self as any).TREB.CreateChart2) {
        //    console.warn('missing chart library');
        // }
        // else 
        {

          const chart = new Chart();
          chart.Initialize(annotation.content_node);

          // const chart = (self as any).TREB.CreateChart2(annotation.node) as Chart;

          // we may need to register library functions. we only need to do
          // that once. not sure I like this as the place for the test, though.

          // HEADS UP: this breaks when there are multiple sheet instances on
          // the page, because the register flag is in the other lib (!)

          // we need a local flag...

          if (!this.registered_libraries['treb-charts']) {

            // this is a little simpler because we now integrate charts;
            // some of this logic should be restructured (although we 
            // should memorialize the pattern for managing external libs)

            //this.calculator.RegisterFunction((chart.constructor as any).chart_functions);
            this.calculator.RegisterFunction(ChartFunctions);
            this.registered_libraries['treb-charts'] = true;

            // update AC list
            this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());
          }

          const update_chart = () => {

            if (annotation.formula) {
              const parse_result = this.parser.Parse(annotation.formula);
              if (parse_result &&
                parse_result.expression &&
                parse_result.expression.type === 'call') {

                // FIXME: make a method for doing this

                this.parser.Walk(parse_result.expression, (unit) => {
                  if (unit.type === 'address' || unit.type === 'range') {
                    this.calculator.ResolveSheetID(unit);
                  }
                  return true;
                });

                const expr_name = parse_result.expression.name.toLowerCase();

                const result = this.calculator.CalculateExpression(parse_result.expression);

                chart.Exec(expr_name, result as ExtendedUnion); // FIXME: type?

              }
            }

            chart.Update();

          };

          /** resize callback */
          annotation.resize_callback = () => {
            if (!this.grid.headless) {
              chart.Resize();
              chart.Update();
            }
          };

          /** update callback */
          annotation.update_callback = () => {
            if (!this.grid.headless) {
              update_chart();
            }
          };

          /** call once */
          if (annotation.node?.parentElement) {
            if (!this.grid.headless) {
              update_chart();
            }
          }

        }

      }
      else if (annotation.type === 'image') {
        const img = document.createElement('img');
        if (typeof annotation.data.src === 'string' && /^data:image/i.test(annotation.data.src)) {
          img.setAttribute('src', annotation.data.src);
        }
        img.style.width = '100%';
        img.style.height = '100%';
        annotation.content_node.appendChild(img);
      }
    }
  }

  /** 
   * save sheet to local storage and trigger (push) undo. our undo system
   * relies on tracking selection after storing the main data, and sometimes
   * we need to manage this explicitly: hence the parameter.
   * 
   */
  protected DocumentChange(undo_selection?: string): void {

    Yield().then(() => {

      const json = JSON.stringify(this.SerializeDocument({
        preserve_simulation_data: false,
        rendered_values: true,
        expand_arrays: true,
      } as SerializeOptions));

      if (this.options.storage_key) {
        localStorage.setItem(this.options.storage_key, json);
      }
      if (this.options.undo) {
        this.PushUndo(json, undo_selection);
      }

      this.Publish({ type: 'document-change' });

    });
  }

  protected PushUndo(json?: string, last_selection?: string): void {

    const selection = last_selection || this.last_selection;

    // console.info('push undo', JSON.stringify(selection));

    if (this.undo_stack[this.undo_pointer - 1]) {
      this.undo_stack[this.undo_pointer - 1].selection = selection;
      // console.info('set at pointer', this.undo_pointer-1, this.last_selection);
    }

    if (!json) {
      json = JSON.stringify(this.SerializeDocument({
        preserve_simulation_data: false,
        rendered_values: true,
        expand_arrays: true,
      } as SerializeOptions));
    }

    // insert at [undo_pointer], then increment the pointer

    this.undo_stack[this.undo_pointer++] = {
      data: json,
      selection: undefined,
    };

    // FIXME: should truncate the stack at pointer, because we might not be at end

    // FIXME: parameterize max length

    const length = this.undo_stack.length;

    if (length > 16) {
      const delta = length - 16;
      this.undo_stack = this.undo_stack.slice(delta);
      this.undo_pointer -= delta;
    }

    this.file_version++; // increment

  }

  /**
   * clear the undo stack, and optionally push an initial state
   */
  protected FlushUndo(push = true): void {

    // console.info('flush undo');

    this.undo_stack = [];
    this.undo_pointer = 0;
    if (push) {
      this.PushUndo();
    }

    this.last_save_version = this.file_version = 0;

  }


  /** 
   * update selection: used for updating toolbar (i.e. highlight bold button) 
   * 
   * we can also use this to better manage selection in the undo system...
   * 
   */
  protected UpdateSelection(selection: GridSelection): void {

    // console.info("US", JSON.stringify(selection));

    // cache for undo
    this.last_selection = JSON.stringify(selection);

    this.Publish({ type: 'selection' });
  }


  /** update selection style for the toolbar */
  protected UpdateSelectionStyle(selection?: GridSelection): void {

    const freeze = this.grid.GetFreeze();

    const state: SelectionState = {
      frozen: !!freeze.rows || !!freeze.columns,
    };

    if (!selection) {
      selection = this.grid.GetSelection();
    }

    if (selection && !selection.empty) {

      state.selection = selection;
      state.merge = false;
      let data = this.grid.model.active_sheet.CellData(selection.target);

      state.merge = !!data.merge_area;
      if (state.merge && data.merge_area && (
        data.merge_area.start.row !== selection.target.row ||
        data.merge_area.start.column !== selection.target.column)) {
        data = this.grid.model.active_sheet.CellData(data.merge_area.start);
      }

      this.active_selection_style = data.style;
      state.comment = data.note;
      state.style = data.style ? { ...data.style } : undefined;

    }
    else {
      this.active_selection_style = {};
    }

    this.toolbar?.UpdateState(state);

  }

  protected UpdateDocumentStyles(update = true): void {

    if (!this.toolbar) {
      return;
    }

    const number_format_map: { [index: string]: number } = {};
    const color_map: { [index: string]: number } = {};

    for (const sheet of this.grid.model.sheets) {
      sheet.NumberFormatsAndColors(color_map, number_format_map);
    }

    this.toolbar.UpdateDocumentStyles(
      Object.keys(number_format_map),
      Object.keys(color_map),
      update);

    // console.info(number_format_map, color_map);

  }

  /* * overloadable for subclasses * /
  protected InitCalculator(): CalcType {
    return new Calculator();
  }
  */

  protected ConvertLocale(data: TREBDocument): void {

    // FIXME: belongs in model? (...)

    // NOTE: we use a new parser instance here because we're modifying
    // the localization flags; seems safer to use a separate instance and
    // not change the local instance

    const parser = new Parser();

    let target_decimal_mark: DecimalMarkType;
    let target_argument_separator: ArgumentSeparatorType;

    // FIXME: these conversions should be easier... we should have a simple
    // switch in the parser/renderer function

    // FIXME: also we should unify on types for decimal, argument separator

    if (data.decimal_mark === '.') {
      parser.decimal_mark = DecimalMarkType.Period;
      parser.argument_separator = ArgumentSeparatorType.Comma;
      target_decimal_mark = DecimalMarkType.Comma;
      target_argument_separator = ArgumentSeparatorType.Semicolon;
    }
    else {
      parser.decimal_mark = DecimalMarkType.Comma;
      parser.argument_separator = ArgumentSeparatorType.Semicolon;
      target_decimal_mark = DecimalMarkType.Period;
      target_argument_separator = ArgumentSeparatorType.Comma;
    }

    const translate = (formula: string): string | undefined => {
      const parse_result = parser.Parse(formula);
      if (!parse_result.expression) { return undefined; }
      return '=' + parser.Render(
        parse_result.expression,
        undefined,
        '',
        target_decimal_mark,
        target_argument_separator);
    };

    if (data.macro_functions) {
      for (const macro_function of data.macro_functions) {
        const translated = translate(macro_function.function_def);
        if (translated) {
          macro_function.function_def = translated;
        }
      }
    }

    if (data.sheet_data) {

      const sheets = Array.isArray(data.sheet_data) ? data.sheet_data : [data.sheet_data];

      for (const sheet_data of sheets) {

        if (sheet_data.annotations) {
          for (const annotation of (sheet_data.annotations as Annotation[])) {
            if (annotation.formula) {
              const translated = translate(annotation.formula);
              if (translated) {
                annotation.formula = translated;
              }
            }
          }
        }

        if (sheet_data.data?.length) {

          // update for grouped data (v5+)
          for (const block of sheet_data.data) {
            const cells = IsFlatData(block) ? [block] : block.cells;

            for (const cell of cells) {
              if (cell.value && typeof cell.value === 'string' && cell.value[0] === '=') {
                const translated = translate(cell.value.slice(1));
                if (translated) {
                  cell.value = translated;
                }
              }
            }
          }
        }
      }
    }

  }


  /**
   * compare two semantic versions. returns an object indicating 
   * the greater version (or equal), plus individual component comparisons.
   * 
   * FIXME: move to util lib?
   */
  protected CompareVersions(a = '', b = ''): SemanticVersionComparison {

    const av = a.split('.').map(value => Number(value) || 0).concat([0, 0, 0]);
    const bv = b.split('.').map(value => Number(value) || 0).concat([0, 0, 0]);

    const levels: SemanticVersionElement[] = [
      SemanticVersionElement.major, SemanticVersionElement.minor, SemanticVersionElement.patch
    ];
    const result: SemanticVersionComparison = { match: 0 };

    for (let i = 0; i < 3; i++) {
      if (av[i] !== bv[i]) {
        result.match = av[i] > bv[i] ? 1 : -1;
        result.level = levels[i];
        break;
      }
    }

    return result;

  }

  /**
   * import data from serialized document, doing locale conversion if necessary
   */
  protected ImportDocumentData(data: TREBDocument, override_sheet?: string): void {

    // FIXME: version check

    // new structure has this in an array; support old structure.
    // for now, pull out sheet[0]. multi-sheet pending. you still
    // need to test that this object is not undefined.

    // const sheet_data = (data.sheet_data && Array.isArray(data.sheet_data)) ?
    //  data.sheet_data[0] :
    //  data.sheet_data;

    // as an array...

    let sheets: SerializedSheet[] = [];

    const compare = this.CompareVersions(data.version, process.env.BUILD_VERSION);
    if (compare.match > 0) {
      if (compare.level === SemanticVersionElement.major || compare.level === SemanticVersionElement.minor) {
        console.warn(`The file you are opening was created with a newer version of TREB (${data.version} vs ${process.env.BUILD_VERSION}).\nYou may encounter compatibility errors.`);
      }
    }

    if (data.sheet_data) {
      if (Array.isArray(data.sheet_data)) {
        sheets = data.sheet_data;
      }
      else {
        sheets.push(data.sheet_data);
      }
    }

    // FIXME: it's not necessary to call reset here unless the
    // document fails, do that with a trap?

    // l10n

    if (data.decimal_mark && data.decimal_mark !== Localization.decimal_separator) {
      this.ConvertLocale(data);
    }

    // why is it not complaining about this? (...)

    this.grid.UpdateSheets(sheets, undefined, override_sheet || data.active_sheet);
    const model = this.grid.model;

    model.document_name = data.name;
    model.user_data = data.user_data;
    model.named_ranges.Reset();

    // old models have it in sheet, new models have at top level -- we can
    // support old models, but write in the new syntax

    let named_range_data = data.named_ranges;
    if (!named_range_data && sheets[0] && sheets[0].named_ranges) {
      named_range_data = sheets[0].named_ranges;
    }

    if (named_range_data) {
      model.named_ranges.Deserialize(named_range_data);
    }

    model.named_expressions = {};
    if (data.named_expressions) {
      for (const pair of data.named_expressions) {
        const parse_result = this.parser.Parse('' || pair.expression);
        if (parse_result.valid && parse_result.expression) {
          model.named_expressions[pair.name.toUpperCase()] = parse_result.expression;
        }
      }
    }

    model.macro_functions = {};
    if (data.macro_functions) {
      for (const macro_function of data.macro_functions) {

        // FIXME: i18n of expression
        // FIXME: autocomplete (also when you do that, remember to undo it)

        model.macro_functions[macro_function.name.toUpperCase()] = {
          ...macro_function,
          expression: this.parser.Parse(macro_function.function_def || '').expression,
        };

      }
    }

  }

  /**
   * load worker. optionally uses an ambient path as prefix; intended for
   * loading in different directories (or different hosts?)
   */
  protected async LoadWorker(name: string): Promise<Worker> {

    if (!EmbeddedSpreadsheetBase.treb_base_path) {
      console.warn('worker path is not set. it you are loading TREB in an ESM module, please either '
        + 'include the script in a document <script/> tag, or call the method TREB.SetScriptPath() to '
        + 'set the load path for workers (this should be the path to TREB script files).');
      throw new Error('worker path not set');
    }

    if (EmbeddedSpreadsheetBase.treb_language) {
      name += '-' + EmbeddedSpreadsheetBase.treb_language;
    }

    if (!/\.js$/.test(name)) name += ('-' + process.env.BUILD_VERSION + '.js');

    let worker: Worker;
    let treb_path = EmbeddedSpreadsheetBase.treb_base_path;

    if (treb_path) {
      if (!/\/$/.test(treb_path)) treb_path += '/';
      name = treb_path + name;
    }

    // for remote workers, fetch and construct as blob. for local
    // workers we can just create.

    // actually we're now getting a fully-qualified URL, so it will
    // always have a network prefix (or a file prefix)

    // FIXME: testing... in particular URL.createObjectURL and new Blob

    if (/^(http:|https:|\/\/)/.test(name)) {
      const script = await this.Fetch(name);
      worker = new Worker(URL.createObjectURL(new Blob([script], { type: 'application/javascript' })));
    }
    else if (/^file:/.test(name)) {
      throw new Error('invalid URI');
    }
    else {

      // this was intended for relative URIs but now it is applied
      // to file:// URIs, which won't work anyway (in chrome, at least)

      worker = new Worker(name);

    }

    return worker;

  }

  /**
   * handle key down to intercept ctrl+z (undo)
   *
   * FIXME: redo (ctrl+y or ctrl+shift+z)
   */
  protected HandleKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey && (event.code === 'KeyZ' || event.key === 'z')) {
      event.stopPropagation();
      event.preventDefault();
      this.Undo();
    }
  }

  protected ResolveSheetName(id: number, quote = false): string | undefined {
    for (const sheet of this.grid.model.sheets) {
      if (sheet.id === id) {
        if (quote && QuotedSheetNameRegex.test(sheet.name)) {
          return `'${sheet.name}'`;
        }
        return sheet.name;
      }
    }
    return undefined;
  }

}
