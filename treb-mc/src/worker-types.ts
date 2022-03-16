
import { ICellAddress, IArea } from 'treb-base-types';
import { MacroFunction } from 'treb-grid';
import { SerializedNamedExpression } from 'treb-grid';

import { ResultContainer } from './pack-results';

/*
export interface TrialData {
  results: any;
  trials: number;
  elapsed: number;
}
*/

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
  seed?: number;
  sheets: any[];
  additional_cells?: ICellAddress[];
  named_ranges?: {[index: string]: IArea};
  named_expressions?: SerializedNamedExpression[];
  macro_functions?: MacroFunction[];
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
  trial_data: ResultContainer; // TrialData;
}

export interface CompleteMessage {
  type: 'complete';
  trial_data: ResultContainer; // TrialData;
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

