
import { tmpl, composite, NodeModel } from 'treb-utils';
import { icons } from './generated/toolbar4';
import { symbol_defs } from './generated/symbol-defs';
import { Style, Localization } from 'treb-base-types';
import { EventSource } from 'treb-utils';
import { NumberFormatCache } from 'treb-format';

import '../style/toolbar-4.pcss';
import { callbackify } from 'util';

/**
 * state that should be reflected in toolbar buttons/selections
 */
export interface SelectionState {
  style?: Style.Properties;
  merge?: boolean;
  frozen?: boolean;
  comment?: boolean;
}

export interface ToolbarCancelEvent {
  type: 'cancel';
}

export interface ToolbarClickEvent {
  type: 'button';
  command: string;
}

export interface ToolbarNumberFormatEvent {
  type: 'format';
  format: string;
}

export type ToolbarEvent = ToolbarClickEvent 
  | ToolbarCancelEvent
  | ToolbarNumberFormatEvent;

/**
 * I've gone back and forth on toolbar so many times... we're back
 * to a static, constant (and very simple) toolbar although I will
 * abstract interfaces so we can swap out more easily in the future.
 */
export class Toolbar extends EventSource<ToolbarEvent> {
 
  public model: NodeModel;

  public number_formats: string[] = [];
  public date_formats: string[] = [];

  constructor(container: HTMLElement) {

    super();

    // 
    // NOTE regarding dropdowns: you can't nest a button (interactive element)
    // inside a button. that's why the dropdown menus have to be siblings of,
    // and cannot be children of, the dropdown buttons.
    // 

    this.model = tmpl`
      <div id='root' class='treb-toolbar-4'>

        <div class='group'>
          ${this.IconButton('bootstrap/text-left', 'align-left', true, 'Align left')}
          ${this.IconButton('bootstrap/text-center', 'align-center', true, 'Align center')}
          ${this.IconButton('bootstrap/text-right', 'align-right', true, 'Align right')}
        </div>

        <div class='group'>
          ${this.IconButton('fa/light/arrow-up-to-line', 'align-top', true, 'Align top')}
          ${this.IconButton('bootstrap/arrows-collapse', 'align-middle', true, 'Align middle')}
          ${this.IconButton('fa/light/arrow-down-to-line', 'align-bottom', true, 'Align bottom')}
        </div>

        <button id='wrap' data-command='wrap' title='Wrap text'>
          ${this.Icon('extra/wrap')}
        </button>
        
        ${this.IconButton('bootstrap/chat-left', 'comment', true, 'Add comment')}

        <div class='group'>
          <button class='color-button'>
            ${this.Icon('fa/light/fill-drip')}
            <div class='color-bar' style='color:red;'></div>
          </button>
          <button class='drop'></button>
          <div class='drop-menu color-chooser' tabindex='-1'></div>
        </div>

        <div class='group'>
          <button class='color-button'>
            ${this.Icon('fa/light/font')}
            <div class='color-bar' style='color:blue;'></div>
          </button>
          <button class='drop'></button>
          <div class='drop-menu color-chooser' tabindex='-1'></div>
        </div>

        <div class='group'>
          ${this.IconButton('extra/border-double-bottom2', 'update-border', 'border-double-bottom', 'Double bottom border')}
          <button class='drop'>
          </button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li>${this.IconButton('fa/light/border-top', 'border-top', true, 'Top border', 'update-border')}</li>
              <li>${this.IconButton('fa/light/border-left', 'border-left', true, 'Left border', 'update-border')}</li>
              <li>${this.IconButton('fa/light/border-right', 'border-right', true, 'Right border', 'update-border')}</li>
              <li>${this.IconButton('fa/light/border-bottom', 'border-bottom', true, 'Bottom border', 'update-border')}</li>
              <li>${this.IconButton('extra/border-double-bottom2', 'border-double-bottom', true, 'Double bottom border', 'update-border')}</li>
              <li>${this.IconButton('fa/light/border-all', 'border-all', true, 'All borders', 'update-border')}</li>
              <li>${this.IconButton('fa/light/border-outer', 'border-outer', true, 'Outside borders', 'update-border')}</li>
              <li>${this.IconButton('fa/light/border-none', 'border-none', true, 'Clear borders', 'update-border')}</li>
              <hr/>
              <li>
                <button id='border-color' class='drop-button' data-position='horizontal' title='Border color'>
                  ${this.Icon('fa/light/palette')}
                </button>
                <div class='drop-menu color-chooser' tabindex='-1'></div>
              </li>
            </ul>
          </div>
        </div>

        <button id='merge' data-command='merge' title='Merge cells'>
          ${this.Icon('fa/light/expand', 'active-icon')}
          ${this.Icon('fa/light/compress', 'inactive-icon')}
        </button>
        
        <div class='group'>
          <button id='layout' class='drop-button' title='Rows/columns'>
            ${this.Icon('fa/light/table-columns')}
          </button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li><button class='text' data-command='insert-row'>Insert row</button></li>
              <li><button class='text' data-command='insert-column'>Insert column</button></li>
              <li><button class='text' data-command='delete-row'>Delete row</button></li>
              <li><button class='text' data-command='delete-column'>Delete column</button></li>
            </ul>
            <ul>
              <hr/>
              <li><button class='text' data-command='insert-sheet'>Insert sheet</button></li>
              <li><button class='text' data-command='delete-sheet'>Delete sheet</button></li>
            </ul>
          </div>
        </div>

        ${this.IconButton('fa/light/snowflake', 'freeze')}

        <div class='group'>
          <div class='container'>
            <input value='General' id='number-format-input'>
          </div>
          <button class='drop'></button>
          <div class='drop-menu scroll' tabindex='-1' data-number-formats></div>
        </div>

        <div class='split-button'>
          <button data-command='decrease-decimal' title='Decrease precision'>
            <div>0${Localization.decimal_separator}0</div>
          </button>
          <button data-command='increase-decimal' title='Increase precision'>
            <div>0${Localization.decimal_separator}00</div>
          </button>
        </div>

        <div class='group'>
          ${this.IconButton('column-chart', 'insert-annotation', 'column-chart', 'Insert column chart')}
          <button class='drop'></button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li>${this.IconButton('column-chart', 'column-chart', true, 'Insert column chart', 'insert-annotation')}</li>
              <li>${this.IconButton('donut-chart', 'donut-chart', true, 'Insert donut chart', 'insert-annotation')}</li>
              <li>${this.IconButton('bar-chart', 'bar-chart', true, 'Insert bar chart', 'insert-annotation')}</li>
              <li>${this.IconButton('line-chart', 'line-chart', true, 'Insert line chart', 'insert-annotation')}</li>
              <hr/>
              <li>${this.IconButton('fa/light/image', 'insert-image', true, 'Insert image', 'insert-annotation')}</li>
            </ul>
          </div>
        </div>

        <div class='staging'>
          <div id='color-chooser'>
            ZOOPA MONS
          </div>
        </div>

      </div>
    `;

    let cached_format = '';
    const format_input = this.model['number-format-input'] as HTMLInputElement;
    format_input.addEventListener('focus', (event: FocusEvent) => cached_format = format_input.value || '');
    format_input.addEventListener('keydown', (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Enter':
          this.Publish({ type: 'format', format: format_input.value || ''});
          break;

        case 'Escape':
          format_input.value = cached_format;
          this.Publish({ type: 'cancel' });
          break;

        default:
          return;
      }
      event.stopPropagation();
      event.preventDefault();
    });

    this.model.root.addEventListener('click', (event) => {
      const element = (event.target as HTMLElement);
      const command = element?.dataset?.command;

      if (command) {
        this.Publish({
          type: 'button', 
          command,
        });
        return;
      }

      if(element?.classList?.contains('drop') || element?.classList?.contains('drop-button')) {

        let parent = element.parentElement;

        while (parent && !parent.classList.contains('group')) {
          if (parent === this.model.root) {
            return;
          }
          parent = parent.parentElement;
        }
        if (parent) {
          const sibling = element.nextSibling as HTMLElement;
          if (sibling?.classList?.contains('drop-menu')) {

            if (sibling.dataset.numberFormats !== undefined) {
              this.RenderNumberFormats(sibling);
            }
            
            if (sibling.classList.contains('color-chooser')) {
              sibling.appendChild(this.model['color-chooser'])
            }
            if (element.dataset?.position === 'horizontal') {
              this.Focus(sibling, element.offsetWidth + 12, element.offsetTop - 8);
            }
            else {
              this.Focus(sibling, 0, element.offsetHeight + 4);
            }
          }
        }
        return;
      }

      console.info(event.target);

    });

    // console.info(this.model);
    container.appendChild(this.model.root);

  }

  public Focus(element: HTMLElement, left: number, top: number): void {

    element.style.left = left + 'px';
    element.style.top = top + 'px';
    element.classList.add('visible');

    // handle escape key (closes popup)
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        this.Publish({ type: 'cancel' });
      }
    };
    window.addEventListener('keydown', esc);

    // handle click event -- see if we want to pass to parent or not
    const click = (event: Event) => {

      const target = (event.target as HTMLElement);
      if (target.dataset?.replace) {
        const replace_target = this.model[target.dataset.replace];
        replace_target.innerHTML = target.innerHTML;
        replace_target.setAttribute('title', target.getAttribute('title') || '');
        replace_target.dataset.command = target.dataset.command || undefined;
      }

      if (target.dataset?.command === 'number-format') {
        const format = target.textContent || 'General';
        (this.model['number-format-input'] as HTMLInputElement).value = target.textContent || '';
        this.Publish({ type: 'format', format });
      }
      else if (target.dataset?.command || target.classList?.contains('drop-button')) {
        return;
      }
      event.stopPropagation();
    };
    element.addEventListener('click', click);

    // on focus out of the parent, close and clean up
    const focusout = (event: FocusEvent) => {
      const related = event.relatedTarget as HTMLElement;
      if (related && element.contains(related)) {
        return;
      }
      element.classList.remove('visible');
      element.removeEventListener('focusout', focusout);
      element.removeEventListener('click', click);
      window.removeEventListener('keydown', esc);
    };
    element.addEventListener('focusout', focusout);

    // allow the class to update
    requestAnimationFrame(() => element.focus());

  }

  public UpdateState(state: SelectionState): void {

    const map = {
      'align-center': state.style && state.style?.horizontal_align === Style.HorizontalAlign.Center,
      'align-left': state.style && state.style?.horizontal_align === Style.HorizontalAlign.Left,
      'align-right': state.style && state.style?.horizontal_align === Style.HorizontalAlign.Right,

      'align-top': state.style && state.style?.vertical_align === Style.VerticalAlign.Top,
      'align-middle': state.style && state.style?.vertical_align === Style.VerticalAlign.Middle,
      'align-bottom': state.style && state.style?.vertical_align === Style.VerticalAlign.Bottom,

      'wrap': state.style && !!state.style.wrap,
      'freeze': !!state.frozen, 
      'comment': state.comment,
    };

    const merge = this.model.merge;
    if (state.merge) {
      merge.classList.add('active');
      merge.dataset.command = 'unmerge';
      merge.setAttribute('title', 'Unmerge cells');
    }
    else {
      merge.classList.remove('active');
      merge.dataset.command = 'merge';
      merge.setAttribute('title', 'Merge cells');
    }

    Object.keys(map).forEach(key => {
      if ((map as any)[key]) {
        this.model[key]?.classList.add('active');
      }
      else {
        this.model[key]?.classList.remove('active');
      }
    });

  }

  public RenderNumberFormats(target: HTMLElement): void {
    target.innerHTML = composite`
      <ul>
        ${this.number_formats.map(format => composite`
          <li><button data-command='number-format' class='text'>${format}</button></li>
        `).join('\n')}
      </ul>
      <hr/>
      <ul>
        ${this.date_formats.map(format => composite`
          <li><button data-command='number-format' class='text'>${format}</button></li>
        `).join('\n')}
      </ul>
    `;
  }

  public UpdateDocumentStyles(formats: string[], colors: string[], update: boolean): void {
   
      const number_formats: string[] = [
          'General', 'Number', 'Integer', 'Percent', 'Fraction', 'Accounting', 'Currency', 'Scientific',
      ];
  
      const date_formats: string[] = [
        'Timestamp', 'Long Date', 'Short Date',
      ];
  
      for (const format of formats) {
        if (NumberFormatCache.SymbolicName(NumberFormatCache.Translate(format))) { continue; }
        const instance = NumberFormatCache.Get(format);
        if (instance.date_format) {
          date_formats.push(format);
        }
        else {
          number_formats.push(format);
        }
      }
  
      this.number_formats = number_formats;
      this.date_formats = date_formats;

      /*

      // let index = 0;
      const string_to_element = (text: string): ToolbarElement => {
        return { 
          type: ToolbarElementType.text, 
          text, 
          data: { style: { number_format: text }},
        };
      };
  
      format_element.list = [
        // ...this.default_number_formats.map(string_to_element),
        ...number_formats.map(string_to_element),
        separator,
        // ...this.default_date_formats.map(string_to_element),
        ...date_formats.map(string_to_element),
      ];
  
      this.toolbar.UpdateColors(colors);
  
      if (update) {
        this.Update();
      }
  
      */
  
  }

  /*
  public IconButtons(info: Array<{icon: string, id?: string}>) {
    return info.map(data => this.IconButton(data.icon, data.id)).join('');
  }
  * /

  public DropButton(icon: string, id?: string, command: string|boolean = true, title?: string): string {
    return `
      <div class='group'>
        ${this.IconButton(icon, id, command, title)}
        <button class='drop'></button>
    </div>
    `;
  }
  */

  public IconButton(icon: string, id?: string, command: string|boolean = true, title?: string, replace?: string): string {
    if (id && command === true) { 
      command = id;
    }
    return `<button${id ? ` id='${id}'` : ''}` +
           `${replace ? ` data-replace='${replace}'` : ''}` +
           `${command ? ` data-command='${command}'` : ''}${title ? ` title='${title}'` : ''}>${this.Icon(icon)}</button>`
  }

  public Icon(icon: string, classes = ''): string {
    let model = icons[icon];
    let base = '';
    let baseclass = '';

    if (!model) {
      model = symbol_defs[icon];
      // base = 'symbol';
      base = `symbol`;
    }

    if (classes || base) {
      baseclass = ` class='${base} ${classes}'`
    }

    if(!model) {
      console.warn(icon);
      return ``;
    }

    return `<svg${baseclass} viewBox='${model.viewbox || '0 0 24 24'}'>${(model.paths||[]).map(path => {
      let classes = ' ';
      if (Array.isArray(path.classes)) {
        classes += path.classes.join(' ');
      }
      else if (path.classes) {
        classes += path.classes;
      }
      return `<path d='${path.d}' class='${classes.trim()}'/>`;
    }).join('')}</svg>`;

  }

  
}
