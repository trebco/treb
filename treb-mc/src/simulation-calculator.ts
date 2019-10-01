
// this will move to a new subdir eventually so we can enforce isolation

import { Calculator } from '../../treb-calculator/src/calculator';
import { SimulationState } from './simulation-model';
import { ICellAddress, CellSerializationOptions } from 'treb-base-types';
import { DataModel } from '@root/treb-grid/src';
import { GraphStatus } from '../../treb-calculator/src/dag/graph';
import * as PackResults from '../../treb-calculator/src/pack-results';
import { MCExpressionCalculator } from './simulation-expression-calculator';

export class MCCalculator extends Calculator {

  // FIXME: remove from calculator class
  // protected readonly simulation_model = new SimulationModel();

  // reference
  protected simulation_expression_calculator: MCExpressionCalculator;

  constructor() {
    super();

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
    additional_cells?: ICellAddress[]) {

    const simulation_model = this.simulation_expression_calculator.simulation_model;

    simulation_model.iterations = iterations;
    simulation_model.results = [];
    simulation_model.lhs = lhs;
    simulation_model.correlated_distributions = {};

    const cells = model.sheet.cells;

    // calling the flush method, instead of flushing tree directly,
    // will also set status -> OK. note that (atm, at least) we don't
    // need to deal with spreadsheet leaf nodes in the worker thread.

    this.Reset();
    this.AttachData(model);
    this.expression_calculator.SetModel(model);

    // add additional cells to monitor, but only if they actually
    // exist; otherwise they will generate calc errors.

    if (additional_cells && additional_cells.length) {
      for (const address of additional_cells) {
        const cell = cells.GetCell(address, false);
        if (cell) {
          simulation_model.StoreCellResults(address);
        }
        // else console.info( 'Skipping empty cell', address);
      }
    }

    const json_options: CellSerializationOptions = {
      preserve_type: true,
      calculated_value: true,
    };

    const flat = cells.toJSON(json_options);
    const result = this.RebuildGraph(flat.data, {});

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

    return result.status;

  }

  /**
   * returns simulation results. this is called after a simulation, results
   * will be returned from the worker(s) back to the main thread.
   */
  public GetResults() {
    return this.simulation_expression_calculator.simulation_model.results;
  }


  /**
   * runs a single iteration in a simulation. calculation is simpler because
   * we know that nothing has changed in the graph since the last calculation
   * (since we set up the graph). the only things that are going to be dirty
   * are the volatile cells, which set set explicitly.
   */
  public SimulationTrial(iteration: number){

    if (!this.cells) throw(new Error('called trial without cells')); // this is an assert, right? should remove for prod

    const simulation_model = this.simulation_expression_calculator.simulation_model;

    simulation_model.iteration = iteration;

    // now handled in graph/calc via volatile and simulationvolatile
    // Model.volatile_functions.forEach((addr) => this.SetDirty(addr));

    try {
      this.Recalculate();

      // FIXME: we should pull out index pairs once, then refer
      // to the list. while this probably isn't slow, it seems
      // unecessary.

      // tslint:disable-next-line:forin
      for (const c in simulation_model.results){
        const column = simulation_model.results[c];

        // tslint:disable-next-line:forin
        for (const r in column){
          const cell = this.cells.GetCell({row: Number(r), column: Number(c)});

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

      return { status: GraphStatus.OK, reference: null };
    }
    catch (err){
      console.info('calculation error trapped', err);
      return { status: GraphStatus.CalculationError, reference: null };
    }

    // expand ranges [?]

  }


  /**
   * flattens results for passing to the main thread from worker
   */
  public FlattenedResults(){

    const simulation_model = this.simulation_expression_calculator.simulation_model;

    // flatten into buffers
    const flattened: any[] = [];

    // tslint:disable-next-line:forin
    for (const c in simulation_model.results) {
      const column = simulation_model.results[c];

      // tslint:disable-next-line:forin
      for (const r in column) {
        flattened.push(PackResults.PackOne({
          row: Number(r), column: Number(c), data: column[r] }).buffer);
      }
    }

    return flattened;
  }

  /** basically set null results */
  public FlushSimulationResults() {
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
   */
  public UpdateResults(data: any){
    const simulation_model = this.simulation_expression_calculator.simulation_model;

    simulation_model.results = [];
    simulation_model.elapsed = data.elapsed;
    simulation_model.trials = data.trials;

    data.results.map((result: any) => {
      const entry = (result instanceof ArrayBuffer) ? PackResults.UnpackOne(new Float64Array(result)) : result;
      if (!simulation_model.results[entry.column]) {
        simulation_model.results[entry.column] = [];
      }
      simulation_model.results[entry.column][entry.row] = entry.data;
      this.SetDirty(entry);
    });

  }

  /**
   * OVERLOAD
   * resets graph and graph status
   *
   * this should not work... we have a different signature than the base
   * class method: shouldn't ts complain about that? not sure what the
   * correct thing is. even if it works, we should perhaps not do it.
   *
   */
  public Reset(flush_results = true){

    this.status = GraphStatus.OK;
    this.FlushTree();
    this.full_rebuild_required = true;

    if (flush_results){
      this.FlushSimulationResults(); // to prevent ghost data
    }

  }


}