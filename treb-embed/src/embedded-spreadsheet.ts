
// treb imports
import { Grid, GridEvent, SerializeOptions, Annotation, BorderConstants } from 'treb-grid';
import { Parser, DecimalMarkType, ArgumentSeparatorType } from 'treb-parser';
import { Calculator, CalculationWorker, WorkerMessage, WorkerMessageType,
         LeafVertex } from 'treb-calculator';
import { IsCellAddress, Localization, CellSerializationOptions, Style,
         ICellAddress, Area, IArea } from 'treb-base-types';
import { EventSource, Resizable, Yield } from 'treb-utils';
// import { Sparkline } from 'treb-sparkline';

// local
import { MaskDialog } from './mask-dialog';
import { EmbeddedSpreadsheetOptions, DefaultOptions } from './options';
import { EmbeddedSheetEvent, TREBDocument, SaveFileType } from './types';

// TYPE ONLY (also this is circular)
type FormattingToolbar = import('./toolbar-main').FormattingToolbar;

// 3d party modules
import { Base64 } from 'js-base64';
import * as FileSaver from 'file-saver';

// style
import 'treb-grid/style/grid.scss';
import 'treb-base-types/style/resizable.css';
import '../style/embed.scss';

// config
import * as build from '@root/package.json';

enum ToolbarLoadState {
  NotLoaded = 0,
  Loading   = 1,
  Loaded    = 2,
  Error     = 3,
}

/**
 * embedded spreadsheet, suitable for one-line embedding in a web page
 *
 * FIXME: let's encapsulate the event source and just expose
 * subscribe/cancel methods
 */
export class EmbeddedSpreadsheet extends EventSource<EmbeddedSheetEvent> {

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

  /** state of toolbar load. this is dynamic, but we are not using webpack chunks. */
  private static formatting_toolbar_state: ToolbarLoadState = ToolbarLoadState.NotLoaded;

  private parser = new Parser();
  private grid: Grid;

  private options: EmbeddedSpreadsheetOptions;

  private calculator = new Calculator();
  private node: HTMLElement;
  private file_chooser?: HTMLInputElement;
  private dialog: MaskDialog;
  private additional_cells: ICellAddress[] = [];

  /** toggle control for formatting toolbar */
  // private formatting_toolbar_visible = false;

  private toolbar?: FormattingToolbar;

  /** do we need a reference to this? */
  private resizable?: Resizable;

  /* for storing; also inefficient. pack, zip, do something. */
  private last_simulation_data: any = {};

  /** calculation worker (no longer using worker-loader) */
  private worker?: CalculationWorker;

  /**
   * export worker (no longer using worker-loader).
   * export worker is loaded on demand, not by default.
   */
  private export_worker?: Worker;

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

  /** opaque user data associated with document */
  private user_data?: any;

  /** document name */
  private document_name?: string = undefined;

  /**
   * these (practically speaking, there should only be one) are resolve()
   * functions from running simulations. when a simulation is complete or
   * canceled, we will resolve and clear the list.
   */
  private simulation_resolution: Array<() => void> = [];

  constructor(options: EmbeddedSpreadsheetOptions) { // }, theme: Theme = {}) {

    super();

    // this.RegisterFunctions();

    // consolidate options w/ defaults. note that this does not
    // support nested options, for that you need a proper merge

    this.options = { ...DefaultOptions, ...options };

    // optionally data from storage

    let data: any;
    if (this.options.storage_key && !this.options.toll_initial_load) {
      data = localStorage.getItem(this.options.storage_key);
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

    if (this.options.resizable) {
      this.resizable = new Resizable(container, this.node, () => {
        this.Resize();
      });
    }

    // handle key. TODO: move undo to grid (makes more sense)

    container.addEventListener('keydown', this.HandleKeyDown.bind(this));

    // create + init grid

    this.grid = new Grid({
        expand: false,
        insert_function_button: false,
        in_cell_editor: true,
        formula_bar: this.options.formula_bar,
        repaint_on_cell_change: false,
        scrollbars: this.options.scrollbars,
      },
      // theme
    );

    this.grid.Initialize(this.node);

    if (data) {
      this.LoadDocument(JSON.parse(data), undefined, undefined, !!options.recalculate);
    }
    this.FlushUndo();

    // FIXME: this is deprecated

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

    // set up grid events

    this.grid.grid_events.Subscribe((event) => {
      switch (event.type) {

        case 'selection':
          this.UpdateSelection(event.selection);
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

        case 'structure':
          this.DocumentChange();
          // FIXME: necessary? (...)
          // this.calculator.Reset(false);
          break;
      }
    });

    // dev
    if (this.options.global_name) {
      (self as any)[this.options.global_name] = this;
    }

    if (this.options.network_document) {
      this.LoadNetworkDocument(this.options.network_document, this.options.scroll, !!this.options.recalculate);
    }

    // create mask dialog

    this.dialog = new MaskDialog(container, {
      mask: this.grid.theme.interface_dialog_mask,
      border: this.grid.theme.interface_dialog_border,
      background: this.grid.theme.interface_dialog_background,
      text: this.grid.theme.interface_dialog_color,
    });

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
    else if (IsCellAddress(range)) {
      area = new Area(range);
    }
    else {
      area = new Area(range.start, range.end);
    }

    this.grid.SetRange(area, data, recycle, transpose);

  }

  /**
   * returns range as array (column-major). optionally return raw values (formulae)
   *
   * @param formula set to true to return underlying formula, instead of calculated value
   */
  public GetRange(range: ICellAddress|IArea|string, formula = false) {

    if (typeof range === 'string') {
      const addresses = range.split(':');
      if (addresses.length < 2) {
        return this.grid.GetRange(new Area(this.EnsureAddress(addresses[0])), formula);
      }
      else {
        return this.grid.GetRange(new Area(
          this.EnsureAddress(addresses[0]),
          this.EnsureAddress(addresses[1])), formula);
      }
    }
    else if (IsCellAddress(range)) {
      return this.grid.GetRange(range);
    }
    else {
      return this.grid.GetRange(new Area(range.start, range.end));
    }

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
   * returns simulation data for a cell (if any)
   */
  public SimulationData(address: string | ICellAddress) {
    address = this.EnsureAddress(address);
    const data = this.calculator.GetResults();
    if (!data) return undefined;
    if (!data[address.column]) return undefined;
    const cell = data[address.column][address.row];
    if (cell) {

      // legacy support. will need a polyfill regardless for Array.from
      return Array.isArray(cell) ? cell.slice(0) : Array.from(cell);
    }
    return undefined;
  }

  /**
   * convert A1 address to CellAddress type
   */
  public EnsureAddress(address: string | ICellAddress): ICellAddress {
    const result = { row: 0, column: 0 };
    if (typeof address === 'string') {
      const parse_result = this.parser.Parse(address);
      if (parse_result.expression && parse_result.expression.type === 'address') {
        result.row = parse_result.expression.row;
        result.column = parse_result.expression.column;
      }
      else if (parse_result.expression && parse_result.expression.type === 'range') {
        result.row = parse_result.expression.start.row;
        result.column = parse_result.expression.start.column;
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
    this.grid.InsertRow();
    this.calculator.Reset(false); // FIXME: why not run this off the 'structure' event, which will be sent? (...)
  }

  /**
   * API function: insert at current cursor
   */
  public InsertColumn() {
    this.grid.InsertColumn();
    this.calculator.Reset(false);
  }

  /**
   * API function: delete selection
   */
  public DeleteRows() {
    this.grid.DeleteRows();
    this.calculator.Reset(false);
  }

  /**
   * API function: delete selection
   */
  public DeleteColumns() {
    this.grid.DeleteColumns();
    this.calculator.Reset(false);
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

            const sheet_data = event.data.result;
            // console.info(event.data);

            // NOTE: this is not grid.cells, it's the cells
            // property of the imported data -- this is ok (for now)

            this.grid.FromData(
                sheet_data.cells || [],
                sheet_data.column_widths || [],
                sheet_data.row_heights || [],
                sheet_data.styles || [],
                undefined,
              );

            this.document_name = undefined;
            this.user_data = undefined;
            this.additional_cells = [];
            this.calculator.Reset(false);
            this.FlushUndo();
            this.grid.Update();

            // this one _is_ the grid cells

            this.calculator.AttachData(this.grid.cells);
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
        const serialized = this.grid.Serialize({
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
      if (this.document_name) {
        filename = this.document_name.toLowerCase().replace(/\s+/g, '-');
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
    // console.info('...');
    this.grid.UpdateLayout();
    this.Publish({ type: 'resize' });
  }

  /** clear/reset sheet, back to initial state */
  public Reset() {
    this.grid.Clear();
    this.document_name = undefined;
    this.user_data = undefined;
    this.additional_cells = [];
    this.calculator.Reset(false);

    // NOTE: accessing grid.cells, find a better approach

    this.calculator.AttachData(this.grid.cells); // for leaf nodes
    this.FlushUndo();
    this.Publish({ type: 'reset' });
  }

  public ApplyStyle(range?: IArea|ICellAddress|string, style: Style.Properties = {}, delta = true) {

    let area: Area|undefined;

    if (range) {
      if (typeof range === 'string') {
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
  public async LoadNetworkDocument(uri: string, scroll?: string|ICellAddress, recalculate = false) {

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
        this.LoadDocument(json, scroll, undefined, recalculate);

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
        if (files) {
          this.LoadFileInternal(files[0]).then(() => {
            file_chooser.value = ''; // allow same selection
          }).catch((err) => {
            console.error(err);
            this.ShowDialog(true, 'Error loading file', 1500);
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

    const reader = new FileReader();
    // const name = file.name;

    // this.busy = true;

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
            else if (/\.xlsx$/i.test(file.name)) {
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
  public SaveLocalFile(type: SaveFileType = SaveFileType.treb) {

    const document_name = this.document_name || 'document'; // FIXME: options

    let data: any;
    let blob: Blob;
    let filename: string;

    switch (type) {
      case SaveFileType.treb:
      default:
        data = this.SerializeDocument();
        console.info(data);
        blob = new Blob([JSON.stringify(data)], { type: 'text/plain;charset=utf-8' });
        filename = (document_name).toLowerCase().replace(/\s+/g, '-') + '.treb';
    }

    if (blob && filename) {
      FileSaver.saveAs(blob, filename, true);
    }

  }

  public LoadCSV(csv: string) {
    this.document_name = undefined;
    this.user_data = undefined;
    this.grid.FromCSV(csv);
    this.additional_cells = [];
    this.calculator.Reset(false);
    this.FlushUndo();
    this.grid.Update(true); // , area);
    this.Publish({ type: 'load' });
  }

  public FlushSimulationResults() {
    this.calculator.FlushSimulationResults();
    this.last_simulation_data = {};
  }

  /**
   * unserialize document from data
   *
   * UPDATE: will no longer recalculate on load if the "rendered_values"
   * flag is set in the document (assuming it's correct), because we can
   * display those values.
   */
  public LoadDocument(data: TREBDocument, scroll?: string|ICellAddress, flush = true, recalculate = false) {

    // FIXME: version check

    // FIXME: it's not necessary to call reset here unless the
    // document fails, do that with a trap?

    this.document_name = data.name;
    this.user_data = data.user_data;

    // FIXME: replace decimal mark, argument separator if necessary
    // console.info(data);

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

      if (data.sheet_data && data.sheet_data.data) {
        for (const cell of data.sheet_data.data) {
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
      this.calculator.UpdateResults(this.last_simulation_data);
    }

    this.grid.UpdateSheet(data.sheet_data); // don't paint -- wait for calculate

    this.additional_cells = [];
    this.calculator.Reset(false);

    // in order to support leaf vertices, we need calculator to have a valid
    // reference to cells. this happens in calculation, but if we don't calculate
    // we need to attach directly.

    // UPDATE: we can use the rebuild/clean method to do this, it will ensure
    // cells are attached

    // NOTE: accessing grid.cells, find a better approach

    if (data.rendered_values && !recalculate) {
      this.grid.Update();
      this.calculator.RebuildClean(this.grid.cells);
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

  }

  /**
   * set note for current selection. set as undefined or empty
   * string to clear existing note.
   */
  public SetNote(note?: string) {
    this.grid.SetNote(undefined, note);

    // set note does not publish, so we need to directly trigger undo/autosave

    this.DocumentChange();

  }

  /** testing
   *
   * this is called after recalc, check any annotations
   * (just sparklines atm) and update if necessary.
   */
  public UpdateAnnotations() {
    for (const annotation of this.grid.annotations) {
      if (annotation.data && annotation.data.vertex) {
        const vertex = annotation.data.vertex as LeafVertex;
        if (vertex.state_id !== annotation.data.state) {
          annotation.data.state = vertex.state_id;
          /*
          if (annotation.data &&
              annotation.data.sparkline &&
              annotation.data.range &&
              annotation.node) {
            this.UpdateSparkline(
              annotation.data.sparkline, annotation.data.range, annotation.node);
          }
          */
        }
      }
    }
  }

  /* *
   * re-render a sparkline on data change (after recalc)
   *
   * FIXME: move to class
   * /
  public UpdateSparkline(sparkline: Sparkline, range: Area, target: HTMLElement) {

    const real_range = this.grid.RealArea(range);

    // flatten to 1-d array, row-wise
    let data = this.grid.cells.GetRange(real_range.start, real_range.end);
    if (Array.isArray(data) && Array.isArray(data[0])) {
      data = data.reduce((composite, arr) => composite.concat(arr), []);
    }

    // coerce
    data = data.map((x: number) => typeof x === 'number' ? x : Number(x) || 0);

    sparkline.Update(data);
    const svg_root = sparkline.RenderNode();
    const root = (svg_root as SVGElement);

    root.style.position = 'relative';
    root.style.top = '10%';
    root.style.left = '5%';
    root.style.width = '90%';
    root.style.height = '80%';

    target.textContent = '';
    target.appendChild(svg_root);

  }
  */

  /* *
   * FIXME: move to class
   * FIXME: this needs to get called on structure changes (add/remove row/column)
   * /
  public RebuildSparkline(range: Area, vertex: LeafVertex) {

    const real_range = this.grid.RealArea(range);

    // reset
    vertex.ClearDependencies();

    // rebuild
    real_range.Iterate((address) => {
      this.calculator.AddLeafVertexEdge(address, vertex);
    });

  }
  */

  /* *
   * testing
   *
   * FIXME: move to class
   * /
  public AddSparkline(
      source: string|CellAddress|IArea,
      target: string|CellAddress,
      annotation?: Annotation) {

    target = this.EnsureAddress(target);

    let range: Area;
    if (typeof source === 'string') {
      const result = this.parser.Parse(source);
      if (result.expression && result.expression.type === 'address') {
        range = new Area(result.expression);
      }
      else if (result.expression && result.expression.type === 'range') {
        range = new Area(result.expression.start, result.expression.end);
      }
      else {
        throw new Error('invalid source range');
      }
    }
    else if (IsCellAddress(source)) {
      range = new Area(source);
    }
    else {
      range = new Area(source.start, source.end);
    }

    const leaf = new LeafVertex();
    this.calculator.AddLeafVertex(leaf);

    this.RebuildSparkline(range, leaf);

    const sparkline = new Sparkline({type: 'column'}, []);

    if (!annotation) {
      annotation = new Annotation({
        cell_address: new Area(target),
        data: {
          type: 'sparkline',
        },
      });
      this.grid.AddAnnotation(annotation);
    }

    // always set the range here. serialized range is a plain object;
    // this range is now inflated to an Area instance. use that.

    annotation.data.range = range;
    annotation.data.state = leaf.state_id;
    annotation.data.vertex = leaf;
    annotation.data.sparkline = sparkline;

    // don't serialize most of that
    annotation.data.toJSON = () => {
      return { type: 'sparkline', range };
    };

    if (annotation.node) {
      this.UpdateSparkline(sparkline, range, annotation.node);
    }

  }
  */

  public InflateAnnotations() {

    for (const annotation of this.grid.annotations) {
      console.info('needs inflation', annotation);
      /*
      if (annotation.data &&
          annotation.cell_address &&
          annotation.data.range &&
          annotation.data.type === 'sparkline') {
        this.AddSparkline(
          new Area(annotation.data.range.start, annotation.data.range.end),
          annotation.cell_address.start, annotation);
      }
      */
    }

  }

  /**
   * serialize document; optionally include any MC data
   * optionally preserve rendered values
   * UPDATE: default rendered values -> true
   */
  public SerializeDocument(preserve_simulation_data = true, rendered_values = true,
      additional_options: SerializeOptions = {}) {

    const serialize_options: SerializeOptions = {
      ...additional_options,
      rendered_values,
    };
    const serialized: TREBDocument = {
      app: (build as any).name,
      // document_id: this.document_id,
      version: (build as any).version,
      name: this.document_name, // may be undefined
      user_data: this.user_data, // may be undefined
      sheet_data: this.grid.Serialize(serialize_options),
      decimal_mark: Localization.decimal_separator,
    };
    if (rendered_values) serialized.rendered_values = true;

    if (preserve_simulation_data) {
      serialized.simulation_data = {
        elapsed: this.last_simulation_data.elapsed,
        trials: this.last_simulation_data.trials,
        results: (this.last_simulation_data.results || []).map((result: any) => {
          return this.ArrayBufferToBase64(result);
        }),
      };
    }
    return serialized;
  }

  /**  */
  public GetUserData() {
    return this.user_data;
  }

  /**  */
  public SetUserData(data: any) {
    this.user_data = data;
  }

  /** recalc sheet */
  public async Recalculate(event?: GridEvent, formula_only = false) {
    let area: Area | undefined;
    if (event && event.type === 'data' && event.area) {
      area = event.area;
    }

    // NOTE: accessing grid.cells, find a better approach

    await this.calculator.Calculate(this.grid.cells, area, { formula_only });
    this.grid.Update(true); // , area);
    this.UpdateAnnotations();
    this.Publish({ type: 'data' });
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

    // this.grid.UpdateSheet(data, true);
    // this.calculator.Reset(false);

    // this.Recalculate();

  }

  /** update selection: used for updating toolbar (i.e. highlight bold button) */
  public UpdateSelection(selection: any) {
    // console.info(selection);
    this.Publish({type: 'selection'});
  }

  /** show/hide dialog, generic message */
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

  /** paint message to dialog (implicit show=true) */
  public UpdateDialog(message: string) {
    this.dialog.Update(message);
  }

  /** mc-specific dialog; has constant string */
  public UpdateMCDialog(progress = 0, text?: string) {
    if (typeof text === 'undefined') {
      text = `${progress}%`;
    }
    this.UpdateDialog(`Running Monte Carlo Simulation...\n${text}`);
  }

  /**
   * run MC simulation, in worker. worker is now demand-loaded, so first
   * pass may be slow.
   */
  public async RunSimulation(trials = 5000, lhs = true) {

    this.UpdateMCDialog(0, 'Initializing');

    const worker_name = (build as any)['build-entry-points']['calculation-worker'];
    if (!this.worker) {
      this.worker = await this.LoadWorker(worker_name);

      this.worker.onmessage = (event) => {
        const message = event.data as WorkerMessage;
        this.HandleWorkerMessage(message);
      };

      this.worker.onerror = (event) => {
        console.error('worker error');
        console.info(event);
      };
    }

    if (!this.worker) {
      this.ShowDialog(true, 'Calculation failed', 2500);
      throw new Error('worker not initialized');
    }

    const json_options: CellSerializationOptions = {
      preserve_type: true,
      calculated_value: true,
    };

    // NOTE: accessing grid.cells, find a better approach

    this.worker.postMessage({
      type: WorkerMessageType.Configure,
      data: {
        locale: Localization.locale,
        data: this.grid.cells.toJSON(json_options).data,
        additional_cells: this.additional_cells,
      },
    });

    this.worker.postMessage({
      type: WorkerMessageType.Start, data: { trials, lhs },
    });

    await new Promise((resolve) => {
      this.simulation_resolution.push(resolve);
    });

  }

  /*
  private RegisterFunctions() {

    // the function will be called with a context object as (this),
    // so we need a reference to this instance. just like the old days!

    const instance = this;
    const nodes: HTMLElement[] = [];

    const func = function(this: any, ...args: any[]) {

      const address = this.address as CellAddress;
      if (!address) return;

      console.info('address', address);

      let annotation: Annotation|undefined;

      // check if we have an annotation at this position. if not, create it
      for (const node of nodes) {
        annotation = instance.grid.FindAnnotation(node);
        console.info('a?', annotation)

        if (!annotation) continue;
        if (!annotation.cell_address ||
          !annotation.data ||
          annotation.data.type !== 'sparkline' ||
          annotation.cell_address.start.row !== address.row ||
          annotation.cell_address.start.column !== address.column) {
          annotation = undefined;
        }
        else break;
      }

      if (!annotation) {
        console.info('create annotation');
        annotation = new Annotation({
          cell_address: new Area(address),
          data: {
            type: 'sparkline',
          },
        });
        instance.grid.AddAnnotation(annotation);
        if (annotation.node) {
          const sparkline = new Sparkline({type: 'win-loss'}, [1, 2, 3, -4, 5, 4, 5, -3, -2, 3, 4,]);
          const svg_root = sparkline.RenderNode();
          const root = (svg_root as SVGElement);
          root.style.position = 'relative';
          root.style.top = '10%';
          root.style.left = '5%';
          root.style.width = '90%';
          root.style.height = '80%';
          annotation.node.appendChild(svg_root);
          annotation.data.sparkline = sparkline;
          nodes.push(annotation.node);
        }
      }

      // next update data

      // return an empty value

      return '';
    };

    this.calculator.RegisterFunction('Sparkline', func);

  }
  */

  public async FormattingToolbar(container: HTMLElement) {

    if (!this.toolbar) {
      const load = await this.LoadToolbar();
      if (load) {
        this.toolbar = (self as any).TREB['treb-toolbar'].CreateInstance(this, container);
      }
    }

    if (this.toolbar) {
      this.toolbar.Toggle();
    }

  }

  /** async load a chunk module */
  private async LoadToolbar() {

    switch (EmbeddedSpreadsheet.formatting_toolbar_state) {
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

    let treb_path = EmbeddedSpreadsheet.treb_base_path;
    let name = // 'embedded-treb-toolbar-' + (build as any).version + '.js';
      (build as any)['build-entry-points'].toolbar +
      (EmbeddedSpreadsheet.treb_language ? '-' + EmbeddedSpreadsheet.treb_language : '') +
      '-' + (build as any).version + '.js';

    if (treb_path) {
      if (!/\/$/.test(treb_path)) treb_path += '/';
      name = treb_path + name;
    }

    EmbeddedSpreadsheet.formatting_toolbar_state = ToolbarLoadState.Loading;
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');

    // console.info('setting src', name);
    script.setAttribute('src', name);

    // this is async... right?
    document.body.appendChild(script);

    // now wait until it loads, or there's a timeout.
    const result = await new Promise((resolve) => {
      if ((self as any).TREB['treb-toolbar']) return resolve(true);
      let counter = 0;
      const delay = (timeout: number) => {
        setTimeout(() => {
          if ((self as any).TREB['treb-toolbar']) return resolve(true);
          if (counter++ >= 12) {
            console.info('timeout loading module');
            return resolve(false);
          }
          delay(timeout + 25);
        }, timeout);
      };
      delay(100);

    });

    EmbeddedSpreadsheet.formatting_toolbar_state = result ?
      ToolbarLoadState.Loaded : ToolbarLoadState.Error;

    return result;

  }

  /**
   * load worker. optionally uses an ambient path as prefix; intended for
   * loading in different directories (or different hosts?)
   */
  private async LoadWorker(name: string) {

    if (EmbeddedSpreadsheet.treb_language) {
      name += '-' + EmbeddedSpreadsheet.treb_language;
    }

    if (!/\.js$/.test(name)) name += ('-' + (build as any).version + '.js');

    let worker: Worker;
    let treb_path = EmbeddedSpreadsheet.treb_base_path;

    if (treb_path) {
      if (!/\/$/.test(treb_path)) treb_path += '/';
      name = treb_path + name;
    }

    // for remote workers, fetch and construct as blob. for local
    // workers we can just create.

    // FIXME: testing... in particular URL.createObjectURL and new Blob

    if (/^(http\:|https\:|\/\/)/.test(name)) {
      const script = await this.Fetch(name);
      worker = new Worker(URL.createObjectURL(new Blob([script], {type: 'application/javascript'})));
    }
    else {
      worker = new Worker(name);
    }

    return worker;

  }

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

  /**
   * rx handler for worker messages
   */
  private HandleWorkerMessage(message?: WorkerMessage) {

    if (!message) return;

    switch (message.type) {
      case WorkerMessageType.Update:
        this.UpdateMCDialog(Number(message.data.percent_complete || 0));
        this.last_simulation_data = message.data.trial_data;
        this.calculator.UpdateResults(message.data.trial_data);
        this.Recalculate();

        // not actually possible for this not to exist at this
        // point -- is there a way to express that in ts?

        if (this.worker) this.worker.postMessage({ type: WorkerMessageType.Step });
        break;

      case WorkerMessageType.Progress:
        this.UpdateMCDialog(Number(message.data || 0));
        break;

      case WorkerMessageType.Complete:
        this.last_simulation_data = message.data;
        requestAnimationFrame(() => {
          this.calculator.UpdateResults(message.data);
          this.Recalculate().then(() => {
            this.Focus();
          });
          setTimeout(() => {
            this.ShowDialog(false);
            this.Publish({ type: 'simulation-complete' });

            for (const entry of this.simulation_resolution) {
              entry.call(this);
            }
            this.simulation_resolution = [];

          }, 500);
        });
        break;

      default:
        console.info('unhandled worker message', message);
        break;

    }

  }

  private ArrayBufferToBase64(data: ArrayBuffer): string {
    return this.Uint8ToBase64(new Uint8Array(data, 0));
  }

  private Uint8ToBase64(data: Uint8Array): string {
    const chunks = [];
    const block = 0x8000;
    for (let i = 0; i < data.length; i += block) {
      chunks.push(String.fromCharCode.apply(null, Array.from(data.subarray(i, i + block))));
    }
    return Base64.btoa(chunks.join(''));
  }


}

/*
// create (or attach to) global TREB namespace

AutoEmbed.constructor_function = (options: any) => new EmbeddedSpreadsheet(options);

(() => {
  if (!(self as any).TREB) { (self as any).TREB = {}; }
  const TREB: any = (self as any).TREB;
  TREB.CreateSpreadsheet = (options: CreateSheetOptions) => AutoEmbed.CreateSheet(options);
  TREB['treb-embed'] = { version: (build as any).version };
})();

document.addEventListener('DOMContentLoaded', () => AutoEmbed.Run());
EmbeddedSpreadsheet.SniffPath();

*/
