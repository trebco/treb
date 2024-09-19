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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import type { Cell, ICellAddress, ICellAddress2, UnionValue, EvaluateOptions,
         ArrayUnion, IArea, CellDataWithAddress, CellValue,
         Cells} from 'treb-base-types';
import { Localization, Area, ValueType, IsCellAddress} from 'treb-base-types';
         
import type { ExpressionUnit, DependencyList, UnitRange, UnitAddress, UnitIdentifier, ParseResult } from 'treb-parser';
import { Parser, DecimalMarkType, QuotedSheetNameRegex } from 'treb-parser';

import { Graph } from './dag/graph';
import type { SpreadsheetVertex } from './dag/spreadsheet_vertex';
import type { CalculationResult } from './dag/spreadsheet_vertex_base';

import { ExpressionCalculator, UnionIsMetadata } from './expression-calculator';
import * as Utilities from './utilities';
import { StringUnion } from './utilities';

import { FunctionLibrary } from './function-library';
import type { FunctionMap } from './descriptors';
// import * as Utils from './utilities';

import { AltFunctionLibrary, BaseFunctionLibrary } from './functions/base-functions';
import { FinanceFunctionLibrary } from './functions/finance-functions';
import { TextFunctionLibrary, TextFunctionAliases } from './functions/text-functions';
import { InformationFunctionLibrary } from './functions/information-functions';
import { StatisticsFunctionLibrary, StatisticsFunctionAliases } from './functions/statistics-functions';
import { ComplexFunctionLibrary } from './functions/complex-functions';
import { MatrixFunctionLibrary } from './functions/matrix-functions';
import { RegexFunctionLibrary } from './functions/regex-functions';

import { Variance } from './functions/statistics-functions';

import * as Primitives from './primitives';

import type { FunctionDescriptor } from 'treb-grid';
import type { LeafVertex } from './dag/graph';

import { ArgumentError, ReferenceError, UnknownError, ValueError, ExpressionError, NAError, DivideByZeroError, NotImplError } from './function-error';
import { StateLeafVertex } from './dag/state_leaf_vertex';
import { CalculationLeafVertex } from './dag/calculation_leaf_vertex';

import { Sheet } from 'treb-data-model';
import type { Annotation, DataModel, ConnectedElementType, ConditionalFormat } from 'treb-data-model';

import { ValueParser } from 'treb-format';

/**
 * breaking this out so we can use it for export (TODO)
 * 
 * @param type 
 * @returns 
 */
const TranslateSubtotalType = (type: string|number): number => {

  if (typeof type === 'string') {
    type = type.toUpperCase();
    switch (type) {
      case 'AVERAGE':
      case 'MEAN':
        type = 101;
        break;

      case 'COUNT':
        type = 102;
        break;

      case 'COUNTA':
        type = 103;
        break;

      case 'MAX':
        type = 104;
        break;

      case 'MIN':
        type = 105;
        break;

      case 'PRODUCT':
        type = 106;
        break;
          
      case 'STDEV':
        type = 107;
        break;

      case 'STDEVP':
        type = 108;
        break;
          
      case 'SUM':
        type = 109;
        break;

      case 'VAR':
        type = 110;
        break;

      case 'VARP':
        type = 111;
        break;
              
      default:
        type = 0;
        break;
    }
  }
  
  return type;

};

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

  /** enable spill arrays */
  spill?: boolean;

}

const default_calculator_options: CalculatorOptions = {
  complex_numbers: 'off',
  spill: false, 
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

  /** 
   * localized parser instance. we're sharing. 
   * FIXME: remove local references so we can remove this accessor 
   */
  protected get parser(): Parser {
    return this.model.parser;
  }

  protected readonly library = new FunctionLibrary();

  protected registered_libraries: Record<string, boolean> = {};

  protected expression_calculator: ExpressionCalculator;

  /** the next calculation must do a full rebuild -- set on reset */
  protected full_rebuild_required = false;

  protected options: CalculatorOptions;

  /**
   * this is a flag we're using to communicate back to the embedded
   * sheet, when the grid has expanded as a result of a calculation 
   * (because of a spill).
   */
  public grid_expanded = false;

  constructor(protected readonly model: DataModel, calculator_options: Partial<CalculatorOptions> = {}) {

    super();

    this.expression_calculator = new ExpressionCalculator(this.model, this.library, this.parser);


    // at the moment options are only used here; in the future
    // we may need to extend handling.

    this.options = {
      ...default_calculator_options, 
      ...calculator_options,
    };

    if (this.options.complex_numbers === 'on') {

      // complex number handling: we need to change SQRT, POWER and ^

      for (const key of Object.keys(AltFunctionLibrary)) {
        BaseFunctionLibrary[key] = AltFunctionLibrary[key];
      }

      Primitives.UseComplex();


    }

    // FIXME: why is this called here, if model now owns it?
    // TODO: move to model

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
      RegexFunctionLibrary,
      );
   
    // aliases
    for (const key of Object.keys(StatisticsFunctionAliases)) {
      this.library.Alias(key, StatisticsFunctionAliases[key]);
    }
    for (const key of Object.keys(TextFunctionAliases)) {
      this.library.Alias(key, TextFunctionAliases[key]);
    }

    // special functions... need reference to the graph (this)
    // moving countif here so we can reference it in COUNTIFS... 

    /*
    const FlattenBooleans = (value: ArrayUnion) => {
      const result: boolean[] = [];
      for (const col of value.value) {
        for (const entry of col) {
          result.push(entry.type === ValueType.boolean && entry.value);
        }
      }
      return result;
    };
    */

    /**
     * this is a function that does sumif/averageif/countif.
     * args is one or more sets of [criteria_range, criteria]
     */
    const XIf = (type: 'sum'|'count'|'average', value_range: CellValue[][], ...args: unknown[]): UnionValue => {

      const filter: boolean[] = [];

      for (let i = 0; i < args.length; i += 2) {
        if (Array.isArray(args[i])) {
          const step = CountIfInternal(args[i] as CellValue[][], args[i+1] as CellValue);
          if (step.type !== ValueType.array) {
            return step;
          }
          for (const [r, cell] of step.value[0].entries()) {
            filter[r] = (!!cell.value && (filter[r] !== false));
          }
        }
      }

      const values = Utilities.FlattenCellValues(value_range, true); // keep undefineds
        
      let count = 0;
      let sum = 0;
      for (const [index, test] of filter.entries()) {
      if (test) {
          count++; 
          const value = values[index];
          if (typeof value === 'number') {
            sum += value;
          }
        }
      }

      switch (type) {
        case 'count': 
          return { type: ValueType.number, value: count };

        case 'sum':
          return { type: ValueType.number, value: sum };

        case 'average':
          if (count === 0) {
            return DivideByZeroError();
          }
          return { type: ValueType.number, value: sum/count };
      }


    }

    const CountIfInternal = (range: CellValue[][], criteria: CellValue): UnionValue => {

      // do we really need parser/calculator for this? I think
      // we've maybe gone overboard here, could we just use valueparser
      // on the criteria and then calculate normally? I think we might...
      // in any event there are no dynamic dependencies with this 
      // function.

      const data = Utilities.FlattenCellValues(range, true); // keep undefineds, important for mapping

      let parse_result: ParseResult|undefined;
      let expression: ExpressionUnit|undefined;

      // we'll handle operator and operand separately

      let operator = '=';

      // handle wildcards first. if we have a wildcard we use a
      // matching function so we can centralize. 
      
      if (typeof criteria === 'string') {

        // normalize first, pull out operator

        criteria = criteria.trim();
        const match = criteria.match(/^([=<>]+)/);
        if (match) {
          operator = match[1];
          criteria = criteria.substring(operator.length);
        }

        const value_parser_result = ValueParser.TryParse(criteria);
        if (value_parser_result?.type === ValueType.string) {
          criteria = `"${value_parser_result.value}"`;
        }
        else {
          criteria = value_parser_result?.value?.toString() || '';
        }

        // console.info({operator, criteria});

        // check for wildcards (this will false-positive on escaped 
        // wildcards, which will not break but will waste cycles. we 
        // could check. TOOD/FIXME)

        if (/[?*]/.test(criteria)) {

          // NOTE: we're not specifying an argument separator when writing
          // functions, because that might break numbers passed as strings.
          // so we write the function based on the current separator.

          const separator = this.parser.argument_separator;

          if (operator === '=' || operator === '<>') {

            parse_result = this.parser.Parse(`=WildcardMatch({}${separator} ${criteria}${separator} ${operator === '<>'})`);
            expression = parse_result.expression;

            if (parse_result.error || !expression) {
              return ExpressionError();
            }

            if (expression?.type === 'call' && expression.args[0]?.type === 'array') {
              expression.args[0].values = [Utilities.FilterIntrinsics(data, true)];
            }

          }
          
        }

      }
      else {

        // if it's not a string, by definition it doesn't have an 
        // operator so use equality (default). it does not need 
        // escaping.

        criteria = (criteria || 0).toString();

      }
      
      if (!parse_result) {

        parse_result = this.parser.Parse('{}' + operator + criteria);
        expression = parse_result.expression;

        if (parse_result.error || !expression) {
          return ExpressionError();
        }
        if (expression.type !== 'binary') {
          console.warn('invalid expression [1]', expression);
          return ExpressionError();
        }
        if (expression.left.type !== 'array') {
          console.warn('invalid expression [1]', expression);
          return ExpressionError();
        }

        // this is only going to work for binary left/right. it won't
        // work if we change this to a function (wildcard match)
        
        // this will not happen anymore, we can remove

        if (expression.right.type === 'identifier') {

          console.warn('will never happen');

          expression.right = {
            ...expression.right,
            type: 'literal',
            value: expression.right.name,
          }
        }

        expression.left.values = [Utilities.FilterIntrinsics(data, true)];

      }

      if (!expression) {
        return ValueError();
      }

      const result = this.CalculateExpression(expression);
      return result;

    };

    this.library.Register({

      /**
       * this function is here because it checks whether rows are hidden or 
       * not. cell dependencies don't track that, so we need to do it here. 
       * and it needs to be volatile. this is an ugly, ugly function.
       */
      Subtotal: {
        arguments: [
          { name: 'type' },
          { name: 'range', metadata: true, }
        ],
        fn: (type: number|string, ...args: UnionValue[]): UnionValue => {

          type = TranslateSubtotalType(type);

          // validate, I guess

          if (type > 100) { 
            type -= 100; 
          }

          if (type < 1 || type > 11) {
            return ArgumentError();
          }

          // any number of ranges are allowed, they will inherit
          // the properties of the last argument so they will all
          // return metadata

          const flat = Utilities.FlattenBoxed(args);

          // values is the set of values from the arguments that
          // are numbers -- not strings, not errors -- and are not
          // hidden. that last thing is the hard part.

          // there's one other thing we care about which is non-empty,
          // for COUNTA -- we can do that separately

          const values: number[] = [];
          let counta = 0;
          let sum = 0;

          let sheet: Sheet|undefined;

          for (const entry of flat) {

            // where is the metadata type? sigh

            const address = ((entry.value as {address?: UnitAddress})?.address) as UnitAddress;

            if (!address) {
              return ReferenceError();
            }

            if (!sheet || sheet.id !== address.sheet_id) {

              if (!address.sheet_id) {
                console.warn('invalid reference in metadata')
                return ReferenceError();
              }
              
              sheet = this.model.sheets.Find(address.sheet_id);
              if (!sheet) {
                console.warn('invalid sheet in metadata')
                return ReferenceError();
              }

            }

            const height = sheet.GetRowHeight(address.row);
            if (!height) {
              continue;
            }

            const entry_value = (entry.value as {value?: CellValue})?.value;

            // counta includes empty strings

            if (typeof entry_value === 'undefined') {
              continue;
            }

            counta++;

            if (typeof entry_value === 'number') {
              sum += entry_value;
              values.push(entry_value);
            }

          }

          let value = 0;

          switch (type) {
            case 1:   // average
              if (values.length === 0) { return DivideByZeroError(); }
              value = sum / values.length;
              break;

            case 2:   // count
              value = values.length;
              break;

            case 3:   // counta
              value = counta;
              break;

            case 4:   // max
              if (values.length === 0) { return ValueError(); }
              value = Math.max.apply(0, values);
              break;

            case 5:   // min
              if (values.length === 0) { return ValueError(); }
              value = Math.min.apply(0, values);
              break;

            case 6:   // product
              if (values.length === 0) { return ValueError(); }
              value = 1;
              for (const entry of values) {
                value *= entry;
              }  
              break;

            case 7:   // stdev.s
              if (values.length < 2) { return DivideByZeroError(); }
              value = Math.sqrt(Variance(values, true));
              break;

            case 8:   // stdev.p
              if (values.length === 0) { return DivideByZeroError(); }
              value = Math.sqrt(Variance(values, false));
              break;

            case 9:   // sum
              value = sum;
              break;

            case 10:  // var.s
              if (values.length < 2) { return DivideByZeroError(); }
              value = Variance(values, true);
              break;

            case 11:  // var.p
              if (values.length === 0) { return DivideByZeroError(); }
              value = Variance(values, false);
              break;

          }

          // console.info({type, args, flat, values});

          return {
            type: ValueType.number,
            value,
          };

        },
      },

      Cell: {
        description: 'Returns data about a cell',
        arguments: [
          { name: 'type', description: 'Type of data to return', unroll: true,  },
          { name: 'reference', description: 'Cell reference', metadata: true, unroll: true,  },
        ],
  
        // there's no concept of "structure volatile", and structure events
        // don't trigger recalc, so this is not helpful -- we may need to 
        // think about both of those things
        
        // volatile: true, 
  
        fn: (type: string, reference: UnionValue): UnionValue => {
  
          if (!UnionIsMetadata(reference)) {
            return ReferenceError();
          }
  
          if (type) {
            switch (type.toString().toLowerCase()) {
              case 'format':
                return reference.value.format ? // || ReferenceError;
                  { type: ValueType.string, value: reference.value.format } : ReferenceError();
              case 'address': 
                {
                  let sheet_name = '';
                  if (reference.value.address.sheet_id) {
                    const sheet = this.model.sheets.Find(reference.value.address.sheet_id);
                    sheet_name = sheet?.name || '';
                  }

                  if (sheet_name) {
                    if (QuotedSheetNameRegex.test(sheet_name)) {
                      sheet_name = `'${sheet_name}'`;
                    }
                    sheet_name += '!';
                  }

                  return { 
                    type: ValueType.string, 
                    value: '[]' + sheet_name + reference.value.address.label.replace(/\$/g, ''), 
                  };
                }
            }
          }
  
          return { type: ValueType.error, value: NotImplError.error };
  
        },
  
      },
  

      Address: {
        arguments: [
          { name: 'row' }, 
          { name: 'column' }, 
          { name: 'absolute' }, 
          { name: 'a1' },
          { name: 'sheet name'}
        ],
        fn: (row = 1, column = 1, absolute = 1, a1 = true, sheet_name?: string): UnionValue => {
  
          const address: UnitAddress = {
            type: 'address',
            id: 0, position: 0, label: '',
            row: row-1, 
            column: column-1,
          };
  
          switch (absolute) {
            case 2:
              address.absolute_row = true;
              break;
            case 3:
              address.absolute_column = true;
              break;
            case 4:
              break;
            default:
              address.absolute_column = true;
              address.absolute_row = true;
          }
  
          if (sheet_name) {
            address.sheet = sheet_name;
          }

          return StringUnion(this.parser.Render(address, { r1c1: !a1 }));
  
        },
      },

      /**
       * anything I said about COUNTIF applies here, but worse.
       * COUNTIFS is an AND operation across separate COUNTIFs.
       * presumably they have to be the same shape.
       */
      CountIfs: {
        arguments: [
          { name: 'range', },
          { name: 'criteria', },
          { name: 'range', },
          { name: 'criteria', }
        ],
        fn: (...args): UnionValue => {
          return XIf('count', args[0], ...args);
        },
      },

      /** @see CountIf */
      AverageIf: {
        arguments: [
          { name: 'range', },
          { name: 'criteria', },
        ],
        fn: (range: CellValue[][], criteria: CellValue, average_range?: CellValue[][]) => {
          return XIf('average', average_range||range, range, criteria);
        },
      },

      /** @see CountIf */
      AverageIfs: {
        arguments: [
          { name: 'value range', },
          { name: 'criteria range', },
          { name: 'criteria', },
          { name: 'criteria range', },
          { name: 'criteria', },
        ],
        fn: (range: CellValue[][], ...args) => {
          return XIf('average', range, ...args);
        },
      },

      /** @see CountIf */
      SumIf: {
        arguments: [
          { name: 'range', },
          { name: 'criteria', },
        ],
        fn: (range: CellValue[][], criteria: CellValue, sum_range?: CellValue[][]) => {
          return XIf('sum', sum_range||range, range, criteria);
        },
      },

      /** @see CountIf */
      SumIfs: {
        arguments: [
          { name: 'value range', },
          { name: 'criteria range', },
          { name: 'criteria', },
          { name: 'criteria range', },
          { name: 'criteria', },
        ],
        fn: (range: CellValue[][], ...args) => {
          return XIf('sum', range, ...args);
        },
      },

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
          return XIf('count', range, range, criteria);
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
        return_type: 'reference',
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
        return_type: 'reference',
        volatile: true, // necessary?
        fn: ((reference: string): UnionValue => {

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

          return { type: ValueType.object, value: parse_result.expression };

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
       * not sure when this one appeared, but it's what I was looking for 
       * 
       * ---
       * what an odd comment. what does that mean? 
       */
      FormulaText: {
        description: 'Returns a formula as a string',
        arguments: [
          { name: 'reference', description: 'Cell reference', metadata: true, unroll: true },
        ],
        fn: (reference: UnionValue): UnionValue => {

          if (!UnionIsMetadata(reference)) {
            return ReferenceError();
          }

          const sheet = this.model.sheets.Find(reference.value?.address?.sheet_id || 0);
          if (sheet) {
            const cell = sheet.cells.GetCell(reference.value.address, false);
            return { 
              type: ValueType.string, 
              value: cell?.value?.toString() || '',
            };
          }
          
          return ReferenceError();

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
          unroll: true,
          metadata: true, /* OK with array metadata */
        }],
        fn: (ref: UnionValue): UnionValue => {

          // this is wasteful because we know that the range will all
          // be in the same sheet... we don't need to look up every time

          const addr = (ref?.value as {address?: UnitAddress})?.address;

          const sheet = this.model.sheets.Find(addr?.sheet_id || 0);
          if (addr && sheet) {
            const cell = sheet.cells.GetCell(addr, false);
            return { 
              type: ValueType.boolean, 
              value: cell?.type === ValueType.formula,
            };
          }

          return { 
            type: ValueType.boolean, value: false,
          };

        },
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
  public ExportCalculatedValues(): Record<number, CellDataWithAddress[]> {
    const data: Record<number, CellDataWithAddress[]> = {};
    for (const sheet of this.model.sheets.list) {
      const calculated = sheet.cells.toJSON({calculated_value: true}).data as CellDataWithAddress[];
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
  public ApplyCalculatedValues(data: Record<number, CellDataWithAddress[]>): void {
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

  public AttachSpillData(area: Area, cells?: Cells) {

    if (!cells) {
      const sheet = area.start.sheet_id ? this.model.sheets.Find(area.start.sheet_id) : undefined;
      cells = sheet?.cells;
    }

    if (!cells) {
      throw new Error('invalid sheet ID in attach spill data');
    }

    const vertex = new StateLeafVertex();
    let counter = 0;
    let error = false;

    for (const {cell, row, column} of cells.IterateRC(area, true)) {
      if (counter++ && (cell.type !== ValueType.undefined || cell.area || cell.merge_area || cell.table)) {
        error = true; // spill error.
      }
      this.AddLeafVertexEdge({row, column, sheet_id: area.start.sheet_id}, vertex);
    }

    // console.info("storing spill data");
    this.spill_data.push({area, vertex});

    return { vertex, area, error };

  }

  public SpillCallback(vertex: SpreadsheetVertex, result: ArrayUnion): SpreadsheetVertex[] {

    const { reference, address } = vertex;
    const { value } = result;

    const recalculate_list: SpreadsheetVertex[] = [];

    if (!reference) {
      // should throw but this is new and I don't want to break stuff rn
      console.error("invalid reference in spill callback");
      return recalculate_list;
    }

    if (!address || !address.sheet_id) {
      // should throw but this is new and I don't want to break stuff rn
      console.error("invalid address in spill callback");
      return recalculate_list;
    }

    // I guess we could do the one-cell version here

    if (value.length === 1 && value[0].length === 1) {
      reference.SetCalculatedValue(value[0][0].value as CellValue);
      return recalculate_list;
    }

    if (!this.options.spill) {
      reference.SetCalculatedValue(value[0][0].value as CellValue);
      return recalculate_list;
    }

    // console.info("SPILLING");

    const sheet = this.model.sheets.Find(address.sheet_id);
    const cells = sheet?.cells;

    if (cells) {

      // first thing we do is check for empty. if !empty, that's a 
      // spill error and we can stop. also check for area, spill and 
      // merge (and table).

      const columns = result.value.length;
      const rows = result.value[0].length;
      const area = new Area(address).Reshape(rows, columns);


      /*
      let counter = 0;
      let error = false;
      const leaf = new StateLeafVertex();

      for (const {cell, row, column} of cells.IterateRC(area, true)) {
        if (counter++ && (cell.type !== ValueType.undefined || cell.area || cell.merge_area || cell.table)) {
          error = true; // spill error.
        }
        this.AddLeafVertexEdge({row, column, sheet_id: area.start.sheet_id}, leaf);
      }

      console.info("storing spill data");

      // this.spills.push(new Area(area.start, area.end));
      this.spill_data.push({area, vertex: leaf});
      */

      const { error } = this.AttachSpillData(area, cells);

      if (error) {
        // console.info("returning error");
        reference.SetCalculationError('SPILL');
        return recalculate_list;
      }

      // expand the sheet, if necessary (+1)

      if (sheet.rows < area.end.row + 1) {
        sheet.cells.EnsureRow(area.end.row + 1);
        this.grid_expanded = true;
      }
      if (sheet.columns < area.end.column + 1) {
        sheet.cells.EnsureColumn(area.end.column + 1);
        this.grid_expanded = true;
      }

      // hmmm... we need the grid to update... how can we ensure that?
      // we could use a flag that the embedded sheet checks after 
      // calculation... which is kind of sloppy but I don't have a better
      // idea



      const sheet_id = address.sheet_id;
      // let dirty = false;

      for (const {row, column} of cells.IterateRC(area)) {
        if (row === address.row && column === address.column) { continue; }

        const vertex = this.GetVertex({sheet_id, row, column}, false) as SpreadsheetVertex;

        if (vertex) {
          // onsole.info("Have vertex @", row, column, "dirty?", vertex.dirty);

          if (!(vertex as SpreadsheetVertex).dirty) {
            recalculate_list.push(vertex);
          }
        }

        // do we need these edges? if so, what for? (...)
        // I guess to propagate dirty if there's a dependent?
        // apparently not, although I'm not sure why...


        // this.AddEdge(address, {sheet_id, row, column});

      }

      /*
      // ok, now we can go on: copying a little from dynamic dependencies, 
      // we're going to add vertices and check for dirty:
      
      const sheet_id = address.sheet_id;
      let dirty = false;

      for (const {row, column} of cells.IterateRC(area)) {

        if (row === address.row && column === address.column) { continue; }

        const vertex = this.GetVertex({sheet_id, row, column}, true);
        if (vertex && vertex.dirty) {

          console.info(`Adding edge from ${{row: address.row, column: address.column}} -> ${{row, column}}`)

          // see comments in DynamicDependencies()
          
          this.AddEdge(address, {row, column, sheet_id});
          dirty = true;

        }

      }

      console.info("DIRTY?", dirty);

      if (dirty) {
        const current_vertex = this.GetVertex(address, true) as SpreadsheetVertex;
        current_vertex.short_circuit = true;
        return;
      }
      */

      //


      // maybe we could use a vertex here?
      // actually we also need to do a loop check
     
      // so I think the approach is 
      //
      // 1 - create a vertex (spill -- array vertex?)
      // 2 - check for loops
      // 3 - if no loop, check for empty
      // 4 - if empty, fill in values
      //

      // and then we need to flush spill vertices at
      // some point, either always on recalc, or on 
      // recalc if something is dirty. flushing spill
      // vertices implies removing all spilled values 
      // so they will be empty if something changes

      // PLAN: start by flushing all spill vertices on
      // every recalc, and then we can trim it back
      
      // spill ok, set values


      for (let {cell, row, column} of cells.IterateRC(area)) {

        cell.spill = area;

        row -= address.row;
        column -= address.column;

        const v = result.value[column][row];

        switch (v.type) {
          case ValueType.object:
          case ValueType.array:
            break;
          default:
            cell.SetCalculatedValue(v.value, v.type);
            break;
        }

      }

      return recalculate_list;

    }

    // 

    console.error("invalid cell reference in spill callback");
    reference.SetCalculationError('SPILL');

    return [];
    
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

              // if there's a nested array, take the first value. but
              // don't recurse; if there's another array in there set
              // as undefined (should be error?)

              let indexed_value = values[row][column];
              if (indexed_value.type === ValueType.array) {
                indexed_value = indexed_value.value[0][0];
              }

              switch (indexed_value.type) {
                case ValueType.array:
                case ValueType.object:
                  cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(undefined); // error?
                    break;

                default:
                  cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(
                    indexed_value.value, indexed_value.type);
  
              }
             
              /*
              if (indexed_value.type !== ValueType.object) {
                cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(
                  indexed_value.value, indexed_value.type);
              }

              cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(
                values[row][column].value, 
                values[row][column].type);
                */

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

        let applied: UnionValue = { ...value };
        
        if (applied.type === ValueType.object) {
          applied = { type: ValueType.undefined, value: undefined };
        }

        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) {
            cells.data[row + area.start.row][column + area.start.column].SetCalculatedValue(applied.value, applied.type);
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
      this.parser.SetLocaleSettings(DecimalMarkType.Comma);

      // this.parser.decimal_mark = DecimalMarkType.Comma;
      // this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
    }
    else {
      this.parser.SetLocaleSettings(DecimalMarkType.Period);

      // this.parser.decimal_mark = DecimalMarkType.Period;
      // this.parser.argument_separator = ArgumentSeparatorType.Comma;
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

    const function_list: FunctionDescriptor[] = Object.keys(list).map((key) => {
      let name = list[key].canonical_name;
      if (!name) name = key.replace(/_/g, '.');
      return {
        name,
        description: list[key].description,
        arguments: (list[key].arguments || []).map((argument) => {
          return { name: argument.name || '' };
        }),
        type: 'function', // DescriptorType.Function,
      };
    });

    // FIXME: this doesn't need to be here, if it's owned by model.
    // we should have model responsible for retrieving these names
    // (along with named ranges/expressions). also, should macro 
    // functions support scoping?

    for (const macro of this.model.macro_functions.values()) {
      function_list.push({
        name: macro.name,
        description: macro.description,
        arguments: (macro.argument_names || []).map(argument => {
          return { name: argument };
        }),
        type: 'function', // DescriptorType.Function,
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

      // the way we call this now, this is unecessary
      // @see `CallExpression` in `expression-calculator.ts`.

      /*
      const original_function = descriptor.fn;
     
      // we don't bind to the actual context because that would allow
      // functions to change it, and potentially break subsequent functions
      // that rely on it. which is a pretty far-fetched scenario, but we might
      // as well protect against it.

      console.info('wrapping...');

      descriptor.fn = (...args: unknown[]) => {

        console.info("wrapped?");

        return original_function.apply({
          address: { ...this.expression_calculator.context.address},
        }, args);
      };
      */

      this.library.Register({[name]: descriptor});
    }

  }

  /**
   * wrapper method for calculation
   */
  public Calculate(subset?: Area): void {

    // this.AttachModel();

    // this gets checked later, now... it would be better if we could
    // check it here are skip the later check, but that field is optional
    // it's better to report the error here so we can trace

    if (subset && !subset.start.sheet_id) {
      throw new Error('CalculateInternal called with subset w/out sheet ID')
    }

    if (this.full_rebuild_required) {
      subset = undefined;
      this.UpdateAnnotations();
      this.UpdateConditionals();
      this.UpdateConnectedElements();
      // this.UpdateNotifiers();
      this.full_rebuild_required = false; // unset
    }

    // this.expression_calculator.SetModel(model);

    this.RebuildGraph(subset);

    this.grid_expanded = false; // unset

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
    // this.AttachModel();

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

  /** overload */
  public Evaluate(expression: string, active_sheet?: Sheet, options?: EvaluateOptions, raw_result?: false): CellValue|CellValue[][];

  /** overload */
  public Evaluate(expression: string, active_sheet?: Sheet, options?: EvaluateOptions, raw_result?: true): UnionValue;

  /** moved from embedded sheet */
  public Evaluate(expression: string, active_sheet?: Sheet, options: EvaluateOptions = {}, raw_result = false) {
    
    let parse_expression = options?.preparsed;

    if (!parse_expression) {

      this.parser.Save();

      if (options.argument_separator) {
        if (options.argument_separator === ',') {
          this.parser.SetLocaleSettings(DecimalMarkType.Period);

          // this.parser.argument_separator = ArgumentSeparatorType.Comma;
          // this.parser.decimal_mark = DecimalMarkType.Period;
        }
        else {
          this.parser.SetLocaleSettings(DecimalMarkType.Comma);

          // this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
          // this.parser.decimal_mark = DecimalMarkType.Comma;
        }
      }

      if (options.r1c1) {
        this.parser.flags.r1c1 = options.r1c1;
      }

      const parse_result = this.parser.Parse(expression);

      // reset

      // this.parser.argument_separator = current;
      // this.parser.decimal_mark = (current === ArgumentSeparatorType.Comma) ? DecimalMarkType.Period : DecimalMarkType.Comma;
      // this.parser.flags.r1c1 = r1c1_state;

      this.parser.Restore();

      parse_expression = parse_result.expression;

      if (parse_result.error) {
        throw new Error(parse_result.error);
      }

    }

    // OK

    if (parse_expression ){ 

      this.parser.Walk(parse_expression, (unit) => {
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

          this.model.ResolveSheetID(unit, undefined, active_sheet);
        }
        return true;
      });

      // console.info({expression: parse_result.expression})
      const result = this.CalculateExpression(parse_expression, options.address);
      if (raw_result) {
        return result;
      }

      if (result.type === ValueType.array) {
        return result.value.map(row => row.map(value => value.value));
      }
      else {
        return result.value;
      }

    }

    // or? (...)

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

    this.RebuildGraph();

    // add leaf vertices for annotations

    this.UpdateAnnotations(); // all
    this.UpdateConditionals();
    this.UpdateConnectedElements();

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

  public Unresolve(ref: IArea|ICellAddress, context: Sheet, qualified = true, named = true) {
    
    let range = '';
    const area = IsCellAddress(ref) ? new Area(ref) : new Area(ref.start, ref.end);

    if (named) {
      const named_range = this.model.named.MatchSelection(area);
      if (named_range) {
        return named_range;
      }
    }

    /*
    if (area.count > 1) {
      range = Area.CellAddressToLabel(area.start) + ':' + Area.CellAddressToLabel(area.end);
    }
    else {
      range = Area.CellAddressToLabel(area.start);
    }
    */
    range = area.spreadsheet_label;

    if (!qualified) {
      return range;
    }

    // is there a function to resolve sheet? actually, don't we know that
    // the active selection must be on the active sheet? (...)

    const sheet_id = area.start.sheet_id || context?.id;
    const sheet_name = this.ResolveSheetName(sheet_id, true);

    return sheet_name ? sheet_name + '!' + range : range;

  }

  /**
   * FIXME: just add a quote option to the model method and we can drop this function
   */
  public ResolveSheetName(id: number, quote = false): string | undefined {
    const sheet = this.model.sheets.Find(id);
    if (sheet) {
      if (quote && QuotedSheetNameRegex.test(sheet.name)) {
        return `'${sheet.name}'`;
      }
      return sheet.name;
    }
    return undefined;
  }

  public RemoveConditional(conditional: ConditionalFormat): void {
    if (conditional.type === 'expression') {
      const vertex = conditional.internal?.vertex as LeafVertex;
      if (vertex) {
        vertex.Reset();
        this.RemoveLeafVertex(vertex);
      }
    }
  }

  public RemoveConnectedELement(element: ConnectedElementType) {
    const internal = element.internal as { vertex: StateLeafVertex };
    if (internal?.vertex) {
      this.RemoveLeafVertex(internal.vertex);
      return true;
    }
    return false;
  }

  public UpdateConnectedElements(context?: Sheet, element?: ConnectedElementType) {

    // we have a problem here in that these elements are not bound
    // to sheets, so we might have no context. for now we'll 
    // just grab the first sheet, although that's not necessarily
    // what you want. we should enforce that these have hard sheet 
    // references when created.
    
    if (!context) {
      context = this.model.sheets.list[0];
    }

    if (element) {
      const internal = element.internal as { vertex: StateLeafVertex };
      if (internal?.vertex) {
        this.RemoveLeafVertex(internal.vertex);
      }
    }

    const elements = element ? [element] : this.model.connected_elements.values();

    for (const element of elements) {
      let internal = element.internal as { vertex: StateLeafVertex };
      if (!internal) {
        internal = {
          vertex: new StateLeafVertex(),
        };
        element.internal = internal;
      }

      const vertex = internal.vertex as LeafVertex;
      this.AddLeafVertex(vertex);
      this.UpdateLeafVertex(vertex, element.formula, context);

    }
  }

  public UpdateConditionals(list?: ConditionalFormat|ConditionalFormat[], context?: Sheet): void {

    // this method is (1) relying on the leaf vertex Set to avoid duplication,
    // and (2) leaving orphansed conditionals in place. we should look to 
    // cleaning things up. 

    // is it also (3) adding unecessary calculations (building the expression,
    // below)?

    // NOTE: moving all conditional formats into EN-US (i.e. dot-separated).
    // make sure to evaluate them in this format.

    if (!list) {

      // we could in theory remove all of the leaves (the ones we know to
      // be used for conditionals), because they will be added back below.
      // how wasteful is that?
      
      // or maybe we could change the mark, and then use invalid marks 
      // to check?

      // the alternative is just to leave them as orphans until the graph
      // is rebuilt. which is lazy, but probably not that bad... 

      for (const sheet of this.model.sheets.list) {
        if (sheet.conditional_formats?.length) {
          this.UpdateConditionals(sheet.conditional_formats, sheet);
        }
      }
      return;
    }

    if (!context) {
      throw new Error('invalid call to update conditionals without context');
    }

    if (list && !Array.isArray(list)) {
      list = [list];
    }

    for (const entry of list) {

      let expression = '';

      switch (entry.type) {

        case 'cell-match':
          if (entry.between) {
            const addr = this.Unresolve(entry.area, context, true, false);
            expression = `BETWEEN(${[addr, ...entry.between].join(', ')})`;
          }
          else {
            expression = this.Unresolve(entry.area, context, true, false) + ' ' + entry.expression;
          }
          break;

        case 'expression':
          expression = entry.expression;
          break;

        case 'duplicate-values':
          expression = `UniqueValues(${
            this.Unresolve(entry.area, context, true, false)
          })`;
          if (!entry.unique) {
            expression = `NOT(${expression})`;
          }
          break;

        case 'gradient':
          expression = `=Gradient(${
            [
              this.Unresolve(entry.area, context, true, false),
              entry.min ?? '',
              entry.max ?? '',

            ].join(',')
          })`;
          break;

        default:
          continue;
      }

      if (!expression) {
        continue; // FIXME: warn?
      }

      // console.info({type: entry.type, expression});

      if (!entry.internal) {
        entry.internal = {};
      }
      if (!entry.internal.vertex) {

        const vertex = new CalculationLeafVertex();
        vertex.use = 'conditional';

        entry.internal.vertex = vertex;

        let options: EvaluateOptions = {
          argument_separator: ',', 
        };

        if (entry.type !== 'gradient' && entry.type !== 'duplicate-values') {
          options = {...entry.options, ...options};
        }

        // first pass, run the calculation
        const check = this.Evaluate(expression, context, options, true);
        entry.internal.vertex.result = check;
        entry.internal.vertex.updated = true;

      }

      const vertex = entry.internal.vertex as LeafVertex;
      this.AddLeafVertex(vertex);
      this.UpdateLeafVertex(vertex, expression, context, DecimalMarkType.Period); // force en-us 

    }

  }

  public RemoveAnnotation(annotation: Annotation): void {
    const vertex_data = annotation.temp as { vertex?: LeafVertex };
    if (vertex_data.vertex) {
      vertex_data.vertex.Reset();
      this.RemoveLeafVertex(vertex_data.vertex);
    }
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
      if (entry.data.formula) {

        const vertex_data = entry.temp as { vertex?: LeafVertex };

        if (!vertex_data.vertex) {
          vertex_data.vertex = new StateLeafVertex();
        }

        this.AddLeafVertex(vertex_data.vertex);
        this.UpdateLeafVertex(vertex_data.vertex, entry.data.formula, context);
      }
    }

  }


  // --- protected -------------------------------------------------------------

  /**
   * assuming the expression is an address, range, or named range, resolve
   * to an address/area. returns undefined if the expression can't be resolved.
   */
  protected ResolveExpressionAddress(expr: ExpressionUnit, context?: ICellAddress): Area|undefined {

    switch (expr.type) {
      case 'address':
        if (this.model.ResolveSheetID(expr, context)) {
          return new Area(expr);
        }
        break;

      case 'range':
        if (this.model.ResolveSheetID(expr, context)) {
          return new Area(expr.start, expr.end);
        }
        break;

      case 'identifier':
        {
          const named_range =
            this.model.GetName(expr.name, context?.sheet_id || 0);
          if (named_range && named_range.type === 'range') {
            return new Area(named_range.area.start, named_range.area.end);
          }
        }
        break;
    }

    return undefined;

  }

  protected NamedRangeToAddressUnit(unit: UnitIdentifier, context: ICellAddress): UnitAddress|UnitRange|undefined {

    const normalized = unit.name.toUpperCase();
    const named_range = this.model.GetName(normalized, context.sheet_id || 0);
    if (named_range && named_range.type === 'range') {
      if (named_range.area.count === 1) {
        return this.ConstructAddressUnit(named_range.area.start, normalized, unit.id, unit.position);
      }
      else {
        return {
          type: 'range',
          start: this.ConstructAddressUnit(named_range.area.start, normalized, unit.id, unit.position),
          end: this.ConstructAddressUnit(named_range.area.end, normalized, unit.id, unit.position),
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
      context_address: ICellAddress,
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
          
          const fetched = this.model.GetName(unit.name, context_address.sheet_id || 0);

          if (fetched?.type === 'expression') {
            this.RebuildDependencies(fetched.expression, relative_sheet_id, relative_sheet_name, dependencies, context_address);
          }
          else {
            const resolved = this.NamedRangeToAddressUnit(unit, context_address);
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

      case 'structured-reference':

        // when building the graph, resolve the reference to the table.
        // this is the same thing we do in expression-calculator, and
        // we rely on the same rules to ensure that the reference either
        // stays consitent, or gets rebuilt.

        {
          const resolved = this.model.ResolveStructuredReference(unit, context_address);
          if (resolved) {
            if (resolved.type === 'address') {
              dependencies.addresses[resolved.sheet_id + '!' + resolved.label] = resolved;
            }
            else {
              dependencies.ranges[resolved.label] = resolved;
            }
          }


          const table = this.model.tables.get(unit.table.toLowerCase());
          if (table) {

            // see ResolveStructuredReference in expression calculator

            const row = context_address.row; // "this row"
            if (row < table.area.start.row || row > table.area.end.row) {
              break;
            }

            const reference_column = unit.column.toLowerCase();
            let column = -1;
      
            if (table.columns) { // FIXME: make this required
              for (let i = 0; i < table.columns.length; i++) {
                if (reference_column === table.columns[i]) {
                  column = table.area.start.column + i;
                  break;
                }
              }
            }

            if (column >= 0) {

              // does using the original label here, instead of a sheet
              // address as label, mean we potentially have multiple
              // references to the same cell? probably...

              const address: UnitAddress = {
                label: unit.label,
                type: 'address',
                row, 
                column,
                sheet_id: table.area.start.sheet_id,
                id: unit.id,
                position: unit.position,
              };
        
              dependencies.addresses[address.sheet_id + '!' + address.label] = address;

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
        this.RebuildDependencies(unit.operand, relative_sheet_id, relative_sheet_name, dependencies, context_address);//, sheet_name_map);
        break;

      case 'binary':
        this.RebuildDependencies(unit.left, relative_sheet_id, relative_sheet_name, dependencies, context_address);//, sheet_name_map);
        this.RebuildDependencies(unit.right, relative_sheet_id, relative_sheet_name, dependencies, context_address);//, sheet_name_map);
        break;

      case 'group':
        unit.elements.forEach((element) =>
          this.RebuildDependencies(element, relative_sheet_id, relative_sheet_name, dependencies, context_address));//, sheet_name_map));
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

                this.RebuildDependencies(args[index], relative_sheet_id, relative_sheet_name, undefined, context_address);//, sheet_name_map);

                args[index] = { type: 'missing', id: -1 };
              }
            });
          }
          args.forEach((arg) => this.RebuildDependencies(arg, relative_sheet_id, relative_sheet_name, dependencies, context_address));//, sheet_name_map));

        }
        break;

    }

    return dependencies;
  }

  protected UpdateLeafVertex(vertex: LeafVertex, formula: string, context: Sheet, decimal_mark?: DecimalMarkType): void {

    vertex.Reset();

    if (decimal_mark) {
      this.parser.Save();
      this.parser.SetLocaleSettings(decimal_mark);
    }

    const parse_result = this.parser.Parse(formula);
    if (parse_result.expression) {
      const dependencies =
        this.RebuildDependencies(
          parse_result.expression,
          // this.model.active_sheet.id,
          // this.model.active_sheet.name,
          context.id,
          context.name,
          undefined,
          {row: 0, column: 0}, // fake context
        );

      for (const key of Object.keys(dependencies.ranges)){
        const unit = dependencies.ranges[key];
        const range = new Area(unit.start, unit.end);

        if (range.entire_column || range.entire_row || range.count > 1) {
          // this.AddLeafVertexEdge(range.start, vertex);
          this.AddLeafVertexArrayEdge(range, vertex);
        }
        else {
          this.AddLeafVertexEdge(range.start, vertex);
        }

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

    if (decimal_mark) {
      this.parser.Restore();
    }

  }

  /** 
   * 
   */
  protected RebuildGraphCell(cell: Cell, address: ICellAddress2): void {

    // FIXME/TODO: if spill is not enabled, we'll need to clean up
    // rendered values from the spill here

    if (cell.spill) {
      if (this.options.spill) {
        if (cell.spill.start.row === address.row && cell.spill.start.column === address.column) {

          // this.spills.push(new Area(cell.spill.start, cell.spill.end));
          this.AttachSpillData(new Area(cell.spill.start, cell.spill.end));

        }
        else {
          // ... 
          this.AddEdge(cell.spill.start, address);
        }
      }
    }

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

        const dependencies = this.RebuildDependencies(parse_result.expression, address.sheet_id, '', undefined, address); // cell.sheet_id);

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

            for (const target of range) {
              this.AddEdge(target, address);
            }

            // range.Iterate((target: ICellAddress) => this.AddEdge(target, address));
            
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

  /*
  protected IsNativeOrTypedArray(val: unknown): boolean {
    return Array.isArray(val) || (val instanceof Float64Array) || (val instanceof Float32Array);
  }
  */

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
