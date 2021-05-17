
import { DataModel } from './data_model';
import { composite, EventSource, tmpl } from 'treb-utils';
import { Sheet } from './sheet';
import { BaseLayout } from '../layout/base_layout';
import { MouseDrag } from './drag_mask';
import { GridOptions } from './grid_options';
import { Theme } from 'treb-base-types';

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

export interface ScaleEvent {
  type: 'scale';
  action: 'increase'|'decrease'|number;
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

  private node?: HTMLElement;
  private container?: HTMLElement;
  private scale_label?: HTMLElement;
  private scale = 1;

  private dragging = false;

  private double_click_data: {
    index?: number;
    timeout?: any;
  } = {};

  // tslint:disable-next-line: variable-name
  private _visible = false;

  public get visible(): boolean {
    return this._visible;
  }

  constructor(
      private layout: BaseLayout,
      private model: DataModel,
      private options: GridOptions,
      private theme: Theme,
      private grid_container: HTMLElement,
    ) {

    super();

    this.scale = this.options.initial_scale || 1;
    this.Init(grid_container);

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
    this.double_click_data.timeout = setTimeout(() => {
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
      this.grid_container.classList.add('treb-tab-bar-layout');
      this.grid_container.parentElement?.classList.add('has-tab-bar');
      this.container.style.display = 'flex';
    }
    else {
      this.grid_container.classList.remove('treb-tab-bar-layout');
      this.grid_container.parentElement?.classList.remove('has-tab-bar');
      this.container.style.display = 'none';
    }

  }

  /* nothing is painted 
  public UpdateTheme(): void {

    if (!this.node) { return; }

    let font_size = this.theme.tab_bar_font_size || null;

    if (typeof font_size === 'number') {
      font_size = `${font_size}pt`;
    }

    this.node.style.fontFamily = this.theme.tab_bar_font_face || '';
    this.node.style.fontSize = font_size || '';

  }
  */

  public SetActive(tab: HTMLElement, active: boolean): void {
    if (active) {
      tab.classList.add('selected');
      // tab.style.color = this.theme.tab_bar_active_color || '';
      // tab.style.background = this.theme.tab_bar_active_background || '';
    }
    else {
      tab.classList.remove('selected');
      // tab.style.color = this.theme.tab_bar_color || '';
      // tab.style.background = this.theme.tab_bar_background || '';
    }
  }

  /** change scale if we have a scale label */
  public UpdateScale(scale: number) {
    if (this.scale_label) {
      this.scale = scale;
      this.scale_label.textContent = `${Math.round(scale * 1000) / 10}%`;
    }
  }

  /**
   * update tabs from model.
   */
  public Update(): void {

    // this is a hack to normalize behavior if you try to re-order
    // a tab that's not the active tab. what ordinarily happens is
    // we start the drag, but then Update is called again which rebuilds
    // tabs and throws out the old set.

    // at the same time we want to activate on mousedown, not mouseup.
    // so for the time being we just block the rebuild if we are dragging.
    // longer term it's a FIXME.

    if (this.dragging) {
      // console.info('blocked!')
      return;
    }

    if (!this.node) { return; }

    if (this.options.tab_bar === 'auto') {

      const visible_count = this.model.sheets.reduce((count, test) => test.visible ? count + 1 : count, 0);

      if (visible_count <= 1) {
        this.Show(false);
        return;
      }
      this.Show(true);
    }

    this.grid_container.classList.add('treb-tab-bar-layout');
    this.grid_container.parentElement?.classList.add('has-tab-bar');

    const target = this.node;

    // clear
    // target.innerText = '';

    let end_nodes = false;
    const children = Array.prototype.map.call(target.children, (child) => child);
    for (const child of children as HTMLElement[]) {
      if (!child.dataset.preserve) {
        target.removeChild(child);
      }
      else {
        end_nodes = true;
      }
    }

    if (!end_nodes) {
      let div = document.createElement('div');
      div.classList.add('tab-bar-spacer')
      div.style.order = '9998';
      div.dataset.preserve = 'true';
      target.appendChild(div);

      div = document.createElement('div');
      div.classList.add('tab-bar-end');
      div.style.order = '9999';
      div.dataset.preserve = 'true';

      if (this.options.scale_control) {
        const node = document.createElement('div');
        node.classList.add('treb-scale-control');

        let button = document.createElement('button');
        button.innerHTML = composite`
          <svg viewBox='0 0 16 16'>
            <path d='M4,8 h8'/>
          </svg>
        `;

        button.title = 'Decrease scale';
        button.addEventListener('click', () => this.Publish({ type: 'scale', action: 'decrease', }));
        node.appendChild(button);

        this.scale_label = document.createElement('div');
        node.appendChild(this.scale_label);
        this.UpdateScale(this.scale); // so we only have to write the scaling routine once

        button = document.createElement('button');
        button.innerHTML = composite`
          <svg viewBox='0 0 16 16'>
            <path d='M4,8 h8 M8,4 v8'/>
          </svg>
        `;

        button.title = 'Increase scale';
        button.addEventListener('click', () => this.Publish({ type: 'scale', action: 'increase', }));
        node.appendChild(button);

        div.appendChild(node);
      }
 

      target.appendChild(div);
    }

    if (this.options.delete_tab) {
      const tab = document.createElement('div');
      tab.classList.add('delete-tab');
      tab.innerHTML = `<svg viewbox='0 0 16 16'><path d='M4,4 L12,12 M12,4 L4,12'/></svg>`;
      tab.style.order = (-1).toString();
      tab.title = 'Delete current sheet';
      tab.addEventListener('click', () => {
        this.Publish({ type: 'delete-sheet' });
      });
      target.appendChild(tab);
    }

    // store tabs
    const tabs: HTMLElement[] = [];

    for (const sheet of this.model.sheets) {

      if (!sheet.visible) { continue; }

      const index = tabs.length;

      // IE11 won't fire events on an A element? or is that just because
      // of the default display value? (actually I am setting display...)

      // doesn't really matter what the element is, so default to something
      // IE11 will support (sigh)

      const tab = document.createElement('div');
      tab.classList.add('tab');
      tab.style.order = (index * 2).toString();

      this.SetActive(tab, sheet === this.model.active_sheet);

      const mousedown = (event: MouseEvent) => {
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
          this.SetActive(candidate, candidate === tab);
        }

        this.dragging = true;

        MouseDrag(this.layout.mask, [], (move_event) => {

          const [x, y] = [move_event.clientX, move_event.clientY];
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

          // console.info('set false')
          this.dragging = false;

          // the indexes we have are visible tabs only, so we may need
          // to adjust if there are hidden tabs in between.

          for (let i = 0; i < this.model.sheets.length; i++) {
            if (!this.model.sheets[i].visible) {
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

      };

      const doubleclick = () => {
        tab.removeEventListener('mousedown', mousedown);
        tab.removeEventListener('dblclick', doubleclick);
        tab.contentEditable = 'true';

        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(tab);
          selection.addRange(range);
        }

        tab.addEventListener('keydown', (inner_event: KeyboardEvent) => {
          switch (inner_event.key) {
            case 'Enter':
              // const name = tab.innerText.trim();
              this.Publish({ 
                type: 'rename-sheet', 
                name: tab.innerText.trim(), 
                sheet 
              });
              break;

            case 'Escape':
              tab.innerText = sheet.name;
              this.Publish({ type: 'cancel' });
              break;

            default:
              return;
          }
          inner_event.stopPropagation();
          inner_event.preventDefault();
        });

        tab.addEventListener('focusout', () => {
          const name = tab.innerText.trim();
          this.Publish({ type: 'rename-sheet', name, sheet });
        });

        tab.focus();

      };

      // you need the inner span for ellipsis, if we want that

      tab.textContent = sheet.name;
      // tab.innerHTML = `<span>${sheet.name}</span>`;

      tab.addEventListener('dblclick', doubleclick);
      tab.addEventListener('mousedown', mousedown);

      target.appendChild(tab);
      tabs.push(tab);

    }

    if (this.options.add_tab) {

      const add_tab = document.createElement('a');
      add_tab.classList.add('add-tab');
      add_tab.style.order = (this.model.sheets.length * 2).toString();
      add_tab.innerText = '+';
      add_tab.title = 'Add sheet';
      add_tab.addEventListener('click', () => {
        this.Publish({ type: 'add-sheet' });
      });

      // add_tab.style.color = this.theme.tab_bar_color || '';
      // add_tab.style.background = this.theme.tab_bar_background || '';

      target.appendChild(add_tab);

    }

    /*
    if (this.options.delete_tab) {

      const spacer = document.createElement('div');
      spacer.setAttribute('class', 'tab-bar-spacer');
      spacer.style.order = (this.model.sheets.length * 2 + 1).toString();
      target.appendChild(spacer);

      const delete_tab = document.createElement('a');
      delete_tab.classList.add('delete-tab');
      delete_tab.style.order = (this.model.sheets.length * 2 + 2).toString();
      delete_tab.innerText = 'Delete Sheet';
      delete_tab.setAttribute('title', 'Delete Sheet');
      delete_tab.addEventListener('click', () => {
        this.Publish({ type: 'delete-sheet' });
      });

      // delete_tab.style.color = this.theme.tab_bar_color || '';
      // delete_tab.style.background = this.theme.tab_bar_background || '';

      target.appendChild(delete_tab);

    }
    */

  }

  /**
   * initialize, build node structure
   */
  private Init(grid_container: HTMLElement) {

    this.container = document.createElement('div');
    this.container.classList.add('treb-tab-bar-container');
    grid_container.appendChild(this.container);

    this.node = document.createElement('div');
    this.node.classList.add('treb-tab-bar');
    this.container.appendChild(this.node);



    // this.UpdateTheme();

  }

}
