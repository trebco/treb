/**
 * this is a new version of the ICE that doubles as a key handler
 * for the grid; the aim is to support IME in ICE, which did not work
 * in our old scheme.
 * 
 * update: trying to clean up the node structure, remove one node,
 * and get layout working properly. 
 */

import { Style, Theme, CellValue, Rectangle, ThemeColor2, Cell } from 'treb-base-types';
import { Yield } from 'treb-utils';
import { Parser } from 'treb-parser';
import { GridSelection } from '../types/grid_selection';
import { FormulaEditorBase } from './formula_editor_base';
import { Autocomplete } from './autocomplete';
import { DataModel } from '../types/data_model';
import { UA } from '../util/ua';

/**
 * new return type for key event handler, has some additional state
 */
export enum OverlayEditorResult {
  not_handled = 0,
  handled = 1,
  commit = 2,
  discard = 3,
}

/** legacy */
// const support_cloned_events = (typeof KeyboardEvent === 'function');

/** legacy */
// const use_create_text_range = (typeof ((document?.body as any)?.createTextRange) === 'function');

export class OverlayEditor extends FormulaEditorBase {

  // we could add these back, always construct them, and then
  // just assign, that would get us around all the conditionals

  public edit_node: HTMLElement;
  public edit_container: HTMLElement;

  public edit_inset: HTMLElement;
  
  public scale = 1; // this should go into theme, since it tends to follow it

  private _editing = false;
  
  public get editing(): boolean {
    return this._editing;
  }

  public set editing(state: boolean) {
    if (this._editing !== state) {
      this._editing = state;
      if (state) {
        this.edit_container.style.opacity = '1';
        this.edit_container.style.pointerEvents = 'initial';
      }
      else {
        this.edit_container.style.opacity = '0';
        this.edit_container.style.pointerEvents = 'none';
        if (UA.trident) {
          this.edit_container.style.top = '-200px';
        }
      }
    }
  }

  constructor(private container: HTMLElement, parser: Parser, theme: Theme, model: DataModel, autocomplete: Autocomplete) {

    super(parser, theme, model, autocomplete);

    this.edit_container = document.createElement('div');
    this.edit_container.classList.add('overlay-container');
    this.edit_container.classList.add('notranslate');
    this.edit_container.translate = false;

    this.edit_node = document.createElement('div');
    this.edit_node.classList.add('overlay-editor');
    this.edit_node.contentEditable = 'true';
    this.edit_node.tabIndex = -1;
    this.edit_node.spellcheck = true; // default

    if (UA.is_firefox) {
      this.edit_node.classList.add('firefox');
    }
    
    // attempting to cancel "auto" keyboard on ios
    this.edit_node.inputMode = 'none';

    //
    // so clearly I am doing this when rendering, not sure how it
    // happens, but we're offsetting by this much. checked on mac
    // (dpr = 2) and windows (dpr = 1, dpr = 1.5). 1 is the default.
    // 
    // NOTE that there's a `resolution` media query, not implemented in safari
    //
    // https://bugs.webkit.org/show_bug.cgi?id=78087
    //
    // and another nonstandard -webkit-max-device-pixel-ratio, which seems
    // to be in all modern browsers (possibly with -moz prefix in ffx). OTOH 
    // this is not complicated and only called on construct, so probably fine,
    // if somewhat obscure.
    //

    // NOTE: it's not that simple (see linux). it has something to do with
    // measuring the font. we probably need to figure out exactly what we are
    // doing in the renderer, and do that. which also means it might be cell
    // specific if there are font face/size changes. also we can get it to
    // offset incorrectly on windows with some fonts (I'm looking at you, comic 
    // sans)

    // although it probably still has something to do with dpr, maybe that's 
    // a factor...

    //if (self.devicePixelRatio && self.devicePixelRatio > 1) {
    //  this.edit_node.style.paddingBottom = `${self.devicePixelRatio}px`;
    //}

    this.edit_node.addEventListener('input', () => {

      // should we dynamically add this when editing? (...)
      if (!this.editing) { return; }

      this.Reconstruct();
      this.UpdateSelectState();
    });

    this.edit_node.addEventListener('keyup', event => {

      // should we dynamically add this when editing? (...)
      if (!this.editing) { return; }

      const ac = this.autocomplete.HandleKey('keyup', event);
      if (ac.handled) {
        return;
      }

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

    this.edit_inset = document.createElement('div');
    this.edit_inset.classList.add('overlay-inset');
    
    this.edit_container.appendChild(this.edit_node);

    this.edit_container.appendChild(this.edit_inset);
    this.edit_inset.appendChild(this.edit_node);

    // this.edit_container.appendChild(this.edit_node); // dropping inset

    container.appendChild(this.edit_container);

    this.edit_container.style.opacity = '0';

    this.editor_node = this.edit_node as HTMLDivElement;
    this.container_node = this.edit_container as HTMLDivElement;

    this.ClearContents();

  }

  /* * this is here only for compatibility with the old ICE; not sure if we need it * /
  public HandleMouseEvent(event: MouseEvent): boolean {

    return false;
  }
  */

  public Focus(): void {

    // we get unexpected scroll behavior if we focus on the overlay editor
    // when it is not already focused, and the grid is scrolled. that's because
    // by default the editor is at (0, 0), so we need to move it before we 
    // focus on it (but only in this case).

    if (this.edit_node !== document.activeElement) {
      this.edit_container.style.top = `${this.container.scrollTop + 2}px`;
      this.edit_container.style.left = `${this.container.scrollLeft + 2}px`;
    }

    this.edit_node.focus();
  }

  /* TEMP (should be Hide() ?) */
  public CloseEditor(): void {
    this.editing = false;

    // this (all) should go into the set visible accessor? (...)

    this.ClearContents();
    this.edit_node.spellcheck = true; // default
    this.autocomplete.Hide();

    this.active_cell = undefined;

  }

  /**
   * remove contents, plus add mozilla junk node
   */
  public ClearContents(): void {

    // UA doesn't change, so this should be mapped directly 
    // (meaning function pointer and no test)

    // ...maybe overoptimizing

    if (UA.is_firefox) {

      // in firefox if the node is empty when you focus on it the 
      // cursor shifts up like 1/2 em or something, no idea why 
      // (TODO: check bugs)

      this.edit_node.innerHTML = '<span></span>';

    }
    else {
      this.edit_node.textContent = '';
    }

  }

  public Edit(gridselection: GridSelection, rect: Rectangle, cell: Cell, value?: CellValue, event?: Event): void {

    this.Publish({ 
      type: 'start-editing', 
      editor: 'ice',
    });

    this.active_cell = cell;
    const style: Style.Properties = cell.style || {};

    this.edit_node.style.font = Style.Font(style, this.scale);
    this.edit_node.style.color = ThemeColor2(this.theme, style.text, 1);
    
    this.edit_inset.style.backgroundColor = ThemeColor2(this.theme, style.fill, 0);
    // this.edit_container.style.backgroundColor = ThemeColor2(this.theme, style.fill, 0);

    // NOTE: now that we dropped support for IE11, we can probably 
    // remove more than one class at the same time.

    // (but apparently firefox didn't support multiple classes either,
    //  until v[x]? I think that may have been years ago...)

    switch (style.horizontal_align) {
      case Style.HorizontalAlign.Right:
        this.edit_container.classList.add('align-right');
        this.edit_container.classList.remove('align-center');
        this.edit_container.classList.remove('align-left');
        break;
      case Style.HorizontalAlign.Center:
        this.edit_container.classList.remove('align-right');
        this.edit_container.classList.add('align-center');
        this.edit_container.classList.remove('align-left');
        break;
      default:
        this.edit_container.classList.remove('align-right');
        this.edit_container.classList.remove('align-center');
        this.edit_container.classList.add('align-left');
        break;
    }

    this.edit_node.style.paddingBottom = `${ Math.max(0, (self.devicePixelRatio||1) - 1)}px`;
    
    // console.info('pb', this.edit_node.style.paddingBottom);

    // TODO: alignment, underline (strike?)
    // bold/italic already work because those are font properties. 

    const value_string = value?.toString() || '';

    // do this only if there's existing text, in which case we're not 
    // typing... or it could be a %, which is OK because the key is a number

    if (value_string && value_string[0] === '=') {
      this.edit_node.spellcheck = false;
    }

    this.autocomplete.ResetBlock();
    this.FlushReference();
    this.selection = gridselection;

    if (typeof value !== 'undefined') {
      
      const percent = value_string[0] !== '=' && value_string[value_string.length - 1] === '%';
      const value_length = value_string.length;
      this.edit_node.textContent = value_string;

      // legacy

      /*
      if (use_create_text_range) {

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
      else 
      */
      {

        const range = document.createRange();
        const selection = window.getSelection();

        if (!selection) throw new Error('invalid selection object');

        if (this.edit_node.lastChild){
          if (percent) {
            range.setStart(this.edit_node.lastChild, value_length - 1);
            range.setEnd(this.edit_node.lastChild, value_length - 1);
          }
          else {
            range.setStartAfter(this.edit_node.lastChild);
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

      // FIXME: mozilla junk? check old ICE

    }

    rect.ApplyStyle(this.edit_container);
    this.editing = true;

    // I'm not sure we need to do this...

    Yield().then(() => {

      // we probably do need to do this, but maybe not the next one
      this.last_reconstructed_text = '';
      this.Reconstruct();
    });

  }

  /**
   * we probably need more state in the return value to move stuff from
   * the async handler to directly in the sync handler -- we no longer need
   * to redispatch events, because we're in the same event stream
   * 
   * @param event 
   * @returns 
   */
  public HandleKeyDown(event: KeyboardEvent): OverlayEditorResult {

    if (!this.editing) {
      return OverlayEditorResult.not_handled;
    }

    // pass through to autocomplete

    const ac = this.autocomplete.HandleKey('keydown', event);

    if (ac.accept){
      this.AcceptAutocomplete(ac);
    }
    if (ac.handled) {
      return OverlayEditorResult.handled;
    }

    switch (event.key) {

      case 'Enter':
      case 'Tab':
      {
        /*
        // we're going to trap this event, and then re-send it, as we do with
        // the formula bar editor. this is so that the grid can send the data
        // event before the selection event, to better support undo.

        const value = this.edit_node.textContent || undefined;
        const array = (event.key === 'Enter' && event.ctrlKey && event.shiftKey);
        this.Publish({type: 'commit', value, selection: this.selection, array, event});
        */

        this.selecting_ = false;

        // do this so we don't tab-switch-focus
        // event.stopPropagation();
        // event.preventDefault();

        return OverlayEditorResult.commit; 
      }

      case 'Escape':
      case 'Esc':

        // this.Publish({type: 'discard'});
        this.selecting_ = false;
        return OverlayEditorResult.discard;

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Up':
      case 'Down':
      case 'Left':
      case 'Right':
        return this.selecting_ ? OverlayEditorResult.not_handled : OverlayEditorResult.handled;

    }

    // for all other keys, we consume the key if we're in edit mode; otherwise
    // return false and let the calling routine (in grid) handle the key

    // return this.editing;

    return OverlayEditorResult.handled; // always true because we test at the top

  }

  // --- from old ICE ----------------------------------------------------------

  public UpdateTheme(scale: number): void {
    this.scale = scale;
  }

}


