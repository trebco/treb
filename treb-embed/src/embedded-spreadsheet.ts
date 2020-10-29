
import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';
import { ResultContainer, MCCalculator, CalculationWorker, WorkerMessage } from 'treb-mc';
// import { ResultContainer } from 'treb-calculator';
import { Localization, ICellAddress } from 'treb-base-types';
import { SerializeOptions, MacroFunction } from 'treb-grid';
import { TREBDocument } from './types';
import * as Base64JS from 'base64-js';

import * as PackResults from 'treb-mc/src/pack-results';

// config
import * as build from '../../package.json';
import { DialogType } from './progress-dialog';
import { Calculator } from 'treb-calculator/src';
// import { Util } from 'riskampjs-mc';

export class EmbeddedSpreadsheet extends EmbeddedSpreadsheetBase {

  /* for storing; also inefficient. pack, zip, do something. */
  protected last_simulation_data?: ResultContainer;

  protected calculator!: MCCalculator;

  /**
   * these (practically speaking, there should only be one) are resolve()
   * functions from running simulations. when a simulation is complete or
   * canceled, we will resolve and clear the list.
   */
  private simulation_resolution: Array<() => void> = [];

  /**
   * calculation worker (no longer using worker-loader)
   *
   * NOTE: why is this managed by this class, and not by calculator?
   * it seems like that would better encapsulate the calculation.
   */
  // private worker?: CalculationWorker;
  private workers: CalculationWorker[] = [];

  private simulation_status = { 
    running: false,
    threads: 0,
    results: [] as ResultContainer[],
    completed: 0,
    progress: [] as number[],
    aggregate_progress: 0,
  };

  /**
   * some local cleanup, gets called in various import/load/reset functions
   */
  public ResetInternal(): void {
    super.ResetInternal();
    this.FlushSimulationResults(); // used to be in Reset()
  }

  /**
   * returns simulation data for a cell (if any)
   * 
   * this is an API method? (...)
   */
  public SimulationData(address: string | ICellAddress): number[]|Float64Array|undefined {
    address = this.EnsureAddress(address);
    if (!address.sheet_id) {
      address.sheet_id = this.grid.model.active_sheet.id;
    }

    const data = this.calculator.GetResults();
    if (!data) return undefined;
    if (!data[address.sheet_id]) return undefined;
    if (!data[address.sheet_id][address.column]) return undefined;
    const cell = data[address.sheet_id][address.column][address.row];
    if (cell) {

      // legacy support. will need a polyfill regardless for Array.from
      return Array.isArray(cell) ? cell.slice(0) : Array.from(cell);
    }
    return undefined;
  }

  public FlushSimulationResults(): void {
    this.calculator.FlushSimulationResults();
    this.last_simulation_data = undefined;
  }

  public SerializeDocument(
      preserve_simulation_data = true, 
      rendered_values = true,
      additional_options: SerializeOptions = {}
      ): TREBDocument {

    const serialized = super.SerializeDocument(preserve_simulation_data, rendered_values, additional_options);

    if (preserve_simulation_data && this.last_simulation_data) {

      // it might be useful to prune this a bit, specifically to prune
      // results that are not referenced. can we use the graph to do that?

      serialized.simulation_data = {
        elapsed: this.last_simulation_data.elapsed,
        trials: this.last_simulation_data.trials,
        results: (this.last_simulation_data.results || []).map(result => {
          return Base64JS.fromByteArray(new Uint8Array(result));
        }),
      };

    }

    return serialized;

  }

  /* * mc-specific dialog; has constant string * /
  public UpdateMCDialog(progress = 0, text?: string, show = false) {
    if (typeof text === 'undefined') {
      text = `${progress}%`;
    }
    if (show) {
      this.dialog?.ShowProgressDialog(`Running Monte Carlo Simulation...`, progress);
    }
    else {
      this.dialog?.Update(`Running Monte Carlo Simulation...`, progress);
    }
  }
  */

  /**
   * init workers. we have a separate method so we can warm start
   * on load, if desired. also you can re-init... 
   * 
   * FIXME: should globalize these? if we do that, the "running" flag
   * needs to be similarly global...
   */
  public async InitWorkers(max = this.options.max_workers): Promise<void> {

    max = max || 1; // could be undefined? (...)

    if (this.workers.length) {
      for (const worker of this.workers) {
        worker.terminate();
      }
      this.workers = [];
    }

    const worker_name = build['build-entry-points']['calculation-worker'];
    const thread_count = Math.min(navigator.hardwareConcurrency || 1, max);

    console.info(`creating ${thread_count} thread${thread_count === 1 ? '' : 's'}`);

    for (let i = 0; i < thread_count; i++) {

      this.workers[i] = await this.LoadWorker(worker_name);

      this.workers[i].onmessage = (event) => {
        const message = event.data as WorkerMessage;
        this.HandleWorkerMessage(message, i);
      };

      this.workers[i].onerror = (event) => {
        console.error(`worker error (worker #${i})`);
        console.info(event);

        const message = event.message || 'Worker error.';

        this.dialog?.ShowDialog({
          title: 'Calculation failed',
          message,
          close_box: true,
          type: DialogType.error,
          timeout: 3000,
        });

        // flush
        for (const entry of this.simulation_resolution) {
          entry.call(this);
        }
        this.simulation_resolution = [];
        this.simulation_status.running = false;
        for (const worker of this.workers) {
          worker.terminate();
        }
        this.workers = [];

      };

    }

  }

  /**
   * run MC simulation, in worker. worker is now demand-loaded, so first
   * pass may be slow.
   */
  public async RunSimulation(trials?: number, lhs?: boolean, stepped?: boolean): Promise<void> {
    //public async RunSimulation(trials = 5000, lhs = true, stepped = false): Promise<void> {

    // parameters derived from options, if present, but keep defaults for backcompat

    if (typeof trials === 'undefined') {
      trials = this.options.default_trials || 5000;
    }
    if (typeof lhs === 'undefined') {
      lhs = true;
    }
    if (typeof stepped === 'undefined') {
      stepped = !!this.options.screen_updates; // default missing so falsy
    }

    if (this.simulation_status.running) {
      throw new Error('simulation already running');
    }

    // this.UpdateMCDialog(0, 'Initializing', true);
    this.dialog?.ShowDialog({
      // progress_bar: true,
      // progress: 0,
      title: 'Running Monte Carlo simulation',
      message: 'Starting',
      // type: DialogType.info,
    }).then(() => {
      if (this.simulation_status.running) {
        this.AbortSimulation();
      }
    });

    if (!this.workers.length) {
      try {
        await this.InitWorkers();
      }
      catch(err) {
        this.dialog?.ShowDialog({
          title: 'Calculation failed',
          message: 'Worker not initialized.',
          close_box: true,
          type: DialogType.error,
          timeout: 3000,
        });
        throw new Error('worker not initialized');
      }
    }

    if (!this.workers[0]) {
      this.dialog?.ShowDialog({
        title: 'Calculation failed',
        message: 'Worker not initialized.',
        close_box: true,
        type: DialogType.error,
        timeout: 3000,
      });
      throw new Error('worker not initialized');
    }

    /*
    if (stepped && this.workers.length > 1) {
      this.dialog?.ShowDialog({
        title: 'Calculation failed',
        message: 'Stepped simulation does support multiple workers.',
        close_box: true,
        type: DialogType.error,
        timeout: 3000,
      });
      throw new Error('invalid configiration');
    }
    */

    this.simulation_status.running = true;
    this.simulation_status.threads = this.workers.length;
    this.simulation_status.progress = [];
    this.simulation_status.results = [];
    this.simulation_status.aggregate_progress = 0;
    this.simulation_status.completed = 0;

    for (let i = 0; i < this.workers.length; i++) {
      this.simulation_status.progress.push(0);
    }

    // NOTE: accessing grid.cells, find a better approach [??]

    // let additional_cells =  this.additional_cells.slice(0);
    let additional_cells: ICellAddress[] = [];

    // add any required additional collector cells from annotations (charts)

    for (const annotation of this.grid.model.active_sheet.annotations) {
      if (annotation.formula) {
        additional_cells = additional_cells.concat(
          this.calculator.MetadataReferences(annotation.formula));
      }
    }

    additional_cells = this.calculator.FlattenCellList(additional_cells);

    let macro_functions: MacroFunction[] | undefined;

    // when passing in macro functions, we have to be sure we don't try
    // to pass any bound expressions (closures) that get attached. we could
    // parse on the receiving side, but this saves that work... not sure it's
    // clean, though.

    // FIXME: if you're cloning, just clone the whole thing at once.

    if (this.grid.model.macro_functions) {
      macro_functions = [];
      const keys = Object.keys(this.grid.model.macro_functions);
      for (const key of keys) {
        const macro_function = this.grid.model.macro_functions[key];
        macro_functions.push(JSON.parse(JSON.stringify(macro_function)));
      }
    }

    for (const worker of this.workers) {
      worker.postMessage({
        type: 'configure',
        locale: Localization.locale,
        sheets: this.grid.model.sheets.map((sheet) => {
          return sheet.toJSON({
            rendered_values: true, // has a different name, for some reason
            preserve_type: true,
          });
        }),
        named_ranges: this.grid.model.named_ranges.Serialize(),
        macro_functions,
        additional_cells,
      });
    }

    // const per_thread = Math.floor(trials / this.workers.length);
    // const last_thread = trials - (per_thread * (this.workers.length - 1));
    // console.info('per', per_thread, 'last', last_thread);

    // new algo for splitting trials. this is WAY over-optimizing. 
    // (but that uneven split was irritating).

    let remaining = trials;
    let count = this.workers.length;

    for (const worker of this.workers) {

      const trials = Math.floor(remaining/count--);

      worker.postMessage({
        type: 'start', 
        trials,
        // trials: worker === this.workers[0] ? last_thread : per_thread, 
        lhs,
        screen_updates: stepped,
      });

      remaining -= trials;

    }

    await new Promise((resolve) => {
      this.simulation_resolution.push(resolve);
    });

  }

  /**
   * overload for MC calculator replaces base calculator
   */
  protected InitCalculator(): Calculator {
    return new MCCalculator();
  }

  protected ImportDocumentData(data: TREBDocument, override_sheet?: string): void {

    super.ImportDocumentData(data, override_sheet);

    if (data.simulation_data) {
      this.last_simulation_data = data.simulation_data;
      this.last_simulation_data.results =
        (this.last_simulation_data.results || []).map((entry) => {
          return Base64JS.toByteArray(entry as any).buffer;
        });
      this.calculator.UpdateResults(this.last_simulation_data, this.grid.model, false);
    }
    else {
      this.FlushSimulationResults();
    }

  }

  /**
   * splitting into a separate method to remove code duplication
   */
  private UpdateProgress(value: number, index: number) {

    this.simulation_status.progress[index] = value || 0;

    const progress = Math.round(
      this.simulation_status.progress.reduce((a, b) => a + b, 0) / this.simulation_status.threads);
    
    if (progress !== this.simulation_status.aggregate_progress) {
      this.simulation_status.aggregate_progress = progress;            
      // this.UpdateMCDialog(progress);

      this.dialog?.Update({
        message: `${progress}% complete`,
      });
 

      this.Publish({type: 'simulation-progress', progress});
    }

  }

  /**
   * rx handler for worker messages
   */
  private HandleWorkerMessage(message: WorkerMessage, index: number) {

    switch (message.type) {
      case 'update':

        // throw new Error('not implemented for multithread (atm)');

        /** temp
        this.UpdateMCDialog(Number(message.percent_complete || 0));
        this.last_simulation_data = message.trial_data;
        this.calculator.UpdateResults(message.trial_data);
        this.Recalculate();

        // not actually possible for this not to exist at this
        // point -- is there a way to express that in ts?

        if (this.workers[index]) this.workers[index].postMessage({ type: 'step' });
        temp **/

        this.UpdateProgress(message.percent_complete, index);
        this.simulation_status.results[index] = message.trial_data;
        this.last_simulation_data =
          PackResults.ConsolidateResults(this.simulation_status.results.filter(test => !!test));

        this.calculator.UpdateResults(this.last_simulation_data);
        this.Recalculate().then(() => {
          this.workers[index].postMessage({ type: 'step' });
          // if(!this.grid.headless) { this.Focus() }
        });          

        break;

      case 'progress':
        this.UpdateProgress(message.percent_complete, index);
        break;

      case 'complete':
        this.simulation_status.progress[index] = 100;

        // this was a handy way of checking if all results are in; but it 
        // breaks if we are using "stepped simulation", because we need
        // to populate the array ahead of time. note also that array methods
        // (e.g. "every", "some") won't work because they will skip empty
        // values. so we'll use an explicit counter, which is overkill but
        // will work well. (although you could use reduce to count...)
        //
        // actually using the explicit counter is probably the best way if 
        // you want to support multi-worker "stepped", which is silly

        // this.simulation_status.results.push(message.trial_data);
        this.simulation_status.results[index] = message.trial_data;
        this.simulation_status.completed++;

        if (this.simulation_status.completed === this.simulation_status.threads) {

          this.simulation_status.running = false;
          this.last_simulation_data =
            PackResults.ConsolidateResults(this.simulation_status.results);

          requestAnimationFrame(() => {
            this.calculator.UpdateResults(this.last_simulation_data);
            this.Recalculate().then(() => {
              if(!this.grid.headless) { this.Focus() }
            });

            setTimeout(() => {
              this.dialog?.HideDialog();
              this.Publish({ 
                type: 'simulation-complete',
                elapsed: this.last_simulation_data?.elapsed || 0,
                trials: this.last_simulation_data?.trials || 0,
                // threads: this.simulation_status.threads,
              });

              for (const entry of this.simulation_resolution) {
                entry.call(this);
              }
              this.simulation_resolution = [];

            }, 500); // 500ms? is this waiting for something?
          });
        }
        else {
          this.UpdateProgress(100, index);
        }
        break;

      default:
        console.info('unhandled worker message', message);
        break;

    }

  }

  protected AbortSimulation(): void {

    console.warn('aborting simulation');

    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];

    // FIXME: unify code w/ above

    this.simulation_status.running = false;
    // this.last_simulation_data =
    //  PackResults.ConsolidateResults(this.simulation_status.results);

    requestAnimationFrame(() => {
      //this.calculator.UpdateResults(this.last_simulation_data);
      this.Recalculate().then(() => {
        if(!this.grid.headless) { this.Focus() }
      });

      this.Publish({ type: 'simulation-aborted' });

      for (const entry of this.simulation_resolution) {
        entry.call(this);
      }
      this.simulation_resolution = [];

    });

  }


}
