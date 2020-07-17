
import { Rectangle, ICellAddress } from 'treb-base-types';
import { BaseLayout } from '../layout/base_layout';
import { ExtendedTheme } from '../types/theme';
import { SVGSelectionBlock, SelectionOffset } from './svg_selection_block';
import { GridSelection } from '../types/grid_selection';
import { HeaderOverlay, Orientation } from './svg_header_overlay';
import { DataModel } from '../types/data_model';

// const SVGNS = 'http://www.w3.org/2000/svg';

export class SelectionRenderer {

  public nub_rectangle: Rectangle = new Rectangle(-1, -1, 0, 0);

  private grid_selections: SVGSelectionBlock[] = [];
  private row_header_selections: SVGSelectionBlock[] = [];
  private column_header_selections: SVGSelectionBlock[] = [];
  private corner_selections: SVGSelectionBlock[] = [];

  private row_overlay!: HeaderOverlay;
  private column_overlay!: HeaderOverlay;
  private corner_row_overlay!: HeaderOverlay;
  private corner_column_overlay!: HeaderOverlay;

  constructor(
      private theme: ExtendedTheme,
      private layout: BaseLayout,
      private model: DataModel,
      private primary_selection: GridSelection,
      // private highlight_selection: GridSelection,
      private additional_selections: GridSelection[]) {

  }

  public Initialize() {

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
   */
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

  /**
   * renders all (primary and additional) selections. selections are painted
   * on a separate canvas which overlays the grid. unlike grid/header layers,
   * the selection canvas is transparent (alpha = true, which is default, so
   * omitted).
   *
   * updated for svg selections. erase is now required, so parameter is removed.
   */
  public RenderSelections(show_primary_selection = true) {

    // this is a dumb way of doing this... it's also error prone,
    // because it needs to track all the function exits (there are
    // two, atm)

    const cache_primary_empty = this.primary_selection.empty;
    if (!show_primary_selection) {
      this.primary_selection.empty = true;
    }

    // temp (we could change the signature and just take an array)
    const aggregate = [this.primary_selection].concat(this.additional_selections);

    this.RenderSelectionGroup(aggregate, this.layout.grid_selection, undefined, undefined, this.grid_selections);

    // this is the layout rect for row/column header highlights (primary selection only)

    let header_selection_rect = new Rectangle(-1, -1, 0, 0);
    if (!this.primary_selection.empty) {
      const area = this.model.active_sheet.RealArea(this.primary_selection.area);
      header_selection_rect =
        this.layout.CellAddressToRectangle(area.start).Combine(
          this.layout.CellAddressToRectangle(area.end));
    }

    // highlight row header (if visible)

    if (!this.primary_selection.empty && this.model.active_sheet.header_offset.y > 2) {
      this.row_overlay.Show(header_selection_rect.left, 0,
        header_selection_rect.width, this.model.active_sheet.header_offset.y);
      this.corner_row_overlay.Show(header_selection_rect.left + this.model.active_sheet.header_offset.x, 0,
        header_selection_rect.width, this.model.active_sheet.header_offset.y);
    }
    else {
      this.row_overlay.Hide();
      this.corner_row_overlay.Hide();
    }

    // highlight column header (if visible)

    if (!this.primary_selection.empty && this.model.active_sheet.header_offset.x > 2) {
      this.column_overlay.Show(0, header_selection_rect.top,
        this.model.active_sheet.header_offset.x, header_selection_rect.height);
      this.corner_column_overlay.Show(0, header_selection_rect.top + this.model.active_sheet.header_offset.y,
        this.model.active_sheet.header_offset.x, header_selection_rect.height);
    }
    else {
      this.column_overlay.Hide();
      this.corner_column_overlay.Hide();
    }

    if (!this.model.active_sheet.freeze.columns && !this.model.active_sheet.freeze.rows) {
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
        (start.row <= this.model.active_sheet.freeze.rows) ||
        (start.row === Infinity));

      visible_column.push(
        (start.column <= this.model.active_sheet.freeze.columns) ||
        (start.column === Infinity));
    }

    for (const {area} of this.additional_selections) {
      visible_row.push(
        (area.start.row <= this.model.active_sheet.freeze.rows) ||
        (area.start.row === Infinity));

      visible_column.push(
        (area.start.column <= this.model.active_sheet.freeze.columns) ||
        (area.start.column === Infinity));
    }

    // selections...

    if (this.model.active_sheet.freeze.rows) {
      this.RenderSelectionGroup(aggregate, this.layout.row_header_selection,
        visible_row, undefined, this.row_header_selections,
        {x: 0, y: this.model.active_sheet.header_offset.y});
    }

    if (this.model.active_sheet.freeze.columns) {
      this.RenderSelectionGroup(aggregate, this.layout.column_header_selection,
        visible_column, undefined, this.column_header_selections,
        {x: this.model.active_sheet.header_offset.x, y: 0});
    }

    if (this.model.active_sheet.freeze.rows && this.model.active_sheet.freeze.columns) {
      this.RenderSelectionGroup(aggregate, this.layout.corner_selection,
        visible_column, visible_row, this.corner_selections, {...this.model.active_sheet.header_offset});
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
      offset?: SelectionOffset) {

    for (let i = 0; i < aggregate.length; i++ ){

      const sheet_match = (!aggregate[i].area.start.sheet_id) ||
        (aggregate[i].area.start.sheet_id === this.model.active_sheet.id);

      if (sheet_match && !aggregate[i].empty && (!visible_a || visible_a[i]) && (!visible_b || visible_b[i])) {
        const block = this.EnsureGridSelectionBlock(node, group, i, offset);
        this.RenderSVGSelection(aggregate[i], block, i);
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
      node.appendChild(selection_block.g);
    }

    if (offset) selection_block.Offset(offset);

    return selection_block;
  }

  private ClampEnd(address: ICellAddress) {

    // NOTE: column/row can be infinity, but min handles that properly

    return {
      row: Math.min(address.row, this.model.active_sheet.rows - 1),
      column: Math.min(address.column, this.model.active_sheet.columns - 1),
    };

  }

  /**
   * testing an SVG selection. index replaces primary; primary is always index 0.
   */
  private RenderSVGSelection(selection: GridSelection, block: SVGSelectionBlock, index = 0) {

    const area = this.model.active_sheet.RealArea(selection.area, true);

    let rect = this.layout.CellAddressToRectangle(area.start);
    if (area.count > 1) {
      rect = rect.Combine(this.layout.CellAddressToRectangle(area.end));
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
      block.SetThemeColor(index - 1);
    }

    // FIXME: with giant selection svg, we should clip the selection rect
    // to visible to prevent giant rects/paths

    // when not showing headers...

    if (rect.top === 0 && this.model.active_sheet.header_offset.y <= 1) {
      rect.top = 1;
      rect.height -= 1;
    }
    if (rect.left === 0 && this.model.active_sheet.header_offset.x <= 1) {
      rect.left = 1;
      rect.width -= 1;
    }

    // don't render if the rect is <= 0 height or width (cells are hidden)

    if (rect.height <= 0 || rect.height <= 0) {
      block.Show(false);
      return;
    }

    // FIXME: this could be wrapped up in one call

    block.SetOutline(rect);

    if (!index) {

      // get the target rect (primary only)

      let target_rect = this.layout.CellAddressToRectangle(selection.target);
      const data = this.model.active_sheet.CellData(selection.target);
      if (data.merge_area) {
        target_rect = this.layout.CellAddressToRectangle(data.merge_area.start);
        target_rect = target_rect.Combine(this.layout.CellAddressToRectangle(data.merge_area.end));
      }

      block.SetFill(target_rect, rect);
      block.SetNub(rect);
    }

    block.Show();

  }

}
