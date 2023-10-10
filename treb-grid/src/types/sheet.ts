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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

// --- treb imports -----------------------------------------------------------

import { ValueType, Cells, Style, 
  type CellStyle, 
  type PropertyKeys,
  type Color,
  Area, IsFlatDataArray, 
  IsNestedRowArray, IsCellAddress, DOMUtilities
} from 'treb-base-types';
import { NumberFormatCache } from 'treb-format';
import { Measurement, ValidateURI } from 'treb-utils';

import type { TextPart ,
  Cell, ICellAddress, CellSerializationOptions, CellValue, ImportedSheetData, Complex, 
  DimensionedQuantity, IArea, Table, TableTheme, HorizontalAlign, VerticalAlign} from 'treb-base-types';

// --- local imports ----------------------------------------------------------

import type { FreezePane, SerializedSheet, ScrollOffset } from './sheet_types';
import type { SerializeOptions } from './serialize_options';
import type { GridSelection } from './grid_selection';
import { CreateSelection } from './grid_selection';
import { Annotation } from './annotation';
import type { ConditionalFormatList } from './conditional_format';

// --- constants --------------------------------------------------------------

const DEFAULT_COLUMN_WIDTH = 100;
// const DEFAULT_ROW_HEIGHT = 26; // not used because it's based on font (theoretically)
const DEFAULT_ROW_HEADER_WIDTH = 60;

// does this have optional ref/style because an older version inlined styles, 
// instead of using references? we can probably drop support for that because
// if that was the case, it was a long time ago

interface CellStyleRef {
  row: number;
  column: number;
  ref?: number;
  style?: CellStyle;
  rows?: number;
}

export class Sheet {

  // --- static members -------------------------------------------------------

  public static base_id = 100;

  public static readonly default_sheet_name = 'Sheet1';

  // FIXME: use the external measurement object (from utils)
  // private static measurement_canvas?: HTMLCanvasElement;

  /**
   * adding verbose flag so we can figure out who is publishing
   * (and stop -- part of the ExecCommand switchover)
   */
  // public static readonly sheet_events = new EventSource<SheetEvent>(true, 'sheet-events');


  // --- instance members -----------------------------------------------------

  /**
   * in the old model, we had a concept of "default" style properties. we then
   * used that object for theming: we would set default properties when the theme
   * changed.
   *
   * the problem is that if there are multiple instances on a single page, with
   * different themes, they would clash.
   *
   * so the new concept is to have a default property set per instance, managed
   * by the grid instance. any sheets that are loaded in/created by grid will
   * get a reference to that property set, and grid can update it as desired.
   *
   * because it's a reference, it should be constant.
   * FIXME: move to model...
   */
  public readonly default_style_properties: CellStyle;

  /* moved from grid */
  public annotations: Annotation[] = [];

  // moved from layout
  public freeze: FreezePane = {
    rows: 0,
    columns: 0,
  };

  /** testing */
  // public scale = 1.0;

  public visible = true;

  /** standard width (FIXME: static?) */
  public default_column_width = 100;

  /** standard height (FIXME: static?) */
  public default_row_height = 25;

  /** cells data */
  public readonly cells: Cells = new Cells();

  /**
   * selection. moved to sheet to preserve selections in multiple sheets.
   * this instance should just be used to populate the actual selection,
   * not used as a reference.
   */
  public selection: GridSelection = CreateSelection();

  /**
   * cache scroll offset for flipping between sheets. should this be
   * persisted? (...)
   */
  public scroll_offset: ScrollOffset = { x: 0, y: 0 };

  /**
   * named ranges: name -> area
   * FIXME: this needs to move to an outer container, otherwise we
   * may get conflicts w/ multiple sheets. unless we want to allow that...
   */
  // public named_ranges = new NamedRangeCollection();

  public name = Sheet.default_sheet_name;

  public background_image?: string;

  protected _image: HTMLImageElement|undefined = undefined;

  /**
   * set this flag when we need to update conditional formats even
   * if they are not dirty (generally when one is deleted)
   */
  public flush_conditional_formats = false;

  public get image(): HTMLImageElement|undefined {
    return this._image;
  }

  /**
   * @internal
   */
  public conditional_formats: ConditionalFormatList = [];

  /**
   * @internal
   * 
   * testing, not serialized atm
   */
  public outline: number[] | undefined;

  /** internal ID */
  // tslint:disable-next-line: variable-name
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

  private style_map: CellStyle[] = [];

  // we use json for comparison. it should be faster than the alternative
  // (even if that doesn't make sense).

  private style_json_map: string[] = [];

  // style now uses overlays, but we want to precalculate the
  // overlaid values. we need to hold on to the originals, in
  // the event something changes, so we can redo the calculation.

  // there's a default at the bottom that gets applied to everything.
  // (in Style). above that, we have the sheet style

  private sheet_style: CellStyle = {};

  // then individual (applied) row and column styles (indexed by row/column)

  private row_styles: Record<number, CellStyle> = {};

  private column_styles: Record<number, CellStyle> = {};

  /* 
  we used to have "alternate row" styles. it's clumsy, but it is a nice
  effect. we will add that back via a "pattern". not sure how the UI would
  work for this, but programatically it works.
 
  just rows atm, not columns.
  */

  private row_pattern: CellStyle[] = [];

  // and finally any cell-specific styles. [FIXME: this is sparse]
  // [why FIXME? sparse is OK in js]

  private cell_style: CellStyle[][] = [];

  /**
   * applied conditional formats are stored them in this array;
   * they will be stacked on top of cell style when rendering.
   * conditional formats have top priority. [FIXME: what about tables?]
   */
  private conditional_format_cache: CellStyle[][][] = [];

  /**
   * this is a list of cells we formatted on the last pass, so we can 
   * compare when applying conditional formats .
   * 
   * update: using areas
   */
  private conditional_format_checklist: IArea[] = [];

  // --- accessors ------------------------------------------------------------

  // public get column_header_count() { return this.column_header_count_; }

  public get header_offset(): { x: number, y: number } {
    return { x: this.row_header_width, y: this.column_header_height };
  }

  /** accessor: now just a wrapper for the call on cells */
  public get rows(): number { return this.cells.rows; }

  /** accessor: now just a wrapper for the call on cells */
  public get columns(): number { return this.cells.columns; }

  public get id(): number { return this.id_; }

  public set id(id: number) {
    this.id_ = id;
    if (this.id >= Sheet.base_id) {
      Sheet.base_id = this.id + 1;
    }
  }

  /**
   * constructor is now protected. use a factory method (Blank or FromJSON).
   */
  protected constructor(theme_style_properties: CellStyle) {

    this.default_style_properties = theme_style_properties;

    // FIXME: the below should be called in a separate 'init' method
    // that can be called after we change styles (since it will measure)

    this.default_column_width = DEFAULT_COLUMN_WIDTH;
    this.row_header_width = DEFAULT_ROW_HEADER_WIDTH;
    this.UpdateDefaultRowHeight();

    this.id_ = Sheet.base_id++;

  }

  // --- class methods --------------------------------------------------------

  public static Reset(): void {
    this.base_id = 100;
  }

  /**
   * factory method creates a new sheet
   */
  public static Blank(style_defaults: CellStyle, name?: string, rows = 30, columns = 20): Sheet {

    const sheet = new Sheet(style_defaults);

    if (name) {
      sheet.name = name;
    }

    rows = Math.max(rows, 1);
    columns = Math.max(columns, 1);
    sheet.cells.EnsureCell({ row: rows - 1, column: columns - 1 });
    return sheet;
  }

  /**
   * update old-style alignment constants to the new symbolic values.
   * updates in place.
   */
  public static UpdateStyle(properties: CellStyle) {

    if (typeof properties.horizontal_align === 'number') {
      const members: HorizontalAlign[] = [
        '',       // Style.HorizontalAlign.None,
        'left',   // Style.HorizontalAlign.Left,
        'center', // Style.HorizontalAlign.Center,
        'right',  // Style.HorizontalAlign.Right,
      ]
      properties.horizontal_align = members[properties.horizontal_align] || undefined;
    }

    if (typeof properties.vertical_align === 'number') {
      const members: VerticalAlign[] = [
        '',       // Style.VerticalAlign.None,
        'top',    // Style.VerticalAlign.Top,
        'bottom', // Style.VerticalAlign.Bottom,
        'middle', // Style.VerticalAlign.Middle,
      ]
      properties.vertical_align = members[properties.vertical_align] || undefined;
    }
    
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
  public static FromJSON(json: string | Partial<SerializedSheet>, style_defaults: CellStyle, sheet?: Sheet): Sheet {

    const source: SerializedSheet = (typeof json === 'string') ?
      JSON.parse(json) : json as SerializedSheet;

    const unflatten_numeric_array = (target: number[], data: Record<string, number>) => { // , default_value: number) => {
      Object.keys(data).forEach((key) => {
        const index = Number(key) || 0;
        target[index] = data[key];
      });
    };

    if (!sheet) {
      sheet = new Sheet(style_defaults);
    }

    if (source.default_column_width) {
      sheet.default_column_width = source.default_column_width;
    }
    if (source.default_row_height) {
      sheet.default_row_height = source.default_row_height;
    }

    if (source.conditional_formats) {
      sheet.conditional_formats = source.conditional_formats;
    }

    // persist ID, name

    if (source.id) {
      sheet.id = source.id;
    }
    if (source.name) {
      sheet.name = source.name;
    }

    if (source.background_image) {
      sheet.background_image = source.background_image;
    }

    // FIXME: this should only be done on load (and possibly paste).
    // we don't need to do it on every parse, which also happens on 
    // undo and some other things.

    const patch_style = (style: CellStyle) => {

      // this part is for back compat with older color schemes, it 
      // could theoretically come out if we don't care (or maybe have a tool)

      // UPDATE for updated font properties

      const ref = (style as CellStyle & {
        text_color?: string;
        background?: string;
        border_top_color?: string;
        border_left_color?: string;
        border_bottom_color?: string;
        border_right_color?: string;

        font_bold?: boolean;
        font_italic?: boolean;
        font_underline?: boolean;
        font_strike?: boolean;

        font_size_value?: number;
        font_size_unit?: 'pt' | 'px' | 'em' | '%';

      });

      this.UpdateStyle(ref);

      if (ref.font_size_value || ref.font_size_unit) {

        ref.font_size = {
          unit: ref.font_size_unit || 'pt',
          value: ref.font_size_value || 10,
        };

        ref.font_size_unit = undefined;
        ref.font_size_value = undefined;
      }

      if (ref.font_bold) {
        ref.bold = true;
        ref.font_bold = undefined;
      }

      if (ref.font_italic) {
        ref.italic = true;
        ref.font_italic = undefined;
      }

      if (ref.font_underline) {
        ref.underline = true;
        ref.font_underline = undefined;
      }

      if (ref.font_strike) {
        ref.strike = true;
        ref.font_strike = undefined;
      }

      if (ref.text_color) {
        if (ref.text_color !== 'none') {
          ref.text = { text: ref.text_color };
        }
        ref.text_color = undefined; // will get cleared, eventually
      }

      if (ref.background) {
        if (ref.background !== 'none') {
          ref.fill = { text: ref.background };
        }
        ref.background = undefined; // ibid
      }

      if (ref.border_top_color) {
        if (ref.border_top_color !== 'none') {
          ref.border_top_fill = { text: ref.border_top_color };
        }
        ref.border_top_color = undefined;
      }

      if (ref.border_left_color) {
        if (ref.border_left_color !== 'none') {
          ref.border_left_fill = { text: ref.border_left_color };
        }
        ref.border_left_color = undefined;
      }

      if (ref.border_bottom_color) {
        if (ref.border_bottom_color !== 'none') {
          ref.border_bottom_fill = { text: ref.border_bottom_color };
        }
        ref.border_bottom_color = undefined;
      }

      if (ref.border_right_color) {
        if (ref.border_right_color !== 'none') {
          ref.border_right_fill = { text: ref.border_right_color };
        }
        ref.border_right_color = undefined;
      }

    };

    // use the new name, if available; fall back to the old name, and because
    // that's now optional, add a default.

    const cell_style_refs = source.styles || source.cell_style_refs || [];

    /*
    const cell_style_refs = source.cell_style_refs;
    */
    for (const entry of cell_style_refs) {
      patch_style(entry);
    }

    // styles (part 1) -- moved up in case we use inlined style refs

    // so this is converting "ref" (number) to "style" (properties)...
    // in the same object. why do we do this here, and early?

    sheet.cell_style = [];

    if (cell_style_refs) {
      (source.cell_styles || []).forEach((cell_style: CellStyleRef) => {
        if (typeof cell_style.ref === 'number') {
          cell_style.style =
            JSON.parse(JSON.stringify(cell_style_refs[cell_style.ref])); // clone
        }
      });
    }

    // data: cells (moved after style)

    sheet.cells.FromJSON(source.data);
    if (source.rows) sheet.cells.EnsureRow(source.rows - 1);
    if (source.columns) sheet.cells.EnsureColumn(source.columns - 1);

    // new style stuff

    // different handling for nested, flat, but we only have to
    // check once because data is either nested or it isn't.

    if (source.data) {
      if (IsFlatDataArray(source.data)) {
        for (const entry of source.data) {
          if (entry.style_ref) {
            if (!sheet.cell_style[entry.column]) sheet.cell_style[entry.column] = [];
            sheet.cell_style[entry.column][entry.row] = // entry.style;
              JSON.parse(JSON.stringify(cell_style_refs[entry.style_ref])); // clone
          }
        }
      }
      else {
        if (IsNestedRowArray(source.data)) {
          for (const block of source.data) {
            const row = block.row;
            for (const entry of block.cells) {
              const column = entry.column;
              if (entry.style_ref) {
                if (!sheet.cell_style[column]) sheet.cell_style[column] = [];
                sheet.cell_style[column][row] = // entry.style;
                  JSON.parse(JSON.stringify(cell_style_refs[entry.style_ref])); // clone
              }
            }
          }
        }
        else {
          for (const block of source.data) {
            const column = block.column;
            for (const entry of block.cells) {
              const row = entry.row;
              if (entry.style_ref) {
                if (!sheet.cell_style[column]) sheet.cell_style[column] = [];
                sheet.cell_style[column][row] = // entry.style;
                  JSON.parse(JSON.stringify(cell_style_refs[entry.style_ref])); // clone
              }
            }
          }
        }
      }
    }


    // freeze

    sheet.freeze.rows = 0;
    sheet.freeze.columns = 0;

    if (source.freeze) {
      sheet.freeze.rows = source.freeze.rows || 0;
      sheet.freeze.columns = source.freeze.columns || 0;
    }

    // scroll, optionally

    sheet.scroll_offset = source.scroll ? { ...source.scroll } : { x: 0, y: 0 };

    // wrap up styles

    for (const cell_style of ((source.cell_styles || []) as CellStyleRef[])) {
      if (cell_style.style) {
        if (!sheet.cell_style[cell_style.column]) sheet.cell_style[cell_style.column] = [];
        sheet.cell_style[cell_style.column][cell_style.row] = cell_style.style;

        // update for blocks
        // these are styles, not references... not sure why we translated 
        // (above) but if so, we probably need to clone

        if (cell_style.rows) {
          for (let r = 1; r < cell_style.rows; r++) {
            sheet.cell_style[cell_style.column][cell_style.row + r] = 
              JSON.parse(JSON.stringify(cell_style.style));
          }
        }
      }
    }

    sheet.sheet_style = source.sheet_style || {};
    // sheet.row_styles = source.row_style;
    // sheet.column_styles = source.column_style;

    // these are NOT arrays atm. that might be a problem (might not). I think
    // this was accidental. when running, we don't care, because empty array
    // indexes don't consume memory (AFAIK). when serializing, we do care, but
    // how we serialize shouldn't impact how we operate at runtime.

    // it breaks when we do patching (below), although we could just fix 
    // patching. also TODO: merge patching with the map routine.

    sheet.column_styles = {};
    sheet.row_styles = {};

    const MapStyles = (source_list: Record<number, number | CellStyle>, target_list: Record<number, CellStyle>) => {

      for (const key of Object.keys(source_list)) {
        const index = Number(key);
        const value = source_list[index];
        if (typeof value === 'number') {
          const properties = cell_style_refs[value];
          if (properties) {
            target_list[index] = JSON.parse(JSON.stringify(properties)); // clone jic
            patch_style(target_list[index]);
          }
        }
        else if (value) {
          target_list[index] = value;
          patch_style(target_list[index]);
        }
      }
    };

    MapStyles(source.row_style, sheet.row_styles);
    MapStyles(source.column_style, sheet.column_styles);

    /*
    for (const key of Object.keys(source.column_style)) {
      const index = Number(key);
      const value = source.column_style[index];
      if (typeof value === 'number') {
        const properties = cell_style_refs[value];
        if (properties) {
          sheet.column_styles[index] = JSON.parse(JSON.stringify(properties)); // clone jic
        }
      }
      else {
        sheet.column_styles[index] = value;
      }
    }
    */

    sheet.row_pattern = source.row_pattern || [];

    // patch other styles

    patch_style(sheet.sheet_style || {});
    for (const entry of sheet.row_pattern) {
      patch_style(entry);
    }

    /*
    for (const key of Object.keys(sheet.column_styles)) {
      patch_style(sheet.column_styles[key as any]);
    }

    for (const key of Object.keys(sheet.row_styles)) {
      patch_style(sheet.row_styles[key as any]);
    }
    */

    // ok


    // if (hints && !hints.data) sheet.FlushCellStyles();

    // sheet.default_row_height = obj.default_row_height;
    // sheet.default_column_width = obj.default_column_width;

    sheet.row_height_ = [];
    unflatten_numeric_array(sheet.row_height_, source.row_height || {},
    ); // sheet.default_row_height);
    // obj.default_row_height);

    if (sheet.row_height_.length) {
      sheet.cells.EnsureRow(sheet.row_height_.length - 1);
    }

    sheet.column_width_ = [];
    unflatten_numeric_array(sheet.column_width_, source.column_width || {},
    ); // sheet.default_column_width);
    // obj.default_column_width);

    if (sheet.column_width_.length) {
      sheet.cells.EnsureColumn(sheet.column_width_.length - 1);
    }

    // NOTE: we're padding out rows/columns here to be under annotations,
    // otherwise the pruning may have removed them. it would probably be
    // preferable to not prune them... that shouldn't add much extra data
    // because it would just be the number.

    // FIXME

    sheet.annotations = (source.annotations || []).map((entry) => new Annotation(entry));

    if (source.selection) {

      // copy to ensure there's no link to random object
      sheet.selection = JSON.parse(JSON.stringify(source.selection));

    }

    sheet.visible = true; // default
    if (typeof source.visible !== 'undefined') {
      sheet.visible = !!source.visible;
    }


    return sheet;

  }


  public Activate() {

    // load background image, if set

    if (this.background_image) {
      const resource = ValidateURI(this.background_image);
      if (resource) {
        this._image = DOMUtilities.Create('img');
        this._image.src = resource;
      }

      // this._image = image_store.Get(this.background_image);
    }
  }

  /* *
   * factory method creates a sheet from a 2D array.
   *
   * /
  public static FromArray(data: any[] = [], transpose = false): Sheet {
    const sheet = new Sheet();
    sheet.cells.FromArray(data, transpose);

    return sheet;
  }
  */


  // --- public methods -------------------------------------------------------

  public MergeCells(area: Area): void {

    // FIXME: it's an error if this area includes some
    // (but not all) of another merge area.

    // ...

    // assuming we're good to go...

    area = area.Clone();
    this.cells.Apply(area, (cell, c, r) => {
      cell.merge_area = area;
      cell.render_clean = [];

      // clear data in !head
      if (c !== area.start.column || r !== area.start.row) cell.Reset();
    }, true);

  }

  public UnmergeCells(area: Area): void {

    // this _must_ be the full merge area. to get it, just get
    // the merge property from a particular cell or cells.

    // let's check:

    let match = true;
    this.cells.Apply(area, (cell) => {
      match = match && !!cell.merge_area && area.Equals(cell.merge_area);
    }, false);

    if (!match) {
      console.warn('area mismatch');
      return;
    }

    this.cells.Apply(area, (cell) => {
      cell.merge_area = undefined;
      cell.render_clean = [];
    }, false);

  }

  /**
   * FIXME: measure the font.
   * 
   * Can we use the same metrics as renderer? That uses a canvas. Obviously
   * canvas won't work if there's no DOM but it's OK if this method fails in
   * that case; the only question is will it break if it's running headless?
   */
  public StyleFontSize(style: CellStyle, default_properties: CellStyle = {}): number {

    let font_height = (style.font_size?.value || 0);

    let scale = 0;

    switch (style.font_size?.unit) {
      case 'px':
        font_height *= (75 / 100);
        break;

      case 'em':
        scale = style.font_size.value || 1;
        break;

      case '%':
        scale = (style.font_size.value || 100) / 100;
        break;
    }

    if (scale) {
      font_height = scale * (default_properties.font_size?.value || 10);
      if (default_properties.font_size?.unit === 'px') {
        font_height *= (75 / 100);
      }
    }

    return font_height || 10;

  }

  /**
   * FIXME: this is called in the ctor, which made sense when sheets
   * were more ephemeral. now that we update a single instance, rather
   * than create new instances, we lose this behavior. we should call
   * this when we change sheet style.
   * 
   * removing parameter, event
   */
  public UpdateDefaultRowHeight(): void {

    const composite = Style.Composite([this.default_style_properties, this.sheet_style]);

    if (typeof window !== 'undefined') {

      const measurement = Measurement.MeasureText(Style.Font(composite), 'M');
      const height = Math.round(measurement.height * 1.4);

      if (this.default_row_height < height) {
        this.default_row_height = height;
      }

    }
    /*
    else {
      // console.info('worker?');
    }
    */

  }

  /**
   * deprecated (or give me a reason to keep it)
   * KEEP IT: just maintain flexibility, it has very low cost
   */
  public SetRowHeaders(headers: CellValue[]): void {
    this.row_headers = headers.map(value => value === undefined ? '' : value.toString());
    if (this.row_headers) {
      this.cells.EnsureRow(this.row_headers.length - 1);
    }
  }

  /**
   * deprecated (or give me a reason to keep it)
   * KEEP IT: just maintain flexibility, it has very low cost
   */
  public SetColumnHeaders(headers: CellValue[]): void {
    this.column_headers = headers.map(value => value === undefined ? '' : value.toString());
    if (headers) {
      this.cells.EnsureColumn(headers.length - 1);
    }
  }

  /**
   * deprecated
   * KEEP IT: just maintain flexibility, it has very low cost
   */
  public RowHeader(row: number): string | number {
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
  public ColumnHeader(column: number): string {
    let s = '';
    if (this.column_headers) {
      if (this.column_headers.length > column) return this.column_headers[column];
      return '';
    }
    for (; ;) {
      const c = column % 26;
      s = String.fromCharCode(65 + c) + s;
      column = Math.floor(column / 26);
      if (column) column--;
      else break;
    }
    return s;
  }

  public GetRowHeight(row: number): number {
    const height = this.row_height_[row];
    if (typeof height === 'undefined') return this.default_row_height;
    return height;
  }

  public SetRowHeight(row: number, height: number): number {
    this.row_height_[row] = height;
    this.cells.EnsureRow(row);
    return height;
  }

  public GetColumnWidth(column: number): number {
    const width = this.column_width_[column];
    if (typeof width === 'undefined') return this.default_column_width;
    return width;
  }

  public SetColumnWidth(column: number, width: number): number {
    this.column_width_[column] = width;
    this.cells.EnsureColumn(column);
    return width;
  }

  /**
   * returns set of properties in B that differ from A. returns 
   * property values from B.
   * 
   * this is the function I could never get to work inline for 
   * CellStyle -- not sure why it works better with a generic 
   * function (although the partial here is new, so maybe it's that?)
   *
   * seems to be related to
   * https://github.com/microsoft/TypeScript/pull/30769
   * 
   */
  public Delta<T extends object>(A: T, B: T): Partial<T> {

    const result: Partial<T> = {};

    // keys that are in either object. this will result in some
    // duplication, probably not too bad. could precompute array? (...)

    // you could do that using a composite object, but would be wasteful.
    // would look good in typescript but generate extra javascript. might
    // still be faster, though? (...)

    const keys = [...Object.keys(A), ...Object.keys(B)] as Array<keyof T>;

    // FIXME: should check if B[key] is undefined, in which case you don't
    // want it? (...) that seems appropriate, but since the method we are
    // replacing did not do that, I'm hesitant to do it now

    for (const key of keys) {
      const a = A[key];
      const b = B[key];

      // we are not checking for arrays, that's not a consideration atm

      if (typeof a === 'object' && typeof b === 'object') {

        // is this faster than checking properties? 
        // especially if we know the list?

        if (JSON.stringify(a) !== JSON.stringify(b)) {
          result[key] = b;
        }

      }
      else if (a !== b) {
        result[key] = b;
      }

      //if (A[key] !== B[key]) {
      //  result[key] = B[key];
      //}

    }

    return result;

  }

  /**
   * updates cell styles. flushes cached style.
   *
   * @param delta merge with existing properties (we will win conflicts)
   * @param inline this is part of another operation, don't do any undo/state updates
   */
  public UpdateCellStyle(address: ICellAddress, properties: CellStyle, delta = true): void {

    // so what this is doing is constructing two merge stacks: one including
    // the cell style, and one without. any deltas among the two are the cell
    // style. the aim here is to remove properties that would be duplicative
    // because they stack, so if the base sheet has color=red, there is no
    // reason to apply that to the cell as well.

    const { row, column } = address;

    if (!this.cell_style[column]) this.cell_style[column] = [];

    // testing
    // const underlying = this.CompositeStyleForCell(address, false);
    const underlying = this.CompositeStyleForCell(address, false, false, undefined, false);

    const merged = Style.Composite([
      this.default_style_properties,
      underlying,
      Style.Merge(this.cell_style[column][row] || {}, properties, delta),
    ]);

    const composite = this.Delta(underlying, merged);

    /*
    // this is type "any" because of the assignment, below, which fails
    // otherwise. however this could be done with spread assignments? (...)
    // A: no, it's not merging them, it is looking for deltas.
    // ...but, what if you filtered? (...) [A] how?

    // I think the only way to do it with types would be to use delete, which 
    // somehow seems wasteful and slow (although I have not validated that)

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
    */

    this.cell_style[column][row] = composite; // merged;

    // targeted flush
    // this.CellData(address).FlushStyle();
    this.BleedFlush({start: address, end: address});

  }

  /**
   * invalidate sets the "render dirty" flag on cells, whether there
   * is any change or not. we are currently using it to force rendering
   * when border/background changes, and we need to handle bleed into
   * neighboring cells.
   */
  public Invalidate(area: Area): void {
    this.cells.Apply(this.RealArea(area), cell => cell.render_clean = []);
  }

  /**
   *
   * @param area
   * @param style
   * @param delta
   * @param render LEGACY PARAMETER NOT USED
   */
  public UpdateAreaStyle(area?: Area, style: CellStyle = {}, delta = true): void {

    if (!area) return;

    if (area.entire_sheet) {
      this.UpdateSheetStyle(style, delta);
    }
    else if (area.entire_column) {
      for (let column = area.start.column; column <= area.end.column; column++) {
        this.UpdateColumnStyle(column, style, delta);
      }
    }
    else if (area.entire_row) {
      for (let row = area.start.row; row <= area.end.row; row++) {
        this.UpdateRowStyle(row, style, delta);
      }
    }
    else area.Array().forEach((address) => this.UpdateCellStyle(address, style, delta));

  }

  /**
   * checks if the given cell has been assigned a specific style, either for
   * the cell itself, or for row and column.
   */
  public HasCellStyle(address: ICellAddress): boolean {
    return !!((this.cell_style[address.column] && this.cell_style[address.column][address.row])
      || this.row_styles[address.row]
      || this.column_styles[address.column]
      || this.row_pattern.length);
  }

  /**
   * returns the next non-hidden column. so if you are column C (2) and columns
   * D, E, and F are hidden, then it will return 6 (G).
   */
  public NextVisibleColumn(column: number): number {
    for (++column; this.column_width_[column] === 0; column++) { /* */ }
    return column;
  }

  /** 
   * @see NextVisibleColumn 
   * because this one goes left, it may return -1 meaning you are at the left edge 
   */
  public PreviousVisibleColumn(column: number): number {
    for (--column; column >= 0 && this.column_width_[column] === 0; column--) { /* */ }
    return column;
  }

  /**
   * @see NextVisibleColumn
   */
  public NextVisibleRow(row: number): number {
    for (++row; this.row_height_[row] === 0; row++) { /* */ }
    return row;
  }

  /**
   * @see PreviousVisibleColumn
   */
  public PreviousVisibleRow(row: number): number {
    for (--row; row >= 0 && this.row_height_[row] === 0; row--) { /* */ }
    return row;
  }

  /**
   * if this cell is part of a table, get row information -- is this
   * an alternate row, is it the header, is it the last (visible) row
   * 
   * @param table 
   * @param row 
   * @returns 
   */
  public TableRow(table: Table, row: number): {
    alternate?: boolean;
    header?: boolean;
    last?: boolean;
    totals?: boolean;
  } {

    const result = {
      alternate: false, 
      header: (row === table.area.start.row), 
      last: false, 
      totals: (table.totals_row && row === table.area.end.row),
    }

    // can short circuit here

    if (result.header || result.totals) {
      return result;
    }

    // how we handle last row depends on totals. if we have a totals
    // row, and it's visible, we don't need to do the "last row" thing.

    const totals_visible = (table.totals_row && (this.GetRowHeight(table.area.end.row) > 0));

    if (!totals_visible) {
      let last = table.area.end.row;
      for ( ; last >= table.area.start.row; last-- ) {
        if (this.GetRowHeight(last)) {
          result.last = (last === row);
          break;
        }
      }
    }

    let start = table.area.start.row + 1 ; // (table.headers ? 1 : 0);
    for ( ; start <= table.area.end.row; start++ ) {
      if (!this.GetRowHeight(start)) {
        continue;
      }

      result.alternate = !result.alternate;
      if (start === row) {
        break;
      }
    }

    return result;
  }

  /**
   * returns style properties for cells surrounding this cell, 
   * mapped like a number pad:
   * 
   * +---+---+---+
   * | 7 | 8 | 9 |
   * +---+---+---+
   * | 4 | X | 6 |
   * +---+---+---+
   * | 1 | 2 | 3 |
   * +---+---+---+
   * 
   * presuming you already have X (5). this is called by renderer, we 
   * move it here so we can inline the next/previous loops.
   * 
   */
  public SurroundingStyle(address: ICellAddress, table?: TableTheme): CellStyle[] {
    const map: CellStyle[] = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}];

    // FIXME: what about merges? (...)

    let column_right = address.column + 1;
    let column_left = address.column - 1;
    let row_below = address.row + 1;
    let row_above = address.row - 1;

    for (; this.column_width_[column_right] === 0; column_right++) { /* */ }
    for (; this.row_height_[row_below] === 0; row_below++) { /* */ }

    for (; column_left >= 0 && this.column_width_[column_left] === 0; column_left--) { /* */ }
    for (; row_above >= 0 && this.row_height_[row_above] === 0; row_above--) { /* */ }

    if (column_left >= 0 && row_above >= 0) {
      map[7] = this.CellStyleData({ row: row_above, column: column_left }, table) || {};
    }

    if (column_left >= 0) {
      map[4] = this.CellStyleData({ row: address.row, column: column_left }, table) || {};
      map[1] = this.CellStyleData({ row: row_below, column: column_left }, table) || {};
    }

    if (row_above >= 0) {
      map[8] = this.CellStyleData({ row: row_above, column: address.column }, table) || {};
      map[9] = this.CellStyleData({ row: row_above, column: column_right }, table) || {};
    }

    map[6] = this.CellStyleData({ row: address.row, column: column_right }, table) || {};
    map[2] = this.CellStyleData({ row: row_below, column: address.column }, table) || {};
    map[3] = this.CellStyleData({ row: row_below, column: column_right }, table) || {};

    return map;
  }

  /**
   * get style only. as noted in the comment to `CellData` there used to be
   * no case where this was useful without calculated value as well; but we
   * now have a case: fixing borders by checking neighboring cells. (testing).
   * 
   * switching from null to undefined as "missing" type
   * 
   * UPDATE: this is a convenient place to do table formatting. table 
   * formatting is complicated because it's variable; it depends on row
   * visibility so we can't cache it. this is a good spot because we're 
   * already calling this function when doing border rendering; we can call 
   * it separately, if necessary, when rendering cells.
   * 
   * table formats are applied on top of cell formats, after compositing,
   * and we don't preserve the style.
   * 
   */
  public CellStyleData(address: ICellAddress, default_table_theme?: TableTheme): CellStyle | undefined {

    // don't create if it doesn't exist
    const cell = this.cells.GetCell(address);
    if (!cell) {
      return undefined;
    }

    // composite style if necessary
    if (!cell.style) {
      const index = this.GetStyleIndex(this.CompositeStyleForCell(address));
      cell.style = this.style_map[index];
    }

    if (cell.table) {

      const table_theme = cell.table.theme || default_table_theme;

      if (table_theme) {

        let style = JSON.parse(JSON.stringify(cell.style));
        const data = this.TableRow(cell.table, address.row);

        if (data.header) {
          if (table_theme.header) {  
            style = Style.Composite([style, table_theme.header]);
          }
        }
        else if (data.totals) {

          // like headers, totals is outside of the alternating rows thing
          if (table_theme.total) {
            style = Style.Composite([style, table_theme.total]);
          }
        }
        else {
          if (data.alternate) {
            if (table_theme.odd) {
              style = Style.Composite([style, table_theme.odd]);           
            }
          }
          else {
            if (table_theme.even) {
              style = Style.Composite([style, table_theme.even]);           
            }
          }
        }

        /*
        if (data.last) {
          if (table_styles.footer) {
            style = Style.Composite([style, table_styles.footer]);
          }
        }
        */

        return style;
      }
    }

    return cell.style;

  }

  /**
   * accessor to get cell style without row pattern -- for cut/copy
   * @param address 
   */
  public GetCopyStyle(address: ICellAddress): CellStyle {
    return this.CompositeStyleForCell(address, true, false, undefined, false);
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
   * 
   */
  public CellData(address: ICellAddress): Cell {

    const cell = this.cells.EnsureCell(address);

    // if cell has rendered type (i.e. not undefined), then it has
    // complete render data and we can return it as-is.

    if (cell.rendered_type) return cell;

    // otherwise we need to render it. if we have a calculated value, use that.

    let type: ValueType;
    let value: CellValue;

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

      if (isNaN(value as number)) {
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
    else if (type === ValueType.complex) {

      // formatting complex value (note for searching)
      // here testing "mathematical italic small i", "𝑖", U+1D456
      //
      // I'm not sure this is a good idea, the character might not be available
      // in a particular font (not sure if those are auto-filled or what)
      //
      // what we _should_ do is have a formatting flag (in text part) to
      // indicate italic, and then render a regular lower-case i in italic.
      // that also means that if you copy it as text, it's still just a regular
      // i and not a high-value unicode character. which is helpful.

      // OK we tried that and it looked like crap. I would like to go back
      // to using "𝑖" but I'm not sure... maybe a flag>

      // NOTE: all that moved to NumberFormat

      const complex = value as Complex;
      if (isNaN(complex.real) || isNaN(complex.imaginary)) {

        // render nan for nan values
        cell.formatted = // Style.Format(cell.style, value); // formats NaN
          (typeof cell.style.nan === 'undefined') ? 'NaN' : cell.style.nan;
      }
      else {
        const format = NumberFormatCache.Get(cell.style.number_format || '', true);
        cell.formatted = format.FormatComplex(complex);
      }

      cell.rendered_type = ValueType.complex;
    }
    else if (type === ValueType.dimensioned_quantity) {
      
      // is this really what we want? NaN mm? or can we just do NaN?

      // the reason for the question is that we want to move formatting
      // of DQ into format, in order that we can do logic on the formatting
      // side. but that won't work if we're short-circuiting here
      
      // actually I guess it's immaterial, NaN mm is effectively === to NaN ft

      if (isNaN((value as DimensionedQuantity).value)) {
        cell.formatted = // Style.Format(cell.style, value); // formats NaN
          (typeof cell.style.nan === 'undefined') ? 'NaN' : cell.style.nan;

        cell.formatted += (` ` + (value as DimensionedQuantity).unit);
      }
      else {
        const format = NumberFormatCache.Get(cell.style.number_format || '', true);
        cell.formatted = // Style.Format(cell.style, value);
          // this.FormatNumber((value as DimensionedQuantity).value, cell.style.number_format);
          // this.FormatNumber(value, cell.style.number_format);
          format.FormatDimensionedQuantity(value as DimensionedQuantity);
      }

      cell.rendered_type = ValueType.dimensioned_quantity; // who cares about rendered_type? (...)

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
  public FormatNumber(value: CellValue, format = ''): string | TextPart[] {
    const formatted = NumberFormatCache.Get(format).FormatParts(value);
    if (!formatted.length) return '';
    if (formatted.length === 1 && !formatted[0].flag) { return formatted[0].text || ''; }
    return formatted;
  }

  // no references... removing
  //public ColumnHeaderHeight(): number {
  //  return this.column_header_height || this.default_row_height_x;
  //}

  /**
   * the only place this is called is in a method that shows/hides headers;
   * it sets the size either to 1 (hidden) or undefined, which uses the 
   * defaults here. that suggests we should have a show/hide method instead.
   * 
   * @param row_header_width 
   * @param column_header_height 
   */
  public SetHeaderSize(
    row_header_width = DEFAULT_ROW_HEADER_WIDTH,
    column_header_height = this.default_row_height): void {

    this.row_header_width = row_header_width;
    this.column_header_height = column_header_height;
  }

  /**
   * resize row to match character hight, taking into
   * account multi-line values.
   * 
   * UPDATE: since the only caller calls with inline = true, removing 
   * parameter, test, and extra behavior.
   */
  public AutoSizeRow(row: number, default_properties: CellStyle = {}, allow_shrink = true): void {

    let height = this.default_row_height;
    const padding = 9; // 9?

    for (let column = 0; column < this.cells.columns; column++) {

      const cell = this.CellData({ row, column });
      const style = cell.style;
      let text = cell.formatted || '';

      if (typeof text !== 'string') {
        text = text.map((part) => part.text).join('');
      }

      if (style && text && text.length) {
        const lines = text.split(/\n/);
        const font_height = Math.round(this.StyleFontSize(style, default_properties) * 1.5); // it's a start, we still need to measure properly
        height = Math.max(height, ((font_height || 10) + padding) * lines.length);
      }
    }

    if (!allow_shrink) {
      const test = this.GetRowHeight(row);
      if (test >= height) { return; }
    }

    this.SetRowHeight(row, height);

  }

  /* *
   * auto-sizes the column, but if the allow_shrink parameter is not set
   * it will only enlarge, never shrink the column.
   *
   * UPDATE: since the only caller calls with inline = true, removing 
   * parameter, test, and extra behavior.
   * 
   * UPDATE: moving to grid, for reasons of canvas...
   * /
  public AutoSizeColumn(column: number, allow_shrink = true): void {

    if (!Sheet.measurement_canvas) {
      Sheet.measurement_canvas = document.createElement('canvas');
    }
    Sheet.measurement_canvas.style.font = Style.Font(this.default_style_properties);
    console.info("SMC", Sheet.measurement_canvas.style.font);
    (self as any).SMC = Sheet.measurement_canvas;

    document

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

        console.info({text, style: Style.Font(cell.style||{}), cf: context.font});

        width = Math.max(width, Math.ceil(context.measureText(text).width) + padding);
      }
    }

    this.SetColumnWidth(column, width);

  }
  */

  /** returns the style properties for a given style index */
  public GetStyle(index: number): CellStyle {
    return this.style_map[index];
  }

  /* *
   * if the cell is in an array, returns the array as an Area.
   * if not, returns falsy (null or undefined).
   *
   * FIXME: is this used? seems like the caller could do this
   * calculation.
   * 
   * Answer was no, so removed
   * /
  public ContainingArray(address: ICellAddress): Area | undefined {
    const cell = this.cells.GetCell(address);
    if (cell) return cell.area;
    return undefined;
  }
  */

  /**
   *
   * @param before_row insert before
   * @param count number to insert
   */
  public InsertRows(before_row = 0, count = 1): boolean {

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
          if (cell2 && cell2.area && cell2.area.Equals(cell1.area)) {
            return false; // failed
          }
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

    const merge_heads: Record<string, Area> = {};
    const array_heads: Record<string, Area> = {};
    // const table_heads: Record<string, Table> = {};

    // now grab arrays and merge heads that are below the new rows
    // this should include merges that span the new range

    for (let row = before_row; row < this.cells.rows; row++) {
      for (let column = 0; column < this.cells.columns; column++) {
        const cell = this.cells.GetCell({ row, column }, false);
        if (cell) {

          /*
          if (cell.table) {
            const label = new Area(cell.table.area.start, cell.table.area.end).spreadsheet_label;
            if (!table_heads[label]) {
              table_heads[label] = cell.table;
            }
          }
          */

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

    /*
    for (const key of Object.keys(table_heads)) {
      const table = table_heads[key];

      const patched_start = { ...table.area.start };
      if (table.area.start.row >= before_row) patched_start.row += count;
      const patched = new Area(
        patched_start,
        { row: table.area.end.row + count, column: table.area.end.column });

      table.area = { start: patched.start, end: patched.end };

      // we don't need to reset table for cells that already have it,
      // but we do need to add it to new rows. could simplify. FIXME

      patched.Iterate((address) => {
          const cell = this.cells.GetCell(address, true);
          cell.table = table;
        });
    }
    */

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
    const new_row_style: Record<number, CellStyle> = {};

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

    // console.info('m5.1');

    this.cell_style.forEach((column) => {

      if (column && column.length >= before_row) {
        // eslint-disable-next-line prefer-spread
        column.splice.apply(column, args as [number, number, CellStyle]);
      }
    });

    // console.info('m6');

    // row heights

    // eslint-disable-next-line prefer-spread
    this.row_height_.splice.apply(this.row_height_, args as [number, number, number]);

    // invalidate style cache
    this.FlushCellStyles();

    // console.info('m7');

    return true;

  }


  /**
   * see InsertRow for details
   */
  public InsertColumns(before_column = 0, count = 1): boolean {

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

    // NOTE: tables are handled by the grid routine. for a time we were
    // doing that here but it's easier to unify on the grid size, since
    // we may need to update column headers or remove the model reference.

    const merge_heads: Record<string, Area> = {};
    const array_heads: Record<string, Area> = {};

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
    const new_column_style: Record<number, CellStyle> = {};

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

    // eslint-disable-next-line prefer-spread
    this.cell_style.splice.apply(this.cell_style, args as [number, number, CellStyle[]]);

    // row heights

    // eslint-disable-next-line prefer-spread
    this.column_width_.splice.apply(this.column_width_, args as [number, number, number]);

    // invalidate style cache

    this.FlushCellStyles();

    return true;

  }

  /** clear cells in area */
  public ClearArea(area: Area): void {

    // this is not allowed if any of the cells are in
    // an array, and the array does not match the passed
    // array.

    // ...

    // assuming it's ok, :

    area = this.RealArea(area);
    this.cells.Apply(area, (cell) => cell.Reset());

  }

  // ATM we have 4 methods to set value/values. we need a distinction for
  // arrays, but that could be a parameter. the single-value/multi-value
  // area functions could probably be consolidated, also the single-cell-
  // single-value function... you need logic either on the outside or the
  // inside, put that logic where it makes the most sense.

  // also some of this could be moved to the Cells class... if for no
  // other reason than to remove the iteration overhead

  public SetAreaValues2(area: Area, values: CellValue | CellValue[][]): void {

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
  public SetArrayValue(area: Area, value: CellValue): void {
    area = this.RealArea(area);
    this.cells.Apply(area, (element) => element.SetArray(area), true);
    const cell = this.cells.GetCell(area.start, true);
    cell.SetArrayHead(area, value);
  }

  /**
   * set a single value in a single cell
   */
  public SetCellValue(address: ICellAddress, value: CellValue): void {
    const cell = this.cells.GetCell(address, true);
    cell.Set(value);
  }

  /** 
   * FIXME: does not need to be in sheet 
   *
   * @param headers_only - only return tables if the cell is in the 
   * header (first) row. useful if you only want to worry about headers. 
   */
  public TablesFromArea(area: IArea|ICellAddress, headers_only = false): Table[] {

    if (IsCellAddress(area)) {
      const cell = this.cells.GetCell(area, false);
      if (cell?.table) {
        if (!headers_only || (area.row === cell.table.area.start.row)) {
          return [cell.table];
        }
      }
      return [];
    }

    const set: Set<Table> = new Set();

    for (let row = area.start.row; row <= area.end.row; row++) {
      for (let column = area.start.column; column <= area.end.column; column++) {
        const cell = this.cells.GetCell({row, column}, false);
        if (cell?.table && !set.has(cell.table)) {
          if (!headers_only || (row === cell.table.area.start.row)) {
            set.add(cell.table);
          }
        }
      }
    }

    return Array.from(set.values());

  }

  /**
   * returns the area bounding actual content
   * (i.e. flattening "entire row/column/sheet")
   *
   * FIXME: this does not clamp to actual cells... why not?
   * FIXME: so now we are (optionally) clamping end; should clamp start, too
   *
   * @param clamp -- new parameter will optionally clamp to actual sheet size
   */
  public RealArea(area: Area, clamp = false): Area {

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

    if (clamp) {
      if (end.row >= this.rows) {
        end.row = this.rows - 1;
        end.absolute_row = false;
      }
      if (end.column >= this.columns) {
        end.column = this.columns - 1;
        end.absolute_column = false;
      }
    }

    return new Area(start, end);

  }

  /**
   * this is a new GetCellStyle function, used for external access
   * to style (for API access). there was an old GetCellStyle function
   * for rendering, but that's been removed (control+F for info).
   * 
   * Q: does this include conditional formatting? (...)
   */
  public GetCellStyle(area: ICellAddress|IArea, apply_theme = false): CellStyle|CellStyle[][] {

    if (IsCellAddress(area)) {
      return this.CompositeStyleForCell(area, true, false, apply_theme);
    }

    if (area.start.row === area.end.row && area.start.column === area.end.column) {
      return this.CompositeStyleForCell(area.start, true, false, apply_theme);
    }

    const result: CellStyle[][] = [];

    for (let r = area.start.row; r <= area.end.row; r++) {
      const row: CellStyle[] = [];
      for (let c = area.start.column; c <= area.end.column; c++) {
        // const cell = this.CellData({row: r, column: c});
        // row.push(cell.style || {});
        row.push(this.CompositeStyleForCell({row: r, column: c}, true, false, apply_theme));
      }
      result.push(row);
    }

    return result;

  }

  ///
  public FormattedCellValue(address: ICellAddress): CellValue {

    const cell = this.CellData(address);
    if (!cell) {
      return undefined;
    }

    if (typeof cell.formatted === 'string') return cell.formatted;
    if (cell.formatted) {
      return cell.formatted.map(part => {
        switch (part.flag) {
          case 1:
            return ' ';
          case 2:
            return ' '; // ??
          default:
            return part.text;
        }
      }).join('');
    }
    return cell.value;
  }

  public GetFormattedRange(from: ICellAddress, to: ICellAddress = from): CellValue | CellValue[][] {

    if (from.row === to.row && from.column === to.column) {
      return this.FormattedCellValue(from);
    }

    const result: CellValue[][] = [];

    // grab rows
    for (let row = from.row; row <= to.row; row++) {
      const target: CellValue[] = [];
      for (let column = from.column; column <= to.column; column++) {
        target.push(this.FormattedCellValue({ row, column }));
      }
      result.push(target);
    }

    return result;

  }

  /**
   * get all styles used in the sheet. this is used to populate color
   * and number format lists in the toolbar. we used to just serialize
   * the document and use that, but that's absurdly wasteful. for this
   * application we don't even need composites.
   * 
   * although, this is a bit dangerous because you could (in theory)
   * modify the results in place. so maybe we should either duplicate or
   * just return the requested data...
   */
  public NumberFormatsAndColors(
    color_map: Record<string, number>,
    number_format_map: Record<string, number>,
  ): void {

    const parse = (style: CellStyle) => {

      if (style.number_format) {
        number_format_map[style.number_format] = 1;
      }

      if (style.text?.text && style.text.text !== 'none') {
        // const color = Measurement.MeasureColorARGB(style.text_color);
        color_map[style.text.text] = 1;
      }

      if (style.fill?.text) {
        color_map[style.fill.text] = 1;
      }

      //if (style.background && style.background !== 'none') {
      //  color_map[style.background] = 1;
      //}

      if (style.border_top_fill?.text) {
        color_map[style.border_top_fill.text] = 1;
      }
      if (style.border_left_fill?.text) {
        color_map[style.border_left_fill.text] = 1;
      }
      if (style.border_right_fill?.text) {
        color_map[style.border_right_fill.text] = 1;
      }
      if (style.border_bottom_fill?.text) {
        color_map[style.border_bottom_fill.text] = 1;
      }

    };

    parse(this.sheet_style);

    for (const key in this.row_styles) {
      parse(this.row_styles[key]);
    }

    for (const key in this.column_styles) {
      parse(this.column_styles[key]);
    }

    for (const style of this.row_pattern) {
      parse(style);
    }

    for (const row of this.cell_style) {
      if (row) {
        for (const style of row) {
          if (style) {
            parse(style);
          }
        }
      }
    }

  }

  public CompressCellStyles(data: number[][]) {

    // we can almost certainly compress the cell style map (above) if there 
    // are consistent areas. not sure what the optimal algorithms for this 
    // are, but there are probably some out there. let's start naively and 
    // see what we can get.

    // I think the real issue is imports from XLSX; we're getting a lot
    // of individual cell styles where there should probably be R/C styles.

    // actually we might be working against ourselves here if we are 
    // removing populated cells from this array: because in that case we'll
    // get fewer contiguous blocks. perhaps we should have a "lookaround"
    // in the original array? (...)

    // OTOH this can never be _worse_ than the old method, and I don't think
    // it costs much more. so we'll stick with this for the time being, see
    // if we can further optimize later.

    // (note: tried passing the original array, and checking for overlap, 
    //  but ultimately savings was minimal. not worth it)

    const list: Array<{ row: number; column: number; ref: number, rows?: number }> = [];

    for (let c = 0; c < data.length; c++) {
      const column = data[c];
      
      if (column) {
        for (let r = 0; r < column.length; r++) {
          const style = column[r];
          if (style) {

            let k = r + 1;

            for (; k < column.length; k++) {
              if (column[k] !== style) { break; }
            }

            if ( k > r + 1 ){
              list.push({ row: r, column: c, ref: style, rows: k - r });
            }
            else {
              list.push({ row: r, column: c, ref: style });
            }

            r = k - 1;

          }
        }
      }
    }

    return list;

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
  public toJSON(options: SerializeOptions = {}): SerializedSheet {

    // flatten height/width arrays

    const flatten_numeric_array = (arr: number[], default_value: number) => {
      const obj: Record<number, number> = {};

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

    const cell_style_map: Record<string, number> = {};

    const cell_reference_map: number[][] = [];

    // (1) create a map of cells -> references, and build the reference
    //     table at the same time. preserve indexes? (...)

    // it would be nice if we could use some sort of numeric test, rather
    // than leaving empty indexes as undefined -- that requires a type test
    // (to avoid zeros).

    const empty_json = JSON.stringify({});

    // actually we could just offset the index by 1... (see above)

    for (let c = 0; c < this.cell_style.length; c++) {
      const column = this.cell_style[c];
      if (column) {
        cell_reference_map[c] = [];
        for (let r = 0; r < column.length; r++) {
          if (column[r]) {
            const style_as_json = JSON.stringify(column[r]);
            if (style_as_json !== empty_json) {
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
    }

    // it might be more efficient to store cell styles separately from
    // cell data, as we might be able to compress it. it looks more like
    // an indexed image, and we likely don't have that many styles.

    /**
     * this assumes that "empty" style is at index 0
     */
    const StyleToRef = (style: CellStyle) => {

      const style_as_json = JSON.stringify(style);
      if (style_as_json === empty_json) {
        return 0;
      }

      let reference_index = cell_style_map[style_as_json];
      if (typeof reference_index !== 'number') {
        cell_style_map[style_as_json] = reference_index = cell_style_refs.length;
        cell_style_refs.push(style);
      }

      return reference_index;

    };

    // ensure we're not linked
    cell_style_refs = JSON.parse(JSON.stringify(cell_style_refs));

    // same here (note broken naming)
    const sheet_style = JSON.parse(JSON.stringify(this.sheet_style));
    // const row_style = JSON.parse(JSON.stringify(this.row_styles));
    // const column_style = JSON.parse(JSON.stringify(this.column_styles));
    const row_pattern = JSON.parse(JSON.stringify(this.row_pattern));

    // row and column styles are Record<number, props> and not arrays.
    // I think they should probably be arrays. it's not critical but
    // using records (objects) converts keys to strings, which is sloppy.


    // const column_style: Array<number|CellStyle> = [];
    // const row_style: Array<number|CellStyle> = [];

    const column_style: Record<number, CellStyle | number> = {};
    const row_style: Record<number, CellStyle | number> = {};

    for (const key of Object.keys(this.column_styles)) {
      const index = Number(key);
      const style = this.column_styles[index];
      if (style) {
        const reference = StyleToRef(style);
        if (reference) {
          column_style[index] = reference;
        }
      }
    }

    for (const key of Object.keys(this.row_styles)) {
      const index = Number(key);
      const style = this.row_styles[index];
      if (style) {
        const reference = StyleToRef(style);
        if (reference) {
          row_style[index] = reference;
        }
      }
    }

    const translate_border_color = (color: string | undefined, default_color: string | undefined): string | undefined => {
      if (typeof color !== 'undefined' && color !== 'none') {
        if (color === default_color) {
          return undefined;
        }
        else {
          return Measurement.MeasureColorARGB(color);
        }
      }
      return undefined;
    }

    const translate_border_fill = (color: Color = {}, default_color: Color = {}) => {
      const result: Color = {
        ...default_color,
        ...color,
      };
      if (result.text) {
        result.text = Measurement.MeasureColorARGB(result.text);
        return result;
      }
      else if (typeof result.theme === 'number') {
        return result;
      }
      return undefined;
    };

    // translate, if necessary
    if (options.export_colors) {
      const style_list: CellStyle[] = [];
      for (const group of [
        //row_style, column_style, // these are moved -> csr (which should be renamed)
        cell_style_refs, [sheet_style], row_pattern]) {
        if (Array.isArray(group)) {
          for (const entry of group) style_list.push(entry);
        }
        else {
          for (const key of Object.keys(group)) style_list.push(group[key]);
        }
      }

      for (const style of style_list as CellStyle[]) {

        // don't set "undefined" overrides. also, was this broken 
        // wrt all the defaults from top? probably

        let fill = translate_border_fill(style.border_top_fill, Style.DefaultProperties.border_top_fill);
        if (fill !== undefined) { style.border_top_fill = fill; }

        fill = translate_border_fill(style.border_left_fill, Style.DefaultProperties.border_left_fill);
        if (fill !== undefined) { style.border_left_fill = fill; }

        fill = translate_border_fill(style.border_right_fill, Style.DefaultProperties.border_right_fill);
        if (fill !== undefined) { style.border_right_fill = fill; }

        fill = translate_border_fill(style.border_bottom_fill, Style.DefaultProperties.border_bottom_fill);
        if (fill !== undefined) { style.border_bottom_fill = fill; }

        if (style.fill?.text) {
          style.fill.text = Measurement.MeasureColorARGB(style.fill.text);
        }

        //if (typeof style.background !== 'undefined' && style.background !== 'none') {
        //  style.background = Measurement.MeasureColorARGB(style.background);
        //}

        if (style.text) {
          if (style.text.text && style.text.text !== 'none') {
            style.text.text = Measurement.MeasureColorARGB(style.text.text);
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
      tables: !!options.tables,
    };

    // the rows/columns we export can be shrunk to the actual used area,
    // subject to serialization option.

    const serialized_data = this.cells.toJSON(serialization_options);
    const data = serialized_data.data;

    let { rows, columns } = serialized_data;

    if (!options.shrink) {
      rows = this.rows;
      columns = this.columns;
    }
    else {

      // pad by 1 (2?)

      rows += 2;
      columns += 1;

    }

    // push out for annotations

    for (const annotation of this.annotations) {
      if (!annotation.data.extent) {
        this.CalculateAnnotationExtent(annotation);
      }
      if (annotation.data.extent) {
        rows = Math.max(rows, annotation.data.extent.row + 1);
        columns = Math.max(columns, annotation.data.extent.column + 1);
      }
    }

    // (3) (style) for anything that hasn't been consumed, create a
    //     cell style map. FIXME: optional [?]

    /*
    const cell_styles: Array<{ row: number; column: number; ref: number }> = [];

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

    const CS2 = this.CompressCellStyles(cell_reference_map);
    console.info({cs1: JSON.stringify(cell_styles), cs2: JSON.stringify(CS2)});
    */

    // using blocks. this is our naive method. we could do (at minimum)
    // testing row-dominant vs column-dominant and see which is better; 
    // but that kind of thing adds time, so it should be optional.

    const cell_styles = this.CompressCellStyles(cell_reference_map);

    // if we serialize this when it has Area values (instead of IArea) it
    // will export incorrectly. is that an issue anywhere else? (...)

    const conditional_formats = this.conditional_formats.length ? 
      JSON.parse(JSON.stringify(this.conditional_formats.map(format => ({...format, internal: undefined })))) : 
      undefined;

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
      rows,
      columns,
      cell_styles,
      styles: cell_style_refs,
      row_style,
      column_style,

      conditional_formats,

      row_pattern: row_pattern.length ? row_pattern : undefined,

      // why are these serialized? (...) export!

      default_row_height: this.default_row_height,
      default_column_width: this.default_column_width,

      row_height: flatten_numeric_array(this.row_height_, this.default_row_height),
      column_width: flatten_numeric_array(this.column_width_, this.default_column_width),

      selection: JSON.parse(JSON.stringify(this.selection)),
      annotations: JSON.parse(JSON.stringify(this.annotations)),

    };

    // omit default (true)
    if (!this.visible) {
      result.visible = this.visible;
    }

    if (this.scroll_offset.x || this.scroll_offset.y) {
      result.scroll = this.scroll_offset;
    }

    if (this.background_image) {
      result.background_image = this.background_image;
    }

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

  /*
   * export values and calcualted values; as for csv export (which is what it's for) * /
  public ExportValueData(transpose = false, dates_as_strings = false, export_functions = false): CellValue[][] {

    const arr: CellValue[][] = [];
    const data = this.cells.data;

    if (transpose) {
      const rowcount = data[0].length; // assuming it's a rectangle
      for (let r = 0; r < rowcount; r++) {
        const row: CellValue[] = [];
        for (const column of data) {
          const ref = column[r];
          let value: CellValue;
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
        const column: CellValue[] = [];
        for (const ref of column_ref) {
          let value: CellValue;
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
  */

  /** flushes ALL rendered styles and caches. made public for theme API */
  public FlushCellStyles(): void {
    this.style_map = [];
    this.style_json_map = [];
    this.cells.FlushCellStyles();
  }

  public ImportData(data: ImportedSheetData): void {

    const styles = data.styles;

    if (data.outline) {
      this.outline = data.outline;
    }

    // adding sheet style...

    // 0 is implicitly just a general style

    const sheet_style = data.sheet_style;
    if (sheet_style) {
      this.UpdateAreaStyle(
        new Area({ row: Infinity, column: Infinity }, { row: Infinity, column: Infinity }),
        styles[sheet_style]);
    }

    // and column styles...

    const column_styles = data.column_styles;
    if (column_styles) {
      for (let i = 0; i < column_styles.length; i++) {

        // 0 is implicitly just a general style

        if (column_styles[i]) {
          this.UpdateAreaStyle(new Area({ row: Infinity, column: i }, { row: Infinity, column: i }), styles[column_styles[i]]);
        }
      }
    }

    // this.cells.FromJSON(cell_data);
    this.cells.FromJSON(data.cells);
    if (data.name) {
      this.name = data.name || '';
    }

    // 0 is implicitly just a general style

    const cs = this.cell_style;
    for (const info of data.cells) {
      if (info.style_ref) {
        if (!cs[info.column]) cs[info.column] = [];
        cs[info.column][info.row] = styles[info.style_ref];
      }
    }

    for (let i = 0; i < data.column_widths.length; i++) {
      if (typeof data.column_widths[i] !== 'undefined') {

        // OK this is unscaled, we are setting unscaled from source data

        this.SetColumnWidth(i, data.column_widths[i]);
      }
    }

    for (let i = 0; i < data.row_heights.length; i++) {
      if (typeof data.row_heights[i] !== 'undefined') {

        // OK this is unscaled, we are setting unscaled from source data

        this.SetRowHeight(i, data.row_heights[i]);
      }
    }

    for (const annotation of data.annotations || []) {
      this.annotations.push(new Annotation(annotation));
    }

    for (const format of data.conditional_formats || []) {
      this.conditional_formats.push(format);
    }

    if (data.hidden) {
      this.visible = false;
    }

  }

  // --- protected ------------------------------------------------------------

  /** 
   * figure out the last row/column of the annotation. this
   * might set it to 0/0 if there's no rect, just make sure
   * that it gets cleared on layout changes.
   */
  protected CalculateAnnotationExtent(annotation: Annotation): void {

    // this is much easier with layout, but we are leaving the old
    // coude to support older files -- OTOH, the layout will be created
    // at some point, we just need to make sure that happens before this
    // is called

    if (annotation.data.layout) {
      annotation.data.extent = { ...annotation.data.layout.br.address };
      return;
    }

    // 1000 here is just sanity check, it might be larger
    const sanity = 1000;

    annotation.data.extent = { row: 0, column: 0 };

    let right = annotation.rect?.right;
    if (right && this.default_column_width) { // also sanity check
      for (let i = 0; right >= 0 && i < sanity; i++) {
        right -= this.GetColumnWidth(i); // FIXME: check // it's ok, rect is scaled to unit
        if (right < 0) {
          annotation.data.extent.column = i;
          break;
        }
      }
    }

    let bottom = annotation.rect?.bottom;
    if (bottom && this.default_row_height) {
      for (let i = 0; bottom >= 0 && i < sanity; i++) {
        bottom -= this.GetRowHeight(i); // FIXME: check // it's ok, rect is scaled to unit
        if (bottom < 0) {
          annotation.data.extent.row = i;
          break;
        }
      }
    }

  }

  /* *
   * when checking style properties, check falsy but not '' or 0
   * (also strict equivalence)
   * /
  protected StyleEquals(a: any, b: any): boolean {
    return a === b ||
      ((a === false || a === null || a === undefined)
        && (b === false || b === null || b === undefined));
  }
  */

  /*
  protected Serialize() {
    return JSON.stringify(this);
  }
  */

  /*
  protected Deserialize(data: SerializedSheet) {
    Sheet.FromJSON(data, this.default_style_properties, this);

    // some overlap here... consolidate? actually, doesn't
    // fromJSON call flush styles? [A: sometimes...]

    this.cells.FlushCachedValues();
    this.FlushCellStyles();
  }
  */

  // --- private methods ------------------------------------------------------


  /**
   * update style properties. merge by default.
   *
   * this method will reverse-override properties, meaning if you have set (for
   * example) a cell style to bold, then you set the whole sheet to unbold, we
   * expect that the unbold style will control. instead of explicitly setting
   * the cell style, we go up the chain and remove any matching properties.
   */
  private UpdateSheetStyle(properties: CellStyle, delta = true) {

    this.sheet_style = Style.Merge(this.sheet_style, properties, delta);

    // reverse-override...

    // const keys = Object.keys(properties);
    const keys = Object.keys(properties) as PropertyKeys[];
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

    // FIXME:  ROW PATTERN

    this.FlushCellStyles(); // not targeted

  }

  /**
   * updates row properties. reverse-overrides cells (@see UpdateSheetStyle).
   *
   * we also need to ensure that the desired effect takes hold, meaning if
   * there's an overriding column property (columns have priority), we will
   * need to update the cell property to match the desired output.
   */
  private UpdateRowStyle(row: number, properties: CellStyle, delta = true) {

    this.row_styles[row] = Style.Merge(this.row_styles[row] || {}, properties, delta);

    // reverse-override... remove matching properties from cells in this row
    // (we can do this in-place)

    // const keys = Object.keys(properties);
    const keys = Object.keys(properties) as PropertyKeys[];
    // const keys = Object.keys(this.row_styles[row]) as Style.PropertyKeys[];

    for (const column of this.cell_style) {
      if (column && column[row]) {

        // FIXME: we don't want to delete. reverse-add.
        keys.forEach((key) => delete column[row][key]);

      }
    }

    /*

    //
    // seems to be related to
    // https://github.com/microsoft/TypeScript/pull/30769
    //
    // not clear why the behavior should be different, but
    //
    // "indexed access with generics now works differently inside & outside a function."
    // 

    const FilteredAssign = <T>(test: T, source: T, target: T, keys: Array<keyof T>): void => {
      for (const key of keys) {
        if (test[key] !== undefined) {
          target[key] = source[key];
        }
      }
    };
    */

    // if there's a column style, it will override the row
    // style; so we need to set a cell style to compensate.

    // "override" because a reserved word in ts 4.3.2, possibly accidentally?
    // or possibly it was already a reserved word, and was handled incorrectly?
    // not sure. stop using it. 
    //
    // Actually just by the by, if it does work as described in
    //
    // https://github.com/microsoft/TypeScript/issues/2000
    //
    // then we should start using it where appropriate, because it is good.
    // just don't use it here as a variable name.

    for (let i = 0; i < this.cells.columns; i++) {
      if (this.column_styles[i]) {
        const column_style = this.column_styles[i];
        const overrides: CellStyle = this.cell_style[i] ? this.cell_style[i][row] || {} : {};

        for (const key of keys) {
          if (typeof column_style[key] !== 'undefined') {
            (overrides as any)[key] = properties[key];
          }
        }

        if (Object.keys(overrides).length) {
          if (!this.cell_style[i]) this.cell_style[i] = [];
          this.cell_style[i][row] = JSON.parse(JSON.stringify(overrides));
        }
      }
    }

    // FIXME: ROW PATTERN

    this.cells.Apply(this.RealArea(Area.FromRow(row)), (cell) => cell.FlushStyle());

  }

  /**
   * updates column properties. reverse-overrides cells (@see UpdateSheetStyle).
   */
  private UpdateColumnStyle(column: number, properties: CellStyle, delta = true) {

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

    const keys = Object.keys(properties) as PropertyKeys[];
    // const keys = Object.keys(this.column_styles[column]) as Style.PropertyKeys[];

    if (this.cell_style[column]) {
      for (const ref of this.cell_style[column]) {
        if (ref) {
          // FIXME: we don't want to delete. reverse-add.
          keys.forEach((key) => delete ref[key]);
        }
      }
    }

    this.cells.Apply(this.RealArea(Area.FromColumn(column)), (cell) => cell.FlushStyle());

    // FIXME: ROW PATTERN

  }

  /* *
   * flush the cache and the checklist. flush cell styles at the same
   * time. this should be called when adding/removing a conditional format.
   * optionally apply active formats again.
   * 
   * is this actually necessary? what's the use case? (...)
   * 
   * /
  public FlushConditionalFormats(reapply = false) {

    for (const [row, column] of this.conditional_format_checklist) {
      this.CellData({row, column}).FlushStyle();
    }

    this.conditional_format_checklist = [];
    this.conditional_format_cache = [];

    if (reapply) {
      this.ApplyConditionalFormats();
    }

  }
  */

  public BleedFlush(area: IArea) {

    let rows = [Math.max(0, area.start.row - 1), area.end.row + 1];
    let cols = [Math.max(0, area.start.column - 1), area.end.column + 1];

    for (let row = rows[0]; row <= rows[1]; row++) {
      for (let column = cols[0]; column <= cols[1]; column++) {
        // const cell = this.cells.EnsureCell({row, column});
        this.cells.GetCell({row, column}, false)?.FlushStyle();
      }
    }
    
  }

  public FlushConditionalFormats() {
    this.flush_conditional_formats = true;
  }

  /**
   * this version combines flushing the cache with building it, using
   * the application flag in the format objects. 
   * 
   * this function was set up to support comparing the two lists and
   * only flushing style if necessary; but that turns out to be so 
   * much additional work that I'm not sure it's preferable to just 
   * repaint. need to test.
   * 
   * ...we're also probably looping unecessarily. since we're using
   * those leaf nodes we can probably check if the state changed, and
   * it not, skip the loop pass. I think we'd need to identify or map
   * the applications though (meaning use a stack that matches the list
   * of formats). or you could even recheck everything if one of them 
   * changed, you'd still probably save a lot in cases where nothing
   * changed.
   * 
   */
  public ApplyConditionalFormats() {

    // we're not doing any pruning at the moment, so this is doing
    // a lot of unecessary looping -- we could start with one big
    // global check

    // ...we need to account for the case where a format is removed,
    // in that case we will need to update. flag?

    let updated = this.flush_conditional_formats; // maybe required

    for (const format of this.conditional_formats) {
      if (format.internal?.vertex?.updated) {
        updated = true;
        break;
      }
    }

    if (!updated) {

      // console.info('no updates');

      // that should save 90% of the calculation, we'll still do 
      // unecessary work but it's a step in the right direction.

      // note that this flag doesn't necessarily indicate anything
      // has changed -- it will get set if you do a global recalc,
      // because that marks everything as dirty. still a good step
      // though.

      return;
    }

    this.flush_conditional_formats = false; // unset

    const temp: CellStyle[][][] = [];
    const checklist: IArea[] = [...this.conditional_format_checklist];

    this.conditional_format_checklist = []; // flush

    for (const format of this.conditional_formats) {

      if (format.internal?.vertex?.updated) {

        // console.info('updated');

        format.internal.vertex.updated = false;
      }

      // NOTE: if you go backwards, then you can short-circuit if a format 
      // is already set. except then if you want to support "stop" rules, 
      // that won't work. 
      //
      // although you might still want to go backwards as it's easier to 
      // apply stop rules in reverse (why? because if you are going backwards,
      // you can just drop everything on the stack when you see a 
      // stop rule. if you go forwards, you need some sort of indicator 
      // or flag).

      if (format.type === 'gradient') {
        const area = JSON.parse(JSON.stringify(format.area));
        const result = format.internal?.vertex?.result;

        if (result && format.internal?.gradient) {
          const property: 'fill'|'text' = format.property ?? 'fill';

          if (result.type === ValueType.array) {
            for (let row = area.start.row; row <= area.end.row; row++) {
              for (let column = area.start.column; column <= area.end.column; column++) {
                const value = result.value[column - area.start.column][row - area.start.row];
                if (value.type === ValueType.number) {
                  if (!temp[row]) { temp[row] = []; }
                  if (!temp[row][column] ) { temp[row][column] = []; }
                  const color = format.internal.gradient.Interpolate(value.value);
                  temp[row][column].push({ [property]: color});
                }
              }
            }
          }
          else if (result.type === ValueType.number) {
            const color = format.internal.gradient.Interpolate(result.value);
            for (let row = area.start.row; row <= area.end.row; row++) {
              if (!temp[row]) { temp[row] = []; }
              for (let column = area.start.column; column <= area.end.column; column++) {
                if (!temp[row][column] ) { temp[row][column] = []; }
                temp[row][column].push({ [property]: color});
              }
            }
          }

          checklist.push(area);
          this.conditional_format_checklist.push(area);

        }
      }
      else {

        // handle types expression, cell-match and duplicate-values

        const area = JSON.parse(JSON.stringify(format.area));
        const result = format.internal?.vertex?.result;

        if (result) {

          if (result.type === ValueType.array) {
            for (let row = area.start.row; row <= area.end.row; row++) {
              for (let column = area.start.column; column <= area.end.column; column++) {
                const value = result.value[column - area.start.column][row - area.start.row];
                if ((value.type === ValueType.boolean || value.type === ValueType.number) && !!value.value) {
                  if (!temp[row]) { temp[row] = []; }
                  if (!temp[row][column] ) { temp[row][column] = []; }
                  temp[row][column].push(format.style);
                }
              }
            }
          }
          else {
            if (result.type === ValueType.boolean || result.type === ValueType.number) {
              if(!!result.value) {
                for (let row = area.start.row; row <= area.end.row; row++) {
                  if (!temp[row]) { temp[row] = []; }
                  for (let column = area.start.column; column <= area.end.column; column++) {
                      if (!temp[row][column] ) { temp[row][column] = []; }
                      temp[row][column].push(format.style);
                  }
                }
              }
            }
          }
  
          checklist.push(area);
          this.conditional_format_checklist.push(area);
 
        }

      }
   
    }

    for (const area of checklist) {
      this.BleedFlush(area);
    }

    this.conditional_format_cache = temp;

  }

  /*
  public ApplyConditionalFormats() {

    this.FlushConditionalFormatCache();

    for (const entry of this.conditional_formats) {

      console.info({entry});

      if (entry.applied) {
        this.ApplyConditionalFormatCache(entry);
      }
    }

  }

  public FlushConditionalFormatCache() {

    // FIXME: need to flush any styles that are set, unless they match;
    // perhaps we should use an alternate cache so we can compare? TODO/FIXME

    for (const [row, row_data] of this.conditional_format_cache.entries()) {
      if (row_data) {
        for (const [column, column_data] of row_data.entries()) {
          if (column_data) {

            this.CellData({row, column}).FlushStyle();

          }
        }
      }
    }

    this.conditional_format_cache = [];

  }

  public ApplyConditionalFormatCache(format: ConditionalFormat) {
    
    for (let row = format.area.start.row; row <= format.area.end.row; row++ ) {
      for (let column = format.area.start.column; column <= format.area.end.column; column++ ) {
        if (!this.conditional_format_cache[row]) {
          this.conditional_format_cache[row] = [];
        }
        if (!this.conditional_format_cache[row][column]) {
          this.conditional_format_cache[row][column] = [];
        }
        this.conditional_format_cache[row][column].push(format.style);
        this.CellData({row, column}).FlushStyle();

      }
    }

  }
  */

  private ConditionalFormatForCell(address: ICellAddress): CellStyle[] {
    if (this.conditional_format_cache[address.row]) {
      return this.conditional_format_cache[address.row][address.column] || [];
    }
    return [];
  }

  /**
   * generates the composite style for the given cell. this
   * should only be used to generate a cache of styles (Q: really? PERF?)
   *
   * the "apply_cell_style" parameter is used for testing when pruning. we
   * want to check what happens if the cell style is not applied; if nothing 
   * happens, then we can drop the cell style (or the property in the style).
   */
  private CompositeStyleForCell(
        address: ICellAddress, 
        apply_cell_style = true, 
        apply_row_pattern = true, 
        apply_default = true,
        apply_conditional = true, ) {

    const { row, column } = address;
    const stack: CellStyle[] = [];
    
    if (apply_default) {
      stack.push(this.default_style_properties);
    }
    stack.push(this.sheet_style);

    if (apply_row_pattern && this.row_pattern.length) {
      stack.push(this.row_pattern[row % this.row_pattern.length]);
    }

    if (this.row_styles[row]) {
      stack.push(this.row_styles[row]);
    }

    if (this.column_styles[column]) {
      stack.push(this.column_styles[column]);
    }

    if (apply_cell_style
      && this.cell_style[column]
      && this.cell_style[column][row]) {
      stack.push(this.cell_style[column][row]);
    }

    if (apply_conditional) {
      stack.push(...this.ConditionalFormatForCell(address));
    }

    return Style.Composite(stack);
  }

  /**
   * can we use the rendered JSON as a key, instead? 
   */
  private GetStyleIndex(style: CellStyle) {

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

