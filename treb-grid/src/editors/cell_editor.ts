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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { Style, Theme, Rectangle, ThemeColor } from 'treb-base-types';
import { Yield } from 'treb-utils';

import { DOMUtilities } from '../util/dom_utilities';
import type { GridSelection } from '../types/grid_selection';
import { FormulaEditorBase } from './formula_editor_base';
import type { Autocomplete } from './autocomplete';
import type { DataModel, ViewModel } from '../types/data_model';
import type { Parser } from 'treb-parser';

/**
 * @deprecated
 */
export class CellEditor extends FormulaEditorBase {

  // tslint:disable-next-line:variable-name
  private visible_ = false;

  /** legacy */
  private support_cloned_events = (typeof KeyboardEvent === 'function');

  /** legacy */
  private use_create_text_range = (typeof ((document.body as any).createTextRange) === 'function');

  /** accessor for editor visible */
  public get visible(){ return this.visible_; }

  constructor(private container: HTMLElement, parser: Parser, theme: Theme, model: DataModel, view: ViewModel, autocomplete: Autocomplete){

    super(parser, theme, model, view, autocomplete);

    // this.autocomplete = new Autocomplete({
    //  theme: this.theme,
    // });

    this.container_node = DOMUtilities.CreateDiv('in-cell-editor-container notranslate', container);
    this.editor_node = DOMUtilities.CreateDiv('in-cell-editor', this.container_node);
    this.editor_node.setAttribute('contenteditable', 'true');
    // this.editor_node.setAttribute('spellcheck', 'false');
    this.editor_node.setAttribute('tabindex', '-1');
    this.editor_node.spellcheck = true; // change the default

    // this.UpdateTheme();

    this.editor_node.addEventListener('input', () => {

      this.Reconstruct();
      this.UpdateSelectState();

    });

    /** special handler for keyup */
    this.editor_node.addEventListener('keyup', (event) => {

      const ac_result = this.autocomplete.HandleKey('keyup', event);
      if (ac_result.handled) return;

      if (this.selecting_){
        switch (event.key){
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Shift':       // also selection modifiers
        case 'Control':     // ...
          return;
        }
      }

      // clear node. new ones will be created as necessary.
      this.FlushReference();

      this.UpdateSelectState(true);

    });

  }

  public UpdateTheme(scale: number): void {

    if (this.editor_node) {
      // this.editor_node.style.color = this.theme.cell_color || '';

      /*
      this.editor_node.style.fontFamily = this.theme.cell_font || '';
      let font_size = this.theme.cell_font_size_value || 10;
      if (scale) {
        font_size = font_size * scale;
      }
      this.editor_node.style.fontSize = // `${this.theme.cell_font_size}`;
        `${font_size}${this.theme.cell_font_size_unit}`;
      */

     // this.editor_node.style.backgroundColor = this.theme.cell_background_color || '';

      // this.editor_node.style.color = this.theme.grid_cell?.text_color || '';
      this.editor_node.style.color = ThemeColor(this.theme, this.theme.grid_cell?.text);

      this.editor_node.style.font = Style.Font(this.theme.grid_cell||{}, scale);
      this.editor_node.style.backgroundColor = this.theme.grid_cell?.fill ? ThemeColor(this.theme, this.theme.grid_cell.fill) : '';

      this.editor_node.style.borderColor = this.theme.grid_color || '';
    }

    //if (this.autocomplete) {
    //  this.autocomplete.UpdateTheme();
    //}

  }

  /** start the cell editor, with the given shape */
  public Edit(grid_selection: GridSelection, rect: Rectangle, value?: any, event?: KeyboardEvent){

    if (!this.editor_node || !this.container_node) return;

    this.Publish({ 
      type: 'start-editing', 
      editor: 'ice',
    });

    const value_string = value?.toString() || '';
    
    // this.editor_node.setAttribute('spellcheck', 'false');
    this.editor_node.spellcheck = value_string[0] !== '=';

    // ensure clear
    this.FlushReference();

    this.selection = grid_selection;

    this.autocomplete.ResetBlock();

    if (typeof value !== 'undefined'){

      const percent = value_string[0] !== '=' && value_string[value_string.length - 1] === '%';
      const value_length = value_string.length;
      this.editor_node.textContent = value_string;

      if (this.use_create_text_range) {

        Yield().then(() => {
          const r = (document.body as any).createTextRange();
          r.moveToElementText(this.editor_node);

          // the weird logic here is as follows: move to the end, unless
          // it's a percent; in which case move to just before the % sign;
          // unless, in the special case of overtyping a %, don't do anything.
          // it works (the last case) because this is called via a yield. IE
          // will somehow end up doing the right thing in this case.

          if (percent) {
            if (value_length > 1) {
              r.moveStart('character', value_length);
              r.move('character', -1);
              r.select();
            }
          }
          else {
            r.moveStart('character', value_length);
            r.select();
          }

        });
      }
      else {

        const range = document.createRange();
        const selection = window.getSelection();

        if (!selection) throw new Error('invalid selection object');

        if (this.editor_node.lastChild){
          if (percent) {
            range.setStart(this.editor_node.lastChild, value_length - 1);
            range.setEnd(this.editor_node.lastChild, value_length - 1);
          }
          else {
            range.setStartAfter(this.editor_node.lastChild);
          }
        }

        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

      }

      if (!event) {
        const dependencies = this.ListDependencies();
        this.Publish({type: 'update', text: value.toString(), dependencies});
      }

    }
    else {

      // note: this is junk for mozilla. if we don't do this, for whatever
      // reason the cursor starts at the top of the box, but only when (and
      // while) there's no text; as soon as there's one character, it goes
      // to the bottom where we want it.

      // this seems harmless (if wasteful), since we are pulling text later.

      this.editor_node.innerHTML = '<span></span>';

    }

    this.visible_ = true;
    // rect.ApplyStyle(this.container_node);

    // UPDATE: setting min width, instead of width
    this.container_node.style.left = rect.left + 'px';
    this.container_node.style.top = rect.top + 'px';
    this.container_node.style.minWidth = rect.width + 'px';
    this.container_node.style.height = rect.height + 'px';

    this.container_node.style.opacity = '1';
    this.container_node.style.display = 'table';
    
    this.editor_node?.focus();

    if (event){
      if (this.support_cloned_events) {

        // we don't need to do this? IME is still breaking, but this seems
        // to work without dispatching the event... perhaps that's because
        // of the INPUT event? not sure

        // const cloned_event = new KeyboardEvent(event.type, event);
        // this.editor_node?.dispatchEvent(cloned_event);
      }
      else {
        const modifiers: string[] = [];
        if (event.ctrlKey) { modifiers.push('Control'); }
        if (event.shiftKey) { modifiers.push('Shift'); }
        if (event.altKey) { modifiers.push('Alt'); }
        const cloned_event = document.createEvent('KeyboardEvent');

        // need to mask type for trident
        (cloned_event as any).initKeyboardEvent(event.type,
          true,
          true,
          event.view,
          event.key,
          event.location,
          modifiers.join(' '),
          event.repeat,
          '');

        this.editor_node?.dispatchEvent(cloned_event);
      }
    }

    Yield().then(() => {
      this.last_reconstructed_text = '';
      this.Reconstruct();
    });

    // wait // this.UpdateSelectState();

  }

  /** hide the cell editor. separate from commit/accept logic */
  public Hide(){
    if (!this.container_node) return;

    this.visible_ = false;
    // this.container_node.style.display = 'none';
    this.container_node.style.opacity = '0';

    this.autocomplete.Hide();
  }

  /**
   * checks whether the editor wants to handle this key event. if this
   * returns true, caller should abandon any handlers.
   */
  public HandleKeyEvent(event: KeyboardEvent){

    if (!this.editor_node) return;

    // AC first

    const ac_result = this.autocomplete.HandleKey('keydown', event);

    if (ac_result.accept){
      this.AcceptAutocomplete(ac_result);
    }
    if (ac_result.handled) return true;

    // /AC

    switch (event.key){
    case 'Enter':
    case 'Tab':
      {
        // we're going to trap this event, and then re-send it, as we do with
        // the formula bar editor. this is so that the grid can send the data
        // event before the selection event, to better support undo.

        const value = this.editor_node.textContent || undefined;
        const array = (event.key === 'Enter' && event.ctrlKey && event.shiftKey);
        this.Publish({type: 'commit', value, selection: this.selection, array, event});
        this.selecting_ = false;

        // do this so we don't tab-switch-focus
        event.stopPropagation();
        event.preventDefault();

        return true; // false;
      }
    case 'Escape':
    case 'Esc':
      this.Publish({type: 'discard'});
      this.selecting_ = false;
      return true; // we are handling it

    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Up':
    case 'Down':
    case 'Left':
    case 'Right':

      return !this.selecting_; // returns false if selecting arguments

    // default:
    //  console.info('unhandled', event.key);
    }

    return true;
  }

  /**
   * checks whether the editor wants to handle this mouse event.
   * if this returns true, caller should abandon any event handling.
   *
   * @param event
   */
  public HandleMouseEvent(event: MouseEvent){

    if (!this.visible_) return false;
    let event_target: HTMLElement|null = event.target as HTMLElement;
    while (event_target){
      if (event_target === this.editor_node) return true;
      if (event_target === this.container) return false; // prevent long lookup
      event_target = event_target.parentElement;
    }

    // console.info('returning false, orignial event', event);

    return false;
  }

}
