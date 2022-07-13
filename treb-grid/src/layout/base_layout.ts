/**
 * 
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

import { DOMUtilities } from '../util/dom_utilities';
import type { DataModel, ViewModel } from '../types/data_model';

import type { Tile } from '../types/tile';
import { Style, Theme, Point, Extent, Size, Position, Area, ICellAddress, Rectangle, ThemeColor } from 'treb-base-types';

import { MouseDrag } from '../types/drag_mask';
import type { GridEvent } from '../types/grid_events';

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

import { Area as TileRange, CellValue, AnnotationLayout, Corner } from 'treb-base-types';
import type { Annotation } from '../types/annotation';

export { Area as TileRange } from 'treb-base-types';

const SVGNS = 'http://www.w3.org/2000/svg';

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

  public buffer_canvas!: HTMLCanvasElement;

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

  public corner_annotations!: HTMLDivElement;
  public row_header_annotations!: HTMLDivElement;
  public column_header_annotations!: HTMLDivElement;

  public frozen_row_tiles: Tile[] = [];
  public frozen_column_tiles: Tile[] = [];

  public header_size: Size = { width: 0, height: 0 };

  /**
   * last rendered column. this is used to calculate the limits of
   * cell overflows, which may exceed actual data in the sheet.
   */
  public last_column = 0;

  public total_height = 0;
  public total_width = 0;

  public default_row_height = 0;
  public default_column_width = 0;
  public header_offset = {
    x: 0, y: 0,
  };

  /** freeze rows/columns */
  // public freeze = { rows: 0, columns: 0 };

  /**
   * NOTE: dpr can probably change, on zoom; but I'm not sure there's
   * an event we can trap for that. it might be necessary to test this
   * periodically.
   */
  public dpr = Math.max(1, self.devicePixelRatio || 1);

  /** separate scale, user-controlled (testing...) */
  public scale = 1;

  /**
   * this is a reference to the node that handles scrolling. it needs
   * to be different for legacy renderer.
   */
  public scroll_reference_node!: HTMLElement;

  public get scroll_offset(): { x: number, y: number } {
    if (!this.scroll_reference_node) {
      return { x: 0, y: 0 };
    }
    return {
      x: this.scroll_reference_node.scrollLeft,
      y: this.scroll_reference_node.scrollTop,
    };
  }

  public set scroll_offset(offset: { x: number; y: number }) {
    if (!this.scroll_reference_node) {
      return;
    }
    this.scroll_reference_node.scrollLeft = offset.x;
    this.scroll_reference_node.scrollTop = offset.y;
  }

  protected dropdown_caret: SVGSVGElement;

  /** we have to disable mock selection for IE or it breaks key handling */
  private trident = ((typeof navigator !== 'undefined') &&
    navigator.userAgent && /trident/i.test(navigator.userAgent));

  // private default_tile_size: Size = { width: 600, height: 400 };
  private default_tile_size: Size = { width: 1200, height: 800 };

  private tooltip_state?: 'up' | 'left';

  private tooltip: HTMLDivElement;

  private dropdown_list: HTMLDivElement;
  private dropdown_caret_visible = false;
  private dropdown_callback?: (value: CellValue) => void;
  private dropdown_selected?: HTMLElement;

  // private selection_layout_token?: any;

  // private error_highlight: HTMLDivElement;
  // private error_highlight_timeout?: any;

  private note_node: HTMLDivElement;

  private title_node: HTMLDivElement;

  private row_cache: number[] = [];
  private column_cache: number[] = [];

  /**
   * flag so we don't try to paint before we have tiles
   */
  private initialized = false;


  constructor(protected model: DataModel, protected view: ViewModel) {

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

    // this.error_highlight = DOMUtilities.CreateDiv('treb-error-highlight');

    this.dropdown_caret = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
    this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret');
    this.dropdown_caret.setAttribute('viewBox', '0 0 24 24');
    this.dropdown_caret.tabIndex = -1;

    const caret = document.createElementNS(SVGNS, 'path');
    caret.setAttribute('d', 'M5,7 L12,17 L19,7');
    this.dropdown_caret.appendChild(caret);

    this.dropdown_caret.addEventListener('click', (event) => {

      event.stopPropagation();
      event.preventDefault();

      this.grid_cover.classList.remove('nub-select');

      // the classList polyfill doesn't apply to svg elements (not sure
      // if that's an oversight, or IE11 just won't support it) -- but
      // either way we can't use it

      const class_name = this.dropdown_caret.getAttribute('class') || '';

      if (/active/i.test(class_name)) {
        this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret');
      }
      else {
        this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret active');
        this.dropdown_list.focus();
      }

    });

    // we used to focus on caret. that broke when we started supporting
    // long lists and scrolling. so now we focus on the list.

    /*
    this.dropdown_caret.addEventListener('focusout', () => {
      this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret');
      this.container?.focus();
    });
    */

    this.dropdown_list = DOMUtilities.CreateDiv('treb-dropdown-list');
    this.dropdown_list.setAttribute('tabindex', '-1'); // focusable

    // this.dropdown_caret.addEventListener('keydown', (event) => {
    this.dropdown_list.addEventListener('keydown', (event) => {
      let delta = 0;

      switch (event.key) {
        case 'ArrowDown':
          delta = 1;
          break;
        case 'ArrowUp':
          delta = -1;
          break;
        case 'Escape':
          break;
        case 'Enter':
          break;
        default:
          console.info(event.key);
          return;
      }

      event.stopPropagation();
      event.preventDefault();

      if (event.key === 'Escape' || event.key === 'Enter') {
        this.container?.focus();
        this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret');
        if (event.key === 'Enter' && this.dropdown_callback) {
          if (this.dropdown_selected) {
            this.dropdown_callback.call(0, (this.dropdown_selected as any).dropdown_value);
          }
        }
      }
      else if (delta) {
        if (this.dropdown_selected) {
          if (delta > 0 && this.dropdown_selected.nextSibling) {
            (this.dropdown_selected.nextSibling as HTMLElement).classList.add('selected');
            this.dropdown_selected.classList.remove('selected');
            this.dropdown_selected = this.dropdown_selected.nextSibling as HTMLElement;

            // support scrolling

            const bottom = this.dropdown_selected.offsetTop + this.dropdown_selected.offsetHeight;
            if (bottom >
              this.dropdown_list.offsetHeight + this.dropdown_list.scrollTop) {
              this.dropdown_list.scrollTop = bottom - this.dropdown_list.offsetHeight;
            }

          }
          else if (delta < 0 && this.dropdown_selected.previousSibling) {
            (this.dropdown_selected.previousSibling as HTMLElement).classList.add('selected');
            this.dropdown_selected.classList.remove('selected');
            this.dropdown_selected = this.dropdown_selected.previousSibling as HTMLElement;

            // support scrolling

            if (this.dropdown_selected.offsetTop < this.dropdown_list.scrollTop) {
              this.dropdown_list.scrollTop = this.dropdown_selected.offsetTop;
            }

          }
        }
      }

    });

    this.dropdown_list.addEventListener('mousedown', (event) => {

      const target = event.target as HTMLElement;
      if (event.target === this.dropdown_list) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      this.container?.focus();
      this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret');

      if (this.dropdown_callback) {
        this.dropdown_callback.call(0, (target as any).dropdown_value);
      }
    });

    this.dropdown_list.addEventListener('mousemove', (event) => {
      const target = event.target as HTMLElement;
      if (target === this.dropdown_selected) {
        return;
      }
      this.grid_cover.classList.remove('nub-select');
      if (this.dropdown_selected) {
        this.dropdown_selected.classList.remove('selected');
      }
      target.classList.add('selected');
      this.dropdown_selected = target as HTMLElement;
    });

    this.mock_selection = DOMUtilities.CreateDiv('mock-selection-node');
    this.mock_selection.innerHTML = '&nbsp;';

    this.note_node = DOMUtilities.CreateDiv('treb-note');
    this.title_node = DOMUtilities.CreateDiv('treb-hover-title');

    this.HideNote();

  }

  /**
   * if the DPR has changed, update it and return true. otherwise return
   * false. this is used on resize events: if the scale has changed, we 
   * probably want to repaint (and we need to update scale).
   */
  public UpdateDPR(): boolean {
    const dpr = Math.max(1, self.devicePixelRatio || 1);
    if (dpr === this.dpr) {
      return false;
    }
    this.dpr = dpr;
    return true;
  }

  /** wrapper around sheet method, incorporating scale */
  public ColumnWidth(column: number): number {
    return Math.round(this.view.active_sheet.GetColumnWidth(column) * this.scale);
  }

  /** wrapper around sheet method, incorporating scale */
  public RowHeight(row: number): number {
    return Math.round(this.view.active_sheet.GetRowHeight(row) * this.scale);
  }

  /** 
   * wrapper around sheet method, incorporating scale
   * 
   * NOTE: this does not update total size, so unless there's a subsequent call
   * to a layout update, total size will be out of sync 
   */
  public SetRowHeight(row: number, height: number): void {
    this.view.active_sheet.SetRowHeight(row, Math.round(height / this.scale));
  }

  /** 
   * wrapper around sheet method, incorporating scale 
   * 
   * NOTE: this does not update total size, so unless there's a subsequent call
   * to a layout update, total size will be out of sync 
   */
  public SetColumnWidth(column: number, width: number): void {
    this.view.active_sheet.SetColumnWidth(column, Math.round(width / this.scale));
  }

  /**
   * show/hide grid selections. used when selecting annotations.
   */
  public ShowSelections(show = true): void {
    this.grid_selection.style.display = show ? 'block' : 'none';
  }

  public HideTitle(): void {
    this.title_node.style.opacity = '0';
    // this.title_node.style.pointerEvents = 'none';
  }

  public ShowTitle(text: string, address: ICellAddress /*, event?: MouseEvent */): void {
    this.title_node.textContent = text;

    if (!this.title_node.parentElement) return;

    // const note_size = this.title_node.getBoundingClientRect();
    const container = this.title_node.parentElement.getBoundingClientRect();

    const rect = this.OffsetCellAddressToRectangle(address).Shift(
      this.header_size.width, this.header_size.height);

    this.title_node.style.left = (
      container.left + rect.left - this.scroll_reference_node.scrollLeft + 0) + 'px';

    this.title_node.style.top = (
      container.top + rect.bottom - this.scroll_reference_node.scrollTop + 8) + 'px';

    // FIXME: use class

    this.title_node.style.opacity = '1';
    // this.title_node.style.pointerEvents = 'auto';

  }

  public HideNote(): void {

    // FIXME: use class

    this.note_node.style.opacity = '0';
    this.note_node.style.pointerEvents = 'none';
  }

  /**
   * adding html parameter at the end, so we can keep the function 
   * signature otherwise the same. this is for markdown formatting.
   */
  public ShowNote(note: string, address: ICellAddress, event?: MouseEvent, markdown?: string): void {

    // UPDATE for MD (optional)

    if (markdown) {
      this.note_node.innerHTML = markdown;
    }
    else {
      this.note_node.textContent = note;
    }

    if (!this.note_node.parentElement) return;

    const note_size = this.note_node.getBoundingClientRect();
    const container = this.note_node.parentElement.getBoundingClientRect();

    const offset = { x: 8, y: 2 };

    const rect = this.OffsetCellAddressToRectangle(address).Shift(
      this.header_size.width, this.header_size.height);

    this.note_node.style.left = (
      container.left + rect.right - this.scroll_reference_node.scrollLeft + offset.x) + 'px';
    this.note_node.style.top = (
      container.top + rect.top - this.scroll_reference_node.scrollTop - (note_size.height / 5) - offset.y) + 'px';

    // FIXME: use class

    this.note_node.style.opacity = '1';
    this.note_node.style.pointerEvents = 'auto';
  }

  /* * needed for IE11, legacy only * /
  public FixBrokenSelection() {
    // ...
  }
  */

  /**
   * raise or lower annotation in z-order (implicit)
   *
   * returns true if we've made changes, so you can trigger any necessary
   * events or side-effects
   */
  public AnnotationLayoutOrder(annotation: Annotation, delta: number): boolean {

    // find index
    let index = -1;
    for (let i = 0; i < this.view.active_sheet.annotations.length; i++) {
      if (this.view.active_sheet.annotations[i] === annotation) {
        index = i;
        break;
      }
    }

    if (index < 0) {
      return false; // not found
    }

    const target = Math.min(Math.max(0, index + delta), this.view.active_sheet.annotations.length - 1);

    if (target === index) {
      return false; // not moving (probably at edge)
    }

    // change in array order, so it's preserved

    this.view.active_sheet.annotations.splice(index, 1);
    this.view.active_sheet.annotations.splice(target, 0, annotation);

    // update layout, use z-indexes

    for (let i = 0; i < this.view.active_sheet.annotations.length; i++) {

      // updating to shift frozen annotations as well

      const key = this.view.active_sheet.annotations[i].key;
      const elements = this.container?.querySelectorAll(`.annotation[data-key="${key}"]`)
      if (elements) {
        for (let j = 0; j < elements?.length; j++) {
          (elements[j] as HTMLElement).style.zIndex = (i + 1).toString();
        }
      }

      /*
      const node = this.view.active_sheet.annotations[i].node;
      if (node) {
        node.style.zIndex = (i + 1).toString();
      }
      */

    }

    return true;

  }

  /**
   * 
   */
  public PointToAnnotationCorner(point: Point): Corner {
    const address = this.PointToAddress_Grid(point, undefined, false);
    const cell_rect = this.CellAddressToRectangle(address);

    return {
      address,
      offset: {
        x: (point.x - cell_rect.left) / cell_rect.width,
        y: (point.y - cell_rect.top) / cell_rect.height,
      },
    };
  }

  /**
   * utility for managing (new) annotation layout. we offset the {top, left}
   * by {1, 1} pixel so that the alignment snaps to cell boundaries.
   */
  public RectToAnnotationLayout(rect: Partial<Rectangle>): AnnotationLayout {
    return {
      tl: this.PointToAnnotationCorner({ x: (rect.left || 0) + 1, y: (rect.top || 0) + 1 }),
      br: this.PointToAnnotationCorner({ x: rect.right || rect.left || 100, y: rect.bottom || rect.top || 100 }),
    };
  }

  public AddressToAnnotationLayout(tl: ICellAddress, br: ICellAddress): AnnotationLayout {
    const rects = {
      tl: this.CellAddressToRectangle(tl),
      br: this.CellAddressToRectangle(br),
    };
    return {
      tl: this.PointToAnnotationCorner({ x: (rects.tl.left || 0), y: (rects.tl.top || 0) }),
      br: this.PointToAnnotationCorner({ x: rects.br.right || rects.tl.left || 100, y: rects.br.bottom || rects.tl.left || 100 }),
    };
  }

  /**
   * @see RectToAnnotationLayout regarding the 1 pixel shift
   */
  public AnnotationLayoutToRect(layout: AnnotationLayout): Rectangle {

    const tl = this.CellAddressToRectangle(layout.tl.address);
    const br = this.CellAddressToRectangle(layout.br.address);

    const left = tl.left + tl.width * layout.tl.offset.x - 1;
    const top = tl.top + tl.height * layout.tl.offset.y - 1;

    return new Rectangle(
      left, top,
      br.left + br.width * layout.br.offset.x - left,
      br.top + br.height * layout.br.offset.y - top,
    );

  }

  public UpdateAnnotation(elements: Annotation | Annotation[]): void {
    if (!Array.isArray(elements)) elements = [elements];
    for (const annotation of elements) {
      const view = annotation.view[this.view.view_index] || {};
      if (view.node) {

        /*
        if (annotation.node.dataset.scale && annotation.node.dataset.scale !== this.scale.toString()) {
          console.info('scale out of sync');
        }
        */

        view.node.dataset.scale = this.scale.toString();
        view.node.style.fontSize = `${10 * this.scale}pt`;

        // update the layout here if necessary. after that it should
        // be persisted (assuming it's saved). eventually this should
        // be superfluous...

        if (annotation.rect && !annotation.layout) {

          // this is breaking on freeze when the spreadsheet is scrolled because
          // the top-left uses the freeze panes. stop doing that.

          annotation.scaled_rect = annotation.rect.Scale(this.scale);
          annotation.layout = this.RectToAnnotationLayout(annotation.scaled_rect);
        }


        // FIXME: merge cells? [...]

        if (annotation.layout) {

          const rect = this.AnnotationLayoutToRect(annotation.layout);
          rect.ApplyStyle(view.node);

          // NOTE: we still set the scaled rect, because that's used in 
          // manipulating at scale. we will need to make sure that we update
          // the layout when the scaled rect / regular rect changes...

          annotation.scaled_rect = rect; // .Scale(this.scale);

        }

        view.node.dataset.key = annotation.key.toString();

        // FIXME: only do this if necessary (if frozen).

        if (this.view.active_sheet.freeze.rows || this.view.active_sheet.freeze.columns) {
          this.CloneFrozenAnnotation(annotation);
        }

      }
    }
  }

  /** returns a list of copies painted to frozen panes, for move/size */
  public GetFrozenAnnotations(annotation: Annotation): HTMLElement[] {
    const containers = [this.row_header_annotations, this.column_header_annotations, this.corner_annotations];
    return containers.map((container) => container.querySelector(`.annotation[data-key="${annotation.key}"]`)).filter(test => test !== null) as HTMLElement[];
  }

  /**
   * clone all annotations into freeze panes
   */
  public CloneFrozenAnnotations(): void {
    for (const annotation of this.view.active_sheet.annotations) {
      const view = annotation.view[this.view.view_index];
      if (view?.node && annotation.key) {
        this.CloneFrozenAnnotation(annotation);
      }
    }
  }

  /**
   * remove all annotations from freeze panes
   * 
   */
  public ClearFrozenAnnotations(): void {
    for (const container of [this.row_header_annotations, this.column_header_annotations, this.corner_annotations]) {
      const elements = container.querySelectorAll('.annotation');
      for (let i = 0; i < elements.length; i++) {
        // FIXME: remove event listeners
        elements[i].parentElement?.removeChild(elements[i]);
      }
    }
  }

  /**
   * remove a frozen annotation
   * @param annotation 
   */
  public RemoveFrozenAnnotation(annotation: Annotation): void {
    for (const container of [this.row_header_annotations, this.column_header_annotations, this.corner_annotations]) {
      const element = container.querySelector(`.annotation[data-key="${annotation.key}"]`);
      if (element) {
        // FIXME: remove event listeners
        element.parentElement?.removeChild(element);
      }
    }
  }

  /**
   * clone a single annotation. usually this will be used on create, but
   * we batch them when we freeze panes (from unfrozen)
   */
  public CloneFrozenAnnotation(annotation: Annotation): void {

    for (const container of [this.row_header_annotations, this.column_header_annotations, this.corner_annotations]) {

      // FIXME: could reuse? not sure it's worth it
      let element: Element | Node | null | undefined = container.querySelector(`.annotation[data-key="${annotation.key}"]`);
      if (element) {
        element.parentElement?.removeChild(element);
      }

      const view = annotation.view[this.view.view_index];
      element = view?.node?.cloneNode(true);

      if (element) {

        const move_target = (element as HTMLElement).querySelector('.annotation-move-target') as HTMLElement;
        const resize_target = (element as HTMLElement).querySelector('.annotation-resize-target') as HTMLElement;

        (element as HTMLElement).addEventListener('mousedown', (event: MouseEvent) => {
          const node = view.node;
          requestAnimationFrame(() => {
            // console.info('calling focus on', node);
            node?.focus();
          });
          this.AnnotationMouseDown(annotation, view.node as HTMLElement, event, move_target, resize_target);
        });
        container.appendChild(element);
      }

    }

  }

  public RemoveAnnotation(annotation: Annotation): void {
    const view = annotation.view[this.view.view_index] || {};
    if (view.node) {
      view.node.parentElement?.removeChild(view.node);
    }
    this.RemoveFrozenAnnotation(annotation);
  }

  /**
   * remove annotation nodes from the container, without impacting
   * the underlying data. annotations will still retain nodes, they
   * just won't be attached to anything.
   *
   * NOTE: IE destroys nodes if you do this? (...)
   * patch in legacy... actually we'll do it here
   */
  public RemoveAnnotationNodes(): void {

    // we were using a shortcut, innerText = '', but if you do that
    // in IE it destroys the nodes (!) -- so we need to explicitly
    // remove them

    // FIXME: we are explicitly adding them, why not just maintain a list?

    const children = Array.prototype.map.call(
      this.annotation_container.children, (node) => node) as HTMLElement[];

    for (const child of children) {
      this.annotation_container.removeChild(child);
    }

    if (this.view.active_sheet.freeze.rows || this.view.active_sheet.freeze.columns) {
      this.ClearFrozenAnnotations();
    }

  }

  public AddAnnotation(annotation: Annotation): void {
    const view = annotation.view[this.view.view_index] || {};
    if (!view.node) {
      throw new Error('annotation view/node missing');
    }
    this.annotation_container.appendChild(view.node);
    this.UpdateAnnotation(annotation);
  }

  // testing moving this here...
  public AnnotationMouseDown(annotation: Annotation, node: HTMLElement, event: MouseEvent, move_target: HTMLElement, resize_target: HTMLElement): Promise<GridEvent | void> {

    // console.info('annotation mousedown (in layout)', annotation);

    const rect = annotation.scaled_rect;
    if (!rect) {
      console.info('missing scaled rect!');
      return Promise.reject(); // ?
    }

    return new Promise<GridEvent | void>((resolve) => {

      const origin = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      const scroll_node = this.scroll_reference_node;
      const scroll_rect = scroll_node.getBoundingClientRect();

      const bounding_rect = node.getBoundingClientRect();

      // IE11 is not targeting the child nodes? why not? (...)
      // console.info('target', (event.target as HTMLElement)?.className);

      if (event.target === move_target || (event.target !== resize_target && event.altKey)) {

        event.stopPropagation();
        event.preventDefault();
        node.focus();

        const offset = {
          x: bounding_rect.left + event.offsetX - rect.left,
          y: bounding_rect.top + event.offsetY - rect.top,
        };

        const elements = [node, ...this.GetFrozenAnnotations(annotation)];
        const scroll_delta = 25;

        const grid_rect =
          this.CellAddressToRectangle({ row: 0, column: 0 }).Combine(
            this.CellAddressToRectangle({
              row: this.view.active_sheet.rows - 1,
              column: this.view.active_sheet.columns - 1,
            })).Expand(-1, -1);

        MouseDrag(this.mask, 'move', (move_event) => {

          // check if we are oob the grid
          // FIXME: clamp annotation to cell bounds (...) this is OK for now though

          if (move_event.offsetY - scroll_rect.top < this.header_offset.y) {
            const delta = Math.min(scroll_delta, scroll_node.scrollTop);
            scroll_node.scrollTop -= delta;
            offset.y += delta;
          }
          else if (move_event.offsetY - scroll_rect.top >= scroll_rect.height) {
            if (scroll_node.scrollTop + scroll_rect.height < grid_rect.height) {
              const delta = scroll_delta;
              scroll_node.scrollTop += delta;
              offset.y -= delta;
            }
          }

          if (move_event.offsetX - scroll_rect.left < this.header_offset.x) {
            const delta = Math.min(scroll_delta, scroll_node.scrollLeft);
            scroll_node.scrollLeft -= delta;
            offset.x += delta;
          }
          else if (move_event.offsetX - scroll_rect.left >= scroll_rect.width) {
            if (scroll_node.scrollLeft + scroll_rect.width < grid_rect.width) {
              const delta = scroll_delta;
              scroll_node.scrollLeft += delta;
              offset.x -= delta;
            }
          }

          rect.top = move_event.offsetY - offset.y;
          rect.left = move_event.offsetX - offset.x;

          if (move_event.shiftKey) {

            // move in one direction at a time
            const dx = Math.abs(rect.left - origin.left);
            const dy = Math.abs(rect.top - origin.top);

            if (dx <= dy) { rect.left = origin.left; }
            else { rect.top = origin.top; }

          }

          if (move_event.ctrlKey) {
            const point = this.ClampToGrid({
              x: rect.left, y: rect.top,
            });
            rect.left = point.x;
            rect.top = point.y;
          }

          // node.style.top = (rect.top) + 'px';
          // node.style.left = (rect.left) + 'px';

          for (const element of elements) {
            element.style.top = (rect.top) + 'px';
            element.style.left = (rect.left) + 'px';
          }

        }, () => {
          annotation.extent = undefined; // reset
          // annotation.rect = rect.Scale(1/this.scale);
          annotation.layout = this.RectToAnnotationLayout(rect);
          // this.grid_events.Publish({ type: 'annotation', annotation, event: 'move' });
          resolve({ type: 'annotation', annotation, event: 'move' })
        });

        return;

      }
      else if (event.target === resize_target) {

        //if ((bounding_rect.width - event.offsetX <= 13) &&
        //  (bounding_rect.height - event.offsetY <= 13)) {

        event.stopPropagation();
        event.preventDefault();
        node.focus();

        let aspect = 0;
        if (annotation.data?.original_size
          && annotation.data.original_size.width
          && annotation.data.original_size.height) {
          aspect = annotation.data.original_size.width /
            annotation.data.original_size.height;
        }

        const bounds = node.getBoundingClientRect();
        const offset = {
          x: bounds.left + event.offsetX - rect.width + resize_target.offsetLeft,
          y: bounds.top + event.offsetY - rect.height + resize_target.offsetTop,
        };

        MouseDrag(this.mask, 'nw-resize', (move_event) => {

          const elements = [node, ...this.GetFrozenAnnotations(annotation)];

          rect.height = move_event.offsetY - offset.y;
          rect.width = move_event.offsetX - offset.x;

          if (move_event.shiftKey && move_event.ctrlKey) {
            if (aspect) {

              const dx = Math.abs(rect.width - origin.width);
              const dy = Math.abs(rect.height - origin.height);

              if (dx < dy) {
                rect.width = aspect * rect.height;
              }
              else {
                rect.height = rect.width / aspect;
              }

            }
          }
          else if (move_event.shiftKey) {
            // move in one direction at a time [is this backwards? ...]
            const dx = Math.abs(rect.height - origin.height);
            const dy = Math.abs(rect.width - origin.width);

            if (dx > dy) { rect.width = origin.width; }
            else { rect.height = origin.height; }
          }
          else if (move_event.ctrlKey) {
            const point = this.ClampToGrid({
              x: rect.right, y: rect.bottom,
            });
            rect.width = point.x - rect.left + 1;
            rect.height = point.y - rect.top + 1;
          }

          // node.style.height = (rect.height) + 'px';
          // node.style.width = (rect.width) + 'px';

          for (const element of elements) {
            element.style.height = (rect.height) + 'px';
            element.style.width = (rect.width) + 'px';
          }

        }, () => {
          annotation.extent = undefined; // reset
          // annotation.rect = rect.Scale(1/this.scale);
          annotation.layout = this.RectToAnnotationLayout(rect);

          // this.grid_events.Publish({ type: 'annotation', annotation, event: 'resize' });
          resolve({ type: 'annotation', annotation, event: 'resize' });

        });

        return;
      }
      else {
        resolve();
      }

    });


  }

  /**
   * this used to be an abstract method for initializing. we're taking it
   * over to do some additional work post init, and renaming the subclass-specific
   * method (@see InitializeInternal).
   */
  public Initialize(container: HTMLElement,
    scroll_callback: () => void,
    dropdown_callback: (value: CellValue) => void,
    scroll = true): void {

    if (!this.mask.parentElement) {
      container.appendChild(this.mask);
    }

    //if (!this.error_highlight.parentElement) {
    //  container.appendChild(this.error_highlight);
    //}

    if (!this.tooltip.parentElement) {
      container.appendChild(this.tooltip);
    }

    // FIXME: -> instance specific, b/c trident

    if (!this.dropdown_caret.parentElement) {
      container.appendChild(this.dropdown_caret);
    }

    if (!this.dropdown_list.parentElement) {
      container.appendChild(this.dropdown_list);
    }

    if (!this.note_node.parentElement) {
      container.appendChild(this.note_node);
    }

    if (!this.title_node.parentElement) {
      container.appendChild(this.title_node);
    }

    this.InitializeInternal(container, scroll_callback);
    if (!scroll && this.scroll_reference_node) {
      this.scroll_reference_node.style.overflow = 'hidden';
    }

    this.dropdown_callback = dropdown_callback;

    this.initialized = true;

  }

  /**
   * create a selection so that this node (and parents) receive
   * a copy event on ctrl+c (or any other system copy event).
   * seems to break IE, so split.
   */
  public MockSelection(): void {

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

    // why were we prepainting (because firefox, below?) and why was this so
    // slow? do we need to preset the context text parameters? 

    /*
    const context = tile.getContext('2d', {alpha: false});

    if (context) {
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';

      // prepaint -- firefox is a little slow so flashes empty tiles sometimes

      // context.fillStyle = '#fff'; // FIXME: use theme color
      // context.fillRect(0, 0, tile.width, tile.height);
    }
    */

    return tile;

  }

  /**
   * applies theme to nodes, as necessary
   */
  public ApplyTheme(theme: Theme): void {
    this.row_header.style.backgroundColor =
      this.column_header.style.backgroundColor =
      this.corner.style.backgroundColor =
      theme.headers?.fill ? ThemeColor(theme, theme.headers.fill) : '';

    // theme.headers?.background || '';
    // theme.header_background_color || ''; // this.theme.header_background;

    this.corner.style.borderColor =
      theme.grid_color || ''; // this.theme.header_border_color;
    // this.row_header.style.backgroundColor = this.theme.header_background;
    // this.column_header.style.backgroundColor = this.theme.header_background;

    for (const row of this.grid_tiles) {
      for (const tile of row) {
        tile.style.backgroundColor = ThemeColor(theme, theme.grid_cell?.fill) || '#fff';
      }
    }

    /*
    this.tooltip.style.fontFamily = theme.tooltip_font_face || '';
    this.tooltip.style.fontSize = theme.tooltip_font_size ? `${theme.tooltip_font_size}pt` : '';
    this.tooltip.style.backgroundColor = theme.tooltip_background || '';
    this.tooltip.style.borderColor = theme.tooltip_background || ''; // for arrow
    this.tooltip.style.color = theme.tooltip_color || '';
    */

    // TODO: dropdown caret

    // this.dropdown_list.style.fontFamily = theme.cell_font || '';
    // const font_size = (theme.cell_font_size_value || 10) * this.scale;
    // this.dropdown_list.style.fontSize = (font_size) + (theme.cell_font_size_unit || 'pt');
    this.dropdown_list.style.font = Style.Font(theme.grid_cell || {});

  }

  public UpdateTotalSize(): void {

    this.total_height = 0;
    const rows = this.view.active_sheet.rows;
    for (let i = 0; i < rows; i++) {
      this.total_height += this.RowHeight(i);
    }

    this.total_width = 0;
    const columns = this.view.active_sheet.columns;
    for (let i = 0; i < columns; i++) {
      this.total_width += this.ColumnWidth(i);
    }

  }


  public UpdateContentsSize(): void {

    const height = this.row_header_tiles.reduce((a, tile) => a + tile.logical_size.height, 0);
    const width = this.column_header_tiles.reduce((a, tile) => a + tile.logical_size.width, 0);

    this.column_header.style.width = this.contents.style.width = `${width}px`;
    this.row_header.style.height = this.contents.style.height = `${height}px`;

  }

  /** hides column/row resize tooltip and removes any specific classes */
  public HideTooltip(): void {
    this.tooltip.style.display = 'none';
    this.tooltip_state = undefined;
    this.tooltip.classList.remove('arrow-up');
    this.tooltip.classList.remove('arrow-left');
  }

  /*

  highlight error removed in favor of container errors, event reporting
  
  * briefly flash red, to indicate an error * /
  public HighlightError(address: ICellAddress): void {

    const target_rect = this.OffsetCellAddressToRectangle(address).Shift(
      this.header_size.width, this.header_size.height);

    target_rect.ApplyStyle(this.error_highlight);
    this.error_highlight.style.opacity = '1';

    // we don't like to rely on transitionend events. the concern is that
    // if they overlap eventually one will get lost... because this can be
    // triggered faster than the transition, we can almost always make that
    // happen

    if (this.error_highlight_timeout) {
      clearTimeout(this.error_highlight_timeout);
    }

    this.error_highlight_timeout = setTimeout(() => {
      this.error_highlight.style.opacity = '0';
      this.error_highlight_timeout = undefined;
    }, 250)

  }
  */

  /** show column/row resize tooltip */
  public ShowTooltip(options: TooltipOptions = {}): void {
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

  public ShowDropdownCaret(area: Area, list: CellValue[], current: CellValue): void {

    let target_rect = this.OffsetCellAddressToRectangle(area.start);

    if (area.count > 1) {
      target_rect = target_rect.Combine(this.OffsetCellAddressToRectangle(area.end));
    }

    target_rect = target_rect.Shift(
      this.header_size.width, this.header_size.height);

    // FIXME: max size? (...)

    const height = Math.round(this.scale * Math.max(8, Math.min(20, target_rect.height)));

    this.dropdown_caret.style.height = `${height}px`;
    this.dropdown_caret.style.width = `${height}px`;
    this.dropdown_caret.style.left = `${target_rect.right + 1}px`;
    this.dropdown_caret.style.top = `${target_rect.bottom - height}px`;

    this.dropdown_list.style.top = `${target_rect.bottom + 2}px`;
    this.dropdown_list.style.left = `${target_rect.left + 2}px`;
    this.dropdown_list.style.minWidth = `${target_rect.width}px`;

    this.dropdown_list.textContent = '';
    for (const value of list) {
      const entry = DOMUtilities.CreateDiv(undefined, this.dropdown_list);
      if (current === value) {
        this.dropdown_selected = entry;
        entry.classList.add('selected');
      }
      (entry as any).dropdown_value = value;
      entry.textContent = value?.toString() || '';
    }

    //this.dropdown_caret.classList.remove('active');
    this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret');

    this.dropdown_caret.style.display = 'block';
    this.dropdown_caret_visible = true;
  }

  public HideDropdownCaret(): void {
    if (this.dropdown_caret_visible) {
      // this.dropdown_caret.classList.remove('active');
      this.dropdown_caret.setAttribute('class', 'treb-dropdown-caret');
      this.dropdown_caret_visible = false;
      this.dropdown_caret.style.display = 'none';
    }
  }

  /**
   * this method returns the scroll offset adjusted for headers.
   * if you just want the raw scroll offset, use the accessor.
   * 
   * @param offset_headers 
   * @returns 
   */
  public GetScrollOffset(): Point {
    return {
      x: this.scroll_reference_node.scrollLeft + this.header_offset.x,
      y: this.scroll_reference_node.scrollTop + this.header_offset.y,
    };
  }

  public ScrollTo(address: ICellAddress, x = true, y = true, smooth = false): void {
    const target_rect = this.CellAddressToRectangle(address);

    if (smooth && !!this.scroll_reference_node.scrollTo) {

      const current = {
        left: this.scroll_reference_node.scrollLeft,
        top: this.scroll_reference_node.scrollTop,
      };

      const options: ScrollToOptions = {
        left: x ? target_rect.left : current.left,
        top: y ? target_rect.top : current.top,
        behavior: 'smooth',
      }

      this.scroll_reference_node.scrollTo(options);

    }
    else {
      if (y) {
        this.scroll_reference_node.scrollTop = target_rect.top;
      }
      if (x) {
        this.scroll_reference_node.scrollLeft = target_rect.left;
      }
    }
  }

  /**
   * scroll address into view, at top-left or bottom-right depending on
   * target and current position. also offsets for frozen rows, columns.
   */
  public ScrollIntoView(address: ICellAddress): void {

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

    if (this.view.active_sheet.freeze.rows || this.view.active_sheet.freeze.columns) {
      if (this.view.active_sheet.freeze.rows && address.row >= this.view.active_sheet.freeze.rows) {
        offset.y = this.frozen_row_tiles[0].logical_size.height;
      }
      else if (this.view.active_sheet.freeze.rows) lock.y = true;

      if (this.view.active_sheet.freeze.columns && address.column >= this.view.active_sheet.freeze.columns) {
        offset.x = this.frozen_column_tiles[0].logical_size.width;
      }
      else if (this.view.active_sheet.freeze.columns) lock.x = true;
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

  public UpdateTooltip(options: TooltipOptions = {}): void {
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
  public CoordinateToRowHeader(y: number): ICellAddress {
    const result = { column: Infinity, row: 0 };

    if (this.view.active_sheet.freeze.rows &&
      this.frozen_row_tiles[0].pixel_end.y >= y - this.scroll_reference_node.scrollTop) {

      let height = 0;
      y -= this.scroll_reference_node.scrollTop;

      for (let i = 0; i < this.view.active_sheet.freeze.rows; i++) {
        height += this.RowHeight(i);
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
        for (; result.row <= tile.last_cell.row; result.row++, top -= height) {
          height = this.RowHeight(result.row);
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
  public CoordinateToColumnHeader(x: number): ICellAddress {
    const result = { row: Infinity, column: 0 };

    if (this.view.active_sheet.freeze.columns &&
      this.frozen_column_tiles[0].pixel_end.x >= x - this.scroll_reference_node.scrollLeft) {

      let width = 0;
      x -= this.scroll_reference_node.scrollLeft;

      for (let i = 0; i < this.view.active_sheet.freeze.columns; i++) {
        width += this.ColumnWidth(i);
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

        for (; result.column <= tile.last_cell.column; result.column++, left -= width) {
          width = this.ColumnWidth(result.column);
          if (width > left) return result;
        }

        return result;
      }
    }
    return result;

  }

  /**
   * point to cell address (grid only)
   * 
   * FIXME: implement cap_maximum parameter (not sure where we would need it)
   */
  public PointToAddress_Grid(point: Point, cap_maximum = false, offset_freeze = true): ICellAddress {

    // offset for freeze pane

    if (offset_freeze) {

      if (this.view.active_sheet.freeze.rows) {
        const frozen_height = this.frozen_row_tiles[0].logical_size.height;
        if (point.y - this.scroll_reference_node.scrollTop < frozen_height) {
          point.y -= this.scroll_reference_node.scrollTop;
        }
      }

      if (this.view.active_sheet.freeze.columns) {
        const frozen_width = this.frozen_column_tiles[0].logical_size.width;
        if (point.x - this.scroll_reference_node.scrollLeft < frozen_width) {
          point.x -= this.scroll_reference_node.scrollLeft;
        }
      }

    }

    // we used to find the containing tile and then calculate row and column.
    // to support overflow, we now have two separate loops. 
    
    const result = { 
      row: 0, 
      column: 0, 
    };

    // FIXME: these could be cached when created

    const last_column = this.grid_tiles[this.grid_tiles.length - 1];
    const last_tile = last_column[last_column.length - 1];

    // ---- find row -----------------------------------------------------------

    if (point.y > last_tile.pixel_end.y) {

      // overflow case

      let top = point.y - last_tile.pixel_end.y;
      result.row = last_tile.last_cell.row;

      while (top > 0) {
        result.row++;
        top -= this.default_row_height;
      }

    }
    else {

      // normal behavior

      for (const cell of last_column) {
        if (cell.pixel_start.y <= point.y && cell.pixel_end.y >= point.y) {

          let top = point.y - cell.pixel_start.y;
          let height = 0;

          result.row = cell.first_cell.row;

          for (; result.row <= cell.last_cell.row; result.row++, top -= height) {
            height = this.RowHeight(result.row);
            if (height > top) {
              break;
            }
          }

          break;
        }
      }
    }

    // ---- find column --------------------------------------------------------

    if (point.x > last_tile.pixel_end.x) {

      // overflow case

      let left = point.x - last_tile.pixel_end.x;
      result.column = last_tile.last_cell.column;

      while (left > 0) {
        result.column++;
        left -= this.default_column_width;
      }

    }
    else {

      // normal behavior

      for (const column of this.grid_tiles) {
        if (column[0].pixel_start.x <= point.x && column[0].pixel_end.x >= point.x) {

          const cell = column[0];

          let left = point.x - cell.pixel_start.x;
          let width = 0;

          result.column = cell.first_cell.column;

          for (; result.column <= cell.last_cell.column; result.column++, left -= width) {
            width = this.ColumnWidth(result.column);
            if (width > left) {
              break;
            }
          }

          break;
        }
      }
    }

    return result;

  }

  /**
   * get an adjacent tile. this is used by the renderer when a merge or
   * overflow runs out of the painted tile, and we need to paint it.
   */
  public AdjacentTile(tile: Tile, row_offset = 0, column_offset = 0): Tile|undefined {

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

  public UpdateTiles(): void {

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
        if (tile.parentElement) {
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

    // update local references (scaled). this has to be done before layout.

    const sheet = this.view.active_sheet;

    this.default_row_height = Math.round(sheet.default_row_height * this.scale);
    this.default_column_width = Math.round(sheet.default_column_width * this.scale);

    this.header_offset = {
      x: Math.round(sheet.header_offset.x * this.scale),
      y: Math.round(sheet.header_offset.y * this.scale),
    };

    this.UpdateContainingGrid();

    let rows = this.view.active_sheet.rows;
    let columns = this.view.active_sheet.columns;

    if (!rows) rows = 100;
    if (!columns) columns = 40;

    // get total size of the grid from sheet

    let total_height = 0;
    let total_width = 0;

    for (let i = 0; i < rows; i++) {
      total_height += this.RowHeight(i);
    }

    for (let i = 0; i < columns; i++) {
      total_width += this.ColumnWidth(i);
    }

    if (!total_width || !total_height) {
      throw ('unexpected missing total size');
    }

    // console.info('total size:', total_width, ', ', total_height);

    if (!total_height) total_height = this.default_row_height * rows;
    if (!total_width) total_width = this.default_column_width * columns;

    if (this.container.offsetWidth > total_width) {

      const add_columns = Math.ceil((this.container.offsetWidth - total_width) /
        this.default_column_width);
      total_width += add_columns * this.default_column_width;
      columns += add_columns;

    }

    this.last_column = columns;

    if (this.container.offsetHeight > total_height) {
      const add_rows = Math.ceil((this.container.offsetHeight - total_height) /
        this.default_row_height);
      total_height += add_rows * this.default_row_height;
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

    for (let c = 0; c < columns; c++) {
      const column_width = this.ColumnWidth(c);
      if (tile_width && tile_width + column_width > this.default_tile_size.width) {

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

    for (let r = 0; r < rows; r++) {
      const row_height = this.RowHeight(r);
      if (tile_height && tile_height + row_height > this.default_tile_size.height) {
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

    for (let i = 0; i < this.view.active_sheet.freeze.rows; i++) {
      header_height += this.RowHeight(i);
    }
    for (let i = 0; i < this.view.active_sheet.freeze.columns; i++) {
      header_width += this.ColumnWidth(i);
    }

    for (let c = 0; c < column_tile_count; c++) {
      const column: Tile[] = [];

      pixel_y = 0; // reset

      const column_extent = (c === column_tile_count - 1) ?
        columns - tile_columns[c] :
        tile_columns[c + 1] - tile_columns[c];

      // create a column header tile for this column
      this.column_header_tiles.push(this.CreateTile('column-header-tile',
        { height: this.header_offset.y, width: tile_widths[c] },
        { row: 0, column: c },
        { row: 0, column: tile_columns[c] },
        { rows: 0, columns: column_extent },
        { x: pixel_x, y: 0 },
        this.column_header));

      // also frozen
      if (this.view.active_sheet.freeze.rows) {
        this.frozen_row_tiles.push(this.CreateTile('frozen-row-tile',
          { height: header_height, width: tile_widths[c] },
          { row: 1, column: c },
          { row: 0, column: tile_columns[c] },
          { rows: 0, columns: column_extent },
          { x: pixel_x, y: 0 },
          this.column_header));
      }

      // loop over rows
      for (let r = 0; r < row_tile_count; r++) {

        const row_extent = (r === row_tile_count - 1) ?
          rows - tile_rows[r] :
          tile_rows[r + 1] - tile_rows[r];

        // first column, create header
        if (!c) {
          this.row_header_tiles.push(this.CreateTile('row-header-tile',
            { height: tile_heights[r], width: this.header_offset.x },
            { row: r, column: 0 },
            { row: tile_rows[r], column: 0 }, // first cell
            { rows: row_extent, columns: 1 },
            { x: 0, y: pixel_y },
            this.row_header));

          // also frozen
          if (this.view.active_sheet.freeze.columns) {
            this.frozen_column_tiles.push(this.CreateTile('frozen-column-tile',
              { height: tile_heights[r], width: header_width },
              { row: r, column: 1 },
              { row: tile_rows[r], column: 0 },
              { rows: row_extent, columns: 1 },
              { x: 0, y: pixel_y },
              this.row_header));
          }
        }

        column.push(this.CreateTile('grid-tile',
          { height: tile_heights[r], width: tile_widths[c] }, // tile size in pixels
          { row: r, column: c }, // grid position
          { row: tile_rows[r], column: tile_columns[c] }, // first cell
          { rows: row_extent, columns: column_extent }, // extent
          { x: pixel_x, y: pixel_y },
          this.contents));

        pixel_y += tile_heights[r];

      }
      this.grid_tiles.push(column);

      pixel_x += tile_widths[c];

    }

    this.total_height = total_height;
    this.total_width = total_width;

    this.ClearLayoutCaches();

    this.UpdateGridTemplates(true, true);

  }

  public ClearLayoutCaches(): void {
    this.row_cache = [];
    this.column_cache = [];
  }

  /**
   * returns the tile index for a given column. this is used to map
   * a column to a tile in either the header or the grid.
   * FIXME: speed up w/ lookup cache
   */
  public TileIndexForColumn(column: number): number {
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
  public TileIndexForRow(row: number): number {
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
  public DirtyHeaders(area?: Area): void {

    if (!area) return;

    // FIXME: visible only?
    // why, who cares? render should be based on visible, not dirty

    for (const tile of this.column_header_tiles) {
      if (tile.dirty) continue;
      const test: Area = new Area(
        { row: area.start.row, column: tile.first_cell.column },
        { row: area.start.row, column: tile.last_cell.column },
      );
      if (area.entire_row || test.Intersects(area)) {
        tile.dirty = true;
      }
    }

    for (const tile of this.row_header_tiles) {
      if (tile.dirty) continue;
      const test: Area = new Area(
        { column: area.start.column, row: tile.first_cell.row },
        { column: area.start.column, row: tile.last_cell.row },
      );
      if (area.entire_column || test.Intersects(area)) {
        tile.dirty = true;
      }
    }

  }

  public DirtyAll(): void {
    for (const column of this.grid_tiles) {
      for (const tile of column) {
        tile.dirty = true;
      }
    }
  }

  public DirtyArea(area: Area): void {

    if (!this.initialized) return;

    const start = { row: 0, column: 0 };
    const end = { row: this.grid_tiles[0].length - 1, column: this.grid_tiles.length - 1 };

    if (area.start.column !== Infinity) {
      start.column = end.column = this.TileIndexForColumn(area.start.column);
      if (area.end.column !== area.start.column) end.column = this.TileIndexForColumn(area.end.column);
    }
    if (area.start.row !== Infinity) {
      start.row = end.row = this.TileIndexForRow(area.start.row);
      if (area.end.row !== area.start.row) end.row = this.TileIndexForRow(area.end.row);
    }
    for (let column = start.column; column <= end.column; column++) {
      for (let row = start.row; row <= end.row; row++) {
        this.grid_tiles[column][row].dirty = true;
      }
    }

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

  public UpdateTileHeights(mark_dirty = true, start_row = -1): void {

    let y = 0;

    for (let i = 0; i < this.row_header_tiles.length; i++) {
      const tile = this.row_header_tiles[i];
      // const column = this.grid_tiles[i];

      if (start_row > tile.last_cell.row) {
        y += tile.logical_size.height;
        continue;
      }

      let height = 0;

      for (let r = tile.first_cell.row; r <= tile.last_cell.row; r++) {
        height += this.RowHeight(r);
      }

      const height_match = (tile.logical_size.height === height);

      tile.pixel_start.y = y;
      y += height;
      tile.pixel_end.y = y;

      if (!height_match) {

        tile.logical_size.height = height;
        tile.style.height = `${height}px`;
        tile.height = this.dpr * height;

        if (this.view.active_sheet.freeze.columns) {
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

      for (const column of this.grid_tiles) {
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

    if (this.view.active_sheet.freeze.rows) {
      let freeze_height = 0;
      for (let i = 0; i < this.view.active_sheet.freeze.rows; i++) freeze_height += this.RowHeight(i);
      for (const tile of this.frozen_row_tiles) {
        tile.style.height = `${freeze_height}px`;
        tile.height = freeze_height * this.dpr;
      }

      // corner includes header size
      freeze_height += this.header_offset.y;
      this.corner_canvas.style.height = `${freeze_height}px`;
      this.corner_canvas.height = freeze_height * this.dpr;

      // mark these as dirty so we get painted
      for (const column of this.grid_tiles) {
        column[0].dirty = true;
      }

    }

    this.UpdateGridTemplates(false, true);

    this.row_header.style.height = this.contents.style.height = `${y}px`;

    this.ClearLayoutCaches();


  }

  /**
   * update all widths. start_column is a hint that can save some work
   * by skipping unaffected tiles
   */
  public UpdateTileWidths(mark_dirty = true, start_column = -1): void {

    let x = 0;

    for (let i = 0; i < this.column_header_tiles.length; i++) {
      const tile = this.column_header_tiles[i];
      const column = this.grid_tiles[i];

      if (start_column > tile.last_cell.column) {
        x += tile.logical_size.width;
        continue;
      }

      let width = 0;

      for (let c = tile.first_cell.column; c <= tile.last_cell.column; c++) {
        width += this.ColumnWidth(c);
      }

      const width_match = (tile.logical_size.width === width);

      tile.pixel_start.x = x;
      x += width;
      tile.pixel_end.x = x;

      if (!width_match) {

        tile.logical_size.width = width;
        tile.style.width = `${width}px`;
        tile.width = this.dpr * width;

        if (this.view.active_sheet.freeze.rows) {
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

      for (const grid_tile of column) {

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

    if (this.view.active_sheet.freeze.columns) {
      let freeze_width = 0;
      for (let i = 0; i < this.view.active_sheet.freeze.columns; i++) freeze_width += this.ColumnWidth(i);
      for (const tile of this.frozen_column_tiles) {
        tile.style.width = `${freeze_width}px`;
        tile.width = freeze_width * this.dpr;
      }

      // corner includes header size
      freeze_width += this.header_offset.x;
      this.corner_canvas.style.width = `${freeze_width}px`;
      this.corner_canvas.width = freeze_width * this.dpr;

      // mark these as dirty so we get painted
      for (const tile of this.grid_tiles[0]) {
        tile.dirty = true;
      }

    }

    this.UpdateGridTemplates(true, false);

    this.column_header.style.width = this.contents.style.width = `${x}px`;

    this.ClearLayoutCaches();


  }

  public ClampToGrid(point: Point): Point {
    const address = this.PointToAddress_Grid(point);
    const rect = this.OffsetCellAddressToRectangle(address);

    if (point.x > rect.left + rect.width / 2) {
      point.x = rect.left + rect.width - 1;
    }
    else {
      point.x = rect.left - 1;
    }

    if (point.y > rect.top + rect.height / 2) {
      point.y = rect.top + rect.height - 1;
    }
    else {
      point.y = rect.top - 1;
    }

    return point;
  }

  /**
   * wrapper method for CellAddressToRectangle allows us to offset for
   * frozen rows/columns. in some cases we may not want to do this, so
   * the underlying method is still visible (and cache contains the raw
   * rectangles, not offset).
   */
  public OffsetCellAddressToRectangle(address: ICellAddress): Rectangle {

    let rect = this.CellAddressToRectangle(address);

    if (address.column >= 0 && address.column < this.view.active_sheet.freeze.columns) {
      rect = rect.Shift(this.scroll_reference_node.scrollLeft, 0);
    }
    if (address.row >= 0 && address.row < this.view.active_sheet.freeze.rows) {
      rect = rect.Shift(0, this.scroll_reference_node.scrollTop);
    }

    return rect;

  }

  /**
   * finds the rectangle, in the coordinate space of the grid node,
   * of the cell with the given address. uses a cache since we wind
   * up looking up the same rectangles a lot.
   * 
   * UPDATE dropping rectangle cache in favor of holding row and 
   * column edges. I realized we were holding a lot of redundant 
   * information, and this should be resonably fast.
   * 
   * TODO could probably be slightly more efficient by holding the
   * left edge of the column/row at the index; then we don't have to
   * have special behavior for column/row 0.
   */
  public CellAddressToRectangle(address: ICellAddress): Rectangle {

    // limit

    const row = address.row === Infinity || address.row < 0 ? 0 : address.row;
    const column = address.column === Infinity || address.column < 0 ? 0 : address.column;

    // build out the caches if necessary

    if (this.column_cache.length <= column + 1) {

      if (!this.column_cache.length) {
        this.column_cache[0] = 0;
      }

      for (let i = this.column_cache.length - 1; i <= column; i++) {
        this.column_cache[i + 1] = this.column_cache[i] + this.ColumnWidth(i);
      }

    }

    if (this.row_cache.length <= row + 1) {

      if (!this.row_cache.length) {
        this.row_cache[0] = 0;
      }

      for (let i = this.row_cache.length - 1; i <= row; i++) {
        this.row_cache[i + 1] = this.row_cache[i] + this.RowHeight(i);
      }

    }

    // now we can construct the rectangle

    const left = this.column_cache[column];
    const top = this.row_cache[row];

    return new Rectangle(left, top,
      this.column_cache[column + 1] - left,
      this.row_cache[row + 1] - top);

  }

  /**
   * resizes the tile at this index, rebuilds structure of subsequent tiles.
   * this is necessary because tiles keep track of pixel position: so if a
   * tile is resized, subsequent tiles have to change.
   */
  public ResizeTileWidth(index: number, width: number, mark_dirty = true): void {

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

    for (let i = index + 1; i < this.column_header_tiles.length; i++) {
      this.column_header_tiles[i].pixel_start.x += delta;
      this.column_header_tiles[i].pixel_end.x += delta;

      for (const cell of this.grid_tiles[i]) {
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

    this.UpdateTotalSize();
    this.UpdateGridTemplates(true, false);
    this.UpdateContentsSize();

  }

  /**
   * resizes the tile at this index, rebuilds structure of subsequent tiles
   */
  public ResizeTileHeight(index: number, height: number, mark_dirty = true): void {

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

    for (let r = index + 1; r < this.row_header_tiles.length; r++) {
      tile = this.row_header_tiles[r];
      tile.pixel_start.y += delta;
      tile.pixel_end.y += delta;
    }

    for (const column of this.grid_tiles) {
      tile = column[index];
      tile.logical_size.height = height;
      tile.style.height = `${height}px`;
      tile.height = this.dpr * height;
      tile.pixel_end.y += delta;
      if (mark_dirty) {
        tile.dirty = true;
        tile.needs_full_repaint = true;
      }

      for (let i = index + 1; i < column.length; i++) {
        column[i].pixel_start.y += delta;
        column[i].pixel_end.y += delta;
      }
    }

    this.UpdateTotalSize();
    this.UpdateGridTemplates(false, true);
    this.UpdateContentsSize();

  }

  /**
   * do subclass-specific initialization
   */
  public abstract InitializeInternal(container: HTMLElement, scroll_callback: () => void): void;

  /**
   * set resize cursor. this is subclass-specific because it's set on
   * different nodes depending on layout.
   */
  public abstract ResizeCursor(resize?: 'row' | 'column'): void;

  protected abstract UpdateTileGridPosition(tile: Tile): void;
  protected abstract UpdateContainingGrid(): void;
  protected abstract UpdateGridTemplates(columns: boolean, rows: boolean): void;

}
