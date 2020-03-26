
import { ICellAddress, IArea } from 'treb-base-types/src';

export interface TrialData {
  results: any;
  trials: number;
  elapsed: number;
}

export interface StartMessage {
  type: 'start';
  lhs?: boolean;
  trials: number;
  screen_updates?: boolean;
}

export interface ConfigMessage {
  type: 'configure';
  locale: string;
  // sheet: any;
  sheets: any[];
  additional_cells?: ICellAddress[];
  named_ranges?: {[index: string]: IArea};
}

export interface StepMessage {
  type: 'step';
}

export interface ProgressMessage {
  type: 'progress';
  percent_complete: number;
}

export interface UpdateMessage {
  type: 'update';
  percent_complete: number;
  cells: any;
  trial_data: TrialData;
}

export interface CompleteMessage {
  type: 'complete';
  trial_data: TrialData;
}

export type WorkerMessage
  = StartMessage
  | ConfigMessage
  | CompleteMessage
  | UpdateMessage
  | StepMessage
  | ProgressMessage
  ;

export interface CalculationWorker extends Worker {
  postMessage: (message: WorkerMessage) => void;
}

