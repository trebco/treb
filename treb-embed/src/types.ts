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

import type { IArea, Table, TableTheme } from 'treb-base-types';
import type { SerializedNamedExpression, SerializedSheet } from 'treb-grid';
import type { SerializedMacroFunction } from 'treb-grid/src/types/data_model';

export enum SaveFileType {
  json = 'json',
  treb = 'treb',
  trebjson = 'treb.json', 
  csv = 'csv', 
  tsv = 'tsv', 
  xlsx = 'xlsx',
}


//
// FIXME: bring back document_id, move dirty flag into this class;
// support undoing into clean state based on document id, last save,
// and so on
//

/**
 * we're not exporting this type in the public API because there are so many 
 * nested types that aren't used anywhere else (in public functions). 
 * 
 * I would like to do it, though, that `any` looks bad in the  public API.
 */
export interface TREBDocument {
  app: string;
  version: string;
  revision?: number;
  name?: string;
  user_data?: any;
  sheet_data?: SerializedSheet|SerializedSheet[]; // NOTE: support old version, but it would be nice to drop
  decimal_mark?: '.' | ',';
  active_sheet?: number;
  rendered_values?: boolean;
  
  // named_ranges?: {[index: string]: IArea};
  named_ranges?: Record<string, IArea>;

  macro_functions?: SerializedMacroFunction[];
  named_expressions?: SerializedNamedExpression[];
  tables?: Table[];
  shared_resources?: Record<string, string>;
}

export interface ResizeEvent {
  type: 'resize';
}

export enum LoadSource {
  DRAG_AND_DROP = 'drag-and-drop',
  LOCAL_FILE = 'local-file',
  NETWORK_FILE = 'network-file',
  LOCAL_STORAGE = 'local-storage',
  UNDO = 'undo',
}

export enum LoadType {
  TREB = 'treb',
  CSV = 'csv',
  XLSX = 'xlsx',
}

/**
 * This event is sent when a document is loaded, and also on undo. The 
 * source field can help determine if it was triggered by an undo operation.
 */
export interface DocumentLoadEvent {
  type: 'load';
  source?: LoadSource;
  file_type?: LoadType;
}

/**
 * This event is sent when the document is reset.
 * 
 * @privateRemarks 
 * we should remove this in favor of the Load event, plus a suitable load source.
 */
export interface DocumentResetEvent {
  type: 'reset';
}

/**
 * This event is sent when data in the spreadsheet changes, but there are
 * no structural or cell changes. For example, the `RAND` function returns
 * a new value on every calculation, but the function itself does not change.
 */
export interface DataChangeEvent {
  type: 'data';
}

/**
 * This event is sent when the value of a cell changes, or when the document
 * structure chages. Structure changes might be inserting/deleting rows or 
 * columns, or adding/removing a sheet.
 */
export interface DocumentChangeEvent {
  type: 'document-change';
}

/**
 * This event is sent when the spreadsheet selection changes. Use the 
 * `GetSelection` method to get the address of the current selection.
 */
export interface SelectionEvent {
  type: 'selection';
}

/**
 * This event is sent when the focused view changes, if you have more
 * than one view.
 */
export interface FocusViewEvent {
  type: 'focus-view';
}

/**
 * EmbeddedSheetEvent is a discriminated union. Switch on the `type` field
 * of the event.
 */
export type EmbeddedSheetEvent 
  = DocumentChangeEvent
  | DocumentResetEvent
  | DocumentLoadEvent
  | DataChangeEvent
  | FocusViewEvent
  | SelectionEvent
  | ResizeEvent
  ;

/**
 * options when inserting a table into a sheet
 */
export interface InsertTableOptions {

  /** 
   * include a totals/summation row. this impacts the layout and styling:
   * totals row have a unique style and are not included when sorting.
   * defaults to true.
   */
  totals_row?: boolean;

  /** 
   * show a sort button in table headers. defaults to true.
   */
  sortable?: boolean;
  
  /**
   * base theme color, or a set of styles for the table. useful values for
   * theme color are accent colors 4 (the default), 5, 7 and 9.
   */
  theme?: number|TableTheme;

}
