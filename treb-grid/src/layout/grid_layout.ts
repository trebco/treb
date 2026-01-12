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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import { BaseLayout } from './base_layout';
import type { Tile } from '../types/tile';
import { DOMContext } from 'treb-base-types';
import type { DataModel, ViewModel } from 'treb-data-model';


/**
 * we used to have two layouts, this one and a legacy layout for IE11.
 * since we dropped that one we could merge this with the base layout
 * class (not strictly necessary, but would be cleaner & easier to follow).
 */
export class GridLayout extends BaseLayout {

  constructor(model: DataModel, view: ViewModel, DOM: DOMContext){
    super(model, view, false, DOM);

    // nodes always exist

    // everything except the selection node and the mouse
    // mask needs to get attached to a container, when it's
    // available

    this.column_header = DOM.Div('treb-top-header');
    this.row_header = DOM.Div('treb-left-header');
    
    this.corner = DOM.Div('treb-corner');
    this.corner_canvas = DOM.Create('canvas');
    this.corner.appendChild(this.corner_canvas);

    this.contents = DOM.Div('treb-contents');
    this.buffer_canvas = DOM.Create('canvas', 'treb-buffer-canvas', this.contents);

    // selection node attached to contents
    this.grid_selection = DOM.SVG('svg', 'treb-grid-selection', this.contents);

    // selection node for frozen rows
    this.row_header_selection = DOM.SVG('svg', ['frozen-selection', 'frozen-selection-rows'], this.column_header);
    this.row_header_annotations = DOM.Div('frozen-annotation-container frozen-annotation-container-rows', this.column_header);

    // ...columns
    this.column_header_selection = DOM.SVG('svg', ['frozen-selection', 'frozen-selection-columns'], this.row_header);
    this.column_header_annotations = DOM.Div('frozen-annotation-container frozen-annotation-container-columns', this.row_header);

    // ...corner
    this.corner_selection = DOM.SVG('svg', 'frozen-selection', this.corner);
    this.corner_annotations = DOM.Div('frozen-annotation-container frozen-annotation-container-corner', this.corner);


    this.annotation_container = DOM.Div('treb-annotation-container');

    this.grid_cover = DOM.Div('tile-cover grid-cover');
    this.column_header_cover = DOM.Div('tile-cover column-header-cover');
    this.row_header_cover = DOM.Div('tile-cover row-header-cover');

  }

  /** attach node structure to container */
  public InitializeInternal(container: HTMLElement, scroll_callback: () => void): void {

    this.container = container;
    // this.container.classList.add('treb-grid-layout');

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

    this.ApplyThemeColors();

  }

  public FocusInLayout(target?: EventTarget): boolean {
    if (target && target instanceof Element && this.container?.contains(target)) {
      return true;
    }
    return false;
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

    if (this.view.active_sheet.freeze.columns) {
      for (let i = 0; i < this.view.active_sheet.freeze.columns; i++) x += this.ColumnWidth(i);
    }
    if (this.view.active_sheet.freeze.rows) {
      for (let i = 0; i < this.view.active_sheet.freeze.rows; i++) y += this.RowHeight(i);
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

  protected UpdateGridTemplates(): void {

    let width = 0;
    let height = 0;

    // update grids

    this.column_header.style.gridTemplateColumns =
    this.contents.style.gridTemplateColumns =
      this.column_header_tiles.map((tile) => {
        width += tile.logical_size.width;
        return `${tile.logical_size.width}px`;
      }).join(' ');

    this.column_header.style.gridTemplateRows = `${this.header_offset.y}px auto`;

    this.row_header.style.gridTemplateRows =
    this.contents.style.gridTemplateRows =
      this.row_header_tiles.map((tile) => {
        height += tile.logical_size.height;
        return `${tile.logical_size.height}px`;
      }).join(' ');

    // frozen selection -- now used for selection highlights
    // as well (moved from render headers)

    let y = this.header_offset.y;
    if (this.view.active_sheet.freeze.rows) {
      // let y = 0;
      for (let i = 0; i < this.view.active_sheet.freeze.rows; i++) {
        y += this.RowHeight(i);
      }
    }

    this.column_header.style.height = `${y}px`;

    this.row_header_selection.style.display = 'block';
    this.row_header_selection.style.width = `${width}px`;
    this.corner_selection.style.height =
      this.row_header_selection.style.height = `${y}px`;
    this.corner_selection.style.top =
      this.row_header_selection.style.top = '0px'; 
    this.row_header_selection.style.left = `0px`;

    let x = this.header_offset.x;
    if (this.view.active_sheet.freeze.columns) {
      for (let i = 0; i < this.view.active_sheet.freeze.columns; i++) {
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

    // --

    const scaled_header = {
      x: this.view.active_sheet.header_offset.x * this.scale,
      y: this.view.active_sheet.header_offset.y * this.scale,
    };

    const freeze = this.view.active_sheet.freeze;
    
    if (freeze.rows && freeze.columns) {
      this.row_header_annotations.style.display = 'block';
      this.column_header_annotations.style.display = 'block';
      this.corner_annotations.style.display = 'block';
    }
    else if (freeze.rows) {
      this.row_header_annotations.style.display = 'block';
      this.column_header_annotations.style.display = 'none';
      this.corner_annotations.style.display = 'none';
    }
    else if (freeze.columns) {
      this.row_header_annotations.style.display = 'none';
      this.column_header_annotations.style.display = 'block';
      this.corner_annotations.style.display = 'none';
    }
    else {
      this.row_header_annotations.style.display = 'none';
      this.column_header_annotations.style.display = 'none';
      this.corner_annotations.style.display = 'none';
    }

    this.row_header_annotations.style.width = `${width}px`;
    this.corner_annotations.style.height = 
      this.row_header_annotations.style.height = `${y - scaled_header.y}px`;
    this.corner_annotations.style.top = 
      this.row_header_annotations.style.top = `${scaled_header.y}px`;

    this.column_header_annotations.style.width =
      this.corner_annotations.style.width = `${x - scaled_header.x}px`;
    this.column_header_annotations.style.height = `${height}px`;
    this.corner_annotations.style.left = 
      this.column_header_annotations.style.left = `${scaled_header.x}px`;

    /*
    // dev
    this.column_header_annotations.style.background = `rgba(255, 0, 0, .2)`;
    this.row_header_annotations.style.background = `rgba(255, 0, 0, .2)`;
    this.corner_annotations.style.background = `rgba(0, 255, 0, .2)`;
    */

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
