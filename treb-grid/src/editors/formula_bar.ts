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

// import type { Area, Cell, Theme } from 'treb-base-types';
import { Editor, type NodeDescriptor, type FormulaEditorEvent } from './editor';
// import { Parser } from 'treb-parser';
import type { DataModel, ViewModel } from 'treb-data-model';
import type { GridOptions } from '../types/grid_options';
import { Autocomplete } from './autocomplete';
import { DOMContext } from 'treb-base-types';

// --- from formula_bar ---

/*
export interface FormulaBarResizeEvent {
  type: 'formula-bar-resize';
}
*/

export interface FormulaButtonEvent {
  type: 'formula-button';
  formula?: string;
  cursor_position?: number;
}

export interface AddressLabelEvent {
  type: 'address-label-event';
  text?: string;
}

export interface TollEvent {
  type: 'toll';
  value?: string;
}

export type FormulaBar2Event
  = FormulaButtonEvent
  // | FormulaBarResizeEvent
  | AddressLabelEvent
  | TollEvent
  ;

// ---

export class FormulaBar extends Editor<FormulaBar2Event|FormulaEditorEvent> {


  public committed = false;

  public tolled?: { text: string, substring: string };

  /** 
   * if we're showing a spill array and it's not the first cell, show
   * the formula using a shadow style (and it's not editable).
   */
  public shadow_ = false;

  public get shadow() { return this.shadow_; }

  public set shadow(shadow: boolean) { 
    this.shadow_ = shadow;
    if (this.active_editor?.node) {
      if (shadow) {
        this.active_editor.node.classList.add('treb-editor-shadow');
      }
      else {
        this.active_editor.node.classList.remove('treb-editor-shadow');
     }
    }
  }

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

  /* * corner for resizing formula editor * /
  private drag_corner!: HTMLDivElement; 

  / * * for math * /
  private lines = 1;

  private last_formula = '';
  */

  private label_update_timer = 0;

  /** get formula text */
  public get formula(): string {
    return this.active_editor ? this.active_editor.node.textContent || '' : '';
  }

  /** set formula text */
  public set formula(text: string) {
    if (this.active_editor) {
      this.active_editor.node.textContent = text;
      this.active_editor.formatted_text = undefined;
    }
    // this.last_formula = text;
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
    if (!this.active_editor || !this.container_node) return;

    if (editable) {
      this.active_editor.node.setAttribute('contenteditable', 'true'); // is that required?
      this.container_node.removeAttribute('locked');
    }
    else {
      this.active_editor.node.removeAttribute('contenteditable');
      this.container_node.setAttribute('locked', '');
    }

  }

  constructor(
    container: HTMLElement,
    // parser: Parser,
    // theme: Theme,
    model: DataModel,
    view: ViewModel,
    private options: GridOptions,
    autocomplete: Autocomplete,
    ) {

    super(model, view, autocomplete);
    const DOM = DOMContext.GetInstance(container.ownerDocument);

    const inner_node = container.querySelector('.treb-formula-bar') as HTMLElement;
    inner_node.removeAttribute('hidden');

    this.address_label_container = inner_node.querySelector('.treb-address-label') as HTMLDivElement;
    this.address_label = this.address_label_container.firstElementChild as HTMLDivElement;

    this.InitAddressLabel();

    /*
    if (this.options.insert_function_button) {
      this.button = DOM.Create('button', 'formula-button', inner_node);
      this.button.addEventListener('click', () => {
        const formula: string = this.active_editor ? this.active_editor.node.textContent || '' : '';
        this.Publish({ type: 'formula-button', formula });
      });
    }
    */

    this.container_node = container.querySelector('.treb-editor-container') as HTMLDivElement;
    const target = this.container_node.firstElementChild as HTMLDivElement;
    const descriptor: NodeDescriptor = {
      node: target,
    };

    this.active_editor = descriptor;
    this.nodes = [ descriptor ];

    // ------------------

    if (target) {
      this.RegisterListener(descriptor, 'input', (event: Event) => {

        // we send an extra event when we insert a reference.
        // so filter that out. this might cause problems for other
        // callers -- could we use a different filter?

        if (event.isTrusted) {
          this.UpdateText(descriptor);
          this.UpdateColors(); // will send a local event
        }

      });
    }

    // ------------------

    // 
    // change the default back. this was changed when we were trying to figure
    // out what was happening with IME, but it had nothing to do with spellcheck.
    //
    this.active_editor.node.spellcheck = false; // change the default back

    this.RegisterListener(descriptor, 'focusin', () => {

      const restore = this.tolled !== undefined;
      this.tolled = undefined;

      // this.editor_node.addEventListener('focusin', () => {

      // can't happen
      if (!this.active_editor) { 
        return; 
      }

      // console.info('focus in');

      let text = this.active_editor.node.textContent || '';

      if (this.shadow) {
        this.shadow = false;
        text = '';
        this.active_editor.node.textContent = text;
        this.active_editor.formatted_text = undefined; // why do we clear this here? 
      }
      if (text[0] === '{' && text[text.length - 1] === '}') {
        text = text.substring(1, text.length - 1);
        this.active_editor.node.textContent = text;
        this.active_editor.formatted_text = undefined; // why do we clear this here? 
      }

      // not here // this.editor_node.spellcheck = (text[0] !== '='); // true except for functions
      this.autocomplete?.ResetBlock();

      this.UpdateText(this.active_editor);
      this.UpdateColors(undefined, true); // toll update event -- we will send in order, below

      if (restore) {

        // FIXME: we probably want to hold the caret so we can restore
        // to a particular place. or set the caret explicitly.

        const node = this.NodeAtIndex(text.length - 1);
        // console.info({text, node});
        if (node) {
          this.SetCaret({node: node as ChildNode, offset: (node.textContent || '').length});
        }
      }

      this.committed = false;

      this.Publish([
        { type: 'start-editing', editor: 'formula-bar' },
        { type: 'update', text, cell: this.active_cell, dependencies: this.composite_dependencies },
      ]);

      this.focused_ = true;

    });

    this.RegisterListener(descriptor, 'focusout', (event: FocusEvent) => {

      // this is new, to support an external "insert function" dialog.
      // still working out the semantics, but essentially we won't commit
      // and we'll keep pending text. we need some sort of flag to indicate
      // that we're in the editing state.

      const toll = (event.relatedTarget instanceof HTMLElement && event.relatedTarget.dataset.tollEditor);

      if (this.selecting) {
        console.info('focusout, but selecting...');
      }

      this.autocomplete?.Hide();
      
      const text = (this.active_editor ? 
        this.GetTextContent(this.active_editor.node).join('') : '').trim();

      if (toll) {

        let substring = text;
        if (this.active_editor?.node) {
          const s2c = this.SubstringToCaret2(this.active_editor.node, true);
          substring = s2c[0];
        }

        this.committed = true;
        this.tolled = {
          text,
          substring,
        };
        
        this.Publish({
          type: 'toll',
          value: text,
        });

      }
      else if (this.committed) {
        this.Publish([
          { type: 'stop-editing' },
        ]);
      }
      else {
        this.committed = true;
        this.Publish({
          type: 'commit',
          value: text,
        });
      }

      // huh? we're publishing this twice?

      this.Publish([
        { type: 'stop-editing' },
      ]);

      this.focused_ = false;

      if (this.active_editor) {
        this.active_editor.node.spellcheck = false; // for firefox
      }

    });

    this.RegisterListener(descriptor, 'keydown', this.FormulaKeyDown.bind(this));
    this.RegisterListener(descriptor, 'keyup', this.FormulaKeyUp.bind(this));

    // why is this here, instead of in markup? just an oversight?

    if (this.options.expand_formula_button) {

      let focus_related_target: HTMLElement|undefined;

      this.expand_button = DOM.Create('button', 'expand-button', inner_node, { 
        events: {
          focus: (event: FocusEvent) => {
            focus_related_target = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : undefined;
          },

          click: (event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
            if (this.active_editor) {
              this.active_editor.node.scrollTop = 0;
            }
            if (inner_node.hasAttribute('expanded')) {
              inner_node.removeAttribute('expanded');
            }
            else {
              inner_node.setAttribute('expanded', '');
            }

            if (focus_related_target) {
              focus_related_target.focus();
            }

          },
        },
      });

    }

  }

  /**
   * we might be overthinking this, we don't necessarily need to restore.
   * 
   * this method will focus the editor and set the caret (to the end, atm)
   * in case of a tolled editor. the idea is you call Restore() after your 
   * dialog is complete and it's like you are back where you started.
   * 
   * alternatively, call `Release()` to clean up any saved state.
   */
  public Restore() {
    const target = this.container_node?.firstElementChild as HTMLDivElement;
    if (target) {
      target.focus();
    }
  }

  /**
   * release anything that's been tolled. call this if you toll the editor
   * but don't want to restore it when you are done. I think this will be
   * the default.
   */
  public Release() {
    this.tolled = undefined;
  }

  public IsElement(element: HTMLElement): boolean {
    return element === this.active_editor?.node;
  }

  public IsExpandButton(element: HTMLElement): boolean {
    return this.expand_button && (element === this.expand_button);
  }

  public InitAddressLabel() {

    this.address_label.contentEditable = 'true';
    this.address_label.spellcheck = false;

    // on focus, select all 
    // Q: do we do this in other places? we should consolidate
    // A: I don't think we do just this, usually there's additional logic for % and such

    this.address_label.addEventListener('focusin', () => {

      const doc = this.address_label.ownerDocument;

      // FIXME: close any open editors? (...)

      // we're now doing this async for all browsers... it's only really
      // necessary for IE11 and safari, but doesn't hurt

      requestAnimationFrame(() => {
          const selection = (doc.defaultView as (Window & typeof globalThis)).getSelection();
          const range = doc.createRange();
          range.selectNodeContents(this.address_label);
          selection?.removeAllRanges();
          selection?.addRange(range);
      });

    });

    this.address_label.addEventListener('keydown', (event) => {

      if (event.isComposing) {
        return;
      }

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



  private FormulaKeyUp(event: KeyboardEvent){

    if (event.isComposing) {
      return;
    }

    if (this.autocomplete) {
      const ac_result = this.autocomplete.HandleKey('keyup', event);
      if (ac_result.handled) {
        return;
      }
      // this.FlushReference();
    }

  }

  private FormulaKeyDown(event: KeyboardEvent){

    if (event.isComposing) {
      return;
    }

    if (this.autocomplete) {
      const ac_result = this.autocomplete.HandleKey('keydown', event);
      if (ac_result.accept) this.AcceptAutocomplete(ac_result);
      if (ac_result.handled) return;
    }

    switch (event.key){
    case 'Enter':
    case 'Tab':
      {
        // this.selecting_ = false;
        const array = (event.key === 'Enter' && event.ctrlKey && event.shiftKey);

        // I think we use this nontstandard routine so that we preserve
        // newlines? not sure. would like to see the motivation for it.

        const text = (this.active_editor ? 
          this.GetTextContent(this.active_editor.node).join('') : '').trim();

        this.committed = true;
        this.Publish({
          type: 'commit',
          // selection: this.selection,
          value: text,
          event,
          array,
        });

        // this.FlushReference();
      }
      break;

    case 'Escape':
    case 'Esc':
      // this.selecting_ = false;
      this.committed = true;
      this.Publish({ type: 'discard' });
      // this.FlushReference();
      break;
      
    default:
      return;
    }

    event.stopPropagation();
    event.preventDefault();

  }

}
