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

import type { FunctionLibrary } from './function-library';
import type { Cell, ICellAddress,
         UnionValue, CellValue,
         ArrayUnion,
         NumberUnion,
         UndefinedUnion,
         ComplexUnion, 
         DimensionedQuantityUnion,
         IArea} from 'treb-base-types';
import { ValueType, GetValueType, Area } from 'treb-base-types';
import type { Parser, ExpressionUnit, UnitBinary, UnitIdentifier,
         UnitGroup, UnitUnary, UnitAddress, UnitRange, UnitCall, UnitDimensionedQuantity, UnitStructuredReference, 
         UnitImplicitCall} from 'treb-parser';
import type { DataModel, MacroFunction, Sheet } from 'treb-data-model';
import { NameError, ReferenceError, ExpressionError, UnknownError, SpillError, ValueError, ArgumentError } from './function-error';

import * as Primitives from './primitives';
import type { ContextResult } from './descriptors';

//////////

/**
 * dynamically adding a user data field to the expression so we can
 * cache a function call, avoiding type switching and function lookups.
 * 
 * we use the generic type so we can cover the composite type as well
 * before specifying
 */
type AttachCachedFunction<T> = (T & { fn: (arg0: T) => UnionValue });

/**
 * expression unit with cached function
 */
type ExpressionWithCachedFunction<T extends ExpressionUnit> = T extends { type: T['type'] } ? AttachCachedFunction<T> : never;

/**
 * @internal
 */
export type ExtendedExpressionUnit = ExpressionWithCachedFunction<ExpressionUnit>;

// FIXME: move
// FIXME: this is sloppy
export const UnionIsExpressionUnit = (test: UnionValue /*UnionOrArray*/): test is { type: ValueType.object, value: ExpressionUnit } => {
  return !Array.isArray(test) 
      && test.type === ValueType.object
      && (!!(test.value as ExpressionUnit).type);
};

// FIXME: move
// FIXME: this is sloppy
export const UnionIsMetadata = (test: UnionValue /*UnionOrArray*/): test is { type: ValueType.object, value: ReferenceMetadata } => {
  return test.type === ValueType.object && test.key === 'metadata';
};

// FIXME: move
export interface ReferenceMetadata {
  type: 'metadata';
  
  // what's the context in which I was using the unit address (parse expression?)
  address: UnitAddress; // ICellAddress;
  
  value: CellValue;
  format?: string;
}

export type BindingFrame = Record<string, ExpressionUnit>; // FIXME (type?)
export type PositionalFrame = ExpressionUnit[];

export interface CalculationContext {
  address: ICellAddress;
  area?: IArea;
  volatile: boolean;

  /** new for lambdas */
  bindings: BindingFrame[];

}

export class ExpressionCalculator {

  public context: CalculationContext = {
    address: { row: -1, column: -1 },
    volatile: false,
    bindings: [],
  };

  // --- public API -----------------------------------------------------------

  constructor(
    protected readonly data_model: DataModel,
    protected readonly library: FunctionLibrary,
    protected readonly parser: Parser) {}

  /**
   * there's a case where we are calling this from within a function
   * (which is weird, but hey) and to do that we need to preserve flags.
   */
  public Calculate(expr: ExpressionUnit, addr: ICellAddress, area?: IArea, preserve_flags = false): {
      value: UnionValue /*UnionOrArray*/, volatile: boolean }{

    if (!preserve_flags) {
      this.context.address = addr;
      this.context.volatile = false;
      this.context.area = area;
    }

    return {
      value: this.CalculateExpression(expr as ExtendedExpressionUnit),
      volatile: this.context.volatile,
    };

  }

  // --- /public API ----------------------------------------------------------

  /**
   * resolve value from cell. returns a function bound to specific cell.
   */
  protected CellFunction2(expr: UnitAddress): () => UnionValue {

    if (!expr.sheet_id) {
      if (expr.sheet) {
        expr.sheet_id = this.data_model.sheets.ID(expr.sheet) || 0;
      }
      else {
        return () => ReferenceError();
      }
    }

    const cells = this.data_model.sheets.Find(expr.sheet_id)?.cells;

    if (!cells) {
      console.warn('missing cells reference @ ' + expr.sheet_id);
      return () => ReferenceError();
    }

    // reference
    const cell = cells.GetCell(expr);

    // this is not an error, just a reference to an empty cell
    // FIXME: should this be 0? probably

    if (!cell) {
      return () => { 
        return { type: ValueType.number, value: 0 };
      };
    }

    if (expr.spill && cell.spill && cell.spill.start.row === expr.row && cell.spill.start.column === expr.column) {
      return () => {
        return cell.spill ? cells.GetRange4(cell.spill.start, cell.spill.end, true) || ReferenceError() : SpillError();
      }
    }

    // close
    return () => cell.GetValue4();

  }

  /**
   * returns range as union type. returns a single value for a single cell,
   * or a 2d array (never a 1d array)
   */
  protected CellFunction4(start: ICellAddress, end: ICellAddress): UnionValue /*UnionOrArray*/ {

    if (!start.sheet_id) {
      return ReferenceError();
      // throw new Error('missing sheet id in CellFunction4');
    }

    const cells = this.data_model.sheets.Find(start.sheet_id)?.cells;
    return cells?.GetRange4(start, end, true) || ReferenceError();

  }

  /** breaking this out to de-dupe */
  protected GetMetadata<T>(arg: ExpressionUnit, transform: (cell_data: Cell, address: ICellAddress) => T): UnionValue {

    // FIXME: we used to restrict this to non-cell functions, now
    // we are using it for the cell function (we used to use address,
    // which just returns the label)

    let address: ICellAddress|undefined;
    let range: {start: ICellAddress; end: ICellAddress} | undefined;

    switch (arg.type) {
    case 'address':

      if (arg.spill) {
        let sheet: Sheet|undefined;
        if (arg.sheet_id) {
          sheet = this.data_model.sheets.Find(arg.sheet_id);
        }

        if (!sheet) {
          console.error('missing sheet [da6]');
          return ReferenceError();
        }

        const cell_data = sheet.CellData(arg);
        if (cell_data.spill) {
          range = cell_data.spill;
        }
        
      }
      else {
        address = arg;
      }
      break;

    case 'range':
      range = arg;
      break;

    case 'structured-reference':
      {
        const resolved = this.data_model.ResolveStructuredReference(arg, this.context.address);
        if (resolved) {
          if (resolved.type === 'address') {
            address = resolved;
          }
          else if (resolved.type === 'range') {
            range = resolved;
          }
        }
      }
      break;

    case 'identifier':
      {
        const named_range = this.data_model.GetName(arg.name, this.context.address.sheet_id || 0);
        if (named_range?.type === 'range') {
          if (named_range.area.count === 1) {
            address = named_range.area.start; // FIXME: range?
          }
          else {
            range = named_range.area;
          }
        }
      }
      break;

    case 'call':

      // we need a way to cascade the 'metadata' flag down 
      // through calls so we can use indirect/offset addressing...

      // at the same time you don't want to cascade down indefinitely,
      // otherwise the function call itself won't work properly...

      // [how to resolve?]

      {
        const result = this.CalculateExpression(arg as ExtendedExpressionUnit, true) as UnionValue /*UnionOrArray*/;
        if (UnionIsExpressionUnit(result)) {
          if (result.value.type === 'address') { 
            address = result.value;
          }
          else if (result.value.type === 'range') {
            range = result.value;
          }
          else {
            return result;
          }
        }
        else return result;
      }
      break;

    default:
      return this.CalculateExpression(arg as ExtendedExpressionUnit); // as UnionOrArray;
      
    }

    if (address) {

      // don't we have a map? [...] only for names?

      let sheet: Sheet|undefined;
      if (address.sheet_id) {
        sheet = this.data_model.sheets.Find(address.sheet_id);
      }

      if (!sheet) {
        console.error('missing sheet [ac8]');
        return ReferenceError();
      }

      const cell_data = sheet.CellData(address);
      const value = cell_data.calculated_type ? cell_data.calculated : cell_data.value;

      const metadata: ReferenceMetadata = {
        type: 'metadata',

        // metadata is expecting a parse expression instead of an addresss.
        // note we're not setting the label properly here, which could be 
        // an issue? not sure who's calling it in this case

        // UPDATE: "Cell" is calling it, so it needs a label

        address: {
          ...address,
          position: 0,
          id: 0,
          type: 'address',
          label: new Area(address).spreadsheet_label,
        },

        value,
        format: cell_data.style ? cell_data.style.number_format : undefined,
        ...transform(cell_data, address),
      };

      return { type: ValueType.object, value: metadata, key: 'metadata' };

    }
    else if (range) {

      if (range.start.row === Infinity || range.start.column === Infinity) {
        return ReferenceError();
      }

      let sheet: Sheet|undefined;
      if (range.start.sheet_id) {
        sheet = this.data_model.sheets.Find(range.start.sheet_id);
      }

      if (!sheet) {
        throw new Error('missing sheet [ac9]');
      }

      const range_result: UnionValue[][] = [];

      for (let column = range.start.column; column <= range.end.column; column++) {
        const column_result: UnionValue[] = [];
        for (let row = range.start.row; row <= range.end.row; row++) {
          const cell_data = sheet.CellData({row, column});
          address = {...range.start, row, column};

          const value = cell_data.calculated_type ? cell_data.calculated : cell_data.value;

          const metadata = {
            type: 'metadata',
            address,
            value,
            format: cell_data.style ? cell_data.style.number_format : undefined,
            ...transform(cell_data, address),
          };

          column_result.push({
            type: ValueType.object,
            value: metadata,
            key: 'metadata',
          });

        }
        range_result.push(column_result);
      }
      
      return {type: ValueType.array, value: range_result};

    }

    return this.CalculateExpression(arg as ExtendedExpressionUnit); /*UnionOrArray*/

  }

  protected RewriteMacro(
      unit: ExpressionUnit, 
      names: Record<string, ExpressionUnit>,
    ): ExpressionUnit { 

    let expr: ExpressionUnit;

    switch (unit.type) {

      case 'identifier':
        expr = names[unit.name.toUpperCase()];
        if (expr) {
          return JSON.parse(JSON.stringify(expr)) as ExpressionUnit;
        }
        break;

      case 'binary':
        unit.left = this.RewriteMacro(unit.left, names);
        unit.right = this.RewriteMacro(unit.right, names);
        break;
  
      case 'unary':
        unit.operand = this.RewriteMacro(unit.operand, names);
        break;
  
      case 'group':
        unit.elements = unit.elements.map(element => this.RewriteMacro(element, names));
        break;

      case 'call':
        unit.args = unit.args.map(arg => this.RewriteMacro(arg, names));
        break;

      }

      return unit;

  }

  protected CallMacro(outer: UnitCall, macro: MacroFunction): (expr: UnitCall) => UnionValue /*UnionOrArray*/ {

    if (!macro.expression) {
      return () => ExpressionError();
    }
    const text_expr = JSON.stringify(macro.expression);
    const names: Record<string, ExpressionUnit> = {};
    const upper_case_names = macro.argument_names?.map(name => name.toUpperCase()) || [];

    return (expr: UnitCall) => {

      const clone = JSON.parse(text_expr);

      for (let i = 0; i < upper_case_names.length; i++) {
        names[upper_case_names[i]] = expr.args[i] || { type: 'missing', id: 0 };
      }

      return this.CalculateExpression(this.RewriteMacro(clone, names) as ExtendedExpressionUnit);

    }
      
  }

  /** 
   * this method can take a `call` type if it looked like a call at 
   * the parsing stage, it's a simple translation between the two
   */
  protected ImplicitCall(): (expr: UnitImplicitCall|UnitCall) => UnionValue {
    return (expr: UnitImplicitCall|UnitCall) => {

      if (expr.type === 'call') {
        expr = {
          type: 'implicit-call',
          args: expr.args,
          call: {
            type: 'identifier',
            name: expr.name,
            position: expr.position,
            id: 0,
          },
          position: expr.position,
          id: 0,
        };
      }

      const result = this.CalculateExpression(expr.call as ExtendedExpressionUnit);

      if (result.type === ValueType.function) {

        const value = result.value as {
          bindings: ExpressionUnit[];
          func: ExpressionUnit|undefined;
        };

        if (!value.func || !value.bindings) {
          return ExpressionError();
        }

        // let frame = value.bindings(expr.args);

        const frame: BindingFrame = {};

        for (let i = 0; i < value.bindings.length; i++) {
          const name = value.bindings[i];
          if (name?.type === 'identifier') {
            frame[name.name.toUpperCase()] = expr.args[i] || { type: 'missing' };
          }
          else { 
            // should not happen, error
            return ExpressionError();
          }
        }

        // frame = this.NormalizeBindings(frame); // inline

        const munged = JSON.parse(JSON.stringify(value.func));
        
        this.parser.Walk2(munged, (unit: ExpressionUnit) => {
          if (unit.type === 'identifier') {
            const upper_case = unit.name.toUpperCase();
            const binding = frame[upper_case];
            if (binding) {
              return JSON.parse(JSON.stringify(binding));
            }
          }
          return true;
        });
        
        // console.info({frame, func, munged});
        
        // const exec_result = this.CalculateExpression(munged as ExtendedExpressionUnit);
        // return exec_result || ExpressionError();

        return this.CalculateExpression(munged as ExtendedExpressionUnit);

      }

      return ExpressionError();
      
    };
  }

  protected NormalizeBindings(context: BindingFrame) {
    const frame: Record<string, ExpressionUnit> = {};
    for (const [key, value] of Object.entries(context)) {
      frame[key.toUpperCase()] = value;
    }
    return frame;
  }

  /** 
   * excute a function call 
   */
  protected CallExpression(outer: UnitCall, return_reference = false): (expr: UnitCall) => UnionValue /*UnionOrArray*/ {

    // get the function descriptor, which won't change.
    // we can bind in closure (also short-circuit check for 
    // invalid name)

    const func = this.library.Get(outer.name);

    if (!func) {

      const upper_case = outer.name.toUpperCase();

      const binding = this.LookupBinding(upper_case);
      if (binding) {
        return this.ImplicitCall();
      }

      const named = this.data_model.GetName(upper_case, this.context.address.sheet_id || 0);
      if (named) {
        return this.ImplicitCall();
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.info('(dev) missing function', outer.name);
      }

      return () => NameError();
    }

    return (expr: UnitCall) => {

      // set context volatile if this function is volatile. it will bubble
      // through nested function calls, so the entire cell will be volatile 
      // if there's a volatile function in there somewhere
      
      this.context.volatile = this.context.volatile || (!!func.volatile);

      // we recurse calculation, but in the specific case of IF functions
      // we can short-circuit and skip the unused code path. doesn't apply
      // anywhere else atm
      
      const if_function = outer.name.toLowerCase() === 'if';
      let skip_argument_index = -1;
      let argument_error: UnionValue|undefined;

      // possibly create a binding frame. if we do that we may need
      // to adjust the arguments as well (and the descriptors)

      let args = expr.args;
      let argument_descriptors = func.arguments || []; // map

      let binding: ContextResult|undefined;
      if (func.create_binding_context) {

        // if this does not return a binding frame, it's an error.

        binding = func.create_binding_context.call(0, {
          args: expr.args, 
          descriptors: argument_descriptors,
        }); 

        if (binding) {
          args = binding.args;
          if (binding.argument_descriptors) {
            argument_descriptors = binding.argument_descriptors;
          }
          this.context.bindings.unshift(this.NormalizeBindings(binding.context));
        }
        else {
          argument_error = ArgumentError();
        }

      }

      const mapped_args = args.map((arg, arg_index) => {

        // short circuit
        if (argument_error) { 
          return undefined; 
        }

        // get descriptor. if the number of arguments exceeds 
        // the number of descriptors, recycle the last one

        // FIXME: we have a repeat flag, so we should repeat the 
        // correct argument(s). I guess we could default to this
        // behavior.

        const descriptor = argument_descriptors[Math.min(arg_index, argument_descriptors.length - 1)] || {}; 

        // new for lambdas
        if (descriptor.passthrough) {
          return arg;
        }

        // if function, wrong branch
        if (arg_index === skip_argument_index) { 
          return descriptor.boxed ? { type: ValueType.undefined } : undefined;
        }

        // note on type here: we're iterating over the arguments 
        // described by the parse expression, not the values. although
        // in this case, wouldn't this be a missing type? (...)
        if (typeof arg === 'undefined') { 
          if (if_function && arg_index === 0) { skip_argument_index = 1; }
          return descriptor.boxed ? { type: ValueType.undefined } : undefined;
        }

        // FIXME (address): what about named ranges (actually those will work),
        // constructed references (we don't support them atm)?

        // NOTE: named ranges will _not_ work, because the address will be an
        // object, not a string. so FIXME.

        if (descriptor.address) {
          return descriptor.boxed ? {
            type: ValueType.string,
            value: this.parser.Render(arg).replace(/\$/g, ''),
          } : this.parser.Render(arg).replace(/\$/g, '');
        }
        else if (descriptor.metadata) {
          return this.GetMetadata(arg, () => { return {}}); // type is UnionOrArray
        }
        else {

          const result = this.CalculateExpression(arg as ExtendedExpressionUnit);

          if (result.type === ValueType.error) { // array check is implicit since array is a type
            if (descriptor.allow_error) {
              return result; // always boxed
            }
            argument_error = result;
            return undefined; // argument not used, so don't bother boxing
          }          

          // can't shortcut if you have an array (or we need to test all the values)

          if (if_function && arg_index === 0 && result.type !== ValueType.array){

            let result_truthy = false; 

            if (result.type === ValueType.string) {
              const lowercase = (result.value as string).toLowerCase().trim();
              result_truthy = lowercase !== 'false' && lowercase !== 'f';
            }
            else {
              result_truthy = !!result.value;
            }

            skip_argument_index = result_truthy ? 2 : 1;
          }

          if (descriptor.boxed) {
            return result;
          }

          if (result.type === ValueType.array) {
            return (result as ArrayUnion).value.map(row => row.map(value => value.value));            
          }
          else {
            return result.value; // unboxing
          }

        }

      });

      if (binding) {
        this.context.bindings.shift();
      }

      if (argument_error) {
        return argument_error;
      }

      // cloning, out of an abundance of caution
      // const ctx = JSON.parse(JSON.stringify({ address: this.context.address, area: this.context.area }));
      const ctx = {
        address: { ...this.context.address },
        area: this.context.area ? {
          start: { ...this.context.area.start, },
          end: { ...this.context.area.end, },
        } : undefined,
      };

      if (func.return_type === 'reference') {

        const result = func.fn.apply(ctx, mapped_args);
        
        if (return_reference) { 
          return result; 
        }
        
        if (UnionIsExpressionUnit(result)) {
          if (result.value.type === 'address') {
            return this.CellFunction2(result.value)();
          }
          else if (result.value.type === 'range') {
            return this.CellFunction4(result.value.start, result.value.end)
          }
        }

        return result; // error?

      }

      return func.fn.apply(ctx, mapped_args);

    };

  }

  protected ResolveStructuredReference(expr: UnitStructuredReference): () => UnionValue {

    // basically our approach here is to resolve the structured reference
    // to a concrete reference. 
    //
    // if the structured reference changes, then it will get recalculated 
    // (and hence rebuilt). if the table name or a referenced column name 
    // changes, the cell will get rewritten so again, it will get recalculated.
    //
    // the case we have to worry about is if the table layout changes: if a
    // column is added or removed. because in that case, our reference will
    // be out of date but we won't be notified about it.
    //
    // so we will have to make sure that if a table layout changes, columns
    // or rows added or deleted, then we invalidate the entire table. if we 
    // do that this should all work out.

    const resolved = this.data_model.ResolveStructuredReference(expr, this.context.address);
    if (resolved) {
      if (resolved.type === 'address') {
        return this.CellFunction2(resolved);
      }
      else if(resolved.type === 'range') {
        return () => this.CellFunction4(resolved.start, resolved.end);
      }
    }

    return () => ReferenceError();

  }

  protected ResolveDimensionedQuantity(): (exp: UnitDimensionedQuantity) => UnionValue {

    return (expr: UnitDimensionedQuantity): UnionValue => {
      const expression = this.CalculateExpression(expr.expression as ExtendedExpressionUnit);
      return {
        type: ValueType.dimensioned_quantity,
        value: {
          value: expression.value,
          unit: expr.unit.name,
        },
      } as DimensionedQuantityUnion;
    };

  }

  protected UnaryExpression(x: UnitUnary, return_reference = false): (expr: UnitUnary) => UnionValue /*UnionOrArray*/ { // operator: string, operand: any){

    // there are basically three code paths here: negate, identity, and error.
    // they have very different semantics so we're going to do them completely
    // separately.

    switch (x.operator) {
    case '+':
      return (expr: UnitUnary) => {
        return this.CalculateExpression(expr.operand as ExtendedExpressionUnit);
      };

    case '-':
      {
        const func = Primitives.Subtract;
        const zero = { type: ValueType.number, value: 0 } as NumberUnion;

        return (expr: UnitUnary) => {
          const operand = this.CalculateExpression(expr.operand as ExtendedExpressionUnit);
          if (operand.type === ValueType.array) {
            return {
              type: ValueType.array,
              value: (operand as ArrayUnion).value.map(column => column.map(value => func(zero, value))),
            };
          }
          return func(zero, operand);
        };

      }

    case '@':
      return (expr: UnitUnary) => {

        // if the operand is a range, then we need to do implicit intersection.
        // otherwise, calculate the expression and return the first value 
        // if it's an array.

        let address: UnitAddress|undefined;

        switch (expr.operand.type) {
          case 'address':
            if (expr.operand.spill) {

              // we need to calculate the result so we know how large the
              // range is... perhaps there's a way to look this up without
              // calculating? (TODO/FIXME)

              const calculated = this.CellFunction2(expr.operand)();
              if (calculated.type === ValueType.array) {

                const row = this.context.address.row ?? -1;
                const column = this.context.address.column ?? -1;

                // for this verison we already have the result, so unless
                // we're trying to preserve the address, we could just 
                // return it

                if (row >= expr.operand.row && row < expr.operand.row + calculated.value[0]?.length && calculated.value.length === 1) {

                  if (!return_reference) {
                    return calculated.value[0][row - expr.operand.row];
                  }

                  address = {
                    ...expr.operand,
                    row,
                    spill: false,
                  };
                }
                else if (column >= expr.operand.column && column < expr.operand.column + calculated.value.length && calculated.value[0]?.length === 1) {

                  if (!return_reference) {
                    return calculated.value[column - expr.operand.column][0];
                  }

                  address = {
                    ...expr.operand,
                    column,
                    spill: false,
                  };
                }
                else {
                  return ValueError(); // out of range
                }

              }

              // return { type: ValueType.string, value: 'implicit (spill)' };
            }
            break;

          case 'range':
            {
              // how do we intersect, if at all?

              const row = this.context.address.row ?? -1;
              const column = this.context.address.column ?? -1;
              if (row >= expr.operand.start.row && row <= expr.operand.end.row && expr.operand.start.column === expr.operand.end.column) {
                address = {
                  ...expr.operand.start,
                  row,
                  spill: false,
                };
              }
              else if (column >= expr.operand.start.column && column <= expr.operand.end.column && expr.operand.start.row === expr.operand.end.row) {
                address = {
                  ...expr.operand.start,
                  column,
                  spill: false,
                };
              }
              else {
                return ValueError(); // out of range
              }
            }
        }

        if (address) {
          if (return_reference) {
            return { type: ValueType.object, value: address,
            }
          }
          return this.CellFunction2(address)();
       }

        const operand = this.CalculateExpression(expr.operand as ExtendedExpressionUnit);

        if (operand.type === ValueType.array) {
          return operand.value[0][0];
        }

        return operand;
      };

    default:
      return () => {
        console.warn('unexpected unary operator:', x.operator);
        return ExpressionError();
      };
    }

  }

  /**
   * expands the size of an array by recycling values in columns and rows
   * 
   * FIXME: seems like this is more a generic thing, -> utils lib
   *
   * @param arr 2d array
   * @param columns target columns
   * @param rows target rows
   */
  protected RecycleArray<T>(arr: T[][], columns: number, rows: number): T[][] {

    // NOTE: recycle rows first, more efficient. do it in place?

    if (arr[0].length < rows) {
      const len = arr[0].length;
      for (const column of arr) {
        for (let r = len; r < rows; r++ ) {
          column[r] = column[r % len];
        }
      }
    }

    if (arr.length < columns) {
      const len = arr.length;
      for (let c = len; c < columns; c++) arr[c] = arr[c % len].slice(0);
    }

    return arr;

  }

  protected ElementwiseBinaryExpression(fn: Primitives.PrimitiveBinaryExpression, left: ArrayUnion, right: ArrayUnion): ArrayUnion {

    const columns = Math.max(left.value.length, right.value.length);
    const rows = Math.max(left.value[0].length, right.value[0].length);

    const left_values = this.RecycleArray(left.value, columns, rows);
    const right_values = this.RecycleArray(right.value, columns, rows);

    const value: UnionValue[][] = [];

    for (let c = 0; c < columns; c++) {
      const col: UnionValue[] = [];

      for (let r = 0; r < rows; r++ ) {

        // handle undefineds. this is unfortunate. shouldn't the recycle 
        // function do that? ...CHECK/TODO/FIXME

        col[r] = fn(
          left_values[c][r] || { type: ValueType.undefined }, 
          right_values[c][r] || { type: ValueType.undefined });
        
      }
      value.push(col);
    }

    return { type: ValueType.array, value };

  }

  /**
   * convert expr to a cell address, possibly calculating the contents.
   * returns single address only (ranges with len > 1 will fail)
   */
  protected AsReference(expr: ExpressionUnit): ICellAddress|undefined {

    switch (expr.type) {
      case 'address':
        return expr;

      case 'range':
        if (expr.start.row === expr.end.row && expr.start.column === expr.end.column) {
          return expr.start;
        }
        break;

      default:
        {
          const union = this.CalculateExpression(expr as ExtendedExpressionUnit, true);
          if (UnionIsExpressionUnit(union)) {
            if (union.value.type === 'address') {
              return union.value;
            }
            if (union.value.type === 'range' && union.value.start.row === union.value.end.row && union.value.start.column === union.value.end.column) {
              return union.value.start;
            }
          } 
        }
        break;
    }

    return undefined;

  }

  protected BinaryExpression(x: UnitBinary): (expr: UnitBinary) => UnionValue /*UnionOrArray*/ {

    // we are constructing and caching functions for binary expressions.
    // this should simplify calls when parameters change. eventually I'd
    // like to do this for other dynamic calls as well...

    // the idea is that we can start composing compound expressions. still
    // not sure if that will work (or if it's a good idea).

    // NOTE (for the future?) if one or both of the operands is a literal,
    // we can bind that directly. literals in the expression won't change
    // unless the expression changes, which will discard the generated
    // function (along with the expression itself).

    // pulling out concat so we can bind the model for language values

    const fn = x.operator === '&' ? (a: UnionValue, b: UnionValue): UnionValue => {

      // this works, but it's not volatile so it doesn't update on 
      // a language change; maybe language change should force a recalc? (...)

      if (a.type === ValueType.error) { return a; }
      if (b.type === ValueType.error) { return b; }
    
      const strings = [a, b].map(x => {
        if (x.type === ValueType.undefined) { return ''; }
        if (x.type === ValueType.boolean) {
          if (x.value) {
            return this.data_model.language_model?.boolean_true || 'TRUE';
          }
          else {
            return this.data_model.language_model?.boolean_false || 'FALSE';
          }
        }
        return x.value;
      });

      return {
        type: ValueType.string, 
        value: `${strings[0]}${strings[1]}`,
      };
    

    } : Primitives.MapOperator(x.operator);

    if (!fn) {

      // support dynamically-constructed ranges, as long as the 
      // arguments are both addresses (we might see ranges, but
      // if they are 1x1 then we can accept them)

      if (x.operator === ':') {
        return (expr: UnitBinary) => {

          const start = this.AsReference(expr.left);
          const end = this.AsReference(expr.right);

          if (start && end) {
            return this.CellFunction4(start, end);
          }
         
          return ExpressionError();
        };
      }

      return () => { // expr: UnitBinary) => {
        console.info(`(unexpected binary operator: ${x.operator})`);
        return ExpressionError();
      };
    }
    else {
      return (expr: UnitBinary) => {

        // sloppy typing, to support operators? (...)

        const left = this.CalculateExpression(expr.left as ExtendedExpressionUnit);
        const right = this.CalculateExpression(expr.right as ExtendedExpressionUnit);

        // check for arrays. do elementwise operations.

        if (left.type === ValueType.array) {
          if (right.type === ValueType.array) {
            return this.ElementwiseBinaryExpression(fn, left as ArrayUnion, right as ArrayUnion);
          }
          return this.ElementwiseBinaryExpression(fn, left as ArrayUnion, {type: ValueType.array, value: [[right]]});
        }
        else if (right.type === ValueType.array) {
          return this.ElementwiseBinaryExpression(fn, {type: ValueType.array, value: [[left]]}, right as ArrayUnion);
        }
        
        return fn(left, right);

      };
    }

  }

  protected Identifier(expr: UnitIdentifier): () => UnionValue /*UnionOrArray*/ {

    // NOTE: TRUE and FALSE don't get here -- they are converted
    // to literals by the parser? (...)

    // the function we create here binds the name because
    // this is a literal identifier. if the value were to change,
    // the expression would be discarded.

    // however we have to do the lookup dynamically because the
    // underlying reference (in the named range map) might change.

    // although it's worth noting that, atm at least, that wouldn't
    // trigger an update because it's not considered a value change.
    // you'd have to recalc, which would rebuild the expression anyway.
    // call that a FIXME? (...)

    const identifier = expr.name;

    // anything starting with # is an error. the only thing we should 
    // have is #REF, but maybe that will change in the future.

    if (identifier[0] === '#') {
      return () => ReferenceError();
    }

    const upper_case = identifier.toUpperCase();

    switch (upper_case){
    case 'FALSE':
    case 'F':
      return () => {return {value: false, type: ValueType.boolean}};

    case 'TRUE':
    case 'T':
      return () => {return {value: true, type: ValueType.boolean}};

    case 'UNDEFINED':
      return () => {return {value: undefined, type: ValueType.undefined}}; // why do we support this?
    }

    return () => {

      const binding = this.LookupBinding(upper_case);
      if (binding) {
        return this.CalculateExpression(binding as ExtendedExpressionUnit);
      }
      
      const named = this.data_model.GetName(upper_case, this.context.address.sheet_id || 0);
      console.info("NAMED", named);

      switch (named?.type) {
        case 'range':
          if (named.area.count === 1) {
            return this.CellFunction4(named.area.start, named.area.start);
          }
          return this.CellFunction4(named.area.start, named.area.end);
          
        case 'expression':
          return this.CalculateExpression(named.expression as ExtendedExpressionUnit);
      }

      // console.info( '** identifier', {identifier, expr, context: this.context});
      
      return NameError();

    };

  }

  /**
   * look up an identifier in any binding frames. we do LIFO binding.
   * 
   * @param name 
   * @returns 
   */
  protected LookupBinding(name: string) {
    name = name.toUpperCase();
    for (const frame of this.context.bindings) {
      const value = frame[name];
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  protected GroupExpression(x: UnitGroup): (expr: UnitGroup) => UnionValue /*UnionOrArray*/ {

    // a group is an expression in parentheses, either explicit
    // (from the user) or implicit (created to manage operation
    // priority, order of operations, or similar).

    // expressions nest, so there's no case where a group should
    // have length !== 1 -- consider that an error.

    if (!x.elements || x.elements.length !== 1){
      console.warn( `Can't handle group !== 1` );
      return () => ExpressionError();
    }
    return (expr: UnitGroup) => this.CalculateExpression(expr.elements[0] as ExtendedExpressionUnit);
  }

  protected CalculateExpression(expr: ExtendedExpressionUnit, return_reference = false): UnionValue {

    // user data is a generated function for the expression, at least
    // for the simple ones (atm). see BinaryExpression for more. the
    // aim is to remove as many tests and lookups as possible.

    // may be over-optimizing here.

    if ((expr as AttachCachedFunction<ExpressionUnit>).fn) {
      return (expr as AttachCachedFunction<ExpressionUnit>).fn(expr);
    }

    switch (expr.type){

    case 'implicit-call':
      return (expr.fn = this.ImplicitCall())(expr);

    case 'call':
      {
        const macro = this.data_model.macro_functions.get(expr.name.toUpperCase());
        if (macro) {
          return (expr.fn = this.CallMacro(expr, macro))(expr);
        }
        return (expr.fn = this.CallExpression(expr, return_reference))(expr);
      }

    case 'address':
      return (expr.fn = this.CellFunction2(expr))(); // check

    case 'range':
      return (expr.fn = (x: UnitRange) => this.CellFunction4(x.start, x.end))(expr); // check

    case 'binary':
      return (expr.fn = this.BinaryExpression(expr))(expr); // check

    case 'unary':
      return (expr.fn = this.UnaryExpression(expr, return_reference))(expr); // check

    case 'identifier':
      return (expr.fn = this.Identifier(expr))(); // check

    case 'missing':
      return (expr.fn = () => { return { value: undefined, type: ValueType.undefined } as UndefinedUnion })(); // check

    case 'dimensioned':
      return (expr.fn = this.ResolveDimensionedQuantity())(expr);

    case 'literal':
      {
        const literal = { value: expr.value, type: GetValueType(expr.value) } as UnionValue;
        return (expr.fn = () => literal)();  // check
      }
    case 'group':
      return (expr.fn = this.GroupExpression(expr))(expr); // check

    case 'complex':
      {
        const literal = {value: {real: expr.real, imaginary: expr.imaginary}, type: ValueType.complex } as ComplexUnion;
        return (expr.fn = () => literal)();  // check
      }

    case 'structured-reference':
      return (expr.fn = this.ResolveStructuredReference(expr))();

    case 'array':
      {
        return (expr.fn = () => {
          return { 
            type: ValueType.array,
            value: expr.values.map((row) => (Array.isArray(row) ? row : [row]).map((value) => {
              return { type: GetValueType(value), value } as UnionValue;
            })),
          } as ArrayUnion;
        })();
      }

    default:
      console.warn( 'Unhandled parse expr:', expr);
      return UnknownError();
    }
  }

}

