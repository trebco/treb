
import { DataModel } from './data_model';
import { EventSource } from 'treb-utils';
import { Sheet } from './sheet';
import { BaseLayout } from '../layout/base_layout';
import { MouseDrag } from './drag_mask';

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

export interface CancelEvent {
  type: 'cancel';
}

export type TabEvent
   = CancelEvent
   | AddSheetEvent
   | RenameSheetEvent
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
 * do that. right-click is out. ???
 *
 */
export class TabBar extends EventSource<TabEvent> {

  private node?: HTMLElement;

  private double_click_data: {
    index?: number;
    timeout?: any;
  } = {};

  constructor(
      private layout: BaseLayout,
      private model: DataModel,
      grid_container: HTMLElement ) {

    super();
    this.Init(grid_container);

  }

  public IsDoubleClick(index: number, timeout = 300){

    if (this.double_click_data.index === index ) {
      clearTimeout(this.double_click_data.timeout);
      this.double_click_data.index = undefined;
      this.double_click_data.timeout = undefined;
      return true;
    }
    else {
      if (this.double_click_data.timeout) {
        clearTimeout(this.double_click_data.timeout);
      }
      this.double_click_data.index = index;
      this.double_click_data.timeout = setTimeout(() => {
        this.double_click_data.index = undefined;
        this.double_click_data.timeout = undefined;
      }, timeout);
    }

  }

  /**
   * update tabs from model.
   */
  public Update() {

    if (!this.node) { return; }

    // clear
    this.node.innerText = '';

    // store tabs
    const tabs: HTMLElement[] = [];

    // for (const sheet of this.model.sheets) {
    for (let index = 0; index < this.model.sheets.length; index++) {

      const sheet = this.model.sheets[index];

      const tab = document.createElement('a');
      tab.classList.add('tab');
      tab.style.order = (index * 2).toString();

      if (sheet === this.model.active_sheet) {
        tab.classList.add('selected');
      }

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

        }, (end_event) => {
          const current = index;
          const move_before = (order + 1) / 2;

          if ((current === move_before) ||
              (current === 0 && move_before <= 0) ||
              (current === tabs.length - 1 && move_before >= tabs.length - 1)) {

            // didn't change
          }
          else {
            this.Publish({type: 'reorder-sheet', index, move_before});
          }
        });

      };

      const doubleclick = (event: MouseEvent) => {
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
              const name = tab.innerText.trim();
              this.Publish({ type: 'rename-sheet', name, sheet });
              break;

            case 'Escape':
              tab.innerText = sheet.name;
              this.Publish({ type: 'cancel' });
              break;

            default:
              // console.info(event.key);
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

      tab.innerText = sheet.name;

      tab.addEventListener('dblclick', doubleclick);
      tab.addEventListener('mousedown', mousedown);

      this.node.appendChild(tab);
      tabs.push(tab);

    }

    const add_tab = document.createElement('a');
    add_tab.classList.add('add-tab');
    add_tab.style.order = (this.model.sheets.length * 2).toString();
    add_tab.innerText = '+';
    add_tab.addEventListener('click', () => {
      this.Publish({ type: 'add-sheet' });
    });

    this.node.appendChild(add_tab);

  }

  /**
   * initialize, build node structure
   */
  private Init(grid_container: HTMLElement) {

    const container = document.createElement('div');
    container.classList.add('treb-tab-bar-container');
    grid_container.appendChild(container);

    this.node = document.createElement('div');
    this.node.classList.add('treb-tab-bar');
    container.appendChild(this.node);

  }

}
