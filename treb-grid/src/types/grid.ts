
import {
  Rectangle, ValueType, Style, Area, Cell,
  Extent, ICellAddress, IsCellAddress, Localization
} from 'treb-base-types';
import {
  Parser, DecimalMarkType, ExpressionUnit, ArgumentSeparatorType, ParseCSV,
  QuotedSheetNameRegex, IllegalSheetNameRegex
} from 'treb-parser';
import { EventSource, Yield, SerializeHTML } from 'treb-utils';
import { NumberFormatCache, RDateScale, ValueParser, Hints } from 'treb-format';
import { SelectionRenderer } from '../render/selection-renderer';

import { TabBar } from './tab_bar';
import { Sheet } from './sheet';
import { TileRange, BaseLayout } from '../layout/base_layout';
import { GridLayout } from '../layout/grid_layout';
import { LegacyLayout } from '../layout/legacy_layout';

import { GridSelection } from './grid_selection';
import { Theme, ExtendedTheme, CalculateSupplementalColors, LoadThemeProperties } from './theme';
import { CellEditor } from '../editors/cell_editor';

import { TileRenderer } from '../render/tile_renderer';
import { GridEvent } from './grid_events';
import { SheetEvent } from './sheet_types';
import { FormulaBar } from '../editors/formula_bar';
import { GridOptions, DefaultGridOptions } from './grid_options';
import { AutocompleteMatcher, FunctionDescriptor } from '../editors/autocomplete_matcher';
import { BorderConstants } from './border_constants';
import { SerializeOptions } from './serialize_options';
import { UA } from '../util/ua';
import { Annotation } from './annotation';
import { Autocomplete } from '../editors/autocomplete';

import { MouseDrag } from './drag_mask';

import {
  Command, CommandKey, CommandRecord,
  SetRangeCommand, FreezeCommand, UpdateBordersCommand,
  InsertRowsCommand, InsertColumnsCommand, SetNameCommand,
  ActivateSheetCommand, ShowSheetCommand, SheetSelection, DeleteSheetCommand
} from './grid_command';

import { DataModel, MacroFunction } from './data_model';
import { NamedRangeCollection } from './named_range';

interface DoubleClickData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeout?: any;
  address?: ICellAddress;
}

enum EditingState {
  NotEditing = 0,
  CellEditor = 1,
  FormulaBar = 2,
}

// const DEFAULT_NEW_SHEET_ROWS = 30;
// const DEFAULT_NEW_SHEET_COLUMNS = 20;

export class Grid {

  // --- public members --------------------------------------------------------

  /** events */
  public grid_events = new EventSource<GridEvent>();

  /** for recording */
  public command_log = new EventSource<CommandRecord>();

  /**
   * the theme object exists so we can pass it to constructors for
   * various components, but it's no longer initialized until the
   * initialization step (when we have a node).
   */
  public readonly theme: ExtendedTheme;

  /**
   * local sheet instance. we always have a sheet, change the data
   * (not the instance).
   *
   * UPDATE: sheet is now private. this is the first step in the long
   * process of replacing it. to support the sheet being private, we need
   * some additional methods and accessors.
   *
   * also readonly, to enforce that we keep the reference (note that you
   * can in fact reassign readonly in the constructor. I do not like that).
   *
   * FIXME: why again is this readonly? I get that we want to pass references
   * around, but why not have a container and pass references to that? sheet
   * should not be constant/readonly. it breaks the metaphor.
   *
   * IN FACT, why not pass an accessor? (...)
   * also a nice way to transition... we now have a wrapper object, and we can
   * switch the member to an accessor (DM will have to become a class)
   */
  public readonly model: DataModel;

  // new...
  public headless = false;

  // --- private members -------------------------------------------------------

  /** are we editing? */
  private editing_state: EditingState = EditingState.NotEditing;

  /** if we are editing, what is the cell? */
  private editing_cell: ICellAddress = { row: -1, column: -1, sheet_id: 0 };

  /**  */
  private selected_annotation?: Annotation;

  /** */
  private editing_annotation?: Annotation;

  /**
   * this should not be public -- clients should only interact with the API.
   * so why is it public? we need to access it in the calculator (and in the
   * calculator in the worker, for simulations).
   *
   * FIXME: find a solution for this.
   */
  private get cells() {
    return this.model.active_sheet.cells;
  }

  private grid_container?: HTMLElement;

  /** containing element, passed in */
  private container?: HTMLElement;

  /** dom structure for grid */
  private readonly layout: BaseLayout;

  /**
   * this flag is used to lazily rebuild tiles. that prevents flashing if
   * there is a lot of work between a reset/document change and the next
   * paint call.
   */
  private tile_update_pending = false;

  /**
   * spreadsheet language parser. used to pull out address
   * references from functions, for highlighting
   */
  private parser = new Parser();

  /** this is used when testing if a typed character is numeric */
  private decimal_separator_code = 0x2e; // "."

  /** in-cell editor */
  private cell_editor?: CellEditor;

  /** formula bar editor (optional) */
  private formula_bar?: FormulaBar;

  private RESIZE_PIXEL_BUFFER = 5;

  /**
   * flag indicating we're resizing, or hovering over a resize.
   * we use this so we know what to do when we see a click on the headers.
   */
  private cell_resize = { row: -1, column: -1 };

  /**
   * this is the only thing that was used in the old 'render state',
   * so we dropped the container.
   */
  private render_tiles = new TileRange({ row: 0, column: 0 });

  // primary and active selections now _always_ exist. we use flags
  // to indicate that they're empty (i.e. nothing is selected). this
  // allows us to pass and test actual objects.
  //
  // like const, readonly only affects the immediate property and not
  // subproperties. so here we use it to ensure selections are never
  // reassigned or deassigned.

  /**
   * the main selection for interacting with the spreadsheet
   */
  private readonly primary_selection: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
    empty: true,
  };

  /* *
   * this selection is for highlighting only
   * /
  private readonly highlight_selection: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
    empty: true,
  };
  */

  /**
   * active selection when selecting arguments (while editing)
   */
  private readonly active_selection: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
    empty: true,
  };

  /**
   * this flag is for testing if we were previously in the nub
   */
  private nub_select_flag = false;

  /**
   * current mouse move cell
   */
  private hover_cell: ICellAddress = { row: -1, column: -1 };

  /**
   * flag indicating we're showing a note, so we can stop
   */
  private hover_note_visible = false;

  /**
   * additional selections that are rendered but not otherwise used.
   * this array is now readonly, so we can bind it to the selection
   * renderer (we do this with the primary selection as well)
   */
  private readonly additional_selections: GridSelection[] = [];

  /**
   * state data for handling double-clicks. because we're using
   * mousedown, we need to synthesize double-clicks with a timeout.
   */
  private double_click_data: DoubleClickData = {};

  /**
   * window timer/request animation frame token. this is used to prevent
   * excess repaints on scroll. FIXME: can this merge with the delayed
   * render token? I think originally it was separate because that other
   * method was too slow for scrolling... maybe...
   */
  private layout_token = 0;

  /** window timer/request animation frame token */
  private render_token = 0;

  /** */
  private tile_renderer: TileRenderer;

  /** */
  private selection_renderer: SelectionRenderer;

  /** */
  private options: GridOptions;

  /**
   * single instance of AC. editors (function bar, ICE) have references.
   */
  private autocomplete_matcher = new AutocompleteMatcher();

  // FIXME: move

  // private tab_bar?: HTMLElement;
  private tab_bar?: TabBar;

  /**
   * replacement for global style default properties.
   * FIXME: move (model?)
   *
   * SEE comment in sheet class
   */
  private readonly theme_style_properties: Style.Properties =
    Style.Composite([Style.DefaultProperties]);

  // --- constructor -----------------------------------------------------------

  /**
   * FIXME: NO PARAMETER INITIALIZATIONS
   */
  constructor(options: GridOptions = {}, theme: Theme = {}) {

    // construct model. it's a little convoluted because the
    // "active sheet" reference points to one of the array members

    const sheets = [
      Sheet.Blank(this.theme_style_properties),
    ];

    this.model = {
      sheets,
      active_sheet: sheets[0],
      // annotations: [],
      named_ranges: new NamedRangeCollection(),
      macro_functions: {},
    };

    // set properties here, we will update in initialize()

    this.theme = { ...theme };

    // apply default options, meaning that you need to explicitly set/unset
    // in order to change behavior. FIXME: this is ok for flat structure, but
    // anything more complicated will need a nested merge

    this.options = { ...DefaultGridOptions, ...options };

    this.layout = UA.is_modern ?
      new GridLayout(this.model) :
      new LegacyLayout(this.model);

    this.tile_renderer = new TileRenderer(this.theme, this.layout, this.model, this.options);
    this.selection_renderer = new SelectionRenderer(
      this.theme,
      this.layout,
      this.model,
      this.primary_selection,
      this.additional_selections);

    if (Localization.decimal_separator === '.') {
      this.parser.decimal_mark = DecimalMarkType.Period;
      this.parser.argument_separator = ArgumentSeparatorType.Comma;
    }
    else {
      this.parser.decimal_mark = DecimalMarkType.Comma;
      this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
    }

    this.decimal_separator_code = Localization.decimal_separator.charCodeAt(0);

  }

  // --- public methods --------------------------------------------------------

  /**
   * set note at the given address, or current selection
   * @param address optional address; if not used, note will be set/cleared
   * at current selection
   * @param note new note, or undefined to clear note
   */
  public SetNote(address?: ICellAddress, note?: string) {

    if (!address) {
      if (this.primary_selection.empty) return;
      address = this.primary_selection.target;
    }

    this.ExecCommand({
      key: CommandKey.SetNote,
      address,
      note,
    });

  }

  /** find an annotation, given a node */
  public FindAnnotation(node: HTMLElement) {
    for (const annotation of this.model.active_sheet.annotations) {
      if (annotation.node === node) {
        return annotation;
      }
    }
    return undefined;
  }

  /**
   * create an annotation, with properties, without an original object.
   * optionally (and by default) add to sheet.
   *
   * @param offset check for a matching position (top-left) and if found,
   * shift by (X) pixels. intended for copy-paste, where we don't want to
   * paste immediately on top of the original.
   */
  public CreateAnnotation(properties: object = {}, add_to_sheet = true, offset = false) {
    const annotation = new Annotation(properties);
    if (offset && annotation.rect) {
      let recheck = true;
      while (recheck) {
        recheck = false;
        for (const test of this.model.active_sheet.annotations) {
          if (test === annotation) { continue; }
          if (test.rect && test.rect.top === annotation.rect.top && test.rect.left === annotation.rect.left) {
            annotation.rect = annotation.rect.Shift(20, 20);
            recheck = true;
            break;
          }
        }
      }
    }

    if (add_to_sheet) {

      // ensure we haven't already added this
      if (!this.model.active_sheet.annotations.some((test) => test === annotation)) {
        this.model.active_sheet.annotations.push(annotation);
      }

      this.AddAnnotation(annotation);
    }
    return annotation;
  }

  /** add an annotation. it will be returned with a usable node. */
  public AddAnnotation(annotation: Annotation, toll_events = false, add_to_layout = true) {

    if (!annotation.node) {
      annotation.node = document.createElement('div');

      if (annotation.node && annotation.rect) {
        const node = annotation.node;
        const rect = annotation.rect;

        // support focus
        node.setAttribute('tabindex', '-1');

        node.addEventListener('mousedown', (event) => {

          const origin = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          };
          const bounding_rect = node.getBoundingClientRect();

          // FIXME: these 13s come from the stylesheet, we need to
          // either read these or make them dynamic somehow

          if (event.offsetY <= 13) { // move
            event.stopPropagation();
            event.preventDefault();
            node.focus();

            const offset = {
              x: bounding_rect.left + event.offsetX - rect.left,
              y: bounding_rect.top + event.offsetY - rect.top,
            };

            MouseDrag(this.layout.mask, 'move', (move_event) => {

              rect.top = move_event.offsetY - offset.y;
              rect.left = move_event.offsetX - offset.x;

              if (move_event.shiftKey) {

                // move in one direction at a time
                const dx = Math.abs(rect.left - origin.left);
                const dy = Math.abs(rect.top - origin.top);

                if (dx <= dy) { rect.left = origin.left; }
                else { rect.top = origin.top; }

              }

              if (move_event.ctrlKey) {
                const point = this.layout.ClampToGrid({
                  x: rect.left, y: rect.top,
                });
                rect.left = point.x;
                rect.top = point.y;
              }

              node.style.top = (rect.top) + 'px';
              node.style.left = (rect.left) + 'px';

            }, () => {
              annotation.extent = undefined; // reset
              this.grid_events.Publish({ type: 'annotation', annotation, event: 'move' });
            });

            return;
          }

          if ((bounding_rect.width - event.offsetX <= 13) &&
            (bounding_rect.height - event.offsetY <= 13)) {
            event.stopPropagation();
            event.preventDefault();
            node.focus();

            const bounds = node.getBoundingClientRect();
            const offset = {
              x: bounds.left + event.offsetX - rect.width,
              y: bounds.top + event.offsetY - rect.height,
            };

            MouseDrag(this.layout.mask, 'nw-resize', (move_event) => {

              rect.height = move_event.offsetY - offset.y;
              rect.width = move_event.offsetX - offset.x;

              if (move_event.shiftKey) {
                // move in one direction at a time
                const dx = Math.abs(rect.height - origin.height);
                const dy = Math.abs(rect.width - origin.width);

                if (dx > dy) { rect.width = origin.width; }
                else { rect.height = origin.height; }
              }

              if (move_event.ctrlKey) {
                const point = this.layout.ClampToGrid({
                  x: rect.right, y: rect.bottom,
                });
                rect.width = point.x - rect.left + 1;
                rect.height = point.y - rect.top + 1;
              }

              node.style.height = (rect.height) + 'px';
              node.style.width = (rect.width) + 'px';

            }, () => {
              annotation.extent = undefined; // reset
              this.grid_events.Publish({ type: 'annotation', annotation, event: 'resize' });
            });

            return;
          }

        });

        annotation.node.addEventListener('focusin', () => {
          this.selected_annotation = annotation;
          this.primary_selection.empty = true; // FIXME: not using method? (...)

          // this is done for the side-effect when we start editing, we
          // capture the sheet of the primary selection. if you switch
          // sheets while editing, the selection won't be set so it persists.
          // we need that to switch back to the correct sheet when an edit ends.

          this.primary_selection.target = { row: -1, column: -1, sheet_id: this.model.active_sheet.id };
          this.HideGridSelection();
        });

        annotation.node.addEventListener('focusout', (event) => {
          if (this.formula_bar && this.formula_bar.IsElement((event as FocusEvent).relatedTarget as HTMLElement)) {
            // console.info('editing...');
            this.primary_selection.empty = true;
            this.RenderSelections();
            this.editing_annotation = annotation;
            this.layout.ShowSelections(true);
          }
          else {
            if (this.selected_annotation === annotation) {
              this.selected_annotation = undefined;
            }
            this.ShowGridSelection();
          }
        });

        annotation.node.addEventListener('keydown', (event) => {
          const target = { x: rect.left, y: rect.top };
          switch (event.key) {
            case 'ArrowUp':
            case 'Up':
              if (event.ctrlKey) {
                if (this.layout.AnnotationLayoutOrder(annotation, 1)) {
                  this.grid_events.Publish({ type: 'annotation', event: 'move', annotation });
                }
                node.focus();
              }
              else {
                target.y--;
              }
              break;

            case 'ArrowLeft':
            case 'Left':
              if (event.ctrlKey) {
                return;
              }
              else {
                target.x--;
              }
              break;

            case 'ArrowRight':
            case 'Right':
              if (event.ctrlKey) {
                return;
              }
              else {
                target.x++;
              }
              break;

            case 'ArrowDown':
            case 'Down':
              if (event.ctrlKey) {
                if (this.layout.AnnotationLayoutOrder(annotation, -1)) {
                  this.grid_events.Publish({ type: 'annotation', event: 'move', annotation });
                }
                node.focus();
              }
              else {
                target.y++;
              }
              break;

            case 'Escape':
            case 'Esc':
              this.Focus();
              break;

            case 'Delete':
            case 'Del':
              this.Focus();
              this.RemoveAnnotation(annotation);
              break;

            default:
              return;
          }

          event.stopPropagation();
          event.preventDefault();

          target.x = Math.max(target.x, 0);
          target.y = Math.max(target.y, 0);

          if (rect.left !== target.x || rect.top !== target.y) {
            rect.left = target.x;
            rect.top = target.y;
            node.style.top = (rect.top) + 'px';
            node.style.left = (rect.left) + 'px';
            annotation.extent = undefined; // reset
            this.grid_events.Publish({ type: 'annotation', event: 'move', annotation });
          }

        });
      }
    }

    annotation.node.classList.add('annotation');

    if (add_to_layout) {
      this.layout.AddAnnotation(annotation);
    }
    else {
      // console.info('not adding annotation node to layout...');
    }

    /*
    // ensure we haven't already added this
    if (!this.model.active_sheet.annotations.some((test) => test === annotation)){
      this.model.active_sheet.annotations.push(annotation);
    }
    */

    if (!toll_events) {
      this.grid_events.Publish({
        type: 'annotation',
        annotation,
        event: 'create',
      });
    }

  }

  /**
   * removes an annotation from the list, and removes the node its
   * the parent (although the node still exists in the annotation, if
   * it existed before).
   */
  public RemoveAnnotation(annotation: Annotation) {
    for (let i = 0; i < this.model.active_sheet.annotations.length; i++) {
      if (annotation === this.model.active_sheet.annotations[i]) {
        this.model.active_sheet.annotations.splice(i, 1);
        if (annotation.node && annotation.node.parentElement) {
          annotation.node.parentElement.removeChild(annotation.node);
        }
        this.grid_events.Publish({
          type: 'annotation',
          annotation,
          event: 'delete',
        });
        return;
      }
    }
  }

  /**
   * this method removes annotation nodes from the grid/layout, but doesn't
   * affect the underlying data. this should be used to remove annotations
   * when switching sheets.
   *
   * you can also use it when cleaning up, if the underlying data will also
   * be wiped from the model.
   */
  public RemoveAnnotationNodes() {
    this.layout.RemoveAnnotationNodes();
  }

  /**
   * serialize data. this function used to (optionally) stringify
   * by typescript has a problem figuring this out, so we will simplify
   * the function.
   */
  public Serialize(options: SerializeOptions = {}) {

    // selection moved to sheet, but it's not "live"; so we need to
    // capture the primary selection in the current active sheet before
    // we serialize it

    this.model.active_sheet.selection = JSON.parse(JSON.stringify(this.primary_selection));

    // same for scroll offset

    this.model.active_sheet.scroll_offset = this.layout.scroll_offset;

    // NOTE: annotations moved to sheets, they will be serialized in the sheets

    const sheet_data = this.model.sheets.map((sheet) => sheet.toJSON(options));

    // NOTE: moving into a structured object (the sheet data is also structured,
    // of course) but we are moving things out of sheet (just  named ranges atm))

    let macro_functions: MacroFunction[] | undefined;

    const macro_function_keys = Object.keys(this.model.macro_functions);
    if (macro_function_keys.length) {
      macro_functions = [];
      for (const key of macro_function_keys) {
        macro_functions.push({
          ...this.model.macro_functions[key],
          expression: undefined,
        });
      }
    }

    return {
      sheet_data,
      active_sheet: this.model.active_sheet.id,
      named_ranges: this.model.named_ranges.Count() ?
        this.model.named_ranges.Serialize() :
        undefined,
      macro_functions,
    };

  }

  /** pass through */
  public RealArea(area: Area) {
    return this.model.active_sheet.RealArea(area);
  }

  /** pass through */
  public CellRenderData(address: ICellAddress) {
    return this.model.active_sheet.CellData(address);
  }

  /**
   * clear sheet, reset all data
   */
  public Clear() {
    this.ExecCommand({ key: CommandKey.Clear });
  }

  /**
   * reset sheet, set data from CSV
   *
   * FIXME: this is problematic, because it runs around the exec command
   * system. however it doesn't seem like a good candidate for a separate
   * command. it should maybe move to the import class? (...)
   *
   * one problem with that is that import is really, really heavy (jszip).
   * it seems wasteful to require all that just to import csv.
   */
  public FromCSV(text: string) {

    const records = ParseCSV(text);
    const arr = records.map((record) =>
      record.map((field) => ValueParser.TryParse(field).value));

    const end = {
      row: Math.max(0, arr.length - 1),
      column: arr.reduce((max, row) => Math.max(max, Math.max(0, row.length - 1)), 0),
    };

    // console.info(arr, end);

    this.ExecCommand([
      { key: CommandKey.Clear },
      {
        key: CommandKey.SetRange,
        area: { start: { row: 0, column: 0 }, end },
        value: arr,
      },

      // we took this out because the data may require a layout update
      // (rebuilding tiles); in that case, this will be duplicative. maybe
      // should use setTimeout or some sort of queue...

      // { key: CommandKey.ResizeColumns }, // auto
    ]);

  }

  /**
   * show or hide headers
   */
  public ShowHeaders(show = true) {
    this.ExecCommand({
      key: CommandKey.ShowHeaders,
      show,
    });
  }

  public FromData2(
      sheet_data: any[],
      render = false,
    ) {

    this.RemoveAnnotationNodes();

    const base_sheets = sheet_data.map(() => {
      return Sheet.Blank(this.theme_style_properties).toJSON();
    });

    this.UpdateSheets(base_sheets, true);

    // FIXME: are there named ranges in the data? (...)

    this.model.named_ranges.Reset();
    this.model.macro_functions = {};

    this.ClearSelection(this.primary_selection);

    for (let si = 0; si < sheet_data.length; si++) {

      // this.cells.FromJSON(cell_data);
      this.model.sheets[si].cells.FromJSON(sheet_data[si].cells);
      if (sheet_data[si].name) {
        this.model.sheets[si].name = sheet_data[si].name;
      }

      // 0 is implicitly just a general style

      const cs = (this.model.sheets[si] as any).cell_style;
      for (const info of sheet_data[si].cells) {
        if (info.style_ref) {
          if (!cs[info.column]) cs[info.column] = [];
          cs[info.column][info.row] = sheet_data[si].styles[info.style_ref];
        }
      }

      for (let i = 0; i < sheet_data[si].column_widths.length; i++) {
        if (typeof sheet_data[si].column_widths[i] !== 'undefined') {
          this.model.sheets[si].SetColumnWidth(i, sheet_data[si].column_widths[i]);
        }
      }

      for (let i = 0; i < sheet_data[si].row_heights.length; i++) {
        if (typeof sheet_data[si].row_heights[i] !== 'undefined') {
          this.model.sheets[si].SetRowHeight(i, sheet_data[si].row_heights[i]);
        }
      }

    }

    // no longer sending explicit layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    if (render) {
      this.Repaint(false, false); // true, true);
    }

    if (this.tab_bar) {
      this.tab_bar.Update();
    }

  }

  /**
   * why does this not take the composite object? (...)
   * A: it's used for xlsx import. still, we could wrap it.
   */
  public FromData(
      cell_data: any[],
      column_widths: number[],
      row_heights: number[],
      styles: Style.Properties[],
      render = false) {

    this.RemoveAnnotationNodes();

    this.UpdateSheets([Sheet.Blank(this.theme_style_properties).toJSON()], true);

    // FIXME: are there named ranges in the data? (...)

    this.model.named_ranges.Reset();
    this.model.macro_functions = {};

    this.ClearSelection(this.primary_selection);

    this.cells.FromJSON(cell_data);

    // 0 is implicitly just a general style

    const cs = (this.model.active_sheet as any).cell_style;
    for (const info of cell_data) {
      if (info.style_ref) {
        if (!cs[info.column]) cs[info.column] = [];
        cs[info.column][info.row] = styles[info.style_ref];
      }
    }

    for (let i = 0; i < column_widths.length; i++) {
      if (typeof column_widths[i] !== 'undefined') {
        this.model.active_sheet.SetColumnWidth(i, column_widths[i]);
      }
    }

    for (let i = 0; i < row_heights.length; i++) {
      if (typeof row_heights[i] !== 'undefined') {
        this.model.active_sheet.SetRowHeight(i, row_heights[i]);
      }
    }

    // no longer sending explicit layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    if (render) {
      this.Repaint(false, false); // true, true);
    }

  }

  public ResetMetadata() {
    this.model.document_name = undefined;
    this.model.user_data = undefined;
  }

  public NextSheet(step = 1) {
    if (this.model.sheets.length === 1) return;
    for (let i = 0; i < this.model.sheets.length; i++) {
      if (this.model.sheets[i] === this.model.active_sheet) {
        let index = (i + step) % this.model.sheets.length;
        while (index < 0) { index += this.model.sheets.length; }
        this.ActivateSheet(index);
        return;
      }
    }
  }

  /** insert sheet at the given index (or current index) */
  public InsertSheet(index?: number) {

    if (typeof index === 'undefined') {
      if (!this.model.sheets.some((sheet, i) => {
        if (sheet === this.model.active_sheet) {
          index = i;
          return true;
        }
        return false;
      })) {
        throw new Error('invalid index');
      }
    }

    this.ExecCommand({
      key: CommandKey.AddSheet,
      insert_index: index,
    });

  }

  /**
   * delete sheet, by index or (omitting index) the current active sheet
   */
  public DeleteSheet(index?: number) {

    if (typeof index === 'undefined') {
      if (!this.model.sheets.some((sheet, i) => {
        if (sheet === this.model.active_sheet) {
          index = i;
          return true;
        }
        return false;
      })) {
        throw new Error('invalid index');
      }
    }

    this.ExecCommand({
      key: CommandKey.DeleteSheet,
      index,
    });

  }

  public AddSheet() {
    this.ExecCommand({
      key: CommandKey.AddSheet,
    });
  }

  /**
   * activate sheet, by name or index number
   * @param sheet number (index into the array) or string (name)
   */
  public ActivateSheet(sheet: number | string) {

    const index = (typeof sheet === 'number') ? sheet : undefined;
    const name = (typeof sheet === 'string') ? sheet : undefined;

    this.ExecCommand({
      key: CommandKey.ActivateSheet,
      index,
      name,
    });

  }

  /**
   * activate sheet, by ID
   */
  public ActivateSheetID(id: number) {
    this.ExecCommand({
      key: CommandKey.ActivateSheet,
      id,
    });
  }

  public ShowAll() {

    // obviously there are better ways to do this, but this
    // will use the execcommand system and _should_ only fire
    // a single event (FIXME: check)

    const commands: ShowSheetCommand[] = [];
    for (let index = 0; index < this.model.sheets.length; index++) {
      commands.push({
        key: CommandKey.ShowSheet,
        index,
        show: true,
      });
    }
    this.ExecCommand(commands);
  }

  public ShowSheet(index = 0, show = true) {
    this.ExecCommand({
      key: CommandKey.ShowSheet,
      index,
      show,
    });
  }

  /** new version for multiple sheets */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public UpdateSheets(data: any[], render = false, activate_sheet?: number | string) {

    // remove existing annotations from layout

    this.RemoveAnnotationNodes();

    Sheet.Reset(); // reset ID generation

    const sheets = data.map((sheet) => Sheet.FromJSON(sheet, this.theme_style_properties));

    // ensure we have a sheets[0] so we can set active

    if (sheets.length === 0) {
      sheets.push(Sheet.Blank(this.theme_style_properties));
    }

    // now assign sheets

    this.model.sheets = sheets;
    this.model.active_sheet = sheets[0];

    // possibly set an active sheet on load (shortcut)

    if (activate_sheet) {

      if (typeof activate_sheet === 'number') {
        for (const sheet of this.model.sheets) {
          if (activate_sheet === sheet.id) {
            this.model.active_sheet = sheet;
            break;
          }
        }
      }
      else if (typeof activate_sheet === 'string') {
        for (const sheet of this.model.sheets) {
          if (activate_sheet === sheet.name) {
            this.model.active_sheet = sheet;
            break;
          }
        }
      }
    }

    // selection

    this.ClearSelection(this.primary_selection);

    // FIXME: copying from updatesheet AND activatesheet... still need to unify

    // support old style files

    if (data[0] && (data[0] as any).primary_selection) {
      const selection = ((data[0] as any).primary_selection) as GridSelection;
      if (!selection.empty) {
        this.Select(this.primary_selection,
          new Area(selection.area.start, selection.area.end), selection.target);
      }
    }

    // the new version, as fallback

    else if (!this.model.active_sheet.selection.empty) {
      const template = this.model.active_sheet.selection;
      this.Select(this.primary_selection,
        new Area(template.area.start, template.area.end), template.target);
    }

    this.ResetMetadata(); // FIXME: ?

    // for this version, we want to add all annotations at once; we only
    // add annotations on the active sheet to the layout, but the rest are
    // also created. the intent here is to ensure that any dependent cells
    // (like MC results) are marked even before we open a particular sheet.

    /*
    const annotations = this.model.active_sheet.annotations;
    for (const element of annotations) {
      this.AddAnnotation(element, true);
    }
    */

    for (const sheet of this.model.sheets) {
      for (const annotation of sheet.annotations) {
        this.AddAnnotation(annotation, true, (sheet === this.model.active_sheet));
      }
    }

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    if (render) {
      this.Repaint(false, false);
    }

    if (this.tab_bar) {
      this.tab_bar.Update();
    }

  }

  /** DEPRECATED */
  public UpdateSheet__(data: any, render = false) {

    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    Sheet.FromJSON(data, this.theme_style_properties, this.model.active_sheet);
    this.ClearSelection(this.primary_selection);

    // this is the old version -- we still want to support it, but
    // only for reading. it should have precedence? (...)

    if ((data as any).primary_selection) {
      const selection = ((data as any).primary_selection) as GridSelection;
      if (!selection.empty) {
        this.Select(this.primary_selection,
          new Area(selection.area.start, selection.area.end), selection.target);
      }
    }

    // the new version, as fallback

    else if (!this.model.active_sheet.selection.empty) {
      const template = this.model.active_sheet.selection;
      this.Select(this.primary_selection,
        new Area(template.area.start, template.area.end), template.target);
    }


    this.ResetMetadata();

    // scrub, then add any sheet annotations. note the caller will
    // still have to inflate these or do whatever step is necessary to
    // render.

    this.RemoveAnnotationNodes();

    const annotations = (data as any).annotations;
    if (annotations && Array.isArray(annotations)) {
      for (const element of annotations) {
        this.AddAnnotation(new Annotation(element), true);
      }
    }

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    if (render) {
      this.Repaint(false, false);
    }
  }

  /**
   * rebuild layout on a resize. we are not trapping resize events, clients
   * should do that (also this works for embedded elements that are not
   * directly affected by document resize).
   */
  public UpdateLayout() {
    this.layout.UpdateTiles();
    this.render_tiles = this.layout.VisibleTiles();
    this.Repaint(true);
  }

  /**
   * splitting the old UpdateTheme, since that is becoming more
   * important for post-constructor theme updates, and the name applies
   * more to that function than to what we do at startup.
   */
  public ApplyTheme() {
    this.UpdateTheme(true);
  }

  /**
   * @param initial first call, from the grid Initialize() method
   */
  public UpdateTheme(initial = false) {

    if (!initial) {
      for (const key of Object.keys(this.theme)) {
        delete (this.theme as any)[key]; // = undefined;
      }
    }

    const theme_properties = LoadThemeProperties(this.grid_container);

    // NOTE: this prevents it from rebuilding based on changes to the
    // stylesheet; putting this.theme second overrides any new values.

    // depending on whether we want to keep using object theme, we might
    // remove that. for the time being we'll use a flag...

    const composite = CalculateSupplementalColors({
      ...theme_properties,
      ...this.theme,
    });

    for (const key of Object.keys(composite)) {
      (this.theme as any)[key] = (composite as any)[key];
    }

    // update style for theme
    this.StyleDefaultFromTheme();

    this.model.active_sheet.UpdateDefaultRowHeight(true);
    this.model.active_sheet.FlushCellStyles();

    this.layout.ApplyTheme(this.theme);

    if (!initial) {

      this.UpdateLayout(); // in case we have changed font size
      this.selection_renderer.Flush();

      if (this.cell_editor) this.cell_editor.UpdateTheme();
      if (this.formula_bar) this.formula_bar.UpdateTheme();

      this.Repaint(true, true, true);
    }

  }

  /**
   *
   * @param container html container element
   * @param sheet_data optional sheet (serialized, as json or object)
   *
   * no one is using the sheet_data parameter atm, so we are removing
   * it; it might come back, but if it does use a load method (don't inline)
   *
   */
  public Initialize(grid_container: HTMLElement, toll_initial_render = false) {

    this.grid_container = grid_container;

    this.ApplyTheme();

    const container = document.createElement('div');

    const higher_level_container = document.createElement('div');
    higher_level_container.classList.add('treb-layout-master');
    higher_level_container.appendChild(container);
    grid_container.appendChild(higher_level_container);

    // grid_container.appendChild(container);
    grid_container.classList.add('treb-main');

    let autocomplete: Autocomplete | undefined;

    if (this.options.formula_bar) {
      if (!autocomplete) {
        autocomplete = new Autocomplete({ theme: this.theme, container });
      }
      this.InitFormulaBar(grid_container, autocomplete);
    }

    if (this.options.tab_bar) {
      this.tab_bar = new TabBar(this.layout, this.model, this.options, this.theme, grid_container);
      this.tab_bar.Subscribe((event) => {
        switch (event.type) {
          case 'cancel':
            break;

          case 'reorder-sheet':
            this.ReorderSheet(event.index, event.move_before);
            break;

          case 'add-sheet':
            this.AddSheet();
            break;

          case 'rename-sheet':
            this.RenameSheet(event.sheet, event.name);
            break;

          case 'activate-sheet':
            this.ActivateSheetID(event.sheet.id);
            break;
        }
        this.Focus();
      });
    }

    // set container and add class for our styles

    this.container = container;
    this.container.classList.add('treb-grid');

    // we can force scrollbars, but it breaks sticky (apparently)
    //
    // ...doesn't break sticky, at least AFAICT; also necessary for
    // horizontal scrolling.

    if (UA.is_mac && UA.is_safari) {
      this.container.classList.add('safari');
    }

    // accept focus, keyboard input

    this.container.setAttribute('tabindex', '-1');

    /* see method comment

    // if there's a sheet passed in, use that (serialized)

    if (sheet_data) {
      try {
        Sheet.FromJSON(sheet_data, this.model.sheet);
      }
      catch (err) {
        console.error('creating document failed');
        console.error(err);
      }
    }

    */

    // create dom structure

    this.layout.Initialize(container, () => this.OnScroll(), this.options.scrollbars);
    this.selection_renderer.Initialize();
    this.layout.UpdateTiles();

    // event handlers and components

    Sheet.sheet_events.Subscribe(this.HandleSheetEvent.bind(this));

    this.AttachListeners();

    if (this.options.in_cell_editor) {
      if (!autocomplete) {
        autocomplete = new Autocomplete({ theme: this.theme, container });
      }
      this.InitCellEditor(autocomplete);
    }

    // set local state and update

    this.render_tiles = this.layout.VisibleTiles();

    // don't delay this, it looks terrible

    if (!toll_initial_render) {
      this.Repaint(true);
    }
    
  }

  /**
   * merges selected cells
   */
  public MergeSelection() {

    if (this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.ExecCommand({
      key: CommandKey.MergeCells,
      area: this.primary_selection.area,
    });
  }

  /**
   * unmerges selected cells
   */
  public UnmergeSelection() {

    if (this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.ExecCommand({
      key: CommandKey.UnmergeCells,
      area: this.primary_selection.area,
    });

  }

  /**
   * focus on the container. you must call this method to get copying
   * to work properly (because it creates a selection)
   */
  public Focus() {
    if (this.container) {
      this.container.focus();
    }
  }

  /**
   * set or clear name
   */
  public SetName(name: string, range?: ICellAddress | Area) {

    const command: SetNameCommand = {
      key: CommandKey.SetName,
      name,
    };

    if (range) {

      if (IsCellAddress(range)) {
        range = new Area(range);
      }

      // make sure that this has a sheet ID, use active if not otherwise
      // set. FIXME: move to area? (...)

      if (!range.start.sheet_id) {
        range = new Area(
          { ...range.start, sheet_id: this.model.active_sheet.id }, range.end);
      }

      command.area = new Area(range.start, range.end);

    }

    this.ExecCommand(command);
  }

  public GetNumberFormat(address: ICellAddress) {
    const style = this.model.active_sheet.CellStyleData(address);
    if (style && style.number_format) {
      return NumberFormatCache.Get(style.number_format).toString();
    }
  }

  public SelectAll() {
    this.Select(this.primary_selection, new Area({ row: Infinity, column: Infinity }), undefined, true);
    this.RenderSelections();
  }

  /**
   * get data in a given range, optionally formulas
   * API method
   */
  public GetRange(range: ICellAddress | Area, formula = false, formatted = false) {

    let sheet_id = 0;

    if (IsCellAddress(range)) {

      sheet_id = range.sheet_id || this.model.active_sheet.id;
      for (const sheet of this.model.sheets) {
        if (sheet.id === sheet_id) { 
          if (formula) { return sheet.cells.RawValue(range); } 
          if (formatted) { return sheet.GetFormattedRange(range); }
          return sheet.cells.GetRange(range);
        }
      }
      return undefined;

    }

    sheet_id = range.start.sheet_id || this.model.active_sheet.id;
    for (const sheet of this.model.sheets) {
      if (sheet.id === sheet_id) { 
        if (formula) { return sheet.cells.RawValue(range.start, range.end); } 
        if (formatted) { return sheet.GetFormattedRange(range.start, range.end); }
        return sheet.cells.GetRange(range.start, range.end);
      }
    }

    return undefined;

  }

  /**
   * set data in given range
   * API method
   *
   * @param range target range. if range is smaller than data, range controls.
   * if range is larger, behavior depends on the recycle parameter.
   * @param data single value, array (column), or 2d array
   * @param recycle recycle values. we only recycle single values or single
   * rows/columns -- we will not recycle a matrix.
   * @param transpose transpose before inserting (data is column-major)
   */
  public SetRange(range: Area, data: any, recycle = false, transpose = false) {

    // single value, easiest
    if (!Array.isArray(data) && !ArrayBuffer.isView(data)) {
      if (recycle) {
        // this.model.sheet.SetAreaValue(range, data);
        this.ExecCommand({ key: CommandKey.SetRange, area: range, value: data });
      }
      else {
        // this.model.sheet.SetCellValue(range.start, data);
        this.ExecCommand({ key: CommandKey.SetRange, area: range.start, value: data });
      }

      if (!this.primary_selection.empty && range.Contains(this.primary_selection.target)) {
        this.UpdateFormulaBarFormula();
      }

      return;
    }

    // flat array -- we can recycle. recycling is R style (values, not rows)
    if (!Array.isArray((data as any)[0]) && !ArrayBuffer.isView((data as any)[0])) {

      if (recycle) {

        const rows = range.entire_column ? this.model.active_sheet.rows : range.rows;
        const columns = range.entire_row ? this.model.active_sheet.columns : range.columns;
        const count = rows * columns;

        if (count > (data as any).length) {
          let tmp = (data as any).slice(0);
          const multiple = Math.ceil(count / tmp.length);
          for (let i = 1; i < multiple; i++) {
            tmp = tmp.concat((data as any).slice(0));
          }
          data = tmp;
        }

        // reshape
        const reshaped: any[][] = [];
        for (let c = 0, index = 0; c < columns; c++ , index += rows) {
          reshaped[c] = data.slice(index, index + rows);
        }
        data = reshaped;

      }
      else {
        data = [data];
      }

    }

    // transpose. might not be square
    if (transpose) {
      const tmp: any[][] = [];
      const inner_length = (data as any)[0].length;
      for (let i = 0; i < inner_length; i++) {
        tmp[i] = [];
        for (let j = 0; j < data.length; j++) {
          if (typeof data[j][i] !== 'undefined') {
            tmp[i][j] = data[j][i];
          }
        }
      }
      data = tmp;
    }

    // this.model.sheet.SetAreaValues(range, data as any[][]);
    this.ExecCommand({ key: CommandKey.SetRange, area: range, value: data });

    if (!this.primary_selection.empty && range.Contains(this.primary_selection.target)) {
      this.UpdateFormulaBarFormula();
    }

  }

  /**
   * API method
   */
  public SetRowHeight(row?: number | number[], height?: number) {
    this.ExecCommand({
      key: CommandKey.ResizeRows,
      row,
      height,
    });
  }

  /**
   * API method
   *
   * @param column column, columns, or undefined means all columns
   * @param width target width, or undefined means auto-size
   */
  public SetColumnWidth(column?: number | number[], width = 0) {
    this.ExecCommand({
      key: CommandKey.ResizeColumns,
      column,
      width,
    });
  }

  /**
   * applies the given style properties to the passed array, or to the
   * current primary selection
   *
   * API method
   */
  public ApplyStyle(area?: Area, properties: Style.Properties = {}, delta = true) {

    if (!area) {
      if (this.primary_selection.empty) {
        return;
      }
      else area = this.primary_selection.area;
    }

    this.ExecCommand({
      key: CommandKey.UpdateStyle,
      area,
      style: properties,
      delta,
    });

  }

  /**
   * returns the primary selection. we use a reference to the real selection
   * sp callers can track; however, you can break things if you modify it.
   * so don't modify it. FIXME: proxy view? (...)
   *
   * API method
   */
  public GetSelection() {
    return this.primary_selection;
  }

  /** repaint after an external event (calculation) */
  public Update(force = false, area?: Area) {
    this.DelayedRender(force, area);
  }

  /**
   * API method
   *
   * @param area
   * @param borders
   * @param color
   * @param width
   */
  public ApplyBorders(area?: Area, borders: BorderConstants = BorderConstants.None, color?: string, width = 1) {

    if (!area) {
      if (this.primary_selection.empty) { return; }
      area = this.primary_selection.area;
    }

    if (borders === BorderConstants.None) {
      width = 0;
    }

    this.ExecCommand({
      key: CommandKey.UpdateBorders,
      color,
      area,
      borders,
      width,
    });

  }

  /** return freeze area */
  public GetFreeze() {
    return { ...this.model.active_sheet.freeze };
  }

  /**
   * freeze rows or columns. set to 0 (or call with no arguments) to un-freeze.
   *
   * highglight is shown by default, but we can hide it(mostly for document load)
   */
  public Freeze(rows = 0, columns = 0, highlight_transition = true) {
    this.ExecCommand({
      key: CommandKey.Freeze,
      rows,
      columns,
      highlight_transition,
    });
  }

  /**
   * delete columns in current selection
   */
  public DeleteColumns() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    if (area.entire_row) {
      this.Clear();
    }
    else {
      const before_column = area.start.column;
      const count = -area.columns; // negative means remove
      // this.InsertColumnsInternal(before_column, -count);
      this.ExecCommand({
        key: CommandKey.InsertColumns,
        before_column,
        count,
      });
    }
  }

  /**
   * delete rows in current selection
   */
  public DeleteRows() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    if (area.entire_column) {
      this.Clear();
    }
    else {
      const before_row = area.start.row;
      const count = -area.rows; // negative means remove
      this.ExecCommand({
        key: CommandKey.InsertRows,
        before_row,
        count,
      });
    }
  }

  /**
   * insert column at cursor
   */
  public InsertColumn() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    const before_column = area.entire_row ? 0 : area.start.column;
    this.InsertColumns(before_column, 1);
  }

  /**
   * insert column(s) at some specific point
   */
  public InsertColumns(before_column = 0, count = 1) {
    this.ExecCommand({
      key: CommandKey.InsertColumns,
      before_column,
      count,
    });
  }

  /** move sheet (X) before sheet (Y) */
  public ReorderSheet(index: number, move_before: number) {
    this.ExecCommand({
      key: CommandKey.ReorderSheet,
      index,
      move_before,
    });
  }

  /**
   * rename active sheet
   */
  public RenameSheet(sheet = this.model.active_sheet, name: string) {
    this.ExecCommand({
      key: CommandKey.RenameSheet,
      new_name: name,
      id: sheet.id,
    });
  }

  /**
   * insert row at cursor
   */
  public InsertRow() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    const before_row = area.entire_column ? 0 : area.start.row;
    this.InsertRows(before_row, 1);
  }

  /**
   * insert rows(s) at some specific point
   */
  public InsertRows(before_row = 0, count = 1) {
    this.ExecCommand({
      key: CommandKey.InsertRows,
      before_row,
      count,
    });
  }

  /**
   * set functions for AC matcher. should be called by calculator on init,
   * or when any functions are added/removed.
   *
   * FIXME: we should use this to normalize function names, on insert and
   * on paste (if we're doing that).
   */
  public SetAutocompleteFunctions(functions: FunctionDescriptor[]) {
    this.autocomplete_matcher.SetFunctions(functions);
  }

  /**
   * scrolls so that the given cell is in the top-left (assuming that is
   * possible)
   */
  public ScrollTo(address: ICellAddress) {
    this.layout.ScrollTo(address);
  }

  /**
   * scrolls the given address into view (assuming it's not in view now)
   *
   * FIXME: we need a way to do this without scrolling the containing
   * page, in the event we do a scroll-on-load. small problem.
   */
  public ScrollIntoView(address: ICellAddress) {
    if (this.options.scrollbars) {
      this.layout.ScrollIntoView(address);
    }
  }

  // --- private methods -------------------------------------------------------

  private DeleteSheetInternal(command: DeleteSheetCommand) {

    let is_active = false;
    let index = -1;

    // remove from array. check if this is the active sheet

    const named_sheet = command.name ? command.name.toLowerCase() : '';
    const sheets = this.model.sheets.filter((sheet, i) => {
      if (i === command.index || sheet.id === command.id || sheet.name.toLowerCase() === named_sheet) {
        is_active = (sheet === this.model.active_sheet);
        index = i;
        return false;
      }
      return true;
    });

    // empty? create new, activate

    if (!sheets.length) {
      sheets.push(Sheet.Blank(this.theme_style_properties));
    }

    this.model.sheets = sheets;

    // need to activate a new sheet? use the next one (now in the slot
    // we just removed). this will roll over properly if we're at the end.

    if (is_active) {
      this.ActivateSheetInternal({ key: CommandKey.ActivateSheet, index });
    }

    // FIXME: this is not necessary if we just called activate, right? (...)

    if (this.tab_bar) { this.tab_bar.Update(); }

  }

  private AddSheetInternal(name = Sheet.default_sheet_name, insert_index = -1) {

    if (!this.options.add_tab) {
      console.warn('add tab option not set or false');
      return;
    }

    // validate name...

    while (this.model.sheets.some((test) => test.name === name)) {

      const match = name.match(/^(.*?)(\d+)$/);
      if (match) {
        name = match[1] + (Number(match[2]) + 1);
      }
      else {
        name = name + '2';
      }

    }

    // FIXME: structure event

    const sheet = Sheet.Blank(this.theme_style_properties, name);

    if (insert_index >= 0) {
      this.model.sheets.splice(insert_index, 0, sheet);
    }
    else {
      this.model.sheets.push(sheet);
    }

    // if (activate) {
    //   this.ActivateSheetInternal({ key: CommandKey.ActivateSheet, id: sheet.id });
    // }

    if (this.tab_bar) { this.tab_bar.Update(); }

    return sheet.id;

  }

  /**
   *
   */
  private ActivateSheetInternal(command: ActivateSheetCommand) {

    const selecting_argument = this.SelectingArgument();

    // console.info('activate sheet', command);

    const candidate = this.ResolveSheet(command) || this.model.sheets[0];

    // ok, activate...

    if (this.model.active_sheet === candidate) {
      return;
    }

    if (!candidate.visible) {
      throw new Error('cannot activate hidden sheet');
    }

    // cache primary selection in the sheet we are deactivating
    // FIXME: cache scroll position, too!

    this.model.active_sheet.selection = JSON.parse(JSON.stringify(this.primary_selection));
    this.model.active_sheet.scroll_offset = this.layout.scroll_offset;

    // hold this for the event (later)

    const deactivate = this.model.active_sheet;

    this.RemoveAnnotationNodes();

    // select target

    this.model.active_sheet = candidate;

    // ---

    // don't update selection if selecting argument... actually we _do_
    // want to clear the primary selection, we just don't want the side
    // effects of clearing the formula bar and so on

    if (!selecting_argument) {
      this.ClearSelection(this.primary_selection);

      if (candidate.selection && !candidate.selection.empty) {
        this.Select(this.primary_selection,
          new Area(candidate.selection.area.start, candidate.selection.area.end),
          candidate.selection.target);
      }

    }
    else {
      this.RenderSelections();
    }

    // scrub, then add any sheet annotations. note the caller will
    // still have to inflate these or do whatever step is necessary to
    // render.

    const annotations = this.model.active_sheet.annotations;
    for (const element of annotations) {
      this.AddAnnotation(element, true);
    }

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    this.QueueLayoutUpdate();

    // this.StyleDefaultFromTheme(); // ?

    // if (render)
    {
      this.Repaint(false, false);
    }

    // FIXME: structure event

    this.grid_events.Publish({
      type: 'sheet-change',
      deactivate,
      activate: this.model.active_sheet,
    });

    if (this.tab_bar) { this.tab_bar.Update(); }

    this.layout.scroll_offset = this.model.active_sheet.scroll_offset;

  }

  private ResolveSheet(command: SheetSelection) {
    if (typeof command.index !== 'undefined') {
      return this.model.sheets[command.index];
    }
    if (typeof command.name !== 'undefined') {
      const compare = command.name.toLowerCase();
      for (const sheet of this.model.sheets) {
        if (sheet.name.toLowerCase() === compare) { return sheet; }
      }
    }
    if (command.id) {
      for (const sheet of this.model.sheets) {
        if (sheet.id === command.id) { return sheet; }
      }
    }
    return undefined;
  }

  private ShowSheetInternal(command: ShowSheetCommand) {

    const sheet = this.ResolveSheet(command);

    // invalid
    if (!sheet) { return; }

    // not changed
    if (sheet.visible === command.show) { return; }

    // make sure at least one will be visible after the operation
    if (!command.show) {

      let count = 0;
      for (const test of this.model.sheets) {
        if (!sheet.visible || test === sheet) { count++; }
      }
      if (count >= this.model.sheets.length) {
        throw new Error('can\'t hide all sheets');
      }

    }

    // ok, set
    sheet.visible = command.show;

    // is this current?
    if (sheet === this.model.active_sheet) {
      for (let i = 0; i < this.model.sheets.length; i++) {
        if (this.model.sheets[i] === this.model.active_sheet) {
          this.ActivateSheetInternal({
            key: CommandKey.ActivateSheet,
            index: i + 1,
          });
          return;
        }
      }
    }

    // otherwise, just update tabs
    if (this.tab_bar) { this.tab_bar.Update(); }

  }

  private StyleDefaultFromTheme() {

    this.theme_style_properties.font_face = this.theme.cell_font;
    this.theme_style_properties.font_size_unit = this.theme.cell_font_size_unit;
    this.theme_style_properties.font_size_value = this.theme.cell_font_size_value;
    this.theme_style_properties.text_color = this.theme.cell_color || 'none';

    this.theme_style_properties.border_top_color =
      this.theme_style_properties.border_left_color =
      this.theme_style_properties.border_right_color =
      this.theme_style_properties.border_bottom_color = this.theme.border_color || 'none';

  }

  /* *
   *
   * /
  private PointToAnnotation(point: Point) {

    / *
    if (this.active_annotation &&
        this.active_annotation.rect &&
        this.active_annotation.rect.Contains(point.x, point.y)) {
      return;
    }

    this.active_annotation = undefined;
    * /

    // console.info(point);
    for (const annotation of this.model.annotations) {
      if (annotation.rect && annotation.rect.Contains(point.x, point.y)) {

        // FIXME: z-ordering (or make that implicit in the stack? ...)

        // this.active_annotation = annotation;
        return annotation;
      }
    }

  }
  */


  /**
   * why is this not in layout? (...)
   * how is this layout? it's an effect. make an effects class.
   */
  private HighlightFreezeArea() {

    if (this.theme.frozen_highlight_overlay) {

      for (const node of [
        this.layout.corner_selection,
        this.layout.row_header_selection,
        this.layout.column_header_selection]) {

        node.style.transition = 'background .33s, border-bottom-color .33s, border-right-color .33s';
        node.style.background = this.theme.frozen_highlight_overlay;

        if (this.theme.frozen_highlight_border) {
          node.style.borderBottomColor = this.theme.frozen_highlight_border;
          node.style.borderRightColor = this.theme.frozen_highlight_border;
        }

        setTimeout(() => {
          node.style.background = 'transparent';
          node.style.borderBottomColor = 'transparent';
          node.style.borderRightColor = 'transparent';
        }, 400);
      }

    }

  }

  /**
   * layout has changed, and needs update. we clear the rectangle cache
   * immediately, to prevent any garbage, but we don't actually do the layout
   * until the next paint.
   *
   * FIXME: that makes no sense -- because rectangles will be calculated
   * incorrectly until the layout has been updated.
   */
  private QueueLayoutUpdate() {
    this.tile_update_pending = true;
  }

  private HandleSheetEvent(event: SheetEvent) {
    switch (event.type) {
      case 'style':
        this.DelayedRender(false, event.area);
        this.grid_events.Publish(event);
        break;

      case 'data':
        this.grid_events.Publish(event);
        break;

      default:
      // console.info('evt', event);
    }
  }

  private RedispatchEvent(event: KeyboardEvent) {

    let cloned_event: KeyboardEvent;

    if (UA.trident) {
      cloned_event = document.createEvent('KeyboardEvent');
      const modifiers = [];
      if (event.ctrlKey) modifiers.push('Control');
      if (event.altKey) modifiers.push('Alt');
      if (event.shiftKey) modifiers.push('Shift');

      // have to mask type for trident
      (cloned_event as any).initKeyboardEvent(
        event.type,
        false,
        false,
        event.view,
        event.key,
        event.location,
        modifiers.join(' '),
        event.repeat,
        Localization.locale);
    }
    else {
      cloned_event = new KeyboardEvent(event.type, event);
    }

    if (cloned_event && this.container) {
      this.container.dispatchEvent(cloned_event);
    }

  }

  private InitFormulaBar(grid_container: HTMLElement, autocomplete: Autocomplete) {

    this.formula_bar = new FormulaBar(
      grid_container,
      this.theme,
      this.model,
      this.options, autocomplete);

    this.formula_bar.autocomplete_matcher = this.autocomplete_matcher;

    this.formula_bar.Subscribe((event) => {

      switch (event.type) {

        case 'stop-editing':

          this.editing_state = EditingState.NotEditing;
          break;

        case 'start-editing':

          // NOTE: because this event (and stop-editing) are based on
          // focus, they don't behave correctly when switching sheets,
          // which (at least temporarily) steals focus. so we actually
          // get extra start and stop events. it works, sort of, because
          // we don't clear the primary selection when changing sheets
          // when editing, so the sheet ID is correct. but that's an
          // accident. see note below on 'commit'.

          // FIXME: could this be resolved by using the "selecting argument"
          // flag? that's sort of what that was originally created for,
          // although it predates multi-sheet. TODO

          this.editing_state = EditingState.FormulaBar;
          this.editing_cell = { ...this.primary_selection.target };
          break;

        case 'discard':

          this.editing_state = EditingState.NotEditing;

          if (this.editing_annotation) {
            this.ClearAdditionalSelections();
            this.ClearSelection(this.active_selection);
            if (this.editing_annotation.node) {
              this.editing_annotation.node.focus();
            }
            this.editing_annotation = undefined;
            this.UpdateFormulaBarFormula();
            this.DelayedRender();
            return;
          }

          if (this.container) this.Focus();
          this.ClearAdditionalSelections();
          this.ClearSelection(this.active_selection);
          this.UpdateFormulaBarFormula();
          this.DelayedRender();
          break;

        case 'commit':

          // FIXME: unify this (to the extent possible) w/ the other editor

          // NOTE: this only works because (1) on activate sheet, if you are
          // editing, we don't update the primary selection; and (2) for
          // annotations, we set a fake primary selection target with the
          // correct sheet ID.

          // all that needs to be rewritten to be more sane.

          if (this.model.active_sheet.id !== this.editing_cell.sheet_id) {
            if (this.editing_cell.sheet_id) {
              this.ActivateSheetID(this.editing_cell.sheet_id);
            }
          }

          this.editing_state = EditingState.NotEditing;

          // we added annotations to the formula bar, so there's some
          // logic here that's not in the ICE commit handler

          if (this.editing_annotation) {
            const annotation = this.editing_annotation;
            this.ClearAdditionalSelections();
            this.ClearSelection(this.active_selection);
            annotation.formula = event.value ? this.FixFormula(event.value) : '';
            if (annotation.node) {
              annotation.node.focus();
            }
            this.grid_events.Publish({ type: 'annotation', event: 'update', annotation });
            this.editing_annotation = undefined;
            this.DelayedRender();
            return;
          }

          if (this.container) this.Focus();
          
          this.SetInferredType(this.primary_selection, event.value, event.array);
          this.ClearAdditionalSelections();
          this.ClearSelection(this.active_selection);

          if (this.options.repaint_on_cell_change) {
            this.DelayedRender(false, this.primary_selection.area);
          }

          // unifying
          if (event.event) {

            this.RedispatchEvent(event.event);

            /*
            let cloned_event: KeyboardEvent;
            if (UA.trident) {
              cloned_event = document.createEvent('KeyboardEvent');
              const modifiers = [];
              if (event.event.ctrlKey) modifiers.push('Control');
              if (event.event.altKey) modifiers.push('Alt');
              if (event.event.shiftKey) modifiers.push('Shift');

              // have to mask type for trident
              (cloned_event as any).initKeyboardEvent(
                event.event.type,
                false,
                false,
                event.event.view,
                event.event.key,
                event.event.location,
                modifiers.join(' '),
                event.event.repeat,
                Localization.locale);
            }
            else {
              cloned_event = new KeyboardEvent(event.event.type, event.event);
            }

            if (cloned_event && this.container) {
              this.container.dispatchEvent(cloned_event);
            }
            */
          }
          break;

        case 'update':
          if (event.dependencies) {
            this.HighlightDependencies(event.dependencies);
          }
          break;

      }
    });

  }

  private InitCellEditor(autocomplete: Autocomplete) {

    // if (!this.container) { return; }

    // why is the parent grid cover? this causes us to lose mouse move events.
    // we could check bubbles but that might be expensive...

    // for some reason it expands nicely in the cover node, but not in the
    // container node. not sure why. can probably be fixed?

    this.cell_editor = new CellEditor(
      this.layout.scroll_reference_node,
      this.theme,
      this.model,
      autocomplete);

    this.cell_editor.autocomplete_matcher = this.autocomplete_matcher;

    this.cell_editor.Subscribe((event) => {

      switch (event.type) {

        // see notes in formula editor event handler re: start editing,
        // stop editing  and commit.

        case 'stop-editing':
          this.editing_state = EditingState.NotEditing;
          break;

        case 'start-editing':
          this.editing_state = EditingState.CellEditor;
          this.editing_cell = { ...this.primary_selection.target };
          break;

        case 'update':
          if (event.dependencies) {
            this.HighlightDependencies(event.dependencies);
          }
          break;

        case 'discard':

          this.editing_state = EditingState.NotEditing;

          this.DismissEditor();
          this.DelayedRender();
          break;

        case 'commit':

          // console.info('commit');

          // FIXME: unify this (to the extent possible) w/ the other editor

          if (this.model.active_sheet.id !== this.editing_cell.sheet_id) {
            if (this.editing_cell.sheet_id) {
              this.ActivateSheetID(this.editing_cell.sheet_id);
            }
          }

          this.editing_state = EditingState.NotEditing;

          if (event.selection) {
            this.SetInferredType(event.selection, event.value, event.array);
          }
          this.DismissEditor();

          // we should maybe not call this if there's an event? we
          // may just be repainting it immediately afterwards. 

          // (referring to UpdateFormulaBarFormula, which is now switched)

          if (event.event) {
            this.RedispatchEvent(event.event);
          }
          else {
            this.UpdateFormulaBarFormula();
          }

          if (this.options.repaint_on_cell_change) { // || !formula){
            this.DelayedRender(false, event.selection ? event.selection.area : undefined);
          }

          break;

        case 'end-selection':
          this.ClearSelection(this.active_selection);
          this.DelayedRender();
          break;

      }
    });
  }

  private DelayedRender(force = false, area?: Area, full_tile = false) {

    // if area is passed, set dirty before calling repaint

    // this seems to be called _without_ an area when selection changes;
    // that causes a selection repaint plus any necessary dirty tile updates.
    // so that actually works ok. we still may need to force everyone
    // to update, in somce cases, but that should be rare.

    if (!this.tile_update_pending && area) {
      this.layout.DirtyArea(area);
    }
    else if (!this.tile_update_pending && force) {
      this.layout.DirtyAll();
    }

    if (!this.render_token) {
      this.render_token = 1;
      Yield().then(() => {
        this.render_token = 0;
        this.Repaint(force, full_tile);
      });
    }

  }

  private Repaint(force = false, full_tile = false, force_headers = false) {

    if (this.headless) { return; }

    if (this.tile_update_pending) {
      this.tile_update_pending = false;
      this.layout.UpdateTiles();
      this.render_tiles = this.layout.VisibleTiles();
      this.layout.UpdateAnnotation(this.model.active_sheet.annotations);

      // FIXME: why is this here, as opposed to coming from the command
      // exec method? are we doubling up? (...)

      // I think we are correctly handing all cases. not 100% sure, though.
      // add/remove rows/columns is handled correctly. loading and resetting
      // documents should not need this event, because there is implicit
      // rebuild required.

      // we should trace back every call that sets tile_update_pending (which
      // is in queue layout update) and make sure the event is either sent
      // or unecessary.


      /*
      this.grid_events.Publish({
        type: 'structure',
        rebuild_required: true,
      });
      */

    }

    this.layout_token = 0;
    this.RenderSelections();

    this.tile_renderer.OverflowDirty(full_tile);

    if (force) {

      // set dirty in case we're not painting them

      for (const column of this.layout.grid_tiles) {
        for (const tile of column) {
          tile.dirty = true;
        }
      }
    }

    const start = this.render_tiles.start;
    const end = this.render_tiles.end;

    const row_list = [];
    for (let row = start.row; row <= end.row; row++) row_list.push(row);

    const column_list = [];
    for (let column = start.column; column <= end.column; column++) column_list.push(column);

    // FIXME: multiple tiles
    if (start.row > 0 && this.model.active_sheet.freeze.rows) row_list.push(0);
    if (start.column > 0 && this.model.active_sheet.freeze.columns) column_list.push(0);

    for (const column of column_list) {
      for (const row of row_list) {
        const tile = this.layout.grid_tiles[column][row];
        if (force || tile.dirty || tile.needs_full_repaint) {
          this.tile_renderer.Render(tile);
          tile.dirty = tile.needs_full_repaint = false;
        }
      }
    }

    this.tile_renderer.RenderHeaders(this.render_tiles, force_headers);
    this.tile_renderer.RenderCorner();

  }

  private MouseMove_RowHeader(event: MouseEvent) {

    const header = this.layout.CoordinateToRowHeader(event.offsetY);

    // this is used for the grid, but we can cheat and use it for the header
    const rect = this.layout.OffsetCellAddressToRectangle({ row: header.row, column: 0 });

    if (this.hover_cell.row !== -1 || this.hover_cell.column !== -1) {
      this.HoverCell({ row: -1, column: -1 });
    }

    let resize_row = -1;

    if (event.offsetY - rect.top <= this.RESIZE_PIXEL_BUFFER && header.row > 0) {
      resize_row = header.row - 1;
    }
    else if (rect.bottom - event.offsetY <= this.RESIZE_PIXEL_BUFFER) {
      resize_row = header.row;
    }

    if (resize_row >= 0) {
      this.layout.ResizeCursor('row');
    }
    else if (this.cell_resize.row) {
      this.cell_resize.row = -1;
      this.layout.ResizeCursor();
    }
    this.cell_resize.row = resize_row;

  }

  private MouseMove_ColumnHeader(event: MouseEvent) {

    const header = this.layout.CoordinateToColumnHeader(event.offsetX);

    // this is used for the grid, but we can cheat and use it for the header
    const rect = this.layout.OffsetCellAddressToRectangle({ row: 0, column: header.column });

    if (this.hover_cell.row !== -1 || this.hover_cell.column !== -1) {
      this.HoverCell({ row: -1, column: -1 });
    }

    let resize_column = -1;

    if (event.offsetX - rect.left <= this.RESIZE_PIXEL_BUFFER && header.column > 0) {
      resize_column = header.column - 1;
    }
    else if (rect.right - event.offsetX <= this.RESIZE_PIXEL_BUFFER) {
      resize_column = header.column;
    }

    if (resize_column >= 0) {
      this.layout.ResizeCursor('column');
    }
    else if (this.cell_resize.column) {
      this.cell_resize.column = -1;
      this.layout.ResizeCursor();
    }
    this.cell_resize.column = resize_column;

  }

  /**
   * handler for mousedown events on the row (left) header.
   * handles selection and resizing.
   *
   * FIXME: argument selection
   */
  private MouseDown_RowHeader(event: MouseEvent) {

    event.stopPropagation();
    event.preventDefault();

    let base_address = this.layout.CoordinateToRowHeader(event.offsetY);

    const bounding_rect = this.layout.row_header_cover.getBoundingClientRect();
    const offset = {
      x: bounding_rect.left,
      y: bounding_rect.top,
    };

    if (this.cell_resize.row >= 0) {
      const row = this.cell_resize.row;
      const base = offset.y + event.offsetY;

      // height of ROW
      const original_height = this.model.active_sheet.GetRowHeight(row);
      let height = original_height;

      const rect = this.layout.OffsetCellAddressToRectangle({ row, column: 0 });
      const tooltip_base = offset.y + rect.bottom;

      this.layout.ShowTooltip({
        left: true,
        text: `${height}px`,
        x: Math.round(bounding_rect.right + 10),
        y: tooltip_base,
      });

      const move_annotation_list: Array<{annotation: Annotation; y: number}> = [];
      const size_annotation_list: Array<{annotation: Annotation; height: number}> = [];

      for (const annotation of this.model.active_sheet.annotations) {
        const y = rect.bottom - 1; // -1? border or something?

        if (!annotation.rect || annotation.rect.bottom < y) { continue; }
        if (y <= annotation.rect.top && annotation.move_with_cells) {
          move_annotation_list.push({annotation, y: annotation.rect.top});
        }
        else if (y > annotation.rect.top && annotation.resize_with_cells) {
          size_annotation_list.push({annotation, height: annotation.rect.height});
        }
      }

      MouseDrag(this.layout.mask, 'row-resize', (move_event: MouseEvent) => {
        const delta = Math.max(-original_height, Math.round(move_event.offsetY - base));
        if (delta + original_height !== height) {

          height = delta + original_height;
          // tile_sizes[tile_index] = tile_height + delta;
          this.model.active_sheet.SetRowHeight(row, height);

          this.layout.UpdateTooltip({
            text: `${height}px`,
            y: tooltip_base + delta,
          });

          for (const {annotation, y} of move_annotation_list) {
            if (annotation.rect) {
              annotation.rect.top = y + delta;
            }
          }
          for (const {annotation, height} of size_annotation_list) {
            if (annotation.rect) {
              annotation.rect.height = height + delta;
            }
          }

          requestAnimationFrame(() => {

            // FIXME: use command

            this.layout.UpdateTileHeights(true, row);
            this.Repaint(false, true); // repaint full tiles
            this.layout.UpdateAnnotation(this.model.active_sheet.annotations);
          });

        }
      }, () => {

        this.layout.HideTooltip();

        requestAnimationFrame(() => {

          // this bit updates rows if more than one are selected, because
          // the resize routine only "live" resizes the first one. we can
          // pass everything into the command.

          let rows = [row];

          if (!this.primary_selection.empty &&
            this.primary_selection.area.rows > 1 &&
            this.primary_selection.area.start.column === Infinity &&
            this.primary_selection.area.ContainsRow(row)) {

            // update all selected rows. these could be in different tiles.

            // in case the whole sheet is selected
            const area = this.model.active_sheet.RealArea(this.primary_selection.area);

            rows = [];
            for (let r = area.start.row; r <= area.end.row; r++) {
              // this.model.sheet.RowHeight(r, height, true);
              rows.push(r);
            }

            // row = area.start.row; // ??

          }

          for (const {annotation} of size_annotation_list) {
            if (annotation.resize_callback) {
              annotation.resize_callback.call(undefined);
            }
          }

          this.ExecCommand({
            key: CommandKey.ResizeRows,
            row: rows,
            height,
          });

        });

      });
    }
    else {

      const selection = this.SelectingArgument() ?
        this.active_selection : this.primary_selection;

      if (event.shiftKey && !selection.empty) {
        const tmp = selection.target;
        this.Select(selection, new Area(selection.target, base_address, true), undefined, true);
        base_address = tmp;
      }
      else {
        this.Select(selection, new Area(base_address), { column: 0, row: base_address.row });
      }
      this.RenderSelections();

      MouseDrag(this.layout.mask, [], (move_event: MouseEvent) => {
        const address = this.layout.CoordinateToRowHeader(move_event.offsetY - offset.y);
        const area = new Area(address, base_address, true);

        if (selection.empty || !area.Equals(selection.area)) {
          this.Select(selection, area, undefined, true);
          this.RenderSelections();
        }
      }, () => {
        // console.info('end');

      });
    }
  }

  /**
   * handler for mousedown events on the column (top) header.
   * handles selection and resizing.
   *
   * FIXME: argument selection
   */
  private MouseDown_ColumnHeader(event: MouseEvent) {

    event.stopPropagation();
    event.preventDefault();

    let base_address = this.layout.CoordinateToColumnHeader(event.offsetX);

    const bounding_rect = this.layout.column_header_cover.getBoundingClientRect();
    const offset = {
      x: bounding_rect.left,
      y: bounding_rect.top,
    };

    if (this.cell_resize.column >= 0) {
      const column = this.cell_resize.column;
      const base = offset.x + event.offsetX;

      // doubleclick

      if (this.IsDoubleClick({ row: -1, column })) {

        let columns = [column];

        if (!this.primary_selection.empty &&
          this.primary_selection.area.columns > 1 &&
          this.primary_selection.area.start.row === Infinity &&
          this.primary_selection.area.ContainsColumn(column)) {

          // update all selected columns. these could be in different tiles.

          // in case the whole sheet is selected
          const area = this.model.active_sheet.RealArea(this.primary_selection.area);

          columns = [];
          for (let c = area.start.column; c <= area.end.column; c++) {
            columns.push(c);
          }

        }

        // call with width = undefined, means auto-size

        this.ExecCommand({
          key: CommandKey.ResizeColumns,
          column: columns,
        });

        return;
      }

      //

      // width of COLUMN
      const original_width = this.model.active_sheet.GetColumnWidth(column);
      let width = original_width;

      const rect = this.layout.OffsetCellAddressToRectangle({ row: 0, column });
      const tooltip_base = offset.x + rect.right;

      this.layout.ShowTooltip({
        up: true,
        text: `${width}px`,
        x: tooltip_base,
        y: Math.round(bounding_rect.bottom + 10),
      });

      // list of annotations that may be affected by this operation. 
      // this operation will either affect position or size, but not both.

      const move_annotation_list: Array<{annotation: Annotation; x: number}> = [];
      const size_annotation_list: Array<{annotation: Annotation; width: number}> = [];

      for (const annotation of this.model.active_sheet.annotations) {
        const x = rect.right - 1; // -1? border or something?
        if (!annotation.rect || annotation.rect.right < x) { continue; }

        if (x <= annotation.rect.left && annotation.move_with_cells) {
          move_annotation_list.push({annotation, x: annotation.rect.left});
        }
        else if (x > annotation.rect.left && annotation.resize_with_cells) {
          size_annotation_list.push({annotation, width: annotation.rect.width});
        }
      }

      MouseDrag(this.layout.mask, 'column-resize', (move_event: MouseEvent) => {
        const delta = Math.max(-original_width, Math.round(move_event.offsetX - base));

        if (delta + original_width !== width) {

          width = delta + original_width;

          this.layout.UpdateTooltip({
            text: `${width}px`,
            x: tooltip_base + delta,
          });

          // tile_sizes[tile_index] = tile_width + delta;
          this.model.active_sheet.SetColumnWidth(column, width);

          for (const {annotation, x} of move_annotation_list) {
            if (annotation.rect) {
              annotation.rect.left = x + delta;
            }
          }
          for (const {annotation, width} of size_annotation_list) {
            if (annotation.rect) {
              annotation.rect.width = width + delta;
            }
          }

          requestAnimationFrame(() => {
            this.layout.UpdateTileWidths(true, column);
            this.Repaint(false, true); // repaint full tiles
            this.layout.UpdateAnnotation(this.model.active_sheet.annotations);
          });

        }
      }, () => {

        this.layout.HideTooltip();

        requestAnimationFrame(() => {

          // @see MouseDown_RowHeader

          const columns = [column];

          if (!this.primary_selection.empty &&
            this.primary_selection.area.columns > 1 &&
            this.primary_selection.area.start.row === Infinity &&
            this.primary_selection.area.ContainsColumn(column)) {

            // update all selected columns. these could be in different tiles.

            // in case the whole sheet is selected
            const area = this.model.active_sheet.RealArea(this.primary_selection.area);

            for (let c = area.start.column; c <= area.end.column; c++) {
              // this.model.sheet.ColumnWidth(c, width, true);
              columns.push(c);
            }

            // for next call
            // column = area.start.column; // ??

          }

          for (const {annotation} of size_annotation_list) {
            if (annotation.resize_callback) {
              annotation.resize_callback.call(undefined);
            }
          }

          this.ExecCommand({
            key: CommandKey.ResizeColumns,
            column: columns,
            width,
          });

        });

      });
    }
    else {

      const selection = this.SelectingArgument() ?
        this.active_selection : this.primary_selection;

      if (event.shiftKey && !selection.empty) {
        const tmp = selection.target;
        this.Select(selection, new Area(selection.target, base_address, true), undefined, true);
        base_address = tmp;
      }
      else {
        this.Select(selection, new Area(base_address), { row: 0, column: base_address.column });
      }
      this.RenderSelections();

      MouseDrag(this.layout.mask, [], (move_event: MouseEvent) => {
        const address = this.layout.CoordinateToColumnHeader(move_event.offsetX - offset.x);
        const area = new Area(address, base_address, true);
        if (selection.empty || !area.Equals(selection.area)) {
          this.Select(selection, area, undefined, true);
          this.RenderSelections();
        }
      });
    }
  }

  private HoverCell(address: ICellAddress, event?: MouseEvent) {

    // does this cell have a note?

    const cell = this.cells.GetCell(address, false);
    const note = cell ? cell.note : undefined;

    if (note) {

      // move and show
      this.layout.ShowNote(note, address, event);
      this.hover_note_visible = true;
    }
    else if (this.hover_note_visible) {

      // hide
      this.layout.HideNote();
      this.hover_note_visible = false;
    }

    // set

    this.hover_cell = { ...address };

  }

  /**
   * grid move handler for hit-testing various areas
   */
  private MouseMove_Grid(event: MouseEvent) {

    event.stopPropagation();
    event.preventDefault();

    // needed for legacy

    if (this.cell_resize.row >= 0 || this.cell_resize.column >= 0) {
      this.layout.ResizeCursor();
    }

    const offset_point = {
      x: event.offsetX,
      y: event.offsetY,
    };

    /*
    if (this.model.annotations.length) {
      this.PointToAnnotation(offset_point);
    }
    */

    // don't show hints if we are editing

    if (!(this.cell_editor && this.cell_editor.visible)) {
      const address = this.layout.PointToAddress_Grid(offset_point);
      if (this.hover_cell.row !== address.row || this.hover_cell.column !== address.column) {
        this.HoverCell(address, event);
      }
    }

    if (this.primary_selection.empty || !this.selection_renderer.nub_rectangle) {
      if (this.nub_select_flag) {
        this.layout.grid_cover.classList.remove('nub-select');
        this.nub_select_flag = false;
      }
      return;
    }

    const nub = this.selection_renderer.nub_rectangle.Contains(event.offsetX, event.offsetY);
    if (nub === this.nub_select_flag) return;
    if (nub) {
      this.layout.grid_cover.classList.add('nub-select');
    }
    else {
      this.layout.grid_cover.classList.remove('nub-select');
    }
    this.nub_select_flag = nub;

  }

  /**
   * unifying double-click. pass the test address. returns true if this looks
   * like a double-click on that address. otherwise sets flags to capture the
   * next one.
   *
   * FIXME: parameterize timeout?
   */
  private IsDoubleClick(address: ICellAddress, timeout = 300) {

    if (this.double_click_data.address
      && this.double_click_data.address.row === address.row
      && this.double_click_data.address.column === address.column) {

      clearTimeout(this.double_click_data.timeout);
      this.double_click_data.address = undefined;
      this.double_click_data.timeout = undefined;
      return true;

    }
    else {
      if (this.double_click_data.timeout) clearTimeout(this.double_click_data.timeout);
      this.double_click_data.address = { ...address };
      this.double_click_data.timeout = setTimeout(() => {
        this.double_click_data.address = undefined;
        this.double_click_data.timeout = undefined;
      }, timeout);
    }

  }

  /**
   * handles mouse down events on the grid area:
   * selection (click-drag) and editing (double-click)
   */
  private MouseDown_Grid(event: MouseEvent) {

    if (this.cell_editor && this.cell_editor.visible && this.cell_editor.HandleMouseEvent(event)) return;

    event.stopPropagation();
    event.preventDefault();

    const selecting_argument = this.SelectingArgument();
    if (!selecting_argument && this.additional_selections.length) {
      this.ClearAdditionalSelections();
    }

    this.Focus();

    // unless we're selecting an argument, close the ICE

    if (this.cell_editor && this.cell_editor.visible && !this.cell_editor.selecting) {
      this.DismissEditor();
    }

    const offset_point = {
      x: event.offsetX,
      y: event.offsetY,
    };

    /*
    // FIXME: trident

    if (!selecting_argument) {
      const annotation = this.PointToAnnotation(offset_point);
      if (annotation && annotation.node) {
        this.selected_annotation = annotation;
        const cloned_event = new MouseEvent(event.type, event);
        annotation.node.dispatchEvent(cloned_event);
        return;
      }
    }
    */

    let base_address = this.layout.PointToAddress_Grid(offset_point);

    const selection = selecting_argument ? this.active_selection : this.primary_selection;

    // don't handle double-click when selecting arguments

    if (!selecting_argument) {
      if (this.IsDoubleClick(base_address)) {
        this.EditCell({ target: base_address, area: new Area(base_address) }, false);
        return;
      }
    }

    // move events will be in mask (window) coordinates,
    // so we will need to offset

    let bounding_rect = this.layout.grid_cover.getBoundingClientRect();
    const offset = {
      x: bounding_rect.left,
      y: bounding_rect.top,
    };

    const overlay_classes: string[] = [];

    // on shift-click, consolidate selection. that only works if there's
    // a target in the original selection.

    // if you click the nub in the primary selection, select a rectangle
    // keeping the original top-left. this can lose the target, but that's
    // not ultimately a problem.

    if (event.shiftKey && !selection.empty) {
      const tmp = selection.target;
      this.Select(selection, new Area(base_address, selection.target, true), undefined, true);
      base_address = tmp;
    }
    else if (this.nub_select_flag) {
      base_address = selection.area.TopLeft();
      overlay_classes.push('nub-select');
    }
    else {
      this.Select(selection, new Area(base_address), base_address);
    }

    this.RenderSelections();

    if (selecting_argument) this.UpdateSelectedArgument(selection);

    const grid_rect =
      this.layout.CellAddressToRectangle({ row: 0, column: 0 }).Combine(
        this.layout.CellAddressToRectangle({
          row: this.model.active_sheet.rows - 1,
          column: this.model.active_sheet.columns - 1,
        })).Expand(-1, -1);

    MouseDrag(this.layout.mask, overlay_classes, (move_event: MouseEvent) => {

      // check if we are oob the grid

      const point = {
        x: move_event.offsetX - offset.x,
        y: move_event.offsetY - offset.y,
      };
      const testpoint = grid_rect.Clamp(point.x, point.y);
      const address = this.layout.PointToAddress_Grid(testpoint, true);

      const scroll_node = this.layout.scroll_reference_node;

      let reset_offset = false;
      if (this.container && this.options.scrollbars) {
        if (point.x < scroll_node.scrollLeft) {
          scroll_node.scrollLeft -= 25;
          reset_offset = true;
        }
        else if (point.x > scroll_node.scrollLeft + this.container.clientWidth) {
          scroll_node.scrollLeft += 25;
          reset_offset = true;
        }
        if (point.y < scroll_node.scrollTop) {
          scroll_node.scrollTop -= 25;
          reset_offset = true;
        }
        else if (point.y > scroll_node.scrollTop + this.container.clientHeight) {
          scroll_node.scrollTop += 25;
          reset_offset = true;
        }
        if (reset_offset) {
          bounding_rect = this.layout.grid_cover.getBoundingClientRect();
          offset.x = bounding_rect.left + document.body.scrollLeft;
          offset.y = bounding_rect.top + document.body.scrollTop;
        }
      }

      const area = new Area(address, base_address, true);
      if (selection.empty || !area.Equals(selection.area)) {
        this.Select(selection, area, undefined, true);
        this.RenderSelections();

        if (selecting_argument) {
          this.UpdateSelectedArgument(selection);
        }
        else if (!selection.empty && !selection.area.entire_sheet) {
          if (selection.area.entire_column) {
            this.UpdateAddressLabel(undefined, selection.area.columns + 'C');
          }
          else if (selection.area.entire_row) {
            this.UpdateAddressLabel(undefined, selection.area.rows + 'R');
          }
          else if (selection.area.count > 1) {
            this.UpdateAddressLabel(undefined, selection.area.rows + 'R x ' +
              selection.area.columns + 'C');
          }
          else {
            this.UpdateAddressLabel(selection);
          }
        }
      }
    }, () => {
      // console.info('end');
      this.UpdateAddressLabel();

      if (selecting_argument) {
        if (this.cell_editor && this.cell_editor.visible) {
          // ...
        }
        else if (this.formula_bar) {
          // console.info('calling focus editor');
          this.formula_bar.FocusEditor();
        }
      }

    });
  }

  private UpdateSelectedArgument(selection: GridSelection) {

    // if this is a single merged block, we want to insert it as the
    // root cell and not the range.

    let label = selection.area.spreadsheet_label;

    const cell = this.model.active_sheet.CellData(selection.area.start);
    if (cell.merge_area && cell.merge_area.Equals(selection.area)) {
      label = Area.CellAddressToLabel(cell.merge_area.start);
    }

    if (this.model.active_sheet.id !== this.editing_cell.sheet_id) {
      const name = this.model.active_sheet.name;

      if (QuotedSheetNameRegex.test(name)) {
        label = `'${name}'!${label}`;
      }
      else {
        label = `${name}!${label}`;
      }
    }

    if (this.cell_editor && this.cell_editor.visible && this.cell_editor.selecting) {
      this.cell_editor.InsertReference(label, 0);
    }
    else if (this.formula_bar && this.formula_bar.selecting) {
      this.formula_bar.InsertReference(label, 0);
    }
  }

  /**
   * unified method to check if we are selecting an argument in the formula
   * bar editor or the in-cell editor
   *
   * FIXME: why is this not an accessor?
   */
  private SelectingArgument() {
    return (this.cell_editor && this.cell_editor.visible && this.cell_editor.selecting)
      || (this.formula_bar && this.formula_bar.selecting);
  }

  /**
   * event handler for keyboard events. some we handle directly (directional
   * navigation), some we ignore (most control-key combinations), and if you
   * type text we start the in-cell editor and pass on the event.
   */
  private KeyDown(event: KeyboardEvent) {

    let editor_open = false;

    if (this.cell_editor) {
      editor_open = this.cell_editor.visible;
      if (editor_open && this.cell_editor.HandleKeyEvent(event)) return;
    }

    const selecting_argument = this.SelectingArgument();

    if (this.formula_bar && this.formula_bar.focused && !selecting_argument) {
      return;
    }

    if (this.selected_annotation && !selecting_argument) {
      return;
    }

    const selection = selecting_argument ? this.active_selection : this.primary_selection;

    const delta = { rows: 0, columns: 0 };
    let within_selection = false;
    let expand_selection = false;

    // handle some specific control-key combinations

    if (event.ctrlKey || (UA.is_mac && event.metaKey)) {

      // handle ctrl+shift+arrow AND ctrl+arrow (we used to just handle
      // ctrl+shift+arrow). we don't handle any other ctrl+shift combinations.

      switch (event.key) {
        case 'ArrowDown':
        case 'Down':
          delta.rows++;
          break;

        case 'ArrowUp':
        case 'Up':
          delta.rows--;
          break;

        case 'ArrowLeft':
        case 'Left':
          delta.columns--;
          break;

        case 'ArrowRight':
        case 'Right':
          delta.columns++;
          break;

        case 'Delete':
        case 'Del':
          // if (event.shiftKey) // ctrl+shift+delete seems to be "delete history" in all browsers...
          {
            event.stopPropagation();
            event.preventDefault();
            for (let i = 0; i < this.model.sheets.length; i++) {
              if (this.model.sheets[i] === this.model.active_sheet) {
                this.DeleteSheet(i);
                break;
              }
            }
            return;
          }
          break;

        case '/':
          event.stopPropagation();
          event.preventDefault();
          this.SelectArray();
          break;

        default:
          if (event.shiftKey) {
            return;
          }
      }

      if (delta.columns || delta.rows) {

        // NOTE: we're not using the "advance selection" method, since
        // we have particular requirements when block-selecting.

        event.stopPropagation();
        event.preventDefault();

        // FIXME: we're handling blocks OK, but we need to handle jumping
        // between blocks or jumping to the next block. call that a TODO.

        if (!selection.empty && (delta.columns || delta.rows)) {
          if (this.BlockSelection(selection, !!event.shiftKey, delta.columns, delta.rows)) {
            return;
          }
        }
        else {
          return;
        }

      }
      else {

        const applied_style: Style.Properties = {};
        const selected_style: Style.Properties =
          this.primary_selection.empty ? {} :
            this.model.active_sheet.CellData(this.primary_selection.target).style || {};

        // seems to be the best bet for xplatform

        switch (event.key.toLowerCase()) {

          /*
          case 'c':
            console.info("calling exec command copy")
            const x = document.execCommand('copy');
            console.info('x?', x);
            break;

          case 'x':
            console.info("calling exec command cut")
            document.execCommand('cut');
            break;

          case 'v':
            console.info("calling exec command paste")
            document.execCommand('paste');
            break;
          */

          case 'b':
            applied_style.font_bold = !selected_style.font_bold;
            break;

          case 'i':
            applied_style.font_italic = !selected_style.font_italic;
            break;

          case 'u':
            applied_style.font_underline = !selected_style.font_underline;
            break;

          case 'a':
            // this.Select(this.primary_selection, new Area({ row: Infinity, column: Infinity }), undefined, true);
            // this.RenderSelections();
            this.SelectAll();
            break;

          // handle Ctrl+Alt+0 = select nothing

          case '0':
            if (!event.altKey) return;
            this.ClearSelection(this.primary_selection); // not clear the selection, clear selection
            this.RenderSelections();
            break;

          default:
            if (event.key !== 'Control') {
              // console.info('unhandled control key', event.key); // dev
            }
            return;
        }

        if (Object.keys(applied_style).length) {
          this.ApplyStyle(undefined, applied_style);
        }

      }
    }
    else {
      switch (event.key) {
        case 'Tab':
          if (event.shiftKey) delta.columns--;
          else delta.columns++;
          within_selection = true;
          break;

        case 'Enter':
          if (event.shiftKey) delta.rows--;
          else delta.rows++;
          within_selection = true;
          break;

        case 'ArrowDown':
        case 'Down':
          delta.rows++;
          expand_selection = event.shiftKey;
          break;

        case 'ArrowUp':
        case 'Up':
          delta.rows--;
          expand_selection = event.shiftKey;
          break;

        case 'ArrowLeft':
        case 'Left':
          delta.columns--;
          expand_selection = event.shiftKey;
          break;

        case 'ArrowRight':
        case 'Right':
          delta.columns++;
          expand_selection = event.shiftKey;
          break;

        case 'Delete':
        case 'Del':
          if (!selection.empty) {
            this.DeleteSelection(selection);
          }
          break;

        case 'PageUp':
        case 'PageDown':
          if (event.shiftKey) {
            this.NextSheet(event.key === 'PageUp' ? -1 : 1);
            break;
          }

          return; // FIXME

        case 'Control':
        case 'Shift':
        case 'Alt':
          // console.info('skip', event.key);
          return;

        default:
          // console.info('ek', event.key);

          if (!selection.empty) this.EditCell(selection, true, event);
          return;
      }
    }

    event.stopPropagation();
    event.preventDefault();

    // console.info(event.key);

    if (delta.rows || delta.columns) {
      this.AdvanceSelection(delta, selection, within_selection, expand_selection, !editor_open);
    }

  }

  /**
   * select the array containing the current cell, if any. if there's no
   * array, do nothing.
   */
  private SelectArray() {
    if (this.primary_selection.empty) {
      return;
    }

    const cell = this.model.active_sheet.CellData(this.primary_selection.target);
    if (!cell || !cell.area) {
      return;
    }

    this.Select(this.primary_selection, cell.area, cell.area.start);
    this.RenderSelections();

  }

  /**
   * render selections. we are wrapping this up in a method so we can
   * hide the primary selection in some cases (one case).
   */
  private RenderSelections() {
    const show_primary_selection = (!this.editing_state) ||
      (this.editing_cell.sheet_id === this.model.active_sheet.id);

    this.selection_renderer.RenderSelections(show_primary_selection);
  }

  /**
   * select a block. returns true if we've handled it; returns false
   * if we want to revert to the standard behavior.
   *
   * (block selection refers to selecting more than one cell at once,
   * using ctrl+arrow. selection jumps across all populated cells in
   * a given direction for a given row/column).
   */
  private BlockSelection(selection: GridSelection, expand_selection: boolean,
    columns: number, rows: number, render = true): boolean {

    // select the containing block. note that we do not handle
    // the case of BOTH rows and columns.

    if (selection.empty) return false;
    const start: ICellAddress = { ...selection.target };

    // the starting cell for the purposes of a block depends on the
    // direction we're heading

    // changing behavior: always start at target... but clip the selection
    // to target (if expanding) so that it's only in one direction vis-a-vis
    // the target

    // adjusted slightly: start at the target OR the end of the selection
    // IF the end of the selection is in the right direction relative to
    // the delta...

    if (rows > 0) start.row = Math.max(start.row, selection.area.end.row);
    else if (rows < 0) start.row = Math.min(start.row, selection.area.start.row);

    if (columns > 0) start.column = Math.max(start.column, selection.area.end.column);
    else if (columns < 0) start.column = Math.min(start.column, selection.area.start.column);

    /*
    if (rows > 0) start.row = selection.area.end.row;
    else if (rows < 0) start.row = selection.area.start.row;

    else if (columns > 0) start.column = selection.area.end.column;
    else if (columns < 0) start.column = selection.area.start.column;
    */

    let cell = this.cells.GetCell(selection.target, false);
    if (!cell || (cell.type === ValueType.undefined && !cell.area)) {
      return false;
    }

    // ok, expand in the desired direction until we hit an empty cell

    let end = { ...start };
    for (; ;) {

      // FIXME: merge/array handling

      // a little more complicated: test every cell in the cross-dimension,
      // so we capture jagged blocks. for example:
      //
      // [target] [ full ]
      // [ full ] [ full ]
      // [empty ] [ full ]
      // [ full ] [ full ]
      // [ full ] [ full ]
      //
      // if you are selecting across, then down, you want to capture the
      // whole array but it still stop on the empty cell because we're
      // testing from target.
      //

      const test = { row: end.row + rows, column: end.column + columns };
      if (test.column < 0 || test.row < 0 ||
        test.column >= this.model.active_sheet.columns ||
        test.row >= this.model.active_sheet.rows) break;

      let has_value = false;
      if (rows) {
        for (let column = selection.area.start.column; !has_value && column <= selection.area.end.column; column++) {
          cell = this.cells.GetCell({ row: test.row, column }, false);
          has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
          if (!has_value && cell && cell.merge_area) {
            cell = this.cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
          }
        }
      }
      else {
        for (let row = selection.area.start.row; !has_value && row <= selection.area.end.row; row++) {
          cell = this.cells.GetCell({ row, column: test.column }, false);
          has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
          if (!has_value && cell && cell.merge_area) {
            cell = this.cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
          }
        }
      }

      if (!has_value) { break; }

      end = test;

    }

    if (expand_selection) {

      // new behavior: we have moved in one direction from the
      // target, now clip the other direction. keep the other
      // dimension consistent.

      if (rows) {

        // clip dimension
        start.row = selection.target.row;

        // preserve other dimension
        start.column = selection.area.start.column;
        end.column = selection.area.end.column;
      }
      else {

        // clip dimension
        start.column = selection.target.column;

        // preserve other dimension
        start.row = selection.area.start.row;
        end.row = selection.area.end.row;
      }

      const area = new Area(start, end, true);
      this.Select(selection, area, selection.target, true);
    }
    else {
      this.Select(selection, new Area(end));
    }
    this.ScrollIntoView(end);

    if (this.SelectingArgument()) this.UpdateSelectedArgument(selection);
    if (render) {
      this.DelayedRender();
    }

    return true;

  }

  /**
   * deletes (clears) the selected area.
   *
   * FIXME: should probably be an API method, or have a second method that
   * clears the primary selection
   */
  private DeleteSelection(selection: GridSelection) {
    if (selection.empty) return;
    const area = this.model.active_sheet.RealArea(selection.area);
    this.ExecCommand({ key: CommandKey.Clear, area });
  }

  /**
   * sets cell value, inferring type and (possibly) inferring cell style
   * (numbers only), so that 10% and $1,000 retain styles. this should only
   * be used for direct editing -- copy and paste can copy and paste styles.
   *
   * @param address cell address
   * @param value value entered, usually this will be a string (we will try
   * to parse numbers/booleans)
   *
   * @param exec execute commands immediately; alternatively, return the list
   * of commands. the former is the default for editor commits; the latter
   * is used for paste.
   */
  private SetInferredType(selection: GridSelection, value: any, array = false, exec = true) {

    // validation: cannot change part of an array without changing the
    // whole array. so check the array. separately, if you are entering
    // an array, make sure that no affected cell is part of an existing
    // array.

    let target = selection.target || selection.area.start;
    const cell = this.model.active_sheet.CellData(target);

    if (cell.area) {
      if ((!array && cell.area.count > 1) || !selection.area || !selection.area.Equals(cell.area)) {
        // FIXME // this.Publish({type: 'grid-error', err: GridErrorType.ArrayChange, reference: selection.area });
        console.info('rejected: can\'t change part of an array (1)');
        return;
      }
    }
    else if (array) {
      let existing_array = false;
      // let reference: Area;
      this.model.active_sheet.cells.IterateArea(selection.area, (element: Cell) => {
        if (element.area) {
          // column = column || 0;
          // row = row || 0;
          // reference = new Area({ column, row });
          existing_array = true;
        }
      }, false);
      if (existing_array) {
        // FIXME // this.Publish({type: 'grid-error', err: GridErrorType.ArrayChange, reference });
        console.info('rejected: can\'t change part of an array (2)');
        return;
      }
    }

    if (cell.merge_area) target = cell.merge_area.start; // this probably can't happen at this point

    // first check functions

    const is_function = (typeof value === 'string' && value.trim()[0] === '=');
    const commands: Command[] = [];

    if (is_function) {

      value = this.FixFormula(value);

      // so what we are doing now is copying style from a function argument,
      // if a function argument has a number format, but only if there's no
      // explicit number format already set for this cell (either in the cell
      // directly or in the row/column).

      // it might actually be preferable to override the local cell style,
      // if there is one, if the argument has a style. (...)

      if (!this.model.active_sheet.HasCellStyle(target)) {
        const formula_parse_result = this.parser.Parse(value);
        if (formula_parse_result && formula_parse_result.dependencies) {
          const list = formula_parse_result.dependencies;
          for (const key of Object.keys(list.addresses)) {
            const address = list.addresses[key];
            if (this.model.active_sheet.HasCellStyle({ ...address })) {
              const test = this.model.active_sheet.CellData({ ...address });
              if (test.style && test.style.number_format) {
                const style: Style.Properties = {
                  number_format: test.style.number_format,
                };
                // if (array) this.model.sheet.UpdateAreaStyle(selection.area, style, true, true);
                // else this.model.sheet.UpdateCellStyle(target, style, true, true);
                commands.push({
                  key: CommandKey.UpdateStyle,
                  area: array ? selection.area : target, style, delta: true
                });
              }
              break;
            }
          }
        }
      }
    }

    // next try to infer the number format, with hints as to format

    const parse_result = ValueParser.TryParse(value);

    if (!is_function && parse_result.type === ValueType.number) {

      // const text = value.toString();

      let number_format = '';
      const hints = parse_result.hints || Hints.None;

      // be stricter about number format. don't implicitly /change/
      // the number format (you can /set/, but don't /change/). 

      // FIXME: in this case, if we're setting a number format from
      // nothing, we could be a little smarter about setting the 
      // decimal places.

      if (!cell.style || !cell.style.number_format || NumberFormatCache.Equals(cell.style.number_format, 'General')) {

        // tslint:disable-next-line:no-bitwise
        if (hints & Hints.Date) {
          number_format = 'Short Date';
        }
        // tslint:disable-next-line:no-bitwise
        else if (hints & Hints.Exponential) {
          number_format = 'Exponential';
        }
        // tslint:disable-next-line:no-bitwise
        else if (hints & Hints.Percent) {
          number_format = 'Percent';
        }
        // tslint:disable-next-line:no-bitwise
        else if (hints & Hints.Currency) {
          number_format = 'Currency';
        }
        // tslint:disable-next-line:no-bitwise
        else if ((hints & Hints.Grouping) || (hints & Hints.Parens)) {
          number_format = 'Accounting';
        }

      }

      /*

      // tslint:disable-next-line:no-bitwise
      if (hints & Hints.Date) {
        if (!cell.style || !cell.style.number_format ||
          (NumberFormatCache.Equals(cell.style.number_format, 'General'))) {
          number_format = 'Short Date';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Exponential) {
        if (!cell.style || !cell.style.number_format || !/e/.test(cell.style.number_format)) {
          number_format = 'Exponential';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Percent) {
        if (!cell.style || !cell.style.number_format || !/%/.test(cell.style.number_format)) {
          number_format = 'Percent';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Currency) {
        if (!cell.style || !cell.style.number_format || !/,/.test(cell.style.number_format)) {
          number_format = 'Currency';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Grouping) {
        if (!cell.style || !cell.style.number_format || !new RegExp(Localization.grouping_separator).test(cell.style.number_format)) {
          number_format = 'Accounting';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Parens) {
        if (!cell.style || !cell.style.number_format || !/,/.test(cell.style.number_format)) {
          number_format = 'Accounting';
        }
      }

      */

      if (number_format) {
        commands.push({
          key: CommandKey.UpdateStyle,
          area: array ? selection.area : target,
          style: { number_format },
          delta: true,
        });
      }

      // always use // value = parse_result.value;

    }

    /*
    if (array) {
      this.model.sheet.SetArrayValue(selection.area, parse_result.value);
    }
    else {
      this.model.sheet.SetCellValue(target, parse_result.value);
    }
    */

    commands.push({
      key: CommandKey.SetRange,
      area: array ? selection.area : target,
      array,
      value: is_function ? value : parse_result.value,
    });

    if (exec) {
      this.ExecCommand(commands);
    }
    else {
      return commands;
    }
  }


  /**
   * tries to correct some basic formula errors, opening with a space,
   * not closing all parens, (...)
   */
  private FixFormula(formula: string): string {
    if (formula.trim()[0] !== '=') return formula;
    // if (!formula.trim().startsWith('=')) return formula;
    // formula = formula.trimLeft();
    formula = formula.replace(/^\s+/, '');

    let q = false;
    let a = false;
    let paren = 0;
    let escape = false;

    // for ( let i = 0; i < formula.length; i++ ){
    //  const c = formula[i];
    for (const char of formula) {
      if (!escape) {
        switch (char) {
          case '"':
            if (q) q = false;
            else if (!a) q = true;
            break;
          case '\'':
            if (a) a = false;
            else if (!q) a = true;
            break;
          case '\\':
            escape = true;
            break;
          case '(':
            if (!q && !a) paren++;
            break;
          case ')':
            if (!q && !a) paren--;
            break;
        }
      }
    }

    if (q) formula += '"';
    else if (a) formula += '\'';
    while (paren > 0) {
      formula += ')';
      paren--;
    }

    formula = this.NormalizeFormula(formula);

    return formula;
  }

  /**
   * normalize addresses (UC), function names (-> canonical) and
   * defined names (UC, for now)
   */
  private NormalizeFormula(formula: string) {
    const parse_result = this.parser.Parse(formula);
    if (parse_result && parse_result.expression) {
      this.parser.Walk(parse_result.expression, (unit) => {
        switch (unit.type) {

          case 'call':
            unit.name = this.autocomplete_matcher.NormalizeIdentifier(unit.name) || unit.name;
            break;

          case 'identifier':
            if (this.model.named_ranges.Get(unit.name)) {
              unit.name = unit.name.toUpperCase();
            }
            break;

        }
        return true;
      });
      formula = '=' + this.parser.Render(parse_result.expression, undefined, '');
    }
    return formula;
  }

  /**
   * dismisses the in-cell editor and returns to normal behavior.
   * removes any highlighted selections (arguments).
   */
  private DismissEditor() {

    if (!this.cell_editor) return;

    this.editing_state = EditingState.NotEditing;

    this.Focus();
    this.cell_editor.Hide();

    this.ClearAdditionalSelections();
    this.ClearSelection(this.active_selection);

  }

  /**
   * this prepares the cell value for _editing_ -- it's not the displayed
   * value, it's how we want the value to be displayed in the editor and 
   * formula bar. 
   */
  private NormalizeCellValue(cell: Cell) {

    let cell_value = cell.value;

    if (cell.type === ValueType.number && cell.style && cell.style.number_format) {

      const format = NumberFormatCache.Get(cell.style.number_format);

      if (format.date_format) {
        const date = new Date(cell_value * RDateScale);
        const number_format = (date.getHours() || date.getMinutes() || date.getSeconds()) ?
          'Timestamp' : 'Short Date';
        cell_value = NumberFormatCache.Get(number_format).Format(cell_value);
      }
      else if (/(?:%|percent)/i.test(cell.style.number_format)) {

        let precision = 0;

        const match = cell.value.toString().match(/\.(.*?)$/);
        if (match && match[1]) {
          precision = Math.max(0, match[1].length - 2); // because we are *100
        }

        cell_value = (cell_value * 100).toFixed(precision) + '%';
        if (Localization.decimal_separator === ',') {
          // cell_value = (cell.value * 100).toString().replace(/\./, ',');
          cell_value = cell_value.replace(/\./, ',');
        }

      }
      else {
        if (cell_value && Localization.decimal_separator === ',') {
          cell_value = cell.value.toString().replace(/\./, ',');
        }
      }
    }
    else if (cell.type === ValueType.boolean) {
      return cell_value.toString().toUpperCase(); // ? 'True' : 'False';
    }
    else if (cell.type === ValueType.number) { // no style: I think this is no longer possible
      if (cell_value && Localization.decimal_separator === ',') {
        cell_value = cell.value.toString().replace(/\./, ',');
      }
    }

    return cell_value;

  }

  /**
   * this is used to handle a trailing % sign when entering a new value.
   * we need to decide if the user is typing a number, in which case we
   * retain the %; or something else, like a formula or a string, in which
   * case we want to drop the %.
   * 
   * FIXME: move to utils lib
   */
  private IsNumeric(c: number) {

    // anything else?

    return (c >= 0x30 && c <= 0x39) // 0-9
          || (c === this.decimal_separator_code) // cached
          || (c === 0x2d) // -
          || (c === 0x2b) // + // this one is kind of a stretch...
          ;

  }

  /**
   * starts the in-cell editor at the given sheet address. this method doesn't
   * handle scroll-into-view, do that first if necessary.
   *
   * @param address the cell address. we'll check for merge head before editing.
   * @param flush flush contents before editing -- default for typing, !default
   * for double-click
   * @param event if this is triggered by typing, we want to pass the key
   * event directly to the editor (actually we'll pass a synthetic copy)
   */
  private EditCell(selection: GridSelection, flush = true, event?: KeyboardEvent) {
    if (!this.cell_editor) return;

    let address = selection.target || selection.area.start;
    let cell = this.model.active_sheet.CellData(address);
    let rect: Rectangle;

    // new, hide note if visible

    if (this.hover_note_visible) {
      this.layout.HideNote();
    }

    // merged cell, make sure we get/set value from the head
    // also get full rect for the editor

    if (cell.merge_area) {
      rect = this.layout.OffsetCellAddressToRectangle(cell.merge_area.start).Combine(
        this.layout.OffsetCellAddressToRectangle(cell.merge_area.end));
      address = cell.merge_area.start;
      cell = this.model.active_sheet.CellData(address);
    }
    else {
      rect = this.layout.OffsetCellAddressToRectangle(address);
    }

    // locked: can't edit!

    if (cell.style && cell.style.locked) {
      console.info('cell is locked for editing');
      return;
    }


    // FIXME: scroll into view (might be 1/2 visible)

    // UPDATE: we switched the cell editor parent to the container, so that
    // we can properly trap mouse move events. however that requires that we
    // offset rectangles by the row/column headers.

    // this width/height is actually in the sheet, although that's not really
    // a good place for it. sheet should be data-specific, and header size
    // is more of an application thing (although I guess you could resize the
    // headers in a particular sheet...) FIXME?

    // UPDATE: and we can't use offsetWidth/offsetHeight in legacy renderer...

    rect = rect.Shift(this.layout.header_size.width, this.layout.header_size.height);

    let cell_value = cell.value;

    if (flush) {

      if ((cell.type === ValueType.number || cell.rendered_type === ValueType.number) && cell.style &&
        cell.style.number_format && /(?:%|percent)/i.test(cell.style.number_format) &&
        (!event || this.IsNumeric(event.key.charCodeAt(0)))) {

        // UPDATE: don't do this if the user types '=', because they're typing a function.
        // actually we could probably extend that to anything that doesn't look like a number...

        cell_value = '%';
      }
      else {
        cell_value = undefined;
      }
    }
    else {
      cell_value = this.NormalizeCellValue(cell);
    }

    // const value: any = flush ? undefined : cell_value;

    // cell rect, offset for headers. FIXME: do we always offset for headers?
    // if so, that should go in the method.

    this.cell_editor.Edit(selection, rect.Shift(-1, -1).Expand(1, 1), cell_value, event);

  }

  private BoundAddressArea(address: ICellAddress, area: Area) {

    // order of overflow is different for vertical/horizontal movement.
    // also we don't want to double-step. so there are four separate,
    // double tests... it seems redundant.

    // not possible to do modulo arithmetic? (need carry/underflow?)

    if (address.column > area.end.column) {
      address.row = this.StepVisibleRows(address.row, 1);
      if (address.row > area.end.row) address.row = area.start.row;
      address.column = area.start.column;
    }
    else if (address.column < area.start.column) {
      address.row = this.StepVisibleRows(address.row, -1);
      if (address.row < area.start.row) address.row = area.end.row;
      address.column = area.end.column;
    }
    else if (address.row > area.end.row) {
      address.column = this.StepVisibleColumns(address.column, 1);
      if (address.column > area.end.column) address.column = area.start.column;
      address.row = area.start.row;
    }
    else if (address.row < area.start.row) {
      address.column = this.StepVisibleColumns(address.column, -1);
      if (address.column < area.start.column) address.column = area.end.column;
      address.row = area.end.row;
    }

  }

  /**
   * step from row X to row (X+Y). Y can be negative. we add this method to
   * support stepping across hidden (0-height) rows, so if you down arrow
   * it doesn't get stuck inside the hidden row (bad UX).
   *
   * UPDATE: no longer clamping. various methods rely on tests for < 0, so
   * we can't change that behavior. [FIXME: return an underflow flag?]. just
   * treat negative rows as not hidden, return the result.
   */
  private StepVisibleRows(start: number, step: number) {
    if (step > 0) {
      for (let i = 0; i < step; i++) {
        if (!this.model.active_sheet.GetRowHeight(++start)) i--;
      }
    }
    else if (step < 0) {
      for (let i = 0; i > step; i--) {
        if (--start >= 0 && !this.model.active_sheet.GetRowHeight(start)) i++;
      }
    }

    return start;
  }

  /**
   * step columns.
   * @see StepVisibleRows
   */
  private StepVisibleColumns(start: number, step: number) {
    if (step > 0) {
      for (let i = 0; i < step; i++) {
        if (!this.model.active_sheet.GetColumnWidth(++start)) i--;
      }
    }
    else if (step < 0) {
      for (let i = 0; i > step; i--) {
        if (--start >= 0 && !this.model.active_sheet.GetColumnWidth(start)) i++;
      }
    }
    return start;
  }

  /**
   * advances selection by x rows and columns. you can also step around
   * within a selection, generally by using enter and tab when there is
   * a multi-cell selection.
   *
   * not sure why this function renders by default, but we don't want that
   * in the case of closing the ICE. since normal operation may rely on this
   * behavior, at least for now, we'll make a parameter to disable. but it
   * should probably not render.
   */
  private AdvanceSelection(
    delta: Extent,
    selection: GridSelection,
    within_selection = false,
    expand_selection = false,
    render = true) {

    const selecting_argument = this.SelectingArgument();
    let expanded = false;

    if (selection.empty) {

      // different behavior
      if (selecting_argument) {
        const target = {
          row: Math.max(0, this.StepVisibleRows(this.primary_selection.target.row, delta.rows)),
          column: Math.max(0, this.StepVisibleColumns(this.primary_selection.target.column, delta.columns)),
        };
        this.Select(selection, new Area(target));
      }
      else {
        this.Select(selection, new Area({ row: 0, column: 0 }));
      }
    }
    else {

      const target_cell = this.model.active_sheet.CellData(selection.target);

      // if there's a merge, behavior may be a little different. for stepping,
      // we step into the merge cell when we hit the head. otherwise we skip
      // it entirely (which is a little complicated).

      // for expanding, we need to make sure that we expand beyond (or contract
      // to exclude) the merge cell. let's do this for each section, if it's
      // possible to merge behavior we can do that later.

      // one thing we need to check early is the "within selection" flag --
      // if there's only a single merged cell selected, this is not correct.

      if (target_cell.merge_area && within_selection) {
        within_selection = !target_cell.merge_area.Equals(selection.area);
      }

      if (within_selection && selection.area.count > 1) {

        // tab or enter within a larger selection moves the
        // target, but doesn't change the selection. this one
        // does not scroll (perhaps it should, if necessary?)

        // could be a very large selection, or we have moused
        // around -- so scroll the target into view.

        const area = this.RealArea(selection.area);
        const address = selection.target;

        // two things happen when merged. (1) if the current target is a
        // merge cell, then we need to step to the edge of the merge cell
        // (only matters if delta is positive):

        // (2) if the next cell is merged, then we either step onto the head
        // or, if we would step onto a subcell, pass over it entirely.

        //while (true) {
        for(;;) {

          // step

          address.row = this.StepVisibleRows(address.row, delta.rows);
          address.column = this.StepVisibleColumns(address.column, delta.columns);

          // bound

          this.BoundAddressArea(address, area);

          // merged? if we're not on the head, keep stepping (FIXME: step over
          // for efficiency, don't waste multiple checks)

          const check_cell = this.model.active_sheet.CellData(address);
          if (!check_cell.merge_area ||
            (check_cell.merge_area.start.row === address.row &&
              check_cell.merge_area.start.column === address.column)) break;

        }

        this.Select(selection, area, address);

      }
      else if (expand_selection && selection && selection.target) {

        // shift-arrow expands (contracts) the selection.

        // FIXME: need to handle merges, where the step will be > 1

        const area = selection.area;
        const target = selection.target;

        const start = area.start;
        const end = area.end;

        const scroll_target = { row: Infinity, column: Infinity };

        if (delta.columns) {
          if (area.columns === 1) {
            if (delta.columns > 0) {
              end.column = this.StepVisibleColumns(end.column, 1);
              scroll_target.column = end.column;
            }
            else {
              start.column = this.StepVisibleColumns(start.column, -1);
              scroll_target.column = start.column;
            }
          }
          else if (area.end.column > target.column) {
            end.column = this.StepVisibleColumns(end.column, delta.columns);
            scroll_target.column = end.column;
          }
          else if (area.start.column < target.column) {
            start.column = this.StepVisibleColumns(start.column, delta.columns);
            scroll_target.column = start.column;
          }
          end.column = Math.max(0, end.column);
          start.column = Math.max(0, start.column);
        }

        if (delta.rows) {
          if (area.rows === 1) {
            if (delta.rows > 0) {
              end.row = this.StepVisibleRows(end.row, 1);
              scroll_target.row = end.row;
            }
            else {
              start.row = this.StepVisibleRows(start.row, -1);
              scroll_target.row = start.row;
            }
          }
          else if (area.end.row > target.row) {
            end.row = this.StepVisibleRows(end.row, delta.rows);
            scroll_target.row = end.row;
          }
          else if (area.start.row < target.row) {
            start.row = this.StepVisibleRows(start.row, delta.rows);
            scroll_target.row = start.row;
          }
          end.row = Math.max(0, end.row);
          start.row = Math.max(0, start.row);
        }

        if (!this.options.expand) {
          for (const addr of [start, end, scroll_target]) {
            if (addr.row !== Infinity) {
              addr.row = Math.max(0, Math.min(addr.row, this.model.active_sheet.rows - 1));
            }
            if (addr.column !== Infinity) {
              addr.column = Math.max(0, Math.min(addr.column, this.model.active_sheet.columns - 1));
            }
          }

          this.ScrollIntoView(scroll_target);
          this.Select(selection, new Area(start, end), undefined, true);
 

        }
        else {

          for (const addr of [start, end, scroll_target]) {
            if (addr.row !== Infinity) {
              addr.row = Math.max(0, addr.row);
            }
            if (addr.column !== Infinity) {
              addr.column = Math.max(0, addr.column);
            }
          }


          if (end.row !== Infinity && end.row >= this.model.active_sheet.rows && this.options.expand) {
            let row = this.model.active_sheet.rows;
            while (end.row >= row) { row += 8; }
            this.model.active_sheet.cells.EnsureRow(row);
            expanded = true;
          }
          if (end.column !== Infinity && end.column >= this.model.active_sheet.columns && this.options.expand) {
            let column = this.model.active_sheet.columns;
            while (end.column >= column) { column += 8; }
            this.model.active_sheet.cells.EnsureColumn(column);
            expanded = true;
          }
  
          if (expanded) {
            this.layout.UpdateTiles();
            this.layout.UpdateContentsSize();
            this.Repaint(true, true);
            render = true;
          }

          this.ScrollIntoView(scroll_target);
          this.Select(selection, new Area(start, end), undefined, true);
 
        }


      }
      else {

        // this section: no modifier, and either arrow keys or tab/enter
        // but not inside a larger selection. move and make a new selection,
        // so selection will be a single cell. scroll it into view.

        const address = selection.target;

        if (target_cell.merge_area) {
          if (delta.columns < 0) {
            address.column = this.StepVisibleColumns(target_cell.merge_area.start.column, -1);
          }
          else if (delta.columns > 0) {
            address.column = this.StepVisibleColumns(target_cell.merge_area.end.column, 1);
          }
          if (delta.rows < 0) {
            address.row = this.StepVisibleRows(target_cell.merge_area.start.row, -1);
          }
          else if (delta.rows > 0) {
            address.row = this.StepVisibleRows(target_cell.merge_area.end.row, 1);
          }
        }
        else {
          address.row = this.StepVisibleRows(address.row, delta.rows);
          address.column = this.StepVisibleColumns(address.column, delta.columns);
        }

        // NOTE: this is bounding.
        // FIXME: option to expand the sheet by selecting out of bounds.

        if (address.row >= this.model.active_sheet.rows && this.options.expand) {
          let row = this.model.active_sheet.rows;
          while (address.row >= row) { row += 8; }
          this.model.active_sheet.cells.EnsureRow(row);
          expanded = true;
        }
        if (address.column >= this.model.active_sheet.columns && this.options.expand) {
          let column = this.model.active_sheet.columns;
          while (address.column >= column) { column += 8; }
          this.model.active_sheet.cells.EnsureColumn(column);
          expanded = true;
        }

        if (expanded) {
          // console.info("expanded!");
          this.layout.UpdateTiles();
          this.layout.UpdateContentsSize();
          this.Repaint(true, true);

          render = true;
        }

        this.Select(selection, new Area({
          row: Math.min(
            Math.max(0, address.row),
            this.model.active_sheet.rows - 1),
          column: Math.min(
            Math.max(0, address.column),
            this.model.active_sheet.columns - 1),
        }));

        // we're calling renderselections early, to avoid jitter when
        // scrolling. FIXME: create a method to just update the given
        // selection, to minimize work here (maybe that's over-optimizing?)

        // at the least, we could flag that we've already done this so
        // it doesn't get called again on the next render

        this.RenderSelections();

        // then scroll.

        this.ScrollIntoView(selection.target);

      }
    }

    if (this.SelectingArgument()) this.UpdateSelectedArgument(selection);

    if (render) {
      this.DelayedRender();
    }

  }

  /** highlight formula dependencies */
  private HighlightDependencies(dependencies: Area[], render = true) {

    // FIXME: cache, in case we parse the same string repeatedly?
    this.ClearAdditionalSelections(); // flush

    // this was causing chaos when I was typing a function, because
    // it was interpreting it as column 32 million. it started as
    // =A5/...
    // and I started typing round before A5, but that was interpreted
    // as ROUNDA5 (which is a lot of columns), and we're not limiting.
    //
    // (I feel like we used to have a sanity check on that -- was that
    // in parser?)
    //
    // nasty bug. so what we do here is limit selections to existing
    // range.

    // FIXME: we should actually limit by max of existing range or
    // displayed range, which may be larger (or is that implicit? ...)

    for (let area of dependencies) {
      if ((area.start.row === Infinity || area.start.row < this.model.active_sheet.rows) &&
        (area.start.column === Infinity || area.start.column < this.model.active_sheet.columns)) {

        // const hide = (!!area.start.sheet_id && area.start.sheet_id !== this.model.active_sheet.id);

        area = this.model.active_sheet.RealArea(area);
        this.AddAdditionalSelection(area.start, area);
      }
    }

    if (render) this.RenderSelections();

  }

  /**
   * add an additional selection to the list. don't add it if already
   * on the list (don't stack).
   *
   * we now support empty selections (hiding) in the case of references
   * to other sheets. if we don't do that, the colors get out of sync.
   */
  private AddAdditionalSelection(target: ICellAddress, area: Area) {
    const label = area.spreadsheet_label;
    if (this.additional_selections.some((test) => {
      return (test.area.spreadsheet_label === label);
    })) return;
    this.additional_selections.push({ target, area });
  }

  /** remove all additonla (argument) selections */
  private ClearAdditionalSelections() {

    // NOTE: at the moment, additional selections are not
    // reflected in headers, so this is unecessary. it might
    // come back, though.

    // this.additional_selections = [];
    // this.additional_selections.length = 0; // legal? IE11?

    this.additional_selections.splice(0, this.additional_selections.length);

  }

  /**
   * utility method, internally calls Select with an undefined area
   */
  private ClearSelection(selection: GridSelection) {
    this.Select(selection);
  }

  private HideGridSelection() {
    this.UpdateAddressLabel(undefined, '');

    const formula = (this.selected_annotation && this.selected_annotation.formula) ?
      this.selected_annotation.formula : '';

    this.UpdateFormulaBarFormula(formula);
    this.layout.ShowSelections(false);
  }

  private ShowGridSelection() {
    this.UpdateAddressLabel();
    this.UpdateFormulaBarFormula();
    this.layout.ShowSelections(true);
  }


  /**
   * updates a selection, and handles marking headers as dirty
   * for subsequent renders (including any old selection).
   *
   * if the selection contains part of a merge area, it will be expanded
   * to include the full merge area (because you can't select part of a merge).
   *
   * @param area selection area
   * @param target optional selection target. if no target is passed and
   * the preseve_target field is not set, target will be set to the first
   * cell of the selection area
   * @param preserve_target preserve existing selection target
   */
  private Select(selection: GridSelection, area?: Area, target?: ICellAddress, preserve_target = false) {

    if (!selection.empty) {
      if (preserve_target) target = selection.target;
    }
    if (area) {

      let real_area = this.model.active_sheet.RealArea(area);
      if (!target) target = real_area.start;

      let recheck = true;

      // there has to be a better way to do this...

      while (recheck) {
        recheck = false;
        this.model.active_sheet.cells.IterateArea(real_area, (cell: Cell) => {
          if (cell.merge_area && !real_area.ContainsArea(cell.merge_area)) {
            area.ConsumeArea(cell.merge_area);
            real_area = this.model.active_sheet.RealArea(area);
            recheck = true;
          }
        });
      }

      selection.area = new Area({ ...area.start, sheet_id: this.model.active_sheet.id }, area.end);
      if (target) selection.target = { ...target, sheet_id: this.model.active_sheet.id };
      selection.empty = false;

    }
    else {
      selection.empty = true;
    }

    // FIXME: this should clone

    if (selection === this.primary_selection) {

      this.layout.MockSelection();

      if (UA.is_edge) { this.Focus(); }

      this.grid_events.Publish({
        type: 'selection',
        selection: this.primary_selection,
      });

      this.UpdateAddressLabel();
      this.UpdateFormulaBarFormula();

    }

  }

  /**
   *
   */
  private UpdateFormulaBarFormula(override?: string) {

    if (!this.formula_bar) { return; }

    if (override) {
      this.formula_bar.formula = override;
      return;
    }

    if (this.primary_selection.empty) {
      this.formula_bar.formula = '';
    }
    else {
      let data = this.model.active_sheet.CellData(this.primary_selection.target);

      // optimally we would do this check prior to this call, but
      // it's the uncommon case... not sure how important that is

      const head = data.merge_area || data.area;
      if (head) {
        if (head.start.column !== this.primary_selection.target.column
          || head.start.row !== this.primary_selection.target.row) {
          data = this.model.active_sheet.CellData(head.start);
        }
      }

      const locked = data.style && data.style.locked;
      this.formula_bar.editable = !locked;
      const value = this.NormalizeCellValue(data);

      // add braces for area
      if (data.area) {
        this.formula_bar.formula = '{' + (value || '') + '}';
      }
      else {
        this.formula_bar.formula = value || '';
      }
    }

  }

  private UpdateAddressLabel(selection = this.primary_selection, text?: string) {

    if (!this.formula_bar) { return; }

    if (typeof text !== 'undefined') {
      this.formula_bar.label = text;
    }
    else if (selection.empty) {
      this.formula_bar.label = '';
    }
    else {

      const data = this.model.active_sheet.CellData(this.primary_selection.target);
      const target = new Area(data.merge_area ? data.merge_area.start : selection.target);

      /*
      if (data.merge_area) {
        this.formula_bar.label = Area.CellAddressToLabel(data.merge_area.start);
      }
      else {
        this.formula_bar.label = Area.CellAddressToLabel(selection.target);
      }
      */

      let label = Area.CellAddressToLabel(target.start);

      for (const entry of this.model.named_ranges.List()) {
        if (entry.range.start.sheet_id === this.model.active_sheet.id && entry.range.Equals(target)) {
          label = entry.name;
          break;
        }
      }

      this.formula_bar.label = label;
    }

  }

  private OnScroll() {
    const tiles = this.layout.VisibleTiles();
    if (!tiles.Equals(this.render_tiles)) {
      this.render_tiles = tiles;
      if (!this.layout_token) {

        // why raf here and not dispatcher?

        this.layout_token = requestAnimationFrame(() => this.Repaint());
      }
    }
  }

  private AttachListeners() {
    if (!this.container) throw new Error('invalid container');

    /*
    this.container.addEventListener('scroll', (event) => {
      const tiles = this.layout.VisibleTiles();
      if (!tiles.Equals(this.render_tiles)) {
        this.render_tiles = tiles;
        if (!this.layout_token) {
          this.layout_token = requestAnimationFrame(() => this.Repaint());
        }
      }
    });
    */

    this.container.addEventListener('copy', this.HandleCopy.bind(this));
    this.container.addEventListener('cut', this.HandleCut.bind(this));
    this.container.addEventListener('paste', this.HandlePaste.bind(this));

    // mouse down events for selection
    this.layout.grid_cover.addEventListener('mousedown', (event) => this.MouseDown_Grid(event));
    this.layout.column_header_cover.addEventListener('mousedown', (event) => this.MouseDown_ColumnHeader(event));
    this.layout.row_header_cover.addEventListener('mousedown', (event) => this.MouseDown_RowHeader(event));

    // move events on headers, to show column/row resize cursors where appropriate
    this.layout.column_header_cover.addEventListener('mousemove', (event) => this.MouseMove_ColumnHeader(event));
    this.layout.row_header_cover.addEventListener('mousemove', (event) => this.MouseMove_RowHeader(event));

    // this is for cursor changes
    this.layout.grid_cover.addEventListener('mousemove', (event) => this.MouseMove_Grid(event));

    // key handler
    this.container.addEventListener('keydown', (event) => this.KeyDown(event));

    // select all?
    this.layout.corner.addEventListener('dblclick', () => {
      this.SelectAll();
    });

  }

  private RangeToTSV(range: any, address: Area) {

    const columns = address.columns;
    const rows = address.rows;

    const data: any = [];
    for (let i = 0; i < columns; i++) data[i] = [];
    const c1 = address.start.column;
    const r1 = address.start.row;
    range.forEach((cell: any) => {
      data[cell.column - c1][cell.row - r1] = cell;
    });

    const tsv = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < columns; c++) {
        let value = '';
        const ref = data[c][r];
        if (ref) {
          if (typeof ref.calculated !== 'undefined') value = ref.calculated;
          else if (typeof ref.value !== 'undefined') value = ref.value;
        }
        row.push(value.toString());
      }
      tsv.push(row.join('\t'));
    }

    return tsv.join('\n');
  }

  private HandleCopy(event: ClipboardEvent) {

    // console.info('handle copy', event, this.primary_selection);

    event.stopPropagation();
    event.preventDefault();

    if (this.primary_selection.empty) {
      if (event.clipboardData) {
        event.clipboardData.clearData();
      }
      if (this.selected_annotation) {
        if (event.clipboardData) {

          const composite = JSON.stringify({
            data: this.selected_annotation,
            source: this.model.active_sheet.id,
          });
          event.clipboardData.setData('text/x-treb-annotation', composite);

          if (this.selected_annotation.node) {
            // this.selected_annotation.node.innerHTML;
            const node = this.selected_annotation.node.firstChild;
            if (node) {
              const html = (SerializeHTML(node as Element) as HTMLElement).outerHTML;

              // no other format supported? (...)
              const type = 'text/plain';
              event.clipboardData.setData(type, html);
              // console.info(html);
            }
          }
        }
      }
    }
    else {

      const area = this.model.active_sheet.RealArea(this.primary_selection.area);
      const columns = area.columns;
      const rows = area.rows;

      const cells = this.model.active_sheet.cells;
      const tsv_data: any[] = [];
      const treb_data: any[] = [];

      // do this in row order, for tsv. we have to transpose one of them.

      for (let row = 0; row < rows; row++) {
        const tsv_row: any[] = [];
        // const treb_row: any[] = [];

        for (let column = 0; column < columns; column++) {
          const address = { row: area.start.row + row, column: area.start.column + column };
          const cell = this.model.active_sheet.CellData(address);

          // NOTE: this now has to account for "text parts", which
          // are returned from the format lib. we need to render them,
          // accounting for a few differences (no expanding, for example,
          // and I guess we should drop hidden characters).

          // now that I think about it, why would we use the formatted value
          // here instead of the calculated value? should use the latter...

          // tsv_row.push(cell.formatted);
          tsv_row.push(typeof cell.calculated === 'undefined' ? cell.value : cell.calculated);
          const data_entry: any = {
            address,
            data: cell.value,
            type: cell.type,
            style: cell.style,
          };
          if (cell.area &&
            cell.area.start.row === address.row &&
            cell.area.start.column === address.column) {
            data_entry.array = {
              rows: cell.area.rows, columns: cell.area.columns
            };
          }
          treb_data.push(JSON.parse(JSON.stringify(data_entry)));
        }
        tsv_data.push(tsv_row);
      }

      const tsv = tsv_data.map((row) => row.join('\t')).join('\n');
      if (event.clipboardData) {
        event.clipboardData.clearData();
        event.clipboardData.setData('text/plain', tsv);
        event.clipboardData.setData('text/x-treb', JSON.stringify({ source: area, data: treb_data }));
      }
    }

  }

  private HandleCut(event: ClipboardEvent) {
    event.stopPropagation();
    event.preventDefault();

    this.HandleCopy(event);

    if (!this.primary_selection.empty) {
      const area = this.model.active_sheet.RealArea(this.primary_selection.area);
      // this.model.sheet.ClearArea(area);
      this.ExecCommand({ key: CommandKey.Clear, area });
    }
    else if (this.selected_annotation) {
      this.RemoveAnnotation(this.selected_annotation);
    }

  }

  private RecyclePasteAreas(source_area: Area, target_area: Area) {

    const paste_areas: Area[] = [];

    if (source_area.count === 1) {
      for (let row = target_area.start.row; row <= target_area.end.row; row++) {
        for (let column = target_area.start.column; column <= target_area.end.column; column++) {
          paste_areas.push(new Area({ row, column }));
        }
      }
    }
    else if (source_area.columns === target_area.columns
      && target_area.rows >= source_area.rows
      && target_area.rows % source_area.rows === 0) {

      for (let row = target_area.start.row; row <= target_area.end.row; row += source_area.rows) {
        paste_areas.push(new Area(
          { row, column: target_area.start.column },
          { row: row + source_area.rows - 1, column: target_area.end.column }));
      }
    }
    else if (source_area.rows === target_area.rows
      && target_area.columns >= source_area.columns
      && target_area.columns % source_area.columns === 0) {

      // console.info('rows match, recycle columns');

      for (let column = target_area.start.column; column <= target_area.end.column; column += source_area.columns) {
        paste_areas.push(new Area(
          { column, row: target_area.start.row },
          { column: column + source_area.columns - 1, row: target_area.end.row }));
      }

    }
    else {
      paste_areas.push(target_area.Clone().Resize(source_area.rows, source_area.columns));
    }

    return paste_areas;
  }

  private HandlePaste(event: ClipboardEvent) {

    // otherwise we capture
    if (this.cell_editor && this.cell_editor.visible) return;

    event.stopPropagation();
    event.preventDefault();

    if (!event.clipboardData) return;

    const annotation_data = event.clipboardData.getData('text/x-treb-annotation');
    if (annotation_data) {
      try {
        const composite = JSON.parse(annotation_data);
        if (composite.source && composite.source !== this.model.active_sheet.id) {
          if (composite.data && composite.data.formula) {
            let name = '';
            for (const sheet of this.model.sheets) {
              if (sheet.id === composite.source) {
                name = sheet.name;
                break;
              }
            }
            if (name) {
              const parse_result = this.parser.Parse(composite.data.formula);
              if (parse_result.expression) {
                this.parser.Walk(parse_result.expression, (unit) => {
                  if (unit.type === 'address') {
                    if (!unit.sheet_id && !unit.sheet) {
                      unit.sheet = name;
                    }
                  }
                  return true;
                });
                composite.data.formula = '=' + this.parser.Render(parse_result.expression);
              }
            }
          }
        }
        const annotation = this.CreateAnnotation(composite.data, true, true);
        if (annotation.node) {
          const node = annotation.node;
          setTimeout(() => {
            node.focus();
          }, 1);
        }
      }
      catch (e) {
        console.error(e);
      }
      return;
    }

    if (this.primary_selection.empty) {
      return;
    }

    const area = this.model.active_sheet.RealArea(this.primary_selection.area);
    const commands: Command[] = [];

    // FIXME: these iterate. that causes lots of events.

    // FIXME: some options for pasting:
    //
    // (1) recycle a single value over an area;
    // (2) recycle a shape over a shape with a similar dimension;
    // (3) expand the selection to match the source data

    const treb_data = event.clipboardData.getData('text/x-treb');
    if (treb_data) {

      try {
        const object_data = JSON.parse(treb_data);
        const source_area = new Area(object_data.source.start, object_data.source.end);

        // recycle...
        const paste_areas = this.RecyclePasteAreas(source_area, area);

        // resize if we're forcing a shape
        if (paste_areas.length === 1) {
          area.Resize(paste_areas[0].rows, paste_areas[0].columns);
        }

        // paste in, offsetting for the paste area. this part loops
        // when recycling, so that the offsets are corrected

        // UPDATE: use commands...

        // keep track of arrays we paste; we don't want to set value
        // on cells that are within those arrays.

        const arrays: Area[] = [];

        // const paste_area = new Area(area.start, area.end);
        for (const paste_area of paste_areas) {

          this.model.active_sheet.cells.EnsureCell(paste_area.end);

          // FIXME: command
          // this.model.sheet.ClearArea(paste_area, true);
          commands.push({ key: CommandKey.Clear, area: paste_area });

          const offsets = {
            rows: paste_area.start.row - source_area.start.row,
            columns: paste_area.start.column - source_area.start.column,
          };

          object_data.data.forEach((cell_info: any) => {
            let data = cell_info.data;

            const target_address = {
              row: cell_info.address.row - source_area.start.row + paste_area.start.row,
              column: cell_info.address.column - source_area.start.column + paste_area.start.column,
            };

            if (cell_info.type === ValueType.formula) {
              const parse_result = this.parser.Parse(data);
              if (parse_result.expression) {
                data = '=' + this.parser.Render(parse_result.expression, offsets, '');
              }
            }

            /*
            const cell = this.model.sheet.cells.GetCell(target_address, true);
            if (cell) {
              cell.Set(data);
              this.model.sheet.UpdateCellStyle(target_address, cell_info.style, false, true);
            }
            */

            if (cell_info.array) {

              const target_array = {
                start: {
                  ...target_address,
                }, end: {
                  row: target_address.row + cell_info.array.rows - 1,
                  column: target_address.column + cell_info.array.columns - 1,
                },
              };

              const command: SetRangeCommand = {
                key: CommandKey.SetRange,
                value: data,
                array: true,
                area: target_array,
              };

              arrays.push(new Area(target_array.start, target_array.end));

              commands.push(command);

            }
            else {

              let skip = false;
              for (const array of arrays) {
                if (array.Contains(target_address)) {
                  skip = true;
                  break;
                }
              }

              if (!skip) {
                commands.push({ key: CommandKey.SetRange, value: data, area: target_address });
              }

            }

            commands.push({ key: CommandKey.UpdateStyle, style: cell_info.style, area: target_address });

          });

        }

      }
      catch (e) {
        console.error('invalid treb data on clipboard');
        console.info(e);
        return;
      }
    }
    else {

      const text_data = event.clipboardData.getData('text/plain');
      if (!text_data) return true;

      const lines = text_data.trim().split('\n');
      const source = lines.map((line) => line.split('\t').map((x) => x.trim()));

      const paste_areas = this.RecyclePasteAreas(
        new Area({ row: 0, column: 0 }, { row: source.length - 1, column: source[0].length - 1 }), area);

      if (paste_areas.length === 1) {
        area.Resize(source.length, source[0].length);
        area.Resize(paste_areas[0].rows, paste_areas[0].columns);
      }

      for (const paste_area of paste_areas) {
        for (let r = 0; r < lines.length; r++) {
          for (let c = 0; c < lines[0].length; c++) {
            const target_area = new Area({ row: r + paste_area.start.row, column: c + paste_area.start.column });
            this.model.active_sheet.cells.EnsureCell(target_area.end);
            if (source[r][c]) {
              const tmp = this.SetInferredType(
                { area: target_area, target: target_area.start, empty: false },
                source[r][c], false, false); // true); // <- shouldn't that be false? ???
              if (tmp) {
                for (const command of tmp) { commands.push(command); }
              }
            }
            else {
              const current = this.model.active_sheet.cells.GetCell(target_area.start, false);
              if (current && current.type !== ValueType.undefined) {
                commands.push({ key: CommandKey.Clear, area: target_area.Clone() });
              }
            }
          }
        }
      }

      // console.info(commands);
      // this.Select(this.primary_selection, area);
    }

    this.ExecCommand(commands);
    this.Select(this.primary_selection, area);

    /*
    this.grid_events.Publish({
      type: 'data', area,
    });
    */

  }

  /**
   * utility method returns all selections (primary, active and any additional
   * selections) as an array. defaults to non-empty selections only, but
   * can optionally returns empty non-null selections.
   */
  private AllSelections(include_empty_selections = false) {
    const selections = [this.primary_selection, this.active_selection].concat(this.additional_selections);
    if (include_empty_selections) return selections;
    return selections.filter((selection) => !selection.empty);
  }

  private FreezeInternal(command: FreezeCommand) {

    // default true
    const highlight = ((typeof command.highlight_transition) === 'boolean')
      ? command.highlight_transition
      : true;

    //    if (command.rows === this.layout.freeze.rows &&
    //      command.columns === this.layout.freeze.columns) {
    if (command.rows === this.model.active_sheet.freeze.rows &&
      command.columns === this.model.active_sheet.freeze.columns) {
      if (highlight) {
        this.HighlightFreezeArea();
      }
      return;
    }

    // this.layout.freeze.rows = command.rows;
    // this.layout.freeze.columns = command.columns;
    this.model.active_sheet.freeze.rows = command.rows;
    this.model.active_sheet.freeze.columns = command.columns;

    // FIXME: should we do this via events? (...)

    // we are sending an event via the exec command method that calls
    // this method, so we are not relying on the side-effect event anymore

    this.QueueLayoutUpdate();
    this.Repaint();

    if (highlight) {
      this.HighlightFreezeArea();
    }

  }

  /**
   * rename a sheet. this requires changing any formulae that refer to the
   * old name to refer to the new name. if there are any references by ID
   * those don't have to change.
   *
   * FIXME: can we do this using the dependency graph? (...)
   */
  private RenameSheetInternal(target: Sheet, name: string) {

    // validate name... ?

    if (!name || IllegalSheetNameRegex.test(name)) {
      throw new Error('invalid sheet name');
    }

    // also can't have two sheets with the same name

    const compare = name.toLowerCase();
    for (const sheet of this.model.sheets) {
      if (sheet !== target && sheet.name.toLowerCase() === compare) {
        throw new Error('sheet name already exists');
      }
    }

    const old_name = target.name.toLowerCase();
    target.name = name;
    for (const sheet of this.model.sheets) {

      // cells
      sheet.cells.IterateAll((cell: Cell) => {
        if (cell.type === ValueType.formula) {
          let modified = false;
          const parsed = this.parser.Parse(cell.value || '');
          if (parsed.expression) {
            this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
              if (element.type === 'address') {
                if (element.sheet && element.sheet.toLowerCase() === old_name) {
                  element.sheet = name;
                  modified = true;
                }
              }
              return true; // continue walk
            });
            if (modified) {
              cell.value = '=' + this.parser.Render(parsed.expression);
            }
          }
        }
      });

      // annotations
      for (const annotation of sheet.annotations) {
        if (annotation.formula) {
          let modified = false;
          const parsed = this.parser.Parse(annotation.formula || '');
          if (parsed.expression) {
            this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
              if (element.type === 'address') {
                if (element.sheet && element.sheet.toLowerCase() === old_name) {
                  element.sheet = name;
                  modified = true;
                }
              }
              return true; // continue walk
            });
            if (modified) {
              annotation.formula = '=' + this.parser.Render(parsed.expression);
            }
          }
        }
      }
    }

  }

  /**
   * FIXME: should be API method
   * FIXME: need to handle annotations that are address-based
   *
   * @see InsertColumns for inline comments
   */
  private InsertRowsInternal(command: InsertRowsCommand) { // before_row = 0, count = 1) {

    this.model.active_sheet.InsertRows(command.before_row, command.count);
    this.model.named_ranges.PatchNamedRanges(0, 0, command.before_row, command.count);

    // snip

    this.model.active_sheet.cells.IterateAll((cell: Cell) => {
      let modified = false;
      if (cell.type === ValueType.formula) {
        const parsed = this.parser.Parse(cell.value || '');
        if (parsed.expression) {
          this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
            if (element.type === 'address') {
              if (element.row >= command.before_row) {
                if (command.count < 0 && element.row + command.count < command.before_row) {
                  element.column = element.row = -1;
                }
                else {
                  element.row += command.count;
                }
                modified = true;
              }
            }
            return true; // continue
          });
          if (modified) {
            cell.value = '=' + this.parser.Render(parsed.expression);
          }
        }
      }
    });

    for (const annotation of this.model.active_sheet.annotations) {
      if (annotation.formula) {
        let modified = false;
        const parsed = this.parser.Parse(annotation.formula || '');
        if (parsed.expression) {
          this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
            if (element.type === 'address') {
              if (element.row >= command.before_row) {
                if (command.count < 0 && element.row + command.count < command.before_row) {
                  element.column = element.row = -1;
                }
                else {
                  element.row += command.count;
                }
                modified = true;
              }
            }
            return true; // continue
          });
          if (modified) {
            annotation.formula = '=' + this.parser.Render(parsed.expression);
          }
        }
      }
    }

    // fix selections

    if (command.count < 0) {
      for (const selection of this.AllSelections()) {
        selection.empty = true; // lazy
      }
    }
    else {
      for (const selection of this.AllSelections()) {
        if (selection.target.row >= command.before_row) {
          selection.target.row += command.count;
        }
        if (!selection.area.entire_column) {
          if (selection.area.start.row >= command.before_row) {
            selection.area.Shift(command.count, 0);
          }
          else if (selection.area.end.row >= command.before_row) {
            selection.area.ConsumeAddress({
              row: selection.area.end.row + command.count,
              column: selection.area.end.column,
            }); // expand
          }
        }
      }
    }

    // force update

    // note event is sent in exec command, not implicit here

    this.QueueLayoutUpdate();

    // we need to repaint (not render) because repaint adjusts the selection
    // canvas for tile layout. FIXME: move that out of repaint so we can call
    // it directly.

    this.Repaint();

    // FIXME: this should move to the _actual_ layout update, so we have
    // current data. (...)

  }

  /**
   * FIXME: should be API method
   * FIXME: need to handle annotations that are address-based
   */
  private InsertColumnsInternal(command: InsertColumnsCommand) { // before_column = 0, count = 1) {

    this.model.active_sheet.InsertColumns(command.before_column, command.count);
    this.model.named_ranges.PatchNamedRanges(command.before_column, command.count, 0, 0);

    // snip

    this.model.active_sheet.cells.IterateAll((cell: Cell) => {
      let modified = false;
      if (cell.type === ValueType.formula) {
        const parsed = this.parser.Parse(cell.value || '');
        if (parsed.expression) {
          this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
            if (element.type === 'address') {
              if (element.column >= command.before_column) {
                if (command.count < 0 && element.column + command.count < command.before_column) {
                  element.column = element.row = -1;
                }
                else {
                  element.column += command.count;
                }
                modified = true;
              }
            }
            return true; // continue
          });
          if (modified) {
            cell.value = '=' + this.parser.Render(parsed.expression);
          }
        }
      }
    });

    for (const annotation of this.model.active_sheet.annotations) {
      if (annotation.formula) {
        let modified = false;
        const parsed = this.parser.Parse(annotation.formula);
        if (parsed.expression) {
          this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
            if (element.type === 'address') {
              if (element.column >= command.before_column) {
                if (command.count < 0 && element.column + command.count < command.before_column) {
                  element.column = element.row = -1;
                }
                else {
                  element.column += command.count;
                }
                modified = true;
              }
            }
            return true; // continue
          });
          if (modified) {
            annotation.formula = '=' + this.parser.Render(parsed.expression);
          }
        }
      }
    }

    // fix selection(s)

    if (command.count < 0) {
      for (const selection of this.AllSelections()) {
        selection.empty = true; // lazy
      }
    }
    else {
      for (const selection of this.AllSelections()) {
        if (selection.target.column >= command.before_column) {
          selection.target.column += command.count;
        }
        if (!selection.area.entire_row) {
          if (selection.area.start.column >= command.before_column) {
            selection.area.Shift(0, command.count);
          }
          else if (selection.area.end.column >= command.before_column) {
            selection.area.ConsumeAddress({
              row: selection.area.end.row,
              column: selection.area.end.column + command.count,
            }); // expand
          }
        }
      }
    }

    // note event is sent in exec command, not implicit here

    this.QueueLayoutUpdate();

    // @see InsertColumnsInternal re: why repaint

    this.Repaint();

  }


  /**
   * these are all addative except for "none", which removes all borders.
   *
   * we no longer put borders into two cells at once (hurrah!). however
   * we still need to do some maintenance on the mirror cells -- because
   * if you apply a border to cell A1, then that should take precedence
   * over any border previously applied to cell A2.
   *
   * FIXME: is that right? perhaps we should just leave whatever the user
   * did -- with the exception of clearing, which should always mirror.
   *
   *
   * UPDATE: modifying function for use with ExecCommand. runs the style
   * updates and returns the affected area.
   *
   */
  private ApplyBordersInternal(command: UpdateBordersCommand) {

    const borders = command.borders;
    const width = (command.borders === BorderConstants.None)
      ? 0 : command.width;

    const area = new Area(command.area.start, command.area.end);

    const top: Style.Properties = { border_top: width };
    const bottom: Style.Properties = { border_bottom: width };
    const left: Style.Properties = { border_left: width };
    const right: Style.Properties = { border_right: width };

    const clear_top: Style.Properties = { border_top: 0 };
    const clear_bottom: Style.Properties = { border_bottom: 0 };
    const clear_left: Style.Properties = { border_left: 0 };
    const clear_right: Style.Properties = { border_right: 0 };

    if (typeof command.color !== 'undefined') {
      top.border_top_color =
        bottom.border_bottom_color =
        left.border_left_color =
        right.border_right_color = command.color;
    }

    // inside all/none
    if (borders === BorderConstants.None || borders === BorderConstants.All) {
      this.model.active_sheet.UpdateAreaStyle(area, {
        ...top, ...bottom, ...left, ...right,
      }, true, false, true);
    }

    // top
    if (borders === BorderConstants.Top || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        this.model.active_sheet.UpdateAreaStyle(area.top, { ...top }, true, false, true);
      }
    }

    // mirror top (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Top) {
      if (!area.entire_column) {
        if (area.start.row) {
          this.model.active_sheet.UpdateAreaStyle(new Area(
            { row: area.start.row - 1, column: area.start.column },
            { row: area.start.row - 1, column: area.end.column }), { ...clear_bottom }, true, false, true);
        }
      }
    }

    // bottom
    if (borders === BorderConstants.Bottom || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        this.model.active_sheet.UpdateAreaStyle(area.bottom, { ...bottom }, true, false, true);
      }
    }

    // mirror bottom (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Bottom) {
      if (!area.entire_column) {
        this.model.active_sheet.UpdateAreaStyle(new Area(
          { row: area.end.row + 1, column: area.start.column },
          { row: area.end.row + 1, column: area.end.column }), { ...clear_top }, true, false, true);
      }
    }

    // left
    if (borders === BorderConstants.Left || borders === BorderConstants.Outside) {
      if (!area.entire_row) {
        this.model.active_sheet.UpdateAreaStyle(area.left, { ...left }, true, false, true);
      }
    }

    // mirror left (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Left) {
      if (!area.entire_row) {
        if (area.start.column) {
          this.model.active_sheet.UpdateAreaStyle(new Area(
            { row: area.start.row, column: area.start.column - 1 },
            { row: area.end.row, column: area.start.column - 1 }), { ...clear_right }, true, false, true);
        }
      }
    }

    // right
    if (borders === BorderConstants.Right || borders === BorderConstants.Outside) {
      if (!area.entire_row) {
        this.model.active_sheet.UpdateAreaStyle(area.right, { ...right }, true, false, true);
      }
    }

    // mirror right (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Right) {
      if (!area.entire_row) {
        this.model.active_sheet.UpdateAreaStyle(new Area(
          { row: area.start.row, column: area.end.column + 1 },
          { row: area.end.row, column: area.end.column + 1 }), { ...clear_left }, true, false, true);
      }
    }

    /*
    // why is there not an expand method on area? (FIXME)

    this.DelayedRender(false, new Area({
      row: Math.max(0, area.start.row - 1),
      column: Math.max(0, area.start.column - 1),
    }, {
      row: area.end.row + 1,
      column: area.end.column + 1,
    }));

    // NOTE: we don't have to route through the sheet. we are the only client
    // (we republish). we can just publish directly.

    this.grid_events.Publish({ type: 'style', area });
    */

    return new Area(
      {
        row: Math.max(0, area.start.row - 1),
        column: Math.max(0, area.start.column - 1),
      }, {
      row: area.end.row + 1,
      column: area.end.column + 1,
    },
    );

  }

  /**
   * set range, via command. returns affected area.
   */
  private SetRangeInternal(command: SetRangeCommand) {
   
    const area = IsCellAddress(command.area)
      ? new Area(command.area)
      : new Area(command.area.start, command.area.end);

    let sheet = this.model.active_sheet;
    if (area.start.sheet_id && area.start.sheet_id !== this.model.active_sheet.id) {
      for (const compare of this.model.sheets) {
        if (compare.id === area.start.sheet_id) {
          sheet = compare;
          break;
        }
      }
    }

    if (!area.entire_row && !area.entire_column && (
      area.end.row >= sheet.rows
      || area.end.column >= sheet.columns)) {

      // we have to call this because the 'set area' method calls RealArea
      sheet.cells.EnsureCell(area.end);

      // should we send a structure event here? we may be increasing the
      // size, in which case we should send the event. even though no addresses
      // change, there are new cells.

      this.QueueLayoutUpdate();

    }

    // originall we called sheet methods here, but all the sheet
    // does is call methods on the cells object -- we can shortcut.

    // is that a good idea? (...)

    // at a minimum we can consolidate...

    if (IsCellAddress(command.area)) {

      // FIXME: should throw if we try to set part of an array

      const cell = sheet.CellData(command.area);
      if (cell.area && (cell.area.rows > 1 || cell.area.columns > 1)) {
        throw new Error('can\'t change part of an array');
      }

      // single cell

      sheet.SetCellValue(command.area, command.value);
      return area;
    }
    else {

      // there are a couple of options here, from the methods that
      // have accumulated in Sheet.

      // SetArrayValue -- set data as an array
      // SetAreaValues -- set values from data one-to-one
      // SetAreaValue -- single value repeated in range

      // FIXME: clean this up!

      if (command.array) {
        sheet.SetArrayValue(area, command.value);
      }
      else {
        sheet.SetAreaValues2(area, command.value);
      }
      /*
      else if (!Array.isArray(command.value) && !ArrayBuffer.isView(command.value)) {
        this.model.sheet.SetAreaValue(area, command.value);
      }
      else {
        this.model.sheet.SetAreaValues(area, command.value as any[][]);
      }
      */

      return area;

    }

  }

  private ClearAreaInternal(area: Area) {

    area = this.model.active_sheet.RealArea(area); // collapse

    this.model.active_sheet.cells.IterateArea(area, (cell) => {
      if (cell.area && !area.ContainsArea(cell.area)) {
        throw new Error('can\'t change part of an array');
      }
    });

    this.model.active_sheet.ClearArea(area, true);

  }

  //////////////////////////////////////////////////////////////////////////////

  /**
   * pass all data/style/structure operations through a command mechanism.
   * this method should optimally act as a dispatcher, so try to minimize
   * inline code in favor of method calls.
   *
   * [NOTE: don't go crazy with that, some simple operations can be inlined]
   *
   */
  private ExecCommand(commands: Command | Command[]) {

    // FIXME: support ephemeral commands (...)

    let render_area: Area | undefined;
    let data_area: Area | undefined;
    let style_area: Area | undefined;
    let structure_event = false;
    let structure_rebuild_required = false;

    const events: GridEvent[] = [];

    // this seems like the dumb way to do this... maybe?
    if (!Array.isArray(commands)) commands = [commands];

    // gate on subscribers? (...)
    this.command_log.Publish({ command: commands, timestamp: new Date().getTime() });

    for (const command of commands) {

      // console.log(CommandKey[command.key], JSON.stringify(command));

      switch (command.key) {
        case CommandKey.Clear:
          if (command.area) {
            const area = new Area(command.area.start, command.area.end);
            // this.model.active_sheet.ClearArea(area, true);
            this.ClearAreaInternal(area);
            data_area = Area.Join(area, data_area);
            this.UpdateFormulaBarFormula();
          }
          else {
            Sheet.Reset();
            this.RemoveAnnotationNodes();
            this.UpdateSheets([], true);
            this.model.named_ranges.Reset();
            this.model.macro_functions = {};
            this.ClearSelection(this.primary_selection);
            this.ScrollIntoView({ row: 0, column: 0 });
            this.QueueLayoutUpdate(); // necessary? (...)
            this.layout.HideNote();
          }
          break;

        case CommandKey.Select:
          // ...
          break;

        case CommandKey.Freeze:
          this.FreezeInternal(command);

          // is the event necessary here? not sure. we were sending it as a
          // side effect, so it was added here in case there was some reason
          // it was necessary. at a minimum, it should not require a rebuild
          // because no addresses change. (although we leave it in case someone
          // else sets it).)

          structure_event = true;
          // structure_rebuild_required = true;

          break;

        case CommandKey.MergeCells:
          this.model.active_sheet.MergeCells(
            new Area(command.area.start, command.area.end));

          render_area = Area.Join(command.area, render_area);

          // FIXME: sheet publishes a data event here, too. probably a good
          // idea because references to the secondary (non-head) merge cells
          // will break.

          structure_event = true;
          structure_rebuild_required = true;
          data_area = Area.Join(command.area, data_area);
          break;

        case CommandKey.UnmergeCells:
          {
            // the sheet unmerge routine requires a single, contiguous merge area.
            // we want to support multiple unmerges at the same time, though,
            // so let's check for multiple. create a list.

            const list: { [index: string]: Area } = {};
            const area = new Area(command.area.start, command.area.end);

            this.model.active_sheet.cells.IterateArea(area, (cell: Cell) => {
              if (cell.merge_area) {
                const label = Area.CellAddressToLabel(cell.merge_area.start) + ':'
                  + Area.CellAddressToLabel(cell.merge_area.end);
                list[label] = cell.merge_area;
              }
            }, false);

            const keys = Object.keys(list);

            // suppress events until the last one

            for (let i = 0; i < keys.length; i++) {
              this.model.active_sheet.UnmergeCells(list[keys[i]], i !== keys.length - 1);
            }

            // see above

            render_area = Area.Join(command.area, render_area);
            data_area = Area.Join(command.area, data_area);
            structure_event = true;
            structure_rebuild_required = true;
          }
          break;

        case CommandKey.UpdateStyle:
          if (IsCellAddress(command.area)) {
            const area = new Area(command.area);
            this.model.active_sheet.UpdateCellStyle(command.area, command.style, !!command.delta, true);
            // events.push({type: 'style', area});
            style_area = Area.Join(area, style_area);
            render_area = Area.Join(area, render_area);
          }
          else {
            const area = new Area(command.area.start, command.area.end);
            this.model.active_sheet.UpdateAreaStyle(area, command.style, !!command.delta, false, true);
            // events.push({type: 'style', area});
            style_area = Area.Join(area, style_area);
            render_area = Area.Join(area, render_area);
          }
          break;

        case CommandKey.SetName:
          if (command.area) {
            this.model.named_ranges.SetName(command.name,
              new Area(command.area.start, command.area.end));
          }
          else {
            this.model.named_ranges.ClearName(command.name);
          }
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.UpdateBorders:
          {
            const area = this.ApplyBordersInternal(command);
            render_area = Area.Join(area, render_area);
            style_area = Area.Join(area, style_area);
          }
          break;

        case CommandKey.ShowSheet:
          this.ShowSheetInternal(command);
          structure_event = true;
          break;

        case CommandKey.ReorderSheet:
          {
            const sheets: Sheet[] = [];
            const target = this.model.sheets[command.index];

            for (let i = 0; i < this.model.sheets.length; i++) {
              if (i !== command.index) {
                if (i === command.move_before) {
                  sheets.push(target);
                }
                sheets.push(this.model.sheets[i]);
              }
            }

            if (command.move_before >= this.model.sheets.length) {
              sheets.push(target);
            }

            this.model.sheets = sheets;
            if (this.tab_bar) { this.tab_bar.Update(); }
            structure_event = true;

          }
          break;

        case CommandKey.RenameSheet:
          {
            const sheet = this.ResolveSheet(command);
            if (sheet) {
              this.RenameSheetInternal(sheet, command.new_name);
              if (this.tab_bar) { this.tab_bar.Update(); }
              structure_event = true;
            }
          }
          break;

        case CommandKey.ResizeRows:
          {
            let row = command.row;
            if (typeof row === 'undefined') {
              row = [];
              for (let i = 0; i < this.model.active_sheet.rows; i++) row.push(i);
            }

            if (typeof row === 'number') row = [row];
            if (typeof command.height === 'number') {
              for (const entry of row) {
                this.model.active_sheet.SetRowHeight(entry, command.height);
              }
            }
            else {
              for (const entry of row) {
                this.model.active_sheet.AutoSizeRow(entry, true);
              }
            }

            /*
            const area = new Area(
              { column: Infinity, row: row[0] },
              { column: Infinity, row: row[row.length - 1] });
            */

            if (this.layout.container
              && this.layout.container.offsetHeight
              && this.layout.container.offsetHeight > this.model.active_sheet.total_height) {
              this.UpdateLayout();
            }
            else {
              this.layout.UpdateTileHeights(true);
              this.render_tiles = this.layout.VisibleTiles();
              this.Repaint(false, true); // repaint full tiles
            }

            this.layout.UpdateAnnotation(this.model.active_sheet.annotations);
            structure_event = true;
            this.RenderSelections();

          }
          break;

        case CommandKey.ResizeColumns:
          {
            let column = command.column;

            if (typeof column === 'undefined') {
              column = [];
              for (let i = 0; i < this.model.active_sheet.columns; i++) column.push(i);
            }

            if (typeof column === 'number') column = [column];

            if (typeof command.width === 'number') {
              for (const entry of column) {
                this.model.active_sheet.SetColumnWidth(entry, command.width);
              }
            }
            else {
              for (const entry of column) {
                this.model.active_sheet.AutoSizeColumn(entry, false, true);
              }
            }

            /*
             why are we not tracking this? is it because one of the subsequent
             calls fires its own event? (...) if so, why are we setting the
             structure_event flag? (...)
  
            const area = new Area(
              {row: Infinity, column: column[0]},
              {row: Infinity, column: column[column.length - 1]});
  
            */

            if (this.layout.container
              && this.layout.container.offsetWidth
              && this.layout.container.offsetWidth > this.model.active_sheet.total_width) {
              this.UpdateLayout();
            }
            else {
              this.layout.UpdateTileWidths(true);
              this.render_tiles = this.layout.VisibleTiles();
              this.Repaint(false, true); // repaint full tiles
            }

            this.layout.UpdateAnnotation(this.model.active_sheet.annotations);
            structure_event = true;
            this.RenderSelections();

          }
          break;

        case CommandKey.ShowHeaders:

          // FIXME: now that we don't support 2-level headers (or anything
          // other than 1-level headers), headers should be managed by/move into
          // the grid class.

          this.model.active_sheet.SetHeaderSize(command.show ? undefined : 1, command.show ? undefined : 1);
          this.QueueLayoutUpdate();
          this.Repaint();
          break;

        case CommandKey.InsertRows:
          this.InsertRowsInternal(command);
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.InsertColumns:
          this.InsertColumnsInternal(command);
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.SetNote:
          {
            const cell = this.cells.GetCell(command.address, true);
            if (cell) {
              const area = new Area(command.address);

              cell.SetNote(command.note);
              this.DelayedRender(false, area);

              // treat this as style, because it affects painting but
              // does not require calculation.

              style_area = Area.Join(area, style_area);
              render_area = Area.Join(area, render_area);

            }
          }
          break;

        case CommandKey.SetRange:
          {
            const area = this.SetRangeInternal(command);
            data_area = Area.Join(area, data_area);

            // normally we don't paint, we wait for the calculator to resolve

            if (this.options.repaint_on_cell_change) {
              render_area = Area.Join(area, render_area);
            }

          }
          break;

        case CommandKey.DeleteSheet:
          this.DeleteSheetInternal(command);
          structure_event = true;
          break;

        case CommandKey.AddSheet:
          // const sheet_id = this.AddSheetInternal(undefined, command.insert_index); // default name
          this.ActivateSheetInternal({
            key: CommandKey.ActivateSheet,
            id: this.AddSheetInternal(undefined, command.insert_index), // default name
          });
          structure_event = true;
          break;

        case CommandKey.ActivateSheet:
          this.ActivateSheetInternal(command);
          break;

        default:
          console.warn(`unhandled command: ${CommandKey[command.key]} (${command.key})`);
      }
    }

    // consolidate events and merge areas

    if (data_area) {
      data_area.SetSheetID(this.model.active_sheet.id);
      events.push({ type: 'data', area: data_area });
    }

    if (style_area) {
      style_area.SetSheetID(this.model.active_sheet.id);
      events.push({ type: 'style', area: style_area });
    }

    if (structure_event) {
      events.push({
        type: 'structure',
        rebuild_required: structure_rebuild_required,
      });
    }

    this.grid_events.Publish(events);

    if (render_area) {
      this.DelayedRender(false, render_area);
    }

  }


}
