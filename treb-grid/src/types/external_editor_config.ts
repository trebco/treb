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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */


import type { IArea, ICellAddress } from 'treb-base-types';

export type DependencyList = Array<IArea|ICellAddress|undefined>;
export type ExternalEditorCallback = (selection?: string) => DependencyList|undefined;

// FIXME: if you want to keep the old interface, split into to separate types

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

  /** 
   * assume that we're editing a formula. does not require leading `=`.
   * defaults to `true` for historical reasons.
   */
  assume_formula?: boolean;

}