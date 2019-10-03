
import { Area, Cell, Rectangle } from 'treb-base-types';
import { Yield, EventSource } from 'treb-utils';
import { Parser, UnitRange, UnitAddress } from 'treb-parser';

import { GridSelection } from '../types/grid_selection';
import { Autocomplete, AutocompleteResult } from './autocomplete';
import { AutocompleteMatcher } from './autocomplete_matcher';

import { ExtendedTheme } from '../types/theme';
import { DataModel } from '../types/data_model';

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

/** discriminated union */
export type FormulaEditorEvent
  = FormulaEditorCommitEvent
  | FormulaEditorDiscardEvent
  | RetainFocusEvent
  | FormulaEditorUpdateEvent
  | FormulaEditorEndSelectionEvent
  // | FormulaEditorAutocompleteEvent
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

  /** single instance of parser, it's stateless and we're not threaded */
  protected static Parser = new Parser();

  protected static readonly FormulaChars = '$^&*(-+={[<>/~%,'.split(''); // FIXME: i18n

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
      protected readonly theme: ExtendedTheme,
      protected readonly model: DataModel,
      protected readonly autocomplete: Autocomplete){

    super();

    // not added to dom
    this.measurement_node = document.createElement('div');
  }

  public UpdateTheme() {
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
  public Autocomplete(data: any){

    if (!this.container_node) return;

    const client_rect = this.container_node.getBoundingClientRect();
    const rect = new Rectangle(
      Math.round(client_rect.left),
      Math.round(client_rect.top),
      client_rect.width, client_rect.height);

    this.autocomplete.Show(this.AcceptAutocomplete.bind(this), data, rect);
  }

  /** flush insert reference, so the next insert uses a new element */
  protected FlushReference(){
    this.editor_insert_node = undefined;
  }

  /**
   * get text substring to caret position, irrespective of node structure
   */
  protected SubstringToCaret(node: HTMLDivElement){

    // FIXME: x/browser

    // not sure about x/browser with this... only for electron atm
    // seems to be ok in chrome (natch), ffx, [ie/edge? saf? test]

    const selection = window.getSelection();
    if (!selection) throw new Error('error getting selection');
 
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
  protected UpdateSelectState(flush = false){

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
          Yield().then(() => this.Autocomplete(matcher.Exec({ text, cursor: sub.length })));
        }

      }
    }

    if (selecting !== this.selecting_){
      this.selecting_ = selecting;
      if (flush || !selecting) this.Publish({type: 'end-selection'});
    }

    // special case
    else if (selecting && flush) this.Publish({type: 'end-selection'});

    const dependencies = formula ? this.ListDependencies() : undefined;

    this.Publish({ type: 'update', text, dependencies });

  }

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

  /**
   * replace text with node structure for highlighting.
   *
   * lots of cross-browser issues. chrome is generally ok.
   * firefox drops spaces at the end of the text. IE11 breaks,
   * but it's not clear why.
   */
  protected Reconstruct(preserve_caret = true) {

    if (!this.enable_reconstruct) return; // disabled

    if (!this.editor_node) return;
    this.ParseDependencies();
    if (!this.reference_list ) return;

    const text = this.editor_node.textContent || '';
    if (text.trim()[0] !== '=') {
      this.editor_node.setAttribute('spellcheck', 'true');
      return;
    }

    // we might not have to do this, if the text hasn't changed
    // (or the text has only changed slightly...) this might actually
    // save us from the firefox issue (issue: firefox drops trailing spaces)

    // just make sure you flush appropriately

    // we can also skip when selecting (in fact if we don't, it will break
    // the selecting routine by dumping the target span)

    if (this.selecting) return;

    if (text.trim() === this.last_reconstructed_text.trim()) {
      return;
    }

    this.last_reconstructed_text = text;

    const subtext = this.SubstringToCaret(this.editor_node);
    const caret = subtext.length;

    // const nodes: Node[] = [];
    // const fragment = new DocumentFragment();
    const fragment = document.createDocumentFragment();

    let start = 0;
    let selection_target_node: Node|undefined;
    let selection_offset = 0;

    for (let i = 0; i < this.reference_list.length; i++ ){
      const reference = this.reference_list[i];

      // use the original text, so we're not auto-capitalizing
      // (even though I like doing that)
      const label = text.substr(reference.position + 1, reference.label.length);

      // text up to position
      const text_node = document.createTextNode(text.substring(start, reference.position + 1));
      fragment.appendChild(text_node);
      if (caret >= start && caret <= reference.position + 1) {
        selection_target_node = text_node;
        selection_offset = caret - start;
      }

      // address/range
      const span = document.createElement('span');
      span.style.color = this.HighlightColor(this.reference_index_map[i], false);
      fragment.appendChild(span);

      const child_text_node = document.createTextNode(label);
      span.appendChild(child_text_node);

      // advance
      start = reference.position + label.length + 1;

      if (caret > reference.position + 1 && caret < start) {
        selection_target_node = child_text_node;
        selection_offset = caret - (reference.position + 1);
      }

    }

    const remainder = text.substr(start) || '';
    const remainder_node = document.createTextNode(remainder);
    fragment.appendChild(remainder_node);

    if (!selection_target_node) {
      if (text.length === caret) {
        const selection_span = document.createElement('span');
        fragment.appendChild(selection_span);
        selection_target_node = selection_span;
        selection_offset = 0;
      }
      else {
        selection_target_node = remainder_node;
        selection_offset = caret - start;
      }
    }

    // fragment is not a node, so once we append this we have more than
    // one child. we might wrap it in something... ?

    this.editor_node.textContent = '';
    this.editor_node.appendChild(fragment);

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

  protected ParseDependencies() {

    if (!this.editor_node) return [];

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
        const parse_result = FormulaEditorBase.Parser.Parse(text);
        this.last_parse_string = text;

        this.reference_list = []; // parse_result.full_reference_list;

        if (parse_result.full_reference_list) {
          for (const unit of parse_result.full_reference_list) {
            if (unit.type === 'address' || unit.type === 'range') {

              // if there's a sheet name, map to an ID. FIXME: make a map
              const start = (unit.type === 'address') ? unit : unit.start;
              if (start.sheet && !start.sheet_id) {
                start.sheet_id = sheet_name_map[start.sheet.toLowerCase()] || 0;
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

  protected AcceptAutocomplete(ac_result: AutocompleteResult){

    if (!this.editor_node) return;
    const selection = window.getSelection();

    if (!selection) throw new Error('error getting selection');

    let range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    const tmp = document.createElement('div');

    preCaretRange.selectNodeContents(this.editor_node);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    tmp.appendChild(preCaretRange.cloneContents());
    const str = (tmp.textContent || '').substr(0, ac_result.data.position) + ac_result.value;

    this.editor_node.textContent = str + '(';
    this.autocomplete.Hide();

    range = document.createRange();
    // const selection = window.getSelection();

    if (this.editor_node.lastChild) {
      range.setStartAfter(this.editor_node.lastChild);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    this.selecting_ = true;

    if (ac_result.click){
      this.UpdateSelectState();
    }

  }

}
