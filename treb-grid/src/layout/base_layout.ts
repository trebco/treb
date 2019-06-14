
import { DOMUtilities } from '../util/dom_utilities';
import { ExtendedTheme } from '../types/theme';
import { DataModel } from '../types/data_model';

import { Tile } from '../types/tile';
import { Point, Extent, Size, Position, Area, CellAddress, Rectangle } from 'treb-base-types';
import { RectangleCache } from './rectangle_cache';

// aliasing Area as TileRange. this seemed like a good idea, initially, because
// it can help clarify the function calls and return values when we "overload"
// area to refer to ranges of tiles.
//
// on the other hand, it seems like it might be error-prone because we can swap
// one for the other pretty easily and typescript won't complain.
//
// a more thorough (and probably over-engineered) way to do this would be to
// define area as a generic, then define it on some arbitrary value. that would
// force separation of all the functions between the two types (I think)

import { Area as TileRange } from 'treb-base-types';
import { Annotation } from '../types/annotation';
export { Area as TileRange } from 'treb-base-types';

export interface TooltipOptions {
  up?: true;
  left?: true;
  text?: string;
  x?: number;
  y?: number;
}

/**
 * layout structure and management functions
 */
export abstract class BaseLayout {

  public column_header!: HTMLDivElement;
  public row_header!: HTMLDivElement;
  public contents!: HTMLDivElement;

  public corner!: HTMLDivElement;
  public corner_canvas!: HTMLCanvasElement; // HTMLDivElement;

  public grid_selection!: SVGElement;

  public grid_cover!: HTMLDivElement;
  public column_header_cover!: HTMLDivElement;
  public row_header_cover!: HTMLDivElement;

  public annotation_container!: HTMLDivElement;

  public mask!: HTMLDivElement;
  public mock_selection!: HTMLDivElement;
  public container?: HTMLElement; // reference to container

  public grid_tiles: Tile[][] = [];
  public column_header_tiles: Tile[] = [];
  public row_header_tiles: Tile[] = [];

  public corner_selection!: SVGElement;
  public row_header_selection!: SVGElement;
  public column_header_selection!: SVGElement;

  public frozen_row_tiles: Tile[] = [];
  public frozen_column_tiles: Tile[] = [];

  public header_size: Size = {width: 0, height: 0};

  /** freeze rows/columns */
  public freeze = { rows: 0, columns: 0 };

  /**
   * NOTE: dpr can probably change, on zoom; but I'm not sure there's
   * an event we can trap for that. it might be necessary to test this
   * periodically.
   */
  public dpr = Math.max(1, self.devicePixelRatio || 1);

  /** separate scale, user-controlled (testing...) */
  // public scale = .75;

  // public get composite_scale() {
  //  return this.dpr * this.scale;
  // }

  /**
   * this is a reference to the node that handles scrolling. it needs
   * to be different for legacy renderer.
   */
  public scroll_reference_node!: HTMLElement;

  /** we have to disable mock selection for IE or it breaks key handling */
  private trident = ((typeof navigator !== 'undefined') &&
    navigator.userAgent && /trident/i.test(navigator.userAgent));

  // private default_tile_size: Size = { width: 600, height: 400 };
  private default_tile_size: Size = { width: 1200, height: 800 };

  private tooltip_state?: 'up'|'left';

  private tooltip!: HTMLDivElement;

  private selection_layout_token?: any;

  private note_node: HTMLDivElement;

  /**
   * cache of lookup rectangles (address -> canvas rect)
   */
  private rectangle_cache = new RectangleCache();

  constructor(protected model: DataModel) {

    // now attaching to node... no longer global
    // actually if we are not in a web component, we might as well
    // use global...

    // can't use global if it's inside a block because of z-stacking
    // contexts; the mask will be under the next sheet. so either
    // global in body, or instance local.

    this.mask = // document.querySelector('.treb-mouse-mask'); // ||
      DOMUtilities.CreateDiv('treb-mouse-mask');
    this.tooltip = // document.querySelector('.treb-tooltip'); // ||
      DOMUtilities.CreateDiv('treb-tooltip');

    this.mock_selection = DOMUtilities.CreateDiv('mock-selection-node');
    this.mock_selection.innerHTML = '&nbsp;';

    this.note_node = // (document.querySelector('.treb-note') ||
      DOMUtilities.CreateDiv('treb-note');

  }

  public HideNote() {
    this.note_node.style.opacity = '0';
  }

  public ShowNote(note: string, address: CellAddress, event?: MouseEvent) {
    this.note_node.textContent = note;

    if (!this.note_node.parentElement) return;

    const note_size = this.note_node.getBoundingClientRect();
    const container = this.note_node.parentElement.getBoundingClientRect();

    const offset = { x: 3, y: 2 };

    const rect = this.OffsetCellAddressToRectangle(address).Shift(
      this.header_size.width, this.header_size.height);

    this.note_node.style.left = (
      container.left + rect.right - this.scroll_reference_node.scrollLeft + offset.x) + 'px';
    this.note_node.style.top = (
      container.top + rect.top - this.scroll_reference_node.scrollTop - note_size.height - offset.y) + 'px';

    this.note_node.style.opacity = '1';
  }

  public UpdateAnnotation(elements: Annotation|Annotation[]) {
    if (!Array.isArray(elements)) elements = [elements];
    for (const annotation of elements) {
      if (annotation.node) {

        // FIXME: merge cells? [...]

        if (annotation.cell_address) {
          let rect = this.CellAddressToRectangle(annotation.cell_address.start);
          if (annotation.cell_address.count > 1) {
            rect = rect.Combine(this.CellAddressToRectangle(annotation.cell_address.end));
          }
          rect = rect.Expand(-1, -1);
          rect.ApplyStyle(annotation.node);
        }
        else if (annotation.rect) {
          annotation.rect.ApplyStyle(annotation.node);
        }
      }
    }
  }

  public AddAnnotation(annotation: Annotation) {
    if (!annotation.node) {
      throw new Error('annotation node missing');
    }
    this.annotation_container.appendChild(annotation.node);
    this.UpdateAnnotation(annotation);
  }

  /**
   * this used to be an abstract method for initializing. we're taking it
   * over to do some additional work post init, and renaming the subclass-specific
   * method (@see InitializeInternal).
   */
  public Initialize(container: HTMLElement, scroll_callback: () => void, scroll = true) {

    if (!this.mask.parentElement) {
      container.appendChild(this.mask);
    }

    if (!this.tooltip.parentElement) {
      container.appendChild(this.tooltip);
    }

    if (!this.note_node.parentElement) {
      console.info('ctr', container);
      container.appendChild(this.note_node);
    }

    this.InitializeInternal(container, scroll_callback);
    if (!scroll && this.scroll_reference_node) {
      this.scroll_reference_node.style.overflow = 'hidden';
    }
  }

  /**
   * do subclass-specific initialization
   */
  public abstract InitializeInternal(container: HTMLElement, scroll_callback: () => void): void;

  /**
   * set resize cursor. this is subclass-specific because it's set on
   * different nodes depending on layout.
   */
  public abstract ResizeCursor(resize?: 'row'|'column'): void;

  /**
   * create a selection so that this node (and parents) receive
   * a copy event on ctrl+c (or any other system copy event).
   * seems to break IE, so split.
   */
  public MockSelection(){

    if (!this.container) {
      return;
    }

    // disable for IE, but leave in legacy renderer because it works
    // in safari/edge. there may be some way to fix IE... although copy
    // events aren't available, so we would have to do the fake-csv thing
    // (which I don't want to do).

    if (this.trident) {
      return;
    }

    // edge handles this differently than chrome/ffx. in edge, the
    // cursor does not move to the end of the selection, which is
    // what we want. so we need to fix that for edge:

    // FIXME: limit to edge (causing problems in chrome? ...)

    const selection = window.getSelection();

    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(this.mock_selection);
      selection.removeAllRanges();
      selection.addRange(range);

      // selection.collapseToEnd();
    }

  }

  /**
   * FIXME: this is public for now but tiles should move into
   * this class, then this method can become private
   */
  public CreateTile(
    classes: string,
    size: Size,
    position: Position,
    first_cell: Position,
    cell_extent: Extent,
    pixel_start: Point,
    parent: HTMLElement,
    mark_dirty = true): Tile {

    const tile = document.createElement('canvas') as Tile;
    tile.setAttribute('class', classes);
    tile.logical_size = size;
    tile.width = size.width * this.dpr;
    tile.height = size.height * this.dpr;

    tile.style.width = `${size.width}px`;
    tile.style.height = `${size.height}px`;

    tile.tile_position = position;
    tile.first_cell = first_cell;

    this.UpdateTileGridPosition(tile);

    tile.last_cell = {
      row: first_cell.row + cell_extent.rows - 1,
      column: first_cell.column + cell_extent.columns - 1,
    };
    tile.pixel_start = pixel_start;
    tile.pixel_end = {
      x: pixel_start.x + size.width,
      y: pixel_start.y + size.height,
    };
    tile.dirty = !!mark_dirty;
    tile.needs_full_repaint = true; // never painted

    parent.appendChild(tile);

    // NOTE re: text rendering. you can't use baseline = top, because that's
    // inconsistent among browsers. in fact of all baselines, the only ones that
    // are even close are alphabetic and bottom -- bottom is slightly different
    // in ffx compared to chrome and edge, but that could be because of different
    // font rendering schemes. alphabetic is the closest, but requires offset for
    // ascender (or descender).

    // actually it looks like there's a 1px difference in bottom baseline...
    // alphabetic is the only one that's consistent.

    // FIXME: why not just offset on a per-browser basis? it might be ugly
    // but it's simpler.

    // for the time being we will use bottom.

    const context = tile.getContext('2d', {alpha: false});

    if (context) {
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';

      // prepaint -- firefox is a little slow so flashes empty tiles sometimes

      context.fillStyle = '#fff'; // FIXME: use theme color
      context.fillRect(0, 0, tile.width, tile.height);
    }

    return tile;

  }

  /**
   * applies theme to nodes, as necessary
   */
  public ApplyTheme(theme: ExtendedTheme){
    this.row_header.style.backgroundColor =
      this.column_header.style.backgroundColor =
      this.corner.style.backgroundColor =
      theme.header_background_color || ''; // this.theme.header_background;

    this.corner.style.borderColor =
      theme.grid_color || ''; // this.theme.header_border_color;
    // this.layout.row_header.style.backgroundColor = this.theme.header_background;
    // this.layout.column_header.style.backgroundColor = this.theme.header_background;

    this.tooltip.style.fontFamily = theme.tooltip_font_face || '';
    this.tooltip.style.fontSize = theme.tooltip_font_size ? `${theme.tooltip_font_size}pt` : '';
    this.tooltip.style.backgroundColor = theme.tooltip_background || '';
    this.tooltip.style.borderColor = theme.tooltip_background || ''; // for arrow
    this.tooltip.style.color = theme.tooltip_color || '';
  }

  public UpdateContentsSize() {

    const height = this.row_header_tiles.reduce((a, tile) => a + tile.logical_size.height, 0);
    const width = this.column_header_tiles.reduce((a, tile) => a + tile.logical_size.width, 0);

    this.column_header.style.width = this.contents.style.width = `${width}px`;
    this.row_header.style.height = this.contents.style.height = `${height}px`;

  }

  /** hides column/row resize tooltip and removes any specific classes */
  public HideTooltip(){
    this.tooltip.style.display = 'none';
    this.tooltip_state = undefined;
    this.tooltip.classList.remove('arrow-up');
    this.tooltip.classList.remove('arrow-left');
  }

  /** show column/row resize tooltip */
  public ShowTooltip(options: TooltipOptions = {}) {
    if (options.up) {
      this.tooltip.classList.add('arrow-up');
      this.tooltip_state = 'up';
    }
    else if (options.left) {
      this.tooltip.classList.add('arrow-left');
      this.tooltip_state = 'left';
    }
    this.tooltip.style.display = 'block';
    this.UpdateTooltip(options);
  }

  public ScrollTo(address: CellAddress){
    const target_rect = this.CellAddressToRectangle(address);
    this.scroll_reference_node.scrollTop = target_rect.top;
    this.scroll_reference_node.scrollLeft = target_rect.left;
  }

  /**
   * scroll address into view, at top-left or bottom-right depending on
   * target and current position. also offsets for frozen rows, columns.
   */
  public ScrollIntoView(address: CellAddress){

    const target_rect = this.CellAddressToRectangle(address);

    const width = this.scroll_reference_node.clientWidth - this.row_header.offsetWidth;
    const height = this.scroll_reference_node.clientHeight - this.column_header.offsetHeight;

    const offset = { x: 0, y: 0 };
    const lock = { x: false, y: false };

    const viewport = new Rectangle(
      this.scroll_reference_node.scrollLeft,
      this.scroll_reference_node.scrollTop,
      width, height);

    // if there are frozen rows/columns, we need to scroll such that the
    // cell is visible outside of the frozen area. but only if we're *outside*
    // the frozen area, because otherwise we're on screen essentially by default.

    if (this.freeze.rows || this.freeze.columns) {
      if (this.freeze.rows && address.row >= this.freeze.rows) {
        offset.y = this.frozen_row_tiles[0].logical_size.height;
      }
      else if (this.freeze.rows) lock.y = true;

      if (this.freeze.columns && address.column >= this.freeze.columns) {
        offset.x = this.frozen_column_tiles[0].logical_size.width;
      }
      else if (this.freeze.columns) lock.x = true;
    }

    // NOTE: in theory it's possible we scroll twice, which would result
    // in two scroll events. however in practice this is called on key events,
    // so it's unlikely.

    if (address.row !== Infinity) {
      if (target_rect.top < viewport.top + offset.y && !lock.y) {
        this.scroll_reference_node.scrollTop = target_rect.top - offset.y;
      }
      else if (target_rect.bottom > viewport.bottom) {
        this.scroll_reference_node.scrollTop = target_rect.bottom - height;
      }
    }

    if (address.column !== Infinity) {
      if (target_rect.left < viewport.left + offset.x && !lock.x) {
        this.scroll_reference_node.scrollLeft = target_rect.left - offset.x;
      }
      else if (target_rect.right > viewport.right) {
        this.scroll_reference_node.scrollLeft = target_rect.right - width;
      }
    }

  }

  public UpdateTooltip(options: TooltipOptions = {}){
    if (typeof options.text !== 'undefined') {
      this.tooltip.textContent = options.text;
    }
    if (typeof options.x !== 'undefined') {
      let x = options.x || 0;
      if (this.tooltip_state === 'up') {
        x -= this.tooltip.offsetWidth / 2;
      }
      this.tooltip.style.left = Math.round(x) + 'px';
    }
    if (typeof options.y !== 'undefined') {
      let y = options.y || 0;
      if (this.tooltip_state === 'left') {
        y -= this.tooltip.offsetHeight / 2;
      }
      this.tooltip.style.top = Math.round(y) + 'px';
    }
  }


  /**
   * y coordinate to row header. for consistency we return an address.
   */
  public CoordinateToRowHeader(y: number): CellAddress {
    const result = { column: Infinity, row: 0 };

    if (this.freeze.rows &&
        this.frozen_row_tiles[0].pixel_end.y >= y - this.scroll_reference_node.scrollTop) {

      let height = 0;
      y -= this.scroll_reference_node.scrollTop;

      for (let i = 0; i < this.freeze.rows; i++ ){
        height += this.model.sheet.RowHeight(i);
        if (height >= y) {
          result.row = i;
          return result;
        }
      }

    }

    for (const tile of this.row_header_tiles) {
      if (tile.pixel_end.y >= y) {

        // now map within the tile
        let top = y - tile.pixel_start.y;
        let height = 0;

        result.row = tile.first_cell.row;
        for (; result.row <= tile.last_cell.row; result.row++ , top -= height) {
          height = this.model.sheet.RowHeight(result.row);
          if (height > top) {
            return result;
          }
        }

        return result;
      }
    }
    return result;

  }

  /**
   * x coordinate to colum header. for consistency we return an address.
   */
  public CoordinateToColumnHeader(x: number): CellAddress {
    const result = { row: Infinity, column: 0 };

    if (this.freeze.columns &&
        this.frozen_column_tiles[0].pixel_end.x >= x - this.scroll_reference_node.scrollLeft) {

      let width = 0;
      x -= this.scroll_reference_node.scrollLeft;

      for (let i = 0; i < this.freeze.columns; i++){
        width += this.model.sheet.ColumnWidth(i);
        if (width >= x) {
          result.column = i;
          return result;
        }
      }

    }

    for (const tile of this.column_header_tiles) {
      if (tile.pixel_end.x >= x) {

        // now map within the tile
        let left = x - tile.pixel_start.x;
        let width = 0;

        result.column = tile.first_cell.column;

        for (; result.column <= tile.last_cell.column; result.column++ , left -= width) {
          width = this.model.sheet.ColumnWidth(result.column);
          if (width > left) return result;
        }

        return result;
      }
    }
    return result;

  }


  /**
   * point to cell address (grid only)
   */
  public PointToAddress_Grid(point: Point, cap_maximum = false): CellAddress {

    // offset for freeze pane

    if (this.freeze.rows) {
      const frozen_height = this.frozen_row_tiles[0].logical_size.height;
      if (point.y - this.scroll_reference_node.scrollTop < frozen_height) {
        point.y -= this.scroll_reference_node.scrollTop;
      }
    }

    if (this.freeze.columns) {
      const frozen_width = this.frozen_column_tiles[0].logical_size.width;
      if (point.x - this.scroll_reference_node.scrollLeft < frozen_width) {
        point.x -= this.scroll_reference_node.scrollLeft;
      }
    }

    const result = { row: 0, column: 0 };

    // find the tile
    // FIXME: can do away with the >= test // <-- what? you mean the other one (<=)?

    for (const column of this.grid_tiles) {
      if (column[0].pixel_start.x <= point.x && column[0].pixel_end.x >= point.x) {
        for (const cell of column) {
          if (cell.pixel_start.y <= point.y && cell.pixel_end.y >= point.y) {

            // now map within the tile
            let left = point.x - cell.pixel_start.x;
            let top = point.y - cell.pixel_start.y;
            let width = 0;
            let height = 0;

            result.row = cell.first_cell.row;
            result.column = cell.first_cell.column;

            for (; result.column <= cell.last_cell.column; result.column++ , left -= width) {
              width = this.model.sheet.ColumnWidth(result.column);
              if (width > left) {
                for (; result.row <= cell.last_cell.row; result.row++ , top -= height) {
                  height = this.model.sheet.RowHeight(result.row);
                  if (height > top) {
                    return result;
                  }
                }
                return result;
              }
            }
          }
        }
        return result;
      }
    }
    return result;

  }

  /**
   * get an adjacent tile. this is used by the renderer when a merge or
   * overflow runs out of the painted tile, and we need to paint it.
   */
  public AdjacentTile(tile: Tile, row_offset = 0, column_offset = 0) {

    if (!row_offset && !column_offset) {
      return tile;
    }

    const position = tile.tile_position;

    const row = tile.tile_position.row + row_offset;
    const column = tile.tile_position.column + column_offset;

    if (row < 0 || column < 0) return undefined;

    // check various stores for match

    if (this.grid_tiles[position.column] && this.grid_tiles[position.column][position.row] === tile) {
      if (this.grid_tiles[column]) return this.grid_tiles[column][row];
    }

    if (!position.column && this.frozen_column_tiles[position.row] === tile) {
      return this.frozen_column_tiles[row];
    }

    if (!position.row && this.frozen_row_tiles[position.column] === tile) {
      return this.frozen_row_tiles[column];
    }

    return undefined;

  }

  public UpdateTiles(){

    // so the new layout uses variable-sized tiles, which are sized
    // to a number of rows/columns (FIXME: nearest to a given size?)
    // that way we don't have to worry about overlap, and resizing
    // is much easier.

    // note that this doesn't mean there isn't overlapping rendering,
    // because there will be on merges.

    if (!this.container) throw new Error('invalid container');

    // flush... FIXME: why not reuse? maybe more trouble than it's worth?

    this.grid_tiles.forEach((arr) => {
      arr.forEach((tile) => {
        if (tile.parentElement){
          tile.parentElement.removeChild(tile);
        }
      });
    });

    for (const tileset of [
        this.column_header_tiles,
        this.row_header_tiles,
        this.frozen_row_tiles,
        this.frozen_column_tiles,
      ]) {
      for (const tile of tileset) {
        if (tile.parentElement) {
          tile.parentElement.removeChild(tile);
        }
      }
    }

    /*
    this.column_header_tiles.forEach((tile) => {
      if (tile.parentElement) {
        tile.parentElement.removeChild(tile);
      }
    });

    this.row_header_tiles.forEach((tile) => {
      if (tile.parentElement) {
        tile.parentElement.removeChild(tile);
      }
    });
    */

    this.frozen_row_tiles = [];
    this.frozen_column_tiles = [];
    this.row_header_tiles = [];
    this.column_header_tiles = [];
    this.grid_tiles = [];

    this.UpdateContainingGrid();

    let rows = this.model.sheet.rows;
    let columns = this.model.sheet.columns;

    if (!rows) rows = 100;
    if (!columns) columns = 40;

    // get total size of the grid from sheet

    let total_height = this.model.sheet.total_height;
    let total_width = this.model.sheet.total_width;

    // console.info('total size:', total_width, ', ', total_height);

    if (!total_height) total_height = this.model.sheet.default_row_height * rows;
    if (!total_width) total_width = this.model.sheet.default_column_width * columns;

    if (this.container.offsetWidth > total_width){
      const add_columns = Math.ceil((this.container.offsetWidth - total_width) /
      this.model.sheet.default_column_width);
      total_width += add_columns * this.model.sheet.default_column_width;
      columns += add_columns;
    }

    if (this.container.offsetHeight > total_height){
      const add_rows = Math.ceil((this.container.offsetHeight - total_height) /
        this.model.sheet.default_row_height);
      total_height += add_rows * this.model.sheet.default_row_height;
      rows += add_rows;
    }

    // console.info(this.container.offsetWidth, this.container.offsetHeight)
    // console.info('total size:', total_width, ', ', total_height);

    // update node sizes to match

    this.column_header.style.width = this.contents.style.width = `${total_width}px`;
    this.row_header.style.height = this.contents.style.height = `${total_height}px`;

    // generate a set of tiles given an approximate target size.
    // keep track of the tile width/height and the starting column/row.

    // rows:

    const tile_widths: number[] = [];
    const tile_columns: number[] = [];

    let tile_width = 0;
    let tile_column = 0;

    for (let c = 0; c < columns; c++){
      const column_width = this.model.sheet.ColumnWidth(c);
      if (tile_width && tile_width + column_width > this.default_tile_size.width){

        // push and move to the next tile, starting with this column
        tile_widths.push(tile_width);
        tile_columns.push(tile_column);

        // for the next one, start here
        tile_column = c;
        tile_width = 0;
      }
      tile_width += column_width;
    }

    // last one
    tile_widths.push(tile_width);
    tile_columns.push(tile_column);

    // columns:

    const tile_heights: number[] = [];
    const tile_rows: number[] = [];

    let tile_height = 0;
    let tile_row = 0;

    for (let r = 0; r < rows; r++){
      const row_height = this.model.sheet.RowHeight(r);
      if (tile_height && tile_height + row_height > this.default_tile_size.height){
        tile_heights.push(tile_height);
        tile_rows.push(tile_row);

        tile_height = 0;
        tile_row = r;
      }
      tile_height += row_height;
    }

    tile_heights.push(tile_height);
    tile_rows.push(tile_row);

    // now create tiles and set metadata

    const column_tile_count = tile_widths.length;
    const row_tile_count = tile_heights.length;

    let pixel_y = 0;
    let pixel_x = 0;

    let header_height = 0;
    let header_width = 0;

    for (let i = 0; i < this.freeze.rows; i++) {
      header_height += this.model.sheet.RowHeight(i);
    }
    for (let i = 0; i < this.freeze.columns; i++) {
      header_width += this.model.sheet.ColumnWidth(i);
    }

    for (let c = 0; c < column_tile_count; c++ ) {
      const column: Tile[] = [];

      pixel_y = 0; // reset

      const column_extent = (c === column_tile_count - 1) ?
        columns - tile_columns[c] :
        tile_columns[c + 1] - tile_columns[c];

      // create a column header tile for this column
      this.column_header_tiles.push(this.CreateTile('column-header-tile',
        {height: this.model.sheet.header_offset.y, width: tile_widths[c]},
        {row: 0, column: c},
        {row: 0, column: tile_columns[c]},
        {rows: 0, columns: column_extent},
        {x: pixel_x, y: 0},
        this.column_header));

      // also frozen
      if (this.freeze.rows) {
        this.frozen_row_tiles.push(this.CreateTile('frozen-row-tile',
          {height: header_height, width: tile_widths[c]},
          {row: 1, column: c},
          {row: 0, column: tile_columns[c]},
          {rows: 0, columns: column_extent},
          {x: pixel_x, y: 0},
          this.column_header));
      }
      
      // loop over rows
      for (let r = 0; r < row_tile_count; r++){

        const row_extent = (r === row_tile_count - 1) ?
          rows - tile_rows[r] :
          tile_rows[r + 1] - tile_rows[r];

        // first column, create header
        if (!c){
          this.row_header_tiles.push(this.CreateTile('row-header-tile',
            {height: tile_heights[r], width: this.model.sheet.header_offset.x},
            {row: r, column: 0},
            {row: tile_rows[r], column: 0}, // first cell
            {rows: row_extent, columns: 1},
            {x: 0, y: pixel_y},
            this.row_header));

          // also frozen
          if (this.freeze.columns) {
            this.frozen_column_tiles.push(this.CreateTile('frozen-column-tile',
            {height: tile_heights[r], width: header_width},
            {row: r, column: 1},
            {row: tile_rows[r], column: 0},
            {rows: row_extent, columns: 1},
            {x: 0, y: pixel_y},
            this.row_header));
          }
        }

        column.push(this.CreateTile('grid-tile',
          {height: tile_heights[r], width: tile_widths[c]}, // tile size in pixels
          {row: r, column: c }, // grid position
          {row: tile_rows[r], column: tile_columns[c]}, // first cell
          {rows: row_extent, columns: column_extent}, // extent
          {x: pixel_x, y: pixel_y},
          this.contents));

        pixel_y += tile_heights[r];

      }
      this.grid_tiles.push(column);

      pixel_x += tile_widths[c];

    }

    this.rectangle_cache.Clear();
    this.UpdateGridTemplates(true, true);

  }

  /**
   * returns the tile index for a given column. this is used to map
   * a column to a tile in either the header or the grid.
   * FIXME: speed up w/ lookup cache
   */
  public TileIndexForColumn(column: number){
    for (const tile of this.column_header_tiles) {
      if (tile.first_cell.column <= column && tile.last_cell.column >= column) {
        return tile.tile_position.column;
      }
    }
    return -1;
  }

  /**
   * returns the tile index for a given row. this is used to map
   * a column to a tile in either the header or the grid.
   * FIXME: speed up w/ lookup cache
   */
  public TileIndexForRow(row: number){
    for (const tile of this.row_header_tiles) {
      if (tile.first_cell.row <= row && tile.last_cell.row >= row) {
          return tile.tile_position.row;
      }
    }
    return -1;
  }

  /**
   * marks header tiles as dirty, for next repaint call
   *
   * UPDATE fix for entire column/row/sheet (the Intersects() method
   * doesn't support infinities, for some reason: FIX THAT)
   */
  public DirtyHeaders(area?: Area) {

    if (!area) return;

    // FIXME: visible only?
    // why, who cares? render should be based on visible, not dirty

    for (const tile of this.column_header_tiles) {
      if (tile.dirty) continue;
      const test: Area = new Area(
        {row: area.start.row, column: tile.first_cell.column},
        {row: area.start.row, column: tile.last_cell.column},
        );
      if (area.entire_row || test.Intersects(area)) {
        tile.dirty = true;
      }
    }

    for (const tile of this.row_header_tiles) {
      if (tile.dirty) continue;
      const test: Area = new Area(
        {column: area.start.column, row: tile.first_cell.row},
        {column: area.start.column, row: tile.last_cell.row},
        );
      if (area.entire_column || test.Intersects(area)) {
        tile.dirty = true;
      }
    }

  }

  public DirtyAll(){
    for (const column of this.grid_tiles) {
      for (const tile of column) {
        tile.dirty = true;
      }
    }
  }

  public DirtyArea(area: Area){

    const start = {row: 0, column: 0};
    const end = {row: this.grid_tiles[0].length - 1, column: this.grid_tiles.length - 1};

    if (area.start.column !== Infinity){
      start.column = end.column = this.TileIndexForColumn(area.start.column);
      if (area.end.column !== area.start.column) end.column = this.TileIndexForColumn(area.end.column);
    }
    if (area.start.row !== Infinity){
      start.row = end.row = this.TileIndexForRow(area.start.row);
      if (area.end.row !== area.start.row) end.row = this.TileIndexForRow(area.end.row);
    }
    for (let column = start.column; column <= end.column; column++){
      for (let row = start.row; row <= end.row; row++){
        this.grid_tiles[column][row].dirty = true;
      }
    }

  }

  /**
   * returns the current render area, as grid area. this may be larger than
   * the visible area, because we are doing some offscreen rendering.
   */
  public RenderArea(tile_range?: TileRange): Area {

    if (!tile_range) {
      tile_range = this.VisibleTiles();
    }

    const first = this.grid_tiles[tile_range.start.column][tile_range.start.row];
    const last = this.grid_tiles[tile_range.end.column][tile_range.end.row];

    return new Area({
      row: first.first_cell.row, column: first.first_cell.column }, {
      row: last.last_cell.row, column: last.last_cell.column });

  }

  /** calculate first visible tile based on scroll position */
  public VisibleTiles(): TileRange {

    const tiles: Position[] = [{ row: 0, column: 0 }, { row: 0, column: 0 }];
    if (!this.container || !this.grid_tiles.length || !this.grid_tiles[0].length) {
      return new TileRange(tiles[0], tiles[1]); // too much?
    }

    const left = this.scroll_reference_node.scrollLeft;
    const right = left + this.scroll_reference_node.offsetWidth;
    const top = this.scroll_reference_node.scrollTop;
    const bottom = top + this.scroll_reference_node.offsetHeight;

    for (const column of this.grid_tiles) {
      let cell = column[0];
      if (cell.pixel_start.x <= left && cell.pixel_end.x >= left) {
        for (cell of column) {
          if (cell.pixel_start.y <= top && cell.pixel_end.y >= top) {
            tiles[0] = cell.tile_position;
            break;
          }
        }
      }
      if (column === this.grid_tiles[this.grid_tiles.length - 1] ||
        cell.pixel_start.x <= right && cell.pixel_end.x >= right) {
        for (cell of column) {
          if (cell === column[column.length - 1] ||
            cell.pixel_start.y <= bottom && cell.pixel_end.y >= bottom) {
            tiles[1] = cell.tile_position;
            // return tiles;
            return new TileRange(tiles[0], tiles[1]); // too much?
          }
        }
      }
    }

    // return tiles;
    return new TileRange(tiles[0], tiles[1]); // too much?

  }

  public UpdateTileHeights(mark_dirty = true, start_row = -1) {

    let y = 0;

    for (let i = 0; i < this.row_header_tiles.length; i++ ){
      const tile = this.row_header_tiles[i];
      // const column = this.grid_tiles[i];

      if (start_row > tile.last_cell.row) {
        y += tile.logical_size.height;
        continue;
      }

      let height = 0;

      for (let r = tile.first_cell.row; r <= tile.last_cell.row; r++){
        height += this.model.sheet.RowHeight(r);
      }

      const height_match = (tile.logical_size.height === height);

      tile.pixel_start.y = y;
      y += height;
      tile.pixel_end.y = y;

      if (!height_match){

        tile.logical_size.height = height;
        tile.style.height = `${height}px`;
        tile.height = this.dpr * height;

        if (this.freeze.columns) {
          const frozen_tile = this.frozen_column_tiles[i];
          frozen_tile.logical_size.height = height;
          frozen_tile.style.height = `${height}px`;
          frozen_tile.height = this.dpr * height;
        }

        if (mark_dirty) {
          tile.dirty = true;
          tile.needs_full_repaint = true;
        }
      }

      for (const column of this.grid_tiles){
        const grid_tile = column[i];

        grid_tile.pixel_start.y = tile.pixel_start.y;
        grid_tile.pixel_end.y = tile.pixel_end.y;

        if (!height_match) {

          grid_tile.logical_size.height = height;
          grid_tile.style.height = `${height}px`;
          grid_tile.height = this.dpr * height;

          if (mark_dirty) {
            grid_tile.dirty = true;
            grid_tile.needs_full_repaint = true;
          }
        }
      }

    }

    if (this.freeze.rows) {
      let freeze_height = 0;
      for (let i = 0; i < this.freeze.rows; i++) freeze_height += this.model.sheet.RowHeight(i);
      for (const tile of this.frozen_row_tiles) {
        tile.style.height = `${freeze_height}px`;
        tile.height = freeze_height * this.dpr;
      }

      // corner includes header size
      freeze_height += this.model.sheet.header_offset.y;
      this.corner_canvas.style.height = `${freeze_height}px`;
      this.corner_canvas.height = freeze_height * this.dpr;

      // mark these as dirty so we get painted
      for (const column of this.grid_tiles) {
        column[0].dirty = true;
      }

    }

    this.UpdateGridTemplates(false, true);

    this.row_header.style.height = this.contents.style.height = `${y}px`;
    this.rectangle_cache.Clear();

  }

  /**
   * update all widths. start_column is a hint that can save some work
   * by skipping unaffected tiles
   */
  public UpdateTileWidths(mark_dirty = true, start_column = -1) {

    let x = 0;

    for (let i = 0; i < this.column_header_tiles.length; i++ ){
      const tile = this.column_header_tiles[i];
      const column = this.grid_tiles[i];

      if (start_column > tile.last_cell.column) {
        x += tile.logical_size.width;
        continue;
      }

      let width = 0;

      for (let c = tile.first_cell.column; c <= tile.last_cell.column; c++){
        width += this.model.sheet.ColumnWidth(c);
      }

      const width_match = (tile.logical_size.width === width);

      tile.pixel_start.x = x;
      x += width;
      tile.pixel_end.x = x;

      if (!width_match){

        tile.logical_size.width = width;
        tile.style.width = `${width}px`;
        tile.width = this.dpr * width;

        if (this.freeze.rows) {
          const frozen_tile = this.frozen_row_tiles[i];
          frozen_tile.logical_size.width = width;
          frozen_tile.style.width = `${width}px`;
          frozen_tile.width = this.dpr * width;
        }

        if (mark_dirty) {
          tile.dirty = true;
          tile.needs_full_repaint = true;
        }
      }

      for (const grid_tile of column){

        grid_tile.pixel_start.x = tile.pixel_start.x;
        grid_tile.pixel_end.x = tile.pixel_end.x;

        if (!width_match) {

          grid_tile.logical_size.width = width;
          grid_tile.style.width = `${width}px`;
          grid_tile.width = this.dpr * width;

          if (mark_dirty) {
            grid_tile.dirty = true;
            grid_tile.needs_full_repaint = true;
          }
        }

      }

    }

    if (this.freeze.columns) {
      let freeze_width = 0;
      for (let i = 0; i < this.freeze.columns; i++) freeze_width += this.model.sheet.ColumnWidth(i);
      for (const tile of this.frozen_column_tiles) {
        tile.style.width = `${freeze_width}px`;
        tile.width = freeze_width * this.dpr;
      }

      // corner includes header size
      freeze_width += this.model.sheet.header_offset.x;
      this.corner_canvas.style.width = `${freeze_width}px`;
      this.corner_canvas.width = freeze_width * this.dpr;

      // mark these as dirty so we get painted
      for (const tile of this.grid_tiles[0]) {
        tile.dirty = true;
      }

    }

    this.UpdateGridTemplates(true, false);

    this.column_header.style.width = this.contents.style.width = `${x}px`;

    this.rectangle_cache.Clear();

  }

  /**
   * wrapper method for CellAddressToRectangle allows us to offset for
   * frozen rows/columns. in some cases we may not want to do this, so
   * the underlying method is still visible (and cache contains the raw
   * rectangles, not offset).
   */
  public OffsetCellAddressToRectangle(address: CellAddress): Rectangle {

    let rect = this.CellAddressToRectangle(address);

    if (address.column >= 0 && address.column < this.freeze.columns) {
      rect = rect.Shift(this.scroll_reference_node.scrollLeft, 0);
    }
    if (address.row >= 0 && address.row < this.freeze.rows) {
      rect = rect.Shift(0, this.scroll_reference_node.scrollTop);
    }

    return rect;

  }

  /**
   * finds the rectangle, in the coordinate space of the grid node,
   * of the cell with the given address. uses a cache since we wind
   * up looking up the same rectangles a lot.
   */
  public CellAddressToRectangle(address: CellAddress): Rectangle {

    // limit. create a working object

    const clone = {row: address.row, column: address.column};
    if (clone.row === Infinity) clone.row = 0;
    if (clone.column === Infinity) clone.column = 0;

    let rect = this.rectangle_cache.Get(clone.column, clone.row);
    if (rect) { return rect; }

    rect = new Rectangle();

    // find the tile
    for (const column of this.grid_tiles) {
      if (column[0].last_cell.column >= clone.column) {
        for (const cell of column) {
          if (cell.last_cell.row >= clone.row ){

            // offset to top of tile
            rect.left = cell.pixel_start.x;
            rect.top = cell.pixel_start.y;

            // offset to cell
            for (let c = cell.first_cell.column; c < clone.column; c++){
              rect.left += this.model.sheet.ColumnWidth(c);
            }
            for (let r = cell.first_cell.row; r < clone.row; r++){
              rect.top += this.model.sheet.RowHeight(r);
            }

            rect.width = this.model.sheet.ColumnWidth(clone.column);
            rect.height = this.model.sheet.RowHeight(clone.row);

            this.rectangle_cache.Set(clone.column, clone.row, rect);

            return rect;
          }
        }
        return rect;
      }
    }
    return rect;

  }

  /**
   * resizes the tile at this index, rebuilds structure of subsequent tiles.
   * this is necessary because tiles keep track of pixel position: so if a
   * tile is resized, subsequent tiles have to change.
   */
  public ResizeTileWidth(index: number, width: number, mark_dirty = true) {

    // start with headers...

    let tile = this.column_header_tiles[index];
    const delta = width - tile.logical_size.width;

    tile.logical_size.width = width;
    tile.style.width = `${width}px`;
    tile.width = this.dpr * width;
    tile.pixel_end.x += delta;

    if (mark_dirty) {
      tile.dirty = true;
      tile.needs_full_repaint = true;
    }

    for (let i = index + 1; i < this.column_header_tiles.length; i++){
      this.column_header_tiles[i].pixel_start.x += delta;
      this.column_header_tiles[i].pixel_end.x += delta;

      for (const cell of this.grid_tiles[i]){
        cell.pixel_start.x += delta;
        cell.pixel_end.x += delta;
      }

    }

    const column = this.grid_tiles[index];
    for (tile of column) {
      tile.logical_size.width = width;
      tile.style.width = `${width}px`;
      tile.width = this.dpr * width;
      tile.pixel_end.x += delta;
      if (mark_dirty) {
        tile.dirty = true;
        tile.needs_full_repaint = true;
      }
    }

    this.UpdateGridTemplates(true, false);
    this.UpdateContentsSize();

  }

  /**
   * resizes the tile at this index, rebuilds structure of subsequent tiles
   */
  public ResizeTileHeight(index: number, height: number, mark_dirty = true) {

    // start with headers...

    let tile = this.row_header_tiles[index];
    const delta = height - tile.logical_size.height;

    tile.logical_size.height = height;
    tile.style.height = `${height}px`;
    tile.height = this.dpr * height;
    tile.pixel_end.y += delta;

    if (mark_dirty) {
      tile.dirty = true;
      tile.needs_full_repaint = true;
    }

    for (let r = index + 1; r < this.row_header_tiles.length; r++){
      tile = this.row_header_tiles[r];
      tile.pixel_start.y += delta;
      tile.pixel_end.y += delta;
    }

    for (const column of this.grid_tiles){
      tile = column[index];
      tile.logical_size.height = height;
      tile.style.height = `${height}px`;
      tile.height = this.dpr * height;
      tile.pixel_end.y += delta;
      if (mark_dirty) {
        tile.dirty = true;
        tile.needs_full_repaint = true;
      }

      for (let i = index + 1; i < column.length; i++){
        column[i].pixel_start.y += delta;
        column[i].pixel_end.y += delta;
      }
    }

    this.UpdateGridTemplates(false, true);
    this.UpdateContentsSize();

  }

  protected abstract UpdateTileGridPosition(tile: Tile): void;
  protected abstract UpdateContainingGrid(): void;
  protected abstract UpdateGridTemplates(columns: boolean, rows: boolean): void;

}
