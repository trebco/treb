
import { EmbeddedSpreadsheet } from '../embedded-spreadsheet';
import type { EmbeddedSpreadsheetOptions } from '../options';

import css from '../../style/treb-spreadsheet-element.scss';
import html from '../../markup/layout.html';
import toolbar_html from '../../markup/toolbar.html';

import { NumberFormatCache } from 'treb-format';
import { ColorFunctions, type Color } from 'treb-base-types';
import { Measurement } from 'treb-utils';
import type { ToolbarMessage } from '../toolbar-message';

import { DOMContext } from 'treb-base-types';

/** with a view towards i18n */
const default_titles: Record<string, string> = {

  close_dialog: 'Close dialog',
  insert_function: 'Insert function...',
  delete_sheet: 'Delete current sheet',
  add_sheet: 'Add sheet',
  document_modified: 'This document has been modified from the original version.',
  recalculate: 'Recalculate',
  toggle_toolbar: 'Toggle toolbar',
  export: 'Export as XLSX',
  revert: 'Revert to original version',
  about: `What's this?`,
  toggle_sidebar: 'Toggle sidebar',

};

/** @internal */
export class SpreadsheetConstructor<USER_DATA_TYPE = unknown> {

  /** container, if any */
  public root?: HTMLElement;

  /** spreadsheet instance */
  public sheet?: EmbeddedSpreadsheet<USER_DATA_TYPE>;

  /** current border color. will be applied to new borders. */
  protected border_color?: Color;

  /** color bar elements, since we update them frequently */
  protected color_bar_elements: Record<string, HTMLElement> = {};

  /** some menu buttons change icons from time to time */
  protected replace_targets: Record<string, HTMLElement> = {};

  /** root layout element */
  protected layout_element?: HTMLElement;

  /** views container */
  protected views?: HTMLElement;

  /** 
   * handle to the revert button, so we can adjust it. we can use
   * container classes for the most part but we are updating the title.
   * (FIXME: double-up the button, no reference required)
   */
  protected revert_button?: HTMLElement;

  protected revert_state = false;

  /** cached controls */
  protected toolbar_controls: Record<string, HTMLElement> = {};

  /** swatch lists in color chooser */
  protected swatch_lists: {
    theme?: HTMLDivElement,
    other?: HTMLDivElement,
  } = {};

  protected DOM: DOMContext;

  // 

  constructor(root?: HTMLElement|string) {
  
    if (typeof root === 'string') {
      root = document.querySelector(root) as HTMLElement;
    }

    this.DOM = DOMContext.GetInstance(root?.ownerDocument);

    // there's a possibility this could be running in a node environment. 
    // in that case (wihtout a shim) HTMLElement will not exist, so we can't
    // check type.

    // but in that case what would root be? (...)

    if (this.DOM.view && root instanceof this.DOM.view.HTMLElement) {

      this.root = root;
      
      const style_node = this.DOM.doc?.head.querySelector('style[treb-stylesheet]');
      if (!style_node) {
        this.DOM.doc?.head.prepend(
          this.DOM.Create('style', undefined, undefined, { text: css, attrs: { 'treb-stylesheet': '' } }));
      }

    }

  }

  /** 
   * coerce an attribute value into a more useful type. for attributes,
   * having no value implies "true". false should be explicitly set as
   * "false"; we don't, atm, support falsy values like '0' (that would be 
   * coerced to a number).
   */
  public CoerceAttributeValue(value: string|null): number|boolean|string {

    console.info("CAV", value);

    if (value === null || value.toString().toLowerCase() === 'true' || value === '') {
      return true;
    }
    else if (value.toLowerCase() === 'false') {
      return false;
    }
    else {
      const test = Number(value);
      if (!isNaN(test)) {
        return test;
      }
    }

    // default to string, if it was null default to empty string (no nulls)
    return value || '';

  }

  /**
   * get options from node attributes. we're still working on final 
   * semantics but at the moment we'll translate hyphen-separated-options
   * to our standard snake_case_options.
   * 
   * we also support the old-style data-options
   * 
   * @returns 
   */
  public ParseOptionAttributes(): Partial<EmbeddedSpreadsheetOptions> {

    const attribute_options: Record<string, string|boolean|number|undefined> = {};

    if (this.root) {

      const names = this.root.getAttributeNames();
      console.info({names});

      for (let name of names) {

        switch (name) {

          // skip
          case 'class':
          case 'style':
          case 'id':
            continue;

          // old-style options (in two flavors). old-style options are
          // comma-delimited an in the form `key=value`, or just `key`
          // for boolean true.

          case 'data-options':
          case 'options':
            {
              // in this case use the original name, which should 
              // be in snake_case (for backcompat)

              const value = this.root.getAttribute(name) || '';
              const elements = value.split(',');
              // console.info(elements);

              for (const element of elements) {
                const parts = element.split(/=/);
                if (parts.length === 1) {
                  attribute_options[parts[0]] = true;
                }
                else {
                  attribute_options[parts[0]] = this.CoerceAttributeValue(parts[1]);
                }
              }

            }
            continue;

          // old style (not handling though)
          case 'data-treb':
            continue; 

          // has special handling as an attribute
          case 'inline-document':
            continue;

          // special case
          case 'src':
            attribute_options.document = this.root.getAttribute('src') || undefined;
            continue;

        }

        // attrtibute options are in kebab-case while our internal
        // options are still in snake_case.

        attribute_options[name.replace(/-/g, '_')] = this.CoerceAttributeValue(this.root.getAttribute(name));

      }
    }
    
    return {
      ...attribute_options
    } as Partial<EmbeddedSpreadsheetOptions>;

  }
  
  /**
   * attach content to element. for custom elements, this is called via 
   * the connectedCallback call. for elements created with the API, we 
   * call it immediately.
   */
  public AttachElement(options: EmbeddedSpreadsheetOptions = {}) {

    options = {
      ...this.ParseOptionAttributes(),
      ...options,
    };

    if (this.root) {

      // set a default size if the node does not have width or height.
      // we do this with a class, so it's easier to override if desired.
      // could we use vars? (...)

      if (!options.headless) {
        const rect = this.root.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          this.root.classList.add('treb-default-size');
        }
      }

      // inline-document means look in the tag contents for a script 
      // element, and use that. the script must have type "application/json",
      // and if it has a name, the name must match the value of the 
      // inline-document attribute.
      //
      // so either 
      //
      // <treb-spreadsheet inline-document>
      //   <script type="application/json">{ ... }</script>
      // </treb-spreadsheet>
      //
      // or 
      //
      // <treb-spreadsheet inline-document="xyz">
      //   <script type="application/json" name="xyz">{ ... }</script>
      // </treb-spreadsheet>

      if (this.root.hasAttribute('inline-document')) {
        const inline_name = this.root.getAttribute('inline-document') || '';
        for (const element of Array.from(this.root.children)) {
          if (this.DOM.view && element instanceof this.DOM.view.HTMLScriptElement) {
            if (element.type === 'application/json') {
              const name = element.getAttribute('name') || '';

              // add special case for aggressive clients/wrappers
              if (name === inline_name || !name && inline_name === 'true') {
                const content = element.textContent;
                if (content) {
                  try {
                    options.inline_document = JSON.parse(content);
                  }
                  catch (err) {
                    console.error(err);
                  }
                }
                break;
              }
            }
          }
        }
        if (!options.inline_document) {
          console.warn('inline document failed');
        }
      }

      this.root.innerHTML = html;
      options.container = this.root.querySelector('.treb-layout-spreadsheet') as HTMLElement;

    }

    if (!process.env.XLSX_SUPPORT) {
      options.export = false; // remove export button from sidebar
    }

    // set a local variable so we don't have to keep testing the member

    this.sheet = new EmbeddedSpreadsheet<USER_DATA_TYPE>(options);

    if (this.root) {
      this.CreateLayout(this.sheet, this.root);
    }

  }

  public CreateLayout(sheet: EmbeddedSpreadsheet, root: HTMLElement) {

    // call our internal resize method when the node is resized
    // (primary instance will handle views)

    // why are we doing this here? ... because this is layout? dunno

    const resizeObserver = new ResizeObserver(() => sheet.Resize());
    resizeObserver.observe(root);

    // const resizeObserver = new ResizeObserver(() => sheet.Resize());
    // resizeObserver.observe(root);

    // handle sidebar collapse

    this.layout_element = root.querySelector('.treb-main') as HTMLElement;
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

    if (sheet.options.toolbar === 'show' || sheet.options.toolbar === 'show-narrow') {
      this.layout_element?.setAttribute('toolbar', '');
    }
    if (sheet.options.collapsed) {
      this.layout_element?.setAttribute('collapsed', '');
    }

    // --- revert indicator ----------------------------------------------------

    const revert_indicator = root.querySelector('[data-command=revert-indicator]');
    if (this.DOM.view && revert_indicator instanceof this.DOM.view.HTMLElement) {
      if (sheet.options.revert_indicator) {
        revert_indicator.addEventListener('click', () => {
          sheet.HandleToolbarMessage({
            command: 'revert-indicator',
          });
        });
      }
      else {
        revert_indicator.style.display = 'none';
      }
    }

    // --- toolbar/sidebar -----------------------------------------------------
    
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

    if (sheet.options.toolbar) {
      this.AttachToolbar(sheet, root);
    }

    // --- hide/remove ---------------------------------------------------------

    // compare conditional items against options. not sure which way we're 
    // ultimately going to land with the option names. for the time being 
    // I'm going to do this the verbose way.

    const conditional_map: Record<string, boolean> = {
      // 'file-menu': !!sheet.options.file_menu,
      'table-button': !!sheet.options.table_button,
      // 'chart-menu': !!sheet.options.chart_menu,
      // 'font-scale': !!sheet.options.font_scale,
      'revert': !!sheet.options.revert_button,
      'toolbar': !!sheet.options.toolbar,
      'export': !!sheet.options.export,
      'insert-function': !!sheet.options.insert_function_button,

      // the following won't work as expected in split, because this
      // code won't be run when the new view is created -- do something
      // else
      
      // resize should actually work because we're hiding new view 
      // resize handles via positioning

      'resize': !!sheet.options.resizable,

      // add-tab and delete-tab will still work for the menu

      'add-tab': !!sheet.options.add_tab,
      'delete-tab': (!!sheet.options.delete_tab || !!sheet.options.add_tab),

      // we actually don't want to remove stats if it's not in use, because
      // we need it for layout
      // 'stats': !!sheet.options.stats,

      // scale control is not (yet) declarative, so this isn't effective anyway
      // 'scale-control': !!sheet.options.scale_control,

    }

    for (const [key, value] of Object.entries(conditional_map)) {
      if (!value) {
        const elements = this.layout_element.querySelectorAll(`[data-conditional=${key}]`) as NodeListOf<HTMLElement>;
        for (const element of Array.from(elements)) {
          element.style.display = 'none';
        }
      }
    }

    if (sheet.options.revert_button) {
      this.revert_button = this.layout_element.querySelector('[data-command=revert]') || undefined;
    }

    // --- resize --------------------------------------------------------------

    if (sheet.options.resizable) {

      const size = { width: 0, height: 0 };
      const position = { x: 0, y: 0 };
      const delta = { x: 0, y: 0 };

      // const resize_container = root.querySelector('.treb-layout-resize-container');
      this.views = root.querySelector('.treb-views') || undefined;

      let mask: HTMLElement|undefined;
      let resizer: HTMLElement|undefined;

      const resize_handle = root.querySelector('.treb-layout-resize-handle') as HTMLElement;

      // mouse up handler added to mask (when created)
      const mouseup = () => finish();

      // mouse move handler added to mask (when created)
      const mousemove = ((event: MouseEvent) => {
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

      // clean up mask and layout rectangle
      const finish = () => {

        // resize_handle.classList.remove('retain-opacity'); // we're not using this anymore

        if (delta.x || delta.y) {
          const rect = root.getBoundingClientRect();
          if (!sheet.options.constrain_width) {
            root.style.width = (rect.width + delta.x) + 'px';
          }
          root.style.height = (rect.height + delta.y) + 'px';
        }

        if (mask) {
          mask.removeEventListener('mouseup', mouseup);
          mask.removeEventListener('mousemove', mousemove);
          mask.parentElement?.removeChild(mask);
          mask = undefined;
        }

        resizer?.parentElement?.removeChild(resizer);
        resizer = undefined;

      };

      resize_handle.addEventListener('mousedown', (event: MouseEvent) => {

        event.stopPropagation();
        event.preventDefault();

        const resize_parent = root.querySelector('.treb-main') as HTMLElement; // was document.body

        resizer = this.DOM.Div('treb-resize-rect', resize_parent);

        mask = this.DOM.Div('treb-resize-mask', resize_parent, { 
          attrs: { 
            style: 'cursor: nw-resize;' 
          },
          events: { mouseup, mousemove },
        });

        // mask.addEventListener('mouseup', mouse_up);
        // mask.addEventListener('mousemove', mouse_move);

        // resize_handle.classList.add('retain-opacity'); // we're not using this anymore
                
        position.x = event.screenX;
        position.y = event.screenY;

        delta.x = 0;
        delta.y = 0;

        const layouts = this.views?.querySelectorAll('.treb-spreadsheet-body');
        const rects = Array.from(layouts||[]).map(element => element.getBoundingClientRect());
        if (rects.length) {

          const composite: { top: number, left: number, right: number, bottom: number } = 
            JSON.parse(JSON.stringify(rects.shift()));

          for (const rect of rects) {
            composite.top = Math.min(rect.top, composite.top);
            composite.left = Math.min(rect.left, composite.left);
            composite.right = Math.max(rect.right, composite.right);
            composite.bottom = Math.max(rect.bottom, composite.bottom);
          }

          const width = composite.right - composite.left;
          const height = composite.bottom - composite.top;

          resizer.style.top = (composite.top) + 'px';
          resizer.style.left = (composite.left) + 'px';

          resizer.style.width = (width) + 'px';
          resizer.style.height = (height) + 'px';

          size.width = width;
          size.height = height;
        }
    
      });

    }

    // --- titles --------------------------------------------------------------

    const elements = Array.from(this.layout_element.querySelectorAll('[data-title]'));
    for (const element of elements) {
      if (element instanceof HTMLElement) {

        // temp workaround
        if (element.dataset.activeTitle) {
          continue;
        }

        if (element.dataset.title && default_titles[element.dataset.title]) {
          element.title = default_titles[element.dataset.title];
        }

      }
    }

    // --- animated ------------------------------------------------------------

    // requestAnimationFrame(() => {
    setTimeout(() => this.layout_element?.setAttribute('animate', ''), 250);

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
        // value.classList.remove('treb-active');
        value.removeAttribute('active');
        if (value.dataset.inactiveTitle) {
          value.title = value.dataset.inactiveTitle;
        } 
      }
    }

    const Activate = (element?: HTMLElement) => {
      if (element) {
        // element.classList.add('treb-active');
        element.setAttribute('active', '');
        if (element.dataset.activeTitle) {
          element.title = element.dataset.activeTitle;
        }
      }
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
      case 'left':
        Activate(this.toolbar_controls.left);
        break;  
      case 'center':
        Activate(this.toolbar_controls.center);
        break;
      case 'right':
        Activate(this.toolbar_controls.right);
        break;
    }
    
    switch (state.style?.vertical_align) {
      case 'top':
        Activate(this.toolbar_controls.top);
        break;  
      case 'middle':
        Activate(this.toolbar_controls.middle);
        break;
      case 'bottom':  
        Activate(this.toolbar_controls.bottom);
        break;
    }

  }


  public UpdateDocumentStyles(sheet: EmbeddedSpreadsheet, format_menu: HTMLElement) {

    // --- colors -------------------------------------------------------------
    
    {
      
      let fragment = this.DOM.Fragment();
     
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
              // title += ` (${Math.abs(entry.color.tint) * 100}% ${ entry.color.tint > 0 ? 'lighter' : 'darker'})`;
              title += ` (${(entry.color.tint > 0 ? '+' : '') + (entry.color.tint) * 100}%)`;
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

            this.DOM.Create('button', undefined, fragment, {
              attrs: { style, title },
              data: { command: 'set-color', color: JSON.stringify(entry.color) },
            });

          }
        }

      }

      this.swatch_lists.theme?.replaceChildren(fragment);

      fragment = this.DOM.Fragment();
      this.DOM.Create('button', 'treb-default-color', fragment, {
        attrs: { title: 'Default color' },
        data: { command: 'set-color', color: JSON.stringify({}) },
      });

      const colors = ['Black', 'White', 'Gray', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet'];

      const lc = colors.map(color => color.toLowerCase());
      const additional_colors = sheet.document_styles.colors.filter(test => {
        return !lc.includes(test.toLowerCase());
      });

      for (const text of [...colors, ...additional_colors]) {
        const style = `background: ${text.toLowerCase()};`;
        this.DOM.Create('button', undefined, fragment, {
          attrs: { style, title: text, },
          data: { command: 'set-color', color: JSON.stringify({text: text.toLowerCase()})},
        });

        // Element('button', fragment, { style, title: text, data: { command: 'set-color', color: JSON.stringify({text: text.toLowerCase()})}});
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

    const Button = (format: string) => 
    this.DOM.Create('button', undefined, undefined, {
        text: format, 
        data: { format, command: 'number-format' },
      });

    const fragment = this.DOM.Fragment();
    fragment.append(...number_formats.map(format => Button(format)));
    fragment.append(this.DOM.Div(undefined, undefined, { attrs: { separator: '' }}));
    fragment.append(...date_formats.map(format => Button(format)));

    format_menu.textContent = '';
    format_menu.append(fragment);
    
  }

  /**
   * setting explicit state on the revert button (if enabled).
   * 
   * @param sheet 
   */
  public UpdateRevertState(sheet: EmbeddedSpreadsheet) {

    const state = sheet.can_revert;

    if (this.revert_state === state) {
      return; // nothing to do
    }

    this.revert_state = state;

    if (this.revert_button || sheet.options.revert_indicator) {

      if (this.revert_state) {
        this.views?.classList.add('treb-can-revert');
      }
      else {
        this.views?.classList.remove('treb-can-revert');
      }

      if (this.revert_button) {
        this.revert_button.dataset.canRevert = state ? 'true' : 'false'; // FIXME: remove

        // FIXME: container classes, double up button

        if (state) {
          this.revert_button.classList.remove('sidebar-disabled');
          this.revert_button.title = 'Revert to original version'; // FIXME: strings
        }
        else {
          this.revert_button.classList.add('sidebar-disabled');
          this.revert_button.title = 'This is the original version of the document'; // FIXME: strings
        }
      }
    }

  }

  /**
   * replace a given template with its contents.
   */
  public ReplaceTemplate(root: HTMLElement, selector: string, remove = true) {
    const template = root.querySelector(selector) as HTMLTemplateElement;
    if (template && template.parentElement) {
      // console.info(template, template.parentElement);
      for (const child of Array.from(template.content.children)) {
        template.parentElement.insertBefore(child, template);
      }
      if (remove) {
        template.parentElement.removeChild(template);
      }
    }
    else {
      console.warn('template not found', selector);
    }
  }

  public AttachToolbar(sheet: EmbeddedSpreadsheet, root: HTMLElement) {

    // --- layout --------------------------------------------------------------

    const scroller = root.querySelector('.treb-layout-header') as HTMLElement;
    const toolbar = root.querySelector('.treb-toolbar') as HTMLElement;
    
    toolbar.innerHTML = toolbar_html;

    // adjust toolbar based on options

    const remove: Array<Element|null> = [];

    // wide or narrow menu
    if (sheet.options.toolbar === 'narrow' || sheet.options.toolbar === 'show-narrow') {
      remove.push(...Array.from(toolbar.querySelectorAll('[wide]')));
    }
    else {
      remove.push(...Array.from(toolbar.querySelectorAll('[narrow]')));
    }

    // optional toolbar items
    if (!sheet.options.file_menu) {
      remove.push(toolbar.querySelector('[file-menu]'));
    }
    if (!sheet.options.indent_buttons) {
      remove.push(toolbar.querySelector('[indent-group]'));
    }
    if (!sheet.options.font_scale) {
      remove.push(toolbar.querySelector('[font-scale]'));
    }
    if (!sheet.options.chart_menu) {
      remove.push(toolbar.querySelector('[chart-menu]'));
    }
    if (!sheet.options.freeze_button) {
      remove.push(toolbar.querySelector('[freeze-button]'));
    }
    if (!sheet.options.table_button) {
      remove.push(toolbar.querySelector('[table-button]'));
    }
    if (!sheet.options.add_tab && !sheet.options.delete_tab) {
      remove.push(...Array.from(toolbar.querySelectorAll('[add-remove-sheet]')));
    }
    if (!sheet.options.toolbar_recalculate_button) {
      remove.push(toolbar.querySelector('[recalculate-button]'));
    }
    if (!process.env.XLSX_SUPPORT) {
      remove.push(...Array.from(toolbar.querySelectorAll('[xlsx-support]')));
    }

    for (const element of remove) {
      if (element) {
        element.parentElement?.removeChild(element);
      }
    }

    const color_chooser = toolbar.querySelector('.treb-color-chooser') as HTMLElement;
    const comment_box = toolbar.querySelector('.treb-comment-box textarea') as HTMLTextAreaElement;

    // --- controls ------------------------------------------------------------
    
    for (const [key, value] of Object.entries({

        // for align/justify make sure we are collecting the wide 
        // versions. narrow versions don't highlight.

        'top': '[wide] [data-command=align-top]',
        'middle': '[wide] [data-command=align-middle]',
        'bottom': '[wide] [data-command=align-bottom]',

        'left': '[wide] [data-command=justify-left]',
        'right': '[wide] [data-command=justify-right]',
        'center': '[wide] [data-command=justify-center]',

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
      if (element) {
        this.toolbar_controls[key] = element;
      }
      else {
        // console.warn('missing toolbar element', value);
      }

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

    // why are we not just getting all? (...)

    for (const entry of ['border', 'annotation', 'align', 'justify']) {
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

      // the toolbar message used to take "data" for historical 
      // reasdons, now it takes inline properties. we can be a little
      // more precise about this, although we'll have to update if 
      // we add any new data types.

      const props: {
        comment?: string;
        color?: Color;
        format?: string;
        scale?: string;
      } = {
        format: target.dataset.format,
        scale: target.dataset.scale,
      };

      let command = target?.dataset.command;

      if (command) {

        // we may need to replace an icon in the toolbar
        const replace = (target.parentElement as HTMLElement)?.dataset.replace;
        if (replace) {
          const replace_target = this.replace_targets[replace];
          if (replace_target) {
            replace_target.dataset.command = command;
            replace_target.title = target.title || '';
          }
        }

        // for borders, if we have a cached border color add that to the event data
        if (/^border-/.test(command)) {
          props.color = this.border_color || {};
        }

        switch (command) {
          case 'text-color':
          case 'fill-color':
            props.color = {};
            try {
              props.color = JSON.parse(target.dataset.color || '{}');
            }
            catch (err) {
              console.error(err);
            }
            break;

          case 'set-color':

            // swap command
            command = color_chooser.dataset.colorCommand || '';

            // convert string to color
            props.color = {};
            try {
              props.color = JSON.parse(target.dataset.color || '{}');
            }
            catch (err) {
              console.error(err);
            }

            // cache for later
            if (command === 'border-color') {
              this.border_color = props.color;
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
            props.comment = comment_box.value;
            break;
        }

        sheet.HandleToolbarMessage({
          command,
          ...props,
        } as ToolbarMessage);
      }

    });

    // common

    const CreateInputHandler = (selector: string, handler: (value: string) => boolean) => {
      const input = toolbar.querySelector(selector) as HTMLInputElement;
      if (input) {
        let cached_value = '';
        input.addEventListener('focusin', () => cached_value = input.value);
        input.addEventListener('keydown', event => {
          switch (event.key) {
            case 'Escape':
              input.value = cached_value;
              sheet.Focus();
              break;

            case 'Enter':
              if (!handler(input.value)) {
                input.value = cached_value;
                sheet.Focus();
              }
              break;
              
            default:
              return;
          }

          event.stopPropagation();
          event.preventDefault();

        });
      }
    };

    // number format input 

    CreateInputHandler('input.treb-number-format', (format: string) => {
      if (!format) { return false; }
      sheet.HandleToolbarMessage({
        command: 'number-format',
        format,
      })
      return true;
    });

    // font scale input

    CreateInputHandler('input.treb-font-scale', (value: string) => {
      const scale = Number(value);
      if (!scale || isNaN(scale)) {
        console.warn('invalid scale value');
        return false;
      }
      sheet.HandleToolbarMessage({
        command: 'font-scale',
        scale,
      });
      return true;
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
      const hsl = ColorFunctions.RGBToHSL(bytes[0], bytes[1], bytes[2]);

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

    // firefox thinks this is a "scroll linked posiitoning effect". that's
    // not 100% wrong but it's an absurd thing to flag for that warning.

    if (/firefox/i.test(navigator.userAgent)) {
      scroller.addEventListener('scroll', () => {
        if (this.DOM.view && this.DOM.doc?.activeElement instanceof this.DOM.view.HTMLElement ) {
          this.DOM.doc.activeElement?.blur();
        }
      });
    }
    else {
      scroller.addEventListener('scroll', () => sheet.Focus());
    }

    // we set up a key listener for the escape key when menus are open, we
    // need to remove it if focus goes out of the toolbar

    let handlers_attached = false;

    const escape_handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        Promise.resolve().then(() => sheet.Focus());
      }
    };

    const focusout_handler = (event: FocusEvent) => {
      if (handlers_attached) {
        if (event.relatedTarget instanceof Node && toolbar.contains(event.relatedTarget)) {
          return;
        }
        toolbar.removeEventListener('keydown', escape_handler);
        toolbar.removeEventListener('focusout', focusout_handler);
        handlers_attached = false;
      }
    };

    const PositionMenu = (event: FocusEvent|MouseEvent) => {

      // FIXME: because these are situational, move the 
      // lookups/checks outside of this function into the 
      // event handlers

      let target = event.target as HTMLElement;
      let parent = target?.parentElement;

      if (target?.classList.contains('treb-menu')) {
        parent = target;
        for (const child of Array.from(parent.children)) {
          if (child.tagName === 'BUTTON') {
            target = child as HTMLElement;
            break;
          }
        }
      }
      else if (!parent?.classList.contains('treb-menu')) {
        return;
      }

      // if (parent?.classList.contains('treb-menu')) 
      if (target && parent) {

        // console.info('positioning');

        if (!handlers_attached) {
          toolbar.addEventListener('focusout', focusout_handler);
          toolbar.addEventListener('keydown', escape_handler);
          handlers_attached = true;
        }

        // we're sharing the color chooser, drop it in to 
        // the target if this is a color menu

        if (parent.dataset.colorCommand) {
          color_chooser.querySelector('.treb-default-color')?.setAttribute('title', parent.dataset.defaultColorText || 'Default color');

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

        if (group?.hasAttribute('composite')) {
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
          menu.style.top = target_rect.bottom + 'px';

          // right-align if we would overflow the toolbar

          if (left + menu_rect.width > scroller_rect.right - 6) {
            menu.style.left = (target_rect.right - menu_rect.width) + 'px';
          }
          else {
            menu.style.left = left + 'px';
          }

        }

        // const focus = menu.querySelector('textarea, input') as HTMLElement;
        const focus = menu.querySelector('textarea') as HTMLElement;
        if (focus) {
          requestAnimationFrame(() => focus.focus());
        }

      }

    };

    const format_menu = this.root?.querySelector('.treb-number-format-menu') as HTMLElement;
    if (format_menu) {

      // the first time we call this (now) we want to get the default
      // colors for text, fill, and border to set buttons.

      this.UpdateDocumentStyles(sheet, format_menu);
      this.UpdateSelectionStyle(sheet, toolbar, comment_box);

      sheet.Subscribe(event => {
        switch (event.type) {

          // need to do something with this
          case 'focus-view':
            break;

          case 'data':
          case 'document-change':
          case 'load':
          case 'reset':
            this.UpdateDocumentStyles(sheet, format_menu);
            this.UpdateSelectionStyle(sheet, toolbar, comment_box);
            this.UpdateRevertState(sheet);
            break;

          case 'selection':
            this.UpdateSelectionStyle(sheet, toolbar, comment_box);
            break;
        }
      });

    }

    const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // positioning on focusin will catch keyboard and mouse navigation
    // ...but this won't work on safari. ...

    toolbar.addEventListener('focusin', event => {
      PositionMenu(event);
    });

    // safari disables focus on buttons for some reason. you can override
    // that, but does anyone do that? also, what about osx?
    //
    // for safari, we'll position on mousedown. this will result in some 
    // extra calls to the position routine but that shouldn't be too 
    // bad. we also need to remove focus on the menu elements we're adding
    // tab indexes to.

    if(safari) {
      const elements = Array.from(toolbar.querySelectorAll('.treb-menu') as NodeListOf<HTMLElement>);
      for (const element of elements) {
        element.tabIndex = 0;
      }
      toolbar.addEventListener('mousedown', event => {
        PositionMenu(event);
      });  
    }

  }

}

