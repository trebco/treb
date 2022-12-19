/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { Localization, Cell, Area, ICellAddress, ICellAddress2, ValueType, UnionValue,
         ArrayUnion, IArea, IsCellAddress, FlatCellData} from 'treb-base-types';
         
import { Parser, ExpressionUnit, DependencyList, UnitRange,
         DecimalMarkType, ArgumentSeparatorType, UnitAddress, UnitIdentifier } from 'treb-parser';

import { Graph } from './dag/graph';
import type { SpreadsheetVertex } from './dag/spreadsheet_vertex';
import type { CalculationResult } from './dag/spreadsheet_vertex_base';

import { ExpressionCalculator, UnionIsMetadata } from './expression-calculator';
import * as Utilities from './utilities';

import { FunctionLibrary } from './function-library';
import { ExtendedFunctionDescriptor, FunctionMap, ReturnType } from './descriptors';
import { AltFunctionLibrary, BaseFunctionLibrary } from './functions/base-functions';
import { FinanceFunctionLibrary } from './functions/finance-functions';
import { TextFunctionLibrary, TextFunctionAliases } from './functions/text-functions';
import { InformationFunctionLibrary } from './functions/information-functions';
import { StatisticsFunctionLibrary, StatisticsFunctionAliases } from './functions/statistics-functions';
import { ComplexFunctionLibrary } from './functions/complex-functions';
import { MatrixFunctionLibrary } from './functions/matrix-functions';

import * as Primitives from './primitives';

import type { DataModel, Annotation, FunctionDescriptor, Sheet } from 'treb-grid';
import { LeafVertex } from './dag/leaf_vertex';

import { ArgumentError, ReferenceError, UnknownError, ValueError, ExpressionError, NAError } from './function-error';

/**
 * options for the evaluate function
 */
export interface EvaluateOptions {

  /**
   * By default, the Evaluate function will evaluate the expression in the 
   * current locale, meaning it will use the current locale's decimal separator 
   * and argument separator.
   * 
   * If you do not want that behavior, set the argument separator explicitly.
   * That will force evaluation using either comma (,) or semicolon (;) as the
   * argument separator.
   * 
   * Decimal separator is implied by the argument separator. If you set the 
   * argument separator to comma, the decimal separator will be dot (.). If you
   * set the argument separator to semicolon, the decimal separator will be
   * comma (,). You cannot mix-and-match these characters.
   * 
   * Since you may not know where the code is being executed at run-time, 
   * using consistent argument and decimal separators makes sense. However we
   * are leaving the original behavior as default for backwards compatibility.  
   */
  argument_separator?: ','|';';

  /** 
   * allow R1C1-style references. the Evaluate function cannot use
   * offset references (e.g. R[-1]C[0]), so those will always fail. 
   * however it may be useful to use direct R1C1 references (e.g. R3C4),
   * so we optionally support that behind this flag.
   */
  r1c1?: boolean;
  
}

/**
 * we're providing a runtime option for how to handle complex numbers.
 * we will need to pass that into the calculator when it's created to
 * control which functions are loaded.
 */
export interface CalculatorOptions {

  /**
   * enable handling complex numbers in function calculation. 
   * @see EmbeddedSpreadsheetOptions
   */
  complex_numbers: 'on'|'off';

}

const default_calculator_options: CalculatorOptions = {
  complex_numbers: 'off',
};

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

  // FIXME: need a way to share/pass parser flags

  public readonly parser: Parser = new Parser();

  protected readonly library = new FunctionLibrary();

  protected registered_libraries: Record<string, boolean> = {};

//  protected notifier_id_source = 100;
//  protected notifiers: InternalNotifierType[] = [];

  // protected graph: Graph = new Graph(); // |null = null;
  // protected status: GraphStatus = GraphStatus.OK;

  // FIXME: why is this a separate class? [actually is this a composition issue?]
  protected expression_calculator = new ExpressionCalculator(
      this.library,
      this.parser);

  /** the next calculation must do a full rebuild -- set on reset */
  protected full_rebuild_required = false;

  constructor(protected readonly model: DataModel, calculator_options: Partial<CalculatorOptions> = {}) {

    super();

    // at the moment options are only used here; in the future
    // we may need to extend handling.

    const options: CalculatorOptions = {
      ...default_calculator_options, 
      ...calculator_options,
    };

    if (options.complex_numbers === 'on') {

      // complex number handling: we need to change SQRT, POWER and ^

      for (const key of Object.keys(AltFunctionLibrary)) {
        BaseFunctionLibrary[key] = AltFunctionLibrary[key];
      }

      Primitives.UseComplex();


    }

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

          // console.info({range, data});

          // console.info({range});

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
          name: 'columns', description: 'number of columns to offset' }, {
          name: 'height', }, {
          name: 'width', },

        ],
        return_type: ReturnType.reference,
        volatile: true,
        fn: ((reference: UnionValue, rows = 0, columns = 0, height?: number, width?: number): UnionValue => {

          if (!reference) {
            return ArgumentError();
          }

          // const parse_result = this.parser.Parse(reference);
          // if (parse_result.error || !parse_result.expression) {
          //  return ReferenceError;
          //}

          if (reference.type === ValueType.array) {

            // subset array. this is constructed, so we can take ownership
            // and modify it, although it would be safer to copy. also, what's
            // the cost of functional vs imperative loops these days?

            const end_row = typeof height === 'number' ? (rows + height) : undefined;
            const end_column = typeof width === 'number' ? (columns + width) : undefined;

            const result: UnionValue = {
              type: ValueType.array,
              value: reference.value.slice(rows, end_row).map(row => row.slice(columns, end_column)),
            };

            return result;

          }

          // we need a proper type for this... also it might be a range

          if (!UnionIsMetadata(reference)) {
            console.info('e2', {reference})
            return ReferenceError(); 
          }

          const check_result = this.DynamicDependencies(
            reference.value.address,
            this.expression_calculator.context.address,
            true, rows, columns, width, height);

          if (!check_result) {
            console.info('e1', {check_result})
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
       */
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
       */
      Index: {
        arguments: [
          { name: 'range', boxed: true }, 
          { name: 'row', }, 
          { name: 'column', }
        ],
        volatile: false,

        // FIXME: handle full row, full column calls
        fn: (data: UnionValue, row?: number, column?: number) => {

          // ensure array
          if (data && data.type !== ValueType.array) {
            data = {
              type: ValueType.array,
              value: [[data]],
            };
          }

          if (row && column) {

            // simple case: 2 indexes

            const c = data.value[column - 1];
            if (c) {
              const cell = c[row - 1];
              if (cell) {
                return cell;
              }
            }
          }
          else if (row) {

            // return an array

            const value: UnionValue[][] = [];
            for (const c of data.value) {
              if (!c[row - 1]) {
                return ArgumentError();
              }
              value.push([c[row-1]]);
            }
            return {
              type: ValueType.array,
              value,
            };
          }
          else if (column) {

            // return an array

            const c = data.value[column - 1];
            if (c) {
              return {
                type: ValueType.array,
                value: [c],
              };
            }
          }

          return ArgumentError();
          
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

          const sheet = this.model.sheets.Find(ref?.value?.address?.sheet_id || 0);
          if (sheet) {
            const cell = sheet.cells.GetCell(ref.value.address, false);
            return { 
              type: ValueType.boolean, 
              value: cell?.type === ValueType.formula,
            };
          }

          return { 
            type: ValueType.boolean, value: false,
          };

        }),
      },

    });


  }

  /**
   * support for co-editing. we need to export calculated values from
   * the leader instance, because things like RAND() and NOW() are 
   * nondeterministic (within reason). 
   * 
   * so the leader does the calculation and then we broadcast calculated
   * values to followers.
   */
  public ExportCalculatedValues(): Record<number, FlatCellData[]> {
    const data: any = {};
    for (const sheet of this.model.sheets.list) {
      const calculated = sheet.cells.toJSON({calculated_value: true}).data as FlatCellData[];
      data[sheet.id] = calculated.filter(test => test.calculated !== undefined);
    }
    return data;
  }

  /**
   * support for co-editing. if we get calculated values from the leader,
   * we need to apply them to cells.
   * 
   * to _see_ the data, you still have to make a couple of calls to repaint
   * and update annotations. see EmbeddedSpreadsheetBase.Recalculate for hints.
   * 
   * note that we're checking for list mismatch in one direction but not the 
   * other direction. should probably check both.
   */
  public ApplyCalculatedValues(data: Record<number, FlatCellData[]>): void {
    for (const sheet of this.model.sheets.list) {
      const cells = data[sheet.id];
      if (!cells) {
        console.info('mismatch', sheet.id);
      }
      else {
        for (const cell of cells) {
          sheet.cells.data[cell.row][cell.column].SetCalculatedValue(cell.calculated);
          // console.info(sheet.id, cell.row, cell.column, '->', cell.calculated);
        }
      }
    }
  }

  /**
   * this is a mess [not as bad as it used to be]
   */
  public SpreadCallback(vertex: SpreadsheetVertex, value: UnionValue): void {

    if (!vertex.address || !vertex.address.sheet_id) {
      throw new Error('spread callback called without sheet id');
    }
    // const cells = this.cells_map[vertex.address.sheet_id];
    const cells = this.model.sheets.Find(vertex.address.sheet_id)?.cells;

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

    let sheet: Sheet|undefined;

    if (expression.type === 'address' || expression.type === 'range') {
      const address_expression = (expression.type === 'range') ? expression.start : expression;
      if (address_expression.sheet_id) {
        sheet = this.model.sheets.Find(address_expression.sheet_id);

        /*
        for (const test of this.model.sheets) {
          if (test.id === address_expression.sheet_id) {
            sheet = test;
            break;
          }
        }
        */
      }
      else if (address_expression.sheet) {
        sheet = this.model.sheets.Find(address_expression.sheet);

        /*
        const lc = address_expression.sheet.toLowerCase();
        for (const test of this.model.sheets) {
          if (test.name.toLowerCase() === lc) {
            sheet = test;
            break;
          }
        }
        */
      }
    }

    if (!sheet && context?.sheet_id) {
      sheet = this.model.sheets.Find(context.sheet_id);

      /*
      for (const test of this.model.sheets) {
        if (test.id === context.sheet_id) {
          sheet = test;
          break;
        }
      }
      */
    }

    if (!sheet) {
      throw new Error('missing sheet in dynamic dependencies [b21]');
    }

      // check any dirty...

      // THIS IS ALMOST CERTAINLY WRONG. we should not be using active_sheet
      // here, we should use the area sheet. FIXME

      area = sheet.RealArea(area); 

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

  /* * 
   * lookup in function library 
   * 
   * it seems like the only place this is called is within this class, 
   * so we could probably inline and drop this function
   * 
   * @deprecated
   * /
  public GetFunction(name: string): ExtendedFunctionDescriptor {
    return this.library.Get(name);
  }
  */

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

    for (const macro of this.model.macro_functions.values()) {
      function_list.push({
        name: macro.name,
        description: macro.description,
        arguments: (macro.argument_names || []).map(argument => {
          return { name: argument };
        }),
      });
    }

    /*
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
    */

    return function_list;

  }

  /**
   * 
   * @param name 
   * @param map 
   */
  public RegisterLibrary(name: string, map: FunctionMap): boolean {
    if (this.registered_libraries[name]) {
      return false;
    }
    this.RegisterFunction(map);
    this.registered_libraries[name] = true;
    return true;
  }

  /**
   * dynamic extension
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
  public AttachModel(): void {
    // this.RebuildMap();
    this.expression_calculator.SetModel(this.model);
  }

  /**
   * wrapper method for calculation
   */
  public Calculate(subset?: Area): void {

    this.AttachModel();

    // this gets checked later, now... it would be better if we could
    // check it here are skip the later check, but that field is optional
    // it's better to report the error here so we can trace

    if (subset && !subset.start.sheet_id) {
      throw new Error('CalculateInternal called with subset w/out sheet ID')
    }

    if (this.full_rebuild_required) {
      subset = undefined;
      this.UpdateAnnotations();
      // this.UpdateNotifiers();
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

    /*
    const callbacks: NotifierType[] = [];
    for (const notifier of this.notifiers) {
      if (notifier.vertex.state_id !== notifier.state) {
        notifier.state = notifier.vertex.state_id;
        if (notifier.notifier.callback) {
          callbacks.push(notifier.notifier);
        }
      }
    }

    if (callbacks.length) {
      Promise.resolve().then(() => {
        for (const notifier of callbacks) {
          if (notifier.callback) {
            notifier.callback.call(undefined, notifier);
          }
        }
      });
    }
    */

  }

  /**
   * resets graph and graph status. this is called when structure changes --
   * such as adding or removing sheets -- so we need to preserve notifiers
   * across resets. we need to either add a flag or add a separate method
   * to handle clearing notifiers.
   */
  public Reset(): void {

    this.FlushTree();
    this.AttachModel();

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
  public ResolveArea(address: string|ICellAddress|IArea, active_sheet: Sheet): Area {
    const resolved = this.ResolveAddress(address, active_sheet);
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
   public ResolveAddress(address: string|ICellAddress|IArea, active_sheet: Sheet): ICellAddress|IArea {
    
    if (typeof address === 'string') {
      const parse_result = this.parser.Parse(address);
      if (parse_result.expression && parse_result.expression.type === 'address') {
        this.ResolveSheetID(parse_result.expression, undefined, active_sheet);
        return {
          row: parse_result.expression.row,
          column: parse_result.expression.column,
          sheet_id: parse_result.expression.sheet_id,
        };
      }
      else if (parse_result.expression && parse_result.expression.type === 'range') {
        this.ResolveSheetID(parse_result.expression, undefined, active_sheet);
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

        const named_range = this.model.named_ranges.Get(parse_result.expression.name);
        if (named_range) {
          return named_range;
        }
      }

      return { row: 0, column: 0 }; // default for string types -- broken

    }

    return address; // already range or address

  }

  /** moved from embedded sheet */
  public Evaluate(expression: string, active_sheet?: Sheet, options: EvaluateOptions = {}) {
    
    const current = this.parser.argument_separator;
    const r1c1_state = this.parser.flags.r1c1;

    if (options.argument_separator) {
      if (options.argument_separator === ',') {
        this.parser.argument_separator = ArgumentSeparatorType.Comma;
        this.parser.decimal_mark = DecimalMarkType.Period;
      }
      else {
        this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
        this.parser.decimal_mark = DecimalMarkType.Comma;
      }
    }

    if (options.r1c1) {
      this.parser.flags.r1c1 = options.r1c1;
    }

    const parse_result = this.parser.Parse(expression);

    // reset

    this.parser.argument_separator = current;
    this.parser.decimal_mark = (current === ArgumentSeparatorType.Comma) ? DecimalMarkType.Period : DecimalMarkType.Comma;
    this.parser.flags.r1c1 = r1c1_state;

    // OK

    if (parse_result && parse_result.expression ){ 

      this.parser.Walk(parse_result.expression, (unit) => {
        if (unit.type === 'address' || unit.type === 'range') {

          // don't allow offset references, even in R1C1
          if (unit.type === 'address') {
            if (unit.offset_column || unit.offset_row) {
              throw new Error(`Evaluate does not support offset references`);
            }
          }
          else {
            if (unit.start.offset_column || unit.start.offset_row || unit.end.offset_column || unit.end.offset_row) {
              throw new Error(`Evaluate does not support offset references`);
            }
          }

          this.ResolveSheetID(unit, undefined, active_sheet);
        }
        return true;
      });

      // console.info({expression: parse_result.expression})
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
  public RebuildClean(recalculate_if_volatile = false): void {

    this.full_rebuild_required = false; // unset

    this.AttachModel();

    this.RebuildGraph();

    // add leaf vertices for annotations

    this.UpdateAnnotations(); // all

    // and notifiers

    // this.UpdateNotifiers();

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


  /* * remove all notifiers * /
  public RemoveNotifiers(): void {
    for (const internal of this.notifiers) {
      if (internal.vertex) {
        internal.vertex.Reset();
        this.RemoveLeafVertex(internal.vertex);
      }
    }
    this.notifiers = [];
  }
  */

  /* * 
   * remove specified notifier. you can pass the returned ID or the original
   * object used to create it.
   * /
  public RemoveNotifier(notifier: NotifierType|number): void {

    let internal: InternalNotifierType|undefined;

    this.notifiers = this.notifiers.filter(test => {
      if (test.id === notifier || test === notifier) {
        internal = test;
        return false;
      }
      return true;
    });

    if (!internal) {
      // FIXME: error
      console.warn('invalid notifier');
    }
    else {

      // remove vertex
      if (internal.vertex) {
        internal.vertex.Reset();
        this.RemoveLeafVertex(internal.vertex);
      }

    }

  }
  */

  /* *
   * update a notifier or notifiers, or the entire list (default).
   * /
  protected UpdateNotifiers(notifiers: InternalNotifierType|InternalNotifierType[] = this.notifiers): void {

    if (!Array.isArray(notifiers)) {
      notifiers = [notifiers];
    }

    for (const notifier of notifiers) {

      if (notifier.vertex) {
        notifier.vertex.Reset();
      }
      else {
        notifier.vertex = new LeafVertex();
      }

      // construct formula (inlining)

      const string_reference = notifier.references.map(reference => {

        // I don't want to go through strings here... OTOH if we build an 
        // expression manually it's going to be fragile to changes in the
        // parser...

        let sheet_name = '';
        let base: ICellAddress;
        let label = '';

        if (reference.count === 1) {
          base = reference.start;
          label = Area.CellAddressToLabel(reference.start, false);
        }
        else {
          base = reference.start;
          label = Area.CellAddressToLabel(reference.start, false) + ':' +
                  Area.CellAddressToLabel(reference.end, false);
        }

        for (const sheet of this.model.sheets.list) {
          if (sheet.id === base.sheet_id) {
            sheet_name = sheet.name;
            break;
          }
        }

        if (!sheet_name) {
          throw new Error('invalid sheet in reference');
        }

        if (QuotedSheetNameRegex.test(sheet_name)) {
          return `'${sheet_name}'!${label}`;
        }

        return `${sheet_name}!${label}`;

      }).join(',');

      // the function (here "Notify") is never called. we're using a leaf
      // node, which bypasses the standard calculation system and only updates
      // a state reference when dirty. so here it's just an arbitrary string.

      // still, we should use something that's not going to be used elsewhere
      // in the future...

      const formula = `=Internal.Notify(${string_reference})`;
      // console.info('f', formula);

      // we (theoretically) guarantee that all refeerences are qualified,
      // so we don't need a context (active sheet) for relative references.
      // we can just use model[0]

      this.AddLeafVertex(notifier.vertex);
      this.UpdateLeafVertex(notifier.vertex, formula, this.model.sheets.list[0]);

      // update state (gets reset?)

      notifier.state = notifier.vertex.state_id;
      
    }
  }
  */

  /* *
   * new notification API (testing)
   * /
  public AddNotifier(references: RangeReference|RangeReference[], notifier: NotifierType, context: Sheet): number {

    if (!Array.isArray(references)) {
      references = [references];
    }

    // even if these are strings we want to properly resolve them so
    // we can store qualified references
   
    const qualified: Area[] = references.map(reference => {

      if (typeof reference === 'string') {
        return this.ResolveArea(reference, context).Clone();
      }
      if (IsCellAddress(reference)) {
        return new Area({
            ...reference, 
            sheet_id: reference.sheet_id || context.id,
          });
      }

      return new Area({
          ...reference.start, 
          sheet_id: reference.start.sheet_id || context.id,
        }, {
          ...reference.end, 
        });

    });

    const internal: InternalNotifierType = {
      id: this.notifier_id_source++,
      notifier,
      references: qualified,
      vertex: new LeafVertex(), 
      state: 0,
    };

    // update
    this.UpdateNotifiers(internal);

    // push to notifications
    this.notifiers.push(internal);
    
    return internal.id;

  }
  */

  public RemoveAnnotation(annotation: Annotation): void {
    const vertex = (annotation.temp.vertex as LeafVertex);
    if (!vertex) { return; }
    vertex.Reset();
    this.RemoveLeafVertex(vertex);
  }

  public UpdateAnnotations(list?: Annotation|Annotation[], context?: Sheet): void {

    if (!list) {

      // update: since we don't have access to active_sheet, 
      // just add all annotations. slightly less efficient 
      // (perhaps) but better for handling multiple views.

      for (const sheet of this.model.sheets.list) {
        this.UpdateAnnotations(sheet.annotations, sheet);
      }

      return;

    }

    if (!context) {
      throw new Error('invalid call to UpdateAnnotations with list but no sheet');
    }

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
        this.UpdateLeafVertex(vertex, entry.formula, context);
      }
    }

  }

  /**
   * returns false if the sheet cannot be resolved, which probably
   * means the name changed (that's the case we are working on with
   * this fix).
   */
  public ResolveSheetID(expr: UnitAddress|UnitRange, context?: ICellAddress, active_sheet?: Sheet): boolean {

    const target = expr.type === 'address' ? expr : expr.start;

    if (target.sheet_id) {
      return true;
    }

    if (target.sheet) {
      const sheet = this.model.sheets.Find(target.sheet);
      if (sheet) {
        target.sheet_id = sheet.id;
        return true;
      }

      /*
      const lc = target.sheet.toLowerCase();
      for (const sheet of this.model.sheets.list) {
        if (sheet.name.toLowerCase() === lc) {
          target.sheet_id = sheet.id;
          return true;
        }
      }
      */
    }
    else if (context?.sheet_id) {
      target.sheet_id = context.sheet_id;
      return true;
    }
    else if (active_sheet?.id) {
      target.sheet_id = active_sheet.id;
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
        {
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
    ): DependencyList {

    if (!relative_sheet_name) {
      const sheet = this.model.sheets.Find(relative_sheet_id);
      if (sheet) {
        relative_sheet_name = sheet.name;
      }
    }

    switch (unit.type){

      case 'literal':
      case 'missing':
      case 'operator':
        break;

      case 'identifier':
        {
          // update to handle named expressions. just descend into
          // the expression as if it were inline.
          
          const normalized = unit.name.toUpperCase();

          if (this.model.named_expressions.has(normalized)) {
            const expr = this.model.named_expressions.get(normalized);
            if (expr) {
              this.RebuildDependencies(expr, relative_sheet_id, relative_sheet_name, dependencies);
            }
          }
          else {
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
        }
        break;

      case 'address':

        if (!unit.sheet_id) {
          if (unit.sheet) {
            const sheet = this.model.sheets.Find(unit.sheet);
            if (sheet) {
              unit.sheet_id = sheet.id;
            }
          }
          else {
            unit.sheet_id = relative_sheet_id;
            unit.sheet = relative_sheet_name;
          }

          /*
          unit.sheet_id = unit.sheet ?
            (sheet_name_map[unit.sheet.toLowerCase()] || 0) :
            relative_sheet_id;
          if (!unit.sheet) { unit.sheet = relative_sheet_name; }
          */

        }
        if (!unit.sheet_id) {

          // FIXME: we don't necessarily need to warn here, because we'll
          // get a warning when it tries to calculate. still this is helpful
          // for debugging.

          console.warn('invalid address in range [9d]');
        }
        else {
          dependencies.addresses[unit.sheet_id + '!' + unit.label] = unit;
        }
        break; // this.AddressLabel(unit, offset);

      case 'range':
        if (!unit.start.sheet_id) {
          if (unit.start.sheet) {
            const sheet = this.model.sheets.Find(unit.start.sheet);
            if (sheet) {
              unit.start.sheet_id = sheet.id;
            }
          }
          else {
            unit.start.sheet_id = relative_sheet_id;
            unit.start.sheet = relative_sheet_name;
          }

          /*
          unit.start.sheet_id = unit.start.sheet ?
            (sheet_name_map[unit.start.sheet.toLowerCase()] || 0) :
            relative_sheet_id;
          if (!unit.start.sheet) { unit.start.sheet = relative_sheet_name; }
          */

        }
        if (!unit.start.sheet_id) {

          // see above in the address handler

          console.warn('invalid sheet in range', unit);
        }
        else {
          dependencies.ranges[unit.start.sheet_id + '!' + unit.start.label + ':' + unit.end.label] = unit;
        }
        break;

      case 'unary':
        this.RebuildDependencies(unit.operand, relative_sheet_id, relative_sheet_name, dependencies);//, sheet_name_map);
        break;

      case 'binary':
        this.RebuildDependencies(unit.left, relative_sheet_id, relative_sheet_name, dependencies);//, sheet_name_map);
        this.RebuildDependencies(unit.right, relative_sheet_id, relative_sheet_name, dependencies);//, sheet_name_map);
        break;

      case 'group':
        unit.elements.forEach((element) =>
          this.RebuildDependencies(element, relative_sheet_id, relative_sheet_name, dependencies));//, sheet_name_map));
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

                this.RebuildDependencies(args[index], relative_sheet_id, relative_sheet_name, undefined);//, sheet_name_map);

                args[index] = { type: 'missing', id: -1 };
              }
            });
          }
          args.forEach((arg) => this.RebuildDependencies(arg, relative_sheet_id, relative_sheet_name, dependencies));//, sheet_name_map));

        }
        break;

    }

    return dependencies;
  }

  protected UpdateLeafVertex(vertex: LeafVertex, formula: string, context: Sheet): void {

    vertex.Reset();

    const parse_result = this.parser.Parse(formula);
    if (parse_result.expression) {
      const dependencies =
        this.RebuildDependencies(
          parse_result.expression,
          // this.model.active_sheet.id,
          // this.model.active_sheet.name,
          context.id,
          context.name,
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

  /* *
   * we're passing model here to skip the test on each call
   * 
   * @param unit 
   * @param model 
   * /
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
  */

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

      // actually we do get here in the case of an array head with
      // a constant value. so we should stop shouting about it.

      // this is just a constant?
      // console.warn('UNHANDLED CASE', cell);

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

      // const cells = this.cells_map[subset.start.sheet_id];
      const cells = this.model.sheets.Find(subset.start.sheet_id)?.cells;

      if (cells) {
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

    }
    else {
      for (const sheet of this.model.sheets.list || []) {
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
