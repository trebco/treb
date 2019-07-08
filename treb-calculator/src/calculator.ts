
import { Localization, Cell, Cells, Area, ICellAddress, ValueType, CellSerializationOptions } from 'treb-base-types';
import { Parser, ExpressionUnit, DependencyList,
         DecimalMarkType, ArgumentSeparatorType, UnitAddress } from 'treb-parser';

import { Graph, GraphStatus } from './dag/graph';
import { SpreadsheetVertex, CalculationResult } from './dag/spreadsheet_vertex';
import { ExpressionCalculator } from './expression-calculator';
import * as Utilities from './utilities';

import { SimulationModel, SimulationState, RegisterSimlationFunctions } from './simulation-model';
import { FunctionLibrary, FunctionMap } from './function-library';

import { RegisterBaseFunctions } from './base-functions';

import * as PackResults from './pack-results';
import { DataModel } from '@root/treb-grid/src';

/**
 * options for unparsing (cleaning up) expressions
 */
interface UnparseOptions {

  /** insert "undefined" symbol for missing arguments */
  insert_undefined?: boolean;

  /** normalize addresses (just uppercase) */
  normalize_addresses?: boolean;

  /** convert booleans to TRUE and FALSE */
  normalize_booleans?: boolean;

  /**
   * insert canonical name (if available). this takes precedence
   * over function name capitalization, if both are set.
   */
  normalize_functions?: boolean;

  /** capitalize function names by default */
  default_capitalize_functions?: boolean;

  /** throw on call to unknown function */
  throw_on_invalid_function?: boolean;
}

export interface CalculationOptions {

  // at load, and potentially at other times as well, we don't
  // need to check static values. this will save time.

  formula_only?: boolean;

}

/**
 * Calculator now extends graph. there's a 1-1 relationship between the
 * two, and we wind up passing a lot of operations from one to the other.
 * this also simplifies the callback structure, as we can use local methods.
 *
 * NOTE: graph vertices hold references to cells. while that makes lookups
 * more efficient, it causes problems if you mutate the sheet (adding or
 * removing rows or columns).
 *
 * in that event, you need to flush the graph to force rebuilding references
 * (TODO: just rebuild references). after mutating the sheet, call
 *
 * Calculator.Reset();
 *
 */
export class Calculator extends Graph {

  // protected graph: Graph = new Graph(); // |null = null;

  protected status: GraphStatus = GraphStatus.OK;

  // FIXME: why is this a separate class? [actually is this a composition issue?]
  protected expression_calculator: ExpressionCalculator = new ExpressionCalculator();

  protected parser: Parser = new Parser();

  /** the next calculation must do a full rebuild -- set on reset */
  protected full_rebuild_required = false;

  protected library = new FunctionLibrary();

  /** FIXME visibility */
  public simulation_model = new SimulationModel();

  constructor() {
    super();
    this.UpdateLocale();

    RegisterBaseFunctions(this.library);
    RegisterSimlationFunctions(this.library, this.simulation_model);

  }

  /**
   * if locale has changed in Localization, update local resources.
   * this is necessary because (in chrome) worker doesn't get the system
   * locale properly (also, we might change it via parameter). we used to
   * just drop and reconstruct calculator, but we want to stop doing that
   * as part of supporting dynamic extension.
   */
  public UpdateLocale() {

    // don't assume default, always set

    if (Localization.decimal_separator === ',') {
      this.parser.decimal_mark = DecimalMarkType.Comma;
      this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
    }
    else {
      this.parser.decimal_mark = DecimalMarkType.Period;
      this.parser.argument_separator = ArgumentSeparatorType.Comma;
    }

    this.expression_calculator.UpdateLocale();

  }

  public SupportedFunctions(){

    const list = this.library.List();

    const function_list = Object.keys(list).map((key) => {
      let name = list[key].canonical_name;
      if (!name) name = key.replace(/_/g, '.');
      return {
        name,
        description: list[key].description,
        arguments: (list[key].arguments || []).map((argument) => {
          return { name: argument.name || '' };
        }),
      };
    });

    return function_list;

  }

  /**
   * dynamic extension
   * TODO: support updating AC (need grid change, possibly call from EmbeddedSheet)
   * FIXME: this is going to break in simulations (maybe not an issue?)
   */
  public RegisterFunction(map: FunctionMap) {

    for (const name of Object.keys(map)) {
      const descriptor = map[name];
      const original_function = descriptor.fn;

      // we don't bind to the actual context because that would allow
      // functions to change it, and potentially break subsequent functions
      // that rely on it. which is a pretty far-fetched scenario, but we might
      // as well protect against it.

      descriptor.fn = (...args: any[]) => {
        return original_function.apply({
          address: { ...this.simulation_model.address},
        }, args);
      };

      this.library.Register({[name]: descriptor});
    }

  }

  public InitSimulation(
      iterations: number,
      lhs: boolean,
      // cells: Cells,
      model: DataModel,
      additional_cells?: ICellAddress[] ){

    this.simulation_model.iterations = iterations;
    this.simulation_model.results = [];
    this.simulation_model.lhs = lhs;
    this.simulation_model.correlated_distributions = {};

    const cells = model.sheet.cells;

    // calling the flush method, instead of flushing tree directly,
    // will also set status -> OK. note that (atm, at least) we don't
    // need to deal with spreadsheet leaf nodes in the worker thread.

    this.Reset();
    this.AttachData(model);
    this.expression_calculator.SetModel(model, this.simulation_model, this.library);

    // add additional cells to monitor, but only if they actually
    // exist; otherwise they will generate calc errors.

    if (additional_cells && additional_cells.length){
      for (const address of additional_cells){
        const cell = cells.GetCell(address, false);
        if (cell) this.simulation_model.CellData(address);
        // else console.info( 'Skipping empty cell', address);
      }
    }

    const json_options: CellSerializationOptions = {
      preserve_type: true,
      calculated_value: true };

    const flat = cells.toJSON(json_options);
    const result = this.RebuildGraph(flat.data, {});

    // FIXME: consolidate with trial method

    this.simulation_model.state = SimulationState.Prep;

    this.simulation_model.iteration = 0;
    this.Recalculate();

    this.simulation_model.CorrelateDistributions();

    this.simulation_model.state = SimulationState.Simulation;

    return result.status;

  }

  /**
   * returns simulation results. this is called after a simulation, results
   * will be returned from the worker(s) back to the main thread.
   */
  public GetResults(){
    return this.simulation_model.results;
  }

  /**
   * wrapper method for calculation. this should be used for 1-time
   * calculations (i.e. not in a simulation).
   */
  public async Calculate(model: DataModel, area?: Area, options?: CalculationOptions){
    const result = await this.CalculateInternal(model, area, options);
    return result;
  }

  /**
   * runs a single iteration in a simulation. calculation is simpler because
   * we know that nothing has changed in the graph since the last calculation
   * (since we set up the graph). the only things that are going to be dirty
   * are the volatile cells, which set set explicitly.
   */
  public SimulationTrial(iteration: number){

    if (!this.cells) throw(new Error('called trial without cells'));

    this.simulation_model.iteration = iteration;

    // now handled in graph/calc via volatile and simulationvolatile
    // Model.volatile_functions.forEach((addr) => this.SetDirty(addr));

    try {
      this.Recalculate();

      // FIXME: we should pull out index pairs once, then refer
      // to the list. while this probably isn't slow, it seems
      // unecessary.

      // tslint:disable-next-line:forin
      for (const c in this.simulation_model.results){
        const column = this.simulation_model.results[c];

        // tslint:disable-next-line:forin
        for (const r in column){
          const cell = this.cells.GetCell({row: Number(r), column: Number(c)});
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

      return {status: GraphStatus.OK, reference: null};
    }
    catch (err){
      console.info('calculation error trapped', err);
      return {status: GraphStatus.CalculationError, reference: null};
    }
    // expand ranges


    return {status: GraphStatus.OK, reference: null};

  }

  /**
   * resets graph and graph status
   */
  public Reset(flush_results = true){
    this.status = GraphStatus.OK;
    this.FlushTree();
    this.full_rebuild_required = true;

    if (flush_results){
      this.FlushSimulationResults(); // to prevent ghost data
    }
  }

  /** basically set null results */
  public FlushSimulationResults() {
    this.simulation_model.results = [];
    this.simulation_model.elapsed = 0;
    this.simulation_model.trials = 0;
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

    this.simulation_model.results = [];
    this.simulation_model.elapsed = data.elapsed;
    this.simulation_model.trials = data.trials;

    data.results.map((result: any) => {
      const entry = (result instanceof ArrayBuffer) ? PackResults.UnpackOne(new Float64Array(result)) : result;
      if (!this.simulation_model.results[entry.column]) {
        this.simulation_model.results[entry.column] = [];
      }
      this.simulation_model.results[entry.column][entry.row] = entry.data;
      this.SetDirty(entry);
    });

  }

  /**
   * calculate an expression, optionally setting a fake cell address.
   * this may have weird side-effects.
   */
  public CalculateExpression(expression: ExpressionUnit, address: ICellAddress = {row: 0, column: 0}): any {
    return this.expression_calculator.Calculate(expression, address);
  }

  /*
  public StyleHints(expression: ExpressionUnit){

    let count = 0;
    let percent = 0;
    let currency = 0;
    let precision = 0;

    let area: Area|null = null;

    if (this.cells){
      if (expression.type === 'address'){
        area = new Area(expression);
      }
      if (expression.type === 'range'){
        area = new Area(expression.start, expression.end);
      }
      if (area) {
        this.cells.IterateArea(area, (cell) => {
          count++;
          if (cell.style) {
            if (cell.style.percent) percent++;
            if (cell.style.currency) currency++;
            precision += (cell.style.precision || 0);
          }
        });
      }
    }

    return {
      percent: (count && (percent / count > .5)),
      currency: (count && (currency / count > .5)),
      precision: (count ? Math.round(precision / count) : 0),
    };

  }
  */

  /**
   * rebuild the graph, and set cells as clean. the vertices need internal
   * references to the calculated value, so that's set via the vertex method.
   *
   * we also need to manage the list of volatile cells, which is normally
   * built as a side-effect of calculation.
   */
  public RebuildClean(model: DataModel) {

    const json_options: CellSerializationOptions = {
      preserve_type: true,
      calculated_value: true };

    const cells = model.sheet.cells;

    this.full_rebuild_required = false; // unset
    const flat = cells.toJSON(json_options);

    this.AttachData(model);
    this.expression_calculator.SetModel(model, this.simulation_model, this.library);

    const result = this.RebuildGraph(flat.data, {});

    this.status = result ? result.status : GraphStatus.OK;

    if (this.status !== GraphStatus.OK){
      console.error( 'Loop detected, stopping');
      return result;
    }
    else {
      for (const vertex of this.dirty_list) {
        vertex.TakeReferenceValue();
        if (this.CheckVolatile(vertex)) this.volatile_list.push(vertex);
      }
      this.dirty_list = []; // reset, essentially saying we're clean
    }

  }

  /**
   * if this is a known function and that function provides a canonical name,
   * returns that. otherwise (optionally) UPPER-CASES the function name.
   */
  protected NormalizeFunctionCall(name: string, options: UnparseOptions) {

    if (options.normalize_functions){
      // const check: DecoratedFunction = SpreadsheetFunctions[name.toLowerCase()];
      // if (check){
      //   if (check.canonical_name) return check.canonical_name;
      // }
      const check = this.library.Get(name);
      if (check.canonical_name) {
        return check.canonical_name;
      }

    }
    if (options.default_capitalize_functions) return name.toUpperCase();
    return name;
  }

  /** named range support */
  protected NamedRangeToAddressUnit(address: ICellAddress, label: string, id: number, position: number) {
    return {
      type: 'address',
      row: address.row,
      column: address.column,
      label,
      id,
      position,
    } as UnitAddress;
  }

  protected RebuildDependencies(unit: ExpressionUnit, dependencies: DependencyList){

    switch (unit.type){

      case 'literal':
      case 'missing':
      case 'operator':
        return;

      case 'identifier':
        {
          if (!this.model) return;
          const normalized = unit.name.toUpperCase();
          // const named_range = this.model.sheet.named_ranges[normalized];
          const named_range = this.model.sheet.named_ranges.Get(normalized);
          if (named_range) {
            if (named_range.count === 1) {
              dependencies.addresses[normalized] =
                this.NamedRangeToAddressUnit(named_range.start, normalized,
                  unit.id, unit.position);
            }
            else {
              dependencies.ranges[normalized] = {
                type: 'range',
                start: this.NamedRangeToAddressUnit(named_range.start, normalized,
                  unit.id, unit.position),
                end: this.NamedRangeToAddressUnit(named_range.end, normalized,
                  unit.id, unit.position),
                label: normalized,
                id: unit.id,
                position: unit.position,
              };
            }
          }
        }
        return;

      case 'address':
        dependencies.addresses[unit.label] = unit;
        return; // this.AddressLabel(unit, offset);

      case 'range':
        dependencies.ranges[unit.start.label + ':' + unit.end.label] = unit;
        return;

      case 'unary':
        this.RebuildDependencies(unit.operand, dependencies);
        return;

      case 'binary':
        this.RebuildDependencies(unit.left, dependencies);
        this.RebuildDependencies(unit.right, dependencies);
        return;

      case 'group':
        unit.elements.forEach((element) => this.RebuildDependencies(element, dependencies));
        return;

      case 'call':

        // this is where we diverge. if there's a known function that has
        // an "address" parameter, we don't treat it as a dependency. this is
        // to support our weird MV syntax (weird here, but useful in Excel).

        const args: ExpressionUnit[] = unit.args.slice(0);
        // const func = SpreadsheetFunctions[unit.name.toLowerCase().replace(/\./g, '_')];
        const func = this.library.Get(unit.name);
        if (func){
          if (func.address && func.address.length){
            func.address.forEach((index) => args[index] = {type: 'missing', id: -1});
          }
        }
        args.forEach((arg) => this.RebuildDependencies(arg, dependencies));

        break;

    }
  }

  /**
   * rebuild the graph; parse expressions, build a dependency map,
   * initialize edges between nodes.
   */
  protected RebuildGraph(data: any[], options: CalculationOptions = {}):
      {status: GraphStatus, reference?: ICellAddress} {

    // we're finishing the dep/dirty check so we don't miss something
    // later, but we won't add the loop and we won't calculate.

    let global_status = GraphStatus.OK;
    let initial_reference: ICellAddress|null = null;

    for (const cell of data){

      // array head
      if (cell.area && cell.area.start.column === cell.column && cell.area.start.row === cell.row ){
        for (let c = cell.area.start.column; c <= cell.area.end.column; c++ ){
          for (let r = cell.area.start.row; r <= cell.area.end.row; r++ ){
            if (c !== cell.area.start.column && r !== cell.area.start.row){
              this.ResetInbound({column: c, row: r});
              const status = this.AddEdge(cell, {column: c, row: r});
              if (status !== GraphStatus.OK) {
                global_status = status;
                if (!initial_reference) initial_reference = {column: cell.column, row: cell.row};
              }
            }
            this.SetDirty(cell);
          }
        }
      }

      // formula?
      if (cell.type === ValueType.formula) {

        this.ResetInbound(cell, true); // NOTE: sets dirty
        const parse_result = this.parser.Parse(cell.value);

        // we have a couple of "magic" functions that can have loops
        // but shouldn't trigger circular references. we need to check
        // for those here...

        const new_dependencies: DependencyList = {addresses: {}, ranges: {}};
        if (parse_result.expression) {
          this.RebuildDependencies(parse_result.expression, new_dependencies);
        }

        // for (const unit of Object.values(new_dependencies.ranges)){
        for (const key of Object.keys(new_dependencies.ranges)){
          const unit = new_dependencies.ranges[key];
          const range = new Area(unit.start, unit.end);
          range.Iterate((address: ICellAddress) => {
            const status = this.AddEdge(address, cell);
            if (status !== GraphStatus.OK) {
              global_status = status;
              if (!initial_reference) initial_reference = {column: cell.column, row: cell.row};
            }
          });
        }

        // for (const address of Object.values(new_dependencies.addresses)){
        for (const key of Object.keys(new_dependencies.addresses)){
          const address = new_dependencies.addresses[key];
          const status = this.AddEdge(address, cell);
          if (status !== GraphStatus.OK) {
            global_status = status;
            if (!initial_reference) initial_reference = {column: cell.column, row: cell.row};
          }
        }

        const vertex = this.GetVertex(cell);
        if (vertex) {
          vertex.expression = parse_result.expression || {type: 'missing', id: -1};
          vertex.expression_error = !parse_result.valid;
        }

      }
      else if (cell.value !== cell.calculated && !options.formula_only){
        this.ResetInbound(cell, true); // NOTE: sets dirty
      }
      else if (cell.type === ValueType.undefined){

        // if we get here, it means that this cell was cleared but is not
        // 'empty'; in practice, that means it has a merge cell. reset inbound
        // and set dirty.

        // is this unecessarily flagging a number of cells? (...)

        this.ResetInbound(cell, true);
      }

    }

    return {status: global_status, reference: initial_reference || undefined}; // no loops
  }

  protected IsNativeOrTypedArray(val: any){
    return Array.isArray(val) || (val instanceof Float64Array) || (val instanceof Float32Array);
  }

  protected SpreadCallback(vertex: SpreadsheetVertex, value: any) {

    if (!this.cells) throw(new Error('called spread without cells'));

    if (!vertex || !vertex.reference) return;

    const ref = vertex.reference.area;
    let type: string = typeof value;
    let dims = 2;

    const calculation_error = (typeof value === 'object' && value.error);

    // mx1

    if (!calculation_error && type === 'object' && value.data){
      if (this.IsNativeOrTypedArray(value.data)){
        type = 'array';
        value = Utilities.TransposeArray(value.data);
      }
      else {
        type = 'array';
        value = [[''].concat(value.rownames)].concat(value.colnames.map((name: any) => {
          return [name].concat(value.data[name]);
        }));
      }
    }
    else if (this.IsNativeOrTypedArray(value)){
      value = Utilities.TransposeArray(value);
      type = 'array';
      dims = 1;
    }

    const area = vertex.reference.area;
    if (area){
      if (type === 'array' ){

        if (dims === 1){
          let row = area.start.row;
          let column = area.start.column;
          for (let r = 0; r < value.length && r < area.rows; r++, row++ ){
            if (this.IsNativeOrTypedArray(value[r])){
              for (let c = 0; c < value[r].length && c < area.columns; c++, column++ ){
                this.cells.data2[row][column].SetCalculatedValueOrError(value[r][c]);
              }
              column = area.start.column;
            }
            else this.cells.data2[row][column].SetCalculatedValueOrError(value[r]);
          }
        }
        else {
          for (let c = value.length; c < area.columns; c++ ) value[c] = []; // padding columns for loop
          for (let c = 0, column = area.start.column; c < area.columns; c++, column++ ){
            for (let r = 0, row = area.start.row; r < area.rows; r++, row++ ){
              this.cells.data2[row][column].SetCalculatedValueOrError(value[c][r]);
            }
          }
        }
      }
      else {

        // test before loops
        if (calculation_error) {
          for (let c = area.start.column; c <= area.end.column; c++){
            for (let r = area.start.row; r <= area.end.row; r++){
              this.cells.data2[r][c].SetCalculationError(value.error);
            }
          }
        }
        else {
          const value_type = Cell.GetValueType(value);
          for (let c = area.start.column; c <= area.end.column; c++){
            for (let r = area.start.row; r <= area.end.row; r++){
              this.cells.data2[r][c].SetCalculatedValue(value, value_type);
            }
          }
        }
      }
    }

    // console.info("Spread array value", value, vertex.reference_)
  }

  /**
   * check if a cell is volatile. normally this falls out of the calculation,
   * but if we build the graph and set values explicitly, we need to check.
   */
  protected CheckVolatile(vertex: SpreadsheetVertex) {
    if (!vertex.expression || vertex.expression_error) return false;
    return this.expression_calculator.CheckVolatile(vertex.expression);
  }

  /**
   * FIXME: for this version, this should be synchronous; the whole thing
   * should run in a worker. should be much faster than context switching
   * every time.
   */
  protected CalculationCallback(vertex: SpreadsheetVertex): CalculationResult {

    // must have address [UPDATE: don't do this]
    if (!vertex.address) throw(new Error('vertex missing address'));
    if (vertex.expression_error) {
      return {
        value: {
          error: 'ERR',
        },
      };
    }

    return this.expression_calculator.Calculate(vertex.expression, vertex.address);
  }

  protected async CalculateInternal(model: DataModel, area?: Area, options?: CalculationOptions){

    const cells = model.sheet.cells;

    const json_options: CellSerializationOptions = {
      preserve_type: true,

      // drop subset if we need a full rebuild
      subset: this.full_rebuild_required ? undefined : area,
      calculated_value: true };

    this.full_rebuild_required = false; // unset

    let flat = cells.toJSON(json_options);

    this.AttachData(model);
    this.expression_calculator.SetModel(model, this.simulation_model, this.library);

    let result: {status: GraphStatus, reference?: ICellAddress} = {
      status: GraphStatus.OK,
    };

    if (flat.data.length === 0 && area){

      // clearing. set these as dirty. NOTE: there's another case
      // where are clearing, but we have values; that happens for
      // merged cells. in this case we still need to reset, but it
      // will happen in the RebuildGraph function.

      area.Iterate((address: ICellAddress) => {
        this.ResetInbound(address, true);
      });

      // check for loops...

      if (this.status !== GraphStatus.OK){
        json_options.subset = undefined;
        flat = cells.toJSON(json_options);
        result = this.RebuildGraph(flat.data, options);
      }

    }
    else {

      // what's this about? cleaning up loops is complicated.
      // we need to check if the last change was a fix, by running
      // the complete check.

      const initial_state = this.status;
      result = this.RebuildGraph(flat.data, options);

      if (initial_state){
        json_options.subset = undefined;
        flat = cells.toJSON(json_options);
        result = this.RebuildGraph(flat.data, options);
      }
    }

    this.status = result ? result.status : GraphStatus.OK;

    if (this.status !== GraphStatus.OK){
      console.error( 'Loop detected, stopping');
      return result;
    }

    try {
      this.Recalculate();
    }
    catch (err){
      console.error(err);
      console.info('calculation error trapped');
    }

    return {status: GraphStatus.OK, reference: null};

  }


}
