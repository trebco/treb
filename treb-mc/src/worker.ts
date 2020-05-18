
/**
 * worker for simulation
 */

import { WorkerMessage } from './worker-types';
import { Localization, ICellAddress, Area } from 'treb-base-types';

// import { DataModel, Sheet, Annotation, NamedRangeCollection } from 'treb-grid';
// import { Annotation } from 'treb-grid/src/types/annotation';

import { DataModel } from 'treb-grid/src/types/data_model';
import { Sheet } from 'treb-grid/src/types/sheet';
import { NamedRangeCollection } from 'treb-grid/src/types/named_range';
import { MCCalculator } from './simulation-calculator';
import { GraphStatus } from '../../treb-calculator/src/dag/graph';

export class WorkerImpl {

  protected trials = 0;
  protected lhs = false;
  protected data_model: DataModel = {
    active_sheet: Sheet.Blank({}),
    sheets: [Sheet.Blank({})],
    // annotations: [],
    named_ranges: new NamedRangeCollection(),
    macro_functions: {},
  };
  protected screen_updates = false;
  protected calculator = new MCCalculator();
  protected start_time = 0;

  protected additional_cells: ICellAddress[] = [];

  /** iteration count for screen updating */
  protected iteration = 0;

  constructor(protected base_worker: Worker) {
  }

  public Timestamp(){
    if (self.performance) return performance.now();
    return Date.now();
  }

  public OnMessage(event: MessageEvent) {
    const message = event.data as WorkerMessage;
    if (!message) return;

    switch (message.type) {
    /*
    case WorkerMessageType.Extend:
      if (message.data) {
        if (message.data.path) {
          (self as any).importScripts(message.data.path);
          if ((self as any).RegisterCallback) {
            (self as any).RegisterCallback.call(this);
          }
        }
      }
      break;
      */

    case 'configure':
      if (message.locale && message.locale !== Localization.locale){
        Localization.UpdateLocale(message.locale);
        this.calculator.UpdateLocale();
      }

      this.data_model.sheets = message.sheets.map((sheet) => 
        Sheet.FromJSON(sheet, {}));
      this.data_model.active_sheet = this.data_model.sheets[0];

      if (message.additional_cells) {
        this.additional_cells = message.additional_cells;
      }
      this.data_model.named_ranges.Deserialize(message.named_ranges); // implicit reset

      this.data_model.macro_functions = {};
      if (message.macro_functions) {
        for (const macro_function of message.macro_functions) {
          this.data_model.macro_functions[macro_function.name.toUpperCase()] = macro_function;
        }
      }

      // ... macro functions ...

      break;

    case 'step':
      this.SimulationStep();
      break;

    case 'start':
      this.trials = message.trials || 1000;
      this.lhs = !!message.lhs;
      this.screen_updates = !!message.screen_updates;
      this.Start();
      break;
    }

  }

  protected Post(message: WorkerMessage, transfer?: any) {
    this.base_worker.postMessage(message, transfer);
  }

  /* *
   * generates flattened results suitable for passing to the main thread.
   * FIXME: move to calculator so we can hide simulation_model
   * /
  protected FlattenedResults(){

    // flatten into buffers
    const flattened: any[] = [];

    // tslint:disable-next-line:forin
    for (const c in this.calculator.simulation_model.results) {
      const column = this.calculator.simulation_model.results[c];

      // tslint:disable-next-line:forin
      for (const r in column) {
        flattened.push(PackResults.PackOne({
          row: Number(r), column: Number(c), data: column[r] }).buffer);
      }
    }

    return flattened;
  }
  */

  /**
   * runs a single step in a stepped simulation (used for screen updates)
   */
  protected SimulationStep(){
    if (this.iteration >= this.trials) return;

    this.calculator.SimulationTrial(this.iteration);
    const percent_complete = Math.floor(this.iteration / this.trials * 100);

    // last one

    if (++this.iteration === this.trials){
      this.Finish();
      return;
    }

    // otherwise, send intermediate

    // we shouldn't have to send this; we should be able to build it up.
    // not sure that it's worth writing the code to do that, though.

    const flattened = this.calculator.FlattenedResults();
    const elapsed = this.Timestamp() - this.start_time;

    this.Post({
      type: 'update',
      percent_complete,
      cells: this.data_model.active_sheet.cells.toJSON(), // this.cells.toJSON(),
      trial_data: {
        results: flattened,
        trials: this.iteration,
        elapsed,
      },
    }, flattened);

  }

  /**
   * starts the simulation. for screen updating, this will just run the
   * first iteration and then wait for subsequent calls. otherwise it
   * will loop through iterations until complete, and then call Finish().
   */
  protected Start() {

    if (!this.trials) throw(new Error('invalid trial count'));
    else console.info(`running simulation with ${this.trials} trials, lhs=${this.lhs}`);

    this.start_time = this.Timestamp(); // performance.now();

    // first, full calc

    const status = this.calculator.InitSimulation(this.trials, this.lhs, this.data_model, this.additional_cells);

    if (status !== GraphStatus.OK) throw(new Error('graph failed'));

    let percent_complete = 0;

    if (this.screen_updates) {
      this.iteration = 0;
      this.SimulationStep(); // first iteration
    }
    else {
      for (let i = 0; i < this.trials; i++) {
        this.calculator.SimulationTrial(i);
        const p = Math.floor(i / this.trials * 100);
        if ( p !== percent_complete) {
          percent_complete = p;
          this.Post({
            type: 'progress',
            percent_complete,
          });
        }
      }
      this.Finish();
    }

  }

  /**
   * simulation is complete; post a last progress message, then
   * send results.
   */
  protected Finish(){

    // because this will never get sent (floor):

    this.Post({
      type: 'progress',
      percent_complete: 100,
    });

    // now send results

    const flattened = this.calculator.FlattenedResults();
    const elapsed = this.Timestamp() - this.start_time;

    // FIXME: for IE (and edge?) we are probably going to have to convert
    // this to a non-typed array, or it will pass through all the indexes

    // return w/ transfer
    this.Post({
      type: 'complete',
      trial_data: {
        results: flattened,
        trials: this.trials,
        elapsed,
      },
    }, flattened);

  }

}
