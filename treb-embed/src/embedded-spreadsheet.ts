/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

// --- imports -----------------------------------------------------------------

import type {
  GridEvent, 
  SheetChangeEvent, GridOptions, 
  CellEvent, FunctionDescriptor, 
  ExternalEditorConfig,
} from 'treb-grid';

import { DataModel, Sheet, StandardGradientsList } from 'treb-data-model';
import type { 
    SerializeOptions, 
    Annotation,
    AnnotationViewData,
    AnnotationType, 
    MacroFunction, 
    GridSelection, 
    ConnectedElementType, 
    SerializedModel, 
    SerializedSheet, 
    FreezePane,
    ConditionalFormatDuplicateValuesOptions,
    ConditionalFormatGradientOptions,
    ConditionalFormat, 
    ConditionalFormatGradient, 
    ConditionalFormatExpression,
    StandardGradient,
    CondifionalFormatExpressionOptions,
    ConditionalFormatCellMatchOptions,
    ConditionalFormatCellMatch,
  
   } from 'treb-data-model';


import {
  Grid, BorderConstants, ErrorCode, UA,
} from 'treb-grid';

import { 
  Parser, DecimalMarkType, 
  ArgumentSeparatorType, QuotedSheetNameRegex } from 'treb-parser';

import { Calculator } from 'treb-calculator';

import type {
  ICellAddress, 
  EvaluateOptions,
  IArea, CellValue, Point,
  Complex, ExtendedUnion, IRectangle,
  AddressReference, RangeReference, TableSortOptions, Table, TableTheme,
} from 'treb-base-types';

import {
  IsArea, ThemeColorTable, ComplexToString, Rectangle, IsComplex, type CellStyle,
  Localization, Style, type Color, ResolveThemeColor, IsCellAddress, Area, IsFlatData, IsFlatDataArray, Gradient, DOMContext 
} from 'treb-base-types';

import { EventSource, ValidateURI } from 'treb-utils';
import { NumberFormatCache, ValueParser, NumberFormat, LotusDate, UnlotusDate } from 'treb-format';



// --- local -------------------------------------------------------------------

import { Dialog, DialogType } from './progress-dialog';
import { Spinner } from './spinner';
import { type EmbeddedSpreadsheetOptions, DefaultOptions, type ExportOptions } from './options';
import { type TREBDocument, SaveFileType, LoadSource, type EmbeddedSheetEvent, type InsertTableOptions } from './types';

import type { LanguageModel, TranslatedFunctionDescriptor } from './language-model';
import type { SelectionState } from './selection-state';
import type { BorderToolbarMessage, ToolbarMessage } from './toolbar-message';

import { Chart, ChartFunctions } from 'treb-charts';
import type { SetRangeOptions } from 'treb-grid';

import type { StateLeafVertex } from 'treb-calculator';


// --- worker ------------------------------------------------------------------

/**
 * import type for our worker, plus markup files
 */
import './content-types.d.ts';

/**
 * import the worker as a script file. tsc will read this on typecheck but 
 * that's actually to the good; when we build with esbuild we will inline
 * the script so we can run it as a worker.
 */
import * as export_worker_script from 'worker:../../treb-export/src/export-worker/index.worker';

// --- types -------------------------------------------------------------------

/**
 * this is a structure for copy/paste data. clipboard data may include 
 * relative formauls and resolved styles, so it's suitable for pasting into 
 * other areas of the spreadsheet.
 * 
 * @privateRemarks
 * work in progress. atm we're not using the system clipboard, although it 
 * might be useful to merge this with grid copy/paste routines in the future.
 * 
 * if it hits the clipboard this should use mime type `application/x-treb-data`
 * 
 */
export interface ClipboardDataElement {

  /** calculated cell value */
  calculated: CellValue,

  /** the actual cell value or formula */
  value: CellValue,

  /** cell style. this may include row/column styles from the copy source */
  style?: CellStyle,

}

/** clipboard data is a 2d array */
export type ClipboardData = ClipboardDataElement[][];

/** 
 * optional paste options. we can paste formulas or values, and we 
 * can use the source style, target style, or just use the source
 * number formats.
 */
export interface PasteOptions {

  /**
   * when clipboard data includes formulas, optionally paste calculated
   * values instead of the original formulas. defaults to false.
   */
  values?: boolean;

  /** 
   * when pasting data from the clipboard, we can copy formatting/style 
   * from the original data, or we can retain the target range formatting
   * and just paste data. a third option allows pasting source number 
   * formats but dropping other style information.
   * 
   * defaults to "source", meaning paste source styles.
   */

  formatting?: 'source'|'target'|'number-formats'

}

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

enum FileChooserOperation {
  None, LoadFile, InsertImage, 
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
   * @deprecated
   */
  formatted?: boolean;

  /** 
   * return formulas instead of values. formula takes precedence over
   * "formatted"; if you pass both, returned values will *not* be formatted.
   * @deprecated
   *
   * @privateRemarks
   * 
   * FIXME: that should throw?
   */
  formula?: boolean;

  /**
   * by default, GetRange returns cell values. the optional type field 
   * can be used to returns data in different formats.
   * 
   * @remarks
   * 
   * `formatted` returns formatted values, applying number formatting and
   * returning strings.
   * 
   * `A1` returns cell formulas instead of values, in A1 format.
   * 
   * `R1C1` returns cell formauls in R1C1 format.
   * 
   * `formula` is an alias for 'A1', for backwards compatibility.
   * 
   */
  type?: 'formatted'|'A1'|'R1C1'|'formula';

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

/**
 * function type used for filtering tables
 */
export type TableFilterFunction = (value: CellValue, calculated_value: CellValue, style: CellStyle) => boolean;

/**
 * embedded spreadsheet
 */
export class EmbeddedSpreadsheet<USER_DATA_TYPE = unknown> { 

  /** @internal */
  public static treb_base_path = '';

  /* * @internal */
  // public static export_worker_text = '';  

  /** @internal */
  public static treb_embedded_script_path = '';

  /* * @internal */
  // public static enable_engine = false;

  /* * @internal */
  // public static enable_formatter = false;

  /** @internal */
  public static one_time_warnings: Record<string, boolean> = {};

  /** @internal */
  protected static clipboard?: ClipboardData;

  protected DOM = DOMContext.GetInstance(); // default

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

  /* *
   * @internal
   */
  // public toolbar_ctl?: ToolbarCtl;

  /**
   * this is a cache of number formats and colors used in the document. it's
   * intended for an external toolbar.
   * 
   * FIXME: should we preferentially use Color objects? (...)
   * 
   * @internal
   */
  public document_styles: {
    number_formats: string[], 
    colors: string[],
    theme_colors: Array<{ color: Color, resolved: string, }>[] // FIXME: type
  } = {
    number_formats: [], colors: [], theme_colors: [],
  };

  /**
   * this is a representation of selection state for an external toolbar.
   * we also use it to manage state changes. this used to be internal only,
   * now we are exposing it. we might want to only expose a copy via an
   * accessor, but for now we'll just expose the actual object.
   * 
   * not sure why this was ever optional, we should just have an empty default
   * 
   * @internal
   */
  public selection_state: SelectionState = {};

  /**
   * this is our options object, EmbeddedSpreadsheetOptions but we 
   * narrow the storage key type to a string|undefined (can be boolean 
   * in the input).
   * 
   * @internal
   */
  public options: EmbeddedSpreadsheetOptions & { local_storage: string|undefined };

  /**
   * @internal
   * 
   * this is not public (in the API, at least), for the moment, but 
   * it is accessible. not sure which way we're going to go with this.
   */
  public get Localization(): Localization {
    return Localization;
  }

  /** loaded language model, if any */
  protected language_model?: LanguageModel;

  /** FIXME: fix type (needs to be extensible) */
  protected events = new EventSource<{ type: string }>();

  /** 
   * automatic/manual 
   * why is this protected? is there some reason we don't want people to use it?
   */
  protected calculation = CalculationOptions.automatic;

  /**
   * this might be something that should travel with the document,
   * as a way to compare different versions... something to think
   * about. we could certainly preserve/restore it on save/load.
   * 
   * UPDATE: we're now storing this with the document, as "revision".
   * for the future we should be able to use this as the basis for
   * dirty flags in various applications.
   */
  protected file_version = 0;

  /** 
   * this is recordkeeping for "dirty" marking, which also supports
   * undo. if we preserve the file version this will have to track.
   */
  protected last_save_version = 0;

  /* *
   * this is an attempt to improve our recordkeeping for stuff that
   * has user-generated changes. it means "this is the version that
   * was in the network document or inline document".  it has no 
   * meaning in sheets that start empty.
   * 
   * we use "network version" to mean both network documents and inline
   * documents (Which technically come from the network).
   * 
   * the problem with this is that the only way for it to work would
   * be to store it in the document, but once we start storing this 
   * value it will get stuck and cause problems. there's no way to
   * "only store it in some contexts". I guess in theory we could wipe
   * it if necesssary, but that's weak... something like 
   * 
   * (1) if this document comes from anywhere but local storage, 
   *     dump the value
   * 
   * (2) never save this value unless you're writing to local storage
   * 
   * it's still going to get stuck in places it shouldn't be but we can
   * mitigate problems with it. I'll think about it. we can do the 
   * "can revert" thing in a different way.
   * 
   * /
  protected canonical_network_version = 0;
  */

  /**
   * simpler flag for testing if we can revert
   */
  protected initial_load_source: LoadSource|undefined = undefined;

  /**
   * calculator instance. we may share this if we're in a split view.
   */
  protected calculator: Calculator;

  /**
   */
  protected grid: Grid;

  /**
   * model moved from grid. we control it now. grid still maintains
   * its own view, including active sheet.
   */
  protected model: DataModel;

  /**
   * dialog is assigned in the constructor, only if there's a containing
   * element (i.e. not when we're just using the engine)
   */
  protected dialog?: Dialog;

  /** new spinner */
  protected spinner?: Spinner;

  /** file chooser */
  protected file_chooser?: HTMLInputElement;

  /** file chooser operation */
  protected file_chooser_operation = FileChooserOperation.None;

  // protected toolbar?: Toolbar;

  /* * caching selection state so we can refer to it if we need it */
  // protected selection_state?: SelectionState;

  /** localized parser instance. we're sharing. */
  protected get parser(): Parser {
    return this.model.parser;
  }

  /** for destruction */
  protected view_node?: HTMLElement;

  /** for destruction */
  protected key_listener?: (event: KeyboardEvent) => void;

  // protected views: EmbeddedSpreadsheetBase[] = [];
  protected views: Array<{
    view: EmbeddedSpreadsheet;
    subscription?: number;
  }> = [];

  /** focus target if we have multiple views */
  protected focus_target: EmbeddedSpreadsheet = this;

  /** parent, if we are a split view child */
  protected parent_view?: EmbeddedSpreadsheet;

  /**
   * export worker (no longer using worker-loader).
   * export worker is loaded on demand, not by default.
   */
  protected export_worker?: Worker;

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
   * convenience function returns the name of the active sheet. if the 
   * sheet name has spaces or other characters that require quoting, it
   * will be quoted using single quotes.
   */
  public get active_sheet(): string {
    const name = this.grid.active_sheet.name;
    if (QuotedSheetNameRegex.test(name)) {
      return `'${name}'`;
    }
    return name;
  }

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

  /** 
   * opaque user data (metadata). `USER_DATA_TYPE` is a template
   * parameter you can set when creating the spreadsheet.
   */
  public get user_data(): USER_DATA_TYPE|undefined {
    return this.grid.model.user_data as USER_DATA_TYPE;
  }

  /** 
   * opaque user data (metadata). `USER_DATA_TYPE` is a template
   * parameter you can set when creating the spreadsheet.
   */
  public set user_data(data: USER_DATA_TYPE|undefined) {
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
   * state is the current revision of the document. it is preserved any
   * time the document is saved. it should be a consistent indication of
   * the document version and can be used to compare versions.
   * 
   * state is an atomically-incrementing integer but rolls over at 2^16.
   */
  public get state() {
    return this.file_version;
  }

  /**
   * this flag indicates we can revert the document. what that means is 
   * we loaded a user-created version from localStorage, but there's a 
   * backing network or inline document. or we did load the original version
   * but the user has made some document changes.
   * 
   * it's like `dirty`, but that uses the load source as the ground truth,
   * which means if you load a modified document from localStorage it's 
   * initially considered not-dirty (which is maybe just a bad design?)
   * 
   * the intent of this field is to support enabling/disabling revert 
   * logic, or to add a visual indicator that you are not looking at the
   * canonical version.
   * 
   * @privateRemarks
   * for that to work we need to know that we loaded from localStorage --
   * that's not something we're keeping track of at the moment. 
   * 
   * it might be good to include the "canonical version" when we put stuff
   * in localStorage...
   * 
   */
  public get can_revert(): boolean {

    // first check we came from a network source.

    if (!this.options.inline_document && !this.options.document) {
      return false;
    }

    // next check if we actually loaded from localStorage. for the purposes
    // of this state check we only care about the initial load, so we can
    // store that.

    if (this.initial_load_source === LoadSource.LOCAL_STORAGE) {
      return true;
    }

    // last check dirty -- that's everything else

    return this.dirty;

  }

  /**
   * indicates the current revision of the document is not equal to the 
   * last-saved revision of the document.
   */
  public get dirty() {
    return this.file_version !== this.last_save_version;
  }

  /**
   * explicitly set or clear the dirty flag. it's intended for use by clients 
   * that have their own save routine.
   */
  public set dirty(value: boolean) {
    if (value) {
      this.file_version++;
    }
    else {
      this.last_save_version = this.file_version;
    }
  }

  /**
   * returns the names of all sheets in the current document
   */
  public get sheet_names() {
    return this.model.sheets.list.map(sheet => sheet.name);
  }

  /**
   * constructor takes spreadsheet options. type should be implicit, either
   * the default (here) or a subclass
   * 
   * @internal
   */
  constructor(options: EmbeddedSpreadsheetOptions & { model?: EmbeddedSpreadsheet }) { 

    // super();

    // we renamed this option, default to the new name

    if (options.storage_key && !options.local_storage) {
      options.local_storage = options.storage_key;
    }

    // consolidate options w/ defaults. note that this does not
    // support nested options, for that you need a proper merge

    this.options = { ...DefaultOptions, ...options, local_storage: this.ResolveStorageKey(options.local_storage, 'document') };

    if (typeof this.options.imaginary_value === 'string') {
      NumberFormat.imaginary_character = this.options.imaginary_value;
    }

    if (this.options.network_document) {
      console.warn('the option `network_document` is deprecated. please use `document` instead.');
      if (!this.options.document) { 
        this.options.document = this.options.network_document;
      }
    }

    if (this.options.document && this.options.inline_document) {
      console.warn('both document and inline-document are provided');
    }

    const network_document = this.options.document;

    // optionally data from storage, with fallback

    let data: string | undefined | TREBDocument;
    let source: LoadSource | undefined;

    // don't load if we're a split view. we can also skip the 
    // unload event, as parent will already have that set

    if (this.options.local_storage && !this.options.toll_initial_load && !options.model) {
      data = localStorage.getItem(this.options.local_storage) || undefined;
      if (data) {
        source = LoadSource.LOCAL_STORAGE;
      }
    }

    // if we have an inline document, and there was nothing in local storage,
    // load the inline document now. not for splits.

    if (!data && !this.options.toll_initial_load && !options.model && options.inline_document) {
      data = options.inline_document;
      source = LoadSource.INLINE_DOCUMENT;
    }

    // this one should not be done for a split view, but we should still
    // do it if the toll flag is set, and storage key is set. 

    // FIXME: shouldn't this gate on dirty? (...)
    // ALSO: check if we can use a different event. see
    //
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event#usage_notes
    //
    // and, including the alternatives:
    //
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event
    //

    if (this.options.local_storage && !options.model ) {

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          if (this.options.local_storage && this.dirty) {
            this.SaveLocalStorage(this.options.local_storage);
          }
        }
      });

      /*
      window.addEventListener('beforeunload', () => {
        if (this.options.local_storage && this.dirty) {
          this.SaveLocalStorage(this.options.local_storage);
        }
      });
      */
    }

    let container: HTMLElement | undefined;

    if (typeof this.options.container === 'string') {
      container = document.querySelector(this.options.container) as HTMLElement;
    }
    else if (this.options.container) {
      container = this.options.container;
    }

    // create + init grid

    const grid_options: GridOptions = {
      // expand: false,
      // insert_function_button: false, // do we have this?
      in_cell_editor: true, // if this is always true, why is it an option?
      repaint_on_cell_change: false,
      scrollbars: this.options.scrollbars,
      markdown: !!this.options.markdown,

      formula_bar: this.options.formula_bar,
      expand_formula_button: this.options.expand_formula_button,
      tab_bar: this.options.tab_bar,
      add_tab: this.options.add_tab,
      // delete_tab: this.options.delete_tab,
      expand: this.options.expand,

    };

    if (this.options.scale) {
      grid_options.initial_scale = this.options.scale;
    }

    if (this.options.stats) {
      grid_options.stats = this.options.stats;
      grid_options.tab_bar = true; // implied
    }

    if (this.options.scale_control) {

      grid_options.scale_control = true;
      grid_options.tab_bar = true; // implied

      if (this.options.persist_scale) {
        grid_options.persist_scale_key = this.ResolveStorageKey(this.options.persist_scale, 'scale');
        if (grid_options.persist_scale_key) {

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

    }

    if (options.model) {
      this.model = options.model.model as DataModel;
      this.calculator = options.model.calculator; // as CalcType;
      this.DOM = options.model.DOM;
    }
    else {

      this.model = new DataModel();

      // we need an initial sheet, now we're pointing to the model theme
      // properties and those will get updated by grid on initialize, and
      // then on any theme update.

      this.model.sheets.Add(Sheet.Blank(this.model.theme_style_properties));

      // create calculator instance

      this.calculator = this.CreateCalculator(this.model, options);

    }

    //this.extra_calculator = //new Calculator(this.model);
    //  this.CreateCalculator(this.model);

    if (container) {
      this.DOM = DOMContext.GetInstance(container.ownerDocument);
    }

    // update: tell the grid if we don't want to initialize the DOM,
    // if we don't have a container. that's distinct (at the moment)
    // from headless, which is a state that can change.

    this.grid = new Grid(grid_options, this.model, undefined, !!container, this.DOM);

    if (this.options.headless) {
      this.grid.headless = true; // FIXME: move into grid options
    }

    // we're now gating this on container to support fully headless operation

    if (container) {

      this.DOM = DOMContext.GetInstance(container.ownerDocument);

      // if this is the first one, update UA classes (used to be in grid)

      if (!this.parent_view) {

        // FIXME: pass in the layout node so we don't have to reacharound
          
        if (UA.is_windows) {
          container.parentElement?.classList.add('treb-ua-windows');
        }
        else if (UA.is_mac) {
          container.parentElement?.classList.add('treb-ua-osx');
        }
      }
      
      // container is "treb-views", which contains individual "treb-view" 
      // elements. but we don't add a default; rather we use a template

      const template = container.querySelector('.treb-view-template') as HTMLTemplateElement;
      this.view_node = template.content.firstElementChild?.cloneNode(true) as HTMLElement;

      // this is a little weird but we're inserting at the front. the 
      // reason for this is that we only want to use one resize handle,
      // the original one, and we want that to be at the right-hand side.

      // we could work around this, really we're just being lazy.

      container.prepend(this.view_node);

      
      // this.node = container;
      // this.node = this.view;

      this.view_node.addEventListener('focusin', () => {
        if (this.focus_target !== this) {
          this.Publish({ type: 'focus-view' });
          this.focus_target = this;
        }
      });

      // handle key. TODO: move undo to grid (makes more sense)

      // FIXME: undo is a little weird for split view. it seems to be bound
      // to the current view. this can lead to strange behavior depending
      // on which window you're in. needs some thought.

      this.key_listener = (event) => this.HandleKeyDown(event);
      container.addEventListener('keydown', this.key_listener);

      const toll_initial_render = !!(data || this.options.document);

      // const view = container.querySelector('.treb-view') as HTMLElement;

      this.grid.Initialize(this.view_node, toll_initial_render);

      // dnd

      if (this.options.dnd) {
        this.view_node.addEventListener('dragenter', (event) => this.HandleDrag(event));
        this.view_node.addEventListener('dragover', (event) => this.HandleDrag(event));
        this.view_node.addEventListener('drop', (event) => this.HandleDrop(event));
      }

      // set up grid events

      this.grid.grid_events.Subscribe((event) => {

        // console.info({event});

        switch (event.type) {

          case 'error':
            this.dialog?.ShowDialog({
              type: DialogType.error,
              ...this.TranslateGridError(event.code),
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
            this.UpdateDocumentStyles();
            this.UpdateSelectionStyle();
            break;

          case 'scale':
            this.RebuildAllAnnotations();
            this.events.Publish({ type: 'view-change' });
            break;

          case 'annotation':
            // FIXME: maybe need to update vertices (on create, update, delete,
            // not on move or resize)

            if (event.annotation) {
              const view: AnnotationViewData = event.annotation.view[this.grid.view_index] || {};

              this.DocumentChange();
              switch (event.event) {
                case 'create':
                  this.InflateAnnotation(event.annotation);
                  this.calculator.UpdateAnnotations(event.annotation, this.grid.active_sheet);
                  this.grid.AnnotationUpdated(event.annotation);
                  break;
                case 'delete':
                  this.calculator.RemoveAnnotation(event.annotation); // clean up vertex
                  break;
                case 'update':
                  if (view.update_callback) {
                    view.update_callback();
                    this.grid.AnnotationUpdated(event.annotation);
                  }
                  else {
                    console.info('annotation update event without update callback');
                  }
                  this.calculator.UpdateAnnotations(event.annotation, this.grid.active_sheet);
                  break;
                case 'resize':
                  if (view.resize_callback) {
                    view.resize_callback();
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
            {
              // console.info("S event", event);

              const cached_selection = this.last_selection;
              if (event.conditional_format) {
                this.calculator.UpdateConditionals();
                this.ApplyConditionalFormats(this.grid.active_sheet, false);
              }

              if (event.rebuild_required) {
                this.calculator.Reset();

                ((this.calculation === CalculationOptions.automatic) ?
                  this.Recalculate(event) : Promise.resolve()).then(() => {
                    this.DocumentChange(cached_selection);
                  });

              }
              else {
                this.DocumentChange(cached_selection);
              }
            }
            this.UpdateSelectionStyle();
            break;

          case 'cell-event':
            this.HandleCellEvent(event);
            break;

        }
      });

      // FIXME: split?

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
      if (!EmbeddedSpreadsheet.one_time_warnings.headless) {
        EmbeddedSpreadsheet.one_time_warnings.headless = true;
        console.info('not initializing layout; don\'t call UI functions');
      }
      // this.grid.headless = true; // ensure
    }

    if (options.preload) {
      options.preload.call(0, this);
    }

    // FIXME: this should yield so we can subscribe to events before the initial load

    if (data) {
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      if (data) {
        this.LoadDocument(data as TREBDocument, { recalculate: !!this.options.recalculate, source});
      }
      else {
        this.UpdateDocumentStyles();
      }
    }
    else if (!network_document) {

      // no data and no network document -- we need to connect the grid model
      // and the calculator, which would otherwise happen on document load

      this.calculator.RebuildClean(true);
      this.UpdateDocumentStyles();

    }

    this.FlushUndo();

    // why is this outside of the container test? there should be
    // no reason to do this when headless

    this.grid.ShowHeaders(this.options.headers);

    // again, this should be gated on container

    // optionally scroll grid on create (async -- why?)

    if (this.options.scroll && !this.options.document) {
      const address = this.options.scroll;
      requestAnimationFrame(() => {
        this.ScrollTo(address);
      });
    }

    // init AC

    // this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());
    this.UpdateAC();

    // dev
    if (this.options.global_name) {

      // there has to be a simpler way to do this
      // (that comment was written when this was slightly worse; still bad though)

      (self as (typeof self & Record<string, unknown>))[this.options.global_name] = this;

    }

    // create spinner, we might want it for load

    if (container && this.options.spinner) {
      this.spinner = new Spinner(container);
    }

    // don't load if we are a split view
    // UPDATE: don't load if we have a local_storage document. this is taking
    // over the old alternate_document flow, because it doesn't make any sense
    // otherwise. what would local_storage with document_name mean otherwise?

    if (network_document && !options.model && !data) {
      this.LoadNetworkDocument(network_document, this.options);
    }

    // create mask dialog

    if (container) {
      this.dialog = new Dialog(container);
    }

  }

  /**
   * update autocomplete functions. we're breaking this out into a 
   * separate method so we can better manage language translation.
   */
  protected UpdateAC(): void {

    let list: FunctionDescriptor[] = this.calculator.SupportedFunctions();

    if (this.language_model) {

      const map: Record<string, TranslatedFunctionDescriptor> = {};
      for (const entry of this.language_model.functions || []) {
        map[entry.base.toUpperCase()] = entry;
      }

      list = list.map(descriptor => {
        return map[descriptor.name.toUpperCase()] || descriptor;
      });

    }

    // original
    this.grid.SetAutocompleteFunctions(list);

  }

  /**
   * initialize calculator instance
   */
  protected CreateCalculator(model: DataModel, options: EmbeddedSpreadsheetOptions) {
    return new Calculator(model, {
      complex_numbers: options.complex
    });
  }

  /**
   * we moved error strings from grid, so we can (at some point) localize 
   * them. returns a message and (optionally) a title for the dialog
   */
  protected TranslateGridError(code: ErrorCode): {
      message: string,
      title?: string,
    } {

    switch (code) {
      case ErrorCode.none:
        return {
          message: `No error`, // why?
        }

      case ErrorCode.array:
        return {
          message: `You can't change part of an array`,
        }

      case ErrorCode.invalid_area_for_paste:
        return {
          message: 'Invalid area for paste',
        }

      case ErrorCode.invalid_area_for_table:
        return {
          message: `Invalid area for table`,
        }

      case ErrorCode.data_validation:
        return {
          message: `Invalid value (data validation)`,
        }

      default:
        return {
          message: `Unknown error (${code})`,
        };
    }

  }

  /**
   * this will need to get overloaded for subclasses so they can
   * create the correct type
   */
  protected CreateView(): EmbeddedSpreadsheet {
    const child = new EmbeddedSpreadsheet<USER_DATA_TYPE>({
      ...this.options,
      global_name: undefined, // don't overwrite
      model: this,
    });
    child.parent_view = this;
    return child;
  }

  // --- public internal methods -----------------------------------------------

  // these are methods that are public for whatever reason, but we don't want
  // them published to any public API. if we ever get around to encapsulating
  // the API, leave these out.

  /**
   * testing 
   * 
   * @internal
   */
  public Unsplit(): void {
    // console.info("unsplit", this.views);
    const target = this.views.pop();
    if (target) {
      const sheet = target.view;

      // clean up
      sheet.grid.grid_events.CancelAll();
      sheet.events.CancelAll();
      
      if (sheet.view_node?.parentElement) {

        // remove listener
        if (sheet.key_listener) {
          sheet.view_node.parentElement.removeEventListener('keydown', sheet.key_listener);
        }

        // remove node
        sheet.view_node.parentElement.removeChild(sheet.view_node);
      }            

      // in case other view was focused
      this.view_node?.focus();

      // usually this results in us getting larger, we may need to update
      this.Resize();

    }
  }

  /**
   * set or remove an external editor. external editor is an interface used
   * to support outside tooling by highlighting a list of arguments and 
   * responding to selection.
   */
  public ExternalEditor(config?: Partial<ExternalEditorConfig>) {
    this.grid.ExternalEditor(config);
  }

  /**
   * this is not very efficient atm. we create another whole instance of this
   * class, do a lot of unecssary painting and layout. it works but it could
   * definitely be improved.
   * 
   * @internal
   */
  public Split(): void {

    const view = this.CreateView();
    view.grid.EnsureActiveSheet(true);

    view.view_node?.addEventListener('focusin', () => {
      if (this.focus_target !== view) {
        this.Publish({ type: 'focus-view' });
        this.focus_target = view;
      }
    });

    view.grid.grid_events.Subscribe(event => {
      if (event.type === 'structure') {
        this.grid.EnsureActiveSheet();
        this.grid.UpdateLayout();
        // (this.grid as any).tab_bar?.Update();
        this.grid.UpdateTabBar();
      }
    });

    view.Subscribe(event => {
      switch (event.type) {
        case 'selection':
          break;
        default:
          view.UpdateAnnotations();
          this.grid.Update(true);
      }
    });

    this.grid.grid_events.Subscribe(event => {
      if (event.type === 'structure') {
        view.grid.EnsureActiveSheet();
        view.grid.UpdateLayout();
        // (view.grid as any).tab_bar?.Update();
        view.grid.UpdateTabBar();
      }
    });

    const subscription = this.Subscribe(event => {
      switch (event.type) {
        case 'selection':
          break;
        
        case 'load':
        case 'reset':
          view.grid.EnsureActiveSheet(true); // force update of annotations
          view.UpdateAnnotations();
          view.grid.Update(true);
          break;

        default:
          view.UpdateAnnotations();
          view.grid.Update(true);
      }
    });

    this.views.push({
      view,
      subscription,
    });

  }

  //////////////////////////////////////////////////////////////////////////////
  //
  // conditional formatting API (WIP)
  //

  /**
   * list conditional formats. uses the active sheet by default, or pass a 
   * sheet name or id.
   * 
   * @internal
   */
  public ListConditionalFormats(sheet?: number|string) {

    const target = (typeof sheet === 'undefined') ? 
      this.grid.active_sheet :
      this.model.sheets.Find(sheet);

    return target?.conditional_formats || [];
      
  }

  /** @internal */
  public ConditionalFormatDuplicateValues(range: RangeReference|undefined, options: ConditionalFormatDuplicateValuesOptions): ConditionalFormat {
       
    if (range === undefined) {
      const ref = this.GetSelectionReference();
      if (ref.empty) {
        throw new Error('invalid range (no selection)');
      }
      range = ref.area;
    }
    
    return this.AddConditionalFormat({
        type: 'duplicate-values',
        area: this.model.ResolveArea(range, this.grid.active_sheet),
        ...options,
      });

  }

  /**
   * @internal
   */
  public ConditionalFormatGradient(range: RangeReference|undefined, options: ConditionalFormatGradientOptions|StandardGradient): ConditionalFormat {

    if (range === undefined) {
      const ref = this.GetSelectionReference();
      if (ref.empty) {
        throw new Error('invalid range (no selection)');
      }
      range = ref.area;
    }
    
    const area = this.model.ResolveArea(range, this.grid.active_sheet);

    const format: ConditionalFormatGradient = (typeof options === 'object') ?
      {
        type: 'gradient', area, ...options,
      } :
      {
        type: 'gradient', area, ...StandardGradientsList[options]
      };

    this.AddConditionalFormat(format);
    return format;

  }

  /** @internal */
  public ConditionalFormatCellMatch(range: RangeReference|undefined, options: ConditionalFormatCellMatchOptions): ConditionalFormat {

    if (range === undefined) {
      const ref = this.GetSelectionReference();
      if (ref.empty) {
        throw new Error('invalid range (no selection)');
      }
      range = ref.area;
    }
    
    const area = this.model.ResolveArea(range, this.grid.active_sheet);

    const format: ConditionalFormatCellMatch = {
      type: 'cell-match',
      area,
      ...options,
    };

    this.AddConditionalFormat(format);
    return format;


  }

  /**
   * @internal
   */
  public ConditionalFormatExpression(range: RangeReference|undefined, options: CondifionalFormatExpressionOptions): ConditionalFormat {

    if (range === undefined) {
      const ref = this.GetSelectionReference();
      if (ref.empty) {
        throw new Error('invalid range (no selection)');
      }
      range = ref.area;
    }
    
    const area = this.model.ResolveArea(range, this.grid.active_sheet);

    const format: ConditionalFormatExpression = {
      type: 'expression',
      area,
      ...options,
    };

    this.AddConditionalFormat(format);

    return format;

  }

  /**
   * add a conditional format
   * 
   * @internal
   */
  public AddConditionalFormat(format: ConditionalFormat) {

    this.grid.AddConditionalFormat(format);

    // fluent
    return format;

  }

  /**
   * remove conditional format
   * 
   * @internal
   */
  public RemoveConditionalFormat(format: ConditionalFormat) {
    this.grid.RemoveConditionalFormat({ format });
  }

  /**
   * clear conditional formats from the target range (or currently selected
   * range). we operate on format objects, meaning we'll remove the whole
   * format object rather than clip the area.
   * 
   * @internal
   */
  public RemoveConditionalFormats(range?: RangeReference) {

    if (range === undefined) {
      const ref = this.GetSelectionReference();
      if (ref.empty) {
        throw new Error('invalid range (no selection)');
      }
      range = ref.area;
    }

    const area = this.model.ResolveArea(range, this.grid.active_sheet);
    this.grid.RemoveConditionalFormat({ area });

  }

  //////////////////////////////////////////////////////////////////////////////

  /**
   * @internal
   */
  public HandleToolbarMessage(event: ToolbarMessage): void {

    // for multiple views, route toolbar command to focused view

    if (this.focus_target !== this) {
      this.focus_target.HandleToolbarMessage(event)
      return;
    }

    let updated_style: CellStyle = {};

    const insert_annotation = (func: string) => {
      const selection = this.grid.GetSelection();
      if (selection && !selection.empty) {
        const label = selection.area.spreadsheet_label;
        this.InsertAnnotation(`=${func}(${label},,"${label}")`, undefined, undefined, ',');
      }
    };

    if (/^border-/.test(event.command)) {

      if (event.command === 'border-color') {

        try {
          updated_style.border_top_fill =
            updated_style.border_bottom_fill =
            updated_style.border_left_fill =
            updated_style.border_right_fill = event.color || {};
        }
        catch (err) {
          console.error(err);
        }
      }
      else {
        let width = 1;
        let command = event.command.substring(7) as BorderConstants;
        
        if (event.command === 'border-double-bottom') {
          command = BorderConstants.Bottom;
          width = 2;
        }

        this.grid.ApplyBorders2(
          undefined,
          command,
          ((event as BorderToolbarMessage).color) || {},
          width,
        );
      }

    }
    else {
      switch (event.command) {

        case 'about':
          this.About();
          break;

        case 'number-format':
          updated_style.number_format = event.format || 'General';
          break;

        case 'font-scale':

          // above we handle 'font-size' events; this comes from a dropdown,
          // so we're handling it inline, but we want the same behavior.
          // FIXME: break out

          {
            const selection = this.grid.GetSelection();
            const area = this.grid.active_sheet.RealArea(selection.area);
            const scale = Number(event.scale || 1);

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

              // tweak: don't resize row if merged, even if the merged
              // area is too small

              if (!this.selection_state?.merge) {
                this.grid.SetRowHeight(rows, undefined, false);
              }

            }
          }
          break;

        case 'update-comment':
          this.SetNote(undefined, event.comment || '');
          break;

        case 'clear-comment':
          this.SetNote(undefined, '');
          break;

        case 'text-color':
        case 'fill-color':

          try {
            const color: Color = event.color || {};
            if (event.command === 'text-color') {
              updated_style.text = color;
            }
            else if (event.command === 'fill-color') {
              updated_style.fill = color;
            }
          }
          catch (err) {
            console.error(err);
          }

          break;

        case 'insert-table': this.InsertTable(); break;
        case 'remove-table': this.RemoveTable(); break;

        // why are these calling grid methods? should we contain this in some way? (...)

        case 'insert-row': this.InsertRows(); break;
        case 'insert-column': this.InsertColumns(); break;
        case 'delete-row': this.DeleteRows(); break;
        case 'delete-column': this.DeleteColumns(); break;
        case 'insert-sheet': this.grid.InsertSheet(); break;
        case 'delete-sheet': this.grid.DeleteSheet(); break;

        case 'freeze-panes':
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

        case 'insert-donut-chart': insert_annotation('Donut.Chart'); break;
        case 'insert-column-chart': insert_annotation('Column.Chart'); break;
        case 'insert-bar-chart': insert_annotation('Bar.Chart'); break;
        case 'insert-line-chart': insert_annotation('Line.Chart'); break;

        case 'increase-precision':
        case 'decrease-precision':
          if (this.selection_state?.style) {

            const format = NumberFormatCache.Get(this.selection_state.style.number_format || 'General');
            if (format.date_format) { break; }

            const clone = new NumberFormat(format.pattern);

            // special case: from general, we want to go to a relative number...
            // for that to work, we need a (the first) value... then go from there.

            // NOTE: this isn't really the way to identify this, we only want
            // to do this if the style === 'General'. 

            if (format.magic_decimal) {

              // but what we're doing here, if there's a magic decimal, is
              // measuring the decimal part of the first number we find. then
              // we increase/decrease from that.

              let len = 0;
              let rng = this.GetRange();
              
              // find the first number...

              if (!Array.isArray(rng)) {
                rng = [[rng]];
              }

              find_number:
              for (let i = 0; i < rng.length; i++) {
                for (let j = 0; j < rng[i].length; j++) {
                  const value = rng[i][j];

                  if (typeof value !== 'undefined' && IsComplex(value)) {

                    // find the longer of the two, use that as base

                    //const f2 = NumberFormatCache.Get(this.active_selection_style.number_format || 'General', true);
                    const f2 = NumberFormatCache.Get(this.selection_state.style.number_format || 'General', true);
                    const real_parts = f2.BaseFormat(value.real);
                    const imaginary_parts = f2.BaseFormat(value.imaginary);

                    if (real_parts.parts && typeof real_parts.parts[1] === 'string') {
                      len = real_parts.parts[1].length;
                    }
                    if (imaginary_parts.parts && typeof imaginary_parts.parts[1] === 'string') {
                      len = Math.max(len, imaginary_parts.parts[1].length);
                    }
                    
                    break find_number;

                  }
                  else if (typeof value === 'number') {
                    const parts = format.BaseFormat(value);
                    if (parts.parts && typeof parts.parts[1] === 'string') {
                      len = parts.parts[1].length;
                    }
                    break find_number;
                  }
                }
              }

              if (event.command === 'increase-precision') {
                clone.SetDecimal(len + 1);
              }
              else {
                clone.SetDecimal(Math.max(0, len - 1));
              }
              
            }
            else {
              if (event.command === 'increase-precision' ) {
                clone.IncreaseDecimal();
              }
              else {
                clone.DecreaseDecimal();
              }
            }
            updated_style.number_format = clone.toString();
          }
          break;

        case 'merge-cells':
          this.grid.MergeCells();
          break

        case 'unmerge-cells':
          this.grid.UnmergeCells();
          break;

        case 'lock-cells':
          updated_style = {
            locked: this.selection_state?.style ? !this.selection_state.style.locked : true,
          };
          break;

        case 'wrap-text':
          updated_style = {
            wrap: this.selection_state?.style ? !this.selection_state?.style.wrap : true,
          };
          break;

        case 'justify-left':
          updated_style = { horizontal_align: 'left' };
          break;

        case 'justify-center':
          updated_style = { horizontal_align: 'center' };
          break;

        case 'justify-right':
          updated_style = { horizontal_align: 'right' };
          break;

        case 'align-top':
          updated_style = { vertical_align: 'top' };
          break;

        case 'align-middle':
          updated_style = { vertical_align: 'middle' };
          break;

        case 'align-bottom':
          updated_style = { vertical_align: 'bottom' };
          break;

        case 'reset':
          this.Reset();
          break;
          
        case 'import-file':
          this.LoadLocalFile();
          break;

        case 'save-json':
          this.SaveToDesktop();
          break;

        case 'save-csv': // FIXME: should be export
          this.SaveToDesktop(SaveFileType.csv);
          break;

        case 'export-xlsx':
          this.Export();
          break;

        case 'revert':
          this.Revert();
          break;

        case 'recalculate':
          this.Recalculate();
          break;

        case 'toggle-toolbar':
        case 'show-toolbar':
        case 'hide-toolbar':
          this.ShowToolbar(event.command === 'toggle-toolbar' ? undefined : event.command === 'show-toolbar');
          break;

        case 'toggle-sidebar':
        case 'show-sidebar':
        case 'hide-sidebar':
          this.ShowSidebar(event.command === 'toggle-sidebar' ? undefined : event.command === 'show-sidebar');
          break;

        case 'revert-indicator':
          this.dialog?.ShowDialog({
            title:  `This is a modified version of the document.\n` +
                    `You can revert to the original or save your\n` +
                    `changes in the sidebar.`,
            close_box: true,
            timeout: 5000,
            type: DialogType.info,
          });
          break;

        case 'indent':
        case 'outdent':

          // hmmm. we should actually adjust selection cell-by-cell so
          // all entries get +1/-1 from their current level. we don't 
          // want to normalize here. this is unusual.

          // let's make a method here in case we want to use this again

          this.grid.Indent(undefined, (event.command === 'indent') ? 1 : -1);
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

  }

  /** 
   * @internal 
   * 
   * @param show - true or false to show/hide, or leave undefined to toggle
   */
  public ShowToolbar(show?: boolean) {
    if (this.options.toolbar && this.options.container instanceof HTMLElement) {
      const layout = this.options.container.parentElement;
      if (layout) {
        if (show === undefined) {
          show = !layout.hasAttribute('toolbar');
        }
        if (show) {
          layout.setAttribute('toolbar', '');
        }
        else {
          layout.removeAttribute('toolbar');
        }
      }
    }
  }

  /** 
   * @internal 
   *
   * @param show - true or false to show/hide, or leave undefined to toggle
   */
  public ShowSidebar(show?: boolean) {
    if (this.options.toolbar && this.options.container instanceof HTMLElement) {
      const layout = this.options.container.parentElement; 
      if (layout) {
        if (show === undefined) {
          show = layout.hasAttribute('collapsed');
        }
        if (show) {
          layout.removeAttribute('collapsed');
        }
        else {
          layout.setAttribute('collapsed', '');
        }
      }
    }
  }

  /* * 
   * this is public because it's created by the composite sheet. 
   * FIXME: perhaps there's a better way to do that? via message passing? (...) 
   * 
   * @internal
   * /
   public CreateToolbar(container: HTMLElement): Toolbar {
    this.toolbar = new Toolbar(container, this.options, this.grid.theme);
    this.toolbar.Subscribe(event => this.focus_target.HandleToolbarEvent(event));

    this.UpdateDocumentStyles(false);
    this.UpdateSelectionStyle(undefined);

    return this.toolbar;
  }
  */

  /** 
   * Create (and return) a Chart object.
   * @internal
   */
  public CreateChart(): Chart {
    
    if (this.calculator.RegisterLibrary('treb-charts', ChartFunctions)) {
      this.UpdateAC();
    }

    if (this.options.chart_renderer) {
      if (typeof this.options.chart_renderer === 'function') {
        return new Chart(this.options.chart_renderer());
      }
      else {
        return new Chart(this.options.chart_renderer);
      }
    }

    return new Chart();
  }

  // --- public API methods ----------------------------------------------------

  /** 
   * this is not public _yet_ 
   * 
   * @internal
   */
  public SetLanguage(model?: LanguageModel): void {

    this.language_model = model;

    if (!model) {
      this.grid.SetLanguageMap(); // clear
    }
    else {

      // create a name map for grid

      const map: Record< string, string > = {};
      for (const entry of model.functions || []) {
        map[entry.base] = entry.name;
      }
      this.grid.SetLanguageMap(map);
    }

    this.UpdateAC();

  }

  /**
   * Use this function to batch multiple document changes. Essentially the 
   * grid stops broadcasting events for the duration of the function call, 
   * and collects them instead. After the function call we update as necessary.
   * 
   * @privateRemarks
   * 
   * FIXME: we need to consider the case where this is nested, since we now
   * call it from the Paste method. that might be batched by a caller. we
   * need a batch stack, and we need to consolidate any options (paint is the
   * only option) and keep the top-of-stack last selection.
   * 
   * Q: why does this work the way it does, anyway? why not just rely
   * on the actual events? if grid published them after a batch, wouldn't 
   * everything just work? or is the problem that we normally handle events
   * serially? maybe we need to rethink how we handle events coming from
   * the grid.
   * 
   * ---
   * 
   * OK so now, grid will handle nested batching. it won't return anything
   * until the last batch is complete. so this should work in the case of 
   * nested calls, because nothing will happen until the last one is complete.
   * 
   */
  public async Batch(func: () => void, paint = false): Promise<void> {

    // API v1 OK

    const cached_selection = this.last_selection;
    const events = this.grid.Batch(func, paint);

    let recalc = false;
    let reset = false;

    // FIXME (2024): are these FIXMEs below still a thing? (...)

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

    /*
    if (this.toolbar) {
      this.toolbar.UpdateTheme(this.grid.theme);
    }
    */

    this.UpdateDocumentStyles();

    // we need to flush conditional formats that use theme colors
    // (I guess we're just flushing everybody?)

    for (const sheet of this.model.sheets.list) {
      for (const format of sheet.conditional_formats) {
        format.internal = undefined;
      }
      for (const annotation of sheet.annotations) {
        if (annotation.view && annotation.data.type === 'textbox') {
          const view: AnnotationViewData = annotation.view[this.grid.view_index] || {};
          if (view.update_callback) {
            view.update_callback();
          }
        }
      }
    }

    this.calculator.UpdateConditionals();
    this.ApplyConditionalFormats(this.grid.active_sheet, false);
    this.grid.Update(true);

    this.Publish({ type: 'theme-change' });

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
      const model_sheet = this.grid.model.sheets.list[sheet];
      if (model_sheet) { return model_sheet.id; }
    }
    else {
      const entry = this.model.sheets.Find(sheet);
      if (entry) { return entry.id; }

      /*
      const name = sheet.toUpperCase();
      for (const sheet of this.grid.model.sheets) {
        if (sheet.name.toUpperCase() === name) {
          return sheet.id;
        }
      }
      */
    }

    return undefined;
  }

  /**
   * insert a table in the given range. optionally include a totals row.
   * this method does not make any changes to content or layout. it just 
   * converts the range to a table.
   * 
   * @param reference 
   */
  public InsertTable(range?: RangeReference, options: InsertTableOptions = {}) {
    const area = range ? this.model.ResolveArea(range, this.grid.active_sheet) : this.GetSelectionReference().area;

    let theme = options.theme;
    if (typeof theme === 'number') {
      theme = ThemeColorTable(theme);
    }

    this.grid.InsertTable(area, options.totals_row, options.sortable, theme);
    
  }

  public RemoveTable(range?: RangeReference) {
    const table = this.ResolveTable(range || this.GetSelectionReference().target);
    if (table) {
      this.grid.RemoveTable(table);
    }
  }

  public UpdateTableStyle(range?: RangeReference, theme: TableTheme|number = 4) {

    const table = this.ResolveTable(range || this.GetSelectionReference().target);

    if (table) {

      if (typeof theme === 'number') {
        theme = ThemeColorTable(theme);
      }
      table.theme = theme;

      this.grid.active_sheet.FlushCellStyles();
      this.grid.Update(true);

      this.PushUndo();
    }

  }

  /**
   * Add a sheet, optionally named. 
   */
  public AddSheet(name?: string): number {

    // we don't get the ID as a result of this function, because
    // it uses the command queue which doesn't return values (although
    // perhaps it could?) in any event, we'll get the ID separately.

    this.grid.AddSheet(name);

    const sheet = this.model.sheets.list[this.model.sheets.list.length - 1];

    // before you do anything else you probably need to reset the calculator.
    // that was causing errors when adding sheet via the grid method and then
    // calling InsertAnnotation.
    //
    // the reason is that calling AddSheet will trigger a calculator reset,
    // but asynchronously; if you are going to call other API methods we should
    // do this now. the additional reset won't be a problem (?)

    this.calculator.Reset();

    // return the ID

    return sheet.id;

  }

  public RemoveConnectedChart(id: number) {
    const element = this.model.RemoveConnectedElement(id);
    if (element) {
      const removed = this.calculator.RemoveConnectedELement(element);
      if (removed) {
        // ... actually don't need to update here
      }
    }
  }

  public UpdateConnectedChart(id: number, formula: string) {
    const element = this.model.connected_elements.get(id);
    if (element) {
      element.formula = formula;

      const internal = (element.internal) as { vertex: StateLeafVertex, state: unknown };

      if (internal?.state) {
        internal.state = undefined;
      }
      this.calculator.UpdateConnectedElements(this.grid.active_sheet, element);     
      
      if (element.update) {
        element.update.call(0, element);
      }

    }
  }

  /**
   * this is a generic version that takes a callback, so we can use
   * separately from charts. however (atm) we're using leaf vertices that
   * don't actually calculate, they just indicate the dirty state. so we
   * won't have access to the result of a calculation in the callback.
   * 
   * @internal
   * 
   */
  public CreateConnectedFormula(formula: string, callback?: (instance: ConnectedElementType) => void, options: EvaluateOptions = {}): number {

    // FIXME: merge w/ insert annotation?

    const r1c1 = options?.r1c1 || false;
    const argument_separator = options?.argument_separator || this.parser.argument_separator; // default to current

    this.parser.Save();
    this.parser.flags.r1c1 = r1c1;

    if (argument_separator === ',') {
      this.parser.SetLocaleSettings(DecimalMarkType.Period);
    }
    else {
      this.parser.SetLocaleSettings(DecimalMarkType.Comma);
    }

    const result = this.parser.Parse(formula);

    this.parser.Restore();

    if (result.expression) {
      formula = '=' + this.parser.Render(result.expression, { missing: '' });
    }
    else {
      console.warn("invalid formula", result.error);
      throw new Error(`invalid formula`);
    }

    const id = this.model.AddConnectedElement({

      formula,

      // this is circular, but I want to leave `this` bound to the sheet
      // instance in case we need it -- so what's a better approach? pass
      // in the formula explicitly, and update if we need to make changes?

      update: callback ? (instance: ConnectedElementType) => {
        callback.call(0, instance);
      } : undefined,

    });

    this.calculator.UpdateConnectedElements(this.grid.active_sheet);
    this.UpdateConnectedElements();

    return id;

  }

  /**
   * @internal
   * 
   * @returns an id that can be used to manage the reference
   */
  public CreateConnectedChart(formula: string, target: HTMLElement, options: EvaluateOptions): number {

    const chart = this.CreateChart();
    chart.Initialize(target);

    const callback = (instance: ConnectedElementType) => {

        const parse_result = this.parser.Parse(instance.formula);

        if (parse_result &&
          parse_result.expression &&
          parse_result.expression.type === 'call') {

          // FIXME: make a method for doing this

          this.parser.Walk(parse_result.expression, (unit) => {
            if (unit.type === 'address' || unit.type === 'range') {
              this.model.ResolveSheetID(unit, undefined, this.grid.active_sheet);
            }
            return true;
          });

          const expr_name = parse_result.expression.name.toLowerCase();
          const result = this.calculator.CalculateExpression(parse_result.expression);
          chart.Exec(expr_name, result as ExtendedUnion); // FIXME: type?
        }

        chart.Update();

    };

    return this.CreateConnectedFormula(formula, callback, options);

  }

  /**
   * Insert an annotation node. Usually this means inserting a chart. Regarding
   * the argument separator, see the Evaluate function.
   * 
   * @param formula - annotation formula. For charts, the chart formula.
   * @param type - annotation type. Defaults to `treb-chart`.
   * @param rect - coordinates, or a range reference for layout.
   * @param options - evaluate options. because this function used to take 
   *  the argument separator, we allow that to be passed directly, but this
   *  is deprecated. new code should use the options object.
   */
  public InsertAnnotation(formula: string, type: AnnotationType = 'treb-chart', rect?: IRectangle|RangeReference, options?: EvaluateOptions|','|';'): void {

    let target: IRectangle | Partial<Area> | undefined;
    let argument_separator: ','|';'|undefined = undefined;
    let r1c1 = false;

    if (typeof options === 'object') {
      argument_separator = options.argument_separator;
      r1c1 = !!options.r1c1;
    }
    else if (options === ',' || options === ';') {
      argument_separator = options;
    }

    if (rect) {
      target = Rectangle.IsRectangle(rect) ? rect : this.model.ResolveArea(rect, this.grid.active_sheet);
    }

    // FIXME: with the new parser save/restore semantics we should 
    // just always do this. also I don't think the r1c1 logic works
    // properly here... unless we're assuming that the default state
    // is always off

    if (argument_separator && argument_separator !== this.parser.argument_separator || r1c1) {

      this.parser.Save();

      /*
      const current = {
        argument_separator: this.parser.argument_separator, 
        decimal_mark: this.parser.decimal_mark,
      };
      */

      if (argument_separator === ',') {
        this.parser.SetLocaleSettings(DecimalMarkType.Period);

        // this.parser.argument_separator = ArgumentSeparatorType.Comma;
        // this.parser.decimal_mark = DecimalMarkType.Period;
      }
      else {
        this.parser.SetLocaleSettings(DecimalMarkType.Comma);

        // this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
        // this.parser.decimal_mark = DecimalMarkType.Comma;
      }

      // const r1c1_state = this.parser.flags.r1c1;
      // if (r1c1) 
      // {
        this.parser.flags.r1c1 = !!r1c1;
      // }

      const result = this.parser.Parse(formula);
      
      /*
      // reset
      this.parser.argument_separator = current.argument_separator;
      this.parser.decimal_mark = current.decimal_mark;
      this.parser.flags.r1c1 = r1c1_state;
      */
      this.parser.Restore();

      if (result.expression) {
        formula = '=' + this.parser.Render(result.expression, { missing: '' });
      }

    }
    
    const { x, y } = this.grid.GetScrollOffset();
    const scale = this.grid.scale || 1;
    const auto_size = { width: 301, height: 301 };

    // we're not sizing this very well at scale, because scale is stepped. FIXME

    this.grid.CreateAnnotation({
      type,
      formula,
      // class_name,
    }, undefined, undefined, target || { top: y / scale + 30, left: x / scale + 30, ...auto_size });

  }

  /**
   * Insert an image. This method will open a file chooser and (if an image
   * is selected) insert the image into the document.
   */
  public InsertImage(): void {
    this.SelectFile2('.png, .jpg, .jpeg, .gif, .svg', FileChooserOperation.InsertImage);
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
      sheet = this.grid.model.sheets.list[index];
    }
    else if (typeof index === 'string') {
      sheet = this.model.sheets.Find(index);
    }
    else {
      sheet = this.grid.active_sheet;
    }

    if (!sheet) { return; }

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
      const sheet = this.model.sheets.Find(index);
      if (sheet) {
        this.grid.DeleteSheetID(sheet.id);
      }

      /*
      index = index.toLowerCase();
      for (let i = 0; i < this.grid.model.sheets.length; i++) {
        const sheet = this.grid.model.sheets.list[i];
        if (sheet.name.toLowerCase() === index) {
          this.grid.DeleteSheet(i);
          break;
        }
      }
      */
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
   * Show or hide sheet. This method is deprecated because it's ambiguous.
   * To set a sheet's visibility, use `HideSheet`. To activate a sheet, use
   * `ActivateSheet`.
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
   * filter a table. the reference can be the table name, or a cell in the table.
   * if the reference is an area (range), we're going to look at the top-left 
   * cell.
   * 
   * this method uses a function to filter rows based on cell values. leave the
   * function undefined to show all rows. this is a shortcut for "unfilter".
   * 
   * @param column - the column to sort on. values from this column will be
   * passed to the filter function.
   * 
   * @param filter - a callback function to filter based on cell values. this
   * will be called with the cell value (formula), the calculated value (if any),
   * and the cell style. return false to hide the row, and true to show the row.
   * if the filter parameter is omitted, all values will be shown.
   * 
   */
  public FilterTable(reference: RangeReference, column = 0, filter?: TableFilterFunction) {

    const table = this.ResolveTable(reference);
    
    if (!table) {
      throw new Error('invalid table reference');
    }

    if (filter) {
      this.grid.FilterTable(table, column, (cell) => {
        return filter.call(0, cell.value, cell.calculated || undefined, JSON.parse(JSON.stringify(cell.style || {})));
      });
    }
    else {
      this.grid.FilterTable(table, 0, () => true);
    }

  }

  /**
   * sort a table. the reference can be the table name, or a cell in the table.
   * if the reference is an area (range), we're going to look at the top-left 
   * cell.
   */
  public SortTable(reference: RangeReference, options: Partial<TableSortOptions> = {}) {

    const table = this.ResolveTable(reference);

    if (!table) {
      throw new Error('invalid table reference');
    }
    
    this.grid.SortTable(table, options);

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

    this.grid.MergeCells(range ? this.model.ResolveArea(range, this.grid.active_sheet) : undefined);
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

    this.grid.UnmergeCells(range ? this.model.ResolveArea(range, this.grid.active_sheet) : undefined);
  }

  /** 
   * Export XLSX as a blob. This is intended for electron clients, who may
   * implement their own file save routines (because they have access to the
   * filesystem).
   * 
   * @internal
   */
  public async ExportBlob(): Promise<Blob> {

    // this is inlined to ensure the code will be tree-shaken properly
    if (!process.env.XLSX_SUPPORT) {
      console.warn('this build does not include xlsx support.');
      throw new Error('this build does not include xlsx support.');
    }

    if (!this.export_worker) {
      this.export_worker = await this.LoadWorker();
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

        const serialized: SerializedModel = this.Serialize({ // this.grid.Serialize({
          rendered_values: true,
          expand_arrays: true,
          export_colors: true,
          decorated_cells: true,
          tables: true,
          share_resources: false,
          export_functions: true,
          apply_row_pattern: true, // if there's a row pattern, set it on rows so they export properly
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
   * revert to the network version of this document, if `local_storage` 
   * is set and the create options had either `document` or `inline-document`
   * set.
   * 
   * FIXME: we should adjust for documents that fail to load.
   */
  public Revert(): void {

    if (this.options.inline_document) {
      this.LoadDocument(this.options.inline_document);
      this.initial_load_source = LoadSource.INLINE_DOCUMENT; // update this flag, even though it's not "initial"

      if (this.options.local_storage) {
        this.SaveLocalStorage('reverted_backup');
        localStorage.removeItem(this.options.local_storage);
      }
      return;
    }

    const canonical = this.options.document;

    if (canonical) {

      /*
      this.dialog?.ShowDialog({
        title: `Reverting to original`,
        close_box: true,
        timeout: 3000,
        type: DialogType.info,
      });
      */

      this.LoadNetworkDocument(canonical);
      this.initial_load_source = LoadSource.NETWORK_FILE; // update this flag, even though it's not "initial"

      // flush storage? what about mistakes? maybe we should 
      // back it up somewhere? (...)

      if (this.options.local_storage) {
        this.SaveLocalStorage('reverted_backup');
        localStorage.removeItem(this.options.local_storage);
      }

      return;
    }

    console.warn('to revert, there must be a document set in options');

    this.dialog?.ShowDialog({
      title: `Can't revert -- no document is set in options`,
      close_box: true,
      timeout: 3000,
      type: DialogType.error,
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

    // this is inlined to ensure the code will be tree-shaken properly
    if (!process.env.XLSX_SUPPORT) {
      console.warn('this build does not include xlsx support.');
      return;
    }

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
        this.SaveAs(blob, filename + '.xlsx');
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
   * This method should be called when the container is resized, to 
   * trigger an update to layout. It should be called automatically 
   * by a resize observer set in the containing tag class, but you 
   * can call it manually if necessary.
   * 
   * @public
   */
  public Resize(): void {

    // API v1 OK

    this.grid.UpdateLayout();

    for (const entry of this.views) {
      entry.view.grid.UpdateLayout();
    }
    
    this.Publish({ type: 'resize' });
  }

  /** 
   * Clear/reset sheet. This will reset the undo stack as well, 
   * so it cannot be undone.
   * 
   * @public
   */
  public Reset(): void {
    
    if (this.parent_view) {
      return this.parent_view.Reset();
    }

    // API v1 OK

    this.grid.Reset();
    this.ResetInternal();
    // this.calculator.AttachModel();
    this.UpdateAC();

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

    this.options.local_storage = key;
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

    // (Update, 2022: back to fetch)

    const csv = /csv(?:$|\?|&)/i.test(uri);
    const tsv = /tsv(?:$|\?|&)/i.test(uri);

    try {

      this.spinner?.Show();
      const response = await fetch(uri);
      this.spinner?.Hide();
      
      if (!response.ok) {
        throw new Error('network error');
      }

      let text = await response.text();

      if (typeof text === 'string') {
        if (csv) {
          this.LoadCSV(text, LoadSource.NETWORK_FILE);
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

          if (text.substr(0, 11) === '&&&START&&&') {
            text = text.substr(11);
          }
          else if (text.substr(0, 8) === 'for(;;);') {
            text = text.substr(8);
          }

          const json = JSON.parse(text);
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
   * @public
   */
  public async LoadLocalFile() {
    this.SelectFile2(
      '.treb, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
      FileChooserOperation.LoadFile);
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

    let sheet: Sheet | undefined = this.grid.active_sheet;

    switch (typeof options.sheet) {

      case 'undefined':
        break;

      case 'string':
        sheet = this.model.sheets.Find(options.sheet);
        break;

      case 'number':
        sheet = this.grid.model.sheets.list[options.sheet];
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
   * @deprecated - use SaveToDesktop
   * 
   * @param filename 
   * @param additional_options 
   */
  public SaveLocalFile(
      filename: string = SaveFileType.trebjson,
      additional_options: SaveOptions = {}): void {
    this.SaveToDesktop(filename, additional_options);
  }

  /** 
   * Save the current document to a desktop file. This is the new version
   * of the method, renamed from SaveLocalFile.
   * 
   * @param filename Filename or extension to use the document name.
   */
  public SaveToDesktop(
    filename: string = SaveFileType.trebjson,
    additional_options: SaveOptions = {}): void {

    // API v1 OK

    const document_name = this.grid.model.document_name || 'document'; // FIXME: options

    let data: TREBDocument;
    let text: string;

    const parts = filename.split(/\./).filter(test => test.trim().length);
    let type = parts.length ? parts[parts.length - 1].toLowerCase() : SaveFileType.treb;

    if (parts.length <= 1 || filename === 'treb.json') {

      if (filename === 'treb.json') {
        type = filename;
      }

      if ((type === SaveFileType.csv || type === SaveFileType.tsv) && this.grid.model.sheets.length > 1) {
        const active_sheet = this.grid.active_sheet.name;
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
      case SaveFileType.trebjson:
        data = this.SerializeDocument({
          ...additional_options,
        } as SerializeOptions);
        text = JSON.stringify(data, undefined, additional_options.pretty ? 2 : undefined);
        this.last_save_version = this.file_version; // clean

        break;

      default:
        throw new Error('invalid file type');

    }

    if (text && filename) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      this.SaveAs(blob, filename);
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

    if (this.parent_view) {
      return this.parent_view.LoadCSV(csv, source);
    }

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
  public ScrollOffset(offset?: Point): Point|undefined {
    return this.grid.ScrollOffset(offset);
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

    if (this.parent_view) {
      return this.parent_view.LoadDocument(data, options);
    }

    if (!this.initial_load_source) {
      this.initial_load_source = options.source;
    }

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
      // scroll: {row: 0, column: 0},
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
      this.calculator.RebuildClean(true);
      this.ApplyConditionalFormats(this.grid.active_sheet, false);
      this.grid.Update();
    }
    else {
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
      Promise.resolve().then(() => this.ScrollTo(scroll));
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
      const reference = this.model.ResolveAddress(address, this.grid.active_sheet);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    this.grid.SetNote(address, note);

  }

  /**
   * set or clear cell valiation.
   * 
   * @param target - target cell/area
   * @param validation - a spreadsheet range, list of data, or undefined. pass
   * undefined to remove existing cell validation. 
   * @param error - setting an invalid value in the target cell is an error (and
   * is blocked). defaults to false.
   */
  public SetValidation(target: RangeReference, validation?: RangeReference|CellValue[], error?: boolean) {

    if (typeof target === 'string') {
      const reference = this.model.ResolveAddress(target, this.grid.active_sheet);
      target = IsArea(reference) ? new Area(reference.start, reference.end) : new Area(reference);
      // address = IsCellAddress(reference) ? reference : reference.start;
    }

    if (IsCellAddress(target)) {
      target = new Area(target);
    }

    if (typeof validation === 'undefined' || Array.isArray(validation)) {
      this.grid.SetValidation(target, validation, error);
    }
    else {
      const range = this.model.ResolveArea(validation, this.grid.active_sheet);
      this.grid.SetValidation(target, range, error);
    }

  }

  /*
  public RemoveValidation(address: AddressReference) {

    if (typeof address === 'string') {
      const reference = this.model.ResolveAddress(address);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    this.grid.SetValidation(address, undefined);

  }

  public SetValidationList(address: AddressReference, list: CellValue[]) {

    if (typeof address === 'string') {
      const reference = this.model.ResolveAddress(address);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    this.grid.SetValidation(address, list);

  }

  public SetValidationRange(address: AddressReference, range: RangeReference) {

    if (typeof address === 'string') {
      const reference = this.model.ResolveAddress(address);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    range = this.model.ResolveArea(range);
    this.grid.SetValidation(address, range);

  }
  */

  /** 
   * Delete a macro function.
   * 
   * @public
   */
  public RemoveFunction(name: string): void {

    // API v1 OK

    const uppercase = name.toUpperCase();

    /*
    const keys = Object.keys(this.grid.model.macro_functions);
    for (const key of keys) {
      if (key.toUpperCase() === uppercase) {
        delete this.grid.model.macro_functions[key];
      }
    }
    */
    this.model.macro_functions.delete(uppercase);

    // this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());
    this.UpdateAC();

  }

  /**
   * Create a macro function.
   * 
   * FIXME: this needs a control for argument separator, like other
   * functions that use formulas (@see SetRange)
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

    this.grid.model.macro_functions.set(name.toUpperCase(), {
      name,
      function_def,
      argument_names,
      expression: this.parser.Parse(function_def).expression,
    });

    // this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());
    this.UpdateAC();

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
    // add default (true) for shared resources (FIXME: should remove for undo? ...)

    options = {
      share_resources: true,
      shrink: true,
      ...options,
    };

    // const grid_data = this.grid.Serialize(options);
    const grid_data = this.Serialize(options);

    // NOTE: these are not really env vars. we replace them at build time
    // via a webpack plugin. using the env syntax lets them look "real" at
    // analysis time. got that trick from svelte.

    const serialized: TREBDocument = {
      app: process.env.BUILD_NAME || '',
      version: process.env.BUILD_VERSION || '',
      revision: this.file_version,
      name: this.grid.model.document_name, // may be undefined
      user_data: this.grid.model.user_data, // may be undefined
      decimal_mark: Localization.decimal_separator,
      ...grid_data,
    };

    if (options.share_resources) {

      let shared_id = 1;
      const resources: Map<string, string> = new Map();
      const sheets = Array.isArray(serialized.sheet_data) ? serialized.sheet_data : [serialized.sheet_data];

      const Store = (source: string) => {
        let id = resources.get(source);
        if (!id) {
          id = (shared_id++).toString();
          resources.set(source, id);
        }
        return `resource:${id}`;
      };

      for (const sheet of sheets) {
        
        if (!sheet) { continue; }

        if (sheet.background_image) {
          sheet.background_image = Store(sheet.background_image);
        }

        for (const annotation of sheet.annotations || []) {
          if (annotation.type === 'image' && annotation.data?.src) {
            annotation.data.src = Store(annotation.data.src);
          }
        }

      }

      const shared: Record<string, string> = {};
      for (const [resource, key] of resources.entries()) {
        shared[key] = resource;
      }

      serialized.shared_resources = shared;

    }

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

    this.calculator.Calculate(area);
    this.ApplyConditionalFormats(this.grid.active_sheet, false);

    this.grid.Update(true); // , area);
    this.UpdateAnnotations();
    this.Publish({ type: 'data' });

    this.grid.UpdateStats();


  }

  /**
   * Save document to local storage. 
   * 
   * @param key optional storage key. if omitted, the method will use
   * the key from local options (set at create time).
   */
  public SaveLocalStorage(key = this.options.local_storage): void {

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

    // this is half of the problem, we also need to manage views when
    // we set undo states

    if (this.parent_view) {
      return this.parent_view.Undo();
    }

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

    // don't decrement because we will get the file version from the revision
    // number in the file (this is new)

    // this.file_version--; // decrement

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
   * scroll the given address into view. it could be at either side
   * of the window. optionally use smooth scrolling.
   */
  public ScrollIntoView(address: AddressReference, smooth = false): void {

    if (typeof address === 'string') {
      const reference = this.model.ResolveAddress(address, this.grid.active_sheet);
      address = IsCellAddress(reference) ? reference : reference.start;
    }

    this.grid.ScrollIntoView(address, smooth);

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
      const reference = this.model.ResolveAddress(address, this.grid.active_sheet);
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

    const result = this.model.ResolveAddress(reference, this.grid.active_sheet);

    if (IsCellAddress(result)) {
      return result.sheet_id ? result : undefined;
    }

    return result.start.sheet_id ? result : undefined;

  }

  /**
   * Convert an address/range object to a string. this is a convenience
   * function for composing formulas.
   * 
   * @param ref sheet reference as a string or structured object
   * @param [qualified=true] include sheet names
   * @param [named=true] resolve to named ranges, where applicable
   */
  public Unresolve(ref: RangeReference, qualified = true, named = true): string {

    if (typeof ref === 'string') {
      const resolved = this.Resolve(ref);
      if (!resolved) { 
        throw new Error('invalid reference'); 
      }
      ref = resolved;
    }

    return this.calculator.Unresolve(ref, this.grid.active_sheet, qualified, named);

  }
  
  /**
   * Evaluate an arbitrary expression in the spreadsheet. You should generally
   * use sheet names when referring to cells, to avoid ambiguity. Otherwise
   * cell references will resolve to the active sheet.
   * 
   * @param expression - an expression in spreadsheet language
   * @param options - options for parsing the passed function
   * 
   * @public
   */
  public Evaluate(expression: string, options: EvaluateOptions = {}): CellValue | CellValue[][] {

    // API v1 OK

    // why does this not use the active sheet? is it expecting
    // the callee to set that? it doesn't.

    return this.calculator.Evaluate(
        expression, this.grid.active_sheet, options);
   
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
    const sheet_name = this.calculator.ResolveSheetName(sheet_id, true);

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
   * convert a javascript date (or timestamp) to a spreadsheet date
   */
  public SpreadsheetDate(javascript_date: number|Date) {
    if (javascript_date instanceof Date) {
      javascript_date = javascript_date.getTime();
    }
    return UnlotusDate(javascript_date, true);
  }

  /**
   * convert a spreadsheet date to a javascript date
   */
  public JavascriptDate(spreadsheet_date: number) {
    return LotusDate(spreadsheet_date).getTime();
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

    this.grid.ApplyBorders2(range ? this.model.ResolveArea(range, this.grid.active_sheet) : undefined, borders, {}, width);

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
  public ApplyStyle(range?: RangeReference, style: CellStyle = {}, delta = true): void {

    // ditto re: grid method taking undefined target

    // translate old-style alignment constants (UPDATE: moved to grid)

    this.grid.ApplyStyle(
      range ? this.model.ResolveArea(range, this.grid.active_sheet) : undefined, style, delta);
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
   * Create a named range or named expression. A named range refers to an
   * address or range. A named expression can be any value or formula. To set 
   * the value as a literal string, enclose the string in double-quotes (as
   * you would when using a string as a function argument).
   * 
   * @param value range, value or expression
   * 
   * @remarks 
   * 
   * This function used to support passing `undefined` as the value,
   * which meant "create a named range using current selection". We don't
   * support that any more but you can accompilsh that with 
   * `sheet.DefineName("Name", sheet.GetSelection())`.
   * 
   * @public
   */
  public DefineName(name: string, value: RangeReference|CellValue, scope?: string|number, overwrite = false): void {

    // how can we unify named ranges and named expressions?
    //
    // (1) if the argument is undefined, by our semantics that means
    //     "create a named range from selection". that may or may not
    //     be a good idea, but it's the way it works now.
    //
    // (2) if the argument is an object, we can check if it's a 
    //     range or address (right?) and if so, treat it as a named range
    //
    // (3) if the argument is a string, we can use a parser to distinguish
    //     between addresses/ranges and other things (can we?). an expression
    //     that resolves to a single address/range should be treated as a 
    //     named range (should it?)
    //
    // (4) if the argument is another kind of intrinsic type, we can
    //     set it as a named expression

    if (typeof value === 'undefined' || value === null) {
      throw new Error('invalid value (null or undefined)');
    }

    if (typeof scope === 'string') {
      const id = this.model.sheets.ID(scope);
      if (typeof id === 'number') {
        scope = id;
      }
      else {
        throw new Error('invalid scope; use a sheet name or sheet id');
      }
    }

    if (typeof value === 'object') {
      if (IsCellAddress(value) || IsArea(value)) {
        this.grid.SetName(name, this.model.ResolveArea(value, this.grid.active_sheet), undefined, scope, overwrite);
        return;
      }
    }

    if (typeof value === 'string') {

      // kind of a shame we're parsing it twice, but I don't want to 
      // change the internal grid method atm. FIXME?

      const parse_result = this.parser.Parse(value);
      if (!parse_result.expression) {
        throw new Error('invalid expression');
      }
      switch (parse_result.expression.type) {
        case 'address':
        case 'range':
          this.grid.SetName(name, this.model.ResolveArea(parse_result.expression, this.grid.active_sheet), undefined, scope, overwrite);
          return;
      }
      this.grid.SetName(name, undefined, value, scope, overwrite);
      
    }
    else {
      this.grid.SetName(name, undefined, value.toString(), scope, overwrite);
    }
    
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
      const reference = this.model.ResolveAddress(address, this.grid.active_sheet);
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
   * Select a range. This function will change sheets if your reference
   * refers to a different sheet. if the argument is undefined or falsy
   * it will remove the selection (set to no selection).
   * 
   * @public
   */
  public Select(range?: RangeReference): void {

    let resolved: Area|undefined = undefined; 

    if (range) {
      resolved = this.model.ResolveArea(range, this.grid.active_sheet);
      if (resolved.start.sheet_id) {
        if (resolved.start.sheet_id !== this.grid.active_sheet.id) {
          this.grid.ActivateSheetID(resolved.start.sheet_id);
        }
      }    
    }

    this.grid.SelectRange(resolved);

  }

  /**
   * paste clipboard data into a target range. this method does not use
   * the system clipboard; pass in clipboard data returned from the Cut or
   * Copy method.
   * 
   * @param target - the target to paste data into. this can be larger 
   * than the clipboard data, in which case values will be recycled in 
   * blocks. if the target is smaller than the source data, we will expand
   * it to fit the data.
   * 
   * @param data - clipboard data to paste.
   * 
   * @param style - optional paste style. default is to paste formulas and
   * source formatting. paste options can be usef to paste values, values
   * and number formats, or retain the target formatting.
   * 
   * @privateRemarks LLM API
   */
  public async Paste(target?: RangeReference, data = EmbeddedSpreadsheet.clipboard, options: PasteOptions = {}) {

    if (!data) {
      throw new Error('no clipboad data');
    }

    if (!target) {
      const selection = this.GetSelectionReference();
      if (!selection.empty) {
        target = selection.area;
      }
      else {
        throw new Error('no range and no selection');
      }
    }

    const resolved = this.model.ResolveArea(target, this.grid.active_sheet);

    // paste has some special semantics. if the target smaller than the
    // source data, we write the full data irrespective of size (similar 
    // to "spill"). otherwise, we recycle in blocks. 

    // the setrange method will recycle, but we also need to recycle styles.

    // start with data length

    const rows = data.length;
    const columns = data[0]?.length || 0;

    // target -> block size

    resolved.Resize(
      Math.max(1, Math.floor(resolved.rows / rows)) * rows, 
      Math.max(1, Math.floor(resolved.columns / columns)) * columns );

    const sheet = (resolved.start.sheet_id ? this.model.sheets.Find(resolved.start.sheet_id) : this.grid.active_sheet) || this.grid.active_sheet;
      
    const values: CellValue[][] = [];

    // optionally collect calculated values, instead of raw values

    if (options.values) {
      for (const [index, row] of data.entries()) {
        values[index] = [];
        for (const cell of row) {
          values[index].push(cell.calculated);
        }
      }
    }
    else {
      for (const [index, row] of data.entries()) {
        values[index] = [];
        for (const cell of row) {
          values[index].push(cell.value);
        }
      }
    }

    // batch to limit events, sync up undo

    return this.Batch(() => {

      this.grid.SetRange(resolved, values, {
        r1c1: true, recycle: true,
      });

      if (options.formatting === 'number-formats') {

        // number format only, and apply delta

        for (const address of resolved) {
          const r = (address.row - resolved.start.row) % rows;
          const c = (address.column - resolved.start.column) % columns;
          const number_format = (data[r][c].style || {}).number_format;
          sheet.UpdateCellStyle(address, { number_format }, true);
        }
      }
      else if (options.formatting !== 'target') {

        // use source formatting (default)
        for (const address of resolved) {
          const r = (address.row - resolved.start.row) % rows;
          const c = (address.column - resolved.start.column) % columns;
          sheet.UpdateCellStyle(address, data[r][c].style || {}, false);
        }

      }

    }, true);


  }

  /**
   * copy data. this method returns the copied data. it does not put it on
   * the system clipboard. this is for API access when the system clipboard 
   * might not be available.
   * 
   * @privateRemarks LLM API
   */
  public Copy(source?: RangeReference): ClipboardData {
    return this.CopyInternal(source, 'copy');
  }

  /**
   * cut data. this method returns the cut data. it does not put it on the 
   * system clipboard. this method is similar to the Copy method, with 
   * two differences: (1) we remove the source data, effectively clearing
   * the source range; and (2) the clipboard data retains references, meaning
   * if you paste the data in a different location it will refer to the same
   * cells.
   * 
   * @privateRemarks LLM API
   */
  public Cut(source?: RangeReference): ClipboardData {
    return this.CopyInternal(source, 'cut');
  }
 
  /** 
   * 
   * @param range target range. leave undefined to use current selection.
   * 
   * @public
   */
  public GetRange(range?: RangeReference, options: GetRangeOptions = {}): CellValue|CellValue[][]|undefined {

    // API v1 OK

    if (!range) {
      const selection = this.GetSelectionReference();
      if (!selection.empty) {
        range = selection.area;
      }
    }

    if (!range) { return undefined; }

    // handle the old flags and the precedence rule. type takes precedence.

    let type = options.type;

    if (!type) {
      if (options.formatted) {
        type = 'formatted';
      }
      if (options.formula) {
        type = 'A1';
      }
    }

    // alias
    
    if (type === 'formula') {
      type = 'A1';
    }

    return this.grid.GetRange(this.model.ResolveAddress(range, this.grid.active_sheet), type);

  }

  /**
   * returns the style from the target address or range. 
   * 
   * @privateRemarks
   * optimally this could be consolidated with the `GetRange` function, but 
   * that requires some gymnastics to manage the return type which I'm not 
   * willing (at the moment) to do.
   * 
   * @param range - target range. leave undefined to use current selection
   * @param apply_theme - include theme defaults when returning style
   * 
   */
  public GetStyle(range?: RangeReference, apply_theme = false): CellStyle|CellStyle[][]|undefined {

    // API v1 OK

    if (!range) {
      const selection = this.GetSelectionReference();
      if (!selection.empty) {
        range = selection.area;
      }
    }

    if (!range) { return undefined; }

    return this.grid.GetRangeStyle(this.model.ResolveAddress(range, this.grid.active_sheet), apply_theme);
    
  }

  /*
  public OffsetFormula(formula: string, base: ICellAddress): string|undefined {

  }
  */

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
      const area = this.model.ResolveArea(range, this.grid.active_sheet);

      if (options.spill && Array.isArray(data)) {
        const rows = data.length;
        const columns = Math.max(0, ...data.map(row => row.length));
        const target = { 
          row: area.start.row + rows + 1, 
          column: area.start.column + columns + 1,
        }
        area.ConsumeAddress(target);
      }

      // I wanted to do R1C1 translation here, but it's not really 
      // feasible because the grid does things like recycle and transpose.
      // we want to leave those in grid, because they are used in other
      // cases as well -- like paste. so we probably need to do R1C1 in 
      // grid, where we have better access to the final source/target data.

      // we still want to limit R1C1 to API (and not in-cell, for example)
      // so we'll use a flag.

      // FIXME: should we gate R1C1 on an option? might reduce reliance for now.

      // also just FYI we don't support R1C1 as the range argument, only 
      // values.

      // ---

      return this.grid.SetRange(area, data, options);

      // return this.grid.SetRange(
      //  area, data, options.recycle, options.transpose, options.array, !!options.r1c1); // <-- add r1c1 flag

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

  /**
   * internal composite for cut/copy. mostly identical except we 
   * read data as A1 for cut, so it will retain references. also
   * cut clears the data.
   * 
   * FIXME: merge with grid cut/copy/paste routines. we already
   * handle recycling and relative addressing, the only thing missing
   * is alternate formats.
   */
  protected CopyInternal(source?: RangeReference, semantics: 'cut'|'copy' = 'copy'): ClipboardData {

    if (!source) {
      const selection = this.GetSelectionReference();
      if (!selection.empty) {
        source = selection.area;
      }
      else {
        throw new Error('no range and no selection');
      }
    }

    // resolve range so we can use it later -> Area
    const resolved = this.model.ResolveArea(source, this.grid.active_sheet);
    const sheet = (resolved.start.sheet_id ? this.model.sheets.Find(resolved.start.sheet_id) : this.grid.active_sheet) || this.grid.active_sheet;

    // get cell data as R1C1 for copy but A1 for cut. 
    const r1c1 = this.grid.GetRange(resolved, semantics === 'cut' ? 'A1' : 'R1C1') as CellValue[][];

    // get style data, !apply theme but do apply r/c styles
    const styles = sheet.GetCellStyle(resolved, false);

    // get calculated values
    let calculated = sheet.cells.GetRange(resolved.start, resolved.end);
    if (!Array.isArray(calculated)) {
      calculated = [[calculated]];
    }

    const data: ClipboardData = [];

    for (const [r, row] of r1c1.entries()) {
      data[r] = [];
      for (const [c, value] of row.entries()) {

        data[r][c] = {
          value,
          calculated: calculated[r][c],
          style: styles[r]?.[c],
        };
      }
    } 

    EmbeddedSpreadsheet.clipboard = structuredClone(data);

    if (semantics === 'cut') {
      this.grid.SetRange(resolved, undefined, { recycle: true }); // clear
    }

    return data;
        
  }

  // --- moved from grid/grid base ---------------------------------------------

  
  /**
   * serialize data model. moved from grid/grid base. this is moved so we 
   * have access to the calculator, which we want so we can do function 
   * translation on some new functions that don't necessarily map 1:1 to 
   * XLSX functions. we can also do cleanup on functions where we're less
   * strict about arguments (ROUND, for example).
   * 
   */
  protected Serialize(options: SerializeOptions = {}): SerializedModel {

    const active_sheet = this.grid.active_sheet; // I thought this was in view? (...)

    active_sheet.selection = JSON.parse(JSON.stringify(this.grid.GetSelection()));

    // same for scroll offset

    const scroll_offset = this.grid.ScrollOffset();
    if (scroll_offset) {
      active_sheet.scroll_offset = scroll_offset; // this.grid.layout.scroll_offset;
    }    

    // NOTE: annotations moved to sheets, they will be serialized in the sheets

    const sheet_data = this.model.sheets.list.map((sheet) => sheet.toJSON(options));

    // OK, not serializing tables in cells anymore. old comment about this:
    // 
    // at the moment, tables are being serialized in cells. if we put them
    // in here, then we have two records of the same data. that would be bad.
    // I think this is probably the correct place, but if we put them here
    // we need to stop serializing in cells. and I'm not sure that there are 
    // not some side-effects to that. hopefully not, but (...)
    // 

    let tables: Table[] | undefined;
    if (this.model.tables.size > 0) {
      tables = Array.from(this.model.tables.values());
    }

    // NOTE: moving into a structured object (the sheet data is also structured,
    // of course) but we are moving things out of sheet (just  named ranges atm))

    let macro_functions: MacroFunction[] | undefined;

    if (this.model.macro_functions.size) {
      macro_functions = [];
      for (const macro of this.model.macro_functions.values()) {
        macro_functions.push({
          ...macro,
          expression: undefined,
        });
      }
    }

    const named = this.model.SerializeNames(active_sheet);

    return {
      sheet_data,
      active_sheet: active_sheet.id,
      named: named.length ? named : undefined,
      macro_functions,
      tables,
    };

  }

  // --- /moved ----------------------------------------------------------------

  /**
   * 
   */
  protected ApplyConditionalFormats(sheet: Sheet, call_update: boolean) {

    // const sheet = this.grid.active_sheet;
    const areas: IArea[] = [];

    if (sheet.conditional_formats.length || sheet.flush_conditional_formats) {

      for (const entry of sheet.conditional_formats) {
        areas.push(entry.area);

        // NOTE: we're (optionally) adding the gradient here, instead
        // of when it's created, because we might want to flush this
        // from time to time. specifically, because gradient might use
        // theme colors, we need to flush it when the theme is updated.

        // so don't move it, even though it is tempting. or rewrite to 
        // update on theme changes.

        if (entry.type === 'gradient') {
          if (!entry.internal) {
            entry.internal = {};
          }
          if (!entry.internal.gradient) {
            entry.internal.gradient = new Gradient(entry.stops, this.grid.theme, entry.color_space);
          }
        }
      }

      sheet.ApplyConditionalFormats();

    }

    if (call_update) {
      this.grid.Update(true, areas);
    }

  }

  protected ResolveTable(reference: RangeReference): Table|undefined {

    let table: Table|undefined = undefined;

    if (typeof reference === 'string') {
      const lc = reference.toLowerCase();
      if (this.model.tables.has(lc)) {
        table = this.model.tables.get(lc);
      }
    }

    if (!table) {

      let address = this.model.ResolveAddress(reference, this.grid.active_sheet);

      if (!IsCellAddress(address)) {
        address = address.start;
      }

      // why are we using a grid function for this? we should move 
      // this to model (or a table manager class that's in model)

      table = this.grid.GetTableReference(address);

    }

    return table;

  }

  /**
   * replacement for (the great) FileSaver lib. we can now rely on all
   * browsers to handle this properly (fingers crossed).
   * 
   * @param blob 
   * @param filename 
   */
  protected SaveAs(blob: Blob, filename: string) {

    const a = this.DOM.Create('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  protected Publish(event: EmbeddedSheetEvent): void {
    this.events.Publish(event);
  }

  /**
   *
   */
   protected async ImportXLSX( // data: string, source: LoadSource): Promise<Blob | void> {
    data: ArrayBuffer, source: LoadSource): Promise<Blob | void> {

    // this is inlined to ensure the code will be tree-shaken properly
    if (!process.env.XLSX_SUPPORT) {
      console.warn('this build does not include xlsx support.');
      return;
    }

    if (this.parent_view) {
      return this.parent_view.ImportXLSX(data, source);
    }

    if (!this.export_worker) {
      this.export_worker = await this.LoadWorker();
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
            this.UpdateAC();

            // this one _is_ the grid cells

            // this.calculator.AttachModel();
            this.Publish({ type: 'load', source, });
            this.UpdateDocumentStyles();

            // add to support import charts

            this.InflateAnnotations();

            // and conditional formats

            this.calculator.UpdateConditionals();
            this.ApplyConditionalFormats(this.grid.active_sheet, false);
            
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

    // const type = event.data?.type;
    if (event.data?.type === 'hyperlink') {

      const hyperlink_error = 'hyperlink invalid target';
      const data = event.data.reference || '';

      if (typeof data === 'string') {

        if (/^https{0,1}:\/\//i.test(data)) {

          if (!this.options.hyperlinks) {
            console.warn('hyperlinks are disabled');
            return;
          }

          const a = this.DOM.Create('a');
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
      this.calculator.UpdateAnnotations(annotation, event.activate);

    }

    // we also need to update annotations that are already inflated
    // [FIXME: merge this code]

    this.UpdateAnnotations();

    // we don't really need to call UpdateConditionals here unless
    // something has changed in a previously inactive sheet -- right?

    this.calculator.UpdateConditionals();

    // we do need to call apply (I think)

    this.ApplyConditionalFormats(event.activate, true);

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
        this.InsertImageInternal(file);
      }
      else {
        this.LoadFileInternal(file, LoadSource.DRAG_AND_DROP).catch(() => undefined);
      }
    }
  }

  /**
   * I'm restructuring the select file routine to simplify, in service
   * of figuring out what's going wrong in OSX/Chrome. the current routine
   * is unecssarily complicated.
   * 
   * the original concern was that you don't receive a "cancel" event from
   * the file chooser dialog; but that is only relevant if you have ephemeral
   * dialogs. if you have a constant dialog (html input element) you don't need
   * to do this asynchronously because the dialog blocks.
   * 
   * the downside is that you can't get a return value from 'LoadFile' or 
   * 'InsertImage'. not sure how much of a problem that is. need to check
   * what RAW does.
   * 
   * 
   * @param accept 
   */
  protected SelectFile2(accept: string, operation: FileChooserOperation) {

    if (!this.file_chooser) {
      const file_chooser = this.DOM.Create('input', undefined, undefined, {
        attrs: { type: 'file' },
        events: {
          change: () => {
            if (file_chooser.files && file_chooser.files[0]) {
              const file = file_chooser.files[0];
              file_chooser.value = '';
              switch (this.file_chooser_operation) {
                case FileChooserOperation.InsertImage:
                  this.InsertImageInternal(file);
                  break;
                case FileChooserOperation.LoadFile:
                  this.LoadFileInternal(file, LoadSource.LOCAL_FILE, true);
                  break;
                default:
                  console.warn('file chooser: no operation');
                  break;
              }
            }
          },
        },
      });
      this.file_chooser = file_chooser;
    }

    if (!this.file_chooser) {
      throw new Error('could not create file chooser');
    }

    this.file_chooser_operation = operation;
    this.file_chooser.accept = accept || '';
    this.file_chooser.click();

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
   protected async InsertImageInternal(file: File): Promise<void> {

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

            const img = this.DOM.Create('img');
            img.src = contents;

            // this is to let the browser figure out the image size.
            // we should maybe use requestAnimationFrame? 

            await Promise.resolve();

            // note: this works, somewhat contrary to expectations,
            // probably because there are some async calls; hence the
            // src attribute is set before it's inflated. 

            // const annotation = 
            this.grid.CreateAnnotation({
              type: 'image',
              formula: '',
              data: {
                scale: '',
                src: contents,
                original_size: { width: img.width || 300, height: img.height || 300 },
              },
            }, undefined, undefined, {
              top: 30,
              left: 30,
              width: img.width || 300,
              height: img.height || 300,
            });

            // annotation.data.src = contents;
            // annotation.data.original_size = { width: img.width || 300, height: img.height || 300 };

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

  /** called when we have a file to write to */
  protected LoadFileInternal(file: File, source: LoadSource, dialog = true): Promise<void> {

    if (!file) { return Promise.resolve(); }

    const reader = new FileReader();

    return new Promise<void>((resolve, reject) => {

      // FIXME: worker?
      // FIXME: is this not getting called for CSVs? (...)

      const finalize = (err?: string) => {
        reader.onload = null;
        reader.onabort = null;
        reader.onerror = null;

        if (err) {
          if (dialog) {
            this.dialog?.ShowDialog({
              title: 'Error reading file',
              close_box: true,
              message: process.env.XLSX_SUPPORT ? 
                'Please make sure your file is a valid XLSX, CSV or TREB file.' :
                'Please make sure your file is a valid CSV or TREB file.' ,
              type: DialogType.error,
              timeout: 3000,
            });
            console.error(err);
          }
          reject(err);
        }
        else resolve();
      };

      reader.onload = () => {

        try {
          if (reader.result) {
            if (/\.csv$/i.test(file.name)) {
              this.LoadCSV(reader.result as string, source);
            }
            else if (process.env.XLSX_SUPPORT &&  /\.xls[xm]$/i.test(file.name)) {
              if (typeof reader.result === 'string') {
                finalize('Unsupported file');
              }
              else {
                this.ImportXLSX(reader.result, source).then(() => finalize()).catch(err => finalize(err));
              }
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
        if (/\.xls[xm]$/i.test(file.name)) {
          reader.readAsArrayBuffer(file);
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

    for (const annotation of this.grid.active_sheet.annotations) {

      const vertex_data = annotation.temp as { vertex?: StateLeafVertex, state?: number };

      if (vertex_data.vertex) {
        if (vertex_data.vertex.state_id !== vertex_data.state) {
          vertex_data.state = vertex_data.vertex.state_id;

          // set all views dirty in this case
          for (const view of annotation.view) {
            view.dirty = true;
          }
        }

          /*
          const view: AnnotationViewData = annotation.view[this.grid.view_index] || {};
          if (view.update_callback) {
            view.update_callback();
          }

          this.grid.AnnotationUpdated(annotation);
          */
      }

      const view: AnnotationViewData = annotation.view[this.grid.view_index] || {};
      if (view.dirty) {

        // either we just set this dirty for all views, or another
        // view set it dirty for us: in either case, update

        if (view.update_callback) {
          view.update_callback();
        }

        this.grid.AnnotationUpdated(annotation);

      }

    }

    this.UpdateConnectedElements();

  }

  protected UpdateConnectedElements() {
    for (const element of this.model.connected_elements.values()) {
      const internal = (element.internal) as { vertex: StateLeafVertex, state: unknown };
      if (internal?.vertex && internal.vertex.state_id !== internal.state ) {
        internal.state = internal.vertex.state_id;
        const fn = element.update; 
        if (fn) {

          // FIXME: what if there are multiple calls pending? some 
          // kind of a dispatch system might be useful

          Promise.resolve().then(() => fn.call(0, element));

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
    for (const annotation of this.grid.active_sheet.annotations) {
      this.InflateAnnotation(annotation);
      const view: AnnotationViewData = annotation.view[this.grid.view_index] || {};

      if (view.resize_callback) {
        view.resize_callback();
      }
      if (view.update_callback) {
        view.update_callback();
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
    for (const annotation of this.grid.active_sheet.annotations) {
      this.InflateAnnotation(annotation);
    }
  }

  protected InflateAnnotation(annotation: Annotation): void {

    if (this.grid.headless) { return; }
    const view: AnnotationViewData = annotation.view[this.grid.view_index] || {};

    // only inflate once, to prevent overwriting instance methods

    if (view.inflated) {

      // I don't think we're using dirty anymore... actually we still
      // need it right now. it gets _set_ on express scale change, so
      // when we switch back to this sheet it will be updated even though
      // the data has not changed.

      // assuming rendering charts is fairly cheap, the alternative would
      // be to just always repaint. OTOH what is the cost of this flag?

      if (annotation.dirty) {

        if (view.resize_callback) {
          view.resize_callback();
        }
        annotation.dirty = false;
      }
      return;
    }

    view.inflated = true;

    if (annotation.dirty) {
      annotation.dirty = false;
    }

    // why was this testing for data? that would always exist on an annotation
    // instance (but not in our new data type). maybe some legacy thing? 

    if (view.content_node ) { // && annotation.annotation_data.data) {

      if (annotation.data.type === 'treb-chart') {

        // if (!(self as any).TREB || !(self as any).TREB.CreateChart2) {
        //    console.warn('missing chart library');
        // }
        // else 
        {

          const chart = this.CreateChart();
          chart.Initialize(view.content_node);

          //if (this.calculator.RegisterLibrary('treb-charts', ChartFunctions)) {
          //  this.UpdateAC();
          //}

          const update_chart = () => {

            if (annotation.data.formula) {
              const parse_result = this.parser.Parse(annotation.data.formula);
              if (parse_result &&
                parse_result.expression &&
                parse_result.expression.type === 'call') {

                // FIXME: make a method for doing this

                this.parser.Walk(parse_result.expression, (unit) => {
                  if (unit.type === 'address' || unit.type === 'range') {
                    this.model.ResolveSheetID(unit, undefined, this.grid.active_sheet);
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
          view.resize_callback = () => {
            if (!this.grid.headless) {
              chart.Resize();
              chart.Update();
            }
          };

          /** update callback */
          view.update_callback = () => {
            if (!this.grid.headless) {
              update_chart();
            }
          };

          /** call once */
          if (view.node?.parentElement) {
            if (!this.grid.headless) {
              update_chart();
            }
          }

        }

      }
      else if (annotation.data.type === 'image') {
        if (typeof annotation.data.data?.src === 'string') {

          const reference = ValidateURI(annotation.data.data.src);
          if (reference) {
 
            const img = this.DOM.Create('img');
            img.src = reference;

            if (annotation.data.data.scale === 'fixed') {
              img.style.position = 'relative';
              img.style.left = '50%';
              img.style.top = '50%';
              img.style.transform = 'translate(-50%, -50%)';
            }
            else {
              img.style.width = '100%';
              img.style.height = '100%';
            }

            view.content_node.appendChild(img);
          }
        }

      }
      else if (annotation.data.type === 'textbox') {

        if (annotation.data.data) {
          const container = document.createElement('div');
          container.classList.add('treb-annotation-textbox');

          for (const paragraph of annotation.data.data.paragraphs) {
            const p = document.createElement('p');
            if (paragraph.style) {
              if (paragraph.style.horizontal_align === 'right' || 
                  paragraph.style.horizontal_align === 'center') {
                p.style.textAlign = paragraph.style.horizontal_align;
              }
            }

            for (const entry of paragraph.content) {
              const span = document.createElement('span');
              span.textContent = entry.text || '';
              if (entry.style?.bold) {
                span.style.fontWeight = '600';
              }
              if (entry.style?.italic) {
                span.style.fontStyle = 'italic';
              }
              p.appendChild(span);
            }
            container.append(p);
          }

          view.content_node.append(container);

          if (annotation.data.data.style) {

            const style = annotation.data.data.style;
            const update_textbox = () => {

              if (style.fill) {
                const color = ResolveThemeColor(this.grid.theme, style.fill);
                container.style.background = color;
              }

            };

            view.update_callback = () => {
              if (!this.grid.headless) {
                update_textbox();
              }
            };

            update_textbox();

          }

        }

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

    Promise.resolve().then(() => {

      // console.info('serializing');

      this.file_version++; // increment (roll at 2^16)
      if (this.file_version >= 65536) {
        this.file_version = 1;
      }

      // FIXME: use override to set this flag?

      const json = JSON.stringify(this.SerializeDocument({
        optimize: 'size',
        rendered_values: true,
        expand_arrays: true,
      } as SerializeOptions));

      // console.info(json);

      // why are we saving this here? and should we not route
      // through the method? I guess the question should be, is
      // the visibilitychange handler not sufficient to save the
      // file? (...)

      // I would prefer to just save once, on visibilitychange -> hidden.
      // the problem is that this method gets called on "data" events,
      // which should not trigger saving. we could check the flag?

      // if this does come back, (1) use a method -- maybe split the 
      // SaveLocalStorage method in two, and call the inner half (because
      // we've already serialized); and (2) gate on dirty.

      // but for the time being we're removing it.

      /*
      if (this.options.local_storage) {
        localStorage.setItem(this.options.local_storage, json);
      }
      */

      if (this.options.undo) {
        this.PushUndo(json, undo_selection, false);
      }

      this.Publish({ type: 'document-change' });

    });
  }

  /**
   * if we have a boolean for a storage key, generate a (weak) hash
   * based on document URI. use the prefix to create separate keys
   * when using the autogenerated key (uri hash)
   */
  protected ResolveStorageKey(key?: string|boolean, prefix = ''): string|undefined {

    if (!key) { 
      return undefined;
    }

    if (key === true) {
      let hash = 0;
      const data = document.location.href;
      for (let i = 0, len = data.length; i < len; i++) {
        hash = (hash << 5) - hash + data.charCodeAt(i);
        hash |= 0; 
      }
      const generated = Math.abs(hash).toString(16);
      return prefix ? prefix + '-' + generated : generated;
    }

    return key;
  }

  /**
   * 
   * @param json -- the serialized data is already calculated. that happens
   * when we are storing to localStorage as part of handling a change; since
   * we already have the json, we can pass it through. although we should
   * switch around the order, it would make it a little easier to manage.
   * 
   * @param increment -- increment the file version. this is a parameter
   * so we can _not_ increment on the initial state push, on load.
   */
  protected PushUndo(json?: string, last_selection?: string, increment = true): void {

    const selection = last_selection || this.last_selection;

    // console.info('push undo', JSON.stringify(selection));

    if (this.undo_stack[this.undo_pointer - 1]) {
      this.undo_stack[this.undo_pointer - 1].selection = selection;
      // console.info('set at pointer', this.undo_pointer-1, this.last_selection);
    }

    if (increment) {
      this.file_version++; // increment (roll at 2^16)
      if (this.file_version >= 65536) {
        this.file_version = 1;
      }
    }

    if (!json) {
      json = JSON.stringify(this.SerializeDocument({
        optimize: 'size',
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

  }

  /**
   * clear the undo stack, and optionally push an initial state
   */
  protected FlushUndo(push = true): void {

    // console.info('flush undo');

    this.undo_stack = [];
    this.undo_pointer = 0;
    this.last_save_version = this.file_version;

    if (push) {
      this.PushUndo(undefined, undefined, false);
    }

    // this.last_save_version = this.file_version = 0;

    // don't reset file version here. this is called from three places:
    //
    // (1) constructor 
    // (2) load
    // (3) reset 
    //
    // reset already sets this to 0. load should load from the
    // file, and constructor will default to 0 unless there's a load.

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
      let data = this.grid.active_sheet.CellData(selection.target);

      state.table = !!data.table;
      state.merge = !!data.merge_area;

      if (state.merge && data.merge_area && (
        data.merge_area.start.row !== selection.target.row ||
        data.merge_area.start.column !== selection.target.column)) {
        data = this.grid.active_sheet.CellData(data.merge_area.start);
      }

      state.comment = data.note;
      state.style = data.style ? { ...data.style } : undefined;
      state.relative_font_size = Style.RelativeFontSize(state.style || {}, this.grid.theme.grid_cell || {});

    }

    this.selection_state = state;
    // this.toolbar?.UpdateState(state);

  }

  protected UpdateDocumentStyles(): void {

    const number_format_map: Record<string, number> = {};
    const color_map: Record<string, number> = {};

    for (const sheet of this.grid.model.sheets.list) {
      sheet.NumberFormatsAndColors(color_map, number_format_map);
    }

    this.document_styles.colors = Object.keys(color_map);
    this.document_styles.number_formats = Object.keys(number_format_map);

    // FIXME: this could probably be limited to theme changes, since that 
    // happens less often than other things which trigger the update

    this.document_styles.theme_colors = [];
    const tints = [.50, .25, 0, -.25, -.50];
    for (let i = 0; i < 10; i++) {
      this.document_styles.theme_colors.push(tints.map(tint => {
        const color: Color = { theme: i, tint };
        const resolved = ResolveThemeColor(this.grid.theme, color);
        return { color, resolved };
      }));
    }

    /*
    if (!this.toolbar) {
      return;
    }

    this.toolbar.UpdateDocumentStyles(
      Object.keys(number_format_map),
      Object.keys(color_map),
      update);

    // console.info(number_format_map, color_map);
    */

  }

  /* * overloadable for subclasses * /
  protected InitCalculator(): CalcType {
    return new Calculator();
  }
  */

  /**
   * this function is called when the file locale (as indicated by the
   * decimal separator) is different than the current active locale.
   * 
   * so we know that we want to translate. that's why there are no tests
   * in this function.
   */
  protected ConvertLocale(data: TREBDocument): void {

    // FIXME: belongs in model? (...)

    // NOTE: we use a new parser instance here because we're modifying
    // the localization flags; seems safer to use a separate instance and
    // not change the local instance

    // this is an issue, though, if we need to keep parser flags in sync.
    // as long as all flags are in the same place, we could just copy...

    // still, that's an issue generally as we have parsers in a couple
    // of different places. at a minimum we should share parsers across
    // each context (main/worker). atm we have one instance in calculator
    // and a different one in grid...

    // seems like in this case we could just cache/set/reset. shouldn't
    // be an issue. (famous last words...)

    // FIXME: need a way to share/pass parser flags

    const parser = new Parser();
    parser.flags = {...this.parser.flags}; // <-- this is one way

    let target_decimal_mark: DecimalMarkType;
    let target_argument_separator: ArgumentSeparatorType;

    // FIXME: these conversions should be easier... we should have a simple
    // switch in the parser/renderer function

    // FIXME: also we should unify on types for decimal, argument separator

    if (data.decimal_mark === '.') {
      // parser.decimal_mark = DecimalMarkType.Period;
      // parser.argument_separator = ArgumentSeparatorType.Comma;
      parser.SetLocaleSettings(DecimalMarkType.Period);

      target_decimal_mark = DecimalMarkType.Comma;
      target_argument_separator = ArgumentSeparatorType.Semicolon;
    }
    else {
      // parser.decimal_mark = DecimalMarkType.Comma;
      // parser.argument_separator = ArgumentSeparatorType.Semicolon;
      parser.SetLocaleSettings(DecimalMarkType.Comma);

      target_decimal_mark = DecimalMarkType.Period;
      target_argument_separator = ArgumentSeparatorType.Comma;
    }

    const translate = (formula: string): string | undefined => {
      const parse_result = parser.Parse(formula);
      if (!parse_result.expression) { return undefined; }
      return '=' + parser.Render(
        parse_result.expression, { 
          missing: '', 
          convert_decimal: target_decimal_mark, 
          convert_argument_separator: target_argument_separator,
        });
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
          for (const annotation of (sheet_data.annotations)) {
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
      SemanticVersionElement.major, 
      SemanticVersionElement.minor, 
      SemanticVersionElement.patch
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

    this.file_version = data.revision || 0;
    // console.info("IDD: file version ->", this.file_version);

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

    if (data.shared_resources) {

      const shared = data.shared_resources;

      const Unshare = (resource: string) => {
        if (/^resource:/.test(resource)) {
          return shared[resource.substring(9)] || '';
        }
        return resource;
      }

      for (const sheet of sheets) {
        if (sheet.background_image) {
          sheet.background_image = Unshare(sheet.background_image);
        }
        for (const annotation of sheet.annotations || []) {
          if (annotation.type === 'image' && annotation.data?.src) {
            annotation.data.src = Unshare(annotation.data.src);
          }
        }
      }

    }

    // FIXME: it's not necessary to call reset here unless the
    // document fails, do that with a trap?

    // l10n

    if (data.decimal_mark && data.decimal_mark !== Localization.decimal_separator) {
      this.ConvertLocale(data);
    }

    const model = this.grid.model;
    model.tables.clear();
    if (data.tables) {
      for (const table of data.tables) {
        model.tables.set(table.name.toLowerCase(), table);
      }
    }

    // why is it not complaining about this? (...)

    this.grid.UpdateSheets(sheets, undefined, override_sheet || data.active_sheet);

    for (const table of this.model.tables.values()) {
        if (table.area.start.sheet_id) {
        const sheet = model.sheets.Find(table.area.start.sheet_id);
        if (sheet) {
          for (let row = table.area.start.row; row <= table.area.end.row; row++) {
            for (let column = table.area.start.column; column <= table.area.end.column; column++) {
              const cell = sheet.cells.GetCell({row, column}, true);
              cell.table = table;
            }
          }
        }
      }
    }

    model.document_name = data.name;
    model.user_data = data.user_data;

    // resets for both named ranges and named expressions, until we consolidate
    model.named.Reset(); 

    if (data.named) {
      this.model.UnserializeNames(data.named, this.grid.active_sheet);
    }
    else {

      // console.info("using old-style name import")

      //------------------------------------------------------------------------
      //
      // old style handling of named ranges and expressions. we'll leave
      // this here for the time being. [update: rewriting slightly to share 
      // some code]
      //
      //------------------------------------------------------------------------

      // old models have it in sheet, new models have at top level -- we can
      // support old models, but write in the new syntax

      let named_range_data = data.named_ranges;
      if (!named_range_data && sheets[0] && sheets[0].named_ranges) {
        named_range_data = sheets[0].named_ranges;
      }

      if (named_range_data) {
        for (const [name, value] of Object.entries(named_range_data)) {
          model.named.SetNamedRange(name, new Area(value.start, value.end));
        }
      }

      // when importing named expressions, we have to make sure there's a
      // sheet ID attached to each range/address. hopefully we have serialized
      // it with a sheet name so we can look up.

      // model.named_expressions.clear(); // already reset (composite w/ named ranges)

      if (data.named_expressions) {
        for (const pair of data.named_expressions) {

          this.model.UnserializeNames([{
            name: pair.name,
            expression: pair.expression,
          }], this.grid.active_sheet);

        }
      }

    }

    model.macro_functions.clear();
    if (data.macro_functions) {
      for (const macro_function of data.macro_functions) {

        // FIXME: i18n of expression
        // FIXME: autocomplete (also when you do that, remember to undo it)

        model.macro_functions.set(macro_function.name.toUpperCase(), {
          ...macro_function,
          expression: this.parser.Parse(macro_function.function_def || '').expression,
        });

      }
    }

    this.UpdateAC();

  }

  /**
   * load worker. optionally uses an ambient path as prefix; intended for
   * loading in different directories (or different hosts?)
   */
  protected async LoadWorker(): Promise<Worker> {

    // this is inlined to ensure the code will be tree-shaken properly
    // (we're trying to force it to remove the imported worker script)

    if (process.env.XLSX_SUPPORT) {
    
      // for esm we now support embedding the worker as a blob
      // (as text, actually); we can construct it from the text 
      // as necessary.

      if (export_worker_script) {
        try {
          const worker = new Worker(
              URL.createObjectURL(new Blob([(export_worker_script as {default: string}).default], { type: 'application/javascript' })));
          return worker;
        }
        catch (err) {
          console.info('embedded worker failed');
          console.error(err);
        }
      }

    } 
    else {
      console.warn('this build does not include xlsx support.');
    }

    throw new Error('creating worker failed');

  }

  /**
   * handle key down to intercept ctrl+z (undo)
   * UPDATE: we're also handling F9 for recalc (optionally)
   * 
   * FIXME: redo (ctrl+y or ctrl+shift+z)
   */
  protected HandleKeyDown(event: KeyboardEvent): void {

    // can we drop the event.code stuff in 2024? (YES)

    if (event.ctrlKey && (event.code === 'KeyZ' || event.key === 'z')) {
      event.stopPropagation();
      event.preventDefault();
      this.Undo();
    }
    else if (event.key === 'F9' && this.options.recalculate_on_f9) {
      event.stopPropagation();
      event.preventDefault();
      this.Recalculate();
    }

  }


}
