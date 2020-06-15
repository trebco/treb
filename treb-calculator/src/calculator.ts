
import { Localization, Cell, Area, ICellAddress,
         ValueType, CellSerializationOptions } from 'treb-base-types';
import { Parser, ExpressionUnit, DependencyList, UnitRange,
         DecimalMarkType, ArgumentSeparatorType, UnitAddress, UnitIdentifier, UnitLiteral, UnitMissing } from 'treb-parser';

import { Graph, GraphStatus } from './dag/graph';
import { SpreadsheetVertex, CalculationResult } from './dag/spreadsheet_vertex';
import { ExpressionCalculator } from './expression-calculator';
import * as Utilities from './utilities';

import { FunctionLibrary } from './function-library';
import { FunctionMap, ReturnType } from './descriptors';
import { BaseFunctionLibrary, BaseFunctionAliases } from './functions/base-functions';
import { TextFunctionLibrary } from './functions/text-functions';

import { DataModel, Annotation, FunctionDescriptor } from 'treb-grid';
import { LeafVertex } from './dag/leaf_vertex';

import { ArgumentError, ReferenceError, UnknownError, IsError, ValueError, ExpressionError } from './function-error';

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

  // FIXME: remove from calculator class
  // protected readonly simulation_model = new SimulationModel();

  protected readonly library = new FunctionLibrary();

  public readonly parser: Parser = new Parser();

  // protected graph: Graph = new Graph(); // |null = null;

  protected status: GraphStatus = GraphStatus.OK;

  // FIXME: why is this a separate class? [actually is this a composition issue?]
  protected expression_calculator = new ExpressionCalculator(
      // this.simulation_model,
      this.library,
      this.parser);

  /** the next calculation must do a full rebuild -- set on reset */
  protected full_rebuild_required = false;

  constructor() {
    super();
    this.UpdateLocale();

    // base functions (plus aliases)
    this.library.Register(BaseFunctionLibrary);
    for (const key of Object.keys(BaseFunctionAliases)) {
      this.library.Alias(key, BaseFunctionAliases[key]);
    }

    // we split out text functions
    this.library.Register(TextFunctionLibrary);

    // special functions... need reference to the graph (this)

    this.library.Register({

      /**
       * this function is here so it has access to the parser.
       * this is crazy expensive. is there a way to reduce cost?
       * 
       * we could, in theory, consider that there are only a few
       * valid operations here -- all binary. instead of using a 
       * generic call to the CalculateExpression routine, we could
       * short-cut and call the binary method.
       * 
       * OTOH that makes it more fragile, and might not really 
       * provide that much in the way of savings. still, it would
       * be good if we could somehow cache some of the effort,
       * particularly if the list data changes but not the expression.
       * 
       */
      CountIf: {
        arguments: [
          { name: 'range', },
          { name: 'criteria', }
        ],
        fn: (range, criteria) => {

          const data = Utilities.Flatten(range);

          if (typeof criteria !== 'string') {
            criteria = '=' + (criteria || 0).toString();
          }
          else {
            criteria = criteria.trim();
            if (!/^[=<>]/.test(criteria)) {
              criteria = '=' + criteria;
            }
          }

          // switching to an array. doesn't actually seem to be any 
          // faster... more appropriate, though.
          
          const parse_result = this.parser.Parse('{}' + criteria);
          const expression = parse_result.expression;

          if (parse_result.error || !expression) {
            return ExpressionError;
          }
          if (expression.type !== 'binary') {
            // console.warn('invalid expression [1]', expression);
            return ExpressionError;
          }
          if (expression.left.type !== 'array') {
            // console.warn('invalid expression [1]', expression);
            return ExpressionError;
          }

          expression.left.values = data;
          const result = this.CalculateExpression(expression);

          if (Array.isArray(result)) {
            let count = 0;
            for (const column of result) {
              for (const cell of column) {
                if (cell) { count++; }
              }
            }
            return count;
          }
          
          return result; // error?

        },
      },

      /**
       * this one does not have to be here, it's just here because
       * the rest of the reference/lookup functions are here
       */
      Rows: {
        arguments: [{
          name: 'reference', description: 'Array or reference' },
        ],
        volatile: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fn: (reference: any) => {
          if (!reference) return ArgumentError;
          if (Array.isArray(reference)) {
            const column = reference[0];
            if (Array.isArray(column)) {
              return column.length;
            }
            return ValueError;
          }
          return 1;
        },
      },

      /**
       * this one does not have to be here, it's just here because
       * the rest of the reference/lookup functions are here
       */
      Columns: {
        arguments: [{
          name: 'reference', description: 'Array or reference' },
        ],
        volatile: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fn: (reference: any) => {
          if (!reference) return ArgumentError;
          if (Array.isArray(reference)) {
            return reference.length;
          }
          return 1;
        },
      },

      /** like indirect, this creates dependencies at calc time */
      Offset: {
        arguments: [{
          name: 'reference', description: 'Base reference', metadata: true, }, {
          name: 'rows', description: 'number of rows to offset' }, {
          name: 'columns', description: 'number of columns to offset' },
        ],
        return_type: ReturnType.reference,
        volatile: true,
        fn: ((reference: any, rows = 0, columns = 0, width = 1, height = 1) => {

          if (!reference) return ArgumentError;

          // const parse_result = this.parser.Parse(reference);
          // if (parse_result.error || !parse_result.expression) {
          //  return ReferenceError;
          //}

          // we need a proper type for this... also it might be a range

          if (typeof reference !== 'object' || !reference.address) { return ReferenceError; }

          const check_result = this.DynamicDependencies(
            // parse_result.expression,
            reference.address,
            true, rows, columns, width, height);

          if (IsError(check_result)) {
            return check_result;
          }

          if (check_result.dirty) {
            const current_vertex =
              this.GetVertex(this.expression_calculator.context.address, true) as SpreadsheetVertex;
            current_vertex.short_circuit = true;
            return undefined;
          }

          if (check_result.area) {

            const start: ExpressionUnit = {
              type: 'address', ...check_result.area.start,
              label: '', position: 0,
              // id: parse_result.expression.id,
              id: 0,
            };
            const end: ExpressionUnit = {
              type: 'address', ...check_result.area.end,
              label: '', position: 0,
              // id: parse_result.expression.id,
              id: 0,
            };
            const expression: ExpressionUnit = check_result.area.count === 1 ? start : {
              type: 'range', start, end,
              label: '', position: 0,
              // id: parse_result.expression.id,
              id: 0,
            };

            // return this.CalculateExpression(expression, undefined, true);

            return expression;

          }

          return ValueError;

        }).bind(this),
      },

      Indirect: {
        arguments: [
          { name: 'reference', description: 'Cell reference (string)' },
        ],
        return_type: ReturnType.reference,
        volatile: true, // necessary?
        fn: ((reference: string) => {

          if (!reference) return ArgumentError;

          const parse_result = this.parser.Parse(reference);
          if (parse_result.error || !parse_result.expression) {
            return ReferenceError;
          }

          const check_result = this.DynamicDependencies(parse_result.expression);

          if (IsError(check_result)) {
            return check_result;
          }

          if (check_result.dirty) {
            const current_vertex =
              this.GetVertex(this.expression_calculator.context.address, true) as SpreadsheetVertex;
            current_vertex.short_circuit = true;
            return undefined;
          }

          return parse_result.expression;

          // we don't need to use calculate expression here because arguments
          // will already have been calculated; we will _always_ get a string
          // (or something is wrong). right?

          // return this.CalculateExpression(parse_result.expression, undefined, true);

        }).bind(this),
      },
    });

  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public SpreadCallback(vertex: SpreadsheetVertex, value: any) {

    if (!vertex.address || !vertex.address.sheet_id) {
      throw new Error('spread callback called without sheet id');
    }
    const cells = this.cells_map[vertex.address.sheet_id];

    if (!cells) {
      throw new Error('spread callback called without cells');
    }

    if (!vertex || !vertex.reference) return;

    // const ref = vertex.reference.area;
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // clear array -- will it always exist? (...)
      for (let row = area.start.row; row <= area.end.row; row++) {
        for (let column = area.start.column; column <= area.end.column; column++) {
          cells.data2[row][column].SetCalculatedValue(undefined, ValueType.undefined);
        }
      }
      
      if (type === 'array' ){

        if (dims === 1){
          let row = area.start.row;
          let column = area.start.column;
          for (let r = 0; r < value.length && r < area.rows; r++, row++ ){
            if (this.IsNativeOrTypedArray(value[r])){
              for (let c = 0; c < value[r].length && c < area.columns; c++, column++ ){
                cells.data2[row][column].SetCalculatedValueOrError(value[r][c]);
              }
              column = area.start.column;
            }
            else {
              cells.data2[row][column].SetCalculatedValueOrError(value[r]);
            }
          }
        }
        else {
          for (let c = value.length; c < area.columns; c++ ) value[c] = []; // padding columns for loop
          for (let c = 0, column = area.start.column; c < area.columns; c++, column++ ){
            for (let r = 0, row = area.start.row; r < area.rows; r++, row++ ){
              cells.data2[row][column].SetCalculatedValueOrError(value[c][r]);
            }
          }
        }
      }
      else {

        // test before loops
        if (calculation_error) {
          for (let c = area.start.column; c <= area.end.column; c++){
            for (let r = area.start.row; r <= area.end.row; r++){
              cells.data2[r][c].SetCalculationError(value.error);
            }
          }
        }
        else {
          const value_type = Cell.GetValueType(value);
          for (let c = area.start.column; c <= area.end.column; c++){
            for (let r = area.start.row; r <= area.end.row; r++){
              cells.data2[r][c].SetCalculatedValue(value, value_type);
            }
          }
        }
      }
    }

    // console.info("Spread array value", value, vertex.reference_)
  }

  /**
   * FIXME: for this version, this should be synchronous; the whole thing
   * should run in a worker. should be much faster than context switching
   * every time.
   */
  public CalculationCallback(vertex: SpreadsheetVertex): CalculationResult {

    // must have address [UPDATE: don't do this]
    if (!vertex.address) throw(new Error('vertex missing address'));
    if (vertex.expression_error) {
      return {
        value: UnknownError,
      };
    }

    return this.expression_calculator.Calculate(vertex.expression, vertex.address);
  }


  /**
   * generic function, broken out from the Indirect function. checks dynamic
   * dependency for missing edges, and adds those edges.
   *
   * returns error on bad reference or circular dependency. this method
   * does not set the "short circuit" flag, callers should set as appropriate.
   */
  public DynamicDependencies(
      expression: ExpressionUnit,
      offset = false,
      offset_rows = 0,
      offset_columns = 0,
      resize_rows = 1,
      resize_columns = 1,
    ) {

    if (!this.model) {
      return UnknownError;
    }

    let area = this.ResolveExpressionAddress(expression);

    // flag. we're going to check _all_ dependencies at once, just in
    // case (for this function this would only happen if the argument
    // is an array).

    let dirty = false;

    if (area) {

      // check any dirty...

      area = this.model.active_sheet.RealArea(area);

      const sheet_id = area.start.sheet_id;

      if (offset) {
        area = new Area({
          column: area.start.column + offset_columns,
          row: area.start.row + offset_rows,
          sheet_id: area.start.sheet_id,
        }, {
          column: area.start.column + offset_columns + resize_rows - 1,
          row: area.start.row + offset_rows + resize_columns - 1,
          sheet_id: area.end.sheet_id,
        });
      }

      for (let row = area.start.row; row <= area.end.row; row++ ){
        for (let column = area.start.column; column <= area.end.column; column++ ){
          const vertex = this.GetVertex({row, column, sheet_id}, false);
          if (vertex && vertex.dirty) {

            // so we know, given the structure of calculation, that there
            // is not an edge between these two vertices. we know that
            // because calculate() is never called on a vertex that has
            // dirty dependencies.

            // so if we create an edge here, the calculate method can
            // short-circuit, and then this cell will be re-evaluated
            // when that cell is calculated.

            // so all we have to do is add the edge. the question is,
            // do we need to remove that edge after the calculation?
            // or can we just wait for it to clean up on a rebuild?
            // (...) don't know for sure atm, test.

            // actually we have to set some flag to tell the vertex to
            // short-circuit...

            // before you set the short-circuit flag, test result so we
            // can error on circular ref

            const edge_result = this.AddEdge({row, column, sheet_id}, this.expression_calculator.context.address);

            if (edge_result) {
              return ReferenceError;
            }

            dirty = true;

          }
        }
      }
    }

    return { dirty, area };

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

    // this.expression_calculator.UpdateLocale();

  }

  /** lookup in function library */
  public GetFunction(name: string) {
    return this.library.Get(name);
  }

  /**
   * returns a list of available functions, for AC/tooltips
   * FIXME: categories?
   * FIXME: need to separate annotation functions and sheet functions
   */
  public SupportedFunctions(): FunctionDescriptor[] {

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

    if (this.model) {
      for (const key of Object.keys(this.model.macro_functions)) {
        const macro = this.model.macro_functions[key];
        function_list.push({
          name: macro.name,
          description: macro.description,
          arguments: (macro.argument_names || []).map(argument => {
            return { name: argument };
          }),
        });
      }
    }

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      descriptor.fn = (...args: any[]) => {
        return original_function.apply({
          address: { ...this.expression_calculator.context.address},
        }, args);
      };

      this.library.Register({[name]: descriptor});
    }

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
   * resets graph and graph status
   */
  public Reset(){

    this.status = GraphStatus.OK;
    this.FlushTree();
    if (this.model) {
      this.AttachData(this.model);
    }
    this.full_rebuild_required = true;

  }

  /**
   * calculate an expression, optionally setting a fake cell address.
   * this may have weird side-effects.
   */
  public CalculateExpression(
      expression: ExpressionUnit,
      address: ICellAddress = {row: -1, column: -1},
      preserve_flags = false) {

    return this.expression_calculator.Calculate(expression, address, preserve_flags).value; // dropping volatile flag
  }

  /**
   * rebuild the graph, and set cells as clean. the vertices need internal
   * references to the calculated value, so that's set via the vertex method.
   *
   * we also need to manage the list of volatile cells, which is normally
   * built as a side-effect of calculation.
   * 
   * UPDATE: optionally recalculate if there are volatile cells. that's used
   * for loading documents.
   */
  public RebuildClean(model: DataModel, recalculate_if_volatile = false) {

    const json_options: CellSerializationOptions = {
      preserve_type: true,
      calculated_value: true };

    this.full_rebuild_required = false; // unset

    this.AttachData(model);
    this.expression_calculator.SetModel(model);

    const flat_data = this.BuildCellsList(json_options);

    const result = this.RebuildGraph(flat_data, {});

    // add leaf vertices for annotations

    this.UpdateAnnotations(); // all

    this.status = result ? result.status : GraphStatus.OK;

    if (this.status !== GraphStatus.OK){
      console.error( 'Loop detected, stopping');
      return result;
    }
    else {
      this.InitializeGraph();
      if (recalculate_if_volatile && this.volatile_list.length) {
        this.Recalculate();
      }
    }

  }

  /**
   * remove duplicates from list, dropping absolute
   */
  public FlattenCellList(list: ICellAddress[]) {

    const map: {[index: string]: string} = {};
    const flattened: ICellAddress[] = [];

    for (const entry of list) {
      const address = {
        column: entry.column,
        row: entry.row,
        sheet_id: entry.sheet_id,
      };
      const label = Area.CellAddressToLabel(address, true);
      if (map[label]) { continue; }
      map[label] = label;
      flattened.push(address);
    }

    return flattened;
  }

  /**
   * get a list of cells that need metadata. this is for passing to
   * the simulation as additional cells
   */
  public MetadataReferences(formula: string) {
    const references: ICellAddress[] = [];
    if (!this.model) { return references; }
    const parse_result = this.parser.Parse(formula);
    if (parse_result.expression && parse_result.expression.type === 'call') {
      const func = this.GetFunction(parse_result.expression.name);
      if (!func || !func.arguments) { return references; }
      for (let index = 0; index < func.arguments.length; index++ ){
        const descriptor = func.arguments[index];
        if (!descriptor || !descriptor.metadata) { continue; }

        const arg = parse_result.expression.args[index];
        if (!arg) { continue; }

        const area = this.ResolveExpressionAddress(arg);

        if (area) {
          references.push(area.start);
        }

      }
    }
    return references;
  }

  public RemoveAnnotation(annotation: Annotation) {
    const vertex = (annotation.temp.vertex as LeafVertex);
    if (!vertex) { return; }
    vertex.Reset();
    this.RemoveLeafVertex(vertex);
  }

  public UpdateAnnotations(list?: Annotation|Annotation[]) {

    if (!list && this.model) list = this.model.active_sheet.annotations;
    if (!list) return;

    if (typeof list !== 'undefined' && !Array.isArray(list)) {
      list = [list];
    }

    for (const entry of list) {
      if (entry.formula) {
        if (!entry.temp.vertex) {
          entry.temp.vertex = new LeafVertex();
        }
        const vertex = entry.temp.vertex as LeafVertex;
        this.AddLeafVertex(vertex);
        this.UpdateLeafVertex(vertex, entry.formula);
      }
    }

  }

  public ResolveSheetID(expr: UnitAddress|UnitRange) {
    if (!this.model) { throw new Error('ResolveSheetID called without model'); }

    const target = expr.type === 'address' ? expr : expr.start;
    if (!target.sheet_id) {
      if (target.sheet) {
        const lc = target.sheet.toLowerCase();
        for (const sheet of this.model.sheets) {
          if (sheet.name.toLowerCase() === lc) {
            target.sheet_id = sheet.id;
            break;
          }
        }
      }
      else {
        target.sheet_id = this.model.active_sheet.id;
      }
    }

  }

  // --- protected -------------------------------------------------------------

  /**
   * assuming the expression is an address, range, or named range, resolve
   * to an address/area. returns undefined if the expression can't be resolved.
   */
  protected ResolveExpressionAddress(expr: ExpressionUnit) {

    switch (expr.type) {
      case 'address':
        this.ResolveSheetID(expr);
        return new Area(expr);

      case 'range':
        this.ResolveSheetID(expr);
        return new Area(expr.start, expr.end);

      case 'identifier':
        if (this.model) {
          const named_range =
            this.model.named_ranges.Get(expr.name.toUpperCase());
          if (named_range) {
            return new Area(named_range.start, named_range.end);
          }
        }
        break;
    }

    return undefined;

  }

  protected NamedRangeToAddressUnit(unit: UnitIdentifier): UnitAddress|UnitRange|undefined {
    if (!this.model) return undefined;

    const normalized = unit.name.toUpperCase();
    const named_range = this.model.named_ranges.Get(normalized);
    if (named_range) {
      if (named_range.count === 1) {
        return this.ConstructAddressUnit(named_range.start, normalized, unit.id, unit.position);
      }
      else {
        return {
          type: 'range',
          start: this.ConstructAddressUnit(named_range.start, normalized, unit.id, unit.position),
          end: this.ConstructAddressUnit(named_range.end, normalized, unit.id, unit.position),
          label: normalized,
          id: unit.id,
          position: unit.position,
        };
      }
    }

    return undefined;
  }

  /** named range support */
  protected ConstructAddressUnit(address: ICellAddress, label: string, id: number, position: number) {
    return {
      type: 'address',
      row: address.row,
      column: address.column,
      sheet_id: address.sheet_id,
      label,
      id,
      position,
    } as UnitAddress;
  }

  /**
   * rebuild dependencies for a single expression (might be a cell, or an
   * annotation/leaf node). can recurse on elements, so the return value
   * is passed through. the first (outer) call can just leave it blank and
   * use the return value.
   *
   * we're adding the sheet name so that (in mc expression calculator) we
   * can turn address parameters into qualified labels. the normal routine
   * will just use the ID as the name, that's fine, as long as it's unique
   * (which it is).
   *
   * this might cause issues if we ever try to actually resolve from the
   * sheet name, though, so (...)
   */
  protected RebuildDependencies(
      unit: ExpressionUnit,
      relative_sheet_id: number,
      relative_sheet_name: string,
      dependencies: DependencyList = {addresses: {}, ranges: {}},
      sheet_name_map?: {[index: string]: number},
    ){

    // does this get redone on every descent? dumb

    if (!sheet_name_map) {

      sheet_name_map = {};
      if (this.model) {

        for (const sheet of this.model.sheets) {
          sheet_name_map[sheet.name.toLowerCase()] = sheet.id;
        }

        if (!relative_sheet_name) {
          for (const sheet of this.model.sheets) {
            if (sheet.id === relative_sheet_id) {
              relative_sheet_name = sheet.name;
              break;
            }
          }
        }

      }
    }

    switch (unit.type){

      case 'literal':
      case 'missing':
      case 'operator':
        break;

      case 'identifier':
        {
          const resolved = this.NamedRangeToAddressUnit(unit);
          if (resolved) {
            if (resolved.type === 'address') {
              dependencies.addresses[resolved.label] = resolved;
            }
            else {
              dependencies.ranges[resolved.label] = resolved;
            }
          }
        }
        break;

      case 'address':

        if (!unit.sheet_id) {
          unit.sheet_id = unit.sheet ?
            (sheet_name_map[unit.sheet.toLowerCase()] || 0) :
            relative_sheet_id;
          if (!unit.sheet) { unit.sheet = relative_sheet_name; }
        }
        dependencies.addresses[unit.sheet_id + '!' + unit.label] = unit;
        break; // this.AddressLabel(unit, offset);

      case 'range':
        if (!unit.start.sheet_id) {
          unit.start.sheet_id = unit.start.sheet ?
            (sheet_name_map[unit.start.sheet.toLowerCase()] || 0) :
            relative_sheet_id;
          if (!unit.start.sheet) { unit.start.sheet = relative_sheet_name; }
        }
        dependencies.ranges[unit.start.sheet_id + '!' + unit.start.label + ':' + unit.end.label] = unit;
        break;

      case 'unary':
        this.RebuildDependencies(unit.operand, relative_sheet_id, relative_sheet_name, dependencies, sheet_name_map);
        break;

      case 'binary':
        this.RebuildDependencies(unit.left, relative_sheet_id, relative_sheet_name, dependencies, sheet_name_map);
        this.RebuildDependencies(unit.right, relative_sheet_id, relative_sheet_name, dependencies, sheet_name_map);
        break;

      case 'group':
        unit.elements.forEach((element) =>
          this.RebuildDependencies(element, relative_sheet_id, relative_sheet_name, dependencies, sheet_name_map));
        break;

      case 'call':

        // this is where we diverge. if there's a known function that has
        // an "address" parameter, we don't treat it as a dependency. this is
        // to support our weird MV syntax (weird here, but useful in Excel).

        // UPDATE: this is broadly useful for some other functions, like OFFSET.
        {
          const args: ExpressionUnit[] = unit.args.slice(0);
          const func = this.library.Get(unit.name);
          if (func && func.arguments){
            func.arguments.forEach((descriptor, index) => {
              if (descriptor && descriptor.address) {

                // we still want to fix sheet addresses, though, even if we're
                // not tracking the dependency. to do that, we can recurse with
                // a new (empty) dependency list, and just drop the new list

                this.RebuildDependencies(args[index], relative_sheet_id, relative_sheet_name, undefined, sheet_name_map);

                args[index] = { type: 'missing', id: -1 };
              }
            });
          }
          args.forEach((arg) => this.RebuildDependencies(arg, relative_sheet_id, relative_sheet_name, dependencies, sheet_name_map));

        }
        break;

    }

    return dependencies;
  }

  protected UpdateLeafVertex(vertex: LeafVertex, formula: string){

    if (!this.model) {
      throw new Error('UpdateLeafVertex called without model')
    }

    vertex.Reset();

    const parse_result = this.parser.Parse(formula);
    if (parse_result.expression) {
      const dependencies =
        this.RebuildDependencies(
          parse_result.expression,
          this.model.active_sheet.id,
          this.model.active_sheet.name,
        );

      for (const key of Object.keys(dependencies.ranges)){
        const unit = dependencies.ranges[key];
        const range = new Area(unit.start, unit.end);

        range.Iterate((address: ICellAddress) => {
          this.AddLeafVertexEdge(address, vertex);
        });

        /*
        for (const address of range) {
          this.AddLeafVertexEdge(address, vertex);
        }
        */
      }

      for (const key of Object.keys(dependencies.addresses)){
        const address = dependencies.addresses[key];
        this.AddLeafVertexEdge(address, vertex);
      }

    }

    vertex.expression = parse_result.expression || {type: 'missing', id: -1};
    vertex.expression_error = !parse_result.valid;

    // vertex.UpdateState();

  }

  /**
   * we're passing model here to skip the test on each call
   * 
   * @param unit 
   * @param model 
   */
  protected ApplyMacroFunctionInternal(
      unit: ExpressionUnit, 
      model: DataModel, 
      name_stack: Array<{[index: string]: ExpressionUnit}>,
    ): ExpressionUnit { 

      switch (unit.type) {

        case 'identifier':
          if (name_stack[0]) {
            const value = name_stack[0][(unit.name || '').toUpperCase()];
            if (value) {
              return JSON.parse(JSON.stringify(value)) as ExpressionUnit;
            }
          }
          break;

        case 'binary':
          unit.left = this.ApplyMacroFunctionInternal(unit.left, model, name_stack);
          unit.right = this.ApplyMacroFunctionInternal(unit.right, model, name_stack);
          break;
  
        case 'unary':
          unit.operand = this.ApplyMacroFunctionInternal(unit.operand, model, name_stack);
          break;
  
        case 'group':
          unit.elements = unit.elements.map(element => this.ApplyMacroFunctionInternal(element, model, name_stack));
          break;
  
        case 'call':
          {
            // do this first, so we can pass through directly
            unit.args = unit.args.map(arg => this.ApplyMacroFunctionInternal(arg, model, name_stack));

            const func = this.library.Get(unit.name);
            if (!func) { 
              const macro = model.macro_functions[unit.name.toUpperCase()];
              if (macro && macro.expression) {

                // clone
                const expression = JSON.parse(JSON.stringify(macro.expression));

                const bound_names: {[index: string]: ExpressionUnit} = {};

                if (macro.argument_names) {
                  for (let i = 0; i < macro.argument_names.length; i++) {
                    const name = macro.argument_names[i].toUpperCase();
          
                    // temp just pass in
                    bound_names[name] = unit.args[i] ? unit.args[i] : {type: 'missing'} as UnitMissing;
                  }
                }

                // replace arguments
                name_stack.unshift(bound_names);
                const replacement = this.ApplyMacroFunctionInternal(expression, model, name_stack);                
                name_stack.shift();
                return replacement;

              }
            }
          }

          break;

      }

      return unit;

  }

  protected ApplyMacroFunctions(expression: ExpressionUnit) {

    if (!this.model) { return; }

    const count = Object.keys(this.model.macro_functions).length;
    if (!count) { return; }

    return this.ApplyMacroFunctionInternal(expression, this.model, []);

  }

  /**
   * rebuild the graph; parse expressions, build a dependency map,
   * initialize edges between nodes.
   *
   * FIXME: if we want to compose functions, we could do that here,
   * which might result in some savings
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected RebuildGraph(data: any[], options: CalculationOptions = {}):
      {status: GraphStatus; reference?: ICellAddress} {

    // we're finishing the dep/dirty check so we don't miss something
    // later, but we won't add the loop and we won't calculate.

    let global_status = GraphStatus.OK;
    let initial_reference: ICellAddress|null = null;

    for (const cell of data){

      // array head
      if (cell.area && cell.area.start.column === cell.column && cell.area.start.row === cell.row ){

        const sheet_id = cell.area.start.sheet_id || cell.sheet_id;

        for (let column = cell.area.start.column; column <= cell.area.end.column; column++ ){
          for (let row = cell.area.start.row; row <= cell.area.end.row; row++ ){
            this.ResetInbound({column, row, sheet_id}, true, false); // set dirty, don't create
          }
        }

        this.SetDirty(cell); // implicitly creates vertex for array head (if it doesn't already exist)

        // implicit vertices from array head -> array members. this is required
        // to correctly propagate dirtiness if a referenced cell changes state
        // from array -> !array and vice-versa

        for (let column = cell.area.start.column; column <= cell.area.end.column; column++ ){
          for (let row = cell.area.start.row; row <= cell.area.end.row; row++ ){
            if (row === cell.area.start.row && column === cell.area.start.column) { continue; }
            this.AddEdge(cell.area.start, {
              ...cell.area.start, row, column
            });
          }
        }
        

      }

      // formula?
      if (cell.type === ValueType.formula) {

        this.ResetInbound(cell, true); // NOTE: sets dirty AND creates vertex if it doesn't exist
        const parse_result = this.parser.Parse(cell.value);

        // we have a couple of "magic" functions that can have loops
        // but shouldn't trigger circular references. we need to check
        // for those here...

        if (parse_result.expression) {

          // FIXME: move macro function parsing here; so that we don't
          // need special call semantics, and dependencies work as normal.

          // NOTE: the problem with that is you have to deep-parse every function,
          // here, to look for macros. that might be OK, but the alternative is
          // just to calculate them on demand, which seems a lot more efficient

          const modified = this.ApplyMacroFunctions(parse_result.expression);
          if (modified) { parse_result.expression = modified; }

          // ...

          const dependencies = this.RebuildDependencies(parse_result.expression, cell.sheet_id, ''); // cell.sheet_id);
          
          if (parse_result.expression.type === 'call') {
            const func = this.library.Get(parse_result.expression.name);
            if (func && func.render) {

              // 'cell' here is not a reference to the actual cell (sadly)
              // maybe we should fix that...

              if (this.model) {

                // we need a better way to do this
                
                for (const sheet of this.model.sheets) {
                  if (sheet.id === cell.sheet_id) {
                    const cell2 = sheet.cells.GetCell(cell, false);
                    if (cell2) {
                      cell2.render_function = func.render;
                    }
                    break;
                  }
                }

              }

            }
          }

          for (const key of Object.keys(dependencies.ranges)){
            const unit = dependencies.ranges[key];
            const range = new Area(unit.start, unit.end);

            // testing out array vertices (vertices that represent ranges).
            // this is an effort to reduce the number of vertices in the graph,
            // especially since these are generally unecessary (except for
            // formula cells).

            // if you want to drop this, go back to the non-array code below
            // and it should go back to the old way (but there will still be
            // some cruft in graph.ts, tests that will need to be removed).

            // actually it's probably something that could be balanced based
            // on the number of constants vs the number of formulae in the
            // range. more (or all) constants, use a range. more/all formula,
            // iterate.

            // --- array version -----------------------------------------------

            /*
            const status = this.AddArrayVertexEdge(range, cell);

            if (status !== GraphStatus.OK) {
              global_status = status;
              if (!initial_reference) initial_reference = { ...cell };
            }
            */

            // --- non-array version -------------------------------------------

            range.Iterate((address: ICellAddress) => {
              const status = this.AddEdge(address, cell);
              if (status !== GraphStatus.OK) {
                global_status = status;
                if (!initial_reference) initial_reference = { ...cell };
              }
            });

            // --- end ---------------------------------------------------------

          }

          for (const key of Object.keys(dependencies.addresses)){
            const address = dependencies.addresses[key];
            const status = this.AddEdge(address, cell);
            if (status !== GraphStatus.OK) {
              global_status = status;
              if (!initial_reference) initial_reference = { ...cell };
            }
          }

        }

        const vertex = this.GetVertex(cell, true);

        if (vertex) {
          vertex.expression = parse_result.expression || {type: 'missing', id: -1};
          vertex.expression_error = !parse_result.valid;
        }

      }
      else if (cell.value !== cell.calculated && !options.formula_only){

        // sets dirty and removes inbound edges (in case the cell
        // previously contained a formula and now it contains a constant).

        this.ResetInbound(cell, true, false); // NOTE: sets dirty
      }
      else if (cell.type === ValueType.undefined){

        // if we get here, it means that this cell was cleared but is not
        // 'empty'; in practice, that means it has a merge cell. reset inbound
        // and set dirty.

        // is this unecessarily flagging a number of cells? (...)

        this.ResetInbound(cell, true, false);
      }
      else {

        // this is just a constant?
        // console.info("UNHANDLED CASE?", cell);

      }

    }

    return {status: global_status, reference: initial_reference || undefined}; // no loops
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected IsNativeOrTypedArray(val: any){
    return Array.isArray(val) || (val instanceof Float64Array) || (val instanceof Float32Array);
  }

  /**
   * check if a cell is volatile. normally this falls out of the calculation,
   * but if we build the graph and set values explicitly, we need to check.
   */
  protected CheckVolatile(vertex: SpreadsheetVertex): boolean {
    if (!vertex.expression || vertex.expression_error) return false;

    let volatile = false;

    this.parser.Walk(vertex.expression, (unit: ExpressionUnit) => {
      if (unit.type === 'call') {
        const func = this.library.Get(unit.name);
        if (func && func.volatile) volatile = true;
      }
      return !volatile; // short circuit
    });

    return volatile;

  }

  /**
   * get a list of cells, possibly subset, for building the graph
   */
  protected BuildCellsList(options: CellSerializationOptions) {

    if (options.subset) {

      // if there's a subset, then limit to that sheet

      const sheet_id = options.subset.start.sheet_id;
      if (!sheet_id) { throw new Error('BuildCellsList called with subset without sheet id'); }

      const cells = this.cells_map[sheet_id];
      if (!cells) { throw new Error('BuildCellsList called with invalid sheet id'); }

      const flat = cells.toJSON({ ...options, sheet_id });

      return flat.data;

    }
    else {

      if (!this.model) { throw new Error('BuildCellsList called without model'); }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any[] = [];
      for (const sheet of this.model.sheets) {
        const flat = sheet.cells.toJSON({ ...options, sheet_id: sheet.id });
        data = data.concat(flat.data);
      }

      return data;

    }

  }

  protected async CalculateInternal(model: DataModel, area?: Area, options?: CalculationOptions){

    // const cells = model.active_sheet.cells;

    this.AttachData(model); // for graph. FIXME

    if (area && !area.start.sheet_id) {
      throw new Error('CalculateInternal called with area w/out sheet ID')
    }

    const json_options: CellSerializationOptions = {
      preserve_type: true,

      // drop subset if we need a full rebuild
      subset: this.full_rebuild_required ? undefined : area,
      calculated_value: true,
    
    };

    if (this.full_rebuild_required) {
      this.UpdateAnnotations();
    }

    this.full_rebuild_required = false; // unset

    let flat_data = this.BuildCellsList(json_options);

    this.expression_calculator.SetModel(model);

    let result: {status: GraphStatus; reference?: ICellAddress} = {
      status: GraphStatus.OK,
    };

    if (flat_data.length === 0 && area){

      // clearing. set these as dirty. NOTE: there's another case
      // where are clearing, but we have values; that happens for
      // merged cells. in this case we still need to reset, but it
      // will happen in the RebuildGraph function.

      // NOTE: we need to do something with outbound vertices here.
      // the issue is if something refers to a cell within an array,
      // behavior is not well-defined. 

      // NOTE2: that's now handled in graph.

      const edge_list: SpreadsheetVertex[] = [];

      area.Iterate((address: ICellAddress) => {
        const vertex = this.GetVertex(address, false);
        if (vertex) {
          for (const edge of vertex.edges_out) {
            // console.info('EO', (edge as SpreadsheetVertex).address);
            edge_list.push(edge as SpreadsheetVertex);
          }
        }
        this.ResetInbound(address, true, false);
      });

      // check for loops...

      if (this.status !== GraphStatus.OK){
        json_options.subset = undefined;

        // what would flat be in this context? if data.length (above) is 0,
        // why would it be different now?

        // flat = cells.toJSON({...json_options, sheet_id: model.active_sheet.id});
        flat_data = this.BuildCellsList(json_options);
        result = this.RebuildGraph(flat_data, options);
      }

      /*

      else if (edge_list.length) {


        flat_data = edge_list.map(edge => {
          if (edge.address) {
            return this.BuildCellsList({...json_options, subset: new Area(edge.address)})[0];
          }
        });
        console.info("FDL", flat_data);
        result = this.RebuildGraph(flat_data, options);

      }

      */


    }
    else {

      // what's this about? cleaning up loops is complicated.
      // we need to check if the last change was a fix, by running
      // the complete check.

      const initial_state = this.status;
      result = this.RebuildGraph(flat_data, options);

      if (initial_state){
        json_options.subset = undefined;
        flat_data = this.BuildCellsList(json_options);
        result = this.RebuildGraph(flat_data, options);
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
