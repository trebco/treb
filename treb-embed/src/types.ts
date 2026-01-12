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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import type { IArea, Table, TableTheme } from 'treb-base-types';
import type { 
  SerializedNamedExpression, 
  SerializedSheet,
  SerializedMacroFunction,
  SerializedNamed } from 'treb-data-model';

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
 * this is the document type used by TREB. it has a lot of small variations 
 * for historical reasons and backwards compatibility. usually it's preferable 
 * to let TREB create and manage these documents rather than creating them
 * manually.
 */
export interface TREBDocument {

  /** app name, as identifier */
  app: string;

  /** app version. we'll warn if you use a file from a newer version */
  version: string;

  /** 
   * revision number. this is a value that increments on any document change,
   * useful for checking if a document is "dirty".
   */
  revision?: number;

  /** document name */
  name?: string;

  /** 
   * opaque user data. we don't read or parse this, but applications can
   * use it to store arbitrary data.
   */
  user_data?: unknown;

  /**
   * per-sheet data. this should be an array, but for historical reasons
   * we still support a single sheet outside of an array.
   */
  sheet_data?: SerializedSheet|SerializedSheet[];

  /** document decimal mark */
  decimal_mark?: '.' | ',';

  /** active sheet. if unset we'll show the first un-hidden sheet */
  active_sheet?: number;
  
  /** 
   * this document includes rendered calculated values. using this lets the
   * app show a document faster, without requiring an initial calculation.
   */
  rendered_values?: boolean;
  
  /** document named ranges @deprecated */
  named_ranges?: Record<string, IArea>;

  /** document named expressions @deprecated */
  named_expressions?: SerializedNamedExpression[];

  /**
   * new consolidated named ranges & expressions
   */
  named?: SerializedNamed[];

  /** document macro functions */
  macro_functions?: SerializedMacroFunction[];

  /** document tables */
  tables?: Table[];

  /** document shared resources (usually images) */
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
  INLINE_DOCUMENT = 'inline-document',
  UNDO = 'undo',
}

export enum LoadType {
  TREB = 'treb',
  CSV = 'csv',
  XLSX = 'xlsx',
}

/**
 * This event is sent when the view changes -- at the moment, that only
 * means the view scale has been changed. We might use it in the future
 * for other things.
 * 
 * @privateRemarks
 * not sure if this should be combined with resize -- the only reason it's
 * not is because resize implies some structural/layout changes that require
 * changing the document, but scale does not. open to suggestions though.
 */
export interface ViewChangeEvent {
  type: 'view-change';
}

/**
 * this event is sent when the theme is updated. it's intended for any 
 * subscribers to update corresponding colors or fonts.
 */
export interface ThemeChangeEvent {
  type: 'theme-change';
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
 * this event is used when an annotation is selected. we're not changing
 * the original selection event, because I don't want to break anything.
 */
export interface AnnotationSelectionEvent {
  type: 'annotation-selection';
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
  | ThemeChangeEvent
  | ViewChangeEvent
  | DataChangeEvent
  | FocusViewEvent
  | SelectionEvent
  | ResizeEvent
  | AnnotationSelectionEvent
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
