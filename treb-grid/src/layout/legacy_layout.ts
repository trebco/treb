
import { BaseLayout } from './base_layout';
import { Tile } from '../types/tile';
import { DOMUtilities } from '../util/dom_utilities';
import { DataModel } from '../types/data_model';

const SVGNS = 'http://www.w3.org/2000/svg';

export class LegacyLayout extends BaseLayout {

  protected scroller: HTMLElement;
  protected buffer: HTMLElement;

  constructor(model: DataModel) {
    super(model);

    this.scroller = DOMUtilities.CreateDiv('scroller');
    this.buffer = DOMUtilities.CreateDiv('buffer');

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
    // this.grid_selection = document.createElement('canvas');
    this.grid_selection = document.createElementNS(SVGNS, 'svg');
    this.grid_selection.setAttribute('class', 'grid-selection');
    this.contents.appendChild(this.grid_selection);

    // selection node for frozen rows
    this.row_header_selection = document.createElementNS(SVGNS, 'svg');
    this.row_header_selection.setAttribute('class', 'frozen-selection');
    this.column_header.appendChild(this.row_header_selection);

    // ...columns
    this.column_header_selection = document.createElementNS(SVGNS, 'svg');
    this.column_header_selection.setAttribute('class', 'frozen-selection');
    this.row_header.appendChild(this.column_header_selection);

    // ...corner
    this.corner_selection = document.createElementNS(SVGNS, 'svg');
    this.corner_selection.setAttribute('class', 'frozen-selection');
    this.corner.appendChild(this.corner_selection);

    this.grid_cover = DOMUtilities.CreateDiv('tile-cover grid-cover');
    this.column_header_cover = DOMUtilities.CreateDiv('tile-cover column-header-cover');
    this.row_header_cover = DOMUtilities.CreateDiv('tile-cover row-header-cover');

  }

  /* *
   * create a selection so that this node (and parents) receive
   * a copy event on ctrl+c (or any other system copy event).
   * seems to break IE, so split.
   * /
  public MockSelection() {

    // TODO: FIXME

    return;

    / *
    if (!this.container) {
      return;
    }

    // edge handles this differently than chrome/ffx. in edge, the
    // cursor does not move to the end of the selection, which is
    // what we want. so we need to fix that for edge:

    // FIXME: limit to edge (causing problems in chrome? ...)

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(this.mock_selection);
    selection.removeAllRanges();
    selection.addRange(range);

    // selection.collapseToEnd();
    * /

  }
  */

  /** attach node structure to container */
  public InitializeInternal(container: HTMLElement, scroll_callback: () => void) {

    this.container = container;
    this.container.classList.add('legacy-layout');
    this.container.appendChild(this.scroller);
    this.scroller.appendChild(this.buffer);

    this.scroll_reference_node = this.scroller;

    container.appendChild(this.column_header);
    container.appendChild(this.row_header);
    container.appendChild(this.corner);

    container.appendChild(this.contents);
    container.appendChild(this.mock_selection);

    container.appendChild(this.grid_cover);
    container.appendChild(this.column_header_cover);
    container.appendChild(this.row_header_cover);

    this.row_header_cover.style.left = '0px';
    this.column_header_cover.style.top = '0px';

    // bind

    this.scroller.addEventListener('scroll', (event) => {

      event.stopPropagation();
      event.preventDefault();

      const left = this.model.sheet.header_offset.x - this.scroller.scrollLeft;
      const top = this.model.sheet.header_offset.y - this.scroller.scrollTop;

      this.column_header_cover.style.left =
        this.column_header.style.left = `${left}px`;

      this.row_header.style.top =
        this.row_header.style.top = `${top}px`;

      this.contents.style.left = `${left}px`;
      this.contents.style.top = `${top}px`;

      this.row_header_cover.style.top =
        this.grid_cover.style.top =
        `${this.model.sheet.header_offset.y - this.scroller.scrollTop}px`;

      this.column_header_cover.style.left =
        this.grid_cover.style.left =
        `${this.model.sheet.header_offset.x - this.scroller.scrollLeft}px`;

      // eventually
      scroll_callback();

    });

    const PassThroughMouseEvent = (event: MouseEvent) => {

      // don't cache, this rect is live in chrome but not IE11

      const bounding_box = this.scroller.getBoundingClientRect();

      const x = event.clientX - bounding_box.left;
      const y = event.clientY - bounding_box.top;

      // test scrollbar area

      if (x >= this.scroller.clientWidth ||
        y >= this.scroller.clientHeight) {
        return undefined;
      }

      event.stopPropagation();
      event.preventDefault();

      // IE doesn't support cloning events
      // const cloned_event = new MouseEvent(event.type, event);

      const cloned_event = this.CreateMouseEvent(event.type, event);

      if (x < this.model.sheet.header_offset.x) {
        if (y < this.model.sheet.header_offset.y) {
          if (x < 10 && y < 10) {
            // legacy notification
          }
          else {
            // probably select-all
          }
        }
        else {
          this.row_header_cover.dispatchEvent(cloned_event);
        }
      }
      else if (y < this.model.sheet.header_offset.y) {
        this.column_header_cover.dispatchEvent(cloned_event);
      }
      else {
        this.grid_cover.dispatchEvent(cloned_event);
      }

    };

    this.scroller.addEventListener('mousemove', (event: MouseEvent) => PassThroughMouseEvent(event));
    this.scroller.addEventListener('mousedown', (event: MouseEvent) => PassThroughMouseEvent(event));

  }

  public ResizeCursor(resize?: 'row' | 'column') {
    switch (resize) {
      case 'row':
        this.scroller.classList.add('row-resize');
        break;

      case 'column':
        this.scroller.classList.add('col-resize');
        break;

      default:
        this.scroller.classList.remove('row-resize');
        this.scroller.classList.remove('col-resize');
        break;
    }
  }

  protected CreateMouseEvent(eventType: string, params: any = {}) {
    params = params || { bubbles: false, cancelable: false };
    const mouseEvent = document.createEvent('MouseEvent');
    mouseEvent.initMouseEvent(eventType,
      false, // true, // params.bubbles,
      true, // params.cancelable,
      window,
      0,
      params.screenX || 0,
      params.screenY || 0,
      params.clientX || 0,
      params.clientY || 0,
      params.ctrlKey || false,
      params.altKey || false,
      params.shiftKey || false,
      params.metaKey || false,
      params.button || 0,
      params.relatedTarget || null,
    );
    return mouseEvent;
  }

  protected UpdateTileGridPosition(tile: Tile) {

    let left = 0;
    let top = 0;

    if (/frozen-column-tile/.test(tile.className)) {
      left = this.model.sheet.header_offset.x;
    }
    else {
      for (let i = 0; i < tile.tile_position.column; i++) {
        const unit = this.column_header_tiles[i];
        if (unit) {
          left += unit.logical_size.width;
        }
      }
    }

    if (/frozen-row-tile/.test(tile.className)) {
      top = this.model.sheet.header_offset.y;
    }
    else {
      for (let i = 0; i < tile.tile_position.row; i++) {
        const unit = this.row_header_tiles[i];
        if (unit) {
          top += unit.logical_size.height;
        }
      }
    }

    tile.style.left = `${left}px`;
    tile.style.top = `${top}px`;

  }

  protected UpdateContainingGrid() {

    if (!this.container) throw new Error('missing container');

    this.header_size.width = this.model.sheet.header_offset.x;
    this.header_size.height = this.model.sheet.header_offset.y;

    // update the containing grid (layout for column/row headers)

    let x = this.model.sheet.header_offset.x;
    let y = this.model.sheet.header_offset.y;

    if (this.model.sheet.freeze.columns) {
      for (let i = 0; i < this.model.sheet.freeze.columns; i++) x += this.model.sheet.GetColumnWidth(i);
    }
    if (this.model.sheet.freeze.rows) {
      for (let i = 0; i < this.model.sheet.freeze.rows; i++) y += this.model.sheet.GetRowHeight(i);
    }

    this.column_header.style.left = `${this.model.sheet.header_offset.x + this.scroller.scrollLeft}px`;
    this.row_header.style.top = `${this.model.sheet.header_offset.y + this.scroller.scrollTop}px`;

    this.contents.style.left = `${this.model.sheet.header_offset.x + this.scroller.scrollLeft}px`;
    this.contents.style.top = `${this.model.sheet.header_offset.y + this.scroller.scrollTop}px`;

    this.corner_canvas.setAttribute('width', `${this.dpr * x}`);
    this.corner_canvas.setAttribute('height', `${this.dpr * y}`);

    this.corner_canvas.style.width = `${x}px`;
    this.corner_canvas.style.height = `${y}px`;

  }

  protected UpdateGridTemplates(columns = true, rows = true) {

    // selection (new)

    this.grid_selection.style.top = `0px`;
    this.grid_selection.style.left = `0px`;

    // update grids

    if (columns) {

      let left = 0;
      for (let i = 0; i < this.column_header_tiles.length; i++) {
        const column = this.grid_tiles[i];
        const width = this.column_header_tiles[i].logical_size.width;
        for (const tile of column) {
          tile.style.left = `${left}px`;
          tile.style.width = `${width}px`;
        }
        this.column_header_tiles[i].style.left = `${left}px`;
        this.column_header_tiles[i].style.width = `${width}px`;

        left += width;
      }

      this.column_header_cover.style.height =
        `${this.model.sheet.header_offset.y}px`;

      this.column_header_cover.style.left =
        this.grid_cover.style.left =
        `${this.model.sheet.header_offset.x + this.scroller.scrollLeft}px`;

      this.grid_cover.style.width =
        this.grid_selection.style.width =
        this.column_header_cover.style.width =
        this.buffer.style.width = `${left}px`;


    }

    if (rows) {

      let top = 0;
      for (let i = 0; i < this.row_header_tiles.length; i++) {
        const height = this.row_header_tiles[i].logical_size.height;
        for (const column of this.grid_tiles) {
          const tile = column[i];
          if (tile) {
            tile.style.top = `${top}px`;
            tile.style.height = `${height}px`;
          }
        }
        this.row_header_tiles[i].style.top = `${top}px`;
        this.row_header_tiles[i].style.height = `${height}px`;

        top += height;
      }

      this.row_header_cover.style.width =
        `${this.model.sheet.header_offset.x}px`;

      this.row_header_cover.style.top =
        this.grid_cover.style.top =
        `${this.model.sheet.header_offset.y + this.scroller.scrollTop}px`;

      this.grid_cover.style.height =
        this.grid_selection.style.height =
        this.row_header_cover.style.height =
        this.buffer.style.height = `${top}px`;

    }

    let y = this.model.sheet.header_offset.y;
    for (let i = 0; i < this.model.sheet.freeze.rows; i++) {
      y += this.model.sheet.GetRowHeight(i);
    }
    this.row_header_selection.style.display = 'block';
    this.row_header_selection.style.width = this.grid_selection.style.width; // `${width}px`;
    this.corner_selection.style.height =
      this.row_header_selection.style.height = `${y}px`;
    this.corner_selection.style.top =
      this.row_header_selection.style.top = `0px`; // `${this.model.sheet.header_offset.y}px`;
    this.row_header_selection.style.left = `0px`;

    let x = this.model.sheet.header_offset.x;
    for (let i = 0; i < this.model.sheet.freeze.columns; i++) {
      x += this.model.sheet.GetColumnWidth(i);
    }
    this.column_header_selection.style.display = 'block';
    this.corner_selection.style.width =
      this.column_header_selection.style.width = `${x}px`;
    this.column_header_selection.style.height = this.grid_selection.style.height; // `${height}px`;
    this.column_header_selection.style.top = `0px`;
    this.corner_selection.style.left =
      this.column_header_selection.style.left = `0px`; // `${this.model.sheet.header_offset.x}px`;

    this.corner_selection.style.display = 'block';

    /*
    if (this.model.sheet.freeze.rows && this.model.sheet.freeze.columns) {
      this.corner_selection.style.display = 'block';
    }
    else {
      this.corner_selection.style.display = 'none';
    }
    */

  }

}
