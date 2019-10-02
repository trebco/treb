
// --- treb imports -----------------------------------------------------------

import { Cell, ValueType, Cells, Style,
  Area, ICellAddress, CellSerializationOptions } from 'treb-base-types';
import { NumberFormatCache } from 'treb-format';
import { EventSource, Measurement } from 'treb-utils';

// --- local imports ----------------------------------------------------------

import { SheetEvent, UpdateHints, FreezePane, SerializedSheet } from './sheet_types';
import { SerializeOptions } from './serialize_options';
import { NamedRangeCollection } from './named_range';

import * as ModuleInfo from '@root/package.json';
import { Theme } from './theme';

// --- constants --------------------------------------------------------------

const DEFAULT_COLUMN_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 26; // not used because it's based on font (theoretically)
const DEFAULT_ROW_HEADER_WIDTH = 60;

interface CellStyleRef {
  row: number;
  column: number;
  ref?: number;
  style?: Style.Properties;
}

export class Sheet {

  public static base_id = 100;

  // --- class methods --------------------------------------------------------

  public static Blank(rows = 100, columns = 26, name?: string) {
    const sheet = new Sheet();
    if (name) {
      sheet.name = name;
    }
    rows = Math.max(rows, 1);
    columns = Math.max(columns, 1);
    sheet.cells.EnsureCell({row: rows - 1, column: columns - 1});
    return sheet;
  }

  /**
   * deserialize json representation. returns new instance or updates
   * passed instance.
   *
   * FIXME: why not make this an instance method, always call on new instance?
   *
   * @param hints UpdateHints supports partial deserialization/replacement
   * if we know there are only minor changes (as part of undo/redo, probably)
   */
  public static FromJSON(json: string | object, sheet?: Sheet, hints?: UpdateHints) {

    if (hints) console.warn( '(using hints)', hints);

    let obj: SerializedSheet;
    if (typeof json === 'string') obj = JSON.parse(json);
    else obj = json as SerializedSheet;

    const unflatten_numeric_array = (target: number[], data: { [index: string]: number }, default_value: number) => {
      Object.keys(data).forEach((key) => {
        const index = Number(key) || 0;
        target[index] = data[key];
      });
    };

    if (!sheet) sheet = new Sheet();

    // new, named ranges [FIXME: move to container?] -- these are
    // serialized so create objects

    /*
    if (!hints || hints.names) {
      sheet.named_ranges.Reset();
      if (obj.named_ranges) {
        for (const key of Object.keys(obj.named_ranges)) {
          sheet.named_ranges.SetName(key, new Area(
              obj.named_ranges[key].start, obj.named_ranges[key].end), false);
          }
      }
      sheet.named_ranges.RebuildList();
    }
    */

    // persist ID, name

    if (obj.id) {
      sheet.id = obj.id;
    }
    if (obj.name) {
      sheet.name = obj.name;
    }

    // styles (part 1) -- moved up in case we use inlined style refs

    if (!hints || hints.style) {

      sheet.cell_style = [];

      if (obj.cell_style_refs) {
        (obj.cell_styles || []).forEach((cell_style: CellStyleRef) => {
            if (typeof cell_style.ref === 'number') {
            cell_style.style =
              JSON.parse(JSON.stringify(obj.cell_style_refs[cell_style.ref])); // clone
          }
        });
      }

    }

    // data: cells (moved after style)

    if (!hints || hints.data) {
      sheet.cells.FromJSON(obj.data);
      if (obj.rows) sheet.cells.EnsureRow(obj.rows - 1);
      if (obj.columns) sheet.cells.EnsureColumn(obj.columns - 1);

      // new style stuff
      if (!hints || hints.style) {

        // different handling for nested, flat, but we only have to
        // check once because data is either nested or it isn't.

        if (obj.data && obj.data[0]) {
          if (obj.data[0].cells) {
            if (typeof obj.data[0].row !== 'undefined') {
              for (const block of obj.data) {
                const row = block.row;
                for (const entry of block.cells) {
                  const column = entry.column;
                  if (entry.style_ref) {
                    if (!sheet.cell_style[column]) sheet.cell_style[column] = [];
                    sheet.cell_style[column][row] = // entry.style;
                      JSON.parse(JSON.stringify(obj.cell_style_refs[entry.style_ref])); // clone
                  }
                }
              }
            }
            else {
              for (const block of obj.data) {
                const column = block.column;
                for (const entry of block.cells) {
                  const row = entry.row;
                  if (entry.style_ref) {
                    if (!sheet.cell_style[column]) sheet.cell_style[column] = [];
                    sheet.cell_style[column][row] = // entry.style;
                      JSON.parse(JSON.stringify(obj.cell_style_refs[entry.style_ref])); // clone
                  }
                }
              }
            }
          }
          else {
            for (const entry of obj.data) {
              if (entry.style_ref) {
                if (!sheet.cell_style[entry.column]) sheet.cell_style[entry.column] = [];
                sheet.cell_style[entry.column][entry.row] = // entry.style;
                  JSON.parse(JSON.stringify(obj.cell_style_refs[entry.style_ref])); // clone
              }
            }
          }
        }
      }

    }

    // freeze

    if (!hints || hints.freeze) {

      sheet.freeze.rows = 0;
      sheet.freeze.columns = 0;

      if (obj.freeze) {
        sheet.freeze.rows = obj.freeze.rows || 0;
        sheet.freeze.columns = obj.freeze.columns || 0;
      }

    }

    // wrap up styles

    if (!hints || hints.style) {

      for (const cell_style of ((obj.cell_styles || []) as CellStyleRef[])) {
        if (cell_style.style) {
          if (!sheet.cell_style[cell_style.column]) sheet.cell_style[cell_style.column] = [];
          // console.info("@2", cell_style.column, cell_style.row, cell_style.style);
          sheet.cell_style[cell_style.column][cell_style.row] = cell_style.style;
        }
      }

      sheet.sheet_style = obj.sheet_style;
      sheet.row_styles = obj.row_style;
      sheet.column_styles = obj.column_style;

      if (hints && !hints.data) sheet.FlushCellStyles();

    }

    if (!hints || hints.layout) {

      // sheet.default_row_height = obj.default_row_height;
      // sheet.default_column_width = obj.default_column_width;

      sheet.row_height_ = [];
      unflatten_numeric_array(sheet.row_height_, obj.row_height || {},
        sheet.default_row_height);
        // obj.default_row_height);

      sheet.column_width_ = [];
      unflatten_numeric_array(sheet.column_width_, obj.column_width || {},
        sheet.default_column_width);
        // obj.default_column_width);

      if (hints && !hints.data) sheet.FlushCellStyles();

    }

    return sheet;

  }

  /**
   * factory method creates a sheet from a 2D array.
   *
   */
  public static FromArray(data: any[] = [], transpose = false): Sheet {
    const sheet = new Sheet();
    sheet.cells.FromArray(data, transpose);

    return sheet;
  }

  // --- static members -------------------------------------------------------

  // FIXME: use the external measurement object (from utils)
  private static measurement_canvas?: HTMLCanvasElement;

  // --- instance members -----------------------------------------------------

  // moved from layout
  public freeze: FreezePane = {
    rows: 0,
    columns: 0,
  };

  /** standard width */
  public default_column_width = 100;

  /** standard height */
  public default_row_height = 25;

  /** cells data */
  public cells: Cells = new Cells();

  /**
   * named ranges: name -> area
   * FIXME: this needs to move to an outer container, otherwise we
   * may get conflicts w/ multiple sheets. unless we want to allow that...
   */
  // public named_ranges = new NamedRangeCollection();

  public name?: string;

  /**
   * adding verbose flag so we can figure out who is publishing
   * (and stop -- part of the ExecCommand switchover)
   */
  public readonly sheet_events = new EventSource<SheetEvent>(true, 'sheet-events');

  /** internal ID */
  private id_: number;

  // tslint:disable-next-line:variable-name
  private row_height_: number[] = [];

  // tslint:disable-next-line:variable-name
  private column_width_: number[] = [];

  /**
   * optionally, custom row headers (instead of 1...2...3...)
   * FIXME: should maybe be a function instead?
   * FIXME: why is this any type? just sloppiness?
   */
  private row_headers: string[] = [];

  /**
   * optionally, custom column headers (instead of A...B...C...)
   * FIXME: should maybe be a function instead?
   * FIXME: why is this any type? just sloppiness?
   */
  private column_headers: string[] = [];

  /** size of header */
  private row_header_width = 100;

  /** size of header */
  private column_header_height = 25;

  // we cache composite styles so we don't wind up with objects
  // for every cell, when all we need is a single reference.

  private style_map: Style.Properties[] = [];

  // we use json for comparison. it should be faster than the alternative
  // (even if that doesn't make sense).

  private style_json_map: string[] = [];

  // style now uses overlays, but we want to precalculate the
  // overlaid values. we need to hold on to the originals, in
  // the event something changes, so we can redo the calculation.

  // there's a default at the bottom that gets applied to everything.
  // (in Style). above that, we have the sheet style

  private sheet_style: Style.Properties = {};

  // then individual (applied) row and column styles (indexed by row/column)

  private row_styles: { [index: number]: Style.Properties } = {};

  private column_styles: { [index: number]: Style.Properties } = {};

  // and finally any cell-specific styles. [FIXME: this is sparse]
  // [why FIXME? sparse is OK in js]

  private cell_style: Style.Properties[][] = [];

  // --- accessors ------------------------------------------------------------

  // public get column_header_count() { return this.column_header_count_; }

  public get header_offset() {
    return { x: this.row_header_width, y: this.column_header_height };
  }

  /** accessor: now just a wrapper for the call on cells */
  public get rows() { return this.cells.rows; }

  /** accessor: now just a wrapper for the call on cells */
  public get columns() { return this.cells.columns; }

  public get id() { return this.id_; }

  public set id(id: number) {
    this.id_ = id;
    if (this.id >= Sheet.base_id) {
      Sheet.base_id = this.id + 1;
    }
  }

  // --- public methods -------------------------------------------------------

  constructor() {

    // FIXME: the below should be called in a separate 'init' method
    // that can be called after we change styles (since it will measure)

    this.default_column_width = DEFAULT_COLUMN_WIDTH;
    this.row_header_width = DEFAULT_ROW_HEADER_WIDTH;
    this.UpdateDefaultRowHeight(true);

    this.id_ = Sheet.base_id++;

  }

  public MergeCells(area: Area) {

    // FIXME: it's an error if this area includes some
    // (but not all) of another merge area.

    // ...

    // assuming we're good to go...

    area = area.Clone();
    this.cells.IterateArea(area, (cell, c, r) => {
      cell.merge_area = area;
      cell.render_dirty = true;

      // clear data in !head
      if (c !== area.start.column || r !== area.start.row) cell.Reset();
    }, true);

    // caller // return this.sheet_events.Publish({ type: 'data', area });

  }

  public UnmergeCells(area: Area, inline = false) {

    // this _must_ be the full merge area. to get it, just get
    // the merge property from a particular cell or cells.

    // let's check:

    let match = true;
    this.cells.IterateArea(area, (cell) => {
      match = match && !!cell.merge_area && area.Equals(cell.merge_area);
    }, false);

    if (!match) {
      console.warn('area mismatch');
      return;
    }

    this.cells.IterateArea(area, (cell) => {
      cell.merge_area = undefined;
      cell.render_dirty = true;
    }, false);

    if (inline) return; // support batching events

    // caller // return this.sheet_events.Publish({ type: 'data', area });

  }

  /**
   * FIXME: measure the font.
   */
  public StyleFontSize(style: Style.Properties) {

    let font_height = style.font_size;

    if (typeof font_height === 'string') {
      if (/px/.test(font_height)) {
        font_height = Math.round(Number(font_height.replace(/px/, '')) * 75) / 100;
      }
      else if (/pt/.test(font_height)) {
        font_height = Number(font_height.replace(/pt/, ''));
      }
      else {
        font_height = Number(font_height.replace(/\D+/g, ''));
      }
    }

    return font_height || 10;

  }

  /**
   * FIXME: this is called in the ctor, which made sense when sheets
   * were more ephemeral. now that we update a single instance, rather
   * than create new instances, we lose this behavior. we should call
   * this when we change sheet style.
   */
  public UpdateDefaultRowHeight(suppress_event = false) {

    const composite = Style.Composite([this.sheet_style]);
    if (typeof window !== 'undefined') {
      const measurement = Measurement.MeasureText(Style.Font(composite), 'M');
      const height = Math.round(measurement.height * 1.4);
      // console.info("DRH", this.default_row_height, Style.Font(composite), measurement);
      if (this.default_row_height < height) {
        this.default_row_height = height;
      }
    }
    else {
      // console.info('worker?');
    }
    if (!suppress_event) this.PublishStyleEvent(undefined, 1);

  }

  /** returns aggregate width of all (known) columns */
  public get total_width() {
    let width = 0;
    for (let i = 0; i < this.cells.columns; i++) width += this.GetColumnWidth(i);
    return width;
  }

  /** returns aggregate height of all (known) rows */
  public get total_height() {
    let height = 0;
    for (let i = 0; i < this.cells.rows; i++) height += this.GetRowHeight(i);
    return height;
  }

  /**
   * deprecated (or give me a reason to keep it)
   * KEEP IT: just maintain flexibility, it has very low cost
   */
  public SetRowHeaders(headers: any[]) {
    this.row_headers = headers;
    if (this.row_headers) {
      this.cells.EnsureRow(this.row_headers.length - 1);
    }
  }

  /**
   * deprecated (or give me a reason to keep it)
   * KEEP IT: just maintain flexibility, it has very low cost
   */
  public SetColumnHeaders(headers: any[]) {
    this.column_headers = headers;
    if (headers){
      this.cells.EnsureColumn(headers.length - 1);
    }
  }

  /**
   * deprecated
   * KEEP IT: just maintain flexibility, it has very low cost
   */
  public RowHeader(row: number) {
    if (this.row_headers) {
      if (this.row_headers.length > row) return this.row_headers[row];
      return '';
    }
    return row + 1;
  }

  /**
   * deprecated
   * KEEP IT: just maintain flexibility, it has very low cost
   * (we did drop the multiple rows, though)
   */
  public ColumnHeader(column: number) {
    let s = '';
    if (this.column_headers) {
      if (this.column_headers.length > column) return this.column_headers[column];
      return '';
    }
    while (1) {
      const c = column % 26;
      s = String.fromCharCode(65 + c) + s;
      column = Math.floor(column / 26);
      if (column) column--;
      else break;
    }
    return s;
  }

  public GetRowHeight(row: number) {
    const height = this.row_height_[row];
    if (typeof height === 'undefined') return this.default_row_height;
    return height;
  }

  public SetRowHeight(row: number, height: number) {
    this.row_height_[row] = height;
    this.cells.EnsureRow(row);
    return height;
  }

  public GetColumnWidth(column: number) {
    const width = this.column_width_[column];
    if (typeof width === 'undefined') return this.default_column_width;
    return width;
  }

  public SetColumnWidth(column: number, width: number) {
    this.column_width_[column] = width;
    this.cells.EnsureColumn(column);
    return width;
  }

  /* *
   * get or set row height. we call this a lot -- I feel like we should
   * split into separate accessor methods, to avoid the test. or is that
   * over-optimization? (...)
   * /
  public RowHeight(row: number, value?: number): number {
    if (typeof value !== 'undefined') {
      this.row_height_[row] = value;
      this.cells.EnsureRow(row);
      return value;
    }
    const height = this.row_height_[row];
    if (typeof height === 'undefined') return this.default_row_height;
    return height;
  }
  */

  /* *
   * get or set column width
   * /
  public ColumnWidth(column: number, value?: number): number {
    if (typeof value !== 'undefined') {
      this.column_width_[column] = value;
      this.cells.EnsureColumn(column);
      return value;
    }
    const width = this.column_width_[column];
    if (typeof width === 'undefined') return this.default_column_width;
    return width;
  }
  */

  /* *
   * apply theme. sets some fonts in sheet.
   * @param theme
   * /
  public ApplyTheme(theme: Theme) {
   
    this.UpdateSheetStyle({
      font_face: theme.cell_font,
      font_size: theme.cell_font_size,
    }, true, true);
  }
  */

  /**
   * updates cell styles. flushes cached style.
   *
   * @param delta merge with existing properties (we will win conflicts)
   * @param inline this is part of another operation, don't do any undo/state updates
   */
  public UpdateCellStyle(address: ICellAddress, properties: Style.Properties, delta = true, inline = false) {
    const { row, column } = address;

    if (!this.cell_style[column]) this.cell_style[column] = [];

    const underlying = this.CompositeStyleForCell(address, false);
    const merged = Style.Composite([
      underlying,
      Style.Merge(this.cell_style[column][row] || {}, properties, delta)
    ]);

    const composite: any = {};

    // find properties that are different, those will be the cell style.

    for (const key of Object.keys(merged) as Style.PropertyKeys[]) {
      if (merged[key] !== underlying[key]) {
        composite[key] = merged[key];
      }
    }
    for (const key of Object.keys(underlying) as Style.PropertyKeys[]) {
      if (merged[key] !== underlying[key]) {
        composite[key] = merged[key];
      }
    }

    this.cell_style[column][row] = composite; // merged;

    // targeted flush
    this.CellData(address).FlushStyle();

    if (inline) return;


    this.PublishStyleEvent(undefined, 7); // console.info("PSE 7");
  }

  /**
   *
   * @param area
   * @param style
   * @param delta
   * @param render LEGACY PARAMETER NOT USED
   */
  public UpdateAreaStyle(area?: Area, style: Style.Properties = {}, delta = true, render = true, inline = false) {

    if (!area) return;

    if (area.entire_sheet) {
      this.UpdateSheetStyle(style, delta, true);
    }
    else if (area.entire_column) {
      for (let column = area.start.column; column <= area.end.column; column++) {
        this.UpdateColumnStyle(column, style, delta, true);
      }
    }
    else if (area.entire_row) {
      for (let row = area.start.row; row <= area.end.row; row++) {
        this.UpdateRowStyle(row, style, delta, true);
      }
    }
    else area.Array().forEach((address) => this.UpdateCellStyle(address, style, delta, true));

    if (inline) return;

    this.PublishStyleEvent(area, 8); // console.info("PSE 10");

  }

  /**
   * checks if the given cell has been assigned a specific style, either for
   * the cell itself, or for row and column.
   */
  public HasCellStyle(address: ICellAddress) {
    return ((this.cell_style[address.column] && this.cell_style[address.column][address.row]) ||
      this.row_styles[address.row] || this.column_styles[address.column]);
  }

  /**
   * get style only. as noted in the comment to `CellData` there used to be
   * no case where this was useful without calculated value as well; but we
   * now have a case: fixing borders by checking neighboring cells. (testing).
   */
  public CellStyleData(address: ICellAddress) {

    // don't create if it doesn't exist
    const cell = this.cells.GetCell(address);
    if (!cell) return null;

    // composite style if necessary
    if (!cell.style) {
      const index = this.GetStyleIndex(this.CompositeStyleForCell(address));
      cell.style = this.style_map[index];
    }

    return cell.style;

  }

  /**
   * wrapper for getting all relevant render data.
   * TODO: merge in "FormattedValue". restructure data so we don't have
   * two caches (formatted and calculated).
   *
   * NOTE: we removed "GetCellStyle" in favor of this function. the rationale
   * is that there are no reasonable cases where someone looks up the style
   * without that being a next step to (or in reasonable proximity to)
   * rendering. so it's reasonable to call this function even if it's in
   * advance of rendering.
   *
   * NOTE: that applies to the "GetCellFormula" and "GetCellValue" functions
   * as well -- so remove those too.
   *
   * NOTE: actually GetCellFormula resolves array formulae, so maybe not --
   * or the caller needs to check.
   */
  public CellData(address: ICellAddress): Cell {

    const cell = this.cells.EnsureCell(address);

    // if cell has rendered type (i.e. not undefined), then it has
    // complete render data and we can return it as-is.

    if (cell.rendered_type) return cell;

    // otherwise we need to render it. if we have a calculated value, use that.

    let type: ValueType;
    let value: any;

    if (cell.calculated_type) {
      value = cell.calculated;
      type = cell.calculated_type;
    }
    else {
      value = cell.value;
      type = cell.type;
    }

    // do we have style for this cell? if not, we need to composite it.

    if (!cell.style) {
      const index = this.GetStyleIndex(this.CompositeStyleForCell(address));
      cell.style = this.style_map[index];
    }

    // why is this done here? shouldn't it be done by/in the renderer?

    if (!type || value === null || typeof value === 'undefined') {
      cell.formatted = '';
      cell.rendered_type = ValueType.string;
    }
    else if (type === ValueType.number) {

      // IE11. not sure of the effect of this.

      if (isNaN(value)) {
        cell.formatted = // Style.Format(cell.style, value); // formats NaN
          (typeof cell.style.nan === 'undefined') ? 'NaN' : cell.style.nan;
      }
      else {
        cell.formatted = // Style.Format(cell.style, value);
          this.FormatNumber(value, cell.style.number_format);
      }
      cell.rendered_type = ValueType.number;
    }
    else if (type === ValueType.error) {
      cell.formatted = '#' + (value || 'ERR?');
      cell.rendered_type = ValueType.error;
    }
    else if (type === ValueType.boolean) {
      cell.formatted = value.toString().toUpperCase(); // implicit locale?
      cell.rendered_type = ValueType.boolean;
    }
    else if (type === ValueType.formula && cell.calculated === undefined) {
      cell.formatted = '';
      cell.rendered_type = ValueType.string;
    }
    else {

      // why is this being treated as a number? (...)
      // A: it's not, number format has a text section. defaults
      //    to @ (just show the text), but could be different

      cell.formatted = this.FormatNumber(value, cell.style.number_format);
      cell.rendered_type = ValueType.string;
    }

    // now we can return it
    return cell;

  }

  /**
   * format number using passed format; gets the actual format object
   * and calls method. returns a string or array of text parts
   * (@see treb-format).
   */
  public FormatNumber(value: any, format = '') {
    const formatted = NumberFormatCache.Get(format).FormatParts(value);
    if (!formatted.length) return '';
    if (formatted.length === 1 && !formatted[0].flag) { return formatted[0].text || ''; }
    return formatted;
  }

  public ColumnHeaderHeight() {
    return this.column_header_height || this.default_row_height;
  }

  public SetHeaderSize(
    row_header_width = DEFAULT_ROW_HEADER_WIDTH,
    column_header_height = this.default_row_height) {

    this.row_header_width = row_header_width;
    this.column_header_height = column_header_height;
  }

  /**
   * resize row to match character hight, taking into
   * account multi-line values.
   */
  public AutoSizeRow(row: number, inline = false) {

    let height = this.default_row_height;
    const padding = 9;

    for (let column = 0; column < this.cells.columns; column++) {

      const cell = this.CellData({ row, column });
      const style = cell.style;
      let text = cell.formatted || '';

      if (typeof text !== 'string') {
        text = text.map((part) => part.text).join('');
      }

      if (style && text && text.length) {
        const lines = text.split(/\n/);
        const font_height = this.StyleFontSize(style);
        height = Math.max(height, ((font_height || 10) + padding) * lines.length);
      }
    }

    this.SetRowHeight(row, height);

    if (inline) return;
    this.PublishStyleEvent(undefined, 9); // console.info("PSE 12");

  }

  /**
   * auto-sizes the column, but if the allow_shrink parameter is not set
   * it will only enlarge, never shrink the column.
   *
   * UPDATE: add inline parameter to stop broadcast
   */
  public AutoSizeColumn(column: number, allow_shrink = true, inline = false) {

    if (!Sheet.measurement_canvas) Sheet.measurement_canvas = document.createElement('canvas');
    const context = Sheet.measurement_canvas.getContext('2d');
    if (!context) return;

    let width = 12;
    const padding = 4 * 2; // FIXME: parameterize

    if (!allow_shrink) width = this.GetColumnWidth(column);

    for (let row = 0; row < this.cells.rows; row++) {
      const cell = this.CellData({ row, column });
      let text = cell.formatted || '';
      if (typeof text !== 'string') {
        text = text.map((part) => part.text).join('');
      }

      if (text && text.length) {
        context.font = Style.Font(cell.style || {});
        width = Math.max(width, Math.ceil(context.measureText(text).width) + padding);
      }
    }

    this.SetColumnWidth(column, width);

    if (inline) return;
    this.PublishStyleEvent(undefined, 10); // console.info("PSE 13");

  }

  /** returns the style properties for a given style index */
  public GetStyle(index: number) {
    return this.style_map[index];
  }

  /**
   * if the cell is in an array, returns the array as an Area.
   * if not, returns falsy (null or undefined).
   *
   * FIXME: is this used? seems like the caller could do this
   * calculation.
   */
  public ContainingArray(address: ICellAddress): Area | undefined {
    const cell = this.cells.GetCell(address);
    if (cell) return cell.area;
    return undefined;
  }

  /**
   *
   * @param before_row insert before
   * @param count number to insert
   */
  public InsertRows(before_row = 0, count = 1) {

    // this needs to be shared between sheet/cells and the
    // outside spreadsheet logic. we should not be fixing references,
    // for example, because we don't have the graph.

    // we should definitely fix merge heads. also array heads.

    // also: you cannot insert rows that would break arrays.
    // if the new row(s) are inside of a merged cell, that cell
    // consumes the new row(s).

    // validate we won't break arrays. a new row would break an
    // array if before_row is in an array and (before_row-1) is
    // in the same array.

    if (before_row) {
      for (let column = 0; column < this.cells.columns; column++) {
        const cell1 = this.cells.GetCell({ row: before_row - 1, column }, false);
        if (cell1 && cell1.area) {
          const cell2 = this.cells.GetCell({ row: before_row, column }, false);
          if (cell2 && cell2.area && cell2.area.Equals(cell1.area)) return false; // failed
        }
      }
    }

    // this.named_ranges.PatchNamedRanges(0, 0, before_row, count);

    // ok we can insert...

    if (count < 0) {
      this.cells.DeleteRows(before_row, -count);
    }
    else {
      this.cells.InsertRows(before_row, count);
    }

    // now we have to fix arrays and merge heads. these lists will keep
    // track of the _new_ starting address.

    const merge_heads: { [index: string]: Area } = {};
    const array_heads: { [index: string]: Area } = {};

    // now grab arrays and merge heads that are below the new rows
    // this should include merges that span the new range

    for (let row = before_row; row < this.cells.rows; row++) {
      for (let column = 0; column < this.cells.columns; column++) {
        const cell = this.cells.GetCell({ row, column }, false);
        if (cell) {
          if (cell.area && !array_heads[cell.area.spreadsheet_label]) {
            array_heads[cell.area.spreadsheet_label] = cell.area;
          }
          if (cell.merge_area && !merge_heads[cell.merge_area.spreadsheet_label]) {
            merge_heads[cell.merge_area.spreadsheet_label] = cell.merge_area;
          }
        }
      }
    }

    // console.info("IR arrays", array_heads);
    // console.info("IR merges", merge_heads);

    for (const key of Object.keys(array_heads)) {
      const head = array_heads[key];
      const patched = new Area(
        { row: head.start.row + count, column: head.start.column },
        { row: head.end.row + count, column: head.end.column });
      patched.Iterate((address) => {
        const cell = this.cells.GetCell(address, true);
        cell.area = patched;
      });
    }

    for (const key of Object.keys(merge_heads)) {
      const head = merge_heads[key];
      const patched_start = { row: head.start.row, column: head.start.column };
      if (head.start.row >= before_row) patched_start.row += count;
      const patched = new Area(
        patched_start,
        { row: head.end.row + count, column: head.end.column });
      patched.Iterate((address) => {
        const cell = this.cells.GetCell(address, true);
        cell.merge_area = patched;
      });
    }

    // row styles

    const row_keys = Object.keys(this.row_styles);
    const new_row_style: { [index: number]: Style.Properties } = {};

    row_keys.forEach((key) => {
      const index = Number(key);
      if (index < before_row) new_row_style[index] = this.row_styles[index];
      else if (count < 0 && index < before_row - count) { /* ? */ }
      else new_row_style[index + count] = this.row_styles[index];
    });

    this.row_styles = new_row_style;

    // cell styles

    let args: Array<number | undefined> = [];

    if (count < 0) {
      args = [before_row, -count];
    }
    else {
      args = [before_row, 0];
      for (let i = 0; i < count; i++) args.push(undefined);
    }

    this.cell_style.forEach((column) => {
      if (column.length >= before_row) {
        column.splice.apply(column, args as [number, number, Style.Properties]);
      }
    });

    // row heights

    this.row_height_.splice.apply(this.row_height_, args as [number, number, number]);

    // invalidate style cache
    this.FlushCellStyles();

    return true;

  }


  /**
   * see InsertRow for details
   */
  public InsertColumns(before_column = 0, count = 1) {

    // check for array breaks

    if (before_column) {
      for (let row = 0; row < this.cells.rows; row++) {
        const cell1 = this.cells.GetCell({ row, column: before_column - 1 }, false);
        if (cell1 && cell1.area) {
          const cell2 = this.cells.GetCell({ row, column: before_column }, false);
          if (cell2 && cell2.area && cell2.area.Equals(cell1.area)) return false; // failed
        }
      }
    }

    // this.named_ranges.PatchNamedRanges(before_column, count, 0, 0);

    // ok we can insert...

    if (count < 0) {
      this.cells.DeleteColumns(before_column, -count);
    }
    else {
      this.cells.InsertColumns(before_column, count);
    }

    // now we have to fix arrays and merge heads. these lists will keep
    // track of the _new_ starting address.

    const merge_heads: { [index: string]: Area } = {};
    const array_heads: { [index: string]: Area } = {};

    // now grab arrays and merge heads that are below the new rows
    // this should include merges that span the new range

    for (let column = before_column; column < this.cells.columns; column++) {
      for (let row = 0; row < this.cells.rows; row++) {
        const cell = this.cells.GetCell({ row, column }, false);
        if (cell) {
          if (cell.area && !array_heads[cell.area.spreadsheet_label]) {
            array_heads[cell.area.spreadsheet_label] = cell.area;
          }
          if (cell.merge_area && !merge_heads[cell.merge_area.spreadsheet_label]) {
            merge_heads[cell.merge_area.spreadsheet_label] = cell.merge_area;
          }
        }
      }
    }

    for (const key of Object.keys(array_heads)) {
      const head = array_heads[key];
      const patched = new Area(
        { row: head.start.row, column: head.start.column + count },
        { row: head.end.row, column: head.end.column + count });
      patched.Iterate((address) => {
        const cell = this.cells.GetCell(address, true);
        cell.area = patched;
      });
    }

    for (const key of Object.keys(merge_heads)) {
      const head = merge_heads[key];
      const patched_start = { row: head.start.row, column: head.start.column };
      if (head.start.column >= before_column) patched_start.column += count;
      const patched = new Area(
        patched_start,
        { row: head.end.row, column: head.end.column + count });
      patched.Iterate((address) => {
        const cell = this.cells.GetCell(address, true);
        cell.merge_area = patched;
      });
    }

    // column styles

    const column_keys = Object.keys(this.column_styles);
    const new_column_style: { [index: number]: Style.Properties } = {};

    column_keys.forEach((key) => {
      const index = Number(key);
      if (index < before_column) new_column_style[index] = this.column_styles[index];
      else if (count < 0 && index < before_column - count) { /* ? */ }
      else new_column_style[index + count] = this.column_styles[index];
    });

    this.column_styles = new_column_style;

    // cell styles

    let args: Array<number | undefined> = [];

    if (count < 0) {
      args = [before_column, -count];
    }
    else {
      args = [before_column, 0];
      for (let i = 0; i < count; i++) args.push(undefined);
    }

    this.cell_style.splice.apply(this.cell_style, args as [number, number, Style.Properties[]]);

    // row heights

    this.column_width_.splice.apply(this.column_width_, args as [number, number, number]);

    // invalidate style cache

    this.FlushCellStyles();

    return true;

  }

  /** clear cells in area */
  public ClearArea(area: Area, inline = false) {

    // this is not allowed if any of the cells are in
    // an array, and the array does not match the passed
    // array.

    // ...

    // assuming it's ok, :

    area = this.RealArea(area);
    this.cells.IterateArea(area, (cell) => cell.Reset());
    if (inline) { return; }
    return this.sheet_events.Publish({ type: 'data', area });
  }

  // ATM we have 4 methods to set value/values. we need a distinction for
  // arrays, but that could be a parameter. the single-value/multi-value
  // area functions could probably be consolidated, also the single-cell-
  // single-value function... you need logic either on the outside or the
  // inside, put that logic where it makes the most sense.

  // also some of this could be moved to the Cells class... if for no
  // other reason than to remove the iteration overhead

  /* *
   * set a single value in an area (1 cell or more)
   * /
  public SetAreaValue(area: Area, value: any) {
    area = this.RealArea(area);
    this.cells.SetArea(area, value);
    // const type = Cell.GetValueType(value);
    // this.cells.IterateArea(area, (cell) => cell.Set(value, type), true);
  }

  /* *
   * set different values (via array) in an area. mst be the
   * same shape at this point, caller should ensure.
   * /
  public SetAreaValues(area: Area, values: any[][]) { // }, parse_numbers = false) {
    area = this.RealArea(area);
    this.cells.SetArea(area, values);
  }
  */

  public SetAreaValues2(area: Area, values: any|any[][]) {

    // we don't want to limit this to the existing area, we only
    // want to remove infinities (if set). it's possible to expand
    // the grid here (maybe -- check option?)

    // actually, realarea already does exactly that -- which is not
    // what I thought. we may need a new, different method to clip.

    area = this.RealArea(area);
    this.cells.SetArea(area, values);
  }

  /**
   * set the area as an array formula, based in the top-left cell
   */
  public SetArrayValue(area: Area, value: any) {
    area = this.RealArea(area);
    this.cells.IterateArea(area, (element) => element.SetArray(area), true);
    const cell = this.cells.GetCell(area.start, true);
    cell.SetArrayHead(area, value);
  }

  /**
   * set a single value in a single cell
   */
  public SetCellValue(address: ICellAddress, value: any) {
    const cell = this.cells.GetCell(address, true);
    cell.Set(value);
  }

  /**
   * remove unused style properties from cell styles, possibly
   * dumping the cell style altogether
   */
  public PruneCellStyles() {

    for (let column = 0; column < this.cell_style.length; column++) {
      if (this.cell_style[column]) {
        const ref: Array<Style.Properties | undefined> = this.cell_style[column];
        for (let row = 0; row < ref.length; row++) {
          if (ref[row]) {
            const replacement: Style.Properties = {};

            const with_style = this.CompositeStyleForCell({ row, column });
            const without_style = this.CompositeStyleForCell({ row, column }, false);

            // ??? what does this do? It's hard to follow

            const refrow = ref[row];
            if (refrow) {
              for (const key of Object.keys(refrow) as Style.PropertyKeys[]) {
                if (!this.StyleEquals(with_style[key], without_style[key])) {
                  (replacement as any)[key] = refrow[key];
                }
              }
            }

            if (Object.keys(replacement).length === 0) ref[row] = undefined;
            else ref[row] = replacement;

          }
        }
      }
    }

  }

  /**
   * gets the formula for a given cell (instead of the
   * rendered value), accounting for arrays.
   */
  public GetCellFormula(address: ICellAddress) {
    let cell = this.cells.GetCell(address);
    if (!cell) return undefined;
    if (cell.area) cell = this.cells.GetCell(cell.area.start);
    if (!cell) return undefined;
    return { formula: cell.value, is_array: !!cell.area };
  }

  /**
   * returns the area bounding actual content
   * (i.e. flattening "entire row/column/sheet")
   */
  public RealArea(area: Area) {

    const start = area.start; // this is a copy
    const end = area.end;     // ditto

    if (area.entire_row) {
      start.column = 0;
      start.absolute_column = false;
      end.column = this.cells.columns - 1;
      end.absolute_column = false;
    }

    if (area.entire_column) {
      start.row = 0;
      start.absolute_row = false;
      end.row = this.cells.rows - 1;
      end.absolute_row = false;
    }

    return new Area(start, end);

  }

  /**
   * returns the contents of the given area as tab-separated
   * values, intended for pasting into excel. this should be
   * either the raw value or the raw calculated result, if it
   * exists.
   */
  public GetTSV(area?: Area): string {

    if (!area) area = new Area({ row: Infinity, column: Infinity });
    area = this.RealArea(area);
    const lines = [];

    for (let r = area.start.row; r <= area.end.row; r++) {
      const line = [];
      for (let c = area.start.column; c <= area.end.column; c++) {
        const cell = this.CellData({ row: r, column: c });
        let value = cell.calculated_type ? cell.calculated : cell.value;
        if (typeof value === 'undefined') value = '';
        if (/\n/.test(value)) line.push('"' + value + '"');
        else line.push(value);
      }
      lines.push(line.join('\t').replace(/\s+$/, ''));
    }
    return lines.join('\n').replace(/\s+$/, '');

  }

  /**
   * generates serializable object. given the new data semantics this
   * has to change a bit. here is what we are storing:
   *
   * all style data (sheet, row/column, alternate and cell)
   * raw value for cell
   * array head for arrays
   * row height and column width arrays
   *
   * because we have sparse arrays, we convert them to flat objects first.
   */
  public toJSON(options: SerializeOptions = {}) {

    // flatten height/width arrays

    const flatten_numeric_array = (arr: number[], default_value: number) => {
      const obj: { [index: number]: number } = {};
      for (let i = 0; i < arr.length; i++) {
        if ((typeof arr[i] !== 'undefined') && arr[i] !== default_value) obj[i] = arr[i];
      }
      if (Object.keys(obj).length) return obj;
      return undefined;
    };

    // flatten cell styles, which is a sparse array
    // UPDATE: ref table

    // NOTE: we originally did this (I think) because it's possible for a
    // cell to have a style but have no other data, and therefore not be
    // represented. but we should be able to store the data in the cell object
    // if we have it...

    let cell_style_refs = [{}]; // include an empty entry at zero

    const cell_style_map: { [index: string]: number } = {};

    const cell_reference_map: number[][] = [];

    // (1) create a map of cells -> references, and build the reference
    //     table at the same time. preserve indexes? (...)

    // it would be nice if we could use some sort of numeric test, rather
    // than leaving empty indexes as undefined -- that requires a type test
    // (to avoid zeros).

    // actually we could just offset the index by 1... (see above)

    for (let c = 0; c < this.cell_style.length; c++) {
      const column = this.cell_style[c];
      if (column) {
        cell_reference_map[c] = [];
        for (let r = 0; r < column.length; r++) {
          if (column[r]) {
            const style_as_json = JSON.stringify(column[r]);
            let reference_index = cell_style_map[style_as_json];
            if (typeof reference_index !== 'number') {
              cell_style_map[style_as_json] = reference_index = cell_style_refs.length;
              cell_style_refs.push(column[r]);
            }
            cell_reference_map[c][r] = reference_index;
          }
        }
      }
    }

    // ensure we're not linked
    cell_style_refs = JSON.parse(JSON.stringify(cell_style_refs));

    // same here (note broken naming)
    const sheet_style = JSON.parse(JSON.stringify(this.sheet_style));
    const row_style = JSON.parse(JSON.stringify(this.row_styles));
    const column_style = JSON.parse(JSON.stringify(this.column_styles));

    // translate, if necessary
    if (options.export_colors) {
      const style_list: Style.Properties[] = [];
      for (const group of [row_style, column_style, cell_style_refs, [sheet_style]]) {
        if (Array.isArray(group)) {
          for (const entry of group) style_list.push(entry);
        }
        else {
          for (const key of Object.keys(group)) style_list.push(group[key]);
        }
      }
      for (const style of style_list as Style.Properties[]) {
        if (typeof style.background !== 'undefined') {
          style.background = Measurement.MeasureColorARGB(style.background);
        }
        if (typeof style.text_color !== 'undefined') {
          if (style.text_color === Style.DefaultProperties.text_color) {
            style.text_color = undefined;
          }
          else {
            style.text_color = Measurement.MeasureColorARGB(style.text_color);
          }
        }
      }
    }

    // FIXME: flatten row/column styles too

    // flatten data -- also remove unecessary fields (FIXME: you might
    // keep rendered data, so it doesn't have to do work on initial render?)

    const serialization_options: CellSerializationOptions = {
      calculated_value: !!options.rendered_values,
      preserve_type: !!options.preserve_type,
      expand_arrays: !!options.expand_arrays,
      decorated_cells: !!options.decorated_cells,
      nested: true,
      cell_style_refs: cell_reference_map,
    };

    const data = this.cells.toJSON(serialization_options).data;

    // (3) (style) for anything that hasn't been consumed, create a
    //     cell style map. FIXME: optional [?]

    const cell_styles: Array<{row: number, column: number, ref: number}> = [];

    for (let c = 0; c < cell_reference_map.length; c++) {
      const column = cell_reference_map[c];
      if (column) {
        for (let r = 0; r < column.length; r++) {
          if (column[r]) {
            cell_styles.push({ row: r, column: c, ref: column[r] });
          }
        }
      }
    }

    const result: SerializedSheet = {

      // not used atm, but in the event we need to gate
      // or swap importers on versions in the future

      // FIXME: drop, in favor of container versioning. there's no point
      // in this submodule versioning (is there? ...)

      // version: (ModuleInfo as any).version,

      id: this.id,
      name: this.name,

      data,
      sheet_style,
      rows: this.rows,
      columns: this.columns,
      cell_styles,
      cell_style_refs,
      row_style,
      column_style,

      // why are these serialized? (...)

      // default_row_height: this.default_row_height,
      // default_column_width: this.default_column_width,

      row_height: flatten_numeric_array(this.row_height_, this.default_row_height),
      column_width: flatten_numeric_array(this.column_width_, this.default_column_width),

    };

    // moved to outer container (data model)

    /*
    // omit if empty

    if (this.named_ranges.Count()) {
      result.named_ranges = JSON.parse(JSON.stringify(this.named_ranges.Map()));
    }
    */

    // only put in freeze if used

    if (this.freeze.rows || this.freeze.columns) {
      result.freeze = this.freeze;
    }

    return result;
  }

  /** export values and calcualted values; as for csv export (which is what it's for) */
  public ExportValueData(transpose = false, dates_as_strings = false, export_functions = false): any[][] {

    const arr = [];
    const data = this.cells.data2;

    if (transpose) {
      const rowcount = data[0].length; // assuming it's a rectangle
      for (let r = 0; r < rowcount; r++) {
        const row = [];
        for (const column of data) {
          const ref = column[r];
          let value: any;
          if (!export_functions && typeof ref.calculated !== 'undefined') value = ref.calculated;
          else if (typeof ref.value === 'undefined') value = '';
          else value = ref.value;

          if (dates_as_strings && ref.style && typeof value === 'number') {
            const format = NumberFormatCache.Get(ref.style.number_format || '');
            if (format.date_format) value = format.Format(value);
          }

          // if (dates_as_strings && ref.style && ref.style.date && typeof value === 'number') {
          //  value = Style.Format(ref.style, value);
          // }
          row.push(value);
        }
        arr.push(row);
      }
    }
    else {
      for (const column_ref of data) {
        const column = [];
        for (const ref of column_ref) {
          let value: any;
          if (!export_functions && typeof ref.calculated !== 'undefined') value = ref.calculated;
          else if (typeof ref.value === 'undefined') value = '';
          else value = ref.value;

          if (dates_as_strings && ref.style && typeof value === 'number') {
            const format = NumberFormatCache.Get(ref.style.number_format || '');
            if (format.date_format) value = format.Format(value);
          }

          // if (dates_as_strings && ref.style && ref.style.date && typeof value === 'number') {
          //   value = Style.Format(ref.style, value);
          // }
          column.push(value);
        }
        arr.push(column);
      }
    }

    return arr;
  }

  /** flushes ALL rendered styles and caches. made public for theme API */
  public FlushCellStyles() {
    this.style_map = [];
    this.style_json_map = [];
    this.cells.FlushCellStyles();
  }

  // --- protected ------------------------------------------------------------

  /**
   * when checking style properties, check falsy but not '' or 0
   * (also strict equivalence)
   */
  protected StyleEquals(a: any, b: any) {
    return a === b ||
      ((a === false || a === null || a === undefined)
        && (b === false || b === null || b === undefined));
  }

  protected Serialize() {
    return JSON.stringify(this);
  }

  protected Deserialize(data: SerializedSheet) {
    Sheet.FromJSON(data, this);

    // some overlap here... consolidate? actually, doesn't
    // fromJSON call flush styles? [A: sometimes...]

    this.cells.FlushCachedValues();
    this.FlushCellStyles();
  }

  // --- private methods ------------------------------------------------------


  /**
   * update style properties. merge by default.
   *
   * this method will reverse-override properties, meaning if you have set (for
   * example) a cell style to bold, then you set the whole sheet to unbold, we
   * expect that the unbold style will control. instead of explicitly setting
   * the cell style, we go up the chain and remove any matching properties.
   */
  private UpdateSheetStyle(properties: Style.Properties, delta = true, inline = false) {
    this.sheet_style = Style.Merge(this.sheet_style, properties, delta);

    // reverse-override...

    // const keys = Object.keys(properties);
    const keys = Object.keys(properties) as Style.PropertyKeys[];
    // const keys = Object.keys(this.sheet_style) as Style.PropertyKeys[];

    for (const style_column of this.cell_style) {
      if (style_column) {
        for (const style_ref of style_column) {
          if (style_ref) {
            keys.forEach((key) => delete style_ref[key]);
          }
        }
      }
    }

    for (const index of Object.keys(this.row_styles)) {
      keys.forEach((key) => delete this.row_styles[index as unknown as number][key]);
    }

    for (const index of Object.keys(this.column_styles)) {
      keys.forEach((key) => delete this.column_styles[index as unknown as number][key]);
    }

    this.FlushCellStyles(); // not targeted

    if (inline) return;

    this.PublishStyleEvent(undefined, 4); // console.info("PSE 4");

  }

  /**
   * updates row properties. reverse-overrides cells (@see UpdateSheetStyle).
   *
   * we also need to ensure that the desired effect takes hold, meaning if
   * there's an overriding column property (columns have priority), we will
   * need to update the cell property to match the desired output.
   */
  private UpdateRowStyle(row: number, properties: Style.Properties, delta = true, inline = false) {
    this.row_styles[row] = Style.Merge(this.row_styles[row] || {}, properties, delta);

    // reverse-override... remove matching properties from cells in this row
    // (we can do this in-place)

    // const keys = Object.keys(properties);
    const keys = Object.keys(properties) as Style.PropertyKeys[];
    // const keys = Object.keys(this.row_styles[row]) as Style.PropertyKeys[];

    for (const column of this.cell_style) {
      if (column && column[row]) {

        // FIXME: we don't want to delete. reverse-add.
        keys.forEach((key) => delete column[row][key]);

      }
    }

    // if there's a column style, it will override the row
    // style; so we need to set a cell style to compensate.

    for (let i = 0; i < this.cells.columns; i++) {
      if (this.column_styles[i]) {
        const column_style = this.column_styles[i];
        const override: Style.Properties = this.cell_style[i] ? this.cell_style[i][row] || {} : {};
        keys.forEach((key) => {
          if (typeof column_style[key] !== 'undefined') {
            (override as any)[key] = properties[key];
          }
        });
        if (Object.keys(override).length) {
          // console.info(override);
          if (!this.cell_style[i]) this.cell_style[i] = [];
          this.cell_style[i][row] = override;
        }
      }
    }

    this.cells.IterateArea(this.RealArea(Area.FromRow(row)), (cell) => cell.FlushStyle());

    if (inline) return;

    this.PublishStyleEvent(undefined, 5); // console.info("PSE 5");

  }

  /** updates column properties. reverse-overrides cells (@see UpdateSheetStyle). */
  private UpdateColumnStyle(column: number, properties: Style.Properties, delta = true, inline = false) {
    this.column_styles[column] = Style.Merge(this.column_styles[column] || {}, properties, delta);

    // returning to this function after a long time. so what this is doing
    // is removing unecessary properties from style objects higher in the
    // style chain, if those properties are overridden. note that this doesn't
    // seem to prune now-empty styles, which it probably should...

    // in essence, we have a containing style object
    // { a: 1, c: 2 }
    //
    // then we iterate all cells in the column, and if there are any
    // matching properties they're deleted; so if a cell has
    // { a: 0, b: 1 }
    //
    // we drop the a property, so it becomes
    // { b: 1 }
    //
    // note you can drop and re-create the cell style object, because the cell's
    // reference is actually to a separate object (composited with the stack),
    // and the reference is cleared so the composite will be rebuilt when it's
    // needed next.

    // NOTE this was broken anyway; it wasn't taking the merge into account...
    // ALTHOUGH that breaks "remove-color" operations. I think the old way
    // took into account that the styles would be relatively in sync already.

    // reverse-override... I think we only need to override _cell_ values.

    const keys = Object.keys(properties) as Style.PropertyKeys[];
    // const keys = Object.keys(this.column_styles[column]) as Style.PropertyKeys[];

    if (this.cell_style[column]) {
      for (const ref of this.cell_style[column]) {
        if (ref) {
          // FIXME: we don't want to delete. reverse-add.
          keys.forEach((key) => delete ref[key]);
        }
      }
    }

    this.cells.IterateArea(this.RealArea(Area.FromColumn(column)), (cell) => cell.FlushStyle());

    if (inline) return;

    this.PublishStyleEvent(undefined, 6); // console.info("PSE 6");
  }


  //


  private PublishStyleEvent(area?: Area, log?: any) {

    // block on undo batching; but note that the undo batch won't
    // publish an event later, so you need to do that manually

    this.sheet_events.Publish({ type: 'style', area });

    // trace (we are trying to remove all calls)

    if (log) console.info("PSE", log);

  }

  /**
   * generates the composite style for the given cell. this
   * should only be used to generate a cache of styles (Q: really? PERF?)
   *
   * the last parameter is used for testing when pruning. we want to check
   * what happens if the cell style is not applied; if nothing happens, then
   * we can drop the cell style (or the property in the style).
   */
  private CompositeStyleForCell(address: ICellAddress, apply_cell_style = true) {
    const { row, column } = address;
    const stack = [this.sheet_style];
    if (this.row_styles[row]) stack.push(this.row_styles[row]);
    if (this.column_styles[column]) stack.push(this.column_styles[column]);
    if (apply_cell_style
      && this.cell_style[column]
      && this.cell_style[column][row]) {
      stack.push(this.cell_style[column][row]);
    }
    return Style.Composite(stack);
  }

  /**
   *
   */
  private GetStyleIndex(style: Style.Properties) {

    const json = JSON.stringify(style);

    for (let i = 0; i < this.style_json_map.length; i++) {
      if (json === this.style_json_map[i]) return i; // match
    }

    // ok we need to add it to the list. make sure to add a copy,
    // and add json to the json index.

    const new_index = this.style_map.length;
    this.style_map.push(JSON.parse(json));
    this.style_json_map.push(json);

    return new_index;

  }

}

