
import { EmbeddedSpreadsheet } from '../src/embedded-spreadsheet';
import type { EmbeddedSpreadsheetOptions } from '../src/options';

import css from './layout.scss';
import html from './layout.html';
import toolbar_html from './toolbar-layout.html';
import { NumberFormatCache } from 'treb-format';
import { Style, Color } from 'treb-base-types';
import { Measurement } from 'treb-utils';
import type { ToolbarMessage } from '../src/toolbar-message';

interface ElementOptions {
  data: Record<string, string>;
  text: string;
  style: string;
  title: string;
  classes: string|string[];
}

const Element = <T extends HTMLElement>(tag: string, parent?: HTMLElement|DocumentFragment, options: Partial<ElementOptions> = {}): T => {
  const element = document.createElement(tag) as T;
  if (options.classes) {

    // you can't use an array destructure in a ternary expression? TIL

    if (Array.isArray(options.classes)) {
      element.classList.add(...options.classes);
    }
    else {
      element.classList.add(options.classes);
    }

  }
  if (options.title) {
    element.title = options.title;
  }
  if (options.text) {
    element.textContent = options.text;
  }
  if (options.style) {
    element.setAttribute('style', options.style);
  }
  if (options.data) {
    for (const [key, value] of Object.entries(options.data)) {
      element.dataset[key] = value;
    }
  }
  if (parent) {
    parent.appendChild(element);
  }
  return element;
}


export class SpreadsheetConstructor {

  /** container, if any */
  public root?: HTMLElement;

  /** spreadsheet instance */
  public sheet?: EmbeddedSpreadsheet

  /** inject styles (once) */
  public static stylesheets_attached = false;

  // 

  /** current border color. will be applied to new borders. */
  protected border_color?: Style.Color;

  /** color bar elements, since we update them frequently */
  protected color_bar_elements: Record<string, HTMLElement> = {};

  /** some menu buttons change icons from time to time */
  protected replace_targets: Record<string, HTMLElement> = {};

  /** root layout element */
  protected layout_element?: HTMLElement;

  /** cached controls */
  protected toolbar_controls: Record<string, HTMLElement> = {};

  /** swatch lists in color chooser */
  protected swatch_lists: {
    theme?: HTMLDivElement,
    other?: HTMLDivElement,
  } = {};

  // 

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
  public ParseOptionAttributes(): Partial<EmbeddedSpreadsheetOptions> {

    const options: Partial<EmbeddedSpreadsheetOptions> = {};

    if (this.root) {

      const names = this.root.getAttributeNames();
      // console.info({names});

      for (let name of names) {
        let value: string|boolean|number|null = this.root.getAttribute(name);
        if (value === null || value.toString().toLowerCase() === 'true' || value === '') {
          value = true;
        }
        else if (value.toLowerCase() === 'false') {
          value = false;
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
    
    // console.info({options});

    return options;

  }
  
  /**
   * attach content to element. for custom elements, this is called via 
   * the connectedCallback call. for elements created with the API, we 
   * call it immediately.
   */
  public AttachElement(options: EmbeddedSpreadsheetOptions = {}) {

    let container: HTMLElement|undefined;

    if (this.root) {
      this.root.innerHTML = html;
      container = this.root.querySelector('.treb-layout-spreadsheet') as HTMLElement;
    }

    options = {
      ...this.ParseOptionAttributes(),
      ...options,
      container,
    };

    // set a local variable so we don't have to keep testing the member

    const sheet = new EmbeddedSpreadsheet(options);

    console.info(sheet.options);

    this.sheet = sheet;

    if (!this.root) {
      return; // the rest is UI setup
    }

    const root = this.root; // for async/callback functions

    // call our internal resize method when the node is resized

    const resizeObserver = new ResizeObserver(() => sheet.Resize());
    resizeObserver.observe(root);

    // handle sidebar collapse

    this.layout_element = root.querySelector('.treb-layout') as HTMLElement;
    const button = root.querySelector('.treb-toggle-sidebar-button');

    if (button && this.layout_element) {
      const element = this.layout_element;
      button.addEventListener('click', () => {

        // attribute is set if it has a value and that value is either
        // empty or "true"; we don't accept any other values, because
        // that just makes extra work.

        const value = element.getAttribute('collapsed');
        const state = (typeof value === 'string' && (value === '' || value === 'true'));

        // toggle

        if (state) {
          element.removeAttribute('collapsed');
        }
        else {
          element.setAttribute('collapsed', '');
        }

      });
    }

    // --- set initial state before enabling transitions -----------------------

    if (sheet.options.toolbar === 'show') {
      this.layout_element?.setAttribute('toolbar', '');
    }
    if (sheet.options.collapsed) {
      this.layout_element?.setAttribute('collapsed', '');
    }
    
    // --- animated ------------------------------------------------------------

    // we swap "animate" for "animated", which has some transition applied. we
    // do this so initial state gets set without transitions.

    const animate = Array.from(root.querySelectorAll('.treb-animate'));
    Promise.resolve().then(() => {
      for (const element of animate) {
        element.classList.remove('treb-animate');
        element.classList.add('treb-animated');
      }
    });
    
    const sidebar = root.querySelector('.treb-layout-sidebar');
    sidebar?.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.dataset.command) {
        switch (target.dataset.command) {

          case 'toggle-toolbar':
            this.ToggleToolbar();
            break;

          default:
            sheet.HandleToolbarMessage({
              command: target.dataset.command,
            } as ToolbarMessage);
            break;
        }
      }
    });

    this.AttachToolbar(sheet, root);
   
    // --- hide/remove ---------------------------------------------------------

    // compare conditional items against options. not sure which way we're 
    // ultimately going to land with the option names. for the time being 
    // I'm going to do this the verbose way.

    const conditional_map: Record<string, boolean> = {
      'file-menu': !!sheet.options.file_menu,
      'table-button': !!sheet.options.table_button,
      'chart-menu': !!sheet.options.chart_menu,
      'font-scale': !!sheet.options.font_scale,
      'add-tab': !!sheet.options.add_tab,
      'delete-tab': !!sheet.options.delete_tab,
      'stats': !!sheet.options.stats,
      'revert': !!sheet.options.revert_button,
      'resize': !!sheet.options.resizable,
    }

    for (const [key, value] of Object.entries(conditional_map)) {
      if (!value) {
        const elements = this.layout_element.querySelectorAll(`[data-conditional=${key}]`) as NodeListOf<HTMLElement>;
        for (const element of Array.from(elements)) {
          element.style.display = 'none';
        }
      }
    }

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

      resizer = Element<HTMLDivElement>('div', document.body, { classes: 'treb-resize-rect' });

      // resizer = document.createElement('div') as HTMLElement;
      // resizer.classList.add('treb-resize-rect');
      // document.body.appendChild(resizer);

      // mask = document.createElement('div') as HTMLElement;
      // mask.classList.add('treb-resize-mask');
      // mask.style.cursor = 'nw-resize';
      // document.body.appendChild(mask);

      mask = Element<HTMLDivElement>('div', document.body, { classes: 'treb-resize-mask', style: 'cursor: nw-resize;' });

      mask.addEventListener('mouseup', mouse_up);
      mask.addEventListener('mousemove', mouse_move);

      // resize_handle.classList.add('retain-opacity'); // we're not using this anymore
              
      position.x = event.screenX;
      position.y = event.screenY;

      delta.x = 0;
      delta.y = 0;

      if (resize_container) {

        const rect = resize_container.getBoundingClientRect();

        resizer.style.top = (rect.top) + 'px';
        resizer.style.left = (rect.left) + 'px';
        resizer.style.width = (rect.width) + 'px';
        resizer.style.height = (rect.height) + 'px';

        size.width = rect.width;
        size.height = rect.height;
      }
   
    });

  }

  public ToggleToolbar() {

    if (this.layout_element) {
      const value = this.layout_element.getAttribute('toolbar');
      const state = (typeof value === 'string' && (value === '' || value === 'true'));

      if (state) {
        this.layout_element.removeAttribute('toolbar');
      }
      else {
        this.layout_element.setAttribute('toolbar', '');
      }

    }
      
  }

  public UpdateSelectionStyle(sheet: EmbeddedSpreadsheet, toolbar: HTMLElement, comment_box: HTMLTextAreaElement) {

    const state = sheet.selection_state;

    // unset all 

    comment_box.value = '';

    for (const [key, value] of Object.entries(this.toolbar_controls)) {
      if (value) {
        value.classList.remove('treb-active');
      }
      else {
        console.info('missing?', key);
      }
    }

    const Activate = (element?: HTMLElement) => {
      element?.classList.add('treb-active');
    };

    if (state.comment) {
      Activate(this.toolbar_controls.comment);
      comment_box.value = state.comment;
    }

    if (state.style?.locked) {
      Activate(this.toolbar_controls.locked);
    }

    if (state.frozen) {
      Activate(this.toolbar_controls.freeze);
    }

    if (state.style?.wrap) {
      Activate(this.toolbar_controls.wrap);
    }

    if (this.toolbar_controls.table) {
      if (state.table) {
        Activate(this.toolbar_controls.table);
        this.toolbar_controls.table.dataset.command = 'remove-table';
      }
      else {
        this.toolbar_controls.table.dataset.command = 'insert-table';
      }
    }

    if (this.toolbar_controls.merge) {
      if (state.merge) {
        Activate(this.toolbar_controls.merge);
        this.toolbar_controls.merge.dataset.command = 'unmerge-cells';
      }
      else {
        this.toolbar_controls.merge.dataset.command = 'merge-cells';
      }
    }

    const format = this.toolbar_controls.format as HTMLInputElement;
    if (format) {
      if (state.style?.number_format) {
        format.value = NumberFormatCache.SymbolicName(state.style.number_format) || state.style.number_format;
      }
      else {
        format.value = 'General'; 
      }
    }

    const scale = this.toolbar_controls.scale as HTMLInputElement;
    if (scale) {
      scale.value = sheet.FormatNumber(state.relative_font_size || 1, '0.00');
    }

    switch (state.style?.horizontal_align) {
      case Style.HorizontalAlign.Left:
        Activate(this.toolbar_controls.left);
        break;  
      case Style.HorizontalAlign.Center:
        Activate(this.toolbar_controls.center);
        break;
      case Style.HorizontalAlign.Right:
        Activate(this.toolbar_controls.right);
        break;
    }
    
    switch (state.style?.vertical_align) {
      case Style.VerticalAlign.Top:
        Activate(this.toolbar_controls.top);
        break;  
      case Style.VerticalAlign.Middle:
        Activate(this.toolbar_controls.middle);
        break;
      case Style.VerticalAlign.Bottom:  
        Activate(this.toolbar_controls.bottom);
        break;
    }

  }


  public UpdateDocumentStyles(sheet: EmbeddedSpreadsheet, format_menu: HTMLElement) {

    // --- colors -------------------------------------------------------------
    
    {
      
      let fragment = document.createDocumentFragment();
     
      const length = sheet.document_styles.theme_colors.length;
      const themes = ['Background', 'Text', 'Background', 'Text', 'Accent'];

      if (length) {
        const depth = sheet.document_styles.theme_colors[0].length;

        for (let i = 0; i < depth; i++) {
          for (let j = 0; j < length; j++) {
            const entry = sheet.document_styles.theme_colors[j][i];
            const style = `background: ${entry.resolved};`;
            let title = themes[j] || themes[4];
            if (entry.color.tint) {
              title += ` (${Math.abs(entry.color.tint) * 100}% ${ entry.color.tint > 0 ? 'lighter' : 'darker'})`;
            }
            else {
              
              // set theme default colors

              if (j === 0) {
                this.color_bar_elements.fill?.style.setProperty('--treb-default-color', entry.resolved);
              }
              else if (j === 1) {
                this.color_bar_elements.text?.style.setProperty('--treb-default-color', entry.resolved);
                this.color_bar_elements.border?.style.setProperty('--treb-default-color', entry.resolved);
              }

            }
            Element<HTMLButtonElement>('button', fragment, { style, title, data: { command: 'set-color', color: JSON.stringify(entry.color) } });
          }
        }

      }

      this.swatch_lists.theme?.replaceChildren(fragment);

      fragment = document.createDocumentFragment();
      Element<HTMLButtonElement>('button', fragment, { 
        classes: 'treb-default-color',
        title: 'Default color', 
        data: { command: 'set-color', color: JSON.stringify({}) },
       });

      const colors = ['Black', 'White', 'Gray', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet'];

      const lc = colors.map(color => color.toLowerCase());
      const additional_colors = sheet.document_styles.colors.filter(test => {
        return !lc.includes(test.toLowerCase());
      });

      for (const text of [...colors, ...additional_colors]) {
        const style = `background: ${text.toLowerCase()};`;
        Element<HTMLButtonElement>('button', fragment, { style, title: text, data: { command: 'set-color', color: JSON.stringify({text: text.toLowerCase()})}});
      }

      this.swatch_lists.other?.replaceChildren(fragment);

    }

    // --- number formats -----------------------------------------------------

    const number_formats: string[] = [
      'General', 'Number', 'Integer', 'Percent', 'Fraction', 'Accounting', 'Currency', 'Scientific',
    ];

    const date_formats: string[] = [
      'Timestamp', 'Long Date', 'Short Date',
    ];

    for (const format of sheet.document_styles.number_formats) {
      if (NumberFormatCache.SymbolicName(NumberFormatCache.Translate(format))) { continue; }
      const instance = NumberFormatCache.Get(format);
      if (instance.date_format) {
        date_formats.push(format);
      }
      else {
        number_formats.push(format);
      }
    }

    const Button = (format: string) => {
      return Element<HTMLButtonElement>('button', undefined, {
        text: format, data: { format, command: 'number-format' },
      });
    };

    const fragment = document.createDocumentFragment();
    fragment.append(...number_formats.map(format => Button(format)));

    const separator = document.createElement('div');
    separator.classList.add('separator');
    fragment.append(separator);

    fragment.append(...date_formats.map(format => Button(format)));

    format_menu.textContent = '';
    format_menu.append(fragment);
    
  }

  public AttachToolbar(sheet: EmbeddedSpreadsheet, root: HTMLElement) {

    // --- layout --------------------------------------------------------------

    const scroller = root.querySelector('.treb-layout-header') as HTMLElement;
    const toolbar = root.querySelector('.treb-toolbar') as HTMLElement;
    
    toolbar.innerHTML = toolbar_html;

    const color_chooser = toolbar.querySelector('.treb-color-chooser') as HTMLElement;
    const comment_box = toolbar.querySelector('.treb-comment-box textarea') as HTMLTextAreaElement;

    // --- controls ------------------------------------------------------------
    
    for (const [key, value] of Object.entries({

        'top': '[data-command=align-top]',
        'middle': '[data-command=align-middle]',
        'bottom': '[data-command=align-bottom]',

        'left': '[data-command=justify-left]',
        'right': '[data-command=justify-right]',
        'center': '[data-command=justify-center]',

        'wrap': '[data-command=wrap-text]',
        'merge': '[data-id=merge]',
        'comment': '[data-icon=comment]',        
        'locked': '[data-command=lock-cells]',
        'freeze': '[data-command=freeze-panes]',
        'table': '[data-icon=table]',

        'format': 'input.treb-number-format',
        'scale': 'input.treb-font-scale',

      })) {

      const element = toolbar.querySelector(value) as HTMLElement;
      if (!element) {
        console.warn('missing toolbar element', value);
      }

      this.toolbar_controls[key] = element;
    }

    const swatch_lists = color_chooser.querySelectorAll('.treb-swatches');
    this.swatch_lists = {
      theme: swatch_lists[0] as HTMLDivElement,
      other: swatch_lists[1] as HTMLDivElement,
    };

    let button = root.querySelector('[data-command=increase-precision') as HTMLElement;
    if (button) {
      button.textContent = this.sheet?.FormatNumber(0, '0.00') || '';
    }

    button = root.querySelector('[data-command=decrease-precision') as HTMLElement;
    if (button) {
      button.textContent = this.sheet?.FormatNumber(0, '0.0') || '';
    }

    button = toolbar.querySelector('[data-command=update-comment]') as HTMLButtonElement;
    comment_box.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey)) {
        button.click();
      }
    });

    for (const entry of ['border', 'annotation']) {
      this.replace_targets[entry] = toolbar.querySelector(`[data-target=${entry}`) as HTMLElement;
    }

    for (const entry of ['fill', 'text', 'border']) {
      this.color_bar_elements[entry] = toolbar.querySelector(`[data-color-bar=${entry}]`) as HTMLElement;
    }

    //
    // unified click handler for toolbar controls
    //
    toolbar.addEventListener('click', event => {

      const target = event.target as HTMLElement;
      const data: {
        comment?: string;
        color?: Style.Color;
      } = {};
      let command = target?.dataset.command;

      if (command) {

        // we may need to replace an icon in the toolbar
        const replace = (target.parentElement as HTMLElement)?.dataset.replace;
        if (replace) {
          const replace_target = this.replace_targets[replace];
          if (replace_target) {
            replace_target.dataset.command = command;
          }
        }

        // for borders, if we have a cached border color add that to the event data
        if (/^border-/.test(command)) {
          data.color = this.border_color || {};
        }

        switch (command) {
          case 'set-color':

            // swap command
            command = color_chooser.dataset.colorCommand || '';

            // convert string to color
            data.color = {};
            try {
              data.color = JSON.parse(target.dataset.color || '{}');
            }
            catch (err) {
              console.error(err);
            }

            // cache for later
            if (command === 'border-color') {
              this.border_color = data.color;
            }

            // update color bar
            if (color_chooser.dataset.target) {
              const replace = this.color_bar_elements[color_chooser.dataset.target];
              if (replace) {
                replace.style.setProperty('--treb-color-bar-color', target.style.backgroundColor);
                replace.dataset.color = target.dataset.color || '{}';
              }
            }

            break;

          case 'update-comment':
            data.comment = comment_box.value;
            break;
        }

        sheet.HandleToolbarMessage({
          command,
          data: {...target.dataset, ...data},
        } as ToolbarMessage);
      }

    });

    // color chooser

    const color_input = color_chooser.querySelector('input') as HTMLInputElement;
    const color_button = color_chooser.querySelector('input + button') as HTMLButtonElement;

    color_input.addEventListener('input', (event: Event) => {

      if (event instanceof InputEvent && event.isComposing) {
        return;
      }

      color_button.style.background = color_input.value || '';

      // this is a check for "did it resolve properly"
      const resolved = color_button.style.backgroundColor || '#fff';
      const bytes = Measurement.MeasureColor(resolved);
      const hsl = Color.RGBToHSL(bytes[0], bytes[1], bytes[2]);

      // light or dark based on background
      color_button.style.color = (hsl.l > .5) ? '#000' : '#fff';

      // color for command
      color_button.dataset.color = JSON.stringify(
        color_button.style.backgroundColor ? { text: color_button.style.backgroundColor } : {});

    });

    color_input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.stopPropagation();
        event.preventDefault();

        color_button.click();
      }
    });

    // --- menus ---------------------------------------------------------------

    // since we are positioning menus with script, they'll get detached 
    // if you scroll the toolbar. we could track scrolling, but it makes 
    // as much sense to just close any open menu.

    scroller.addEventListener('scroll', () => sheet.Focus());

    // positioning on focusin will catch keyboard and mouse navigation

    root.addEventListener('focusin', event => {

      const target = event.target as HTMLElement;
      const parent = target?.parentElement;

      if (parent?.classList.contains('treb-menu')) {

        // we're sharing the color chooser, drop it in to 
        // the target if this is a color menu

        if (parent.dataset.colorCommand) {
          parent.appendChild(color_chooser);
          color_chooser.dataset.colorCommand = parent.dataset.colorCommand;
          color_chooser.dataset.target = parent.dataset.replaceColor || '';
        }

        const menu = parent.querySelector('div') as HTMLElement;

        const scroller_rect = scroller.getBoundingClientRect();
        const target_rect = target.getBoundingClientRect();

        let { left } = target_rect;

        // for composite controls, align to the first component
        // (that only needs to apply on left-aligning)

        const group = parent.parentElement;

        if (group?.classList.contains('treb-composite')) {
          const element = group.firstElementChild as HTMLElement;
          const rect = element.getBoundingClientRect();
          left = rect.left;
        }

        const menu_rect = menu.getBoundingClientRect();

        if (parent.classList.contains('treb-submenu')) {

          menu.style.top = (target_rect.top - menu_rect.height / 2) + 'px';
          
          if (left + target_rect.width + 6 + menu_rect.width > scroller_rect.right) {
            menu.style.left = (left - 6 - menu_rect.width) + 'px'; 
          }
          else {           
            menu.style.left = (left + target_rect.width + 6) + 'px'; 
          }

        }
        else {
          menu.style.top = ''; // inherit

          // right-align if we would overflow the toolbar

          if (left + menu_rect.width > scroller_rect.right - 6) {
            menu.style.left = (target_rect.right - menu_rect.width) + 'px';
          }
          else {
            menu.style.left = left + 'px';
          }

        }

      }

    });

    const format_menu = this.root?.querySelector('.treb-number-format-menu') as HTMLElement;
    if (format_menu) {

      // the first time we call this (now) we want to get the default
      // colors for text, fill, and border to set buttons.

      this.UpdateDocumentStyles(sheet, format_menu);
      this.UpdateSelectionStyle(sheet, toolbar, comment_box);

      sheet.Subscribe(event => {
        switch (event.type) {
          case 'data':
          case 'document-change':
          case 'load':
          case 'reset':
            this.UpdateDocumentStyles(sheet, format_menu);
            this.UpdateSelectionStyle(sheet, toolbar, comment_box);
            break;

          case 'selection':
            this.UpdateSelectionStyle(sheet, toolbar, comment_box);
            break;
        }
      });

    }

  }

}

