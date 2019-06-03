

export enum WorkerMessageType {
  Null = 0,
  Configure,
  Extend,
  Progress,
  Update,
  Step,
  Complete,
  Start,
  Cancel, // we can cancel by destroying the worker
}

export interface WorkerMessage {
  type: WorkerMessageType;
  data?: any;
}

export interface CalculationWorker extends Worker {
  postMessage: (message: WorkerMessage) => void;
}

