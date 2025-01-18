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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import type { DataModel, ViewModel, Sheet } from 'treb-data-model';
import { EventSource } from 'treb-utils';
import type { BaseLayout } from '../layout/base_layout';
import { MouseDrag } from './drag_mask';
import type { GridOptions } from './grid_options';
import { type ScaleEvent, ScaleControl } from './scale-control';
import { DOMContext, ResolveThemeColor, type Theme } from 'treb-base-types';

export interface ActivateSheetEvent {
  type: 'activate-sheet';
  sheet: Sheet;
}

export interface RenameSheetEvent {
  type: 'rename-sheet';
  sheet: Sheet;
  name: string;
}

export interface ReorderSheetEvent {
  type: 'reorder-sheet';
  index: number;
  move_before: number;
}

export interface AddSheetEvent {
  type: 'add-sheet';
}

export interface DeleteSheetEvent {
  type: 'delete-sheet';
}

export interface CancelEvent {
  type: 'cancel';
}

export type TabEvent
   = CancelEvent
   | ScaleEvent
   | AddSheetEvent
   | RenameSheetEvent
   | DeleteSheetEvent
   | ReorderSheetEvent
   | ActivateSheetEvent
   ;

export interface StatsEntry {
  label: string;
  value: string;
}

/**
 * tabs for multiple sheets. at the bottom, atm (FIXME: options?)
 *
 * rename tabs (sheets) by double-clicking. this triggers a global
 * rename over all cells and annotations.
 *
 * reorder tabs by dragging. reorders the array, but order is not
 * material to any other module, so it's basically just housekeeping.
 *
 * add a new tab with a special (+) tab (last).
 *
 * FIXME: delete tabs... add an (x) to each tab? don't really want to
 * do that. right-click is out. ??? [A: toolbar menu]
 *
 */
export class TabBar extends EventSource<TabEvent> {

  // private container?: HTMLElement;
  private tab_container?: HTMLElement;
  private scale_control?: ScaleControl;
  private stats_panel?: HTMLDivElement;

  private dragging = false;

  private double_click_data: {
    index?: number;
    timeout?: number;
  } = {};

  private tab_color_cache: Map<number, { background: string, foreground: string }> = new Map();

  // tslint:disable-next-line: variable-name
  private _visible = false;

  public get visible(): boolean {
    return this._visible;
  }

  public set stats_data(value: StatsEntry[]) {
    if (this.stats_panel) {
      this.stats_panel.innerText = ''; // clear
      for (const entry of value) {

        this.DOM.Create('span', 'treb-stats-label', this.stats_panel, {
          text: entry.label
        });

        this.DOM.Create('span', 'treb-stats-value', this.stats_panel, {
          text: entry.value,
        });

      }
    }
  }

  private container: HTMLElement;

  private DOM: DOMContext;

  constructor(
      private layout: BaseLayout,
      private model: DataModel,
      private view: ViewModel,
      private options: GridOptions,
      private theme: Theme,
      // private container: HTMLElement,
      view_node: HTMLElement,
    ) {

    super();

    this.DOM = DOMContext.GetInstance(view_node.ownerDocument);

    this.container = view_node.querySelector('.treb-spreadsheet-footer') as HTMLElement;
    if (!this.container) {
      throw new Error('missing container for tab bar');
    }

    // if we're here, we have a tab bar. show unless we're on auto
    if (options.tab_bar !== 'auto') {
      this.container.removeAttribute('hidden');
    }
    
    this.tab_container = this.container.querySelector('.treb-spreadsheet-tabs') as HTMLDivElement;

    this.container.addEventListener('click', event => {
      const command = (event.target as HTMLElement)?.dataset.command;
      if (command) {
        event.stopPropagation();
        event.preventDefault();
        switch (command) {
          case 'add-tab':
            this.Publish({ type: 'add-sheet' });
            break;

          case 'delete-tab':
            this.Publish({ type: 'delete-sheet' });
            break;

          default:
            console.info('unhandled command', command);
        }
      }
    });

    if (this.options.stats) {
      this.stats_panel = this.container.querySelector('.treb-stats-panel') as HTMLDivElement;
    }

    if (this.options.scale_control) {
      const div = this.container.querySelector('.treb-scale-control') as HTMLDivElement;
      this.scale_control = new ScaleControl(div);
      this.scale_control.Subscribe((event: ScaleEvent) => {
        this.Publish(event);
      });
      this.UpdateScale(this.options.initial_scale || 1); // so we only have to write the scaling routine once
    }

  }

  public IsDoubleClick(index: number, timeout = 300): boolean {

    if (this.double_click_data.index === index ) {
      clearTimeout(this.double_click_data.timeout);
      this.double_click_data.index = undefined;
      this.double_click_data.timeout = undefined;
      return true;
    }

    if (this.double_click_data.timeout) {
      clearTimeout(this.double_click_data.timeout);
    }
    this.double_click_data.index = index;

    // I don't think the window instance matters for this,
    // but perhaps it's worth using DOM just for consistency

    this.double_click_data.timeout = window.setTimeout(() => {
      this.double_click_data.index = undefined;
      this.double_click_data.timeout = undefined;
    }, timeout);

    return false;

  }

  public Hide(): void {
    this.Show(false);
  }

  public Show(show = true): void {
    if (!this.container) { return; }

    this._visible = show;

    if (show) {
      this.container.removeAttribute('hidden');
    }
    else {
      this.container.setAttribute('hidden', '');
    }

  }

  public SetActive(tab: HTMLElement, active: boolean, user = false): void {

    if (active) {
      // tab.classList.add('treb-selected');
      tab.setAttribute('selected', '');

      if (tab.dataset.background_color) {
        tab.style.backgroundColor = `color-mix(in srgb, ${tab.dataset.background_color} 20%, var(--treb-tab-bar-active-tab-background, #fff))`;
        tab.style.color = '';
      }

      // this is forcing the page to scroll if the sheet is below
      // the fold. this is not useful behavior. at the same time, 
      // we do need this to work... we probably have to do it manually
      // instead of using scrollIntoView. would be nice if we could
      // toggle this on manual/auto, so user clicks would still be 
      // smooth. call that a TODO

      requestAnimationFrame(() => {
        if (user) {
          tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest'});
        }
        else {
          if (tab.parentElement) {
            const left = tab.offsetLeft;
            const width = tab.offsetWidth;
            const container_width = tab.parentElement.clientWidth || 0;
            const scroll_left = tab.parentElement.scrollLeft || 0;

            if (left > container_width) {
              tab.parentElement.scrollLeft = left - width;
            }
            else if (scroll_left > left) {
              tab.parentElement.scrollLeft = left;
            }

          }
        }
      });

    }
    else {
      // tab.classList.remove('treb-selected');
      tab.removeAttribute('selected');
      if (tab.dataset.background_color) {
        tab.style.backgroundColor = tab.dataset.background_color;
      }
      if (tab.dataset.foreground_color) {
        tab.style.color = tab.dataset.foreground_color;
      }
    }
  }

  /** change scale if we have a scale label */
  public UpdateScale(scale: number): void {
    this.scale_control?.UpdateScale(scale * 100);
  }

  public DoubleClickTab(event: MouseEvent, tab: HTMLElement, sheet: Sheet) {

    tab.contentEditable = 'true';

    if (this.DOM.doc) {

      const selection = this.DOM.GetSelection(); 

      if (selection) {
        selection.removeAllRanges();
        const range = this.DOM.doc.createRange();
        range.selectNodeContents(tab);
        selection.addRange(range);
      }

    }

    tab.addEventListener('keydown', (inner_event: KeyboardEvent) => {
      switch (inner_event.key) {
        case 'Enter':
          // const name = tab.innerText.trim();
          this.Publish({ 
            type: 'rename-sheet', 
            name: tab.innerText.trim(), 
            sheet,
          });
          break;

        case 'Escape':
          tab.innerText = sheet.name;
          this.Publish({ type: 'cancel' });
          this.Update(true);
          break;

        default:
          return;
      }
      inner_event.stopPropagation();
      inner_event.preventDefault();
    });

    tab.addEventListener('focusout', () => {
      const name = tab.innerText.trim();
      if (name !== sheet.name) {
        this.Publish({ type: 'rename-sheet', name, sheet });
      }
      else {
        this.Update(true);
      }
    });

    tab.focus();

  }

  public MouseDownTab(event: MouseEvent, tab: HTMLElement, sheet: Sheet, index: number, tabs: HTMLElement[]) {

    event.stopPropagation();
    event.preventDefault();
    
    if (this.IsDoubleClick(index)) {
      return; // seems to allow us to process double clicks normally...
    }

    this.Publish({ type: 'activate-sheet', sheet });

    let rectangles = tabs.map((element) => element.getBoundingClientRect());

    let order = index * 2 - 1;

    // orginal
    const left = rectangles[0].left;
    const right = rectangles[rectangles.length - 1].right;
    const top = rectangles[0].top;
    const bottom = rectangles[0].bottom;

    const min = -1;
    const max = (rectangles.length - 1) * 2 + 1;

    // see above re: dragging and activation. if the tabs aren't rebuilt,
    // then the classes won't change.

    for (const candidate of tabs) {
      this.SetActive(candidate, candidate === tab, true);
    }

    this.dragging = true;

    // ghost is a good idea but we need to delay it, because 
    // it starts to flicker if you just click a tab to select
    // it (or double click to rename)

    /*
    const ghost = document.createElement('div');
    ghost.classList.add('ghost-tab');
    ghost.appendChild(tab.cloneNode(true));
    ghost.style.top = '-1000px';
    this.layout.mask.appendChild(ghost);
    */

    MouseDrag(this.layout.mask, [], (move_event) => {

      const [x, y] = [move_event.clientX, move_event.clientY];

      /*
      ghost.style.top = `${y}px`;
      ghost.style.left = `${x}px`;
      */

      if (y > top && y < bottom) {
        let new_order = order;
        if (x < left) { new_order = min; }
        else if (x > right) { new_order = max; }
        else {
          for (let i = 0; i < rectangles.length; i++) {
            const rectangle = rectangles[i];
            if (x >= rectangle.left && x <= rectangle.right) {
              if (i !== index) {
                if (x >= rectangle.left + rectangle.width / 2) {
                  new_order = (i * 2) + 1;
                }
                else {
                  new_order = (i * 2) - 1;
                }
              }
              break;
            }
          }
        }
        if (new_order !== order) {
          order = new_order;
          tab.style.order = order.toString();
          rectangles = tabs.map((element) => element.getBoundingClientRect());
        }
      }

    }, () => {
      let current = index;
      let move_before = (order + 1) / 2;

      /*
      this.layout.mask.removeChild(ghost);
      */

      // console.info('set false')
      this.dragging = false;

      // the indexes we have are visible tabs only, so we may need
      // to adjust if there are hidden tabs in between.

      for (let i = 0; i < this.model.sheets.length; i++) {
        if (!this.model.sheets.list[i].visible) {
          if (current >= i) { current++; }
          if (move_before >= i) { move_before++; }
        }
      }

      if ((current === move_before) ||
          (current === 0 && move_before <= 0) ||
          (current === tabs.length - 1 && move_before >= tabs.length - 1)) {

        // didn't change
      }
      else {
        this.Publish({type: 'reorder-sheet', index: current, move_before});
      }
    });


  }

  public UpdateTheme() {
    this.tab_color_cache.clear();
    this.Update();
  }

  /**
   * update tabs from model.
   * 
   * @param user - this is a user action, so use smooth scrolling
   * when activating the tab. otherwise it's automatic so jump.
   */
  public Update(user = false): void {

    this.tab_color_cache.clear(); // we're setting tab color but it's not getting updated otherwise

    // this is a hack to normalize behavior if you try to re-order
    // a tab that's not the active tab. what ordinarily happens is
    // we start the drag, but then Update is called again which rebuilds
    // tabs and throws out the old set.

    // at the same time we want to activate on mousedown, not mouseup.
    // so for the time being we just block the rebuild if we are dragging.
    // longer term it's a FIXME.

    if (this.dragging) {
      return;
    }

    if (this.options.tab_bar === 'auto') {
      const visible_count = this.model.sheets.list.reduce((count, test) => test.visible ? count + 1 : count, 0);
      if (visible_count <= 1) {
        this.Show(false);
        return;
      }
      this.Show(true);
    }

    if (!this.tab_container) {
      return;
    }

    // clear
    this.tab_container.innerText = '';

    // we need to pass the full array to the drag function, so collect them
    const tabs: HTMLElement[] = [];

    for (const sheet of this.model.sheets.list) {

      if (!sheet.visible) { continue; }

      const index = tabs.length;
      const tab = this.DOM.Create('li');
      tab.setAttribute('tabindex', '0');

      if (sheet.tab_color) {
        const id = sheet.id;
        if (!this.tab_color_cache.has(id)) {
          const background = ResolveThemeColor(this.theme, sheet.tab_color);
          const foreground = ResolveThemeColor(this.theme, { offset: sheet.tab_color });
          if (background && foreground) {
            this.tab_color_cache.set(id, { background, foreground });
          }
        }
        const color = this.tab_color_cache.get(id);
        if (color) {
          tab.style.backgroundColor = color.background;
          tab.style.color = color.foreground;
          tab.dataset.background_color = color.background;
          tab.dataset.foreground_color = color.foreground;
        }
      }

      // tab.classList.add('tab');
      tab.style.order = (index * 2).toString();
      tab.role = 'tab';

      this.SetActive(tab, sheet === this.view.active_sheet, user);

      const mousedown = (event: MouseEvent) => this.MouseDownTab(event, tab, sheet, index, tabs);

      const doubleclick = (event: MouseEvent) => {
        tab.removeEventListener('mousedown', mousedown);
        tab.removeEventListener('dblclick', doubleclick);
        this.DoubleClickTab(event, tab, sheet);
      };

      // you need the inner span for ellipsis, if we want that

      tab.textContent = sheet.name;
      // tab.innerHTML = `<span>${sheet.name}</span>`;

      tab.addEventListener('dblclick', doubleclick);
      tab.addEventListener('mousedown', mousedown);

      this.tab_container.appendChild(tab);
      tabs.push(tab);

    }

  }

}
