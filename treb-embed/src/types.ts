import { IArea } from 'treb-base-types';
import { MacroFunction, SerializedNamedExpression, SerializedSheet } from 'treb-grid';

export enum SaveFileType {
  json = 'json',
  treb = 'treb', 
  csv = 'csv', 
  tsv = 'tsv', 
  xlsx = 'xlsx',
}

export interface TREBSimulationData {
  elapsed: number;
  trials: number;

  /** 
   * add a flag to indicate we are saving data as 32-bit.
   * implicit default is 64-bit.
   */
  bitness?: number;
  encoding?: 'b64'|'z85';
  results: any;
}

//
// FIXME: bring back document_id, move dirty flag into this class;
// support undoing into clean state based on document id, last save,
// and so on
//

export interface TREBDocument {
  app: string;
  // document_id: number;
  version: string;
  name?: string;
  user_data?: any;
  sheet_data?: SerializedSheet|SerializedSheet[]; // NOTE: support old version, but it would be nice to drop
  decimal_mark?: '.' | ',';
  active_sheet?: number;
  simulation_data?: TREBSimulationData; // MC specific
  rendered_values?: boolean;
  named_ranges?: {[index: string]: IArea};
  macro_functions?: MacroFunction[];
  named_expressions?: SerializedNamedExpression[];
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
 * @deprecated we should remove this in favor of the Load event, plus a suitable load source.
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

export interface RunningSimulationEvent {
  type: 'running-simulation';
  trials?: number;
}

export interface SimulationAbortedEvent {
  type: 'simulation-aborted';
}

export interface SimulationCompleteEvent {
  type: 'simulation-complete';
  elapsed: number;
  trials: number;
  // threads: number;
}

export interface SimulationProgressEvent {
  type: 'simulation-progress';
  progress: number;
}

/**
 * This event is sent when the spreadsheet selection changes. Use the 
 * `GetSelection` method to get the address of the current selection.
 */
export interface SelectionEvent {
  type: 'selection';
}

/*
export type EmbeddedSheetEvent
  = DocumentChangeEvent
  | DocumentResetEvent
  | DocumentLoadEvent
  | DataChangeEvent
  | SelectionEvent
  | ResizeEvent

  // ...

  | SimulationCompleteEvent
  | SimulationProgressEvent
  | RunningSimulationEvent
  | SimulationAbortedEvent
  ;
*/

/**
 * EmbeddedSheetEvent is a discriminated union. Switch on the `type` field
 * of the event.
 */
export type EmbeddedSheetEvent 
  = DocumentChangeEvent
  | DocumentResetEvent
  | DocumentLoadEvent
  | DataChangeEvent
  | SelectionEvent
  | ResizeEvent
  ;

export type MCEmbeddedSheetEvent
 = SimulationCompleteEvent
 | SimulationProgressEvent
 | RunningSimulationEvent
 | SimulationAbortedEvent
 ;

export type CompositeEmbeddedSheetEvent = EmbeddedSheetEvent|MCEmbeddedSheetEvent;

