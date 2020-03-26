
import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';
import { MCCalculator, CalculationWorker, WorkerMessage } from 'treb-mc';
import { IsCellAddress, Localization, Style, ICellAddress, Area, IArea } from 'treb-base-types';
import { Grid, GridEvent, SerializeOptions, Annotation,
  BorderConstants, SheetChangeEvent, GridOptions } from 'treb-grid';
import { EmbeddedSheetEvent, TREBDocument, SaveFileType } from './types';
import { EmbeddedSpreadsheetOptions, DefaultOptions } from './options';

// config
// import * as build from '@root/package.json';
import * as build from '../../package.json';

export class EmbeddedSpreadsheet extends EmbeddedSpreadsheetBase {

  /* for storing; also inefficient. pack, zip, do something. */
  protected last_simulation_data: any = {};

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
  private worker?: CalculationWorker;

  /**
   * some local cleanup, gets called in various import/load/reset functions
   */
  public ResetInternal() {
    super.ResetInternal();
    this.FlushSimulationResults(); // used to be in Reset()
  }

  /**
   * returns simulation data for a cell (if any)
   */
  public SimulationData(address: string | ICellAddress) {
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

  public FlushSimulationResults() {
    this.calculator.FlushSimulationResults();
    this.last_simulation_data = {};
  }

  public SerializeDocument(preserve_simulation_data = true, rendered_values = true,
    additional_options: SerializeOptions = {}) {

    const serialized = super.SerializeDocument(preserve_simulation_data, rendered_values, additional_options);

    if (preserve_simulation_data) {

      // it might be useful to prune this a bit, specifically to prune
      // results that are not referenced. can we use the graph to do that?

      serialized.simulation_data = {
        elapsed: this.last_simulation_data.elapsed,
        trials: this.last_simulation_data.trials,
        results: (this.last_simulation_data.results || []).map((result: any) => {
          return this.ArrayBufferToBase64(result);
        }),
      };

    }

    return serialized;

  }

  /** mc-specific dialog; has constant string */
  public UpdateMCDialog(progress = 0, text?: string) {
    if (typeof text === 'undefined') {
      text = `${progress}%`;
    }
    this.UpdateDialog(`Running Monte Carlo Simulation...\n${text}`);
  }

  /**
   * run MC simulation, in worker. worker is now demand-loaded, so first
   * pass may be slow.
   */
  public async RunSimulation(trials = 5000, lhs = true) {

    this.UpdateMCDialog(0, 'Initializing');

    const worker_name = (build as any)['build-entry-points']['calculation-worker'];
    if (!this.worker) {
      this.worker = await this.LoadWorker(worker_name);

      this.worker.onmessage = (event) => {
        const message = event.data as WorkerMessage;
        this.HandleWorkerMessage(message);
      };

      this.worker.onerror = (event) => {
        console.error('worker error');
        console.info(event);
      };
    }

    if (!this.worker) {
      this.ShowDialog(true, 'Calculation failed', 2500);
      throw new Error('worker not initialized');
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

    this.worker.postMessage({
      type: 'configure',
      locale: Localization.locale,
      sheets: this.grid.model.sheets.map((sheet) => {
        return sheet.toJSON({
          rendered_values: true, // has a different name, for some reason
          preserve_type: true,
        });
      }),
      named_ranges: this.grid.model.named_ranges.Serialize(),
      additional_cells,
    });

    this.worker.postMessage({
      type: 'start', trials, lhs,
    });

    await new Promise((resolve) => {
      this.simulation_resolution.push(resolve);
    });

  }

  protected InitCalculator() {
    this.calculator = new MCCalculator();
  }

  protected ImportDocumentData(data: TREBDocument, override_sheet?: string) {

    super.ImportDocumentData(data, override_sheet);

    if (data.simulation_data) {
      this.last_simulation_data = data.simulation_data;
      this.last_simulation_data.results =
        (this.last_simulation_data.results || []).map((entry: any) => {
          const binary = Base64.atob(entry);
          const len = binary.length;
          const u8 = new Uint8Array(len);
          for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
          return u8.buffer;
        });

      this.calculator.UpdateResults(this.last_simulation_data, this.grid.model, false);
    }
    else {
      this.FlushSimulationResults();
    }

  }

  /**
   * rx handler for worker messages
   */
  private HandleWorkerMessage(message: WorkerMessage) {

    switch (message.type) {
      case 'update':
        this.UpdateMCDialog(Number(message.percent_complete || 0));
        this.last_simulation_data = message.trial_data;
        this.calculator.UpdateResults(message.trial_data);
        this.Recalculate();

        // not actually possible for this not to exist at this
        // point -- is there a way to express that in ts?

        if (this.worker) this.worker.postMessage({ type: 'step' });
        break;

      case 'progress':
        this.UpdateMCDialog(Number(message.percent_complete || 0));
        break;

      case 'complete':
        this.last_simulation_data = message.trial_data;
        requestAnimationFrame(() => {
          this.calculator.UpdateResults(message.trial_data);
          this.Recalculate().then(() => this.Focus());
          setTimeout(() => {
            this.ShowDialog(false);
            this.Publish({ type: 'simulation-complete' });

            for (const entry of this.simulation_resolution) {
              entry.call(this);
            }
            this.simulation_resolution = [];

          }, 500);
        });
        break;

      default:
        console.info('unhandled worker message', message);
        break;

    }

  }

  private ArrayBufferToBase64(data: ArrayBuffer): string {
    return this.Uint8ToBase64(new Uint8Array(data, 0));
  }

  private Uint8ToBase64(data: Uint8Array): string {
    const chunks = [];
    const block = 0x8000;
    for (let i = 0; i < data.length; i += block) {
      chunks.push(String.fromCharCode.apply(null, Array.from(data.subarray(i, i + block))));
    }
    return Base64.btoa(chunks.join(''));
  }


}
