
import type { IArea, ICellAddress } from 'treb-base-types';

export type DependencyList = Array<IArea|ICellAddress|undefined>;
export type ExternalEditorCallback = (selection?: string) => DependencyList|undefined;

export interface ExternalEditorConfig {

  /**
   * list of dependencies to highlight. we support undefined entries in
   * this list so you can use the result of `EmbeddedSpreadsheet.Resolve`,
   * which may return undefined.
   */
  dependencies: DependencyList;

  /**
   * this callback will be called when the selection changes in the 
   * spreadsheet and this external editor is active. return an updated
   * list of dependencies to highlight. 
   * 
   * NOTE: this is currently synchronous, but don't rely on that. it
   * might switch to async in the future depending on how it works in 
   * practice.
   */
  update: ExternalEditorCallback;

  /** 
   * pass a contenteditable div and we will construct an editor that works 
   * like the function bar editor. listen for `input` events to watch changes.
   * we will store a list of references in the element dataset. 
   * 
   * note that when we insert a reference (from clicking the spreadsheet) 
   * we'll send an `input` event, but it's synthetic and hence has 
   * `isTrusted` = `false`.
   */
  edit: HTMLDivElement;

  /** 
   * pass a set of divs to format. this is the same as the editor, it does
   * syntax highlighting and reads references, but it's a one-off and does
   * not listen for (or broadcast) events.
   * 
   * this can overlap with edit. we want to keep track of all external 
   * editors at the same time to keep dependencies in sync.
   */
  format: HTMLDivElement[];

}