
import { Localization, Cell, Area, ICellAddress, ICellAddress2, ValueType, UnionValue,
         ArrayUnion, IArea, IsCellAddress} from 'treb-base-types';
         
import { Parser, ExpressionUnit, DependencyList, UnitRange,
         DecimalMarkType, ArgumentSeparatorType, UnitAddress, UnitIdentifier, UnitMissing } from 'treb-parser';

import { Graph } from './dag/graph';
import { SpreadsheetVertex } from './dag/spreadsheet_vertex';
import { CalculationResult } from './dag/spreadsheet_vertex_base';

import { ExpressionCalculator, UnionIsMetadata } from './expression-calculator';
import * as Utilities from './utilities';

import { FunctionLibrary } from './function-library';
import { ExtendedFunctionDescriptor, FunctionMap, ReturnType } from './descriptors';
import { BaseFunctionLibrary } from './functions/base-functions';
import { FinanceFunctionLibrary } from './functions/finance-functions';
import { TextFunctionLibrary, TextFunctionAliases } from './functions/text-functions';
import { InformationFunctionLibrary } from './functions/information-functions';
import { StatisticsFunctionLibrary, StatisticsFunctionAliases } from './functions/statistics-functions';
import { ComplexFunctionLibrary } from './functions/complex-functions';
import { MatrixFunctionLibrary } from './functions/matrix-functions';

import { DataModel, Annotation, FunctionDescriptor } from 'treb-grid';
import { LeafVertex } from './dag/leaf_vertex';

import { ArgumentError, ReferenceError, UnknownError, IsError, ValueError, ExpressionError, FunctionError, NAError } from './function-error';

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
 * ```
 * Calculator.Reset();
 * ```
 * 
 */
export class Calculator extends Graph {

  // FIXME: remove from calculator class
  // protected readonly simulation_model = new SimulationModel();

  // FIXME: need a way to share/pass parser flags

  public readonly parser: Parser = new Parser();

  protected readonly library = new FunctionLibrary();

  // protected graph: Graph = new Graph(); // |null = null;
  // protected status: GraphStatus = GraphStatus.OK;

  // FIXME: why is this a separate class? [actually is this a composition issue?]
  protected expression_calculator = new ExpressionCalculator(
      // this.simulation_model,
      this.library,
      this.parser);

  /** the next calculation must do a full rebuild -- set on reset */
  protected full_rebuild_required = false;

  constructor() {
    super();

    this.UpdateLocale(); // for parser

    // base functions
    this.library.Register(
      BaseFunctionLibrary,
      TextFunctionLibrary,        // we split out text functions
      StatisticsFunctionLibrary,  // also stats (wip)
      FinanceFunctionLibrary,     // also this (wip)
      InformationFunctionLibrary, // etc
      ComplexFunctionLibrary,
      MatrixFunctionLibrary,

      );
   
    // aliases
    for (const key of Object.keys(StatisticsFunctionAliases)) {
      this.library.Alias(key, StatisticsFunctionAliases[key]);
    }
    for (const key of Object.keys(TextFunctionAliases)) {
      this.library.Alias(key, TextFunctionAliases[key]);
    }

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
        fn: (range, criteria): UnionValue => {

          const data = Utilities.FlattenUnboxed(range);

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
            return ExpressionError();
          }
          if (expression.type !== 'binary') {
            // console.warn('invalid expression [1]', expression);
            return ExpressionError();
          }
          if (expression.left.type !== 'array') {
            // console.warn('invalid expression [1]', expression);
            return ExpressionError();
          }

          expression.left.values = [data];
          const result = this.CalculateExpression(expression);

          // console.info({expression, result});

          // this is no longer the case because we're getting 
          // a boxed result (union)

          /*
          if (Array.isArray(result)) {
            let count = 0;
            for (const column of result) {
              for (const cell of column) {
                if (cell.value) { count++; }
              }
            }
            return { type: ValueType.number, value: count };
          }
          */

          if (result.type === ValueType.array) {
            let count = 0;
            for (const column of (result as ArrayUnion).value) {
              for (const cell of column) {
                if (cell.value) { count++; }
              }
            }
            return { type: ValueType.number, value: count };
          }

          return result; // error?

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
        fn: ((reference: UnionValue, rows = 0, columns = 0, width = 1, height = 1): UnionValue => {

          if (!reference) {
            return ArgumentError();
          }

          // const parse_result = this.parser.Parse(reference);
          // if (parse_result.error || !parse_result.expression) {
          //  return ReferenceError;
          //}

          // we need a proper type for this... also it might be a range
         
          if (!UnionIsMetadata(reference)) {
            return ReferenceError(); 
          }

          const check_result = this.DynamicDependencies(
            reference.value.address,
            this.expression_calculator.context.address,
            true, rows, columns, width, height);

          if (!check_result) {
            return ReferenceError();
          }

          if (check_result.dirty) {
            const current_vertex =
              this.GetVertex(this.expression_calculator.context.address, true) as SpreadsheetVertex;
            current_vertex.short_circuit = true;
            return { type: ValueType.undefined, value: undefined };
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

            // return expression;
            return { type: ValueType.object, value: expression };

          }

          return ValueError();

        }).bind(this),
      },

      Indirect: {
        arguments: [
          { name: 'reference', description: 'Cell reference (string)' },
        ],
        return_type: ReturnType.reference,
        volatile: true, // necessary?
        fn: ((reference: string) => {

          if (!reference || (typeof reference !== 'string')) {
            return ArgumentError();
          }

          const parse_result = this.parser.Parse(reference);
          if (parse_result.error || !parse_result.expression || 
              (parse_result.expression.type !== 'address' && parse_result.expression.type !== 'range')) {
            return ReferenceError();
          }

          const check_result = this.DynamicDependencies(
            parse_result.expression,
            this.expression_calculator.context.address);

          if (!check_result) {
            return ReferenceError();
          }

          if (check_result.dirty) {
            const current_vertex =
              this.GetVertex(this.expression_calculator.context.address, true) as SpreadsheetVertex;
            current_vertex.short_circuit = true;
            return { type: ValueType.undefined, value: undefined };
          }

          return { type: ValueType.object, value: parse_result.expression as any };

        }).bind(this),

      },

      /**
       * FIXME: there are cases we are not handling
       * 
       * match seems to return either the matching row, in a column set,
       * or matching column, in a row set. you can't search a 2d array.
       * match also supports inexact matching but assumes data is ordered.
       * (TODO).
       * 
       * FIXME: we also need to icase match strings
       * 
       * /
      Match: {
        arguments: [
          { name: 'value', boxed: true }, 
          { name: 'range', boxed: true }, 
          { name: 'type', },
        ],
        fn: (value: UnionValue, range: UnionValue, type = 0) => {

          if (type) {
            console.warn('inexact match not supported', {value, range, type});
            return NAError();
          }
          else {

            // I suppose you can match on a single value
            if (range.type === ValueType.array) {
              if (range.value.length === 1) {
                const arr = range.value[0];
                for (let i = 0; i < arr.length; i++) {
                  if (value.type == arr[i].type && value.value === arr[i].value) {
                    return {type: ValueType.number, value: i + 1};
                  }
                }
              }
              else {
                for (let i = 0; i < range.value.length; i++) {
                  const arr = range.value[i];
                  if (arr.length !== 1) {
                    return NAError();
                  }
                  if (value.type == arr[0].type && value.value === arr[0].value) {
                    return {type: ValueType.number, value: i + 1};
                  }
                }
              }
              return NAError();
            }
            else {
              if (value.type === range.type && value.value === range.value) {
                return {
                  type: ValueType.number, value: 1,
                };
              }
              return NAError();
            }
          }
          return ArgumentError();
        },
      },

      /**
       * FIXME: there are cases we are not handling
       * /
      Index: {
        arguments: [
          { name: 'range', boxed: true }, 
          { name: 'row', }, 
          { name: 'column', }
        ],
        volatile: false,

        // FIXME: handle full row, full column calls
        fn: (data: UnionValue, row?: number, column?: number) => {

          if (data.type === ValueType.array) {

            // handle array cases: if row or column (but not both) are 
            // zero, return an array on the other axis.

            if (!row && !column) {
              return ArgumentError();
            }

            if (!row || !column) {

              if (!row && column) { // column array (typescript is not smart)
                return {
                  type: ValueType.array,
                  value: [data.value[column - 1] || [{ type: ValueType.undefined }]]
                }

              }
              else if (row) { // row array

                const value: UnionValue[][] = [];
                for (const r of data.value) {
                  if (r[row - 1]) {
                    value.push([r[row - 1] || { type: ValueType.undefined }]);
                  }
                }
                return { type: ValueType.array, value };

              }
              return ArgumentError();
              
            }

            const c = data.value[column - 1];
            if (c) {
              
              / *
              if (c[row - 1]) {
                return c[row - 1];
              }
              console.info('err 16', data, row, column);
              * /

              return c[row - 1] || ArgumentError();
            }
            // console.info('err 17', data, row, column);
            return ArgumentError();

          }
          else {
            if (row !== 1 || column !== 1) {
              // console.info('err 18');
              return ArgumentError();
            }
            return data;
          }
          
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
        fn: (reference: unknown) => {
          if (!reference) {
            return ArgumentError();
          }
          if (Array.isArray(reference)) {
            const column = reference[0];
            if (Array.isArray(column)) {
              return { type: ValueType.number, value: column.length };
            }
            return ValueError();
          }
          return { type: ValueType.number, value: 1 };
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
        fn: (reference: unknown) => {
          if (!reference) {
            return ArgumentError();
          }
          if (Array.isArray(reference)) {
            return { type: ValueType.number, value: reference.length };
          }
          return { type: ValueType.number, value: 1 };
        },
      },

      /**
       * this should be in the 'information' library but it needs reference
       * to the underlying cell (unresolved)
       */
      IsFormula: {
        description: 'Returns true if the reference is a formula',
        arguments: [{
          name: 'Reference',
          metadata: true, /* OK with array metadata */
        }],
        fn: Utilities.ApplyAsArray((ref: UnionValue): UnionValue => {

          // this is wasteful because we know that the range will all
          // be in the same sheet... we don't need to look up every time

          if (ref?.value?.address) {
            for (const sheet of this.model?.sheets||[]) {
              if (sheet.id === ref.value.address.sheet_id) {
                const cell = sheet.cells.GetCell(ref.value.address, false);
                return { 
                  type: ValueType.boolean, 
                  value: cell?.type === ValueType.formula,
                };
              }
            }
          }

          return { 
            type: ValueType.boolean, value: false,
          };

        }),
      },

    });


  }

  /**
   * this is a mess [not as bad as it used to be]
   */
  public SpreadCallback(vertex: SpreadsheetVertex, value: UnionValue): void {

    if (!vertex.address || !vertex.address.sheet_id) {
      throw new Error('spread callback called without sheet id');
    }
    const cells = this.cells_map[vertex.address.sheet_id];

    if (!cells) {
      throw new Error('spread callback called without cells');
    }

    if (!vertex || !vertex.reference) return;
    const area = vertex.reference.area;

    if (area) {
      const rows = area.rows;
      const columns = area.columns;

      // if (Array.isArray(value)) {
      if (value.type === ValueType.array) {

        // value = Utilities.Transpose2(value);
        const values = Utilities.Transpose2((value as ArrayUnion).value);

        // FIXME: recycle [?]

        for (let row = 0; row < rows; row++) {
          if (values[row]) {
            let column = 0;
            for (; column < columns && column < values[row].length; column++) {
              cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(values[row][column].value, values[row][column].type);
            }
            for (; column < columns; column++) {
              cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(undefined, ValueType.undefined);
            }
          }
          else {
            for (let column = 0; column < columns; column++) {
              cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(undefined, ValueType.undefined);
            }
          }
        }

      }
      else { 

        // single, recycle

        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) {
            cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(value.value, value.type);
          }
        }
        
      }

    }

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
        value: UnknownError(),
      };
    }

    return this.expression_calculator.Calculate(vertex.expression, vertex.address); // <- this one
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
        context?: ICellAddress,
        offset = false,
        offset_rows = 0,
        offset_columns = 0,
        resize_rows = 1,
        resize_columns = 1,
      ) : {dirty: boolean, area: Area}|undefined {

    if (!this.model) {
      // return UnknownError;
      return undefined;
    }

    // UPDATE: use current context (passed in as argument) to resolve
    // relative references. otherwise the reference will change depending
    // on current/active sheet

    let area = this.ResolveExpressionAddress(expression, context);

    if (!area) { return undefined; }

    // flag. we're going to check _all_ dependencies at once, just in
    // case (for this function this would only happen if the argument
    // is an array).

    let dirty = false;

//    if (area) {

      // check any dirty...

      // THIS IS ALMOST CERTAINLY WRONG. we should not be using active_sheet
      // here, we should use the area sheet. FIXME

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

            // const edge_result = 
            
            this.AddEdge({row, column, sheet_id}, this.expression_calculator.context.address);

            //if (edge_result) {
            //  return ReferenceError;
            //}

            dirty = true;

          }
        }
      }
//    }

    return { dirty, area };

  }

  /**
   * if locale has changed in Localization, update local resources.
   * this is necessary because (in chrome) worker doesn't get the system
   * locale properly (also, we might change it via parameter). we used to
   * just drop and reconstruct calculator, but we want to stop doing that
   * as part of supporting dynamic extension.
   */
  public UpdateLocale(): void {

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

  /** 
   * lookup in function library 
   * 
   * it seems like the only place this is called is within this class, 
   * so we could probably inline and drop this function
   * 
   * @deprecated
   */
  public GetFunction(name: string): ExtendedFunctionDescriptor {
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
  public RegisterFunction(map: FunctionMap): void {

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
   * wrap the attachdata function so we can update the expression calculator
   * at the same time (we should unwind this a little bit, it's an artifact
   * of graph being a separate class)
   */
  public AttachModel(model: DataModel): void {
    this.AttachData(model);
    this.expression_calculator.SetModel(model);
  }

  /**
   * wrapper method for calculation. this should be used for 1-time
   * calculations (i.e. not in a simulation).
   */
  public Calculate(model: DataModel, subset?: Area): void {

    // this.AttachData(model); // for graph. FIXME
    this.AttachModel(model);

    // this gets checked later, now... it would be better if we could
    // check it here are skip the later check, but that field is optional
    // it's better to report the error here so we can trace

    if (subset && !subset.start.sheet_id) {
      throw new Error('CalculateInternal called with subset w/out sheet ID')
    }

    if (this.full_rebuild_required) {
      subset = undefined;
      this.UpdateAnnotations();
      this.full_rebuild_required = false; // unset
    }

    // this.expression_calculator.SetModel(model);

    this.RebuildGraph(subset);

    try {
      this.Recalculate();
    }
    catch (err){
      console.error(err);
      console.info('calculation error trapped');
    }

  }

  /**
   * resets graph and graph status
   */
  public Reset(): void {

    this.FlushTree();
    if (this.model) {
      // this.AttachData(this.model);
      this.AttachModel(this.model);
    }
    this.full_rebuild_required = true;

  }

  /**
   * get a list of functions that require decorating with "_xlfn" on
   * export. the embed caller will pass this to the export worker.
   * since we manage functions, we can manage the list.
   * 
   * UPDATE: to support our MC functions (which may need _xll decoration),
   * map to type and then overload as necessary
   * 
   */
  public DecoratedFunctionList(): Record<string, string> {
    // const list: string[] = [];
    const map: Record<string, string> = {};

    const lib = this.library.List();
    for (const key of Object.keys(lib)) {
      const def = lib[key];
      if (def.xlfn) {
        // list.push(key);
        map[key] = '_xlfn';
      }
      else if (def.extension) {
        map[key] = '_xll';
      }
    }

    return map;
  }

  /** wrapper method ensures it always returns an Area (instance, not interface) */
  public ResolveArea(address: string|ICellAddress|IArea): Area {
    const resolved = this.ResolveAddress(address);
    return IsCellAddress(resolved) ? new Area(resolved) : new Area(resolved.start, resolved.end);
  }

  /** 
   * moved from embedded sheet. also modified to preserve ranges, so it
   * might return a range (area). if you are expecting the old behavior
   * you need to check (perhaps we could have a wrapper, or make it optional?)
   * 
   * Q: why does this not go in grid? or model? (...)
   * Q: why are we not preserving absoute/relative? (...)
   * 
   */
   public ResolveAddress(address: string|ICellAddress|IArea): ICellAddress|IArea {
    
    if (typeof address === 'string') {
      const parse_result = this.parser.Parse(address);
      if (parse_result.expression && parse_result.expression.type === 'address') {
        this.ResolveSheetID(parse_result.expression);
        return {
          row: parse_result.expression.row,
          column: parse_result.expression.column,
          sheet_id: parse_result.expression.sheet_id,
        };
      }
      else if (parse_result.expression && parse_result.expression.type === 'range') {
        this.ResolveSheetID(parse_result.expression);
        return {
          start: {
            row: parse_result.expression.start.row,
            column: parse_result.expression.start.column,
            sheet_id: parse_result.expression.start.sheet_id,
          },
          end: {
            row: parse_result.expression.end.row,
            column: parse_result.expression.end.column,
          }
        };
      }
      else if (parse_result.expression && parse_result.expression.type === 'identifier') {

        // is named range guaranteed to have a sheet ID? (I think yes...)

        const named_range = this.model?.named_ranges.Get(parse_result.expression.name);
        if (named_range) {
          return named_range;
        }
      }

      return { row: 0, column: 0 }; // default for string types -- broken

    }

    return address; // already range or address

  }

  /** moved from embedded sheet */
  public Evaluate(expression: string) {
    
    const parse_result = this.parser.Parse(expression);

    if (parse_result && parse_result.expression ){ 

      this.parser.Walk(parse_result.expression, (unit) => {
        if (unit.type === 'address' || unit.type === 'range') {
          this.ResolveSheetID(unit);
        }
        return true;
      });

      const result = this.CalculateExpression(parse_result.expression);

      if (result.type === ValueType.array) {
        return result.value.map(row => row.map(value => value.value));
      }
      else {
        return result.value;
      }

    }

    // or? (...)

    if (parse_result.error) {
      throw new Error(parse_result.error);
    }

    throw new Error('invalid expression');

  }

  /**
   * calculate an expression, optionally setting a fake cell address.
   * this may have weird side-effects.
   */
  public CalculateExpression(
      expression: ExpressionUnit,
      address: ICellAddress = {row: -1, column: -1},
      preserve_flags = false): UnionValue {

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
  public RebuildClean(model: DataModel, recalculate_if_volatile = false): void {

    this.full_rebuild_required = false; // unset

    // this.AttachData(model);
    // this.expression_calculator.SetModel(model);
    this.AttachModel(model);

    this.RebuildGraph();

    // add leaf vertices for annotations

    this.UpdateAnnotations(); // all

    // there's a weird back-and-forth that happens here 
    // (calculator -> graph -> calculator) to check for volatile
    // cells. it could probably be simplified.

    this.InitializeGraph();
    
    if (recalculate_if_volatile && this.volatile_list.length) {
      this.Recalculate();
    }

  }

  /**
   * remove duplicates from list, dropping absolute
   */
  public FlattenCellList(list: ICellAddress[]): ICellAddress[] {

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
  public MetadataReferences(formula: string): ICellAddress[] {
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

  public RemoveAnnotation(annotation: Annotation): void {
    const vertex = (annotation.temp.vertex as LeafVertex);
    if (!vertex) { return; }
    vertex.Reset();
    this.RemoveLeafVertex(vertex);
  }

  public UpdateAnnotations(list?: Annotation|Annotation[]): void {

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

  /**
   * returns false if the sheet cannot be resolved, which probably
   * means the name changed (that's the case we are working on with
   * this fix).
   */
  public ResolveSheetID(expr: UnitAddress|UnitRange, context?: ICellAddress): boolean {
    if (!this.model) { throw new Error('ResolveSheetID called without model'); }

    const target = expr.type === 'address' ? expr : expr.start;

    if (target.sheet_id) {
      return true;
    }

    if (target.sheet) {
      const lc = target.sheet.toLowerCase();
      for (const sheet of this.model.sheets) {
        if (sheet.name.toLowerCase() === lc) {
          target.sheet_id = sheet.id;
          return true;
        }
      }
    }
    else {
      target.sheet_id = context?.sheet_id || this.model.active_sheet.id;
      return true;
    }

    return false; // the error

  }

  // --- protected -------------------------------------------------------------

  /**
   * assuming the expression is an address, range, or named range, resolve
   * to an address/area. returns undefined if the expression can't be resolved.
   */
  protected ResolveExpressionAddress(expr: ExpressionUnit, context?: ICellAddress): Area|undefined {

    switch (expr.type) {
      case 'address':
        if (this.ResolveSheetID(expr, context)) {
          return new Area(expr);
        }
        break;

      case 'range':
        if (this.ResolveSheetID(expr, context)) {
          return new Area(expr.start, expr.end);
        }
        break;

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
  protected ConstructAddressUnit(address: ICellAddress, label: string, id: number, position: number): UnitAddress {
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
    ): DependencyList {

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

  protected UpdateLeafVertex(vertex: LeafVertex, formula: string): void {

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

  protected ApplyMacroFunctions(expression: ExpressionUnit): ExpressionUnit|undefined {

    if (!this.model) { return; }

    const count = Object.keys(this.model.macro_functions).length;
    if (!count) { return; }

    return this.ApplyMacroFunctionInternal(expression, this.model, []);

  }

  /** 
   * 
   */
  protected RebuildGraphCell(cell: Cell, address: ICellAddress2): void {

    // console.info("RGC", cell, address);

    // array head
    if (cell.area && cell.area.start.column === address.column && cell.area.start.row === address.row) {

      const {start, end} = cell.area;

      const sheet_id = start.sheet_id || address.sheet_id; // ... should always be ===
      if (!start.sheet_id) { start.sheet_id = sheet_id; }

      for (let column = start.column; column <= end.column; column++) {
        for (let row = start.row; row <= end.row; row++) {
          this.ResetInbound({ column, row, sheet_id }, true, false); // set dirty, don't create
        }
      }

      this.SetDirty(address); // implicitly creates vertex for array head (if it doesn't already exist)

      // implicit vertices from array head -> array members. this is required
      // to correctly propagate dirtiness if a referenced cell changes state
      // from array -> !array and vice-versa

      for (let column = start.column; column <= end.column; column++) {
        for (let row = start.row; row <= end.row; row++) {
          if (row === start.row && column === start.column) { continue; }

          this.AddEdge(start, {...start, row, column});
        }
      }

    }

    // formula?
    if (cell.type === ValueType.formula) {

      this.ResetInbound(address, true); // NOTE: sets dirty AND creates vertex if it doesn't exist
      const parse_result = this.parser.Parse(cell.value as string);

      // we have a couple of "magic" functions that can have loops
      // but shouldn't trigger circular references. we need to check
      // for those here...

      if (parse_result.expression) {

        // FIXME: move macro function parsing here; so that we don't
        // need special call semantics, and dependencies work as normal.

        // NOTE: the problem with that is you have to deep-parse every function,
        // here, to look for macros. that might be OK, but the alternative is
        // just to calculate them on demand, which seems a lot more efficient

        // TEMP removing old macro handling
        // const modified = this.ApplyMacroFunctions(parse_result.expression);
        // if (modified) { parse_result.expression = modified; }

        // ...

        if (parse_result.expression.type === 'call') {
          const func = this.library.Get(parse_result.expression.name);

          // this is for sparklines and checkboxes atm

          if (func && (func.render || func.click)) {
            cell.render_function = func.render;
            cell.click_function = func.click;
          }

        }

        const dependencies = this.RebuildDependencies(parse_result.expression, address.sheet_id, ''); // cell.sheet_id);

        for (const key of Object.keys(dependencies.ranges)) {
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

          /*
          range.Iterate((target: ICellAddress) => {
            this.AddEdge(target, address);
          });
          */

          // --- trying again... ---------------------------------------------

          if (range.entire_row || range.entire_column) {
            this.AddArrayEdge(range, address);
          }
          else {
            range.Iterate((target: ICellAddress) => this.AddEdge(target, address));
          }


          // --- end ---------------------------------------------------------

        }

        for (const key of Object.keys(dependencies.addresses)) {
          const dependency = dependencies.addresses[key];
          this.AddEdge(dependency, address);
        }

      }

      const vertex = this.GetVertex(address, true);

      if (vertex) {
        vertex.expression = parse_result.expression || { type: 'missing', id: -1 };
        vertex.expression_error = !parse_result.valid;
      }

    }
    else if (cell.value !== cell.calculated) {

      // sets dirty and removes inbound edges (in case the cell
      // previously contained a formula and now it contains a constant).

      this.ResetInbound(address, true, false); // NOTE: sets dirty
    }
    else if (cell.type === ValueType.undefined) {

      // in the new framework, we get here on any cleared cell, but
      // the behavior is OK

      // if we get here, it means that this cell was cleared but is not
      // 'empty'; in practice, that means it has a merge cell. reset inbound
      // and set dirty.

      // is this unecessarily flagging a number of cells? (...)

      this.ResetInbound(address, true, false, true);

      // we should be able to remove this vertex altogether; watch
      // out for arrays here

      // this.RemoveVertex(address); // implicit
      
    }
    else {

      // the reason you never get here is that the standard case is 
      // value !== calculated. if you enter a constant, we flush 
      // calculated first; so while the value doesn't change, it no 
      // longer === calculated.

      // this is just a constant?
      console.warn('UNHANDLED CASE', cell);

    }


  }

  /**
   * rebuild the graph; parse expressions, build a dependency map,
   * initialize edges between nodes.
   *
   * FIXME: if we want to compose functions, we could do that here,
   * which might result in some savings [?]
   */
  protected RebuildGraph(subset?: Area): void {

    if (subset) {

      if (!subset.start.sheet_id) {
        throw new Error('subset missing sheet id');
      }

      const cells = this.cells_map[subset.start.sheet_id];

      for (let row = subset.start.row; row <= subset.end.row; row++) {
        const row_array = cells.data[row];
        if (row_array) {
          for (let column = subset.start.column; column <= subset.end.column; column++) {
            const cell = row_array[column];
            if (cell) {
              this.RebuildGraphCell(cell, {row, column, sheet_id: subset.start.sheet_id});
            }
          }
        }
      }

    }
    else {
      for (const sheet of this.model?.sheets || []) {
        const rows = sheet.cells.data.length;
        for (let row = 0; row < rows; row++) {
          const row_array = sheet.cells.data[row];
          if (row_array) {
            const columns = row_array.length;
            for (let column = 0; column < columns; column++) {
              const cell = row_array[column];
              if (cell) {
                this.RebuildGraphCell(cell, {row, column, sheet_id: sheet.id});
              }
            }
          }
        }
      }
    }

  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected IsNativeOrTypedArray(val: unknown): boolean {
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

}
