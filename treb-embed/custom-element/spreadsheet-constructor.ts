
import { EmbeddedSpreadsheet } from '../src/embedded-spreadsheet';
import type { EmbeddedSpreadsheetOptions } from '../src/options';

import css from './layout.scss';
import html from './layout.html';

export class SpreadsheetConstructor {

  /** container, if any */
  public root?: HTMLElement;

  /** spreadsheet instance */
  public sheet?: EmbeddedSpreadsheet

  /** inject styles (once) */
  public static stylesheets_attached = false;

  constructor(root?: HTMLElement|string) {
  
    if (typeof root === 'string') {
      root = document.querySelector(root) as HTMLElement;
    }

    if (root instanceof HTMLElement) {
      this.root = root;

      if (!SpreadsheetConstructor.stylesheets_attached) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        SpreadsheetConstructor.stylesheets_attached = true;
      }

    }

  }

  /**
   * get options from node attributes. we're still working on final 
   * semantics but at the moment we'll translate hyphen-separated-options
   * to our standard snake_case_options.
   * 
   * @returns 
   */
  public GetOptions(): Partial<EmbeddedSpreadsheetOptions> {

    const options: Partial<EmbeddedSpreadsheetOptions> = {};

    if (this.root) {

      const names = this.root.getAttributeNames();
      console.info({names});

      for (let name of names) {
        let value: string|boolean|number|null = this.root.getAttribute(name);
        if (value === null || value.toString().toLowerCase() === 'true' || value === '') {
          value = true;
        }
        else {
          const test = Number(value);
          if (!isNaN(test)) {
            value = test;
          }
        }

        name = name.replace(/-/g, '_');
        (options as any)[name] = value;
      }
    }
    
    console.info({options});

    return options;

  }
  
  public AttachElement(options: EmbeddedSpreadsheetOptions = {}) {

    let container: HTMLElement|undefined;

    if (this.root) {
      this.root.innerHTML = html;
      container = this.root.querySelector('.treb-layout-spreadsheet') as HTMLElement;
    }

    this.sheet = new EmbeddedSpreadsheet({
      container,
      storage_key: 'temp',
      tab_bar: 'auto',
      add_tab: true,
      delete_tab: true,
      scale_control: true,
      stats: true,
      ...options,
      ...this.GetOptions(),
    });

    if (!this.root) {
      return; // the rest is UI setup
    }

    const root = this.root; // for async/callback functions

    // call our internal resize method when the node is resized

    if (this.sheet) {
      const resizeObserver = new ResizeObserver(() => this.sheet?.Resize());
      resizeObserver.observe(root);
    }

    // handle sidebar collapse

    const layout_root = root.querySelector('.treb-layout');
    const button = root.querySelector('.treb-toggle-sidebar-button');
    if (button) {
      button.addEventListener('click', () => {

        // attribute is set if it has a value and that value is either
        // empty or "true"; we don't accept any other values, because
        // that just makes extra work.

        const value = layout_root?.getAttribute('collapsed');
        const state = (typeof value === 'string' && (value === '' || value === 'true'));

        // toggle

        if (state) {
          layout_root?.removeAttribute('collapsed');
        }
        else {
          layout_root?.setAttribute('collapsed', '');
        }

      });
    }

    // --- animated ------------------------------------------------------------

    // we swap "animate" for "animated", which has some transition applied. we
    // do this so initial state gets set without transitions.

    const animate = Array.from(root.querySelectorAll('.treb-util-animate'));
    Promise.resolve().then(() => {
      for (const element of animate) {
        element.classList.remove('treb-util-animate');
        element.classList.add('treb-util-animated');
      }
    });
    
    // ...sidebar...

    // ...toolbar...

    // --- resize --------------------------------------------------------------

    const size = { width: 0, height: 0 };
    const position = { x: 0, y: 0 };
    const delta = { x: 0, y: 0 };

    const resize_container = root.querySelector('.treb-layout-resize-container');

    let mask: HTMLElement|undefined;
    let resizer: HTMLElement|undefined;

    const resize_handle = this.root.querySelector('.treb-resize-handle') as HTMLElement;

    /** mouse up handler added to mask (when created) */
    const mouse_up = () => finish();

    /** mouse move handler added to mask (when created) */
    const mouse_move = ((event: MouseEvent) => {
      if (event.buttons === 0) {
        finish();
      }
      else {
        delta.x = event.screenX - position.x;
        delta.y = event.screenY - position.y;
        if (resizer) {
          resizer.style.width = (size.width + delta.x) + 'px';
          resizer.style.height = (size.height + delta.y) + 'px';
        }
      }
    });

    /** clean up mask and layout rectangle */
    const finish = () => {

      // resize_handle.classList.remove('retain-opacity'); // we're not using this anymore

      if (delta.x || delta.y) {
        const rect = root.getBoundingClientRect();
        root.style.width = (rect.width + delta.x) + 'px';
        root.style.height = (rect.height + delta.y) + 'px';
      }

      if (mask) {
        mask.removeEventListener('mouseup', mouse_up);
        mask.removeEventListener('mousemove', mouse_move);
        mask.parentElement?.removeChild(mask);
        mask = undefined;
      }

      resizer?.parentElement?.removeChild(resizer);
      resizer = undefined;

    };

    resize_handle.addEventListener('mousedown', (event: MouseEvent) => {

      event.stopPropagation();
      event.preventDefault();

      resizer = document.createElement('div') as HTMLElement;
      resizer.classList.add('treb-resize-rect');
      document.body.appendChild(resizer);

      mask = document.createElement('div') as HTMLElement;
      mask.classList.add('treb-resize-mask');
      mask.style.cursor = 'nw-resize';
      document.body.appendChild(mask);

      mask.addEventListener('mouseup', mouse_up);
      mask.addEventListener('mousemove', mouse_move);

      // resize_handle.classList.add('retain-opacity'); // we're not using this anymore
              
      position.x = event.screenX;
      position.y = event.screenY;

      delta.x = 0;
      delta.y = 0;

      if (resize_container) {
        // const host_rect = root.getBoundingClientRect() || { left: 0, top: 0 };
        const rect = resize_container.getBoundingClientRect();

          resizer.style.top = // (rect.top - host_rect.top) + 'px';
                              (rect.top) + 'px';
          resizer.style.left = // (rect.left - host_rect.left) + 'px';
                                (rect.left) + 'px';
          resizer.style.width = rect.width + 'px';
          resizer.style.height = rect.height + 'px';

          size.width = rect.width;
          size.height = rect.height;
        }

   
    });

  }

}

