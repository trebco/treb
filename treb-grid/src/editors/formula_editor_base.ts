
import { Area, Cell, Theme, Rectangle, Localization } from 'treb-base-types';
import { Yield, EventSource } from 'treb-utils';
import { Parser, UnitRange, UnitAddress, ParseResult, ExpressionUnit } from 'treb-parser';

import { GridSelection } from '../types/grid_selection';
import { Autocomplete, AutocompleteResult } from './autocomplete';
import { AutocompleteExecResult, AutocompleteMatcher, DescriptorType } from './autocomplete_matcher';

import { DataModel, ViewModel } from '../types/data_model';
import { UA } from '../util/ua';

/** event on commit, either enter or tab */
export interface FormulaEditorCommitEvent {
  type: 'commit';
  selection?: GridSelection;
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

export interface RetainFocusEvent {
  type: 'retain-focus';
  focus: boolean;
}

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
  = RetainFocusEvent
  | StopEditingEvent
  | StartEditingEvent
  | FormulaEditorUpdateEvent
  | FormulaEditorCommitEvent
  | FormulaEditorDiscardEvent
  | FormulaEditorEndSelectionEvent
  ;

/**
 * this class implements some common functionality for the formula
 * bar editor and the in-cell editor, in an effort to reduce duplication
 * and normalize behavior.
 *
 * finally figured out how to use a polymorphic discriminated union.
 * not sure what would happen if the implementing type violated the
 * type rule... not an issue atm, but worth a look. maybe enforce somehow,
 * via interface?
 */
export abstract class FormulaEditorBase<E = FormulaEditorEvent> extends EventSource<E|FormulaEditorEvent> {

  protected static readonly FormulaChars = ('$^&*(-+={[<>/~%' + Localization.argument_separator).split(''); // FIXME: i18n

  /**
   * the current edit cell. in the event we're editing a merged or
   * array cell, this might be different than the actual target address.
   */
  public active_cell?: Cell;

  /** address of cell we're editing */
  // public address: CellAddress;

  /** area we're editing, for potential arrays */
  // public area: Area;

  /** matcher. passed in by owner. should move to constructor arguments */
  public autocomplete_matcher?: AutocompleteMatcher;

  /**
   * non-document node for text munging
   *
   * FIXME: this could be static? is there a case where we are editing
   * two things at once? (...)
   */
  protected measurement_node: HTMLDivElement;

  // tslint:disable-next-line:variable-name
  protected selecting_ = false;

  /** node for inserting cell address, when selecting */
  protected editor_insert_node?: HTMLSpanElement;

  /** the edit node, which is a contenteditable div */
  protected editor_node?: HTMLDivElement;

  /** the containing node, used for layout */
  protected container_node?: HTMLDivElement;

  /** ac instance */
  // protected autocomplete!: Autocomplete; // = new Autocomplete();

  /** this never fucking ends */
  protected trident = ((typeof navigator !== 'undefined') &&
    navigator.userAgent && /trident/i.test(navigator.userAgent));

  // ...
  protected last_parse_string = '';
  protected last_parse_result?: ParseResult;

  // protected dependency_list?: DependencyList;
  protected reference_list?: Array<UnitRange|UnitAddress>;
  protected dependency_list: Area[] = [];
  protected reference_index_map: number[] = [];

  protected last_reconstructed_text = '';

  private enable_reconstruct = true; // false;

  /**
   * accessor for editor selecting cells. if this is set, a click on the
   * sheet (or arrow navigation) should be interpreted as selecting a
   * cell as an argument
   */
  public get selecting() { return this.selecting_; }

  /**
   * selection being edited. note that this is private rather than protected
   * in an effort to prevent subclasses from accidentally using shallow copies
   */
  // tslint:disable-next-line:variable-name
  private selection_: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
  };

  /** accessor for selection */
  public get selection(){ return this.selection_; }

  /** set selection, deep copy */
  public set selection(rhs: GridSelection){
    if (!rhs){
      const zero = {row: 0, column: 0};
      this.selection_ = {target: zero, area: new Area(zero)};
    }
    else {
      const target = rhs.target || rhs.area.start;
      this.selection_ = {
        target: {row: target.row, column: target.column},
        area: new Area(rhs.area.start, rhs.area.end),
      };
    }
  }

  constructor(
      protected readonly parser: Parser,
      protected readonly theme: Theme,
      protected readonly model: DataModel,
      protected readonly view: ViewModel,
      protected readonly autocomplete: Autocomplete){

    super();

    // not added to dom
    this.measurement_node = document.createElement('div');
  }

  public UpdateTheme(scale: number) {
    // ...
  }

  public InsertReference(reference: string, id: any){

    if (!this.editor_node) return;

    // FIXME: x/browser?

    if (!this.editor_insert_node){
      const selection = window.getSelection();
      if (selection) {
        const range = selection.getRangeAt(0);
        this.editor_insert_node = document.createElement('span');
        range.insertNode(this.editor_insert_node);
        selection.collapseToEnd();
      }
    }
    if (this.editor_insert_node) {

      this.editor_insert_node.innerText = reference;

      // edge handles this differently than chrome/ffx. in edge, the
      // cursor does not move to the end of the selection, which is
      // what we want. so we need to fix that for edge:

      // FIXME: limit to edge (causing problems in chrome? ...)

      if (reference.length) {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(this.editor_insert_node);
          selection.removeAllRanges();
          selection.addRange(range);
          selection.collapseToEnd();
        }
      }

    }

    const dependencies = this.ListDependencies();

    this.Publish({type: 'update', text: this.editor_node.textContent || undefined, dependencies});

  }

  /** called when there's AC data to display (or tooltip) */
  public Autocomplete(data: AutocompleteExecResult, target_node?: Node): void {

    if (!this.container_node) {
      return;
    }

    let client_rect: DOMRect;
    if (target_node?.nodeType === Node.ELEMENT_NODE) {
      client_rect = (target_node as Element).getBoundingClientRect();
    }
    else {
      client_rect = this.container_node.getBoundingClientRect();
    }

    const rect = new Rectangle(
      Math.round(client_rect.left),
      Math.round(client_rect.top),
      client_rect.width, client_rect.height);

    this.autocomplete.Show(this.AcceptAutocomplete.bind(this), data, rect);

  }

  /** flush insert reference, so the next insert uses a new element */
  protected FlushReference(): void {
    this.editor_insert_node = undefined;
  }

  /**
   * get text substring to caret position, irrespective of node structure
   */
  protected SubstringToCaret(node: HTMLDivElement): string {

    // FIXME: x/browser

    // not sure about x/browser with this... only for electron atm
    // seems to be ok in chrome (natch), ffx, [ie/edge? saf? test]

    const selection = window.getSelection();
    if (!selection) {
      throw new Error('error getting selection');
    }

    if (selection.rangeCount === 0) {
      console.warn('range count is 0');
      return '';
    }

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();

    preCaretRange.selectNodeContents(node);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    this.measurement_node.textContent = '';
    this.measurement_node.appendChild(preCaretRange.cloneContents());

    return this.measurement_node.textContent;
  }

  /**
   * @param flush flush existing selection even if state does not
   * change -- this is used in the case where there's a single keypress
   * between two selections, otherwise we keep the initial block
   */
  protected UpdateSelectState(flush = false): void {

    let selecting = false;
    let formula = false;

    if (!this.editor_node) return;

    const text = this.editor_node.textContent || '';

    // if (text.trim().startsWith('=')){
    if (text.trim()[0] === '='){
      formula = true;
      const sub = this.SubstringToCaret(this.editor_node).trim();

      if (sub.length){
        const char = sub[sub.length - 1];
        if (FormulaEditorBase.FormulaChars.some((a) => char === a)) selecting = true;

        // this.Publish({
        //   type: 'autocomplete',
        //  text, cursor: sub.length,
        // });
        // bind instance so we know it exists. this is unecessary, but it's
        // more correct and ts will stop complaining

        const matcher = this.autocomplete_matcher;

        if (matcher) {
          Yield().then(() => {
            const exec_result = matcher.Exec({ text, cursor: sub.length });
            const node = 
              this.NodeAtIndex(exec_result.completions ? 
                    (exec_result.position || 0) :
                    (exec_result.function_position || 0));
            this.Autocomplete(exec_result, node);
          });
        }

      }
    }

    if (selecting !== this.selecting_){
      this.selecting_ = selecting;
      if (!selecting) {
        this.Reconstruct(); // because we skipped the last one (should just switch order?)
      }
      if (flush || !selecting) {
        this.Publish({type: 'end-selection'});
      }
    }

    // special case
    else if (selecting && flush) this.Publish({type: 'end-selection'});

    const dependencies = formula ? this.ListDependencies() : undefined;

    this.Publish({ type: 'update', text, dependencies });

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

  /*
  protected HighlightColor(index: number, overlay = false) {
    if (overlay) {
      if (Array.isArray(this.theme.additional_selection_overlay_color)) {
        index = index % this.theme.additional_selection_overlay_color.length;
        return this.theme.additional_selection_overlay_color[index] || '';
      }
      return this.theme.additional_selection_overlay_color || '';
    }
    else {
      if (Array.isArray(this.theme.additional_selection_text_color)) {
        index = index % this.theme.additional_selection_text_color.length;
        return this.theme.additional_selection_text_color[index] || '';
      }
      return this.theme.additional_selection_text_color || '';
    }
  }
  */

  /**
   * replace text with node structure for highlighting.
   *
   * lots of cross-browser issues. chrome is generally ok. firefox drops
   * spaces at the end of the text. IE11 breaks, but it's not clear why.
   *
   * UPDATE: this breaks when entering hanzi, probably true of all
   * multibyte unicode characters
   *
   * removing unused parameter
   */
  protected Reconstruct(): void {

    if (!this.enable_reconstruct) {
      return; // disabled
    }

    if (!this.editor_node) {
      return;
    }

    this.ParseDependencies();

    // ---

    // this was originally here and wasn't doing what it was supposed to
    // do, because the reference list could be empty but still !false. however
    // we're actually adding nodes for other things (calls) so we should leave
    // it as is for now

    if (!this.reference_list) {
      return;
    }

    // my attempted fix
    // if (!this.reference_list || !this.reference_list.length) {
    //   return;
    // }

    // ---

    // here we would normally set spellcheck to true for strings,
    // but that seems to break IME (at least in chrome). what we 
    // should do is have spellcheck default to true and then turn
    // it off for functions. also we should only do this on parse,
    // because that only happens when text changes.

    const text = this.editor_node.textContent || '';

    if (text.trim()[0] !== '=') {
      // this.editor_node.setAttribute('spellcheck', 'true');
      return;
    }

    this.editor_node.spellcheck = false;

    // we might not have to do this, if the text hasn't changed
    // (or the text has only changed slightly...) this might actually
    // save us from the firefox issue (issue: firefox drops trailing spaces)

    // just make sure you flush appropriately

    // we can also skip when selecting (in fact if we don't, it will break
    // the selecting routine by dumping the target span)

    if (this.selecting) return;

    // why do we parse dependencies (above) if the text hasn't changed? (...)
    // actually that routine will also short-circuit, although it would presumably
    // be better to not call it

    if (text.trim() === this.last_reconstructed_text.trim()) {
      return;
    }

    this.last_reconstructed_text = text;

    const subtext = this.SubstringToCaret(this.editor_node);
    const caret = subtext.length;

    // why are we using a document fragment? something to do with x-browser? 
    // (...)
    // actually I think it's so we can construct like a regular document, but
    // do it off screen (double-buffered), not sure if it makes that much of 
    // a difference. I suppose you could use a container node instead... ?

    const fragment = document.createDocumentFragment();

    // this is the node that will contain the caret/cursor
    let selection_target_node: Node|undefined;

    // this is the caret/cursor offset within that node
    let selection_offset = 0;

    let last_node: Node|undefined;
    let last_text = '';

    if (this.last_parse_result) {

      // somewhat unfortunate but we drop the = from the original text when
      // parsing, so all of the offsets are off by 1.

      let base = 0;
      let label = '';
      let reference_index = 0;

      const append_node = (start: number, text: string, type: string) => {
        const text_node = document.createTextNode(text);
        if (type === 'text') {
          fragment.appendChild(text_node);
        }
        else {
          const span = document.createElement('span');
          span.appendChild(text_node);
          span.dataset.position = start.toString();
          span.dataset.type = type;

          if (type === 'address' || type === 'range') {
            span.classList.add(`highlight-${(this.reference_index_map[reference_index++] % 5) + 1}`);
          }
          else if (type === 'identifier') {
            if (this.model.named_ranges.Get(text)) {
              span.classList.add(`highlight-${(this.reference_index_map[reference_index++] % 5) + 1}`);
            }
          }

          fragment.appendChild(span);
        }

        if (caret >= start && caret < start + text.length) {
          // console.info('caret is in this one:', text);
          selection_target_node = text_node;
          selection_offset = caret - start;
        }

        return text_node;
      };

      if (this.last_parse_result.expression) {

        // console.info({expr: this.last_parse_result.expression});

        this.parser.Walk(this.last_parse_result.expression, (unit: ExpressionUnit) => {

          switch (unit.type) {
            case 'address':
            case 'range':
            case 'call':
            case 'identifier':

              // any leading text we have skipped, create a text node
              if (unit.position !== base - 1) {
                append_node(base, text.substring(base, unit.position + 1), 'text');
              }

              // let's get the raw text, and not the "label" -- that's causing
              // text to toggle as we type, which is generally OK except when
              // it's not, but when it's not it's really annoying.

              if (unit.type === 'call' || unit.type === 'identifier') { label = unit.name; }
              else {

                // use the raw text. FIXME: parser could save raw 
                // text here, so we don't have to substring.

                label = this.last_parse_string.substring(unit.position + 1, unit.position + unit.label.length + 1);
              }

              // label = (unit.type === 'call' || unit.type === 'identifier') ? unit.name : unit.label;
              
              append_node(unit.position + 1, label, unit.type);

              base = unit.position + label.length + 1;
              break;
          }

          // range is unusual because we don't recurse (return false)
          return unit.type !== 'range';
        
        });
      }

      // balance, create another text node. hang on to this one.
      last_text = text.substring(base) || '';
      last_node = append_node(base, last_text, 'text');

    }

    if (!selection_target_node) {
     if (text.length === caret) {
        const selection_span = document.createElement('span');
        fragment.appendChild(selection_span);
        selection_target_node = selection_span;
        selection_offset = 0;
      }
      else {
        selection_target_node = last_node; // remainder_node;
        selection_offset = Math.max(0, last_text.length - (text.length - caret));
        // console.info("FIXME!", text.length - caret);
      }
    }

    // fragment is not a node, so once we append this we have more than
    // one child. we might wrap it in something... ?

    this.editor_node.textContent = '';
    this.editor_node.appendChild(fragment);

    // console.info("STC", selection_target_node, selection_offset);

    if (selection_target_node) {
      const range = document.createRange();
      const selection = window.getSelection();
      if (selection) {
        range.setStart(selection_target_node, selection_offset);
        range.setEnd(selection_target_node, selection_offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    // return fragment;
  }

  protected ParseDependencies(): void {

    if (!this.editor_node) {
      return;
    }

    const text = this.editor_node.textContent || '';

    // this is pretty rare (parsing the same string twice), we only do this
    // text on changes. still, we want to keep the dep list around, so we
    // might as well check.

    // far more common are minor (like 1-char) changes; it would be nice if
    // we could do incremental updates. probably a lot of work on the parser
    // side, though.

    if (text !== this.last_parse_string || !this.reference_list) {

      const sheet_name_map: {[index: string]: number} = {};
      for (const sheet of this.model.sheets) {
        sheet_name_map[sheet.name.toLowerCase()] = sheet.id;
      }

      this.dependency_list = [];
      this.reference_index_map = [];

      if (text) {
        const parse_result = this.parser.Parse(text);
        this.last_parse_string = text;
        this.last_parse_result = parse_result;

        // console.info("SA?", self); (self as any).LPR = this.last_parse_result;

        this.reference_list = []; // parse_result.full_reference_list;

        if (parse_result.full_reference_list) {
          for (const unit of parse_result.full_reference_list) {
            if (unit.type === 'address' || unit.type === 'range') {

              // if there's a sheet name, map to an ID. FIXME: make a map
              const start = (unit.type === 'address') ? unit : unit.start;

              if (!start.sheet_id) {
                if (start.sheet) {
                  start.sheet_id = sheet_name_map[start.sheet.toLowerCase()] || 0;
                }
                else {
                  start.sheet_id = this.view.active_sheet.id;
                }
              }
              this.reference_list.push(unit);

            }
            else {
              const named_range = this.model.named_ranges.Get(unit.name);
              if (named_range) {
                if (named_range.count === 1) {
                  this.reference_list.push({
                    type: 'address',
                    ...named_range.start,
                    label: unit.name,
                    position: unit.position,
                    id: unit.id,
                  });
                }
                else {
                  this.reference_list.push({
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
            }
          }
        }

        if (this.reference_list) {

          this.reference_list.sort((a, b) => a.position - b.position);

          for (const reference of this.reference_list) {
            let area: Area;

            if (reference.type === 'address') {
              area = new Area({
                row: reference.row, column: reference.column, sheet_id: reference.sheet_id}); // note dropping absolute
            }
            else {
              area = new Area(
                {row: reference.start.row, column: reference.start.column,
                  sheet_id: reference.start.sheet_id}, // note dropping absolute
                {row: reference.end.row, column: reference.end.column});
            }

            const label = area.spreadsheet_label;
            if (!this.dependency_list.some((test, index) => {
              if (test.spreadsheet_label === label && test.start.sheet_id === area.start.sheet_id) {
                this.reference_index_map.push(index);
                return true;
              }
              return false;
            })) {
              this.reference_index_map.push(this.dependency_list.length);
              this.dependency_list.push(area);
            }
          }
        }

      }
      else {
        this.reference_list = undefined;
      }
    }

  }

  /**
   * moving dependency parser into this class (from grid), so we can do
   * some highlighting in the editor (at least in the formula bar).
   *
   * this method returns a consolidated list of dependencies, addresses
   * and ranges, as Area[]. we may have duplicates where one is absolute
   * and the other is not; for the purposes of this method, those are the
   * same.
   */
  protected ListDependencies(): Area[] {

    this.ParseDependencies();
    return this.dependency_list || [];

    /*
    if (this.reference_list) {

      for (const reference of this.reference_list) {
        let area: Area;
        if (reference.type === 'address') {
          area = new Area({row: reference.row, column: reference.column}); // note dropping absolute
        }
        else {
          area = new Area(
            {row: reference.start.row, column: reference.start.column}, // note dropping absolute
            {row: reference.end.row, column: reference.end.column});
        }
        const label = area.spreadsheet_label;
        if (!results.some((test) => test.spreadsheet_label === label)) {
          results.push(area);
        }
      }

    }
    return results;
    */

  }

  protected AcceptAutocomplete(ac_result: AutocompleteResult): void {

    if (!this.editor_node) return;
    let selection = window.getSelection();

    let type = DescriptorType.Function;
    if (ac_result.data && ac_result.data.completions) {
      for (const completion of ac_result.data.completions) {
        if (completion.name.toLowerCase() === ac_result.value?.toLowerCase()) {
          type = completion.type || DescriptorType.Function;
          break;
        }
      }
    }

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
    this.autocomplete.Hide();

    // we have to reconstruct because we destroyed nodes, although
    // we do need to call this for new nodes (on a defined name)

    // firefox has problems... essentially if we do reconstruct, then
    // try to place the cursor at the end, it ends up in a garbage position.
    // (debugging...)

    if (!UA.is_firefox) {
      // this.Reconstruct(true);
      this.Reconstruct();
    }

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

  }

}
