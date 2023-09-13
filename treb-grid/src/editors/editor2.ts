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
 */

import { Area, type IArea, type ICellAddress, IsCellAddress, Localization, type Theme, Rectangle } from 'treb-base-types';
import type { ExpressionUnit, ParseResult, UnitAddress, UnitRange } from 'treb-parser';
import { Parser, QuotedSheetNameRegex } from 'treb-parser';
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

type GenericEventListener = (event: Event) => any;

export interface Editor2UpdateEvent {
  type: 'update';
  dependencies?: Area[];
}

interface NodeDescriptor {
  node: HTMLElement;
  references?: Area[];
  edit?: boolean;
}

export class Editor2<E = Editor2UpdateEvent> extends EventSource<E|Editor2UpdateEvent> {

  protected static readonly FormulaChars = ('$^&*(-+={[<>/~%' + Localization.argument_separator).split(''); // FIXME: i18n

  /** matcher. passed in by owner. should move to constructor arguments */
  public autocomplete_matcher?: AutocompleteMatcher;
 
  /** the containing node, used for layout */
  protected container_node?: HTMLDivElement;

  /**
   * we used to have more than once listener so this made more sense. atm
   * we only listen for `input` events, so we could simplify.
   */
  private listeners: Map<Partial<keyof HTMLElementEventMap>, GenericEventListener> = new Map();

  /* * node used for counting characters * /
  // private measurement_node: HTMLDivElement;

  /** 
   * this is the node we are currently editing. it's possible we are not 
   * editing any cell, but just formatting. this one sends events and is 
   * the target for inserting addresses.
   */
  protected editor_node?: HTMLElement;

  /**
   * all nodes that are involved with this editor. we format all of them,
   * and if you edit one we might switch the colors as the references change.
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

    if (this.editor_node && this.editor_node === document.activeElement) {

      const selection = window.getSelection();
      const count = selection?.rangeCount;

      if (count) {

        const range = selection?.getRangeAt(0);
        const element = range?.endContainer instanceof HTMLElement ? range.endContainer :
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

        if (range?.startContainer instanceof Text) {
          const str = (range.startContainer.textContent?.substring(0, range.startOffset) || '').trim();
          if (str.length && Editor2.FormulaChars.includes(str[str.length - 1])) {
            return true;
          }
        }
        else {
          console.info("mark 21", range);
        }

      }

      const text = this.SubstringToCaret2(this.editor_node)[1].trim();
      if (text.length) {
        const char = text[text.length - 1];
        return Editor2.FormulaChars.includes(char);
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
      // public parser: Parser, 
      // public theme: Theme,
      public model: DataModel,
      public view: ViewModel,
      public autocomplete?: Autocomplete ){

    super();

    this.parser = model.parser;
    // this.measurement_node = document.createElement('div');

  }

  public Reset() {
    this.AttachNode();
  }

  public FocusEditor(): void {
    if (this.editor_node) {
      this.editor_node.focus();
    }
  }

  /**
   * add an event listener to the node. these are stored so we can remove
   * them later if the node is disconnected.
   */
  protected RegisterListener<K extends keyof HTMLElementEventMap>(key: K, handler: (event: HTMLElementEventMap[K]) => any) {
    this.editor_node?.addEventListener(key, handler);
    this.listeners.set(key, handler as GenericEventListener);
  }

  protected SelectAll(node: HTMLElement) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  protected SetCaret(
      start: { node: ChildNode, offset: number }, 
      end?: { node: ChildNode, offset: number }) {

    const selection = window.getSelection();
    const range = document.createRange();

    const FirstTextNode = (node: ChildNode) => {
      let target: Node = node;
      while (target && !(target instanceof Text) && !!target.firstChild) {
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

  };

  /**
   * not sure what the ID was, we don't use it atm
   */
  public InsertReference(reference: string, id?: number) {

    if (!this.editor_node) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      throw new Error('error getting selection');
    }

    if (selection.rangeCount === 0) {
      // console.warn('range count is 0');
      return '';
    }

    let range = selection.getRangeAt(0);
    const text = this.editor_node.textContent || '';

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

    if (range.startContainer instanceof Text) {

      // first case: range selected
      if (!range.collapsed && range.startOffset < range.endOffset) {

        const substrings = this.SubstringToCaret2(this.editor_node);

        /*
        // console.info('case 1');

        const substring_1 = this.SubstringToCaret(this.editor_node, true);
        const substring_2 = this.SubstringToCaret(this.editor_node, false);

        const test = this.SubstringToCaret2(this.editor_node);
        console.info(
          (test[0] === substring_1 && test[1] === substring_2) ? 'GOOD' : 'BAD',
          { test, substring_1, substring_2 });
        */

        this.editor_node.textContent = substrings[0] + reference + text.substring(substrings[1].length);

        this.SetCaret({
          node: this.editor_node, 
          offset: substrings[0].length,
        }, {
          node: this.editor_node,
          offset: substrings[0].length + reference.length
        });

      }
      else {

        // check if we're in a reference node; if so, replace

        const parent = range.startContainer.parentElement;
        if (parent instanceof HTMLElement && parent.dataset.reference) {

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

          const substring = this.SubstringToCaret2(this.editor_node)[1];

          let leader = '';
          let trailer = '';

          let trimmed = substring.trim();
          if (trimmed.length) {
            const char = trimmed[trimmed.length - 1];
            if (!Editor2.FormulaChars.includes(char)) {
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

          this.editor_node.textContent = substring + leader + reference + text.substring(substring.length);
          this.SetCaret({
            node: this.editor_node, 
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

      if (range.startContainer instanceof HTMLElement) {
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

    this.UpdateText(this.editor_node)
    this.UpdateColors();

    // this does not raise an input event. probably because we're calling
    // it from script. but we might be pretty disconnected from the owner.
    // can we use a synthentic event that matches one of the real ones?

    // A: yes, except that isTrusted will evaluate to false. which I guess
    // is fine, in this context? 

    // make sure to do this after updating so we have a current list of 
    // references attached to the node

    this.editor_node.dispatchEvent(new Event('input', {
      bubbles: true,
      cancelable: true,
    }));

  }

  /**
   * attach to a node. this node must be `contenteditable`. it should have
   * `display: block`, there are contenteditable issues with some others
   * (definitely problems with flex; not sure about inline).
   */
  public AttachNode(target?: HTMLElement, nodes: HTMLElement[] = [], assume_formula = true) {

    this.assume_formula = assume_formula;

    // try to preserve any nodes/descriptors we've already "cooked",
    // since this will proabbly get called multiple times when you
    // switch between fields.

    // there's a particular case where this is breaking. an external
    // application is setting the text in the contenteditable element.
    // if the text is different, this will work properly. but if the 
    // text is the same, it breaks, because we're matching against the 
    // text and not the rendered html.

    // there are a bunch of ways we could address this but the only one
    // that is comprehensive for us to do it would be to compare the 
    // generated html. or perhaps there's a shortcut? (...)

    let descriptors: NodeDescriptor[] = [];

    let edit_found = false;
    descriptors = nodes.map(node => {
      const edit = (target === node);
      for (const check of this.nodes) {
        if (check.node === node) {
          return { ...check, node, edit };
        }
      }
      edit_found = edit_found || edit;
      return { node, edit };
    });

    if (target && !edit_found) {
      // console.info('need to add edit');
      descriptors.push({
        node: target, edit: true, 
      });
    }

    this.nodes = descriptors;

    // check if we need to flush these (see above). 

    for (const descriptor of this.nodes) {
      if (descriptor.node.dataset.formatted_text === descriptor.node.textContent) {
        const test = descriptor.node.innerHTML.length;
        if (Number(descriptor.node.dataset.check || 0) !== test) {
          descriptor.node.dataset.formatted_text = undefined; // flush
        }
      }
    }


    // if we're not preserving them, but the reference list is still
    // attached, we can use that (now that we moved the resolver). 
    // this will probably only happen if formatted_text is also set
    // (and matches), so it should be reasonably safe to do so.

    // NOTE: this is probably not useful anymore since we're preserving
    // the references above. could cut.

    // seems like we still need it, but not entirely clear why (...)

    for (const entry of this.nodes) {
      if (entry.node.dataset.references && !entry.references) {

        try {
          const references = JSON.parse(entry.node.dataset.references);
          if (Array.isArray(references)) {
            entry.references = references.map(reference => this.model.ResolveArea(reference, this.view.active_sheet));
          }
        }
        catch (err) {
          console.warn(entry.node.dataset.references);
          console.warn('json parse error');
        }
      }
    }

    // if we're switching, clean up first

    if (this.editor_node && this.editor_node !== target) {
      for (const [key, value] of this.listeners.entries()) {
        this.editor_node.removeEventListener(key, value);
      }
    }
    this.listeners.clear();

    this.editor_node = target;

    for (const entry of this.nodes) {
      this.UpdateText(entry.node, { toll_events: true });
    }

    if (target) {

      // add listeners

      this.RegisterListener('input', (event: Event) => {

        // we send an extra event when we insert a reference.
        // so filter that out. this might cause problems for other
        // callers -- could we use a different filter?

        if (event.isTrusted) {
          this.UpdateText(target);
          this.UpdateColors(); // will send a local event
        }

      });
     
    }

    this.UpdateColors(true); // always send an event, just in case

  }

  /**
   * add or update color classes to all highlight nodes. 
   * 
   * we moved the event in here, so it will get sent when
   * colors actually change.
   */
  protected UpdateColors(force_event = false) {

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
        if (node instanceof HTMLElement && node.dataset.reference) {
          const index = indexes.get(node.dataset.reference);
          node.dataset.highlightIndex = (typeof index === 'number') ? (index % 5 + 1).toString() : '?';
        }
      }

      // this is a check for flushing text when we re-attach.
      // @see AttachNode

      entry.node.dataset.check = entry.node.innerHTML.length.toString();

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
   * get a list of all references in the text (actually in the parse
   * result, since we have that). returns a map of references -> index
   * numbers for highlighting.
   * 
   * as a side-effect this method stores a flattened list of references.
   * 
   * @param parse_result 
   * @returns 
   */
  protected UpdateDependencies(node: HTMLElement, parse_result: ParseResult, options: Partial<UpdateTextOptions> = {}) {

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

    const references: Area[] = [];
    const list: Set<string> = new Set();
    const map: Map<ExpressionUnit, string> = new Map();

    for (const entry of reference_list) {

      const label = this.model.AddressToLabel(entry, this.view.active_sheet);
      const area = IsCellAddress(entry) ? 
          new Area(entry) : 
          new Area(entry.start, entry.end);

      /*
      const start = IsCellAddress(entry) ? entry : entry.start;
      if (!start.sheet) {
        start.sheet = this.model.sheets.Find(start.sheet_id || 0)?.name;
      }


      const label = this.parser.Render(entry);
      */

      // add to references once

      if (!list.has(label)) {
        references.push(area);
        list.add(label);
      }

      // but keep a map
      map.set(entry, label);

    }

    this.UpdateReferences(node, references);

    return map;
    
  }

  protected UpdateReferences(node: HTMLElement, references: Area[], options: Partial<UpdateTextOptions> = {}) {

    node.dataset.references = JSON.stringify(references.map(entry => this.model.AddressToLabel(entry)));

    for (const entry of this.nodes) {
      if (entry.node === node) {
        entry.references = references;
        break;
      }
    }

  }

  /**
   * reformat text to highlight, which involves tinkering with
   * node structure. we're probably doing this more than necessary;
   * we might consider editing the existing structure, rather than
   * throwing it away every time.
   * 
   */
  protected UpdateText(
      node: HTMLElement, 
      options: Partial<UpdateTextOptions> = {}) {

    const text = node.textContent || '';

    // set this flag so we can use it in `get selected()`
    
    this.text_formula = text[0] === '=';

    if (this.editor_node && !this.assume_formula) {
      this.editor_node.spellcheck = !(this.text_formula);
    }

    // this is a short-circuit so we don't format the same text twice. 
    // but there are some problems when you assign the same text over,
    // especially if the text is empty.
    //
    // to unset this field make sure to set it to `undefined` instead 
    // of any empty string, so it will expressly not match an empty string. 

    if (text === node.dataset.formatted_text) {

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

    /*
    const substr = this.SubstringToCaret(node);
    const substr2 = this.SubstringToCaret(node, true);
    const test = this.SubstringToCaret2(node);
    */

    const [substring_start, substring_end] = this.SubstringToCaret2(node);

    // console.info({text, substr, substr2});

    let caret_start = substring_start.length;
    let caret_end = substring_end.length;

    // this is a little hacky
    if (caret_start === 0 && caret_end === 0) {
      caret_end = text.length;
    }

    if (!text) {
      this.UpdateReferences(node, [], options);
    }
    else {
      const parse_result = this.parser.Parse(text);

      if (parse_result.expression) {

        const indexes = this.UpdateDependencies(node, parse_result, options);
        
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

        const fragment = document.createDocumentFragment();

        const AddNode = (text: string, type = 'text', reference = '', force_selection = false) => {

          const text_node = document.createTextNode(text);

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
            const span = document.createElement('span');

            if (reference) {
              span.dataset.reference = reference;
            }

            span.className = type;
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
              reference = indexes.get(unit) || '???';

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

        if (selection_start && !options.format_only && node === this.editor_node) {

          // console.info('setting selection');

          this.SetCaret(selection_start, selection_end);
          (selection_end || selection_start).node.parentElement?.scrollIntoView();
  
        }

      }
      else {
        // console.warn("expression failed", text);
      }
    }

    node.dataset.formatted_text = text;

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
    const children = this.editor_node?.childNodes || [];
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

    if (!this.editor_node) return;

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

    const text = this.editor_node.textContent || '';
    let adjusted = text.substring(0, start) + insertion;
    let caret = adjusted.length;
    adjusted += text.substring(end);

    this.editor_node.textContent = adjusted;
    this.SetCaret({node: this.editor_node, offset: caret});
    
    /*
    let selection = window.getSelection();
    if (!selection) throw new Error('error getting selection');

    let range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    const tmp = document.createElement('div');

    preCaretRange.selectNodeContents(this.editor_node);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    tmp.appendChild(preCaretRange.cloneContents());

    const str = (tmp.textContent || '').substr(0, ac_result.data ? ac_result.data.position : 0) + ac_result.value;
    //const insert = (type === DescriptorType.Token) ? str + ' ' : str + '(';
    const insert = (type === DescriptorType.Token) ? str : str + '(';

    // this is destroying nodes, we should be setting html here

        this.editor_node.textContent = insert;

    */

    this.autocomplete?.Hide();

    this.UpdateText(this.editor_node);
    this.UpdateColors();

    /*
    selection = window.getSelection();
    range = document.createRange();
    if (this.editor_node?.lastChild) {
      range.setStartAfter(this.editor_node.lastChild);
    }
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    this.selecting_ = true;

    if (ac_result.click){
      this.UpdateSelectState();
    }
    */


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

    if (node !== document.activeElement || node !== this.editor_node) {
      return result;
    }
    
    // is there a way to do this without recursing? (...)
    // how about string concat instead of array join, it's faster in 
    // chrome (!)

    let complete = [ false, false ];

    const Consume = (element: Node, range: Range) => {

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

      if (element instanceof Text) {
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

    const selection = window.getSelection();
    if (selection?.rangeCount ?? 0 > 0) {
      const range = selection?.getRangeAt(0);
      if (range) {
        Consume(node, range);
      }
    }

    return result;
  }

  /* *
   * get text up to the selection. optionally use the start of the 
   * selection. new version does not require cloning, we can drop the 
   * measurement node.
   * 
   * @param node 
   * @param start 
   * @returns 
   * /
  protected SubstringToCaret(node: HTMLElement, start = false): string {

    if (node !== document.activeElement) {
      return '';
    }

    // is there a way to do this without recursing? (...)
    // how about string concat instead of array join, it's faster in chrome (!)

    const Consume = (element: Node, target: Node, offset: number, parts: string[]): boolean => {
      if (element === target) {
        parts.push((element.textContent || '').substring(0, offset));
        return false;
      }
      else if (element instanceof Text) {
        parts.push(element.textContent || '');
        return true;
      }
      else if (element.hasChildNodes()) {
        for (const child of element.childNodes) {
          const result = Consume(child, target, offset, parts);
          if (!result) { 
            return false; 
          }
        }
        return true;
      }
      return false;
    };

    const selection = window.getSelection();
    if (selection?.rangeCount ?? 0 > 0) {

      const range = selection?.getRangeAt(0);
      if (range) {
        let [target, offset] = start ? 
            [range.startContainer, range.startOffset] : 
            [range.endContainer, range.endOffset];

        const parts: string[] = [];
        Consume(node, target, offset, parts);
        return parts.join('');

      }

    }
    
    return '';

  }
  */

  /* *
   * we've been carrying this function around for a while. is this
   * still the best way to do this in 2023? (...)
   * 
   * get text substring to caret position, irrespective of node structure
   * 
   * @param start - use the start of the selection instead of the end
   * /
  protected SubstringToCaret(node: HTMLElement, start = false): string {

    if (node !== this.editor_node || node !== document.activeElement) {
      return '';
    }

    // we could probably shortcut if text is empty

    const selection = window.getSelection();
    if (!selection) {
      throw new Error('error getting selection');
    }

    if (selection.rangeCount === 0) {
      // console.warn('range count is 0');
      return '';
    }

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();

    preCaretRange.selectNodeContents(node);
    if (start) {
      preCaretRange.setEnd(range.startContainer, range.startOffset);
    }
    else {
      preCaretRange.setEnd(range.endContainer, range.endOffset);
    }

    this.measurement_node.textContent = '';
    this.measurement_node.appendChild(preCaretRange.cloneContents());

    const result = this.measurement_node.textContent || '';
    const result2 = this.SubstringToCaret2(node, start);

    // console.info('X', result === result2, {result, result2});
    if (result !== result2) {
      throw new Error('mismatch');
    }

    return result;

    // return this.measurement_node.textContent || '';

  }
  */

}
