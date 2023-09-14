
import type { IArea, ICellAddress } from 'treb-base-types';

export type DependencyList = Array<IArea|ICellAddress|undefined>;
export type ExternalEditorCallback = (selection?: string) => DependencyList|undefined;

export interface ExternalEditorConfig {

  // --- old interface ---------------------------------------------------------

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

  // --- new interface ---------------------------------------------------------

  /**  
   * a list of nodes that will serve as editors. when you attach, we will do
   * an initial pass of context highlighting. we highlight on text changes 
   * and insert references if you make a selection in the spreadsheet while
   * an editor is focused.
   */
  nodes: HTMLElement[];

}