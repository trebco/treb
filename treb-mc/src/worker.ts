
/**
 * worker for simulation
 */

import type { WorkerMessage } from './worker-types';
import { Localization, ICellAddress } from 'treb-base-types';

import { DataModel } from 'treb-grid/src/types/data_model';
import { Sheet } from 'treb-grid/src/types/sheet';
import { NamedRangeCollection } from 'treb-grid/src/types/named_range';
import { MCCalculator } from './simulation-calculator';
import { GraphStatus } from 'treb-calculator/src/dag/graph';

export class WorkerImpl {

  protected trials = 0;
  protected lhs = false;

  /*
  protected data_model: DataModel = {
    // active_sheet: Sheet.Blank({}),
    sheets: [Sheet.Blank({})],
    named_ranges: new NamedRangeCollection(),
    named_expressions: {},
    macro_functions: {},
    view_count: 0,
    theme_style_properties: {},
  };
  */
  protected data_model = new DataModel();

  protected screen_updates = false;
  protected calculator = new MCCalculator(this.data_model);
  protected start_time = 0;
  protected seed?: number;

  protected additional_cells: ICellAddress[] = [];

  /** iteration count for screen updating */
  protected iteration = 0;

  constructor(protected base_worker: Worker) {
  }

  public Timestamp(): number {
    if (self.performance) return performance.now();
    return Date.now();
  }

  public OnMessage(event: MessageEvent): void {
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

      this.data_model.sheets.Assign(message.sheets.map((sheet) => Sheet.FromJSON(sheet, {})));

      // old
      // this.data_model.sheets = message.sheets.map((sheet) => 
      //  Sheet.FromJSON(sheet, {}));

      // older
      // this.data_model.active_sheet = this.data_model.sheets.list[0];

      if (message.additional_cells) {
        this.additional_cells = message.additional_cells;
      }
      this.data_model.named_ranges.Deserialize(message.named_ranges); // implicit reset

      // this.data_model.macro_functions = {};
      this.data_model.macro_functions.clear();
      if (message.macro_functions) {
        for (const macro_function of message.macro_functions) {
          this.data_model.macro_functions.set(macro_function.name.toUpperCase(), macro_function);
        }
      }

      // this.data_model.named_expressions = {};
      this.data_model.macro_functions.clear();
      if (message.named_expressions) {
        for (const pair of message.named_expressions) {
          const parse_result = this.calculator.parser.Parse(pair.expression);
          if (parse_result.valid && parse_result.expression) {
            this.data_model.named_expressions.set(pair.name, parse_result.expression);
          }
        }
      }

      // seed is optional. we will use it in the Init method, so we
      // store it before running, but then we will drop it.

      this.seed = message.seed;

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

  protected Post(message: WorkerMessage, transfer?: any): void {
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
  protected SimulationStep(): void {
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
      // cells: this.data_model.active_sheet.cells.toJSON(), // this.cells.toJSON(),
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
  protected Start(): void {

    if (!this.trials) {
      throw(new Error('invalid trial count'));
    }
    else {
      // console.info(`running simulation with ${this.trials} trials, lhs=${this.lhs}${this.screen_updates ? ' (stepped)' : ''}`);
    }

    this.start_time = this.Timestamp(); // performance.now();

    // first, full calc

    const status = this.calculator.InitSimulation(
      this.trials, 
      this.lhs, 
      this.data_model, 
      this.additional_cells,
      this.seed);

    this.seed = undefined;  // clear 

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
  protected Finish(): void {

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
