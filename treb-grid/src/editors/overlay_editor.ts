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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import { Editor, type NodeDescriptor } from './editor';
import { Area, Cell, type CellStyle, type CellValue, Rectangle, Style, type Theme, ResolveThemeColor } from 'treb-base-types';
import { DataModel, type ViewModel, type GridSelection } from 'treb-data-model';
import { Autocomplete } from './autocomplete';
import { UA } from '../util/ua';

export type OverlayEditorResult = 'handled' | 'commit' | 'discard';

/**
 * but when to send it?
 */
export interface ResetSelectionEvent {
  type: 'reset-selection';
}

export class OverlayEditor extends Editor<ResetSelectionEvent> {

  // --- do we actually need this? ---------------------------------------------

  /**
   * selection being edited. note that this is private rather than protected
   * in an effort to prevent subclasses from accidentally using shallow copies
   */
  private internal_selection: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
  };

  /** accessor for selection */
  public get selection(){ return this.internal_selection; }

  /** set selection, deep copy */
  public set selection(rhs: GridSelection){
    if (!rhs){
      const zero = {row: 0, column: 0};
      this.internal_selection = {target: zero, area: new Area(zero)};
    }
    else {
      const target = rhs.target || rhs.area.start;
      this.internal_selection = {
        target: {row: target.row, column: target.column},
        area: new Area(rhs.area.start, rhs.area.end),
      };
    }
  }

  // ---------------------------------------------------------------------------

  /** possibly carrying over a font face (+size?) */
  public edit_style?: CellStyle;

  /**
   * this is a flag used to indicate when we need to reset the selection.
   * the issue has to do with selecting cells via arrow keys; if you do
   * that twice, the second time the selection starts on the cell you 
   * selected the first time. so we want to fix that.
   * 
   * I guess that used to work with an 'end-selection' event (although it
   * didn't change the sheet) but that doesn't happen anymore because 
   * selecting state is determined dynamically now.
   */
  public reset_selection = false;

  /** we could use the descriptor reference */
  public edit_node: HTMLElement & ElementContentEditable;

  /** narrowing from superclass */
  public container_node: HTMLElement;

  /** special node for ICE */
  public edit_inset: HTMLElement;
  
  public scale = 1; // this should go into theme, since it tends to follow it

  /** shadow property */
  private internal_editing = false;

  /** accessor */
  public get editing(): boolean {
    return this.internal_editing;
  }

  /**
   * this is only set one time for each state, so it would be more
   * efficient to inline it unless that's going to change
   */
  protected set editing(state: boolean) {
    if (this.internal_editing !== state) {
      this.internal_editing = state;
      if (state) {
        this.container_node.style.opacity = '1';
        this.container_node.style.pointerEvents = 'initial';
      }
      else {
        this.container_node.style.opacity = '0';
        this.container_node.style.pointerEvents = 'none';
      }
    }
  }

  constructor(
      private container: HTMLElement, 
      private theme: Theme, 
      model: DataModel, 
      view: ViewModel, 
      autocomplete: Autocomplete) {

    super(model, view, autocomplete);

    this.container_node = container.querySelector('.treb-overlay-container') as HTMLElement;
    this.edit_node = this.container_node.querySelector('.treb-overlay-editor') as HTMLElement & ElementContentEditable;

    if (UA.is_firefox) {
      this.edit_node.classList.add('firefox');
    }
    
    // attempting to cancel "auto" keyboard on ios
    this.edit_node.inputMode = 'none';

    //// 

    const descriptor: NodeDescriptor = { node: this.edit_node };
    this.nodes = [ descriptor ];
    this.active_editor = descriptor;

    this.RegisterListener(descriptor, 'input', (event: Event) => {

      if (event instanceof InputEvent && event.isComposing) {
        return;
      }

      if (!event.isTrusted) {
        this.reset_selection = true; // this is a hack, and unreliable (but works for now)
        return;
      }

      if (this.reset_selection) {
        this.Publish({
          type: 'reset-selection',
        });
      }

      // this is a new thing that popped up in chrome (actually edge).
      // not sure what's happening but this seems to clean it up.
      // we technically could allow a newline here, but... call that a TODO

      const first_child = this.edit_node.firstChild as HTMLElement;
      if (first_child && first_child.tagName === 'BR') {
        this.edit_node.removeChild(first_child);
      }
      
      if (!this.editing) { 
        return; 
      }

      this.UpdateText(descriptor);
      this.UpdateColors();

    });

    this.RegisterListener(descriptor, 'keyup', (event: KeyboardEvent) => {

      if (event.isComposing || !this.editing) {
        return;
      }

      // we're not doing anything with the result? (...)

      if (this.autocomplete && this.autocomplete.HandleKey('keyup', event).handled) {
        return;
      }

    });

    this.edit_inset = this.container_node.querySelector('.treb-overlay-inset') as HTMLElement;
    // this.container_node = this.container_node ;  // wtf is this?

    this.ClearContents();

  }

  public UpdateCaption(text = ''): void {
    this.edit_node.setAttribute('aria-label', text);
  }

  public Focus(text = ''): void {

    // we get unexpected scroll behavior if we focus on the overlay editor
    // when it is not already focused, and the grid is scrolled. that's because
    // by default the editor is at (0, 0), so we need to move it before we 
    // focus on it (but only in this case).

    if (this.edit_node !== this.edit_node.ownerDocument.activeElement) {

      // this was not correct, but should we add those 2 pixels back?

      // this.edit_container.style.top = `${this.container.scrollTop + 2}px`;
      // this.edit_container.style.left = `${this.container.scrollLeft + 2}px`;

      this.container_node.style.top = `${this.container.scrollTop + this.view.active_sheet.header_offset.y}px`;
      this.container_node.style.left = `${this.container.scrollLeft + this.view.active_sheet.header_offset.x}px`;

    }

    this.edit_node.focus();
    this.UpdateCaption(text);

  }

  /* TEMP (should be Hide() ?) */
  public CloseEditor(): void {
    this.editing = false;
    this.reset_selection = false;

    // this (all) should go into the set visible accessor? (...)

    this.ClearContents();
    this.edit_node.spellcheck = true; // default
    this.autocomplete?.Hide();

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

  // ---------------------------------------------------------------------------

  /**
   * start editing. I'm not sure why we're passing the selection around, 
   * but I don't want to take it out until I can answer that question.
   * 
   * something to do with keyboard selection? (which needs to be fixed)?
   */
  public Edit(gridselection: GridSelection, rect: Rectangle, cell: Cell, value?: CellValue, event?: Event, edit_style?: CellStyle): void {

    this.Publish({ 
      type: 'start-editing', 
      editor: 'ice',
    });

    this.active_cell = cell;
    this.target_address = {...gridselection.target};
    this.reset_selection = false;

    const style: CellStyle = JSON.parse(JSON.stringify(cell.style || {})); // clone

    //
    // CURRENT ISSUE: this works, but the style is not actually applied to
    // the cell. we need to modify the commit routine to apply the style.
    // I think?
    //
    // WAIT, that might not be right... might have something to do with 
    // default?
    // 

    this.edit_style = edit_style; // set (or unset)
    
    if (edit_style?.font_face) {
      style.font_face = edit_style.font_face;
    }

    const font_info = Style.CompositeFont(this.theme.grid_cell_font_size, style, this.scale, this.theme);

    this.edit_node.style.font = font_info.font;
    if (font_info.variants) {
      this.edit_node.style.fontVariant = font_info.variants;
    }
    else {
      this.edit_node.style.fontVariant = '';
    }

    this.edit_node.style.color = ResolveThemeColor(this.theme, style.text, 1);
    this.edit_inset.style.backgroundColor = ResolveThemeColor(this.theme, style.fill, 0);

    // NOTE: now that we dropped support for IE11, we can probably 
    // remove more than one class at the same time.

    // (but apparently firefox didn't support multiple classes either,
    //  until v[x]? I think that may have been years ago...)

    switch (style.horizontal_align) {
      case 'right': // Style.HorizontalAlign.Right:
        this.container_node.classList.remove('align-center', 'align-left');
        this.container_node.classList.add('align-right');
        break;
      case 'center': // Style.HorizontalAlign.Center:
        this.container_node.classList.remove('align-right', 'align-left');
        this.container_node.classList.add('align-center');
        break;
      default:
        this.container_node.classList.remove('align-right', 'align-center');
        this.container_node.classList.add('align-left');
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

    // move the rect before monkeying with the selection, otherwise we
    // get jumpy scrolling behavior in scrolled contexts.

    rect.ApplyStyle(this.container_node);

    // trial and error. still a little wonky at scales, but reasonable.
    
    const offset = UA.is_mac ? 0 : 0.5;

    this.edit_node.style.bottom = offset.toFixed(2) + 'px'; // does this need to scale for dpr? not sure

    this.autocomplete?.ResetBlock();
    this.selection = gridselection;

    if (typeof value !== 'undefined') {
      
      const percent = value_string[0] !== '=' && value_string[value_string.length - 1] === '%';
      const value_length = value_string.length;
      this.edit_node.textContent = value_string;

      this.SetCaret({ node: this.edit_node, offset: value_length - (percent ? 1 : 0) })

      // event moved below

    }

    this.editing = true;

    Promise.resolve().then(() => {

      if (this.active_editor) {
        this.active_editor.formatted_text = undefined; // necessary? (...)
        this.UpdateText(this.active_editor);
        this.UpdateColors();
      }

      // not sure about these two tests, they're from the old version

      if (!event && value !== undefined) {
        this.Publish({type: 'update', text: value.toString(), dependencies: this.composite_dependencies});
      }

    });

  }

  /**
   * check if we want to handle this key. we have some special cases (tab, 
   * enter, escape) where we do take some action but we also let the 
   * spreadsheet handle the key. for those we have some additional return
   * values.
   * 
   * NOTE this is *not* added as an event handler -- it's called by the grid
   * 
   * @param event 
   * @returns 
   */
  public HandleKeyDown(event: KeyboardEvent): OverlayEditorResult|undefined {

    // skip keys if we're not editing

    if (!this.editing) {
      return undefined; // not handled
    }

    // pass through to autocomplete

    if (this.autocomplete) {
      const ac = this.autocomplete.HandleKey('keydown', event);

      if (ac.accept){
        this.AcceptAutocomplete(ac);
      }

      if (ac.handled) {
        return 'handled';
      }
    }

    switch (event.key) {

      case 'Enter':
      case 'Tab':
        return 'commit'; 

      case 'Escape':
      case 'Esc':
        return 'discard';

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Up':
      case 'Down':
      case 'Left':
      case 'Right':
        return this.selecting ? undefined : 'commit';

    }

     return 'handled'; // we will consume

  }

  public UpdateScale(scale: number): void {

    // we're not changing in place, so this won't affect any open editors...
    // I think there's a case where you change scale without focusing (using
    // the mouse wheel) which might result in incorrect rendering... TODO/FIXME

    this.scale = scale;

  }


}
