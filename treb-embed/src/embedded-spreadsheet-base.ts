
// treb imports
import { Grid, GridEvent, SerializeOptions, Annotation,
         BorderConstants, SheetChangeEvent, GridOptions } from 'treb-grid';
import { Parser, DecimalMarkType, ArgumentSeparatorType } from 'treb-parser';
import { LeafVertex } from 'treb-calculator';
import { Calculator } from 'treb-calculator';
import { IsCellAddress, Localization, Style, ICellAddress, Area, IArea } from 'treb-base-types';
import { EventSource, Resizable, Yield } from 'treb-utils';
import { NumberFormatCache, ValueParser } from 'treb-format';

// local
//import { MaskDialog } from './mask-dialog';
import { ProgressDialog } from './progress-dialog';
import { EmbeddedSpreadsheetOptions, DefaultOptions } from './options';
import { EmbeddedSheetEvent, TREBDocument, SaveFileType } from './types';

// TYPE ONLY
// type FormattingToolbar = import('treb-toolbar/src/toolbar-main').FormattingToolbar;
// import { ToolbarOptions } from 'treb-toolbar/src/toolbar-options';

import { ToolbarOptions, FormattingToolbar } from 'treb-toolbar';

// TYPE ONLY
type Chart = import('../../treb-charts/src/index').Chart;

// 3d party modules
// import { Base64 } from 'js-base64';
import * as FileSaver from 'file-saver';

// style
import 'treb-grid/style/grid.scss';
import 'treb-base-types/style/resizable.css';
import '../style/embed.scss';

// config
// import * as build from '@root/package.json';
import * as build from '../../package.json';

/*
enum ToolbarLoadState {
  NotLoaded = 0,
  Loading   = 1,
  Loaded    = 2,
  Error     = 3,
}
*/

/**
 * embedded spreadsheet, suitable for one-line embedding in a web page
 *
 * FIXME: let's encapsulate the event source and just expose
 * subscribe/cancel methods
 */
export class EmbeddedSpreadsheetBase extends EventSource<EmbeddedSheetEvent> {

  public static treb_base_path = '';
  public static treb_language = '';
  public static treb_embedded_script_path = '';

  /**
   * we need to load relative resources. we can't access the path of this
   * script, but because it has to be added via a script tag -- either
   * statically or dynamically -- we should be able to get it.
   *
   * it is possible that the script tag goes away, but if we sniff on first
   * script execution, we can probably assume it's still there -- because the
   * client won't have had a chance to remove it yet.
   */
  public static SniffPath() {
    const tags = document.querySelectorAll('script');

    // FIXME: fragile!
    const default_script_name = (build as any)['build-entry-points'].main;
    const rex = new RegExp(default_script_name);

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < tags.length; i++ ){
      const tag = tags[i];
      const src = tag.getAttribute('src');

      if (src && rex.test(src)) {
        this.treb_embedded_script_path = src;
        this.treb_base_path = src.replace(new RegExp(default_script_name + '.*$'), '');
        return;
      }

    }

    // console.warn('treb: base path not found');

  }

  /** name moved to model */
  public get document_name() {
    return this.grid.model.document_name;
  }

  /** name moved to model */
  public set document_name(name: string|undefined) {
    this.grid.model.document_name = name;
    this.DocumentChange();
  }

  /** user data moved to model */
  public get user_data() {
    return this.grid.model.user_data;
  }

  /** user data moved to model */
  public set user_data(data: any|undefined) {
    this.grid.model.user_data = data;
  }

  /** state of toolbar load. this is dynamic, but we are not using webpack chunks. */
  // private static formatting_toolbar_state: ToolbarLoadState = ToolbarLoadState.NotLoaded;

  /**
   * this is not assigned here (it's assigned in a method) so we can
   * overload it. this is not a good pattern, though. is there a better
   * alternative?
   *
   * the answer is probably to pass an instance to the constructor, have
   * the caller determine which type to use (as long as there's a common
   * base class).
   */
  protected calculator!: Calculator;

  protected grid: Grid;

  protected options: EmbeddedSpreadsheetOptions;

  /** FIXME: can we share grid's parser instance? */
  private parser = new Parser();

  private node: HTMLElement;
  private file_chooser?: HTMLInputElement;
  private dialog: ProgressDialog;

  private toolbar?: FormattingToolbar;

  /**
   * export worker (no longer using worker-loader).
   * export worker is loaded on demand, not by default.
   */
  private export_worker?: Worker;

  /**
   * keep track of what we've registered, for external libraries
   * (currently charts), which is per sheet instance.
   */
  private registered_libraries: {[index: string]: any} = {};

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
  private undo_stack: any[] = [];
  private block_undo = false;

  constructor(options: EmbeddedSpreadsheetOptions) {

    super();

    // consolidate options w/ defaults. note that this does not
    // support nested options, for that you need a proper merge

    this.options = { ...DefaultOptions, ...options };

    let network_document = this.options.network_document;

    // optionally data from storage, with fallback

    let data: any;
    if (this.options.storage_key && !this.options.toll_initial_load) {
      data = localStorage.getItem(this.options.storage_key);
      if (!data && this.options.alternate_document) {
        network_document = this.options.alternate_document;
      }
      window.addEventListener('beforeunload', () => {
        if (this.options.storage_key) {
          this.SaveLocalStorage(this.options.storage_key);
        }
      });
    }

    let container: HTMLElement;

    if (typeof options.container === 'string') {
      container = document.getElementById(options.container) as HTMLElement;
    }
    else {
      container = options.container;
    }

    this.node = document.createElement('div');
    this.node.setAttribute('class', 'treb-embed-container');
    container.appendChild(this.node);

    // handle key. TODO: move undo to grid (makes more sense)

    container.addEventListener('keydown', this.HandleKeyDown.bind(this));

    // create + init grid

    const grid_options: GridOptions = {
      expand: false,
      insert_function_button: false,
      in_cell_editor: true,
      // formula_bar: this.options.formula_bar,
      repaint_on_cell_change: false,
      // scrollbars: this.options.scrollbars,
      // tab_bar: this.options.tab_bar,
    };

    if (typeof this.options.formula_bar !== 'undefined') {
      grid_options.formula_bar = this.options.formula_bar;
    }

    if (this.options.expand_formula_button) {
      grid_options.expand_formula_button = this.options.expand_formula_button;
    }
    if (this.options.scrollbars) {
      grid_options.scrollbars = this.options.scrollbars;
    }
    if (typeof this.options.tab_bar !== 'undefined') {
      grid_options.tab_bar = this.options.tab_bar;
    }
    if (this.options.add_tab) {
      grid_options.add_tab = this.options.add_tab;
    }

    if (this.options.expand) {
      grid_options.expand = true;
    }

    this.grid = new Grid(grid_options);

    if (options.headless) {
      this.grid.headless = true; // FIXME: move into grid options
    }

    this.grid.Initialize(this.node);

    this.InitCalculator();

    if (this.options.resizable) {
      const master = container.querySelector('.treb-layout-master');
      const node = container.querySelector('.treb-grid');
      if (node && master) {
        const resizable = new Resizable(container, node as HTMLElement, () => this.Resize(),
          master as HTMLElement);
      }
      // const resizable = new Resizable(container, this.node, () => this.Resize());
    }

    // dnd

    if (this.options.dnd) {
      this.node.addEventListener('dragenter', (event) => this.HandleDrag(event));
      this.node.addEventListener('dragover', (event) => this.HandleDrag(event));
      this.node.addEventListener('drop', (event) => this.HandleDrop(event));
    }

    // set up grid events

    this.grid.grid_events.Subscribe((event) => {
      switch (event.type) {

        case 'selection':
          this.UpdateSelection(event.selection);
          break;

        case 'sheet-change':
          this.OnSheetChange(event);
          break;

        case 'data':
          // console.info('calling recalc', event);
          this.Recalculate(event).then(() => {
            this.DocumentChange();
          });
          break;

        case 'style':
          this.DocumentChange();
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
                break;
              case 'delete':
                this.calculator.RemoveAnnotation(event.annotation); // clean up vertex
                break;
              case 'update':
                if (event.annotation.update_callback) {
                  event.annotation.update_callback();
                }
                else {
                  console.info('annotation update event without update callback');
                }
                this.calculator.UpdateAnnotations(event.annotation);
                break;
              case 'resize':
                if (event.annotation.resize_callback) {
                  event.annotation.resize_callback();
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
          break;
      }
    });

    // FIXME: this should yield so we can subscribe to events before the initial load

    if (data) {
      this.LoadDocument(JSON.parse(data), undefined, undefined, !!options.recalculate);
    }
    this.FlushUndo();

    // FIXME: this is deprecated [what?]
    // [this is now a file property, not an option]

    if (options.freeze_rows || options.freeze_columns) {
      this.grid.Freeze(options.freeze_rows || 0, options.freeze_columns || 0);
    }

    if (typeof options.show_headers !== 'undefined') {
      this.grid.ShowHeaders(options.show_headers);
    }

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
      (self as any)[this.options.global_name] = this;
    }

    if (network_document) {
      this.LoadNetworkDocument(network_document, this.options);
    }

    // create mask dialog

    this.dialog = new ProgressDialog(container, {
      mask: this.grid.theme.interface_dialog_mask,
      border: this.grid.theme.interface_dialog_border,
      background: this.grid.theme.interface_dialog_background,
      text: this.grid.theme.interface_dialog_color,
    });

  }

  public OnSheetChange(event: SheetChangeEvent) {

    // call annotation method(s) on any annotations in active sheet

    for (const annotation of event.activate.annotations) {
      if (annotation.update_callback) {
        annotation.update_callback();
      }
    }

  }

  public HandleDrag(event: DragEvent) {
    if (event.dataTransfer && event.dataTransfer.types && event.dataTransfer.types.some((check) => check === 'Files')) {
      event.preventDefault();
    }
  }

  public HandleDrop(event: DragEvent) {
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
      event.preventDefault();
      this.LoadFileInternal(event.dataTransfer.files[0]).then(() => {
        // ...
      }).catch((err) => {
        this.ShowMessageDialog(
            'Reading the file failed. Make sure your\n' +
            'file is a valid XLSX, CSV or TREB file.', 2500);
        console.error(err);
      });
    }
  }

  /** set freeze area */
  public Freeze(rows = 0, columns = 0) {
    this.grid.Freeze(rows, columns, true);
  }

  /** return current freeze area */
  public GetFreeze() { return this.grid.GetFreeze(); }

  /**
   * update theme if any css properties have changed. this calls
   * the grid method but we also have to update our dialog.
   */
  public UpdateTheme() {
    this.grid.UpdateTheme();
    this.dialog.UpdateTheme({
      mask: this.grid.theme.interface_dialog_mask,
      border: this.grid.theme.interface_dialog_border,
      background: this.grid.theme.interface_dialog_background,
      text: this.grid.theme.interface_dialog_color,
    });
  }

  /**
   * sends data to a new window. used for popout and fork.
   */
  public PostDocument(target: Window, host: string) {

    let ack = false;
    let counter = 0;
    const data = JSON.stringify(this.SerializeDocument(false, true));

    const listener = (event: MessageEvent) => {
      if (event.data === 'ack') {
        ack = true;
        window.removeEventListener('message', listener);
      }
    };

    window.addEventListener('message', listener);

    const try_post = (delay = 100) => {
      if (counter++ > 30) {
        console.warn('timeout');
        return;
      }
      try {
        target.postMessage(data, host);
      }
      catch (e) {
        console.error(e);
      }
      setTimeout(() => {
        if (!ack) try_post(delay);
      }, delay);
    };

    target.focus();
    try_post();

  }

  /**
   * set data in given range
   *
   * @param range target range. if range is smaller than data, range controls.
   * if range is larger, behavior depends on the recycle parameter.
   * @param data single value, array (column), or 2d array
   * @param recycle recycle values. we only recycle single values or vectors -- we will not recycle a matrix.
   * @param transpose transpose before inserting (data is row-major)
   */
  public SetRange(range: ICellAddress|IArea|string, data: any, recycle = false, transpose = false) {

    let area: Area;

    if (typeof range === 'string') {
      const named_range = this.grid.model.named_ranges.Get(range);
      if (named_range) {
        area = named_range.Clone();
      }
      else {
        const addresses = range.split(':');
        if (addresses.length < 2) {
          area = new Area(this.EnsureAddress(addresses[0]));
        }
        else {
          area = new Area(
            this.EnsureAddress(addresses[0]),
            this.EnsureAddress(addresses[1]));
        }
      }
    }
    else if (IsCellAddress(range)) {
      area = new Area(range);
    }
    else {
      area = new Area(range.start, range.end);
    }

    this.grid.SetRange(area, data, recycle, transpose);

  }

  /**
   * format a number with an arbitrary formatter
   */
  public ParseNumber(text: string) {
    return ValueParser.TryParse(text).value;
  }

  /**
   * format a number with an arbitrary formatter
   */
  public FormatNumber(value: number, format: string) {
    return NumberFormatCache.Get(format).Format(value);
  }

  /**
   * evaluate an arbitrary expression in the spreadsheet. you should generally
   * use sheet names when referring to cells, to avoid ambiguity, but relative
   * cells will always be the active, or front, sheet.
   */
  public Evaluate(expression: string): string|number|boolean|undefined {

    const parse_result = this.parser.Parse(expression);
    if (parse_result &&
        parse_result.expression ){ // &&
        // parse_result.expression.type === 'call' ){

      // FIXME: make a method for doing this

      this.parser.Walk(parse_result.expression, (unit) => {
        if (unit.type === 'address' || unit.type === 'range') {
          this.calculator.ResolveSheetID(unit);
        }
        return true;
      });

      const result = this.calculator.CalculateExpression(parse_result.expression);
      return result;

    }

  }

  /**
   * returns range as array (column-major). optionally return raw values (formulae)
   *
   * @param formula set to true to return underlying formula, instead of calculated value
   * @param formatted set to true to return formatted strings instead of numbers
   */
  public GetRange(range: ICellAddress|IArea|string, formula = false, formatted = false) {

    if (typeof range === 'string') {
      const named_range = this.grid.model.named_ranges.Get(range);
      if (named_range) {
        return this.grid.GetRange(named_range, formula, formatted);
      }
      else {
        const addresses = range.split(':');
        if (addresses.length < 2) {
          return this.grid.GetRange(new Area(this.EnsureAddress(addresses[0])), formula, formatted);
        }
        else {
          return this.grid.GetRange(new Area(
            this.EnsureAddress(addresses[0]),
            this.EnsureAddress(addresses[1])), formula, formatted);
        }
      }
    }
    else if (IsCellAddress(range)) {
      return this.grid.GetRange(range, formula, formatted);
    }
    else {
      return this.grid.GetRange(new Area(range.start, range.end), formula, formatted);
    }

  }

  public InsertAnnotation(formula: string, type = 'treb-chart') {

    const x = 30;
    const y = 30;

    this.grid.CreateAnnotation({
      type,
      rect: {top: y, left: x, width: 300, height: 300},
      formula,
    });

  }

  /**
   *
   * @param column column, or columns (array), or undefined means all columns
   * @param width desired width (can be 0) or undefined means 'auto-size'
   */
  public SetColumnWidth(column?: number|number[], width?: number) {
    this.grid.SetColumnWidth(column, width);
  }

  /**
   *
   * @param row row, or rows (array), or undefined means all rows
   * @param height desired height (can be 0) or undefined means 'auto-size'
   */
  public SetRowHeight(row?: number|number[], height?: number) {
    this.grid.SetRowHeight(row, height);
  }

  /**
   * convert A1 address to CellAddress type
   */
  public EnsureAddress(address: string | ICellAddress): ICellAddress {
    const result: ICellAddress = { row: 0, column: 0 };
    if (typeof address === 'string') {
      const parse_result = this.parser.Parse(address);
      if (parse_result.expression && parse_result.expression.type === 'address') {
        this.calculator.ResolveSheetID(parse_result.expression);
        result.row = parse_result.expression.row;
        result.column = parse_result.expression.column;
        result.sheet_id = parse_result.expression.sheet_id;
      }
      else if (parse_result.expression && parse_result.expression.type === 'range') {
        this.calculator.ResolveSheetID(parse_result.expression);
        result.row = parse_result.expression.start.row;
        result.column = parse_result.expression.start.column;
        result.sheet_id = parse_result.expression.start.sheet_id;
      }
      else if (parse_result.expression && parse_result.expression.type === 'identifier') {
        const named_range = this.grid.model.named_ranges.Get(parse_result.expression.name);
        if (named_range) {
          return named_range.start;
        }
      }
    }
    else {
      result.row = address.row || 0;
      result.column = address.column || 0;
    }
    return result;
  }

  public ScrollTo(address: string | ICellAddress) {
    this.grid.ScrollTo(this.EnsureAddress(address));
  }

  /**
   * API function: insert at current cursor
   */
  public InsertRow() {
    /*
    const selection = this.grid.GetSelection();
    const area = selection.area;
    const before_row = area.entire_column ? 0 : area.start.row;
    */

    this.grid.InsertRow();
    // this.calculator.ShiftSimulationResults(before_row, 0, 1, 0);
  }

  /**
   * API function: insert at current cursor
   */
  public InsertColumn() {
    /*
    const selection = this.grid.GetSelection();
    const area = selection.area;
    const before_column = area.entire_row ? 0 : area.start.column;
    */

    this.grid.InsertColumn();
    // this.calculator.ShiftSimulationResults(0, before_column, 0, 1);
  }

  /**
   * API function: delete selection
   */
  public DeleteRows() {
    this.grid.DeleteRows();
  }

  /**
   * API function: delete selection
   */
  public DeleteColumns() {
    this.grid.DeleteColumns();
  }

  /**
   * API function: apply borders to current selection
   */
  public ApplyBorders(borders: BorderConstants, width = 1) {
    this.grid.ApplyBorders(undefined, borders, undefined, width);
  }

  /**
   * API function: merge current selection
   */
  public MergeCells() {
    this.grid.MergeSelection();
  }

  /**
   * API function: unmerge current selection
   */
  public UnmergeCells() {
    this.grid.UnmergeSelection();
  }

  /**
   * why is this public?
   */
  public async ImportXLSX(data: string) {

    if (!this.export_worker) {
      const worker_name = (build as any)['build-entry-points']['export-worker'];
      this.export_worker = await this.LoadWorker(worker_name);
    }

    return new Promise<Blob>((resolve, reject) => {
      if (this.export_worker) {
        this.export_worker.onmessage = (event) => {
          if (event.data) {

            if (event.data.status === 'error') {
              return reject(event.data.error || 'unknown error');
            }

            // if (Array.isArray(sheet_data)) {
            //  sheet_data = sheet_data[0];
            // }
            // console.info(event.data);

            // NOTE: this is not grid.cells, it's the cells
            // property of the imported data -- this is ok (for now)

            // console.info(event.data.results);

            this.grid.FromData2(event.data.results);
            this.ResetInternal();
            this.grid.Update();

            // this one _is_ the grid cells

            this.calculator.AttachData(this.grid.model);
            this.Publish({ type: 'load' });

          }
          else {
            return reject('unknown error (missing data)');
          }
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

  /** export method returns a blob, for electron client */
  public async ExportBlob() {

    if (!this.export_worker) {
      const worker_name = (build as any)['build-entry-points']['export-worker'];
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

        const serialized: any = this.grid.Serialize({
          rendered_values: true,
          expand_arrays: true,
          export_colors: true,
          decorated_cells: true,
        });

        serialized.decimal_mark = Localization.decimal_separator;

        this.export_worker.postMessage({
          command: 'export', sheet: serialized,
        });

      }
      else {
        reject('worker failed');
      }

    });
  }

  /**
   * export to xlsx. this requires a bunch of processing -- one, we do this in
   * a worker, and two, it's demand loaded so we don't bloat up this embed
   * script.
   *
   * it might be nice to merge the workers, but since export is (presumably)
   * rare the separation is better. might be able to do some common-chunking
   * with webpack (although I'm not sure how well that plays w/ ts).
   */
  public Export(){
    this.ExportBlob().then((blob) => {
      let filename = 'export';
      if (this.grid.model.document_name) {
        filename = this.grid.model.document_name.toLowerCase().replace(/\s+/g, '-');
      }
      if (blob) {
        FileSaver.saveAs(blob, filename + '.xlsx', true);
      }
    });
  }

  /**
   * get selection
   */
  public GetSelection() {
    const selection = this.grid.GetSelection();
    if (selection.empty) return '';
    return selection.area.spreadsheet_label;
  }

  /** return "live" reference to selection */
  public GetSelectionReference() {
    return this.grid.GetSelection();
  }

  /**
   * focus on the grid
   */
  public Focus() {
    this.grid.Focus();
  }

  /**
   * client calls when the container is resized; handle any required layout
   */
  public Resize() {
    this.grid.UpdateLayout();
    this.Publish({ type: 'resize' });
  }

  /**
   * some local cleanup, gets called in various import/load/reset functions
   * this is shrinking to the point of being unecessary... although we are
   * possibly overloading it.
   */
  public ResetInternal() {
    // this.additional_cells = [];
    this.calculator.Reset();
    this.FlushUndo();
  }

  /** clear/reset sheet, back to initial state */
  public Reset() {
    this.grid.Clear();
    this.ResetInternal();
    this.calculator.AttachData(this.grid.model); // for leaf nodes
    this.Publish({ type: 'reset' });
  }

  public ApplyStyle(range?: IArea|ICellAddress|string, style: Style.Properties = {}, delta = true) {

    let area: Area|undefined;

    if (range) {
      if (typeof range === 'string') {
        const named_range = this.grid.model.named_ranges.Get(range);
        if (named_range) {
          area = named_range.Clone();
        }
        else {
          const addresses = range.split(':');
          if (addresses.length < 2) {
            area = new Area(this.EnsureAddress(addresses[0]));
          }
          else {
            area = new Area(
              this.EnsureAddress(addresses[0]),
              this.EnsureAddress(addresses[1]));
          }
        }
      }
      else if (IsCellAddress(range)) {
        area = new Area(range);
      }
      else {
        area = new Area(range.start, range.end);
      }
    }

    this.grid.ApplyStyle(area, style, delta);
  }

  /**
   * replacement for fetch
   * FIXME: move to utils or other lib
   * FIXME: we don't need to do this for ES6, presumably...
   * can this move into the legacy/modern code? or is there a polyfill? (...)
   */
  public async Fetch(uri: string) {
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
   * load a network document. using xhr/fetch, this will be
   * limited to local or CORS.
   */
  public async LoadNetworkDocument(uri: string, options?: EmbeddedSpreadsheetOptions) {

    const scroll = options ? options.scroll : undefined;
    const recalculate = options ? !!options.recalculate : false;
    const override_sheet = options ? options.sheet : undefined;

    // NOTE: dropping fetch, in favor of XHR; fetch requires a
    // pretty large polyfill for IE11, not worth it

    const csv = /csv(?:$|\?|&)/i.test(uri);
    const tsv = /tsv(?:$|\?|&)/i.test(uri);

    let response = await this.Fetch(uri);

    if (typeof response === 'string') {
      if (csv) {
        this.LoadCSV(response);
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
        this.LoadDocument(json, scroll, undefined, recalculate, override_sheet);

      }
    }

  }

  /** load a file (desktop) */
  public LoadLocalFile() {

    if (!this.file_chooser) {
      const file_chooser = document.createElement('input');
      file_chooser.setAttribute('type', 'file');
      file_chooser.setAttribute('accept',
        '.treb, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      file_chooser.addEventListener('change', (event) => {
        event.stopPropagation();
        event.preventDefault();
        const files = file_chooser.files;

        // FIXME: setting explicitly here triggers another change, at least
        // in IE11? or is something else causing that? see if there's a fix.

        if (files) {
          this.LoadFileInternal(files[0]).then(() => {
            file_chooser.value = ''; // allow same selection
          }).catch((err) => {
            console.error(err);
            this.ShowMessageDialog('Error loading file', 1500);
            file_chooser.value = ''; // allow same selection
          });
        }
      });
      this.file_chooser = file_chooser;
    }
    this.file_chooser.click();

  }

  /** called when we have a file to write to */
  public LoadFileInternal(file: File) {

    if (!file) { return Promise.resolve(); }

    const reader = new FileReader();

    return new Promise<void>((resolve, reject) => {

      // FIXME: worker?

      const finalize = (err?: string) => {
        reader.onload = null;
        reader.onabort = null;
        reader.onerror = null;
        // this.busy = false;
        if (err) reject(err);
        else resolve();
      };

      reader.onload = (event) => {

        try {
          if (reader.result) {
            if (/\.csv$/i.test(file.name)) {
              this.LoadCSV(reader.result as string);
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
                for (let i = 0; i < bytes.byteLength; i++ ){
                  contents += String.fromCharCode(bytes[i]);
                }

              }

              this.ImportXLSX(contents).then(() => {
                finalize();
              });
              return;
            }
            else {
              const data = JSON.parse(reader.result as string);
              this.LoadDocument(data);
            }
          }
          finalize();
        }
        catch (err) {
          finalize(err);
        }
      };

      reader.onabort = (event) => { finalize('Aborted'); };
      reader.onerror = (event) => { finalize('File error'); };

      // need a nontrivial delay to allow IE to re-render.
      // FIXME: this should be done async, possibly in a worker

      setTimeout(() => {
        if (/\.xlsx$/i.test(file.name)) {
          if (reader.readAsBinaryString ){
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

  /** save a file to desktop */
  public SaveLocalFile(type: SaveFileType = SaveFileType.treb, preserve_simulation_data = true, pretty = false) {

    const document_name = this.grid.model.document_name || 'document'; // FIXME: options

    let data: any;
    let blob: Blob;
    let filename: string;
    let text: string;

    switch (type) {
      case SaveFileType.treb:
      default:
        data = this.SerializeDocument(preserve_simulation_data);
        text = JSON.stringify(data, undefined, pretty ? 2 : undefined);
        blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        filename = (document_name).toLowerCase().replace(/\s+/g, '-') + '.treb';
    }

    if (blob && filename) {
      FileSaver.saveAs(blob, filename, true);
    }

  }

  public LoadCSV(csv: string) {
    this.grid.FromCSV(csv);
    this.ResetInternal();
    this.grid.Update(true);
    this.Publish({ type: 'load' });
  }

  /**
   * unserialize document from data
   *
   * UPDATE: will no longer recalculate on load if the "rendered_values"
   * flag is set in the document (assuming it's correct), because we can
   * display those values.
   */
  public LoadDocument(
      data: TREBDocument,
      scroll?: string|ICellAddress,
      flush = true,
      recalculate = false,
      override_sheet?: string,
      ) {

    this.ImportDocumentData(data, override_sheet);

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

    if (data.rendered_values && !recalculate) {
      this.grid.Update();
      this.calculator.RebuildClean(this.grid.model, true);
    }
    else {
      this.Recalculate();
    }

    // the note regarding leaves (above) is important for annotations, which
    // use leaf nodes to manage dependencies. so make sure cells are attached.

    this.InflateAnnotations();

    if (flush) {
      this.FlushUndo();
    }

    this.Publish({ type: 'load' });

    if (scroll) {
      let ds = document.body.scrollTop;
      Yield().then(() => {
        this.ScrollTo(scroll);
        ds = document.body.scrollTop;
      });
    }

    // if (data.active_sheet) {
    //  this.grid.ActivateSheetID({ key: CommandKey.ActivateSheet, id: data.active_sheet });
    // }

  }

  /**
   * set note for current selection. set as undefined or empty
   * string to clear existing note.
   */
  public SetNote(note?: string) {
    this.grid.SetNote(undefined, note);

    // set note does not publish, so we need to directly trigger undo/autosave
    // not true anymore?

    // this.DocumentChange();

  }

  /**
   * clear name
   */
  public ClearName(name: string) {
    this.grid.SetName(name);
  }

  /**
   * set name at selection
   */
  public SetName(name: string) {
    const selection = this.grid.GetSelection();
    if (!selection.empty) {
      this.grid.SetName(name, selection.area);
    }
  }

  /** testing
   *
   * this is called after recalc, check any annotations
   * (just sparklines atm) and update if necessary.
   */
  public UpdateAnnotations() {
    for (const annotation of this.grid.model.active_sheet.annotations) {
      if (annotation.temp.vertex) {
        const vertex = annotation.temp.vertex as LeafVertex;
        if (vertex.state_id !== annotation.temp.state) {
          annotation.temp.state = vertex.state_id;
          if (annotation.update_callback) {
            annotation.update_callback();
          }
        }
      }
    }
  }

  public SetHeadless(headless = true) {
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

  /**
   * this method should be called after changing the headless flag
   */
  public RebuildAllAnnotations() {
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
   */
  public InflateAnnotations(){
    for (const annotation of this.grid.model.active_sheet.annotations) {
      this.InflateAnnotation(annotation);
    }
  }

  public InflateAnnotation(annotation: Annotation) {

    if (this.grid.headless) { return; }

    // only inflate once, to prevent overwriting instance methods

    if (annotation.inflated) {
      return;
    }
    annotation.inflated = true;

    if (annotation.node && annotation.data) {

      if (annotation.type === 'treb-chart') {
        if (!(self as any).TREB || !(self as any).TREB.CreateChart2) {
          console.warn('missing chart library');
        }
        else {

          const chart = (self as any).TREB.CreateChart2(annotation.node) as Chart;

          // we may need to register library functions. we only need to do
          // that once. not sure I like this as the place for the test, though.

          // HEADS UP: this breaks when there are multiple sheet instances on
          // the page, because the register flag is in the other lib (!)

          // we need a local flag...

          if (!this.registered_libraries['treb-charts']) {
            this.calculator.RegisterFunction((chart.constructor as any).chart_functions);
            this.registered_libraries['treb-charts'] = true;

            // update AC list
            this.grid.SetAutocompleteFunctions(this.calculator.SupportedFunctions());
          }

          const update_chart = () => {

            if (annotation.formula) {
              const parse_result = this.parser.Parse(annotation.formula);
              if (parse_result &&
                  parse_result.expression &&
                  parse_result.expression.type === 'call' ){

                // FIXME: make a method for doing this

                this.parser.Walk(parse_result.expression, (unit) => {
                  if (unit.type === 'address' || unit.type === 'range') {
                    this.calculator.ResolveSheetID(unit);
                  }
                  return true;
                });

                const expr_name = parse_result.expression.name.toLowerCase();
                const result = this.calculator.CalculateExpression(parse_result.expression);

                chart.Exec(expr_name, result);

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
          if (annotation.node.parentElement) {
            if (!this.grid.headless) {
              update_chart();
            }
          }

        }

      }
      else if (annotation.type === 'image') {
        const img = document.createElement('img');
        img.setAttribute('src', annotation.data.src);
        img.style.width = '100%';
        img.style.height = '100%';
        annotation.node.appendChild(img);
      }
    }
  }

  /**
   * serialize document; optionally include any MC data
   * optionally preserve rendered values
   * UPDATE: default rendered values -> true
   */
  public SerializeDocument(
      preserve_simulation_data = true, 
      rendered_values = true,
      additional_options: SerializeOptions = {}) {

    const serialize_options: SerializeOptions = {
      shrink: true,
      ...additional_options,
      rendered_values,
    };

    const grid_data = this.grid.Serialize(serialize_options);

    const serialized: TREBDocument = {
      app: (build as any).name,
      // document_id: this.document_id,
      version: (build as any).version,
      name: this.grid.model.document_name, // may be undefined
      user_data: this.grid.model.user_data, // may be undefined
      decimal_mark: Localization.decimal_separator,
      ...grid_data,
    };

    if (rendered_values) {
      serialized.rendered_values = true;
    }

    /*
    if (preserve_simulation_data) {

      // it might be useful to prune this a bit, specifically to prune
      // results that are not referenced. can we use the graph to do that?

      serialized.simulation_data = {
        elapsed: this.last_simulation_data.elapsed,
        trials: this.last_simulation_data.trials,
        results: (this.last_simulation_data.results || []).map((result: any) => {
          return this.ArrayBufferToBase64(result);
        }),
      };

    }
    */

    return serialized;
  }

  /** recalc sheet */
  public async Recalculate(event?: GridEvent, formula_only = false) {
    let area: Area | undefined;
    if (event && event.type === 'data' && event.area) {
      area = event.area;
    }

    // NOTE: accessing grid.cells, find a better approach

    await this.calculator.Calculate(this.grid.model, area, { formula_only });
    this.grid.Update(true); // , area);
    this.UpdateAnnotations();
    this.Publish({ type: 'data' });
  }

  public SaveLocalStorage(key: string) {
    const json = JSON.stringify(this.SerializeDocument(true, true, {
      rendered_values: true, expand_arrays: true}));
    localStorage.setItem(key, json);
  }

  /** save sheet to local storage */
  public DocumentChange() {

    // FIXME: switch to yield?
    requestAnimationFrame(() => {
      const json = JSON.stringify(this.SerializeDocument(false, true, {
        rendered_values: true, expand_arrays: true}));

      if (this.options.storage_key) {
        localStorage.setItem(this.options.storage_key, json);
      }
      if (this.options.undo) {
        this.PushUndo(json);
      }

      this.Publish({type: 'document-change'});

    });
  }

  public PushUndo(json?: string) {

    // console.info('push undo');

    if (this.block_undo) {
      // console.info('blocked');
    }
    else {

      if (!json) {
        json = JSON.stringify(this.SerializeDocument(false, true, {
          rendered_values: true, expand_arrays: true}));
      }

      // insert at [undo_pointer], then increment the pointer

      this.undo_stack[this.undo_pointer++] = json;

      // FIXME: parameterize max length

      const length = this.undo_stack.length;

      if (length > 16) {
        const delta = length - 16;
        this.undo_stack = this.undo_stack.slice(delta);
        this.undo_pointer -= delta;
      }

    }

    if (this.block_undo) {
      this.block_undo = false;
    }

  }

  public FlushUndo(push = true) {

    // console.info('flush undo');

    this.undo_stack = [];
    this.undo_pointer = 0;
    if (push) {
      this.PushUndo();
    }
  }

  public Undo() {

    if (this.undo_pointer <= 1) {
      console.warn('nothing to undo');
      return;
    }

    // console.info('undo');

    const data = this.undo_stack[(--this.undo_pointer) - 1];
    this.block_undo = true;

    // UPDATE: we are storing calculated values in serialized data
    // in the undo stack. so we don't need to recalculate; paint immediately.
    // prevents flickering.

    this.LoadDocument(JSON.parse(data), undefined, false);

  }

  /** update selection: used for updating toolbar (i.e. highlight bold button) */
  public UpdateSelection(selection: any) {
    // console.info(selection);
    this.Publish({type: 'selection'});
  }

  public HideDialog() {
    this.dialog.HideDialog();
  }

  public ShowProgressDialog(message?: string, progress?: number) {
    this.dialog.ShowProgressDialog(message, progress);
  }

  public ShowMessageDialog(message?: string, timeout = 0) { 
    this.dialog.ShowMessageDialog(message);
    if (timeout) {
      setTimeout(() => this.dialog.HideDialog(), timeout);
    }
  }

  /* * show/hide dialog, generic message * /
  public ShowDialog(show = true, message?: string, timeout = 0) {
    this.dialog.Show(show, message);

    // FIXME: use a token so we don't close another dialog
    // FIXME (dialog): allow click to dismiss

    if (timeout) {
      setTimeout(() => {
        this.ShowDialog(false);
      }, timeout);
    }
  }
  */

  /** paint message to dialog (implicit show=true) */
  public UpdateDialog(message?: string, progress?: number) {
    this.dialog.Update(message, progress);
  }

  /**
   * show the toolbar. will load on first call.
   */
  public async FormattingToolbar(container: HTMLElement) {

    if (!this.toolbar) {
      const options: ToolbarOptions = {
        add_delete_sheet: !!this.options.add_tab,
        compressed_align_menus: (
          this.options.toolbar === 'compressed' ||
          this.options.toolbar === 'show-compressed'),
        // file_menu: this.options.toolbar_file_menu,
      };
      this.toolbar = FormattingToolbar.CreateInstance(this, this.grid, container, options);
    }

    /*
    if (!this.toolbar) {
      const load = await this.LoadToolbar();
      if (load) {
        const options: ToolbarOptions = {
          add_delete_sheet: !!this.options.add_tab,
          compressed_align_menus: (
            this.options.toolbar === 'compressed' ||
            this.options.toolbar === 'show-compressed'),
          // file_menu: this.options.toolbar_file_menu,
        };
        this.toolbar = (self as any).TREB['treb-toolbar'].CreateInstance(this, this.grid, container, options);
      }
    }
    */

    if (this.toolbar) {
      this.toolbar.Toggle();
    }

  }

  protected InitCalculator() {
    this.calculator = new Calculator();
  }

  /**
   * import data from serialized document, doing locale conversion if necessary
   */
  protected ImportDocumentData(data: TREBDocument, override_sheet?: string) {

    // FIXME: version check

    // new structure has this in an array; support old structure.
    // for now, pull out sheet[0]. multi-sheet pending. you still
    // need to test that this object is not undefined.

    // const sheet_data = (data.sheet_data && Array.isArray(data.sheet_data)) ?
    //  data.sheet_data[0] :
    //  data.sheet_data;

    // as an array...

    const sheets = (data.sheet_data && Array.isArray(data.sheet_data)) ?
      data.sheet_data : [data.sheet_data];

    // FIXME: it's not necessary to call reset here unless the
    // document fails, do that with a trap?

    // FIXME: move this to a separate function/lib

    if (data.decimal_mark && data.decimal_mark !== Localization.decimal_separator) {

      const parser = new Parser();
      let target_decimal_mark: DecimalMarkType; // = DecimalMarkType.Comma;
      let target_argument_separator: ArgumentSeparatorType; //  = ArgumentSeparatorType.Semicolon;

      // FIXME: these conversions should be easier... we should have a simple
      // switch in the parser/renderer function

      // FIXME: also we should unify on types for decimal, argument separator

      if (data.decimal_mark === '.'){
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

      for (const sheet_data of sheets) {
        if (sheet_data && sheet_data.annotations) {
          for (const annotation of (sheet_data.annotations as Annotation[])) {
            if (annotation.formula) {
              const parse_result = parser.Parse(annotation.formula);
              if (parse_result.expression) {
                const translated = parser.Render(parse_result.expression, undefined, undefined,
                  target_decimal_mark, target_argument_separator);
                annotation.formula = '=' + translated;
              }
            }
          }
        }

        if (sheet_data && sheet_data.data && sheet_data.data.length) {

          // update for grouped data (v5+)
          for (const block of sheet_data.data) {
            const cells = block.cells ? block.cells : [block];
            for (const cell of cells) {
              if (cell.value && typeof cell.value === 'string' && cell.value[0] === '=') {
                const parse_result = parser.Parse(cell.value.slice(1));
                if (parse_result.expression) {
                  const translated = parser.Render(parse_result.expression, undefined, undefined,
                    target_decimal_mark, target_argument_separator);
                  cell.value = '=' + translated;
                }
              }
            }
          }
        }
      }

    } // end l10n conversion

    // this.grid.UpdateSheet(sheet_data); // don't paint -- wait for calculate
    this.grid.UpdateSheets(sheets, undefined, override_sheet || data.active_sheet);
    const model = this.grid.model;

    /*
    if (data.simulation_data) {
      this.last_simulation_data = data.simulation_data;
      this.last_simulation_data.results =
        (this.last_simulation_data.results || []).map((entry: any) => {
          const binary = Base64.atob(entry);
          const len = binary.length;
          const u8 = new Uint8Array(len);
          for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
          return u8.buffer;
        });

      this.calculator.UpdateResults(this.last_simulation_data, model, false);
    }
    else {
      this.FlushSimulationResults();
    }
    */

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

  }

  /**
   * load worker. optionally uses an ambient path as prefix; intended for
   * loading in different directories (or different hosts?)
   */
  protected async LoadWorker(name: string) {

    if (EmbeddedSpreadsheetBase.treb_language) {
      name += '-' + EmbeddedSpreadsheetBase.treb_language;
    }

    if (!/\.js$/.test(name)) name += ('-' + (build as any).version + '.js');

    let worker: Worker;
    let treb_path = EmbeddedSpreadsheetBase.treb_base_path;

    if (treb_path) {
      if (!/\/$/.test(treb_path)) treb_path += '/';
      name = treb_path + name;
    }

    // for remote workers, fetch and construct as blob. for local
    // workers we can just create.

    // FIXME: testing... in particular URL.createObjectURL and new Blob

    if (/^(http:|https:|\/\/)/.test(name)) {
      const script = await this.Fetch(name);
      worker = new Worker(URL.createObjectURL(new Blob([script], {type: 'application/javascript'})));
    }
    else {
      worker = new Worker(name);
    }

    return worker;

  }

  /* * async load a chunk module * /
  private async LoadToolbar() {

    switch (EmbeddedSpreadsheetBase.formatting_toolbar_state) {
      case ToolbarLoadState.Loaded:
        return true;

      case ToolbarLoadState.Error:
        console.warn('Loading toolbar module failed');
        return false;

      case ToolbarLoadState.Loading:
        console.info('already loading...');
        return false;
    }

    // state is null

    let treb_path = EmbeddedSpreadsheetBase.treb_base_path;
    let name = // 'embedded-treb-toolbar-' + (build as any).version + '.js';
      (build as any)['build-entry-points'].toolbar +
      (EmbeddedSpreadsheetBase.treb_language ? '-' + EmbeddedSpreadsheetBase.treb_language : '') +
      '-' + (build as any).version + '.js';

    if (treb_path) {
      if (!/\/$/.test(treb_path)) treb_path += '/';
      name = treb_path + name;
    }

    EmbeddedSpreadsheetBase.formatting_toolbar_state = ToolbarLoadState.Loading;
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');

    // console.info('setting src', name);
    script.setAttribute('src', name);

    // this is async... right?
    document.body.appendChild(script);

    // now wait until it loads, or there's a timeout.
    const result = await new Promise((resolve) => {
      if ((self as any).TREB['treb-toolbar']) {
        return resolve(true);
      }
      let counter = 0;
      const delay = (timeout: number) => {
        setTimeout(() => {
          if ((self as any).TREB['treb-toolbar']) {
            return resolve(true);
          }
          if (counter++ >= 12) {
            console.info('timeout loading module');
            return resolve(false);
          }
          delay(timeout + 25);
        }, timeout);
      };
      delay(100);

    });

    EmbeddedSpreadsheetBase.formatting_toolbar_state = result ?
      ToolbarLoadState.Loaded : ToolbarLoadState.Error;

    return result;

  }
  */

  /**
   * handle key down to intercept ctrl+z (undo)
   *
   * FIXME: redo (ctrl+y or ctrl+shift+z)
   */
  private HandleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey && (event.code === 'KeyZ' || event.key === 'z')) {
      event.stopPropagation();
      event.preventDefault();
      this.Undo();
    }
  }



}
