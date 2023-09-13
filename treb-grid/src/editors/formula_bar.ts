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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import { Yield } from 'treb-utils';

import { DOMUtilities } from '../util/dom_utilities';
import type { Theme } from 'treb-base-types';
import type { FormulaEditorEvent } from './formula_editor_base';
import { FormulaEditorBase } from './formula_editor_base';
import type { GridOptions } from '../types/grid_options';
import type { Autocomplete } from './autocomplete';
import type { DataModel, ViewModel } from '../types/data_model';
import type { Parser } from 'treb-parser';

export interface FormulaBarResizeEvent {
  type: 'formula-bar-resize';
}

export interface FormulaButtonEvent {
  type: 'formula-button';
  formula?: string;
  cursor_position?: number;
}

export interface AddressLabelEvent {
  type: 'address-label-event';
  text?: string;
}

export type FormulaBar2Event
  = FormulaEditorEvent
  | FormulaButtonEvent
  | FormulaBarResizeEvent
  | AddressLabelEvent
  ;

export class FormulaBar extends FormulaEditorBase<FormulaBar2Event> {

  /** is the _editor_ currently focused */
  // tslint:disable-next-line:variable-name
  public focused_ = false;

  /** accessor for focused field */
  public get focused(): boolean { return this.focused_; }

  /** address label (may also show other things... ?) */
  private address_label_container: HTMLDivElement;

  /** address label (may also show other things... ?) */
  private address_label: HTMLDivElement;

  /** the function button (optional?) */
  private button!: HTMLButtonElement;

  /** */
  private expand_button!: HTMLButtonElement;

  /** corner for resizing formula editor */
  private drag_corner!: HTMLDivElement;

  /** for math */
  private lines = 1;

  private last_formula = '';

  private label_update_timer = 0;

  /** get formula text */
  public get formula(): string {
    return this.editor_node ? this.editor_node.textContent || '' : '';
  }

  /** set formula text */
  public set formula(text: string) {
    if (this.editor_node) {
      this.editor_node.textContent = text;
      this.last_reconstructed_text = '';
    }
    this.last_formula = text;
  }

  /** get address label text */
  public get label(): string {
    return this.address_label?.textContent || '';
  }

  /**
   * set address label text. if the label is too long for the box,
   * add a title attribute for a tooltip.
   */
  public set label(text: string) {
    if (!text.trim().length) {
      this.address_label.innerHTML = '&nbsp;';
      this.address_label.removeAttribute('title');
    }
    else {
      this.address_label.textContent = text;

      if (!this.label_update_timer) {
        this.label_update_timer = requestAnimationFrame(() => {
          this.label_update_timer = 0;

          // should this be in a Yield callback? need to check IE11...
          // yes

          if (this.address_label.scrollWidth > this.address_label.offsetWidth) {
            this.address_label.setAttribute('title', text);
          }
          else {
            this.address_label.removeAttribute('title');
          }

        });
      }
      
    }
  }

  /** toggle editable property: supports locked cells */
  public set editable(editable: boolean) {
    if (!this.editor_node || !this.container_node) return;

    if (editable) {
      this.editor_node.setAttribute('contenteditable', 'true'); // is that required?
      this.container_node.removeAttribute('locked');
    }
    else {
      this.editor_node.removeAttribute('contenteditable');
      this.container_node.setAttribute('locked', '');
    }

  }

  constructor(
    private container: HTMLElement,
    parser: Parser,
    theme: Theme,
    model: DataModel,
    view: ViewModel,
    private options: GridOptions,
    autocomplete: Autocomplete,
    ) {

    super(parser, theme, model, view, autocomplete);

    const inner_node = container.querySelector('.treb-formula-bar') as HTMLElement;
    inner_node.removeAttribute('hidden');

    this.address_label_container = inner_node.querySelector('.treb-address-label') as HTMLDivElement;
    this.address_label = this.address_label_container.firstElementChild as HTMLDivElement;

    this.InitAddressLabel();

    if (this.options.insert_function_button) {
      this.button = DOMUtilities.Create<HTMLButtonElement>('button', 'formula-button', inner_node);
      this.button.addEventListener('click', () => {
        const formula: string = this.editor_node ? this.editor_node.textContent || '' : '';
        this.Publish({ type: 'formula-button', formula });
      });
    }

    this.container_node = container.querySelector('.treb-editor-container') as HTMLDivElement;
    this.editor_node = this.container_node.firstElementChild as HTMLDivElement;

    // 
    // change the default back. this was changed when we were trying to figure
    // out what was happening with IME, but it had nothing to do with spellcheck.
    //
    this.editor_node.spellcheck = false; // change the default back

    this.editor_node.addEventListener('focusin', () => {

      // can't happen
      if (!this.editor_node) { return; }

      // console.info('focus in');

      let text = this.editor_node.textContent || '';

      if (text[0] === '{' && text[text.length - 1] === '}') {
        text = text.substr(1, text.length - 2);
        this.editor_node.textContent = text;
        this.last_reconstructed_text = '';
      }

      this.editor_node.spellcheck = (text[0] !== '='); // true except for functions

      this.autocomplete.ResetBlock();

      /*
      const fragment = this.Reconstruct();
      if (fragment && this.editor_node) {
        this.editor_node.textContent = '';
        this.editor_node.appendChild(fragment);
      }
      */
      Yield().then(() => {
        // this.Reconstruct(true);
        this.Reconstruct();
      });

      const dependencies = this.ListDependencies();

      this.Publish([
        { type: 'start-editing', editor: 'formula-bar' },
        { type: 'update', text, cell: this.active_cell, dependencies },
        // { type: 'retain-focus', focus: true },
      ]);

      this.focused_ = true;

    });

    this.editor_node.addEventListener('focusout', () => {

      if (this.selecting) {
        console.info('focusout, but selecting...');
      }

      // console.info('focus out');

      this.autocomplete.Hide();
      this.Publish([
        { type: 'stop-editing' },
        // { type: 'retain-focus', focus: false },
      ]);
      this.focused_ = false;

      if (this.editor_node) {
        this.editor_node.spellcheck = false; // for firefox
      }

    });

    this.editor_node.addEventListener('keydown', (event) => this.FormulaKeyDown(event));
    this.editor_node.addEventListener('keyup', (event) => this.FormulaKeyUp(event));

    this.editor_node.addEventListener('input', (event: Event) => {

      if (event instanceof InputEvent && event.isComposing) {
        return;
      }

      this.Reconstruct();
      this.UpdateSelectState();

    });

    if (this.options.expand_formula_button) {
      this.expand_button = DOMUtilities.Create<HTMLButtonElement>('button', 'expand-button', inner_node);
      this.expand_button.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        if (this.editor_node) {
          this.editor_node.scrollTop = 0;
        }
        // inner_node.classList.toggle('expanded');
        if (inner_node.hasAttribute('expanded')) {
          inner_node.removeAttribute('expanded');
        }
        else {
          inner_node.setAttribute('expanded', '');
        }
      });
    }

  }

  public IsElement(element: HTMLElement): boolean {
    return element === this.editor_node;
  }

  public InitAddressLabel() {

    this.address_label.contentEditable = 'true';
    this.address_label.spellcheck = false;

    // on focus, select all 
    // Q: do we do this in other places? we should consolidate
    // A: I don't think we do just this, usually there's additional logic for % and such

    this.address_label.addEventListener('focusin', (event) => {

      // FIXME: close any open editors? (...)

      // we're now doing this async for all browsers... it's only really
      // necessary for IE11 and safari, but doesn't hurt

      requestAnimationFrame(() => {
        if ((document.body as any).createTextRange) {
          const range = (document.body as any).createTextRange();
          range.moveToElementText(this.address_label);
          range.select();
        }
        else {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(this.address_label);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });

    });

    this.address_label.addEventListener('keydown', (event) => {
      switch (event.key) {
          
        case 'Enter':
          event.stopPropagation();
          event.preventDefault();
          this.Publish({
            type: 'address-label-event',
            text: this.address_label.textContent || undefined,
          });
          break;

        case 'Esc':
        case 'Escape':
          event.stopPropagation();
          event.preventDefault();
          this.Publish({ type: 'address-label-event' });
          break;                    
      }
    });

  }

  /**
   * focuses the formula editor. this is intended to be called after a
   * range selection, so we can continue editing.
   */
  public FocusEditor(): void {
    if (this.editor_node) {
      this.editor_node.focus();
    }
  }

  /*
  public UpdateTheme(): void {

    let font_size = this.theme.formula_bar_font_size || null;

    if (typeof font_size === 'number') {
      font_size = `${font_size}pt`;
    }

    // all these are applied to the container; font is then inherited.

    this.address_label_container.style.fontFamily = this.theme.formula_bar_font_face || '';
    this.address_label_container.style.fontSize = font_size || '';
    this.address_label_container.style.fontWeight = '400'; // FIXME
    
    this.address_label_container.style.backgroundColor = this.theme.formula_bar_background_color || '';
    this.address_label_container.style.color = this.theme.formula_bar_color || '';

    if (this.container_node) {
      this.container_node.style.fontFamily = this.theme.formula_bar_font_face || '';
      this.container_node.style.fontSize = font_size || '';
      this.container_node.style.fontWeight = '400'; // FIXME
      this.container_node.style.backgroundColor = this.theme.formula_bar_background_color || '';
      this.container_node.style.color = this.theme.formula_bar_color || '';
    }

    if (this.autocomplete) {
      this.autocomplete.UpdateTheme();
    }

  }
  */

  private GetTextContent(node: Node) {

    const children = node.childNodes;
    const buffer: string[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      switch (child.nodeType) {
        case Node.ELEMENT_NODE:
          buffer.push(...this.GetTextContent(child));
          if (child instanceof Element && child.tagName === 'DIV') {
            buffer.push('\n');
          }
          break;

        case Node.TEXT_NODE:
          if (child.nodeValue) { buffer.push(child.nodeValue); }
          break;
      }
    }
    return buffer;

  }

  private FormulaKeyDown(event: KeyboardEvent){

    const ac_result = this.autocomplete.HandleKey('keydown', event);
    if (ac_result.accept) this.AcceptAutocomplete(ac_result);
    if (ac_result.handled) return;

    switch (event.key){
    case 'Enter':
    case 'Tab':
      {
        this.selecting_ = false;
        const array = (event.key === 'Enter' && event.ctrlKey && event.shiftKey);

        const text = (this.editor_node ? 
          this.GetTextContent(this.editor_node).join('') : '').trim();

        this.Publish({
          type: 'commit',
          // selection: this.selection,
          value: text,
          event,
          array,
        });
        this.FlushReference();
      }
      break;

    case 'Escape':
    case 'Esc':
      this.selecting_ = false;
      this.Publish({ type: 'discard' });
      this.FlushReference();
      break;
      
    default:
      return;
    }

    event.stopPropagation();
    event.preventDefault();

  }

  private FormulaKeyUp(event: KeyboardEvent){

    const ac_result = this.autocomplete.HandleKey('keyup', event);
    if (ac_result.handled) return;
    this.FlushReference();

    // because there are no input events, we have to try this one -- note
    // we still won't capture pastes, FIXME (add handlers?)

    //if (this.trident) {
    //  this.UpdateSelectState();
    //  this.Reconstruct();
    //}

  }


}

