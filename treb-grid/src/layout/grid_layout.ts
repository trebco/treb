
// import { Point } from 'treb-base-types';
import { BaseLayout } from './base_layout';
import { Tile } from '../types/tile';
import { DOMUtilities } from '../util/dom_utilities';
// import { Sheet } from '../types/sheet';
import { DataModel } from '../types/data_model';
// import { tmpl, NodeModel } from 'treb-utils';

const SVGNS = 'http://www.w3.org/2000/svg';

export class GridLayout extends BaseLayout {

  constructor(model: DataModel){
    super(model);

    /*
    const nodes = tmpl`

      <div id='column_header' class='top-header'>
        <svg id='row_header_selection' class='frozen-selection frozen-selection-rows'></svg>
      </div>

      <div id='row_header' class='left-header'>
        <svg id='column_header_selection' class='frozen-selection frozen-selection-columns'></svg>
      </div>

      <div id='corner' class='corner'>
        <canvas id='corner_canvas'></canvas>
        <svg id='corner_selection' class='frozen-selection'></svg>
      </div>

      <div id='contents' class='contents'>
        <svg id='grid_selection' class='grid-selection'></svg>
      </div>

      <div id='annotation_container' class='annotation-container'></div>

      <div id='grid_cover' class='tile-cover grid-cover'></div>
      <div id='column_header_cover' class='tile-cover column-header-cover'></div>
      <div id='row_header_cover' class='tile-cover row-header-cover'></div>

    `;

    this.column_header = nodes.column_header as HTMLDivElement;
    this.row_header = nodes.row_header as HTMLDivElement;
    this.corner = nodes.corner as HTMLDivElement;
    this.corner_canvas = nodes.corner_canvas as HTMLCanvasElement;
    this.contents = nodes.contents as HTMLDivElement;
    this.grid_selection = (nodes.grid_selection as any) as SVGSVGElement;
    this.row_header_selection = (nodes.row_header_selection as any) as SVGSVGElement;
    this.column_header_selection = (nodes.column_header_selection as any) as SVGSVGElement;
    this.corner_selection = (nodes.corner_selection as any) as SVGSVGElement;
    this.annotation_container = nodes.annotation_container as HTMLDivElement;
    this.grid_cover = nodes.grid_cover as HTMLDivElement;
    this.column_header_cover = nodes.column_header_cover as HTMLDivElement;
    this.row_header_cover = nodes.row_header_cover as HTMLDivElement;
    */

    // nodes always exist

    // everything except the selection node and the mouse
    // mask needs to get attached to a container, when it's
    // available

    this.column_header = DOMUtilities.CreateDiv('top-header');
    this.row_header = DOMUtilities.CreateDiv('left-header');
    
    this.corner = DOMUtilities.CreateDiv('corner');
    this.corner_canvas = document.createElement('canvas');
    this.corner.appendChild(this.corner_canvas);

    this.contents = DOMUtilities.CreateDiv('contents');

    // selection node attached to contents
    this.grid_selection = document.createElementNS(SVGNS, 'svg');
    this.grid_selection.classList.add('grid-selection');
    this.contents.appendChild(this.grid_selection);

    // selection node for frozen rows
    this.row_header_selection = document.createElementNS(SVGNS, 'svg');
    this.row_header_selection.classList.add('frozen-selection');
    this.row_header_selection.classList.add('frozen-selection-rows');
    this.column_header.appendChild(this.row_header_selection);

    // ...columns
    this.column_header_selection = document.createElementNS(SVGNS, 'svg');
    this.column_header_selection.classList.add('frozen-selection');
    this.column_header_selection.classList.add('frozen-selection-columns');
    this.row_header.appendChild(this.column_header_selection);

    // ...corner
    this.corner_selection = document.createElementNS(SVGNS, 'svg');
    this.corner_selection.classList.add('frozen-selection');
    this.corner.appendChild(this.corner_selection);

    this.annotation_container = DOMUtilities.CreateDiv('annotation-container');

    this.grid_cover = DOMUtilities.CreateDiv('tile-cover grid-cover');
    this.column_header_cover = DOMUtilities.CreateDiv('tile-cover column-header-cover');
    this.row_header_cover = DOMUtilities.CreateDiv('tile-cover row-header-cover');

  }

  /** attach node structure to container */
  public InitializeInternal(container: HTMLElement, scroll_callback: () => void): void {

    this.container = container;
    this.container.classList.add('grid-layout');

    this.scroll_reference_node = this.container;

    container.appendChild(this.column_header);
    container.appendChild(this.row_header);
    container.appendChild(this.corner);
    container.appendChild(this.contents);
    container.appendChild(this.annotation_container);
    container.appendChild(this.grid_cover);
    container.appendChild(this.column_header_cover);
    container.appendChild(this.row_header_cover);
    container.appendChild(this.mock_selection);

    this.container.addEventListener('scroll', () => scroll_callback());

  }

  public ResizeCursor(resize?: 'row'|'column'): void {
    switch (resize) {
    case 'row':
      this.row_header_cover.classList.add('resize');
      break;
    case 'column':
      this.column_header_cover.classList.add('resize');
      break;
    default:
      this.row_header_cover.classList.remove('resize');
      this.column_header_cover.classList.remove('resize');
      break;
    }
  }

  protected UpdateTileGridPosition(tile: Tile): void {
    tile.style.gridColumn = `${tile.tile_position.column + 1} / ${tile.tile_position.column + 2}`;
    tile.style.gridRow = `${tile.tile_position.row + 1} / ${tile.tile_position.row + 2}`;
  }

  protected UpdateContainingGrid(): void {
    
    if (!this.container) throw new Error('missing container');

    this.header_size.width = this.header_offset.x;
    this.header_size.height = this.header_offset.y;

    // update the containing grid (layout for column/row headers)

    let x = this.header_offset.x;
    let y = this.header_offset.y;

    if (this.model.active_sheet.freeze.columns) {
      for (let i = 0; i < this.model.active_sheet.freeze.columns; i++) x += this.ColumnWidth(i);
    }
    if (this.model.active_sheet.freeze.rows) {
      for (let i = 0; i < this.model.active_sheet.freeze.rows; i++) y += this.RowHeight(i);
    }

    // this.container.style.gridTemplateColumns = `${x}px auto`;
    // this.container.style.gridTemplateRows = `${y}px auto`;
    this.container.style.gridTemplateColumns = `${this.header_offset.x}px auto`;
    this.container.style.gridTemplateRows = `${this.header_offset.y}px auto`;

    this.corner_canvas.setAttribute('width', `${this.dpr * x}`);
    this.corner_canvas.setAttribute('height', `${this.dpr * y}`);

    this.column_header.style.height = `${y}px`;

    this.corner_canvas.style.width = `${x}px`;
    this.corner_canvas.style.height = `${y}px`;

  }

  protected UpdateGridTemplates(columns = true, rows = true): void {

    let width = 0;
    let height = 0;

    // update grids

    this.column_header.style.gridTemplateColumns =
    this.contents.style.gridTemplateColumns =
      this.column_header_tiles.map((tile) => {
        width += tile.logical_size.width;
        return `${tile.logical_size.width}px`;
      }).join(' ');

    this.row_header.style.gridTemplateRows =
    this.contents.style.gridTemplateRows =
      this.row_header_tiles.map((tile) => {
        height += tile.logical_size.height;
        return `${tile.logical_size.height}px`;
      }).join(' ');

    // frozen selection -- now used for selection highlights
    // as well (moved from render headers)

    let y = this.header_offset.y;
    if (this.model.active_sheet.freeze.rows) {
      // let y = 0;
      for (let i = 0; i < this.model.active_sheet.freeze.rows; i++) {
        y += this.RowHeight(i);
      }
    }

    this.row_header_selection.style.display = 'block';
    this.row_header_selection.style.width = `${width}px`;
    this.corner_selection.style.height =
      this.row_header_selection.style.height = `${y}px`;
    this.corner_selection.style.top =
      this.row_header_selection.style.top = '0px'; // `${this.model.sheet.header_offset.y}px`;
    this.row_header_selection.style.left = `0px`;

    let x = this.header_offset.x;
    if (this.model.active_sheet.freeze.columns) {
      for (let i = 0; i < this.model.active_sheet.freeze.columns; i++) {
        x += this.ColumnWidth(i);
      }
    }
    this.column_header_selection.style.display = 'block';
    this.corner_selection.style.width =
      this.column_header_selection.style.width = `${x}px`;
    this.column_header_selection.style.height = `${height}px`;
    this.column_header_selection.style.top = `0px`;
    this.corner_selection.style.left =
      this.column_header_selection.style.left = '0px'; // `${this.model.sheet.header_offset.x}px`;

    this.corner_selection.style.display = 'block';

    /*
    if (this.model.sheet.freeze.rows && this.model.sheet.freeze.columns) {
      this.frozen_corner_selection.style.display = 'block';
    }
    else {
      this.frozen_corner_selection.style.display = 'none';
    }
    */

    // main selection

    this.grid_selection.style.width = `${width}px`;
    this.grid_selection.style.height = `${height}px`;
    this.grid_selection.style.top = `${this.header_offset.y}px`;
    this.grid_selection.style.left = `${this.header_offset.x}px`;

    // annotations

    this.annotation_container.style.width = `${width}px`;
    this.annotation_container.style.height = `${height}px`;
    this.annotation_container.style.top = `${this.header_offset.y}px`;
    this.annotation_container.style.left = `${this.header_offset.x}px`;

  }

}
