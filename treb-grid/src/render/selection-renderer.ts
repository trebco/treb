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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { Theme, Rectangle, ICellAddress } from 'treb-base-types';
import type { BaseLayout } from '../layout/base_layout';
import { SVGSelectionBlock, SelectionOffset } from './svg_selection_block';
import type { GridSelection } from '../types/grid_selection';
import { HeaderOverlay, Orientation } from './svg_header_overlay';
import type { DataModel, ViewModel } from '../types/data_model';

// const SVGNS = 'http://www.w3.org/2000/svg';

export class SelectionRenderer {

  public nub_rectangle: Rectangle = new Rectangle(-1, -1, 0, 0);

  // tmp
  public cached_additional_selections = '';

  private grid_selections: SVGSelectionBlock[] = [];
  private row_header_selections: SVGSelectionBlock[] = [];
  private column_header_selections: SVGSelectionBlock[] = [];
  private corner_selections: SVGSelectionBlock[] = [];

  private row_overlay!: HeaderOverlay;
  private column_overlay!: HeaderOverlay;
  private corner_row_overlay!: HeaderOverlay;
  private corner_column_overlay!: HeaderOverlay;

  constructor(
      private theme: Theme,
      private layout: BaseLayout,
      private model: DataModel,
      private view: ViewModel,
      private primary_selection: GridSelection,
      // private highlight_selection: GridSelection,
      private additional_selections: GridSelection[]) {

  }

  public Initialize(): void {

    // create header overlays

    this.row_overlay =
      new HeaderOverlay(this.theme, this.layout.row_header_selection, Orientation.Horizontal);
    this.column_overlay =
      new HeaderOverlay(this.theme, this.layout.column_header_selection, Orientation.Vertical);
    this.corner_row_overlay =
      new HeaderOverlay(this.theme, this.layout.corner_selection, Orientation.Horizontal);
    this.corner_column_overlay =
      new HeaderOverlay(this.theme, this.layout.corner_selection, Orientation.Vertical);
  }

  /**
   * we cache blocks that have inline style information. if style
   * information updates we will have to flush the cache and rebuild.
   * /
  public Flush() {

    // clean up, then call initialize to reconstruct

    for (const overlay of [
        this.row_overlay,
        this.column_overlay,
        this.corner_row_overlay,
        this.corner_column_overlay,
      ]) {
      overlay.Remove();
    }

    this.Initialize();

    // selections: remove nodes from DOM, if connected, before cleaning up

    for (const group of [
        this.grid_selections,
        this.row_header_selections,
        this.column_header_selections,
        this.corner_selections,
      ]) {
      for (const block of group) {

        // IE11 requires parentNode; seems to work in chrome/ffx,
        // so unify (was originally using parentElement)

        if (block.g.parentNode) {
          block.g.parentNode.removeChild(block.g);
        }
      }
    }

    this.grid_selections = [];
    this.row_header_selections = [];
    this.column_header_selections = [];
    this.corner_selections = [];

  }
  */

  /**
   * renders all (primary and additional) selections. selections are painted
   * on a separate canvas which overlays the grid. unlike grid/header layers,
   * the selection canvas is transparent (alpha = true, which is default, so
   * omitted).
   *
   * updated for svg selections. erase is now required, so parameter is removed.
   * update: add an optional (default true) parameter to re-render additional
   * selections; this will support cache for selections that don't change.
   */
  public RenderSelections(show_primary_selection = true, rerender = true): void {

    // this is a dumb way of doing this... it's also error prone,
    // because it needs to track all the function exits (there are
    // two, atm)

    const cache_primary_empty = this.primary_selection.empty;
    if (!show_primary_selection) {
      this.primary_selection.empty = true;
    }

    // temp (we could change the signature and just take an array)
    const aggregate = [this.primary_selection].concat(this.additional_selections);

    this.RenderSelectionGroup(aggregate, this.layout.grid_selection, undefined, undefined, this.grid_selections, undefined, rerender);

    // this is the layout rect for row/column header highlights (primary selection only)

    let header_selection_rect = new Rectangle(-1, -1, 0, 0);
    if (!this.primary_selection.empty) {
      const area = this.view.active_sheet.RealArea(this.primary_selection.area);
      header_selection_rect =
        this.layout.CellAddressToRectangle(area.start).Combine(
          this.layout.CellAddressToRectangle(area.end));
    }

    // highlight row header (if visible)

    if (!this.primary_selection.empty && this.layout.header_offset.y > 2) {
      this.row_overlay.Show(header_selection_rect.left, 0,
        header_selection_rect.width, this.layout.header_offset.y);
      this.corner_row_overlay.Show(header_selection_rect.left + this.layout.header_offset.x, 0,
        header_selection_rect.width, this.layout.header_offset.y);
    }
    else {
      this.row_overlay.Hide();
      this.corner_row_overlay.Hide();
    }

    // highlight column header (if visible)

    if (!this.primary_selection.empty && this.layout.header_offset.x > 2) {
      this.column_overlay.Show(0, header_selection_rect.top,
        this.layout.header_offset.x, header_selection_rect.height);
      this.corner_column_overlay.Show(0, header_selection_rect.top + this.layout.header_offset.y,
        this.layout.header_offset.x, header_selection_rect.height);
    }
    else {
      this.column_overlay.Hide();
      this.corner_column_overlay.Hide();
    }

    if (!this.view.active_sheet.freeze.columns && !this.view.active_sheet.freeze.rows) {
      this.primary_selection.empty = cache_primary_empty;
      return;
    }

    // check visibility for selections in frozen rows, columns

    const visible_row: boolean[] = [];
    const visible_column: boolean[] = [];

    if (this.primary_selection.empty) {
      visible_row.push(false);
      visible_column.push(false);
    }
    else {
      const start = this.primary_selection.area.start;
      visible_row.push(
        (start.row <= this.view.active_sheet.freeze.rows) ||
        (start.row === Infinity));

      visible_column.push(
        (start.column <= this.view.active_sheet.freeze.columns) ||
        (start.column === Infinity));
    }

    for (const {area} of this.additional_selections) {
      visible_row.push(
        (area.start.row <= this.view.active_sheet.freeze.rows) ||
        (area.start.row === Infinity));

      visible_column.push(
        (area.start.column <= this.view.active_sheet.freeze.columns) ||
        (area.start.column === Infinity));
    }

    // selections...

    if (this.view.active_sheet.freeze.rows) {
      this.RenderSelectionGroup(aggregate, this.layout.row_header_selection,
        visible_row, undefined, this.row_header_selections,
        {x: 0, y: this.layout.header_offset.y});
    }

    if (this.view.active_sheet.freeze.columns) {
      this.RenderSelectionGroup(aggregate, this.layout.column_header_selection,
        visible_column, undefined, this.column_header_selections,
        {x: this.layout.header_offset.x, y: 0});
    }

    if (this.view.active_sheet.freeze.rows && this.view.active_sheet.freeze.columns) {
      this.RenderSelectionGroup(aggregate, this.layout.corner_selection,
        visible_column, visible_row, this.corner_selections, {...this.layout.header_offset});
    }

    this.primary_selection.empty = cache_primary_empty;

  }

  /**
   * render a group of selections, optionally gated on one or two boolean
   * arrays (used to check if the selection is within some bounds)
   */
  private RenderSelectionGroup(
      aggregate: GridSelection[],
      node: SVGElement,
      visible_a: boolean[]|undefined,
      visible_b: boolean[]|undefined,
      group: SVGSelectionBlock[],
      offset?: SelectionOffset,
      rerender = true) {

    for (let i = 0; i < aggregate.length; i++ ){

      const sheet_match = (!aggregate[i].area.start.sheet_id) ||
        (aggregate[i].area.start.sheet_id === this.view.active_sheet.id);

      if (sheet_match && !aggregate[i].empty && (!visible_a || visible_a[i]) && (!visible_b || visible_b[i])) {
        if (rerender || !aggregate[i].rendered) {
          const block = this.EnsureGridSelectionBlock(node, group, i, offset);
          this.RenderSVGSelection(aggregate[i], block, i);
        }
      }
      else {
        if (group[i]) group[i].Show(false);
      }
    }

    for (let i = aggregate.length; i < group.length; i++) {
      if (group[i]) group[i].Show(false);
    }

  }

  /**
   * create or return existing node. supports changing the offset,
   * as that may be variable.
   *
   * FIXME: now that this is in a single method, could inline?
   */
  private EnsureGridSelectionBlock(
      node: SVGElement,
      node_set: SVGSelectionBlock[],
      index: number,
      offset?: SelectionOffset){

    // ensure the selection

    let selection_block: SVGSelectionBlock = node_set[index];
    if (!selection_block) {
      selection_block = new SVGSelectionBlock(!index, this.theme);
      node_set[index] = selection_block;

      if (index) { 
        
        // alternate, should indicate a different way

        // we're adding a node to contain alternate selections just so that
        // we can use 1n, 2n, 3n indexing in CSS... although nth-of-type looks
        // like it might help, it won't. it doesn't mean nth-instance.

        let group: SVGElement = node.querySelector('.alternate-selections') as SVGElement;
        if (!group) {
          group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          group.setAttribute('class', 'alternate-selections');
          node.appendChild(group);
        }
        group?.appendChild(selection_block.g);
      }
      else {
        // primary
        node.appendChild(selection_block.g);
      }

    }

    if (offset) selection_block.Offset(offset);

    return selection_block;
  }

  private ClampEnd(address: ICellAddress) {

    // NOTE: column/row can be infinity, but min handles that properly

    return {
      row: Math.min(address.row, this.view.active_sheet.rows - 1),
      column: Math.min(address.column, this.view.active_sheet.columns - 1),
    };

  }

  /**
   * testing an SVG selection. index replaces primary; primary is always index 0.
   */
  private RenderSVGSelection(selection: GridSelection, block: SVGSelectionBlock, index = 0) {

    const area = this.view.active_sheet.RealArea(selection.area, true);

    let rect = this.layout.CellAddressToRectangle(area.start);
    if (area.count > 1) {
      rect = rect.Combine(this.layout.CellAddressToRectangle(area.end));
    }
    else if (index) {

      // update: select merge areas for alternate selections when single

      const data = this.view.active_sheet.CellData(selection.target);
      if (data.merge_area) {
        rect = this.layout.CellAddressToRectangle(data.merge_area.start);
        rect = rect.Combine(this.layout.CellAddressToRectangle(data.merge_area.end));
      }
    }
    
    // nub select target wants the base rectangle (not offset for tiles)
    // FIXME: parameterize size

    if (!index) {
      this.nub_rectangle = new Rectangle(
        rect.left + rect.width - 6,
        rect.top + rect.height - 6,
        11, 11);
    }
    else {
      // block.SetThemeColor(index - 1);
    }

    // FIXME: with giant selection svg, we should clip the selection rect
    // to visible to prevent giant rects/paths

    // when not showing headers...

    if (rect.top === 0 && this.layout.header_offset.y <= 1) {
      rect.top = 1;
      rect.height -= 1;
    }
    if (rect.left === 0 && this.layout.header_offset.x <= 1) {
      rect.left = 1;
      rect.width -= 1;
    }

    // don't render if the rect is <= 0 height or width (cells are hidden)

    if (rect.height <= 0 || rect.height <= 0) {
      block.Show(false);
      return;
    }

    // FIXME: this could be wrapped up in one call

    block.SetOutline(rect, !!index);

    if (!index) {

      // get the target rect (primary only)

      let target_rect = this.layout.CellAddressToRectangle(selection.target);
      const data = this.view.active_sheet.CellData(selection.target);
      if (data.merge_area) {
        target_rect = this.layout.CellAddressToRectangle(data.merge_area.start);
        target_rect = target_rect.Combine(this.layout.CellAddressToRectangle(data.merge_area.end));
      }

      block.SetFill(target_rect, rect);
      block.SetNub(rect);
    }
    else {
      selection.rendered = true;
    }

    block.Show();

  }

}
