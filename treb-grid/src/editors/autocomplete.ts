
import { DOMUtilities } from '../util/dom_utilities';
import { Rectangle } from 'treb-base-types';
import { ExtendedTheme } from '../types/theme';
import { AutocompleteExecResult } from './autocomplete_matcher';

export interface AutocompleteResult {
  handled: boolean;
  accept?: boolean;
  data?: any;
  value?: string;
  click?: boolean;
}

/*
export interface AutocompleteData {
  completions?: string[];
  tooltip?: string;
  arguments?: string;
}
*/

export type AcceptCallback = (result: AutocompleteResult) => void;

export interface AutocompleteOptions {
  autocomplete_prefer_top?: boolean;
  tooltip_prefer_top?: boolean;
  theme?: ExtendedTheme;
  container?: HTMLElement;
}

export class Autocomplete {

  public completion_list_visible = false;
  public tooltip_visible = false;
  public last_completion?: string;

  private completion_list: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private stylesheet: HTMLStyleElement;

  private selected_index = 0;
  private block = false;
  private autocomplete_data: any = {};

  private callback?: AcceptCallback;
  private scope: string;

  constructor(private options: AutocompleteOptions = {}){

    this.scope = 'AC' + Math.round(Math.random() * Math.pow(10, 10)).toString(16);

    this.stylesheet = DOMUtilities.Create('style', undefined, document.body);
    this.completion_list = DOMUtilities.CreateDiv(
      'treb-cell-editor-ac-list treb-ac-list',
      options.container || document.body,
      this.scope);

    this.completion_list.addEventListener('mousedown', (event) => this.ListMouseDown(event));

    this.tooltip = DOMUtilities.CreateDiv('treb-cell-editor-ac-tooltip treb-ac-tooltip',
      options.container || document.body,
      this.scope);

    this.UpdateTheme();

  }

  public UpdateTheme() {
    if (this.options.theme) {

      // FIXME: no longer sharing, don't need scoped styling anymore

      // FIXME: split?

      this.completion_list.style.fontFamily =
        this.tooltip.style.fontFamily = this.options.theme.cell_font ?
        this.options.theme.cell_font : '';

      const font_size = (this.options.theme.cell_font_size_value || 0) +
        (this.options.theme.cell_font_size_unit || 'pt');

      /*
      let font_size: string|null = null;
      if (typeof this.options.theme.cell_font_size === 'string') {
        font_size = this.options.theme.cell_font_size;
      }
      else if (typeof this.options.theme.cell_font_size === 'number') {
        font_size = this.options.theme.cell_font_size + 'pt';
      }
      */

      this.completion_list.style.fontSize =
        this.tooltip.style.fontSize =
        font_size || '';

      this.stylesheet.textContent = `

      .treb-ac-list[${this.scope}] {
        background: ${this.options.theme.autocomplete_background};
      }

      .treb-ac-list[${this.scope}] ul li {
        color: ${this.options.theme.autocomplete_color};
      }

      .treb-ac-list[${this.scope}] ul li a:hover, .treb-ac-list[${this.scope}] ul li a.selected,
          .treb-ac-list[${this.scope}] ul:hover li a.selected:hover {
        color: ${this.options.theme.autocomplete_highlight_color};
        background: ${this.options.theme.autocomplete_highlight_background};
      }

      `.replace(/\s+/g, ' ').trim();

    }
  }

  public Hide(){
    this.tooltip.style.top = '-1000px';
    this.completion_list.style.top = '-1000px';
    this.completion_list_visible = false;
    this.tooltip_visible = false;
  }

  public ResetBlock(){
    this.block = false;
  }

  public ListMouseDown(event: MouseEvent){

    event.stopPropagation();
    event.preventDefault();

    let target: HTMLElement|null = event.target as HTMLElement;
    while (target){
      if (target === this.completion_list) return;
      if (target.tagName === 'A') break;
      target = target.parentElement;
    }
    if (!target) return;
    console.info(target);

    if (this.callback) {
      this.callback({
        handled: true,
        accept: true,
        value: target.textContent ? target.textContent : undefined,
        data: this.autocomplete_data,
        click: true,
      });
    }
  }

  public HandleKey(event_type: 'keydown'|'keyup', event: KeyboardEvent): AutocompleteResult {

    if (!this.completion_list_visible) return { handled: false };

    let delta = 0;
    let block = false;
    let accept = false;

    switch (event.key){
    case 'Up':
    case 'ArrowUp':
      delta = -1;
      break;
    case 'Down':
    case 'ArrowDown':
      delta = 1;
      break;
    case 'Tab':
      accept = true;
      break;
    case 'Escape':
    case 'Esc':
      block = true;
      break;
    default:
      return { handled: false };
    }

    event.stopPropagation();
    event.preventDefault();

    // keyup just consume

    if (event_type === 'keyup') return { handled: true };

    // keydown handle

    if (delta){
      const list_rect = this.completion_list.getBoundingClientRect();
      this.selected_index += delta;
      this.selected_index = Math.max(0, this.selected_index);
      const children = this.completion_list.querySelectorAll('a');
      this.selected_index = Math.min(this.selected_index, children.length - 1);
      for (let index = 0; index < children.length; index++){
        const child = children[index];
        if (index === this.selected_index){
          child.classList.add('selected');
          const child_rect = child.getBoundingClientRect();
          if (child_rect.top < list_rect.top){
            this.completion_list.scrollBy(0, -child_rect.height);
          }
          else if (child_rect.bottom > list_rect.bottom) {
            this.completion_list.scrollBy(0, child_rect.height);
          }
          this.last_completion = child.textContent || undefined;
        }
        else child.classList.remove('selected');
      }
      return { handled: true };
    }
    else if (block){
      this.block = true;
      this.Hide();
      return { handled: true };
    }
    else if (accept){
      return {
        handled: true,
        accept: true,
        value: this.last_completion,
        data: this.autocomplete_data,
      };
    }

    return { handled: false };
  }

  public Show(callback: AcceptCallback, data: AutocompleteExecResult = {},
      position: Rectangle) {

    this.completion_list_visible = false;
    this.tooltip_visible = false;
    this.autocomplete_data = data;
    this.callback = callback;

    if (this.block) return;

    if (data.completions && data.completions.length){
      this.tooltip.style.top = '-1000px';

      this.selected_index = 0;

      this.completion_list.innerHTML = `<ul>`
        + data.completions.map((name, index) => {
          if (name === this.last_completion) this.selected_index = index;
          return `<li><a>${name}</a></li>`;
        }).join('\n') + `<ul>`;

      const height = this.completion_list.offsetHeight;

      if (this.options.autocomplete_prefer_top){
        if (position.top < 200){
          this.completion_list.style.top = (position.bottom + 5) + 'px';
        }
        else {
          this.completion_list.style.top = (position.top - height - 5) + 'px';
        }
      }
      else {

        // compiler thinks this is possibly undefined, but vs code does
        // not -- I thought vs code used the same tsc we use to compile?

        if (document.documentElement) {
          const viewport_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
          if (viewport_height - position.bottom < 200 ){
            this.completion_list.style.top = (position.top - height - 5) + 'px';
          }
          else {
            this.completion_list.style.top = (position.bottom + 5) + 'px';
          }

        }
      }

      this.completion_list.style.left = position.left + 'px';

      const children = this.completion_list.querySelectorAll('a');
      children[this.selected_index].classList.add('selected');
      this.last_completion = children[this.selected_index].textContent || undefined;

      this.completion_list_visible = true;
    }
    else this.completion_list.style.top = '-1000px';

    if (data.tooltip){

      this.tooltip.textContent = data.tooltip + data.arguments +
        (data.description ? '\n' + data.description : '');

      this.tooltip.style.left = position.left + 'px';
      if (this.options.tooltip_prefer_top){
        this.tooltip.style.top = (position.top - this.tooltip.offsetHeight - 5 ) + 'px';
      }
      else {
        this.tooltip.style.top = (position.bottom + 5 ) + 'px';
      }
      this.tooltip_visible = true;
    }
    else this.tooltip.style.top = '-1000px';
  }


}

