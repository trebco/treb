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

import type { ICellAddress, 
         PreparedText, RenderTextPart,
         Cell, Size, 
         CellStyle,
         Theme,
         HorizontalAlign,
         ExtendedCelLStyle} from 'treb-base-types';
import { TextPartFlag, Style, ValueType, Area, Rectangle, ResolveThemeColor, IsDefinedColor } from 'treb-base-types';

import type { Tile } from '../types/tile';
// import { FontMetricsCache as FontMetricsCache2 } from '../util/fontmetrics2';
import type { FormattedString} from 'treb-parser';
import { MDParser } from 'treb-parser';
import { BaseLayout, TileRange } from '../layout/base_layout';
import type { DataModel, ViewModel } from 'treb-data-model';
import type { GridOptions } from '../types/grid_options';

import { Get as GetFontMetrics } from '../util/fontmetrics';

const DEFAULT_INDENT = '  '; // two spaces in the current font
// const BASELINE = 'bottom';
// const WK = /webkit/i.test(typeof navigator === 'undefined' ? '' : navigator?.userAgent || '') ? 1 : 0;

interface FontSet {
  base: string,
  strong: string,
  emphasis: string,
  strong_emphasis: string,
}

interface OverflowCellInfo {
  address: ICellAddress;
  cell: Cell;
  border: Rectangle;
  background: Rectangle;
  grid: Rectangle;
}


interface RenderCellResult {

  tile_overflow_bottom?: boolean;
  tile_overflow_right?: boolean;

  // this can happen if a cell overflows to the left.
  tile_overflow_left?: boolean;

  width?: number;
  height?: number;
  left?: number;

}

interface OverflowRecord {
  head: ICellAddress;
  area: Area;
  tile: Tile;
}

export class TileRenderer {

  // removing last_font because we are doing more complex
  // font manipulation for MD text
  // protected last_font?: string;

  protected readonly cell_edge_buffer = 4;

  /**
   * a record of cell overflows, also used for merges if they cross tile
   * boundaries. on render, we check if an overflow(ed) cell is dirty; if
   * so, this forces update of dependent cells.
   */
  protected overflow_areas: OverflowRecord[] = [];

  protected buffer_canvas: HTMLCanvasElement;
  protected buffer_context!: CanvasRenderingContext2D;
  protected buffer_canvas_size: Size = { width: 256, height: 256 };

  constructor(
    protected theme: Theme,
    protected layout: BaseLayout,
    protected model: DataModel,
    protected view: ViewModel,
    protected options: GridOptions, ) {

    this.buffer_canvas = layout.buffer_canvas;
    this.buffer_canvas.width = this.buffer_canvas_size.width;
    this.buffer_canvas.height = this.buffer_canvas_size.height;
    
    // we need this attached to the document so it inherits fonts properly.
    // in fact layout should manage it and then hand it to us (or we can grab it)

    // this.buffer_canvas.classList.add('treb-buffer-canvas');
    // document.body.appendChild(this.buffer_canvas);

    const context = this.buffer_canvas.getContext('2d', { alpha: false });

    if (context) {
      const scale = this.layout.dpr;
      this.buffer_context = context;
      this.buffer_context.setTransform(scale, 0, 0, scale, 0, 0);
      this.buffer_context.textAlign = 'left';
      this.buffer_context.textBaseline = // BASELINE; // 
        'alphabetic';
    }

    // this.UpdateTheme();

    /*
    if (this.theme.grid_cell?.font_size?.value){
      if (this.theme.grid_cell.font_size.unit === 'px') {
        FontMetricsCache.base_size_px = this.theme.grid_cell.font_size.value;
      }
      else if (this.theme.grid_cell.font_size.unit === 'pt') {
        FontMetricsCache.base_size_px = this.theme.grid_cell.font_size.value * 4 / 3;
      }
    }
    */

  }

  /**
   * we manage overflow blocks to simplify (more or less) rendering,
   * but they break in the event of insert/delete row/column. we need 
   * to adjust, or perhaps flush, when we insert/delete columns.
   * 
   */
  public FlushOverflows() {

    // flush all, mark dirty and drop areas.

    const cells = this.view.active_sheet.cells;

    for (const cell of cells.Iterate()) {
      if (cell.renderer_data?.overflowed) {
        cell.renderer_data = undefined;
        cell.render_clean[this.view.view_index] = false;
      }
    }

    /*
    cells.IterateAll(cell => {
      if (cell.renderer_data?.overflowed) {
        cell.renderer_data = undefined;
        cell.render_clean[this.view.view_index] = false;
      }
    });
    */

    for (const overflow_area of this.overflow_areas) {
      overflow_area.tile.dirty = true;
    }
    
    this.overflow_areas = [];

  }

  /**
   * new method for measuring text, intended to take into account 
   * indentation and wrapping, scale, and all the other stuff. 
   */
  public MeasureText(cell: Cell, current_width: number, override_scale?: number) {

    // we need a canvas. I guess we can just randomly use one?

    const tile = this.layout.grid_tiles[0][0];

    // we need fonts, and check if we need variants

    const scale = override_scale ?? this.layout.scale;
    const style: CellStyle = cell.style || {};
    const base_font = Style.CompositeFont(this.theme.grid_cell_font_size, style, scale, this.theme);
    const metrics = GetFontMetrics(base_font.font, base_font.variants);

    const fonts: FontSet = {
      base: base_font.font,
      strong: Style.CompositeFont(this.theme.grid_cell_font_size, {...style, bold: true}, scale, this.theme).font,
      emphasis: Style.CompositeFont(this.theme.grid_cell_font_size, {...style, italic: true}, scale, this.theme).font,
      strong_emphasis: Style.CompositeFont(this.theme.grid_cell_font_size, {...style, bold: true, italic: true }, scale, this.theme).font,
    };

    if (base_font.variants) {
      tile.style.fontVariant = base_font.variants;
    }
    else {
      tile.style.fontVariant = '';
    }

    const context = tile.getContext('2d', { alpha: false });

    if (!context) {
      throw new Error('context failed');
    }

    const prepped = this.PrepText(context, fonts, cell, current_width);

    const width = prepped.width;
    const height = metrics.height * prepped.strings.length;

    return { width, height };

  }

  /* *
   * use one of the tile contexts to measure text. we are using the tile
   * context because it's attached to the DOM, and style is applied. we need
   * that for the root font size, in case font size in the style is relative
   * (which it should be).
   * 
   * we could use the buffer context, if that were attached to the DOM, but
   * at the moment it is not so this is a shortcut. since we're not actually
   * painting, it's not too bad, but we still fetch the context every time.
   * hopefully it's cached.
   * 
   * FIXME: if you're doing it this way, maybe pass in an array of strings/
   * fonts, to avoid getting the context every time?
   * 
   * @param text 
   * @param font 
   * /
  public MeasureText(text: string, font?: string): TextMetrics {

    const context = this.layout.grid_tiles[0][0].getContext('2d', { alpha: false });
    
    if (!context) {
      throw new Error('invalid context');
    }

    if (font) {
      context.font = font;
    }

    return context.measureText(text);
  }
  */

  /**
   * when drawing to the buffered canvas, (1) ensure it's large enough,
   * and (2) set transform as necessary (we may be overflowing to the left).
   */
  public EnsureBuffer(width = 0, height = 0, offset = 0): void {

    // console.info('eb', width, height, offset);

    const scale = this.layout.dpr;
    width = width * scale;
    height = height * scale;
    offset = offset * scale;

    if (width > this.buffer_canvas_size.width
      || height > this.buffer_canvas_size.height) {

      this.buffer_canvas_size.width = Math.max(Math.ceil(width / 256) * 256, this.buffer_canvas_size.width);
      this.buffer_canvas_size.height = Math.max(Math.ceil(height / 256) * 256, this.buffer_canvas_size.height);

      // console.info('size ->', this.buffer_canvas_size);

      this.buffer_canvas.width = this.buffer_canvas_size.width;
      this.buffer_canvas.height = this.buffer_canvas_size.height;

      const context = this.buffer_canvas.getContext('2d', { alpha: false });

      if (context) {
        this.buffer_context = context;
        this.buffer_context.textAlign = 'left';
        this.buffer_context.textBaseline = // BASELINE; 
          'alphabetic';
      }

    }

    this.buffer_context.setTransform(scale, 0, 0, scale, offset, 0);

  }

  /**
   * check all overflow areas. if any elements are dirty, mark all elements
   * as dirty (FIXME: and remove the list?)
   */
  public OverflowDirty(full_tile = false): void {

    const mutated: OverflowRecord[] = [];

    for (const overflow of this.overflow_areas) {
      const row = overflow.area.start.row;
      let dirty = full_tile; // false;
      if (!dirty) {
        for (let column = overflow.area.start.column; !dirty && column <= overflow.area.end.column; column++) {
          const cell = this.view.active_sheet.cells.GetCell({ row, column }, false);
          dirty = !!(cell && !cell.render_clean[this.view.view_index]);
        }
      }
      if (dirty) {
        for (let column = overflow.area.start.column; column <= overflow.area.end.column; column++) {
          const cell = this.view.active_sheet.cells.GetCell({ row, column }, false);
          if (cell) {
            cell.render_clean[this.view.view_index] = false;
            if (cell.renderer_data && cell.renderer_data.overflowed) {
              cell.renderer_data = undefined;
            }
          }
        }
        overflow.tile.dirty = true;
      }
      else mutated.push(overflow);
    }

    this.overflow_areas = mutated;

  }


  /**
   * 
   */
  public RenderCorner(/* selection: GridSelection */): void {

    const corner = this.layout.corner_canvas;
    const context = (corner as HTMLCanvasElement).getContext('2d', { alpha: false });

    if (!context) {
      throw new Error('invalid context');
    }

    const font_info = Style.CompositeFont(this.theme.grid_cell_font_size, this.theme.headers||{}, this.layout.scale, this.theme);
    const m2 = GetFontMetrics(font_info.font, font_info.variants);

    const scale = this.layout.dpr;
    const header_size = this.layout.header_offset;

    let x = header_size.x;
    for (let i = 0; i < this.view.active_sheet.freeze.columns; i++) {
      x += this.layout.ColumnWidth(i);
    }

    let y = header_size.y;
    for (let i = 0; i < this.view.active_sheet.freeze.rows; i++) {
      y += this.layout.RowHeight(i);
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = this.theme.headers?.fill ? ResolveThemeColor(this.theme, this.theme.headers.fill) : '';

    context.fillRect(0, 0, x, header_size.y);
    context.fillRect(0, 0, header_size.x, y);

    // we have to split this into two parts because of the new
    // header grid color. do the header part first...

    context.strokeStyle = this.theme.headers_grid_color || '';

    context.beginPath();
    context.moveTo(header_size.x - 0.5, 0);
    context.lineTo(header_size.x - 0.5, header_size.y);
    context.moveTo(0, header_size.y - 0.5);
    context.lineTo(header_size.x, header_size.y - 0.5);
    context.stroke();

    // actually we can bail out first

    if (!this.view.active_sheet.freeze.columns && !this.view.active_sheet.freeze.rows) return;

    // then do the other part with the regular grid color

    context.strokeStyle = this.theme.grid_color || '';

    context.beginPath();
    if (y !== header_size.y) {
      context.moveTo(header_size.x - 0.5, header_size.y);
      context.lineTo(header_size.x - 0.5, y);
    }
    if (x !== header_size.x) {
      context.moveTo(header_size.x, header_size.y - 0.5);
      context.lineTo(x, header_size.y - 0.5);
    }
    context.stroke();

    // here we go back to the header grid color for the breaks

    context.strokeStyle = this.theme.headers_grid_color || '';

    // NOTE: if headers are hidden (which is done by setting width/height to
    // 0 or 1 pixel) we don't want to render them here.

    context.textAlign = 'center';
    context.textBaseline = 'middle'; // FUXME
    context.font = font_info.font; // Style.Font(this.theme.headers||{}, this.layout.scale);

    context.fillStyle = ResolveThemeColor(this.theme, this.theme.headers?.text);

    if (this.view.active_sheet.freeze.rows && this.layout.header_offset.x > 1) {

      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.translate(0, header_size.y);
      context.beginPath();
      context.moveTo(0, 0 - 0.5);
      context.lineTo(header_size.x, 0 - 0.5);
      context.stroke();

      this.RenderRowLabels(context, 0, this.view.active_sheet.freeze.rows - 1, // m2.block);
          m2.height);

    }

    if (this.view.active_sheet.freeze.columns && this.layout.header_offset.y > 1) {

      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.translate(header_size.x, 0);

      // what is this doing? it's not consistent with the column paint routine... 

      // A: it's different. it's drawing the line at the left of the header,
      // which otherwise wouldn't render [really?]. we already have the line 
      // at the bottom rendered above.

      context.beginPath();
      context.moveTo(0 - 0.5, 0);
      context.lineTo(0 - 0.5, header_size.y);
      context.stroke();

      this.RenderColumnLabels(context, 0, this.view.active_sheet.freeze.columns - 1);

    }

    /////

  }

  /**
   * unifying because headers and corner both render labels.
   * 
   * @param context 
   * @param column 
   * @param end 
   */
  public RenderColumnLabels(context: CanvasRenderingContext2D, column: number, end: number) {

    const header_y = this.layout.header_offset.y;
    if (header_y <= 1) {
      return;
    }

    context.fillStyle = ResolveThemeColor(this.theme, this.theme.headers?.text, 0);

    context.beginPath();

    for (; column <= end; column++) {
      const width = this.layout.ColumnWidth(column);
      const text = Area.ColumnToLabel(column);
      const metrics = context.measureText(text);
      if (width > metrics.width) {
        context.fillText(text, width / 2, header_y / 2 + 1);
      }
      context.moveTo(width - 0.5, 0);
      context.lineTo(width - 0.5, header_y);
      context.translate(width, 0);
    }

    context.stroke();

  }

  public RenderRowLabels(context: CanvasRenderingContext2D, row: number, end: number, block: number) {

    const header_x = this.layout.header_offset.x;
    if (header_x <= 1) {
      return;
    }
    
    context.fillStyle = ResolveThemeColor(this.theme, this.theme.headers?.text, 0);
    
    context.beginPath();

    for (; row <= end; row++) {
      const height = this.layout.RowHeight(row);
      if (height >= block * 1.2) {
        context.fillText(`${row + 1}`, header_x / 2, height / 2 + 1);
      }
      context.moveTo(0, height - 0.5);
      context.lineTo(header_x, height - 0.5);
      context.translate(0, height);
    }

    context.stroke();

  }

  /**
   */
  public RenderHeaders(tiles: TileRange /*, selection: GridSelection*/, force = false): void {

    const scale = this.layout.dpr;
    const header_size = this.layout.header_offset;

    const font_info = Style.CompositeFont(this.theme.grid_cell_font_size, this.theme.headers||{}, this.layout.scale, this.theme);
    const m2 = GetFontMetrics(font_info.font, font_info.variants);


    for (let column = tiles.start.column; column <= tiles.end.column; column++) {

      const tile = this.layout.column_header_tiles[column];
      if (tile.dirty || force) {

        const context = tile.getContext('2d', { alpha: false });
        if (!context) continue;
        context.setTransform(scale, 0, 0, scale, 0, 0);

        context.textAlign = 'center';
        context.textBaseline = 'middle'; // FIXME

        context.font = font_info.font; // Style.Font(this.theme.headers||{}, this.layout.scale);
        if (font_info.variants) {
          tile.style.fontVariant = font_info.variants;
        }
        else {
          tile.style.fontVariant = '';
        }

        context.fillStyle = this.theme.headers?.fill ? ResolveThemeColor(this.theme, this.theme.headers.fill) : '';
        context.fillRect(0, 0, tile.logical_size.width, this.layout.header_offset.y);

        // context.strokeStyle = this.theme.grid_color || '';
        context.strokeStyle = this.theme.headers_grid_color || '';

        // this draws a line at the bottom of the header
        // (using regular grid color)

        // looks better using the header grid color

        context.beginPath();
        context.moveTo(0, header_size.y - 0.5);
        context.lineTo(tile.logical_size.width, header_size.y - 0.5);
        context.stroke();

        // then we switch to the header color for the edges

        context.strokeStyle = this.theme.headers_grid_color || '';

        this.RenderColumnLabels(context, tile.first_cell.column, tile.last_cell.column);

        tile.dirty = false;
      }

    }

    for (let row = tiles.start.row; row <= tiles.end.row; row++) {

      const tile = this.layout.row_header_tiles[row];
      if (tile.dirty || force) {

        const context = tile.getContext('2d', { alpha: false });
        if (!context) continue;
        context.fillStyle = this.theme.headers?.fill ? ResolveThemeColor(this.theme, this.theme.headers.fill) : '';

        context.setTransform(scale, 0, 0, scale, 0, 0);

        context.textAlign = 'center';
        context.textBaseline = 'middle'; // FIXME
        // context.font = Style.Font(this.theme.headers||{}, this.layout.scale);

        context.font = font_info.font; // Style.Font(this.theme.headers||{}, this.layout.scale);
        if (font_info.variants) {
          tile.style.fontVariant = font_info.variants;
        }
        else {
          tile.style.fontVariant = '';
        }

        context.fillRect(0, 0, this.layout.header_offset.x, tile.logical_size.height);

        // context.strokeStyle = this.theme.grid_color || '';
        context.strokeStyle = this.theme.headers_grid_color || '';

        context.beginPath();
        context.moveTo(header_size.x - 0.5, 0);
        context.lineTo(header_size.x - 0.5, tile.logical_size.height);
        context.stroke();

        context.strokeStyle = this.theme.headers_grid_color || '';

        this.RenderRowLabels(context, tile.first_cell.row, tile.last_cell.row, // m2.block);
              m2.height);

        tile.dirty = false;
      }
    }

    if (this.view.active_sheet.freeze.rows || this.view.active_sheet.freeze.columns) {
      this.RenderCorner();
    }

  }

  /**
   * 
   * @param tile starting tile
   * @param scale scale
   * @param dx tile offset, in tiles
   * @param dy tile offset, in tiles
   * @param left (original) translation, in scaled pixels
   * @param top (original) translation, in scaled pixels
   * @param result buffer info
   */
  public CopyToAdjacent(
    tile: Tile,
    scale: number,
    dx: -1 | 0 | 1,
    dy: -1 | 0 | 1,
    left: number,
    top: number,
    result: RenderCellResult): void {

    const adjacent = this.layout.AdjacentTile(tile, dy, dx);
    if (!adjacent) return; // FIXME: warn?

    let x = left;
    let y = top;

    if (dx > 0) {
      x = left - (tile.pixel_end.x - tile.pixel_start.x) * scale;
    }
    else if (dx < 0) {
      x = left + (adjacent.pixel_end.x - adjacent.pixel_start.x) * scale;
    }
    if (dy > 0) {
      y = top - (tile.pixel_end.y - tile.pixel_start.y) * scale;
    }

    const context = adjacent.getContext('2d', { alpha: false });
    if (context) {
      context.setTransform(scale, 0, 0, scale, x, y);
      context.drawImage(this.buffer_canvas,
        0, 0, (result.width || 0) * scale, (result.height || 0) * scale,
        result.left || 0, 0, result.width || 0, result.height || 0);
    }

  }

  /** render a tile */
  public Render(tile: Tile): void {

    // can we assume this is always set? this feels sloppy, and 
    // it feels like something we'd like to turn off... can we 
    // fetch the canvas more than once? not sure what the impact of
    // that would be.

    // tile.style.fontVariantNumeric = 'lining-nums tabular-nums';

    const context = tile.getContext('2d', { alpha: false });
    if (!context) { return; } // should throw

    context.textBaseline = // BASELINE;
      'alphabetic';

    const scale = this.layout.dpr;

    context.setTransform(scale, 0, 0, scale, 0, 0);

    let left = 0;
    let top = 0;

    for (let column = tile.first_cell.column; column <= tile.last_cell.column; column++) {
      const width = this.layout.ColumnWidth(column);
      if (!width) continue;
      top = 0;
      for (let row = tile.first_cell.row; row <= tile.last_cell.row; row++) {
        const height = this.layout.RowHeight(row);
        if (height) {

          context.setTransform(scale, 0, 0, scale, left, top);
          const cell = this.view.active_sheet.CellData({ row, column });

          if (tile.needs_full_repaint || !cell.render_clean[this.view.view_index]) {

            const result = this.RenderCell(tile, cell, context, { row, column }, width, height, 
                (tile.pixel_start.x + left), 
                (tile.pixel_start.y + top));

            // render_list.push({row, column, cell});

            if (result.tile_overflow_right) {
              this.CopyToAdjacent(tile, scale, 1, 0, left, top, result);
            }
            if (result.tile_overflow_left) {
              this.CopyToAdjacent(tile, scale, -1, 0, left, top, result);
            }
            if (result.tile_overflow_bottom) {
              this.CopyToAdjacent(tile, scale, 0, 1, left, top, result);
            }

          }

        }
        top += (height * scale);
      }
      left += (width * scale);
    }

    if (!this.view.active_sheet.freeze.rows && !this.view.active_sheet.freeze.columns) return; // render_list;

    // paint to headers

    let copy_height = 0;
    let copy_width = 0;

    if (tile.first_cell.row <= this.view.active_sheet.freeze.rows - 1) {
      for (let i = tile.first_cell.row; i < this.view.active_sheet.freeze.rows && i <= tile.last_cell.row; i++) {
        copy_height += this.layout.RowHeight(i);
      }
    }
    if (tile.first_cell.column <= this.view.active_sheet.freeze.columns - 1) {
      for (let i = tile.first_cell.column; i < this.view.active_sheet.freeze.columns && i <= tile.last_cell.column; i++) {
        copy_width += this.layout.ColumnWidth(i);
      }
    }

    if (copy_height) {

      // get tile header
      const header = this.layout.frozen_row_tiles[tile.tile_position.column];
      if (!header) throw new Error('can\'t find matching header tile');

      const header_context = header.getContext('2d', { alpha: true });
      if (!header_context) throw new Error('header context failed');

      // FIXME: offset for !first tile

      header_context.setTransform(scale, 0, 0, scale, 0, 0); // this.model.sheet.header_offset.y * scale);

      header_context.drawImage(tile, 0, 0, tile.logical_size.width * scale,
        copy_height * scale, 0, 0, tile.logical_size.width, copy_height);

    }
    if (copy_width) {

      // get tile header
      const header = this.layout.frozen_column_tiles[tile.tile_position.row];
      if (!header) throw new Error('can\'t find matching header tile');

      const header_context = header.getContext('2d', { alpha: true });
      if (!header_context) throw new Error('header context failed');

      // FIXME: offset for !first tile

      header_context.setTransform(scale, 0, 0, scale, 0, 0);

      header_context.drawImage(tile, 0, 0, copy_width * scale,
        tile.logical_size.height * scale, 0, 0, copy_width, tile.logical_size.height);

    }
    if (copy_width && copy_height) {

      const corner_context = this.layout.corner_canvas.getContext('2d', { alpha: 'false' }) as CanvasRenderingContext2D;
      if (!corner_context) throw new Error('corner context failed');

      // FIXME: offset for !first tile

      corner_context.setTransform(scale, 0, 0, scale,
        this.layout.header_offset.x * scale,
        this.layout.header_offset.y * scale);

      corner_context.drawImage(tile, 0, 0, copy_width * scale,
        copy_height * scale, 0, 0, copy_width, copy_height);

    }

    return; // render_list;

  }

  /**
   * split and measure text. can be cached. there are actually two completely
   * separate operations here, which we're consolidating for convenience (and
   * because they never overlap).
   *
   * UPDATED returning a 2d array, where the first dimension represents lines
   * and the second dimension represents components
   */
  protected PrepText(context: CanvasRenderingContext2D, 
                     fonts: FontSet, 
                     cell: Cell, 
                     cell_width: number /*, override_text?: string*/ ): PreparedText {

    const strings: RenderTextPart[] = [];
    const style: CellStyle = cell.style || {};

    let pad_entry: RenderTextPart | undefined;
    let composite_width = 0;

    // -------------------------------------------------------------------------

    // moved translated boolean formatting here. I don't like this. it 
    // should be in sheet (at least that's where the rest of formatting
    // is), but sheet doesn't have a reference to data model (and because
    // sheets are owned by data model, I don't want to add a circular ref).

    if (cell.rendered_type === ValueType.boolean) {
      const value = cell.calculated_type ? cell.calculated : cell.value;
      cell.formatted = value ? (this.model.language_model?.boolean_true || 'TRUE') : (this.model.language_model?.boolean_false || 'FALSE');
    }

    // -------------------------------------------------------------------------

    let override_formatting: string | undefined;
    let formatted = cell.editing ? '' : cell.formatted; // <-- empty on editing, to remove overflows

    // remove existing indent, if any
    
    if (Array.isArray(formatted)) {
      formatted = formatted.filter(test => test.flag !== TextPartFlag.indent);
    }

    // precalculate indent as string so we can use layout

    let indent = '';
    let align: HorizontalAlign|undefined;
   
    if (style.indent) {

      for (let i = 0; i < style.indent; i++) {
        indent += DEFAULT_INDENT;
      }

      align = style.horizontal_align;

      // default might be left or right based on type

      if (!align) {
        align = (
          cell.type === ValueType.number || 
          cell.calculated_type === ValueType.number ||
          cell.type === ValueType.complex || 
          cell.calculated_type === ValueType.complex
        ) ? 'right' : 'left';
      }
     
    }

    if (Array.isArray(formatted)) {

      // type 1 is a multi-part formatted string; used for number formats.
      // we support invisible characters and padded (expanded) characters

      // FIXME: is there any case where this would include md? ...
      // (potentially yes? what happens if you have a string in a number-formatted cell?)

      // this is a single line, with number formatting

      if (indent) {
        if (align === 'right') {
          formatted.push({ text: indent, flag: TextPartFlag.indent });
        }
        else if (align === 'left' || typeof align === 'undefined') {
          formatted.unshift({ text: indent, flag: TextPartFlag.indent });
        }
      }

      for (const part of formatted) {
        if (part.flag === TextPartFlag.formatting) {
          override_formatting = part.text;
          continue;
        }

        const mt_width = context.measureText(part.text).width;
        const render_part: RenderTextPart = { 
          width: mt_width, 
          text: part.text, 
          hidden: part.flag === TextPartFlag.hidden 
        };

        strings.push(render_part);

        if (part.flag === TextPartFlag.padded) {
          pad_entry = render_part;
        }
        else {
          composite_width += mt_width;
        }
      }

      if (pad_entry) {

        const text = pad_entry.text;
        const text_width = pad_entry.width;
        const balance = cell_width - composite_width - (2 * this.cell_edge_buffer);

        pad_entry.width = Math.max(0, balance);

        if (balance > 0) {
          const count = Math.floor(balance / text_width);
          for (let i = 1; i < count; i++) {
            pad_entry.text += text;
          }
          composite_width = cell_width - (2 * this.cell_edge_buffer);
        }
        else {
          pad_entry.text = '';
        }

      }

      return { strings: [strings], format: override_formatting, width: composite_width };

    }
    else if (formatted) {

      // type 2 is a single string, but may be split into newlines either
      // explicitly or implicitly via wrap

      // ALSO we don't show leading apostrophes, as those indicate a string

      if (cell.type === ValueType.string && formatted[0] === '\'') {
        formatted = formatted.slice(1);
      }

      let md: FormattedString[][];

      if (this.options.markdown) {
        md = MDParser.instance.Parse(formatted);
      }
      else {
        md = MDParser.instance.Dummy(formatted);
        context.font = fonts.base; // never changes
      }

      // if we are not wrapping, we don't have to do any trimming. if we
      // are wrapping, leave whitespace attached to the front; possibly trim 
      // whitespace in between tokens (this should be attached to tokens, but
      // possibly not...)
      
      let max_width = 0;

      // for wrapping

      let bound = cell_width - (2 * this.cell_edge_buffer);
      const strings: RenderTextPart[][] = [];

      if (style.wrap) {

        const indent_width = (indent && style.horizontal_align !== 'center') ? context.measureText(indent).width : 0;
        bound -= indent_width;

        for (const line of md) {

          // we should probably normalize whitespace -- because formatting
          // may put some whitespace before tokens, other whitespace after
          // tokens, and so on. it's confusing. 

          for (let i = 1; i < line.length; i++) {
            const test = line[i].text.match(/^(\s+)/);
            if (test) {
              line[i - 1].text += test[1];
              line[i].text = line[i].text.replace(/^\s+/, '');
            }
          }

          // that leads leading whitespace on the first token, which we
          // probably can't resolve (we could just drop it, I guess)


          // next we need to measure each word:

          interface WordMetric {
            part: FormattedString,
            text: string, // UNTRIMMED
            trimmed: number,
            width: number,
          }

          const words: WordMetric[] = [];

          for (const element of line) {

            if (this.options.markdown) {
              if (element.strong && element.emphasis) {
                context.font = fonts.strong_emphasis;
              }
              else if (element.strong) {
                context.font = fonts.strong;
              }
              else if (element.emphasis) {
                context.font = fonts.emphasis;
              }
              else {
                context.font = fonts.base;
              }
            }

            const split = element.text.match(/\S+\s*/g); // preserve extra whitespace on the same line...
            if (split && split.length) {
              for (const word of split) {

                // FIXME: maybe overoptimizing, but this is measuring the same
                // text twice; could reduce...

                const trimmed = context.measureText(word.trim()).width;
                const width = context.measureText(word).width; // including trailing whitespace
                words.push({part: element, text: word, trimmed, width});

              }
            }
          }

          // now we can construct wrapped lines. we don't split words, so 
          // we always have at least one word on a line.

          while (words.length) {

            // add first word. line length is _trimmed_ length.

            let last = words.shift() as WordMetric; // NOT undefined

            const line2 = [last];
            let line_width = last.trimmed;

            // add more words? check bounds first

            while (line_width < bound && words.length) {

              // we're holding the trim width on the last word, but to
              // test we need the untrimmed width

              const word = words[0];
              const test = line_width - last.trimmed + last.width + word.trimmed;

              if (test >= bound) {
                break; // line finished
              }

              // add this word to the line, remove it from the stack

              last = word;
              line2.push(word);
              line_width = test;
              words.shift();

              max_width = Math.max(max_width, line_width);

            }

            // trim the last word, then insert a row (we're relying on the 
            // fact that this points at the last entry in the array)

            last.text = last.text.trim();
            last.width = last.trimmed;

            max_width = Math.max(max_width, last.width);

            const line_string = line2.map((metric) => {
              return {
                ...metric.part,
                hidden: false, 
                width: metric.width, 
                text: metric.text, 
              };
            });

            if (style.indent) {
              if (align === 'right') {
                line_string.push({ text: indent, hidden: false, width: indent_width });
              }
              else if (align === 'left') {
                line_string.unshift({ text: indent, hidden: false, width: indent_width });
              }
            }

            strings.push(line_string);

          }

        }
        
      }
      else {

        // simple case


        for (const line of md) {
          const parts: RenderTextPart[] = [];

          if (style.indent) {
            if (align === 'right') {
              line.push({ text: indent });
            }
            else if (align === 'left') {
              line.unshift({ text: indent });
            }
          }

          let line_width = 0;

          for (const element of line) {

            if (this.options.markdown) {
              if (element.strong && element.emphasis) {
                context.font = fonts.strong_emphasis;
              }
              else if (element.strong) {
                context.font = fonts.strong;
              }
              else if (element.emphasis) {
                context.font = fonts.emphasis;
              }
              else {
                context.font = fonts.base;
              }
            }

            const width =  context.measureText(element.text).width;
            line_width += width;

            parts.push({
              ...element,
              hidden: false,
              width,
            });

          }

          max_width = Math.max(max_width, line_width);

          strings.push(parts);
          
        }
      }

      return { strings, width: max_width };

    }

    return {
      strings: [[{ text: '', hidden: false, width: 0 }]],
      width: 0,
    };

  }

  protected ResolveColors(style: CellStyle): CellStyle {

    const resolved = {...style};
    resolved.text = { text: ResolveThemeColor(this.theme, style.text, 1) };

    // TODO: other colors

    return resolved;

  }

  protected RenderCellBorders(
    address: ICellAddress,
    context: CanvasRenderingContext2D,
    style: CellStyle,
    left = 0, top = 0, width = 0, height = 0): void {

    // cell borders is one of those things that seems simple, even trivial, 
    // until you actually try to do it. then it turns out to be ridiculously
    // complicated.

    // one complicating factor that we are adding is that we don't necessarily
    // paint in order, because we may update single cells at a time. so we need
    // to account for shared borders in two directions.
    
    // general rules:
    //
    // (1) borders take priority over fills 
    //
    // (2) bottom cell, then right cell, take priority over this cell (except
    //     with regards to rule 1, so our border takes precendence over bottom
    //     cell fill, but not bottom cell border).
    // 
    // some other things to note:
    //
    // - double borders (we only handle double-bottom, atm) flow _into_ the 
    //   neighboring cell, instead of just using the shared border. in this 
    //   case the shared edge should be colored wrt to the cell that owns the
    //   double border, either that cell's fill or default.
    // 
    // - if we have a fill, we are painting the shared border; but in this case
    //   you also have to consider the top-left corner, which could be a border
    //   owned by a cell offset by (-1, -1) and because of rule 1, above, that
    //   pixel needs to stay border.
    //
    // - that theoretically applies to other corners as well, but somehow that
    //   hasn't come up? (...) 
    //
    // - instead of clipping all the corners, when necessary, why not just paint
    //   the diagonals? might save time


    // I think there are some opportunities for caching here (TODO)

    // ---

    // (moved to sheet, using numpad naming)

    const numpad = this.view.active_sheet.SurroundingStyle(address, this.theme.table);

    // --- start with fills ----------------------------------------------------

    // paint top background

    let color = ResolveThemeColor(this.theme, numpad[8].fill);
    if (color) {
      context.fillStyle = color
      context.fillRect(left + 0, top - 1, width, 1);
    }

    // paint left background

    color = ResolveThemeColor(this.theme, numpad[4].fill);
    if (color) {
      context.fillStyle = color
      context.fillRect(left - 1, top, 1, height);
    }

    // paint our background. note this one goes up, left

    color = ResolveThemeColor(this.theme, style.fill);
    if (color) {
      context.fillStyle = color;
      context.fillRect(left - 1, top - 1, width + 1, height + 1);
    }

    // fill of cell to the right

    color = ResolveThemeColor(this.theme, numpad[6].fill);
    if (color) {
      context.fillStyle = color;
      context.fillRect(left + width - 1, top - 1, 1, height + 1);

    }

    // fill of cell underneath

    color = ResolveThemeColor(this.theme, numpad[2].fill);
    if (color) {
      context.fillStyle = color;
      context.fillRect(left - 1, top + height - 1, width + 1, 1);
    }

    // --- corner borders ------------------------------------------------------

    if (numpad[6].border_top && !numpad[6].border_left) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[6].border_top_fill, 1);
      context.fillRect(left + width - 1, top - 2 + numpad[6].border_top, 1, 1);
    }
    if (numpad[9].border_left) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[9].border_left_fill, 1);
      context.fillRect(left + width - 1, top - 1, 1, 1);
    }
    if (numpad[9].border_bottom) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[9].border_bottom_fill, 1);
      context.fillRect(left + width - 1, top - 2 + numpad[9].border_bottom, 1, 1);
    }

    if (numpad[4].border_top && !numpad[4].border_right) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[4].border_right_fill, 1);
      context.fillRect(left - 1, top - 2 + numpad[4].border_top, 1, 1);
    }
    if (numpad[7].border_right) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[7].border_right_fill, 1);
      context.fillRect(left - 1, top - 1, 1, 1);
    }
    if (numpad[7].border_bottom) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[7].border_bottom_fill, 1);
      context.fillRect(left - 1, top - 2 + numpad[7].border_bottom, 1, 1);
    }

    if (numpad[6].border_bottom && !numpad[6].border_left) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[6].border_bottom_fill, 1);
      context.fillRect(left + width - 1, top + height - numpad[6].border_bottom, 1, 1);
    }
    if (numpad[3].border_left) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[3].border_left_fill, 1);
      context.fillRect(left + width - 1, top + height - 1, 1, 1);
    }
    if (numpad[3].border_top) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[3].border_top_fill, 1);
      context.fillRect(left + width - 1, top + height - numpad[3].border_top, 1, 1);
    }

    if (numpad[4].border_bottom && !numpad[4].border_right) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[4].border_bottom_fill, 1);
      context.fillRect(left - 1, top + height - numpad[4].border_bottom, 1, 1);
    }
    if (numpad[1].border_right) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[1].border_right_fill, 1);
      context.fillRect(left - 1, top + height - 1, 1, 1);
    }
    if (numpad[1].border_top) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[1].border_top_fill, 1);
      context.fillRect(left - 1, top + height - numpad[1].border_top, 1, 1);
    }

    // --- neighbor borders ----------------------------------------------------

    // paint top border

    if (numpad[8].border_bottom) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[8].border_bottom_fill, 1);
      if (numpad[8].border_bottom === 2) {
        context.fillRect(left - 1, top - 2, width + 1, 1);
        context.fillRect(left - 1, top - 0, width + 1, 1);
        context.fillStyle = ResolveThemeColor(this.theme, numpad[8].fill) 
          || ResolveThemeColor(this.theme, this.theme.grid_cell?.fill, 0) || '#fff';
        context.fillRect(left - 1, top - 1, width + 1, 1);
      }
      else {
        context.fillRect(left - 1, top - 1, width + 1, 1);
      }
    }

    // paint left border

    if (numpad[4].border_right) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[4].border_right_fill, 1);
      context.fillRect(left - 1, top - 1, 1, height + 1);
    }

    // paint right border?

    if (numpad[6].border_left) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[6].border_left_fill, 1);
      context.fillRect(left + width - 1, top - 1, 1, height + 1);
    }

    // bottom? (...)

    if (numpad[2].border_top) {
      context.fillStyle = ResolveThemeColor(this.theme, numpad[2].border_top_fill, 1);
      if (numpad[2].border_top === 2) {
        context.fillRect(left - 1, top + height - 2, width + 1, 1);
        context.fillRect(left - 1, top + height - 0, width + 1, 1);
        context.fillStyle = ResolveThemeColor(this.theme, numpad[2].fill) 
          || ResolveThemeColor(this.theme, this.theme.grid_cell?.fill, 0) || '#fff';
        context.fillRect(left - 1, top + height - 1, width + 1, 1);
      }
      else {
        context.fillRect(left - 1, top + height - 1, width + 1, 1);
      }
    }

    // -- our borders ----------------------------------------------------------

    if (style.border_top) {
      context.fillStyle = ResolveThemeColor(this.theme, style.border_top_fill, 1);
      if (style.border_top === 2) {
        context.fillRect(left - 1, top - 2, width + 1, 1);
        context.fillRect(left - 1, top + 0, width + 1, 1);
        context.fillStyle = ResolveThemeColor(this.theme, style.fill) 
          || ResolveThemeColor(this.theme, this.theme.grid_cell?.fill, 0) || '#fff';
        context.fillRect(left - 1, top - 1, width + 1, 1);
      }
      else {
        context.fillRect(left - 1, top - 1, width + 1, 1);
      }
    }

    if (style.border_left) {
      context.fillStyle = ResolveThemeColor(this.theme, style.border_left_fill, 1);
      context.fillRect(left - 1, top - 1, 1, height + 1);
    }

    if (style.border_right) {
      context.fillStyle = ResolveThemeColor(this.theme, style.border_right_fill, 1);
      context.fillRect(left + width - 1, top - 1, 1, height + 1);
    }

    if (style.border_bottom) {
      context.fillStyle = ResolveThemeColor(this.theme, style.border_bottom_fill, 1);
      if (style.border_bottom === 2) {
        context.fillRect(left - 1, top + height - 2, width + 1, 1);
        context.fillRect(left - 1, top + height + 0, width + 1, 1);
        context.fillStyle = ResolveThemeColor(this.theme, style.fill) 
          || ResolveThemeColor(this.theme, this.theme.grid_cell?.fill, 0) || '#fff';
        context.fillRect(left - 1, top + height - 1, width + 1, 1);
      }
      else {
        context.fillRect(left - 1, top + height - 1, width + 1, 1);
      }
    }

  }

  /**
   * paint background image, offset and tiled.
   */
  protected PaintBackgroundImage(
      context: CanvasRenderingContext2D, 
      image: HTMLImageElement,
      left: number,
      top: number,
      width: number,
      height: number,
      render_left = 0,
      render_top = 0,
      offset = 0) {

    // there's no explicit broken flag, but we can infer from size
    if (!image.width || !image.height) {
      return;
    }

    const scale = (this.layout.scale || 1) * this.layout.dpr;

    const source_left = (left / scale) % image.width;
    const source_top = (top / scale) % image.height;

    const source_width = width / scale;
    const source_height = height / scale;

    const roll_x = (source_left + source_width) > image.width;
    const roll_y = (source_top + source_height) > image.height;

    if (roll_x) {
      context.drawImage(image,
        source_left - image.width,
        source_top,
        source_width, 
        source_height, 
        render_left, 
        render_top, 
        width - offset, 
        height - offset);
    }

    if (roll_y) {
      context.drawImage(image,
        source_left,
        source_top - image.height,
        source_width,
        source_height,
        render_left, 
        render_top, 
        width - offset, 
        height - offset);
    }

    if (roll_x && roll_y) {
      context.drawImage(image,
        source_left - image.width,
        source_top - image.height,
        source_width,
        source_height,
        render_left, 
        render_top, 
        width - offset, 
        height - offset);
    }

    context.drawImage(image, 
        source_left, 
        source_top, 
        source_width, 
        source_height,
        render_left, 
        render_top, 
        width - offset, 
        height - offset);

  }

  protected RenderCellBackground(
    note: boolean,
    address: ICellAddress,
    context: CanvasRenderingContext2D,
    style: CellStyle,
    width: number, height: number, cell_left = 0, cell_top = 0): void {

    // so here we draw the background and the bottom and right grid edges.
    // fill is enclosed here, the border method has logic for border colors,
    // because it turns out to be complicated.
    
    context.fillStyle = this.theme.grid_color;
    context.fillRect(0, 0, width, height);

    if (this.view.active_sheet.image) {
      this.PaintBackgroundImage(
            context, 
            this.view.active_sheet.image, 
            cell_left, 
            cell_top, 
            width, 
            height, 0, 0, 1);
    }
    else {

      const fill = ResolveThemeColor(this.theme, style.fill);

      if (fill) {
        context.fillStyle = fill;
        context.fillRect(0, 0, width - 1, height - 1);
      }
      else {
        context.fillStyle = ResolveThemeColor(this.theme, this.theme.grid_cell?.fill, 0) || '#fff';
        context.fillRect(0, 0, width - 1, height - 1);
      }

    }

    // the next call actually paints background, if we have a background color

    this.RenderCellBorders(address, context, style, 0, 0, width, height);

    // so we need to draw the note icon after that

    // why is this here? (it's rendered as background, I guess)

    if (note) {

      const offset_x = 2;
      const offset_y = 1;
      const length = 8;

      // FIXME: why is the default in here, and not in theme defaults?
      // actually it is in theme defaults, probably was here first.

      context.fillStyle = this.theme.note_marker_color;
      context.beginPath();
      context.moveTo(width - offset_x, offset_y);
      context.lineTo(width - offset_x - length, offset_y);
      context.lineTo(width - offset_x, offset_y + length);
      context.lineTo(width - offset_x, offset_y);
      context.fill();
    }

  }

  /**
   * refactoring render to allow rendering to buffered canvas, in the
   * case of tile overflow. this is problematic because as the code stands
   * now, it paints before determining if there's an overflow. so we need
   * to move some paint calls around.
   */
  protected RenderCell(
    tile: Tile,
    cell: Cell,
    context: CanvasRenderingContext2D,
    address: ICellAddress,
    width: number,
    height: number,
    cell_left = 0,
    cell_top = 0,
      ): RenderCellResult {

    const result: RenderCellResult = {};

    // preserve the flag, then unset so we don't have to track around

    const dirty = !cell.render_clean[this.view.view_index];
    cell.render_clean[this.view.view_index] = true;

    // special case for overflows (this has been set by someone to the left)

    if (tile.needs_full_repaint &&
      cell.renderer_data?.overflowed) {

      return {};
    }

    let style: CellStyle = cell.style ? {...cell.style} : {};

    if (cell.table) {
      style = this.view.active_sheet.CellStyleData(address, cell.table.theme || this.theme.table) || {};
    }

    if (cell.merge_area) {

      if ((address.row === cell.merge_area.start.row) &&
        (address.column === cell.merge_area.start.column)) {

        for (let column = cell.merge_area.start.column + 1; column <= cell.merge_area.end.column; column++) {
          width += this.layout.ColumnWidth(column);
        }

        for (let row = cell.merge_area.start.row + 1; row <= cell.merge_area.end.row; row++) {
          height += this.layout.RowHeight(row);
        }

        // get last cell for borders

        if (cell.merge_area.count > 1) {
          const end_cell_style = this.view.active_sheet.CellStyleData(cell.merge_area.end);
          if (end_cell_style) {
            style.border_bottom = end_cell_style.border_bottom;
            style.border_right = end_cell_style.border_right;
            style.border_bottom_fill = end_cell_style.border_bottom_fill;
            style.border_right_fill = end_cell_style.border_right_fill;
          }
        }

        // check if we are going to overflow into another tile right or down

        if (cell.merge_area.end.column > tile.last_cell.column) {
          result.tile_overflow_right = true;
        }

        if (cell.merge_area.end.row > tile.last_cell.row) {
          result.tile_overflow_bottom = true;
        }

        // there's an issue with merges that cross tiles and resizing; they
        // don't get painted properly. we can reuse the overflow record list
        // to fix this.

        // NOTE: this refers to _tile_ overflows, not cell overflows. we
        // should change the name to make this clearer.

        if (result.tile_overflow_bottom || result.tile_overflow_right) {
          this.overflow_areas.push({
            tile,
            head: { ...address },
            area: new Area(cell.merge_area.start, cell.merge_area.end),
          });
        }

      }
      else {
        return {};
      }
    }

    // want to do some surgery here, need to consider any side-effects. 
    
    // specifically, to support hyperlinks, I want to (1) do the text 
    // calculation before calling the cell's render_function (so we can figure 
    // out layout); and (2) let the render function indicate that it does not 
    // want to exit, i.e. it's only a prerender for calc purposes.

    // although that layout calc won't be good enough to account for things
    // like overflow... also here we are just splitting the string, not 
    // generating text boxes (think about justification, wrap)

    // doing this a little differently... render function can pass but can
    // also ask us to preserve layout (text rectangles)

    // let preserve_layout_info = false;
    // let renderer_title: string|undefined;
    // let override_text: string|undefined;

    // ...updating...

    const preserve_layout_info = !!cell.hyperlink;

    if (cell.render_function) {
      this.RenderCellBackground(
        !!cell.note,
        address,
        context, 
        style, 
        width, 
        height);

      context.strokeStyle = context.fillStyle = ResolveThemeColor(this.theme, style.text, 1);

      // there's an issue with theme colors, the function may not be able
      // to translate so we need to update the style (using a copy) to
      // resolve colors

      const apply_style = this.ResolveColors(style);

      const render_result = cell.render_function.call(undefined, {
        width, height, context, cell, style: apply_style, scale: this.layout.scale || 1,
      });

      if (render_result.handled) {
        return result;
      }

      /*
      if (render_result.metrics) {
        preserve_layout_info = true;
      }

      if (render_result.title) {
        renderer_title = render_result.title;
      }
      
      if (typeof render_result.override_text !== 'undefined') {
        override_text = render_result.override_text;
      }
      */

    }

    // if there's no context, we just need to render the background
    // and border; but it still might be overflowed (via merge)

    /*

    this is breaking rendering. not sure if it is because of buffering
    (that doesn't work, below) or because of overflow, but in any event
    it doesn't work. we should fix, or at least jump over any font stuff
    below.

    I suspect it was written at an earlier iteration of the overall render
    routine, and then got out of sync.

    TODO/FIXME

    if (!cell.formatted) {
      this.RenderCellBackground(
        !!cell.note,
        address,
        (result.tile_overflow_bottom || result.tile_overflow_right) ?
          this.buffer_context : context, style, width, height);
      return result;
    }

    */

    // NOTE: this is OK to do in the original context, even if we're
    // (eventually) painting to the buffer context. just remember to set
    // font in the buffer context.

    const base_font = Style.CompositeFont(this.theme.grid_cell_font_size, style, this.layout.scale, this.theme);

    /*
    if (cell.value) {
      console.info(base_font);
    }
      */

    const fonts: FontSet = {
      base: base_font.font,
      strong: Style.CompositeFont(this.theme.grid_cell_font_size, {...style, bold: true}, this.layout.scale, this.theme).font,
      emphasis: Style.CompositeFont(this.theme.grid_cell_font_size, {...style, italic: true}, this.layout.scale, this.theme).font,
      strong_emphasis: Style.CompositeFont(this.theme.grid_cell_font_size, {...style, bold: true, italic: true }, this.layout.scale, this.theme).font,
    };

    if (base_font.variants) {
      tile.style.fontVariant = base_font.variants;
    }
    else {
      tile.style.fontVariant = '';
    }

    context.font = fonts.base;

    //
    // NOTE: we appear to be updating render data on cell size changes 
    // (width/height) to account for line breaks, but that should only
    // be necessary if the text is wrapped -- correct? maybe we can skip
    //
    // (FIXME/TODO)
    //

    if (dirty || !cell.renderer_data || cell.renderer_data.width !== width || cell.renderer_data.height !== height) {
      const text_data = this.PrepText(context, fonts, cell, width);

      cell.renderer_data = { 
        text_data,
        width, 
        height,
      };

    }

    const text_data: PreparedText = cell.renderer_data.text_data as PreparedText;

    // overflow is always a huge headache. here are the basic rules:

    // (1) only strings can overflow. numbers get ### treatment.
    // (2) wrapped and merged cells cannot overflow.
    // (3) overflow is horizontal only.
    // (4) overflow can extend indefinitely.

    // Q: what about DQ?

    const overflow = text_data.width > (width - 2 * this.cell_edge_buffer);

    let paint_right = width;
    let paint_left = 0;

    let clip = false;

    const is_number = (
        cell.type === ValueType.number || 
        cell.calculated_type === ValueType.number ||
        cell.type === ValueType.complex || 
        cell.calculated_type === ValueType.complex ||
        cell.type === ValueType.dimensioned_quantity ||
        cell.calculated_type === ValueType.dimensioned_quantity );

    let horizontal_align = style.horizontal_align;
    if (!horizontal_align) {
      horizontal_align = is_number ? 'right' : 'left'; // Style.HorizontalAlign.Right : Style.HorizontalAlign.Left;
    }

    // NOTE: text rendering options (align, baseline) are set globally
    // when the tile is created, so we don't need to set them repeatedly here.

    // we cache some data for drawing backgrounds under overflows, if necessary,
    // so we can do draw calls after we figure out if we need to buffer or not

    // UPDATE: we have a case where there's a super-long string trying to 
    // render/overflow, and it's breaking everything. we need to address some 
    // caps/limits. WIP.

    const overflow_backgrounds: OverflowCellInfo[] = [];

    if (overflow) {

      const can_overflow = (cell.type !== ValueType.number &&
        cell.calculated_type !== ValueType.number &&
        !style.wrap &&
        !cell.merge_area);

      if (can_overflow) {

        // check how far we want to overflow left and right (pixels)

        // FIXME: should be (buffer * 2), no?

        const delta = text_data.width - width + this.cell_edge_buffer;

        let overflow_pixels_left = 0;
        let overflow_pixels_right = 0;

        if (horizontal_align === 'center' /* Style.HorizontalAlign.Center */ ) {
          overflow_pixels_left = overflow_pixels_right = delta / 2;
        }
        else if (horizontal_align === 'right' /* Style.HorizontalAlign.Right */ ) {
          overflow_pixels_left = delta;
        }
        else {
          overflow_pixels_right = delta;
        }

        // calculate overflow into adjacent columns

        let overflow_right_column = address.column;
        let overflow_left_column = address.column;

        // cap at max. use actual max, not sheet max (which reflects the
        // extent  of spreadsheet data, but not visible cells).

        while (overflow_pixels_right > 0 && overflow_right_column < this.layout.last_column) {
          overflow_right_column++;

          const target_address = { row: address.row, column: overflow_right_column };
          const target_cell = this.view.active_sheet.CellData(target_address);
          const target_width = this.layout.ColumnWidth(overflow_right_column);
          overflow_pixels_right -= target_width;
          if (target_cell && !target_cell.type && !target_cell.calculated_type) {

            overflow_backgrounds.push({
              address: target_address,
              cell: target_cell,
              grid: new Rectangle(paint_right, 0, target_width, height),
              background: new Rectangle(paint_right - 1, 0, target_width, height - 1),
              border: new Rectangle(paint_right, 0, target_width, height),
            });

            paint_right += target_width;

            // set render data for cells we are going to overflow into;
            // that will keep them from getting painted. we only need to
            // do that on the right side.

            target_cell.render_clean[this.view.view_index] = true;
            target_cell.renderer_data = {
              overflowed: true,
            };
          }
          else {

            // we actually don't have to clip to the right, assuming
            // we're going to paint the cells anyway... right?
            // A: not necessarily, because we might not be painting the cell _now_.

            clip = true; // need to clip

            break;
          }
        }

        if (overflow_right_column > tile.last_cell.column) {
          result.tile_overflow_right = true;
        }

        while (overflow_pixels_left > 0 && overflow_left_column >= 1) {
          overflow_left_column--;

          const target_address = { row: address.row, column: overflow_left_column };
          const target_cell = this.view.active_sheet.CellData(target_address);
          const target_width = this.layout.ColumnWidth(overflow_left_column);
          overflow_pixels_left -= target_width;
          if (target_cell && !target_cell.type && !target_cell.calculated_type) {

            paint_left -= target_width;

            overflow_backgrounds.push({
              address: target_address,
              cell: target_cell,
              grid: new Rectangle(paint_left, 0, target_width, height),
              background: new Rectangle(paint_left, 0, target_width, height - 1),
              border: new Rectangle(paint_left, 0, target_width, height),
            });

          }
          else {
            clip = true; // need to clip
            break;
          }
        }

        if (overflow_left_column < tile.first_cell.column) {
          result.tile_overflow_left = true;
        }

        // push overflow onto the list

        this.overflow_areas.push({
          head: { ...address }, tile, area: new Area(
            { row: address.row, column: overflow_left_column },
            { row: address.row, column: overflow_right_column })
        });

      }
      else {

        // don't clip numbers, we are going to ### them

        clip = !is_number; // (cell.type !== ValueType.number && cell.calculated_type !== ValueType.number);

      }

    }

    let buffering = false;

    // now we can render into either the primary context or the buffer
    // context. note we don't have to clip for buffered contexts, as we're
    // going to copy.

    const original_context = context;

    if (result.tile_overflow_bottom || result.tile_overflow_left || result.tile_overflow_right) {

      buffering = true;
      // console.info("buffering", result, {paint_left, paint_right, text_data});

      result.width = paint_right - paint_left;
      result.height = height;
      result.left = paint_left;

      this.EnsureBuffer(result.width + 1, height + 1, -paint_left);

      context = this.buffer_context;
      context.font = fonts.base;

    }

    this.RenderCellBackground(!!cell.note, address, context, style, width, height, cell_left, cell_top);

    // Q: why are we doing this inline instead of using the background method?

    for (const element of overflow_backgrounds) {

      if ( element.cell.style?.fill &&
            IsDefinedColor(element.cell.style.fill) &&
          // (element.cell.style.fill.text || element.cell.style.fill.theme || element.cell.style.fill.theme === 0) &&
          !this.options.grid_over_background) {
        
        context.fillStyle = ResolveThemeColor(this.theme, element.cell.style.fill, 0);
        context.fillRect(element.grid.left, element.grid.top, element.grid.width, element.grid.height);
      }
      else {
        context.fillStyle = this.theme.grid_color || '';
        context.fillRect(element.grid.left, element.grid.top, element.grid.width, element.grid.height);

        if (this.view.active_sheet.image) {
          this.PaintBackgroundImage(
                context, 
                this.view.active_sheet.image,
                cell_left + element.background.left,
                cell_top + element.background.top,
                element.background.width,
                element.background.height,
                element.background.left,
                element.background.top,
                0 );
        }
        else {
          context.fillStyle = this.theme.grid_cell?.fill ? ResolveThemeColor(this.theme, this.theme.grid_cell.fill, 0) : '';
          context.fillRect(element.background.left, element.background.top,
            element.background.width, element.background.height);
        }
      }

      if (element.cell.style) {

        this.RenderCellBorders(element.address, context, element.cell.style,
          element.border.left, element.border.top, element.border.width, element.border.height);
      }

    }
  
    if ((style as ExtendedCelLStyle).databar && height > 7 && width > 9) { // FIXME: buffers

      const db = (style as ExtendedCelLStyle).databar;
      if (db) {

        const margin = { x: 4, y: 3}; // FIXME: parameterize, move out of this function/block
        context.fillStyle = ResolveThemeColor(this.theme, db.fill);

        const bar_top = margin.y;
        const bar_height = height - (margin.y * 2 + 1);
        let bar_left = margin.x;
        let bar_width = 0;

        if (db.zero > 0) {
          bar_left = bar_left + db.zero * (width - (margin.x * 2 + 1));
          if (db.value > db.zero) {
            bar_width = (width - (margin.x * 2 + 1)) * (db.value - db.zero);
          }
          else {

            if (db.negative) {
              context.fillStyle = ResolveThemeColor(this.theme, db.negative);
            }

            bar_width = (width - (margin.x * 2 + 1)) * (db.zero - db.value);
            bar_left -= bar_width;
          }
        } 
        else {
          bar_width = (width - (margin.x * 2 + 1)) * db.value;
        }

        context.fillRect(bar_left, bar_top, bar_width, bar_height);

      }

    }

    // NOTE: we are getting fontmetrics based on the base font (so ignoring italic 
    // and bold variants). this should be OK because we use it for height, mostly.
    // not sure about invisible text (FIXME)

    // const m2 = FontMetricsCache2.Get(fonts.base, // this.theme.grid_cell?.font_size?.value);
    //    this.theme.grid_cell_font_size);


    const m2 = GetFontMetrics(fonts.base, base_font.variants);

    /*
    if (cell.value) {
      console.info(fonts.base, {m2});
    }
    */

    // set stroke for underline

    // FIXME: color here should default to style, not ''. it's working only
    // because our default style happens to be the default color. that applies
    // to text color, background color and border color.

    context.lineWidth = 1; // 1.5; // FIXME: scale? font scale?

    context.strokeStyle = context.fillStyle =
      text_data.format ? text_data.format : ResolveThemeColor(this.theme, style.text, 1);

    context.beginPath();

    let left = this.cell_edge_buffer;

    const line_height = 1; // 1.25;

    //const line_count = text_data.single ? 1 : text_data.strings.length;
    const line_count = text_data.strings.length;
    // const text_height = (line_count * m2.block * line_height);
    const text_height = (line_count * m2.height * line_height);

    // we stopped clipping initially because it was expensive -- but then
    // we were doing it on every cell. it's hard to imagine that clipping
    // is more expensive than buffering (painting to a second canvas and
    // copying). let's test clipping just in the case of unpainted overflow.

    // don't clip if buffering, it's not necessary

    clip = (clip || (text_height >= height)) && !buffering;

    if (clip) {
      context.save();
      context.beginPath();
      context.moveTo(paint_left + 1.5, 0);
      context.lineTo(paint_left + 1.5, height);
      context.lineTo(paint_right - 1.5, height);
      context.lineTo(paint_right - 1.5, 0);
      context.clip();
    }

    // path for underline (and strike). if there's no underline (or strike),
    // it won't do anything.

    context.beginPath();

    let original_baseline = Math.round(
      (height - m2.descent - 2) + // baseline for first line of text
      (-line_height * m2.height * (line_count - 1))); // adjust for multiple lines

    switch (style.vertical_align) {
      case 'top':
        original_baseline = Math.round(2 + m2.ascent);
        break;

      case 'middle': 
        original_baseline = Math.round((height - text_height) / 2 + m2.ascent) - 1.5;

        break;
    }

    if ((style as ExtendedCelLStyle).databar?.hide_values) {
      // ...
    }
    else if ((cell.type === ValueType.number || 
         cell.calculated_type === ValueType.number || 
         cell.type === ValueType.complex || 
         cell.calculated_type === ValueType.complex) && overflow) {

      // number overflow is easy

      const count = Math.floor((width - 2 * this.cell_edge_buffer) / m2.hash);

      let text = '';
      for (let i = 0; i < count; i++) { text += '#'; }
      const text_width = context.measureText(text).width;

      if (horizontal_align === 'center' /* Style.HorizontalAlign.Center */ ) {
        left = Math.round((width - text_width) / 2);
      }
      else if (horizontal_align === 'right' /* Style.HorizontalAlign.Right */ ) {
        left = width - this.cell_edge_buffer - text_width;
      }

      context.fillText(text, left, original_baseline);
      
    }
    else {

      // unifying the old "single" and "!single" branches. now the data is
      // an array of rows, each of which is an array of elements. elements
      // may have different formatting.

      let baseline = original_baseline;
      // let index = 0;

      for (const line of text_data.strings) {

        // FIXME: cache line width

        let line_width = 0;
        for (const part of line) { line_width += part.width; }

        if (horizontal_align === 'center') {
          left = Math.round((width - line_width) / 2);
        }
        else if (horizontal_align === 'right') {
          left = width - this.cell_edge_buffer - line_width;
        }

        // still tinkering with these. surely we need to apply scale? FIXME

        const underline_y = baseline + 2.5;
        const strike_y = Math.floor(baseline - m2.ascent * 1 / 3) + .5;

        let x = left;
        for (const part of line) {

          if (part.strong && part.emphasis) {
            context.font = fonts.strong_emphasis;
          }
          else if (part.strong) {
            context.font = fonts.strong;
          }
          else if (part.emphasis) {
            context.font = fonts.emphasis;
          }
          else {
            context.font = fonts.base;
          }

          if (!part.hidden) {

            if (part.text) {
              // console.info({text: part.text, x, baseline, clip, buffering, text_data});
              context.fillText(part.text, x, baseline);
            }

            if (style.underline) {
              context.moveTo(x, underline_y);
              context.lineTo(x + part.width, underline_y);
            }
            
            if (style.strike || part.strike) {
              context.moveTo(x, strike_y);
              context.lineTo(x + part.width, strike_y);
            }

            // we're putting this inside the test block so
            // that you can't click on hidden text. not sure
            // if it works, though.

            if (preserve_layout_info) {
              part.left = x;
              part.top = baseline - // m2.block;
                m2.ascent;
              part.height = // m2.block;
                m2.height;
            }
  
          }
          
          x += part.width;

        }

        // height tends to be an integer, or maybe at worst 1/2 integer,
        // so stepping is probably ok (we used to index and multiply).

        baseline += line_height * m2.height;


      }


    }

    context.stroke();

    if (clip) {
      context.restore();
    }
    else if (buffering) {
      const scale = this.layout.dpr;
      original_context.drawImage(this.buffer_canvas,
        0, 0, (result.width || 0) * scale,
        height * scale, paint_left, 0, result.width || 0, height);
    }

    return result;

  }

}
