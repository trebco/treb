import { IArea } from 'treb-base-types';
import { MacroFunction } from 'treb-grid';

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
  sheet_data?: any;
  decimal_mark?: '.' | ',';
  active_sheet?: number;
  simulation_data?: TREBSimulationData;
  rendered_values?: boolean;
  named_ranges?: {[index: string]: IArea};
  macro_functions?: MacroFunction[];
}

export interface ResizeEvent {
  type: 'resize';
}

export interface DocumentLoadEvent {
  type: 'load';
}

export interface DocumentResetEvent {
  type: 'reset';
}

export interface DataChangeEvent {
  type: 'data';
}

export interface DocumentChangeEvent {
  type: 'document-change';
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

export interface SelectionEvent {
  type: 'selection';
}

export type EmbeddedSheetEvent
  = SimulationCompleteEvent
  | SimulationProgressEvent
  | DocumentChangeEvent
  | DocumentResetEvent
  | DocumentLoadEvent
  | DataChangeEvent
  | SelectionEvent
  | ResizeEvent
  ;
