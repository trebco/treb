
import type { FunctionLibrary } from './function-library';
import { Cell, ICellAddress, ValueType, GetValueType,
         Area, UnionValue, CellValue,
         ArrayUnion,
         NumberUnion,
         UndefinedUnion,
         ComplexUnion } from 'treb-base-types';
import type { Parser, ExpressionUnit, UnitBinary, UnitIdentifier,
         UnitGroup, UnitUnary, UnitAddress, UnitRange, UnitCall, UnitDimensionedQuantity } from 'treb-parser';
import type { DataModel, MacroFunction, Sheet } from 'treb-grid';
import { NameError, ReferenceError, ExpressionError, UnknownError } from './function-error';
import { ReturnType } from './descriptors';

import * as Primitives from './primitives';

export type ExtendedExpressionUnit = ExpressionUnit & { user_data: any }; // export for MC overload

// FIXME: move
export const UnionIsExpressionUnit = (test: UnionValue /*UnionOrArray*/): test is { type: ValueType.object, value: ExpressionUnit } => {
  return !Array.isArray(test) 
      && test.type === ValueType.object
      && (!!(test.value as ExpressionUnit).type);
};

// FIXME: move
export const UnionIsMetadata = (test: UnionValue /*UnionOrArray*/): test is { type: ValueType.object, value: ReferenceMetadata } => {

  return test.type === ValueType.object && test.key === 'metadata';

  /*
  return !Array.isArray(test) 
      && test.type === ValueType.object
      && ((test.value as ReferenceMetadata).type === 'metadata');
    */
};

// FIXME: move
export interface ReferenceMetadata {
  type: 'metadata';
  address: UnitAddress; // ICellAddress;
  value: CellValue;
  format?: string;
}

export interface CalculationContext {
  address: ICellAddress;
  model?: DataModel;
  volatile: boolean;
  call_index: number;
}

export class ExpressionCalculator {

  public context: CalculationContext = {
    address: { row: -1, column: -1 },
    volatile: false,
    call_index: 0,
  };

  /**
   * this refers to the number of function call within a single cell.
   * so if you have a function like
   *
   * =A(B())
   *
   * then when calculating A call index should be set to 1; and when
   * calculating B, call index is 2. and so on. 
   */
  protected call_index = 0;

  // local reference
  // protected cells: Cells = new Cells();
  // protected cells_map: {[index: number]: Cells} = {};
  // protected sheet_name_map: {[index: string]: number} = {};

  // local reference
  protected named_range_map: {[index: string]: Area} = {};

  // protected bound_name_stack: Array<Record<string, ExpressionUnit>> = [];

  //
  protected data_model!: DataModel;


  // --- public API -----------------------------------------------------------

  constructor(
    protected readonly library: FunctionLibrary,
    protected readonly parser: Parser) {}

  public SetModel(model: DataModel): void {

    // this.cells_map = {};
    // this.sheet_name_map = {};

    /*
    for (const sheet of model.sheets.list) {
      // this.cells_map[sheet.id] = sheet.cells;
      // this.sheet_name_map[sheet.name.toLowerCase()] = sheet.id;
    }
    */

    this.data_model = model;
    this.named_range_map = model.named_ranges.Map();
    this.context.model = model;
    
  }

  /**
   * there's a case where we are calling this from within a function
   * (which is weird, but hey) and to do that we need to preserve flags.
   */
  public Calculate(expr: ExpressionUnit, addr: ICellAddress, preserve_flags = false): {
      value: UnionValue /*UnionOrArray*/, volatile: boolean }{

    if (!preserve_flags) {

      this.context.address = addr;
      this.context.volatile = false;
      this.context.call_index = 0;

      // reset for this cell
      this.call_index = 0; // why not in model? A: timing (nested)

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

        // expr.sheet_id = this.sheet_name_map[expr.sheet.toLowerCase()];
      }
      else {
        return () => ReferenceError();
      }
    }

    // const cells = this.cells_map[expr.sheet_id];
    const cells = this.data_model.sheets.Find(expr.sheet_id)?.cells;

    if (!cells) {
      console.warn('missing cells reference @ ' + expr.sheet_id);
      return () => ReferenceError();
    }

    // reference
    const cell = cells.GetCell(expr);

    // this is not an error, just a reference to an empty cell
    if (!cell) {
      return () => { 
        return { type: ValueType.undefined, value: undefined } 
      };
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

    //const cells = this.cells_map[start.sheet_id];
    const cells = this.data_model.sheets.Find(start.sheet_id)?.cells;

    return cells?.GetRange4(start, end, true) || ReferenceError();

  }

  /** breaking this out to de-dupe */
  protected GetMetadata(arg: ExpressionUnit, map_result: (cell_data: Cell, address: ICellAddress) => any): UnionValue /*UnionOrArray*/ {

    // FIXME: we used to restrict this to non-cell functions, now
    // we are using it for the cell function (we used to use address,
    // which just returns the label)

    let address: ICellAddress|undefined;
    let range: {start: ICellAddress; end: ICellAddress} | undefined;

    switch (arg.type) {
    case 'address':
      address = arg;
      break;

    case 'range':
      range = arg;
      break;

    case 'identifier':
      {
        const named_range = this.named_range_map[arg.name.toUpperCase()];
        if (named_range) {
          if (named_range.count === 1) {
            address = named_range.start; // FIXME: range?
          }
          else {
            range = named_range;
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

      let sheet: Sheet|undefined; // = this.data_model.active_sheet;
      if (address.sheet_id) { // && address.sheet_id !== sheet.id) {
        sheet = this.data_model.sheets.Find(address.sheet_id);

        /*
        for (const test of this.data_model.sheets) {
          if (test.id === address.sheet_id) {
            sheet = test;
            break;
          }
        }
        */
      }

      if (!sheet) {
        // throw new Error('missing sheet [ac8]');
        console.error('missing sheet [ac8]');
        return ReferenceError();
      }

      const cell_data = sheet.CellData(address);
      const value = // (cell_data.type === ValueType.formula) ? cell_data.calculated : cell_data.value;
        cell_data.calculated_type ? cell_data.calculated : cell_data.value;

      const metadata: ReferenceMetadata = {
        type: 'metadata',
        address: {...address},
        value,
        format: cell_data.style ? cell_data.style.number_format : undefined,
        ...map_result(cell_data, address),
      };

      return { type: ValueType.object, value: metadata, key: 'metadata' };

    }
    else if (range) {

      if (range.start.row === Infinity || range.start.column === Infinity) {
        return ReferenceError();
      }

      let sheet: Sheet|undefined; // = this.data_model.active_sheet;
      if (range.start.sheet_id) { // && range.start.sheet_id !== sheet.id) {
        sheet = this.data_model.sheets.Find(range.start.sheet_id);
        /*
        for (const test of this.data_model.sheets) {
          if (test.id === range.start.sheet_id) {
            sheet = test;
            break;
          }
        }
        */
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

          const value = // (cell_data.type === ValueType.formula) ? cell_data.calculated : cell_data.value;
            cell_data.calculated_type ? cell_data.calculated : cell_data.value;

          const metadata = {
            type: 'metadata',
            address,
            value,
            format: cell_data.style ? cell_data.style.number_format : undefined,
            ...map_result(cell_data, address),
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
   * excutes a function call 
   *
   * the return type of functions has never been locked down, and as a result
   * there are a couple of things we need to handle. 
   * 
   * return type can be any value, essentially, or array, error object, or 
   * (in the case of some of the reference/lookup functions) an address or 
   * range expression. array must be 2d, I think? not sure that that is true.
   * 
   * this wrapper function returns a function which returns one of those
   * things, i.e. it returns (expr) => return type
   * 
   * it will only return address/range if the parameter flag is set, so we
   * could in theory lock it down a bit with overloads.
   * 
   * ---
   * 
   * UPDATE: that's no longer the case. we require that functions return 
   * a UnionValue type (union), which can itself contain an array.
   * 
   * ---
   * 
   * FIXME: there is far too much duplication between this and the MC version
   * (in simulation-expression-calculator). we need to find a way to consolidate
   * these.
   * 
   * I think the problem is that we don't want a lot of switches, but the cost
   * is an almost complete duplicate of this function in the subclass.
   * 
   */
  protected CallExpression(outer: UnitCall, return_reference = false): (expr: UnitCall) => UnionValue /*UnionOrArray*/ {

    // get the function descriptor, which won't change.
    // we can bind in closure (also short-circuit check for 
    // invalid name)

    const func = this.library.Get(outer.name);

    if (!func) {
      return () => NameError();
    }

    return (expr: UnitCall) => {

      // get an index we can use for this call (we may recurse when
      // calculating arguments), then increment for the next call.

      const call_index = this.call_index++;

      // yeah so this is clear. just checking volatile.

      // FIXME: should this be set later, at the same time as the
      // calculation index? I think it should, since we may recurse.

      // BEFORE YOU DO THAT, track down all references that read this field

      // from what I can tell, the only place this is read is after the
      // external (outer) Calculate() call. so we should move this assignment,
      // and we should also be able to get it to fail:
      //
      // RandBetween() should be volatile, but if we have a nonvolatile function
      // as an argument that should unset it, and remove the volatile flag.
      // Check?

      // actually this works, because it only sets the flag (does not unset).
      // volatile applies to the _cell_, not just the function -- so as long
      // as the outer function sets the flag, it's not material if an inner
      // function is nonvolatile. similarly an inner volatile function will
      // make the outer function volatile.

      // this does mean that the nonvolatile function will be treated differently
      // if it's an argument to a volatile function, but I think that's reasonable
      // behavior; also it's symmetric with the opposite case (inner volatile.)

      // so leave this as-is, or you can move it -- should be immaterial

      this.context.volatile = this.context.volatile || (!!func.volatile);

      // NOTE: the argument logic is (possibly) calculating unecessary operations,
      // if there's a conditional (like an IF function). although that is the
      // exception rather than the rule...

      // ok we can handle IF functions, at the expense of some tests... 
      // is it worth it? 

      const if_function = outer.name.toLowerCase() === 'if';
      let skip_argument_index = -1;

      let argument_error: UnionValue|undefined;

      const argument_descriptors = func.arguments || []; // map

      const mapped_args = expr.args.map((arg, arg_index) => {

        // short circuit
        if (argument_error) { 
          return undefined; 
        }

        // get descriptor. if the number of arguments exceeds 
        // the number of descriptors, recycle the last one
        const descriptor = argument_descriptors[Math.min(arg_index, argument_descriptors.length - 1)] || {}; 
        
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

          // if (!Array.isArray(result) && result.type === ValueType.error) {

          if (result.type === ValueType.error) { // array check is implicit since array is a type
            if (descriptor.allow_error) {
              return result; // always boxed
            }
            argument_error = result;
            return undefined; // argument not used, so don't bother boxing
          }          

          // can't shortcut if you have an array (or we need to test all the values)

          //if (if_function && arg_index === 0 && !Array.isArray(result)) {
          if (if_function && arg_index === 0 && result.type !== ValueType.array){ // !Array.isArray(result)) {
              let result_truthy = false; 

            // if (Array.isArray(result)) { result_truthy = true; }

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

          /*
          if (Array.isArray(result)) {
            return result.map(row => row.map(value => value.value));
          }
          */
          if (result.type === ValueType.array) {
            return (result as ArrayUnion).value.map(row => row.map(value => value.value));            
          }
          else {
            return result.value; // unboxing
          }

        }

      });

      if (argument_error) {
        return argument_error;
      }

      // if we have any nested calls, they may have updated the index so
      // we use the captured value here.

      this.context.call_index = call_index;

      // I thought we were passing the model as this (...) ? actually
      // now we bind functions that need this, so maybe we should pass
      // null here.

      // return func.fn.apply(null, mapped_args);
      
      if (func.return_type === ReturnType.reference) {

        const result = func.fn.apply(null, mapped_args);
        
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

      return func.fn.apply(null, mapped_args);

    };

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
      };
    };

  }

  protected UnaryExpression(x: UnitUnary): (expr: UnitUnary) => UnionValue /*UnionOrArray*/ { // operator: string, operand: any){

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
          /*
          if (Array.isArray(operand)) {
            return operand.map(column => column.map(value => func(zero, value)));
          }
          */
          return func(zero, operand);
        };

      }

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

  //protected ElementwiseBinaryExpression(fn: Primitives.PrimitiveBinaryExpression, left: UnionValue[][], right: UnionValue[][]): UnionValue[][] {
  protected ElementwiseBinaryExpression(fn: Primitives.PrimitiveBinaryExpression, left: ArrayUnion, right: ArrayUnion): ArrayUnion {

    const columns = Math.max(left.value.length, right.value.length);
    const rows = Math.max(left.value[0].length, right.value[0].length);

    // const columns = Math.max(left.length, right.length);
    // const rows = Math.max(left[0].length, right[0].length);

    const left_values = this.RecycleArray(left.value, columns, rows);
    const right_values = this.RecycleArray(right.value, columns, rows);

    const value: UnionValue[][] = [];

    for (let c = 0; c < columns; c++) {
      const col = [];
      for (let r = 0; r < rows; r++ ) {
        col[r] = fn(left_values[c][r], right_values[c][r]);
      }
      value.push(col);
    }

    return { type: ValueType.array, value };

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

    const fn = Primitives.MapOperator(x.operator);

    if (!fn) {
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

      /*
      if (this.bound_name_stack[0]) {
        const expr = this.bound_name_stack[0][upper_case];
        if (expr) {
          console.info("BOUND", upper_case, expr);
          return this.CalculateExpression(expr as ExtendedExpressionUnit);
        }
      }
      */

      const named_range = this.named_range_map[upper_case];

      if (named_range) {
        if (named_range.count === 1) {
          return this.CellFunction4(named_range.start, named_range.start);
        }
        else {
          return this.CellFunction4(named_range.start, named_range.end);
        }
      }

      const named_expression = this.data_model.named_expressions.get(upper_case); 
      if (named_expression) {
        return this.CalculateExpression(named_expression as ExtendedExpressionUnit);
      }

      /*
      const bound_names = this.context.name_stack[0];

      if (bound_names && bound_names[upper_case]) {
        const bound_expression = bound_names[upper_case];
        return this.CalculateExpression(bound_expression);
      }
      */

      // console.info( '** identifier', {identifier, expr, context: this.context});
      
      return NameError();

    };

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

  protected CalculateExpression(expr: ExtendedExpressionUnit, return_reference = false): UnionValue /*UnionOrArray*/ {

    // user data is a generated function for the expression, at least
    // for the simple ones (atm). see BinaryExpression for more. the
    // aim is to remove as many tests and lookups as possible.

    // may be over-optimizing here.

    if (expr.user_data) {
      return expr.user_data(expr);
    }

    switch (expr.type){
    case 'call':
      {
        const macro = this.data_model.macro_functions.get(expr.name.toUpperCase());
        if (macro) {
          return (expr.user_data = this.CallMacro(expr, macro))(expr);
        }
        return (expr.user_data = this.CallExpression(expr, return_reference))(expr);
      }

    case 'address':
      return (expr.user_data = this.CellFunction2(expr))(); // check

    case 'range':
      return (expr.user_data = (x: UnitRange) => this.CellFunction4(x.start, x.end))(expr); // check

    case 'binary':
      return (expr.user_data = this.BinaryExpression(expr))(expr); // check

    case 'unary':
      return (expr.user_data = this.UnaryExpression(expr))(expr); // check

    case 'identifier':
      return (expr.user_data = this.Identifier(expr))(); // check

    case 'missing':
      return (expr.user_data = () => { return { value: undefined, type: ValueType.undefined } as UndefinedUnion })(); // check

    case 'dimensioned':
      return (expr.user_data = this.ResolveDimensionedQuantity())(expr);

    case 'literal':
      {
        const literal = { value: expr.value, type: GetValueType(expr.value) } as UnionValue;
        return (expr.user_data = () => literal)();  // check
      }
    case 'group':
      return (expr.user_data = this.GroupExpression(expr))(expr); // check

    case 'complex':
      {
        const literal = {value: {real: expr.real, imaginary: expr.imaginary}, type: ValueType.complex } as ComplexUnion;
        return (expr.user_data = () => literal)();  // check
      }

    case 'array':
      {
        return (expr.user_data = () => {
          return { 
            type: ValueType.array,
            value: expr.values.map((row: any) => (Array.isArray(row) ? row : [row]).map((value: any) => {
              return { type: GetValueType(value), value } as UnionValue;
            })),
          } as ArrayUnion;
        })();
        /*
        return (expr.user_data = () => expr.values.map(row => (Array.isArray(row) ? row : [row]).map(value => {
          return { value, type: GetValueType(value) }
        })))(); // check
        */
      }

    default:
      console.warn( 'Unhandled parse expr:', expr);
      return UnknownError();
    }
  }

}

