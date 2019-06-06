
export enum SaveFileType {
  treb = 'treb', tsv = 'tsv', xlsx = 'xlsx',
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
  simulation_data?: TREBSimulationData;
  rendered_values?: boolean;
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

export interface SimulationCompleteEvent {
  type: 'simulation-complete';
}

export interface SelectionEvent {
  type: 'selection';
}

export type EmbeddedSheetEvent =
  DocumentLoadEvent |
  DocumentResetEvent |
  DataChangeEvent |
  SimulationCompleteEvent |
  ResizeEvent |
  SelectionEvent;

