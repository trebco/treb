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

/**
 * attempting (at least partial) rewrite of editor. better support of 
 * external editors, and a little cleaner behavior for context highlighting.
 * 
 * I didn't want to handle spellcheck, but we're setting a flag reflecting
 * whether it's a formula; so we probably should do it. 
 * 
 * we are specifically NOT handling the following:
 * 
 * - enter key
 * 
 * subclasses or callers can handle those.
 * 
 * ---
 * 
 * NOTE: external editors might run in a different realm (in the js meaning
 * of that term). so we don't necessarily want to use the spreadsheet's context
 * for everything. this is going to be extremely confusing.
 * 
 */

import { Area, type ICellAddress, IsCellAddress, Localization, Rectangle, type Cell, DOMContext } from 'treb-base-types';
import type { ExpressionUnit, ParseResult, UnitAddress, UnitRange } from 'treb-parser';
import { Parser } from 'treb-parser';
import type { DataModel, ViewModel } from '../types/data_model';
import type { Autocomplete, AutocompleteResult } from './autocomplete';
import { EventSource } from 'treb-utils';
import { type AutocompleteExecResult, AutocompleteMatcher, DescriptorType } from './autocomplete_matcher';

export interface UpdateTextOptions {
  rewrite_addresses: boolean;
  validate_addresses: boolean;
  canonicalize_functions: boolean;
  format_only: boolean;
  toll_events: boolean;
}

type GenericEventListener = (event: Event) => unknown;

// ----------------

/*
export interface Editor2UpdateEvent {
  type: 'update';
  dependencies?: Area[];
}
*/

/** event on commit, either enter or tab */
export interface FormulaEditorCommitEvent {
  type: 'commit';

  // selection?: GridSelection; // I think this is no longer used? can we drop?
  value?: string;

  /**
   * true if commiting an array. note that if the cell _is_ an array,
   * and you commit as !array, that should be an error.
   */
  array?: boolean;

  /**
   * for the formula editor, the event won't bubble so we can't handle
   * it with the normal event handler -- so use the passed event to
   */
  event?: KeyboardEvent;
}

/** event on discard -- escape */
export interface FormulaEditorDiscardEvent {
  type: 'discard';
}

/** event on end select state, reset selection */
export interface FormulaEditorEndSelectionEvent {
  type: 'end-selection';
}

/** event on text update: need to update sheet dependencies */
export interface FormulaEditorUpdateEvent {
  type: 'update';
  text?: string;
  cell?: Cell;
  dependencies?: Area[];
}

// export interface FormulaEditorAutocompleteEvent {
//  type: 'autocomplete';
//  text?: string;
//  cursor?: number;
// }

/*
export interface RetainFocusEvent {
  type: 'retain-focus';
  focus: boolean;
}
*/

export interface StartEditingEvent {
  type: 'start-editing';
  editor?: string;
}

export interface StopEditingEvent {
  type: 'stop-editing';
  editor?: string;
}

/** discriminated union */
export type FormulaEditorEvent
  = // RetainFocusEvent
  | StopEditingEvent
  | StartEditingEvent
  | FormulaEditorUpdateEvent
  | FormulaEditorCommitEvent
  | FormulaEditorDiscardEvent
  | FormulaEditorEndSelectionEvent
  ;


// -----------------

export interface NodeDescriptor {

  /** the contenteditable node */
  node: HTMLElement;

  /** list of references in this node */
  references?: Area[];

  /** listeners we attached, so we can clean up */
  listeners?: Map<Partial<keyof HTMLElementEventMap>, GenericEventListener>;

  /** last-known text, to avoid unecessary styling */
  formatted_text?: string;

  /** check (not sure if we still need this) length of html content */
  check?: number;

}

export class Editor<E = FormulaEditorEvent> extends EventSource<E|FormulaEditorEvent> {

  protected static readonly FormulaChars = ('$^&*(-+={[<>/~%' + Localization.argument_separator).split(''); // FIXME: i18n

  /**
   * the current edit cell. in the event we're editing a merged or
   * array cell, this might be different than the actual target address.
   */
  public active_cell?: Cell;

  /** matcher. passed in by owner. should move to constructor arguments */
  public autocomplete_matcher?: AutocompleteMatcher;
 
  /** the containing node, used for layout */
  protected container_node?: HTMLElement;

  /** 
   * this is the node we are currently editing. it's possible we are not 
   * editing any cell, but just formatting. this one sends events and is 
   * the target for inserting addresses.
   */
  protected active_editor?: NodeDescriptor;

  /**
   * all nodes that are involved with this editor. we format all of them,
   * and if you edit one we might switch the colors in the others as 
   * references change.
   */
  protected nodes: NodeDescriptor[] = [];

  /** 
   * address of cell we're editing, if we're editing a cell
   */
  public target_address?: ICellAddress;

  /**
   * assume we're editing a formula. this is for the external editor.
   * if we switch the formula bar to inherit from this class, it should
   * be false.
   */
  protected assume_formula = false;

  /**
   * this flag indicates we're editing a formula, which starts with `=`.
   */
  protected text_formula = false;

  /**
   * this has changed -- we don't have an internal field. instead we'll 
   * check when called. it's slightly more expensive but should be 
   * relatively rare.
   */
  public get selecting(): boolean {

    if (this.assume_formula) {
      return true; // always selecting
    }

    if (!this.text_formula) {
      return false;
    }

    // FIXME: also if you change the selection. our insert routine
    // handles that but this will return false. the test is "is the 
    // cursor in or at the end of a reference?"

    if (this.active_editor && this.active_editor.node === this.active_editor.node.ownerDocument.activeElement) {

      const view = this.active_editor.node.ownerDocument.defaultView as (Window & typeof globalThis);
      const selection = view.getSelection();
      const count = selection?.rangeCount;

      if (count) {

        const range = selection?.getRangeAt(0);
        const element = range?.endContainer instanceof view.HTMLElement ? range.endContainer :
          range.endContainer?.parentElement;

        // this is a reference, assume we're selecting (we will replace)
        if (element?.dataset.reference !== undefined) {
          return true;
        }

        // we may be able to use the selection directly
        /*
        if (range?.endContainer instanceof Text) {
          const str = (range.endContainer.textContent?.substring(0, range.endOffset) || '').trim();
          if (str.length && Editor2.FormulaChars.includes(str[str.length - 1])) {
            return true;
          }
        }
        */

        // start, not end

        if (range?.startContainer instanceof view.Text) {
          const str = (range.startContainer.textContent?.substring(0, range.startOffset) || '').trim();
          if (str.length && Editor.FormulaChars.includes(str[str.length - 1])) {
            return true;
          }
        }
        else {
          console.info("mark 21", range);
        }

      }

      const text = this.SubstringToCaret2(this.active_editor.node)[1].trim();
      if (text.length) {
        const char = text[text.length - 1];
        return Editor.FormulaChars.includes(char);
      }

    }

    return false;
  }

  /** internal. not sure why we have a shadow property. */
  protected composite_dependencies: Area[] = [];

  /** accessor */
  public get dependencies(): Area[] {
    return this.composite_dependencies;
  }

  /** reference to model parser */
  public parser: Parser;

  constructor( 
      public model: DataModel,
      public view: ViewModel,
      public autocomplete?: Autocomplete ){

    super();

    this.parser = model.parser;

  }

  public FocusEditor(): void {
    if (this.active_editor) {
      this.active_editor.node.focus();
    }
  }

  /**
   * add an event listener to the node. these are stored so we can remove
   * them later if the node is disconnected. 
   * 
   * listeners moved to node descriptors so we can have multiple sets.
   */
  protected RegisterListener<K extends keyof HTMLElementEventMap>(descriptor: NodeDescriptor, key: K, handler: (event: HTMLElementEventMap[K]) => unknown) {
    descriptor.node.addEventListener(key, handler);
    if (!descriptor.listeners) {
      descriptor.listeners = new Map();
    }
    descriptor.listeners.set(key, handler as GenericEventListener);
  }

  protected SelectAll(node: HTMLElement) {
    const view = node.ownerDocument.defaultView as (Window & typeof globalThis);
    const selection = view.getSelection();
    const range = node.ownerDocument.createRange();
    range.selectNode(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  protected SetCaret(
      start: { node: ChildNode, offset: number }, 
      end?: { node: ChildNode, offset: number }) {

    const doc = start.node.ownerDocument;
    const view = doc?.defaultView as (Window & typeof globalThis);

    const selection = view.getSelection();
    const range = doc?.createRange();

    const FirstTextNode = (node: ChildNode) => {
      let target: Node = node;
      while (target && !(target instanceof view.Text) && !!target.firstChild) {
        target = target.firstChild;
      }
      return target;
    };

    const start_node = FirstTextNode(start.node);

    if (end) {
      const end_node = FirstTextNode(end.node);
      if (selection && range) {
        range.setStart(start_node, start.offset);
        range.setEnd(end_node, end.offset);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    else {
      if (selection && range) {
        range.setStart(start_node, start.offset);
        range.setEnd(start_node, start.offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

  }

  /**
   * 
   */
  public InsertReference(reference: string) {

    if (!this.active_editor) {
      return;
    }

    const view = this.active_editor.node.ownerDocument.defaultView as (Window & typeof globalThis);

    const selection = view.getSelection();
    if (!selection) {
      throw new Error('error getting selection');
    }

    if (selection.rangeCount === 0) {
      // console.warn('range count is 0');
      return '';
    }

    const range = selection.getRangeAt(0);
    const text = this.active_editor.node.textContent || '';

    // so what we are doing here depends on where the caret is.
    // if the caret is in a reference (address, range, &c) then
    // we replace the reference. that seems like the logical thing 
    // to do.

    // if the caret is not in a reference, then we need to insert/append
    // it at the caret position. should we replace existing stuff? what
    // if it's in a literal? ...

    // maybe the criteria should be "is there a range selection", and if
    // so, replace the range selection -- otherwise, insert the reference
    // (possibly with a delimeter, space, or operator?)

    // A: easiest case: selection is in a reference. replace it.

    // actually the first case should be the range selection, since that
    // might include _more_ than an existing reference, and we want to 
    // replace the entire range selection.

    if (range.startContainer instanceof view.Text) {

      // first case: range selected
      if (!range.collapsed && range.startOffset < range.endOffset) {

        const substrings = this.SubstringToCaret2(this.active_editor.node);

        /*
        // console.info('case 1');

        const substring_1 = this.SubstringToCaret(this.editor_node, true);
        const substring_2 = this.SubstringToCaret(this.editor_node, false);

        const test = this.SubstringToCaret2(this.editor_node);
        console.info(
          (test[0] === substring_1 && test[1] === substring_2) ? 'GOOD' : 'BAD',
          { test, substring_1, substring_2 });
        */

        this.active_editor.node.textContent = substrings[0] + reference + text.substring(substrings[1].length);

        this.SetCaret({
          node: this.active_editor.node, 
          offset: substrings[0].length,
        }, {
          node: this.active_editor.node,
          offset: substrings[0].length + reference.length
        });

      }
      else {

        // check if we're in a reference node; if so, replace

        const parent = range.startContainer.parentElement;
        if (parent instanceof view.HTMLElement && parent.dataset.reference) {

          // console.info('case 2');

          // replace text
          parent.textContent = reference;
          this.SetCaret({
            node: parent, 
            offset: reference.length,
          });

        }
        else {

          // console.info('case 3;', {sc: range.startContainer, text: range.startContainer.data, parent});
          
          // otherwise, insert at caret. should we add a delimeter? it
          // probably depends on what's immediately preceding the caret.
          // UPDATE: what about following the caret?

          const substring = this.SubstringToCaret2(this.active_editor.node)[1];

          let leader = '';
          // let trailer = '';

          const trimmed = substring.trim();
          if (trimmed.length) {
            const char = trimmed[trimmed.length - 1];
            if (!Editor.FormulaChars.includes(char)) {
              if (substring.length === trimmed.length) {
                leader = ' +';
              }
              else {
                leader = '+';
              }
            }
          }

          // check after. this is a little different because we still 
          // want to set the caret at the end of the original reference.
          // we need a flag.

          // we can't insert a space, because that will break parsing (it
          // will become invalid). I guess we could insert a space, and just
          // accept that, but this seems like it works better (doing nothing).

          /*
          if (text.length > substring.length) {
            const char = text[substring.length];
            if (!Editor2.FormulaChars.includes(char) && !/\s/.test(char)) {
              trailer = ' ';
            }
          }
          */

          this.active_editor.node.textContent = substring + leader + reference + text.substring(substring.length);
          this.SetCaret({
            node: this.active_editor.node, 
            offset: substring.length + reference.length + leader.length,
          });

        }

      }
    }
    else {

      // if startContainer is not text, that usually means the container
      // is empty. I don't think there's any other case. so we can insert
      // the text. we'll want to create a node, and we'll want to set the 
      // cursor at the end.

      if (range.startContainer instanceof view.HTMLElement) {
        range.startContainer.textContent = reference;
        this.SetCaret({
          node: range.startContainer, 
          offset: reference.length,
        });
      }

      else {
        console.warn("unexpected range start container", range.startContainer);
      }
      
    }

    // there may be some cases where we don't need to do this

    this.UpdateText(this.active_editor)
    this.UpdateColors();

    // this does not raise an input event. probably because we're calling
    // it from script. but we might be pretty disconnected from the owner.
    // can we use a synthentic event that matches one of the real ones?

    // A: yes, except that isTrusted will evaluate to false. which I guess
    // is fine, in this context? 

    // make sure to do this after updating so we have a current list of 
    // references attached to the node

    this.active_editor.node.dispatchEvent(new Event('input', {
      bubbles: true,
      cancelable: true,
    }));

  }

  /**
   * this method does three things:
   * 
   * (1) builds a flat list of references across all nodes
   * (2) applies colors to formatted references
   * (3) sends an event (if necessary, or forced)
   * 
   * that's fine, but it needs a new name.
   * 
   */
  protected UpdateColors(force_event = false) {

    // const view = this.active_editor?.node.ownerDocument.defaultView as (Window & typeof globalThis);

    // create a map of canonical label -> area 

    const map: Map<string, Area> = new Map();

    // also create a map of label -> index

    const indexes: Map<string, number> = new Map();

    for (const support of this.nodes) {
      for (const area of support.references || []) {
        const label = this.model.AddressToLabel(area);
        if (!map.has(label)) {
          map.set(label, area);
          indexes.set(label, indexes.size);
        }
      }
    }

    // FIXME: compare against current and short-circuit

    // console.info({map, indexes});

    // now apply colors to nodes

    for (const entry of this.nodes) {
      for (const node of Array.from(entry.node.childNodes)) {
        const view = node.ownerDocument?.defaultView as (Window & typeof globalThis);
        if (view && node instanceof view.HTMLElement && node.dataset.reference) {
          const index = indexes.get(node.dataset.reference);
          node.dataset.highlightIndex = (typeof index === 'number') ? (index % 5 + 1).toString() : '?';
        }
      }

      // this is a check for flushing text when we re-attach.
      // @see AttachNode

      entry.check = entry.node.innerHTML.length;

    }    

    // dependencies is just the single list
    
    const list = Array.from(map.values());

    if (!force_event) { 
      if (JSON.stringify(this.composite_dependencies) === JSON.stringify(list)) {
        return;
      }
    }

    this.composite_dependencies = list;

    this.Publish({ type: 'update', dependencies: this.composite_dependencies });

  }

  /**
   * get a list of all references in the text (actually in the parse result, 
   * since we have that). stores the list in the node descriptor (and in 
   * the node dataset).
   * 
   * returns a list of the references in parse result mapped to normalized
   * address labels. those can be used to identify identical references when 
   * we highlight later.
   * 
   * @param parse_result 
   * @returns 
   */
  protected UpdateDependencies(descriptor: NodeDescriptor, parse_result: ParseResult) {

    const reference_list: Array<UnitRange|UnitAddress> = [];

    for (const unit of parse_result.full_reference_list || []) {
      switch (unit.type) {
        case 'address':
        case 'range':
        {
          const start = unit.type === 'range' ? unit.start : unit;
          if (!start.sheet_id) {
            if (start.sheet) {
              start.sheet_id = this.model.sheets.Find(start.sheet)?.id || 0;
            }
            else {
              start.sheet_id = this.view.active_sheet.id;
            }
          }
          reference_list.push(unit);
          break;
        }

        case 'structured-reference':
          if (this.target_address) {
            const reference = this.model.ResolveStructuredReference(unit, this.target_address);
            if (reference) {
              reference_list.push(reference);
            }
          }
          else {
            console.info('target address not set');
          }
          break;

        case 'identifier':
        {
          const named_range = this.model.named_ranges.Get(unit.name);
          if (named_range) {
            if (named_range.count === 1) {
              reference_list.push({
                type: 'address',
                ...named_range.start,
                label: unit.name,
                position: unit.position,
                id: unit.id,
              });
            }
            else {
              reference_list.push({
                type: 'range',
                start: {
                  type: 'address',
                  position: unit.position,
                  id: unit.id,
                  label: unit.name,
                    ...named_range.start,
                },
                end: {
                  type: 'address',
                  position: unit.position,
                  label: unit.name,
                  id: unit.id,
                    ...named_range.end,
                },
                label: unit.name,
                position: unit.position,
                id: unit.id,
              });
            }
          }

          break;
        }

      }
    }
    
    // how could this ever be out of order? (...)
    reference_list.sort((a, b) => a.position - b.position);

    // flat list, unique
    const references: Area[] = [];

    // set for matching
    const list: Set<string> = new Set();

    // for the result, map of reference to normalized address label
    const map: Map<ExpressionUnit, string> = new Map();

    for (const entry of reference_list) {

      const label = this.model.AddressToLabel(entry); // , this.view.active_sheet);
      const area = IsCellAddress(entry) ? 
          new Area(entry) : 
          new Area(entry.start, entry.end);

      // add to references once

      if (!list.has(label)) {
        references.push(area);
        list.add(label);
      }

      // but keep a map
      map.set(entry, label);

    }

    this.UpdateReferences(descriptor, references);

    return map;
    
  }

  /**
   * store the set of references, and store in the node dataset for 
   * external clients.
   * 
   * @param descriptor 
   * @param references 
   * @param options 
   */
  protected UpdateReferences(descriptor: NodeDescriptor, references: Area[] = []) {
    descriptor.node.dataset.references = JSON.stringify(references.map(entry => this.model.AddressToLabel(entry)));
    descriptor.references = references;
  }

  /**
   * reformat text to highlight, which involves tinkering with
   * node structure. we're probably doing this more than necessary;
   * we might consider editing the existing structure, rather than
   * throwing it away every time.
   * 
   */
  protected UpdateText(
      // node: HTMLElement, 
      descriptor: NodeDescriptor,
      options: Partial<UpdateTextOptions> = {}) {

    const node = descriptor.node;
    const text = node.textContent || '';

    const DOM = DOMContext.GetInstance(node.ownerDocument);

    // set this flag so we can use it in `get selected()`
    
    this.text_formula = text[0] === '=';

    if (this.active_editor && !this.assume_formula) {
      this.active_editor.node.spellcheck = !(this.text_formula);

      // if not assuming formula, and it's not a formula, then exit.

      if (!this.text_formula) {
        return;
      }

    }

    // this is a short-circuit so we don't format the same text twice. 
    // but there are some problems when you assign the same text over,
    // especially if the text is empty.
    //
    // to unset this field make sure to set it to `undefined` instead 
    // of any empty string, so it will expressly not match an empty string. 

    if (text === descriptor.formatted_text) {

      // fix selection behavior for tabbing
      // for some reason this is too aggressive, it's happening when
      // we _should_ have a selection

      /*
      if (node === this.editor_node && node === document.activeElement) {
        const substr = this.SubstringToCaret(node);
        const substr2 = this.SubstringToCaret(node, true);
        if (text.length && substr === '' && substr2 === '') {
          this.SelectAll(node);
        }
      }
      */

      // is there a case where we'd want to autocomplete here? (...)

      return; 

    }

    // I wonder if this should be done asynchronously... we generally 
    // have pretty short strings, so maybe not a big deal

    const [substring_start, substring_end] = this.SubstringToCaret2(node);

    // console.info({text, substr, substr2});

    const caret_start = substring_start.length;
    let caret_end = substring_end.length;

    // this is a little hacky
    if (caret_start === 0 && caret_end === 0) {
      caret_end = text.length;
    }

    if (!text) {
      this.UpdateReferences(descriptor); // flush
    }
    else {
      const parse_result = this.parser.Parse(text);

      if (parse_result.expression) {

        const normalized_labels = this.UpdateDependencies(descriptor, parse_result);
        
        // the parser will drop a leading = character, so be
        // sure to add that back if necessary

        const offset = (text[0] === '=' ? 1 : 0);

        let start = 0;

        let selection_start: { node: ChildNode, offset: number } | undefined;
        let selection_end:   { node: ChildNode, offset: number } | undefined;

        // let selection_node: ChildNode|null = null;
        // let selection_offset = 0;

        let text_index = 0;
        let last_text_node: Text|undefined;

        const fragment = DOM.Fragment();

        const AddNode = (text: string, type = 'text', reference = '', force_selection = false) => {

          const text_node = DOM.Text(text);

          if (force_selection || ((caret_start > text_index || (caret_start === 0 && text_index === 0)) && caret_start <= text_index + text.length)) {
            selection_start = {
              offset: caret_start - text_index,
              node: text_node,
            };
          }

          if (caret_end > text_index && caret_end <= text_index + text.length ) {
            selection_end = { 
              offset: caret_end - text_index,
              node: text_node,
            };
          }

          if (type !== 'text') {

            const span = DOM.Create('span', type);

            if (reference) {
              span.dataset.reference = reference;
            }

            // span.className = type;
            span.appendChild(text_node);
            fragment.appendChild(span);

          }
          else {
            fragment.appendChild(text_node);
          }

          last_text_node = text_node;
          text_index += text.length;

        };

        this.parser.Walk(parse_result.expression, (unit: ExpressionUnit) => {

          if (unit.type === 'missing' || unit.type === 'group' || unit.type === 'dimensioned') {
            return true;
          }

          const pos = unit.position + offset;
          const part = text.substring(start, pos);

          let label = '';
          let type: string = unit.type;
          let reference = '';

          switch (unit.type) {
            case 'identifier':
            case 'call':

              // FIXME: canonicalize (optionally)
              label = text.substring(pos, pos + unit.name.length);
              break;
    
            case 'literal':
              if (typeof unit.value === 'string') {
                label = text.substring(pos, pos + unit.value.length + 2);
                type = 'string';
              }
              else {
                return false;
              }
              break;

            case 'address':
            case 'range':
            case 'structured-reference':
              reference = normalized_labels.get(unit) || '???';

              /*
              {
                const index = indexes.get(unit);
                if (typeof index === 'number') {
                  type += ` highlight-${(index % 5) + 1}`
                }
              }
              */

              // TODO: validate (optionally)
              label = options.rewrite_addresses ? unit.label : 
                text.substring(pos, pos + unit.label.length);

              break;
            
            default:
              // console.info('unhandled', unit.type);
              return true;

          }
          
          AddNode(part);
          AddNode(label, type, reference);
          start = pos + label.length;

          return unit.type !== 'range';

        });

        if (start < text.length) {
          AddNode(text.substring(start));
        }

        if (!selection_start) {

          // console.info('no selection node');

          if (last_text_node) {

            selection_start = {
              node: last_text_node,
              offset: (last_text_node.data || '').length,
            };

            // console.info('using last node');

          }
          else {
            // console.info('adding next selection node');
            AddNode('', undefined, '', true);
          }
        }

        node.textContent = '';
        node.appendChild(fragment);

        if (selection_start && !options.format_only && node === this.active_editor?.node) {
          this.SetCaret(selection_start, selection_end);

          // we were doing this for the external editor, and it was useful
          // because those editors don't grow. but it makes the spreadsheet
          // scroll when it's used in the ICE/overlay. maybe a flag?

          // (selection_end || selection_start).node.parentElement?.scrollIntoView();
  
        }

      }
      else {
        // console.warn("expression failed", text);
      }
    }

    descriptor.formatted_text = text;

    // 

    const matcher = this.autocomplete_matcher;
    if (matcher) {
      Promise.resolve().then(() => {
        const exec_result = matcher.Exec({ text, cursor: substring_end.length });
        const node = 
          this.NodeAtIndex(exec_result.completions?.length ? 
                (exec_result.position || 0) :
                (exec_result.function_position || 0));
        this.Autocomplete(exec_result, node);
      });
    }

  }

  protected NodeAtIndex(index: number): Node|undefined {
    const children = this.active_editor?.node.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      const len = children[i].textContent?.length || 0;
      if (len > index) {
        return children[i];
      }
      index -= len;
    }
    return undefined;
  }

  protected AcceptAutocomplete(ac_result: AutocompleteResult) {

    if (!this.active_editor) return;

    let type = DescriptorType.Function;
    if (ac_result.data && ac_result.data.completions) {
      for (const completion of ac_result.data.completions) {
        if (completion.name.toLowerCase() === ac_result.value?.toLowerCase()) {
          type = completion.type || DescriptorType.Function;
          break;
        }
      }
    }

    // since this only happens when typing, we know that there's a single
    // cursor position, and it's in a text node. can we use that reduction to
    // simplify how we insert? it's probably unecessary to highlight...
    //
    // at least in the case of functions. if we're inserting a named reference,
    // then we do need to highlight. so.

    const start = ac_result.data?.position || 0;
    const end = start + (ac_result.data?.token?.length || 0);

    const insertion = (type === DescriptorType.Token) ? ac_result.value : ac_result.value + '(';

    const text = this.active_editor.node.textContent || '';
    let adjusted = text.substring(0, start) + insertion;
    const caret = adjusted.length;
    adjusted += text.substring(end);

    this.active_editor.node.textContent = adjusted;
    this.SetCaret({node: this.active_editor.node, offset: caret});
    
    this.autocomplete?.Hide();

    this.UpdateText(this.active_editor);
    this.UpdateColors();

  }

  /** called when there's AC data to display (or tooltip) */
  protected Autocomplete(data: AutocompleteExecResult, target_node?: Node): void {

    if (!this.container_node || !this.autocomplete) {
      return;
    }

    let client_rect: DOMRect;
    if (target_node?.nodeType === Node.ELEMENT_NODE) {
      client_rect = (target_node as Element).getBoundingClientRect();
    }
    else {
      client_rect = this.container_node.getBoundingClientRect();
    }

    // console.info({target_node, client_rect});

    const rect = new Rectangle(
      Math.round(client_rect.left),
      Math.round(client_rect.top),
      client_rect.width, client_rect.height);

    this.autocomplete.Show(this.AcceptAutocomplete.bind(this), data, rect);

  }

  /**
   * this version gets substrings to both selection points.
   * 
   * @param node 
   * @returns [substring to start of selection, substring to end of selection]
   */
  protected SubstringToCaret2(node: HTMLElement): [string, string] {

    const result: [string, string] = ['', ''];

    if (node !== node.ownerDocument.activeElement || node !== this.active_editor?.node) {
      return result;
    }
   
    const doc = node.ownerDocument;
    const view = doc.defaultView as (Window & typeof globalThis);

    // is there a way to do this without recursing? (...)
    // how about string concat instead of array join, it's faster in 
    // chrome (!)

    const complete = [ false, false ];

    const Consume = (element: Node, range: Range) => {

      // it only seems to happen in firefox, but sometimes we'll get 
      // a non-text node that is the start container and endcontainer.
      //
      // in that case we need to interpret the endOffset as nodes, not 
      // characters. that's what's causing the firefox issues. I guess
      // that applies to startoffset as well? 

      // not sure if this is bugged or what but when we hit this case,
      // it's always "all the text in there" regardless of the offsets.
      // not sure what the offsets are even referring to, since we get
      // offsets > the number of child nodes. is this a bug in firefox?

      if (element === range.startContainer && element === range.endContainer && !(element instanceof view.Text)) {

        /*
        if (range.startOffset !== 0 || range.endOffset !== 0) {
          console.info("warn offset", range.startOffset, range.endOffset);
          console.info(element);
        }
        */

        complete[0] = complete[1] = true;

        result[0] += element.textContent;
        result[1] += element.textContent;

        return;
      }

      if (element === range.startContainer) {
        result[0] += (element.textContent || '').substring(0, range.startOffset);
        complete[0] = true;
      }
      if (element === range.endContainer) {
        result[1] += (element.textContent || '').substring(0, range.endOffset);
        complete[1] = true;
      }

      if (complete[0] && complete[1]) {
        return;
      }

      if (element instanceof view.Text) {
        const text = element.textContent || '';
        if (!complete[0]) {
          result[0] += text;
        }
        if (!complete[1]) {
          result[1] += text;
        }
      }
      else if (element.hasChildNodes()) {
        for (const child of Array.from(element.childNodes)) {
          Consume(child, range);
          if (complete[0] && complete[1]) {
            return;
          }
        }
      }
    };

    const selection = view.getSelection();
    if (selection?.rangeCount ?? 0 > 0) {
      const range = selection?.getRangeAt(0);
      if (range) {
        Consume(node, range);
      }
    }

    return result;
  }

}
