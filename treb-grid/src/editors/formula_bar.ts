
import { Yield } from 'treb-utils';

import { DOMUtilities } from '../util/dom_utilities';
import { ExtendedTheme } from '../types/theme';
import { FormulaEditorBase, FormulaEditorEvent } from './formula_editor_base';
import { GridOptions } from '../types/grid_options';
import { Autocomplete } from './autocomplete';
import { DataModel } from '../types/data_model';

export interface FormulaBarResizeEvent {
  type: 'formula-bar-resize';
}

export interface FormulaBarStartEditEvent {
  type: 'start-edit';
}

export interface FormulaButtonEvent {
  type: 'formula-button';
  formula?: string;
  cursor_position?: number;
}

export type FormulaBar2Event
  = FormulaBarResizeEvent
  | FormulaBarStartEditEvent
  | FormulaEditorEvent
  | FormulaButtonEvent;

export class FormulaBar extends FormulaEditorBase<FormulaBar2Event> {

  /** is the _editor_ currently focused */
  // tslint:disable-next-line:variable-name
  public focused_ = false;

  /** accessor for focused field */
  public get focused() { return this.focused_; }

  /** address label (may also show other things... ?) */
  private address_label_container!: HTMLDivElement;

  /** address label (may also show other things... ?) */
  private address_label!: HTMLDivElement;

  /** the function button (optional?) */
  private button!: HTMLButtonElement;

  /** corner for resizing formula editor */
  private drag_corner!: HTMLDivElement;

  /** for math */
  private lines = 1;

  private last_formula = '';

  /** set formula text */
  public set formula(text: string) {
    if (this.editor_node) {
      this.editor_node.textContent = text;
      this.last_reconstructed_text = '';
    }
    this.last_formula = text;
  }

  /** get formula text */
  public get formula() {
    return this.editor_node ? this.editor_node.textContent || '' : '';
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
      if (this.address_label.scrollWidth > this.address_label.offsetWidth) {
        this.address_label.setAttribute('title', text);
      }
      else {
        this.address_label.removeAttribute('title');
      }
    }
  }

  /** get address label text */
  public get label() {
    return this.address_label ? this.address_label.textContent || '' : '';
  }

  /** toggle editable property: supports locked cells */
  public set editable(editable: boolean) {
    if (!this.editor_node || !this.container_node) return;
    this.editor_node.setAttribute('contenteditable', editable.toString());

    if (!editable) {
      this.container_node.style.backgroundColor =
        this.theme.formula_bar_locked_background_color ||
        this.theme.formula_bar_background_color ||
        null;
    }
    else {
      this.container_node.style.backgroundColor =
        this.theme.formula_bar_background_color || null;
    }

  }

  constructor(
    private container: HTMLElement,
    theme: ExtendedTheme,
    model: DataModel,
    private options: GridOptions,
    autocomplete: Autocomplete,
    ) {

    super(theme, model, autocomplete);

    /*
    this.autocomplete = new Autocomplete({
      theme: this.theme,
    });
    */

    // create layout. need a flex patch for chrome

    const outer_node = DOMUtilities.CreateDiv('treb-formula-bar-container', container);
    const inner_node = DOMUtilities.CreateDiv('treb-formula-bar', outer_node);

    // this.node = DOMUtilities.CreateDiv('treb-formula-bar', container);

    this.address_label_container = DOMUtilities.CreateDiv('address-label', inner_node);
    this.address_label = DOMUtilities.CreateDiv('', this.address_label_container);

    if (this.options.insert_function_button) {

      this.button = DOMUtilities.Create<HTMLButtonElement>('button', 'formula-button', inner_node);
      const text1 = DOMUtilities.Create<HTMLSpanElement>('span', 'text-1', this.button);
      const text2 = DOMUtilities.Create<HTMLSpanElement>('span', 'text-2', this.button);

      this.button.addEventListener('click', (event) => {
        const formula: string = this.editor_node ? this.editor_node.textContent || '' : '';
        this.Publish({ type: 'formula-button', formula });
      });

    }

    this.container_node = DOMUtilities.CreateDiv('editor-container', inner_node);
    this.editor_node = DOMUtilities.CreateDiv('formula-editor', this.container_node);
    this.editor_node.setAttribute('contenteditable', 'true');
    this.editor_node.setAttribute('spellcheck', 'false');

    this.editor_node.addEventListener('focusin', (event) => {

      // console.info('focus in');

      let text = this.editor_node ? this.editor_node.textContent || '' : '';

      // if (text.startsWith('{') && text.endsWith('}')){
      if (text[0] === '{' && text[text.length - 1] === '}') {
        text = text.substr(1, text.length - 2);
        if (this.editor_node) {
          this.editor_node.textContent = text;
          this.last_reconstructed_text = '';
        }
      }
      this.autocomplete.ResetBlock();

      /*
      const fragment = this.Reconstruct();
      if (fragment && this.editor_node) {
        this.editor_node.textContent = '';
        this.editor_node.appendChild(fragment);
      }
      */
      Yield().then(() => {
        this.Reconstruct(true);
      });

      const dependencies = this.ListDependencies();

      this.Publish([
        { type: 'update', text, cell: this.active_cell, dependencies },
        { type: 'retain-focus', focus: true },
      ]);

      this.focused_ = true;

    });

    this.editor_node.addEventListener('focusout', (event) => {

      // console.info('focus out');

      this.autocomplete.Hide();
      this.Publish({ type: 'retain-focus', focus: false });
      this.focused_ = false;
    });

    this.editor_node.addEventListener('keydown', (event) => this.FormulaKeyDown(event));
    this.editor_node.addEventListener('keyup', (event) => this.FormulaKeyUp(event));

    // IE11 doesn't support this event? (not on contenteditable, as it turns out)
    this.editor_node.addEventListener('input', (event) => {
      this.Reconstruct();
      this.UpdateSelectState();
    });

    // this.drag_corner = Dom2.CreateDiv(this.container_node, 'drag-corner');
    // this.drag_corner.addEventListener('mousedown', (event) => this.StartDrag(event));

    this.UpdateTheme();
  }

  public IsElement(element: HTMLElement) {
    return element === this.editor_node;
  }

  /**
   * focuses the formula editor. this is intended to be called after a
   * range selection, so we can continue editing.
   */
  public FocusEditor(){
    if (this.editor_node) {
      this.editor_node.focus();
    }
  }

  public UpdateTheme(){

    let font_size = this.theme.formula_bar_font_size || null;

    if (typeof font_size === 'number') {
      font_size = `${font_size}pt`;
    }

    // all these are applied to the container; font is then inherited.

    this.address_label_container.style.fontFamily = this.theme.formula_bar_font_face || null;
    this.address_label_container.style.fontSize = font_size;
    this.address_label_container.style.backgroundColor = this.theme.formula_bar_background_color || null;
    this.address_label_container.style.color = this.theme.formula_bar_color || null;

    if (this.container_node) {
      this.container_node.style.fontFamily = this.theme.formula_bar_font_face || null;
      this.container_node.style.fontSize = font_size;
      this.container_node.style.backgroundColor = this.theme.formula_bar_background_color || null;
      this.container_node.style.color = this.theme.formula_bar_color || null;
    }

    if (this.autocomplete) {
      this.autocomplete.UpdateTheme();
    }

  }

  private FormulaKeyDown(event: KeyboardEvent){

    const ac_result = this.autocomplete.HandleKey('keydown', event);
    if (ac_result.accept) this.AcceptAutocomplete(ac_result);
    if (ac_result.handled) return;

    switch (event.key){
    case 'Enter':
    case 'Tab':
      this.selecting_ = false;
      const array = (event.key === 'Enter' && event.ctrlKey && event.shiftKey);
      this.Publish({
        type: 'commit',
        selection: this.selection,
        value: this.editor_node ? this.editor_node.textContent || '' : '',
        event,
        array,
      });
      this.FlushReference();
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

    if (this.trident) {
      this.UpdateSelectState();
      this.Reconstruct();
    }

  }


}

