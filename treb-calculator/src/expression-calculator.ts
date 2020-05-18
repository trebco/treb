
import { FunctionLibrary } from './function-library';
import { Cell, Cells, ICellAddress, ValueType, Area } from 'treb-base-types';
import { Parser, ExpressionUnit, UnitBinary, UnitIdentifier,
         UnitGroup, UnitUnary, UnitAddress, UnitRange, UnitCall } from 'treb-parser';
import { DataModel } from 'treb-grid';
import { FunctionError, NameError, ReferenceError, ExpressionError } from './function-error';
import { ReturnType } from './descriptors';
import { MacroFunction } from 'treb-grid';

import * as Utilities from './utilities';
import * as Primitives from './primitives';

export interface CalculationContext {
  address: ICellAddress;
  volatile: boolean;
  call_index: number;
  name_stack: Array<{[index: string]: ExpressionUnit}>;
}

export class ExpressionCalculator {

  public context: CalculationContext = {
    address: { row: -1, column: -1 },
    volatile: false,
    call_index: 0,
    name_stack: [],
  };

  /**
   * this refers to the number of function call within a single cell.
   * so if you have a function like
   *
   * =A(B())
   *
   * then when calculating A call index should be set to 1; and when
   * calculating B, call index is 2. and so on. this is used for keeping
   * track of data in the simulation model, where we may have per-distribution
   * data (generally LHS fields or correlation blocks).
   */
  protected call_index = 0;

  // local reference
  // protected cells: Cells = new Cells();
  protected cells_map: {[index: number]: Cells} = {};
  protected sheet_name_map: {[index: string]: number} = {};

  // local reference
  protected named_range_map: {[index: string]: Area} = {};

  //
  protected data_model!: DataModel;


  // --- public API -----------------------------------------------------------

  constructor(
      // protected readonly simulation_model: SimulationModel,
      protected readonly library: FunctionLibrary,
      protected readonly parser: Parser) {
  }

  public SetModel(model: DataModel) {
    // this.cells = model.active_sheet.cells;
    this.cells_map = {};
    this.sheet_name_map = {};

    for (const sheet of model.sheets) {
      this.cells_map[sheet.id] = sheet.cells;
      this.sheet_name_map[sheet.name.toLowerCase()] = sheet.id;
    }

    this.data_model = model;
    this.named_range_map = model.named_ranges.Map();
  }

  /**
   * there's a case where we are calling this from within a function
   * (which is weird, but hey) and to do that we need to preserve flags.
   */
  public Calculate(expr: ExpressionUnit, addr: ICellAddress, preserve_flags = false){

    if (!preserve_flags) {
      this.context.address = addr;
      this.context.volatile = false;
      this.context.call_index = 0;

      // reset for this cell
      this.call_index = 0; // why not in model? A: timing (nested)

    }

    const value = this.CalculateExpression(expr);

    return {
      value,
      volatile: this.context.volatile,
    };

  }

  /*
  protected AssignCustomRenderFunc(func: CompositeFunctionDescriptor) {
    console.info('acrf', this.context);
  }
  */

  // --- /public API ----------------------------------------------------------

  /**
   * we pass around errors as objects with an error (string) field.
   * this is a simplified check for that type.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected IsError(value: any) {
    return (typeof value === 'object') && value.error;
  }

  /**
   * testing: can we cache (or close) the reference direcly, saving lookups?
   * 
   * A: probably not, if the lookup is calculated... does that ever happen?
   * A: it does happen, in the Indirect and Offset functions, but those are
   *    constructed dynamically so they won't be cached. so should be ok to
   *    close.
   */
  protected CellFunction2(expr: UnitAddress) {

    if (!expr.sheet_id) {
      if (expr.sheet) {
        expr.sheet_id = this.sheet_name_map[expr.sheet.toLowerCase()];
      }
      else {
        return () => ReferenceError;
      }
    }

    const cells = this.cells_map[expr.sheet_id];

    if (!cells) {
      console.warn('missing cells reference @ ' + expr.sheet_id);
      return () => ReferenceError;
    }

    // reference
    const cell = cells.GetCell(expr);

    // this is not an error, just a reference to an empty cell
    if (!cell) {
      return () => undefined;
    }

    // close
    return () => cell.GetValue3();

  }

  /**
   * returns value for address/range
   *
   * note we are "fixing" strings with leading apostrophes. that should
   * probably be done inside the cell, via a separate method.
   *
   * UPDATE: propagate cell errors
   */
//  protected CellFunction(c1: number, r1: number, c2?: number, r2?: number){
  protected CellFunction(start: ICellAddress, end?: ICellAddress){

    if (!start.sheet_id) {
      console.warn('missing sheet id, cellfunction');
      return () => ReferenceError;
    }

    const cells = this.cells_map[start.sheet_id];

    // if (typeof c2 === 'undefined' || typeof r2 === 'undefined') {
    if (!end) {
      const cell = cells.GetCell(start);

      if (!cell) {
        return undefined;
      }
      if (cell.calculated_type === ValueType.error) {
        return { error: cell.GetValue() };
      }
      if (cell.type === ValueType.undefined) {
        return 0;
      }

      return cell.GetValue();
    }
    else {
      return(cells.GetRange2(
        start, // {row: r1, column: c1},
        end, // {row: r2, column: c2},
        true,
      ));
    }

  }

  /** breaking this out to de-dupe */
  protected GetMetadata(arg: ExpressionUnit, map_result: (cell_data: Cell, address: ICellAddress) => any) {

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
        const result = this.CalculateExpression(arg, true);
        if (result && typeof result === 'object') {
          if (result.type === 'address') { 
            address = result;
          }
          else if (result.type === 'range') {
            range = result;
          }
          else {
            return result;
          }
        }
        else return result;
      }

    }

    if (address) {

      let sheet = this.data_model.active_sheet;
      if (address.sheet_id && address.sheet_id !== sheet.id) {
        for (const test of this.data_model.sheets) {
          if (test.id === address.sheet_id) {
            sheet = test;
            break;
          }
        }
      }

      const cell_data = sheet.CellData(address);
      const value = // (cell_data.type === ValueType.formula) ? cell_data.calculated : cell_data.value;
        cell_data.calculated_type ? cell_data.calculated : cell_data.value;

      return {
        address: {...address},
        value,
        format: cell_data.style ? cell_data.style.number_format : undefined,
        ...map_result(cell_data, address),
      };
    }
    else if (range) {

      if (range.start.row === Infinity || range.start.column === Infinity) {
        return ReferenceError; // temp
      }

      let sheet = this.data_model.active_sheet;
      if (range.start.sheet_id && range.start.sheet_id !== sheet.id) {
        for (const test of this.data_model.sheets) {
          if (test.id === range.start.sheet_id) {
            sheet = test;
            break;
          }
        }
      }

      const range_result = [];

      for (let column = range.start.column; column <= range.end.column; column++) {
        const column_result = [];
        for (let row = range.start.row; row <= range.end.row; row++) {
          const cell_data = sheet.CellData({row, column});
          address = {...range.start, row, column};

          const value = // (cell_data.type === ValueType.formula) ? cell_data.calculated : cell_data.value;
            cell_data.calculated_type ? cell_data.calculated : cell_data.value;

          column_result.push({
            address,
            value,
            format: cell_data.style ? cell_data.style.number_format : undefined,
            ...map_result(cell_data, address),
          });
        }
        range_result.push(column_result);
      }
      
      return range_result;

    }

  }

  protected EvaluateMacroFunction(macro_func: MacroFunction) {

    if (!macro_func.expression) { 
      return () => ExpressionError;
    }

    const expression = macro_func.expression;

    return (expr: UnitCall) => {

      // should we evaluate the arguments first, or just pass them in?
      // I think the logical thing to do is evaluate them first, otherwise
      // they might do the same work more than once.

      const bound_names: {[index: string]: ExpressionUnit} = {};

      if (macro_func.argument_names) {
        for (let i = 0; i < macro_func.argument_names.length; i++) {
          const name = macro_func.argument_names[i];

          // temp just pass in
          if (expr.args[i]) {
            bound_names[name.toUpperCase()] = expr.args[i];
          }

        }
      }
      
      this.context.name_stack.unshift(bound_names);
      const result = this.CalculateExpression(expression);
      this.context.name_stack.shift();

      return result;

    }

  }

  /** excutes a function call */
  protected CallExpression(outer: UnitCall, return_reference = false) {

    // get the function descriptor, which won't change.
    // we can bind in closure (also short-circuit check for 
    // invalid name)

    const func = this.library.Get(outer.name);

    if (!func) {
      const macro_func = this.data_model.macro_functions[outer.name.toUpperCase()];
      if (macro_func) {
        return this.EvaluateMacroFunction(macro_func);
      }
      else return () => NameError;
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

      let argument_error: FunctionError|undefined;
      const argument_descriptors = func.arguments || []; // map

      const mapped_args = expr.args.map((arg, arg_index) => {

        // short circuit
        if (argument_error) { return undefined; }

        if (typeof arg === 'undefined') { return undefined; } // FIXME: required?

        const descriptor = argument_descriptors[Math.min(arg_index, argument_descriptors.length - 1)] || {}; // recycle last one

        // FIXME (address): what about named ranges (actually those will work),
        // constructed references (we don't support them atm)?

        // NOTE: named ranges will _not_ work, because the address will be an
        // object, not a string. so FIXME.

        if (descriptor.address) {
          return this.parser.Render(arg).replace(/\$/g, '');
        }
        else if (descriptor.metadata) {
          return this.GetMetadata(arg, () => { return {}});
        }
        else {
          const result = this.CalculateExpression(arg);

          if (typeof result === 'object' && result.error && !descriptor.allow_error) {
            argument_error = result;
          }
          return result;
        }

        return undefined; // default

      });

      if (argument_error) {
        return argument_error;
      }

      /*
      if (func.custom_render) {
        this.AssignCustomRenderFunc(func);
      }
      */

      // if we have any nested calls, they may have updated the index so
      // we use the captured value here.

      this.context.call_index = call_index;

      // I thought we were passing the model as this (...) ? actually
      // now we bind functions that need this, so maybe we should pass
      // null here.

      // return func.fn.apply(null, mapped_args);
      
      if (func.return_type === ReturnType.reference) {
        const expr = func.fn.apply(null, mapped_args);
        if (return_reference) { return expr; }
        else if (typeof expr === 'object') {
          if (expr.type === 'address') {
            return this.CellFunction(expr);
          }
          else if (expr.type === 'range') {
            return this.CellFunction(expr.start, expr.end);
          }
        }
        return expr; // error?
      }
      return func.fn.apply(null, mapped_args);


    };

  }

  protected UnaryExpression(x: UnitUnary) { // operator: string, operand: any){

    // there are basically three code paths here: negate, identity, and error.
    // they have very different semantics so we're going to do them completely
    // separately.

    switch (x.operator) {
    case '+':
      return (expr: UnitUnary) => {
        return this.CalculateExpression(expr.operand);
      };

    case '-':
      return (expr: UnitUnary) => {
        const operand = this.CalculateExpression(expr.operand);
        if (Array.isArray(operand)){
          for (const column of operand){
            for (let r = 0; r < column.length; r++) column[r] = -column[r];
          }
          return operand;
        }
        return -operand;
      };

    default:
      return () => {
        console.warn('unexpected unary operator:', x.operator);
        return ExpressionError;
      };
    }

  }

  /**
   * FIXME: did we drop this from the parser? I think we may have.
   * use logical functions AND(), OR()
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected LogicalExpression(operator: string, left: any, right: any){

    // sloppy typing, to support operators? (...)

    left = this.CalculateExpression(left);
    right = this.CalculateExpression(right);

    switch (operator){
    case '||': return left || right;
    case '&&': return left && right;
    }

    console.info(`(unexpected logical operator: ${operator})`);
    return ExpressionError;

  }

  /**
   * expands the size of an array by recycling values in columns and rows
   *
   * @param arr 2d array
   * @param columns target columns
   * @param rows target rows
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected RecycleArray(arr: any[][], columns: number, rows: number){

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

  /**
   * applies binary operator elementwise over array
   *
   * @param operator
   * @param left guaranteed to be 2d array
   * @param right guaranteed to be 2d array
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected ElementwiseBinaryExpression(fn: Primitives.PrimitiveBinaryExpression, left: any[][], right: any[][]){

    const columns = Math.max(left.length, right.length);
    const rows = Math.max(left[0].length, right[0].length);

    left = this.RecycleArray(left, columns, rows);
    right = this.RecycleArray(right, columns, rows);

    const result = [];

    for (let c = 0; c < columns; c++) {
      const col = [];
      for (let r = 0; r < rows; r++ ) {
        // col[r] = this.ElementalBinaryExpression(operator, left[c][r], right[c][r]);
        col[r] = fn(left[c][r], right[c][r]);
      }
      result.push(col);
    }

    return result;
  }

  protected BinaryExpression(x: UnitBinary) {

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
        return ExpressionError;
      };
    }
    else {
      return (expr: UnitBinary) => {

        // sloppy typing, to support operators? (...)

        const left = this.CalculateExpression(expr.left);
        const right = this.CalculateExpression(expr.right);

        // check for arrays. do elementwise operations.

        if (Array.isArray(left)){
          if (Array.isArray(right)){
            return this.ElementwiseBinaryExpression(fn, left, right);
          }
          else {
            return this.ElementwiseBinaryExpression(fn, left, [[right]]);
          }
        }
        else if (Array.isArray(right)) {
          return this.ElementwiseBinaryExpression(fn, [[left]], right);
        }

        return fn(left, right);

      };
    }

  }

  protected Identifier(expr: UnitIdentifier){

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
    const upper_case = identifier.toUpperCase();

    switch (upper_case){
    case 'FALSE':
    case 'F':
      return () => false;

    case 'TRUE':
    case 'T':
      return () => true;

    case 'UNDEFINED':
      return () => undefined; // why do we support this?
    }

    return () => {

      const named_range = this.named_range_map[upper_case];

      if (named_range) {
        if (named_range.count === 1) {
          return this.CellFunction(named_range.start);
        }
        else {
          return this.CellFunction(named_range.start, named_range.end);
        }
      }

      const bound_names = this.context.name_stack[0];

      if (bound_names && bound_names[upper_case]) {
        const bound_expression = bound_names[upper_case];
        return this.CalculateExpression(bound_expression);
      }
  
      console.info( '** identifier', identifier);
      return NameError;

    };

  }

  protected GroupExpression(x: UnitGroup) {

    // a group is an expression in parentheses, either explicit
    // (from the user) or implicit (created to manage operation
    // priority, order of operations, or similar).

    // expressions nest, so there's no case where a group should
    // have length !== 1 -- consider that an error.

    if (!x.elements || x.elements.length !== 1){
      return () => {
        console.warn( `Can't handle group !== 1` );
        return 0;
      };
    }
    return (expr: UnitGroup) => this.CalculateExpression(expr.elements[0]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected CalculateExpression(expr: ExpressionUnit, return_reference = false): any {

    // user data is a generated function for the expression, at least
    // for the simple ones (atm). see BinaryExpression for more. the
    // aim is to remove as many tests and lookups as possible.

    // may be over-optimizing here.

    if (expr.user_data) {
      return expr.user_data(expr);
    }

    switch (expr.type){
    case 'call':
      return (expr.user_data = this.CallExpression(expr, return_reference))(expr);

    case 'address':
      return (expr.user_data = this.CellFunction2(expr))();

    case 'range':
      return (expr.user_data = (x: UnitRange) => this.CellFunction(x.start, x.end))(expr);

    case 'binary':
      return (expr.user_data = this.BinaryExpression(expr))(expr);

    case 'unary':
      return (expr.user_data = this.UnaryExpression(expr))(expr);

    case 'identifier':
      return (expr.user_data = this.Identifier(expr))();

    case 'missing':
      expr.user_data = () => undefined;
      return undefined;

    case 'literal':
      expr.user_data = () => expr.value;
      return expr.value;

    case 'group':
      return (expr.user_data = this.GroupExpression(expr))(expr);

    case 'array':
      {
        const transposed = Utilities.TransposeArray(expr.values);
        expr.user_data = () => transposed;
        return transposed;
      }

    default:
      console.warn( 'Unhandled parse expr:', expr);
      return 0;
    }
  }

}

