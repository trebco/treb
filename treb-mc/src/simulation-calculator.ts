
// this will move to a new subdir eventually so we can enforce isolation

import { Calculator } from 'treb-calculator';

import { ICellAddress } from 'treb-base-types';

import { DataModel } from 'treb-grid/src/types/data_model';
import { GraphStatus } from 'treb-calculator/src/dag/graph';

import * as PackResults from './pack-results';
import { MCExpressionCalculator } from './simulation-expression-calculator';
import { SimulationResultsData, SimulationState } from './simulation-model';


export class MCCalculator extends Calculator {

  // FIXME: remove from calculator class
  // protected readonly simulation_model = new SimulationModel();

  // reference
  protected simulation_expression_calculator: MCExpressionCalculator;

  constructor(model: DataModel) {
    super(model);

    this.expression_calculator =
      this.simulation_expression_calculator = new MCExpressionCalculator(
        this.library,
        this.parser);

    // mc functions
    this.library.Register(this.simulation_expression_calculator.simulation_model.functions);

  }

  public InitSimulation(
    iterations: number,
    lhs: boolean,
    // cells: Cells,
    model: DataModel,
    additional_cells?: ICellAddress[],
    seed?: number): GraphStatus {

    const simulation_model = this.simulation_expression_calculator.simulation_model;

    simulation_model.iterations = iterations;
    simulation_model.results = [];
    simulation_model.lhs = lhs;
    simulation_model.correlated_distributions = {};

    if (typeof seed === 'number'){ 
      simulation_model.seed = seed;
    }

    // const cells = model.active_sheet.cells;

    // calling the flush method, instead of flushing tree directly,
    // will also set status -> OK. note that (atm, at least) we don't
    // need to deal with spreadsheet leaf nodes in the worker thread.

    this.Reset();
    // this.AttachData(model);
    // this.expression_calculator.SetModel(model);
    this.AttachModel();

    // add additional cells to monitor, but only if they actually
    // exist; otherwise they will generate calc errors. 
    //
    // cells passed as "additional cells" MUST HAVE SHEET ID (will throw)

    if (additional_cells && additional_cells.length) {
      for (const address of additional_cells) {

        if (!address.sheet_id) {
          throw new Error('additional cell passed without sheet id');
        }

        for (const sheet of this.model?.sheets || []) {
          if (sheet.id === address.sheet_id) {
            const cell = sheet.cells.GetCell(address, false);
            if (cell) {
              simulation_model.StoreCellResults(address);
            }
            break;
          }
        }

        /*
        const cell = cells.GetCell(address, false); // whoops
        if (cell) {
          simulation_model.StoreCellResults(address);
        }
        else console.info( 'Skipping empty cell', address);
        */

      }
    }

    this.RebuildGraph();

    if (this.LoopCheck()) {
      throw new Error('Loop (circular dependency) found in graph');
    }

    // NOTE: not dealing with annotations here. the rationale is that these
    // may have external function definitions, so we can't reliably get the
    // metadata. there should really be no reason to do this anyway... so
    // dropping annotations from simulation. someone else needs to get the
    // metadata for collecting results and pass it in (via additional_cells)

    // FIXME: consolidate with trial method

    simulation_model.state = SimulationState.Prep;
    simulation_model.iteration = 0;
    this.Recalculate();
    simulation_model.CorrelateDistributions();
    simulation_model.state = SimulationState.Simulation;

    return GraphStatus.OK; // result.status;

  }

  /**
   * returns simulation results. this is called after a simulation, results
   * will be returned from the worker(s) back to the main thread.
   */
  public GetResults(): SimulationResultsData {
    return this.simulation_expression_calculator.simulation_model.results;
  }


  /**
   * runs a single iteration in a simulation. calculation is simpler because
   * we know that nothing has changed in the graph since the last calculation
   * (since we set up the graph). the only things that are going to be dirty
   * are the volatile cells, which set set explicitly.
   */
  public SimulationTrial(iteration: number) {

    const simulation_model = this.simulation_expression_calculator.simulation_model;

    simulation_model.iteration = iteration;

    // now handled in graph/calc via volatile and simulationvolatile
    // Model.volatile_functions.forEach((addr) => this.SetDirty(addr));

    // there's no loop check here because the graph can't change between
    // init() and here; although the loop check would theoretically short-
    // circuit anyway, since it's gated

    try {
      this.Recalculate();

      // FIXME: we should pull out index pairs once, then refer
      // to the list. while this probably isn't slow, it seems
      // unecessary.

      // tslint:disable-next-line:forin
      for (const id in simulation_model.results) {

        // we should validate this, but I don't want to do that on every
        // trial... can we precheck against collected cells, before running?
        // maybe in prep? (...)

        const cells = this.cells_map[id];

        // tslint:disable-next-line:forin
        for (const c in simulation_model.results[id]){
          const column = simulation_model.results[id][c];

          // tslint:disable-next-line:forin
          for (const r in column){

            const cell = cells.GetCell({row: Number(r), column: Number(c)});

            // it seems like this is a waste -- if the cell doesn't exist,
            // we should remove it from the list (or not add it in the first
            // place). that prevents it from getting tested every loop.

            if (cell){
              const value = cell.GetValue();
              switch (typeof value){
                case 'number': column[r][iteration] = value; break;
                case 'boolean': column[r][iteration] = value ? 1 : 0; break;
                default: column[r][iteration] = 0;
              }
            }
          }
        }
      }
      return { status: GraphStatus.OK, reference: null };
    }
    catch (err){
      console.info('calculation error trapped', err);
      return { status: GraphStatus.CalculationError, reference: null };
    }

  }


  /**
   * flattens results for passing to the main thread from worker
   */
  public FlattenedResults(): ArrayBuffer[] {

    const simulation_model = this.simulation_expression_calculator.simulation_model;

    // flatten into buffers
    const flattened: ArrayBuffer[] = [];

    // tslint:disable-next-line:forin
    for (const id in simulation_model.results) {

      // tslint:disable-next-line:forin
      for (const c in simulation_model.results[id]) {
        const column = simulation_model.results[id][c];

        // tslint:disable-next-line:forin
        for (const r in column) {
          flattened.push(PackResults.PackOne({
            row: Number(r), column: Number(c), sheet_id: Number(id), data: column[r] }).buffer);
        }
      }
    }
    return flattened;
  }

  /** basically set null results */
  public FlushSimulationResults(): void {
    const simulation_model = this.simulation_expression_calculator.simulation_model;

    simulation_model.results = [];
    simulation_model.elapsed = 0;
    simulation_model.trials = 0;
  }

  /** TODO */
  public ShiftSimulationResults(before_row: number, before_column: number, rows: number, columns: number) {
    // ...
  }

  /**
   * updates simulation results for watched cells. after a simulation,
   * these will generally come in from the worker thread. FIXME: move
   * worker in here?
   *
   * once these are set, simulation functions (e.g. mean) can return
   * results
   *
   * @param model model passed directly, in case the model has not yet
   * been set; we may need this for assigning simulation results from
   * older files.
   *
   * @param set_dirty ordinarily we would set the cell dirty, but on
   * load it may not yet be available, and we are going to mark it dirty
   * later anyway -- so pass false to skip.
   */
  public UpdateResults(data?: PackResults.ResultContainer, model = this.model, set_dirty = true){

    if (!model) {
      throw new Error('UpdateResults called without model');
    }

    const simulation_model = this.simulation_expression_calculator.simulation_model;

    if (!data) {
      simulation_model.results = [];
      simulation_model.elapsed = 0;
      simulation_model.trials = 0;
    }
    else {
      simulation_model.results = [];
      simulation_model.elapsed = data.elapsed;
      simulation_model.trials = data.trials;

      for (const result of data.results) {

        const entry = (result instanceof ArrayBuffer) ? PackResults.UnpackOne(new Float64Array(result)) : result;

        /** ?
        if (!entry.sheet_id) {
          entry.sheet_id = model.active_sheet.id;
        }
        */

        if (!simulation_model.results[entry.sheet_id]){
          simulation_model.results[entry.sheet_id] = [];
        }

        if (!simulation_model.results[entry.sheet_id][entry.column]) {
          simulation_model.results[entry.sheet_id][entry.column] = [];
        }

        simulation_model.results[entry.sheet_id][entry.column][entry.row] = entry.data as any;
        if (set_dirty) {
          this.SetDirty(entry);
        }

      }
    }
  }

  /*
   * no longer overloading. call flush explicitly. there are two reasons for
   * this: one, so we can stop overloading with a different signature; and two,
   * because there's a local cache in caller that needs to be handled, so
   * better to be explicit.
   *
   * OVERLOAD
   * resets graph and graph status
   *
   * this should not work... we have a different signature than the base
   * class method: shouldn't ts complain about that? not sure what the
   * correct thing is. even if it works, we should perhaps not do it.
   *
   * /
  public Reset(flush_results = true){

    super.Reset();

    if (flush_results){
      this.FlushSimulationResults(); // to prevent ghost data
    }

  }
  */

}
