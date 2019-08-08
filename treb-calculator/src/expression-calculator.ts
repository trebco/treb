
import { SimulationModel, SimulationState } from './simulation-model';
import { FunctionLibrary } from './function-library';
import { Cells, ICellAddress, ValueType, Area } from 'treb-base-types';
import { Parser, ExpressionUnit, UnitBinary, UnitIdentifier, UnitGroup, UnitUnary } from 'treb-parser';
import { DataModel } from 'treb-grid';
import { FunctionError, NameError, ReferenceError, ExpressionError } from './function-error';

// import { compose, pipe } from './compose';
import * as Primitives from './primitives';

export interface CalculationContext {
  address: ICellAddress;
}

export class ExpressionCalculator {

  public context: CalculationContext = {
    address: { row: -1, column: -1 },
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
  private call_index = 0;

  // local reference
  private cells: Cells = new Cells();

  // local reference
  private named_range_map: {[index: string]: Area} = {};

  //
  private data_model!: DataModel;

  // --- public API -----------------------------------------------------------

  constructor(
      protected readonly simulation_model: SimulationModel,
      protected readonly library: FunctionLibrary,
      protected readonly parser: Parser) {
  }

  public SetModel(model: DataModel) {
    this.cells = model.sheet.cells;
    this.data_model = model;
    this.named_range_map = model.sheet.named_ranges.Map();
  }

  /**
   * there's a case where we are calling this from within a function
   * (which is weird, but hey) and to do that we need to preserve flags.
   */
  public Calculate(expr: ExpressionUnit, addr: ICellAddress, preserve_flags = false){

    if (!preserve_flags) {

      this.context.address = addr;

      this.simulation_model.address = addr;
      this.simulation_model.volatile = false;

      // reset for this cell
      this.call_index = 0; // why not in model? A: timing (nested)
    }

    return {
      value: this.CalculateExpression(expr),
      volatile: this.simulation_model.volatile,
    };
  }

  // --- /public API ----------------------------------------------------------

  /**
   * we pass around errors as objects with an error (string) field.
   * this is a simplified check for that type.
   */
  protected IsError(value: any) {
    return (typeof value === 'object') && value.error;
  }

  /**
   * returns value for address/range
   *
   * note we are "fixing" strings with leading apostrophes. that should
   * probably be done inside the cell, via a separate method.
   *
   * UPDATE: propagate cell errors
   */
  protected CellFunction(c1: number, r1: number, c2?: number, r2?: number){
    if (typeof c2 === 'undefined' || typeof r2 === 'undefined') {
      const cell = this.cells.GetCell({row: r1, column: c1});
      if (!cell) return undefined;
      if (cell.calculated_type === ValueType.error) return { error: cell.GetValue() };
      return cell.GetValue();
    }
    else {
      return(this.cells.GetRange2(
        {row: r1, column: c1},
        {row: r2, column: c2},
        true,
      ));
    }
  }

  /** excutes a function call */
  protected CallExpression(expr: string, args: ExpressionUnit[] = []){

    // get an index we can use for this call (we may recurse when
    // calculating arguments), then increment for the next call.

    const call_index = this.call_index++;

    // get the function descriptor so we can figure out what to do with arguments

    const func = this.library.Get(expr);

    if (!func) {
      return NameError;
    }

    // yeah so this is clear. just checking volatile.

    this.simulation_model.volatile = this.simulation_model.volatile || (!!func.volatile) ||
      ((!!func.simulation_volatile) && this.simulation_model.state !== SimulationState.Null);

    // NOTE: the argument logic is (possibly) calculating unecessary operations,
    // if there's a conditional (like an IF function). although that is the
    // exception rather than the rule...

    let argument_error: FunctionError|undefined;

    const argument_descriptors = func.arguments || []; // map

    const mapped_args = args.map((arg, arg_index) => {

      // short circuit
      if (argument_error) { return undefined; }

      if (typeof arg === 'undefined') { return undefined; } // FIXME: required?

      const descriptor = argument_descriptors[arg_index] || {};

      // FIXME (address): what about named ranges (actually those will work),
      // constructed references (we don't support them atm)?

      // NOTE: named ranges will _not_ work, because the address will be an
      // object, not a string. so FIXME.

      if (descriptor.address) {
        return this.parser.Render(arg).replace(/\$/g, '');
      }
      else if (descriptor.metadata) {

        // FIXME: we used to restrict this to non-cell functions, now
        // we are using it for the cell function (we used to use address,
        // which just returns the label)

        let address: ICellAddress|undefined;

        switch (arg.type) {
        case 'address':
          address = arg;
          break;

        case 'range':
          address = arg.start;
          break;

        case 'identifier':
          const named_range = this.named_range_map[arg.name.toUpperCase()];
          if (named_range) {
            address = named_range.start; // FIXME: range?
          }
        }

        if (address) {

          const cell_data = this.data_model.sheet.CellData(address);
          const simulation_data =
            (this.simulation_model.state === SimulationState.Null) ?
            this.simulation_model.StoreCellResults(address) :
            [];

          return {
            address: {...address},
            value: cell_data.calculated,
            format: cell_data.style ? cell_data.style.number_format : undefined,
            simulation_data,
          };
        }

      }
      else if (descriptor.collector && this.simulation_model.state === SimulationState.Null) {

        /*
        // why holding this twice? (...) has to do with timing, apparently...

        // I don't think this can actually happen. we should verify that this
        // is necessary. look at it like this: the only thing that can cause
        // this value to increment is a nested call to CallExpression (this
        // method), which is only ever called by CalculateExpression.

        // We can see from the code that CalculateExpression is _not_ called
        // prior to this line. there's a small possibility that CalculateExpression
        // is called, via Calculate, from a method call, but that is also below
        // this line (at the end of the method).

        // NOTE: that is 100% wrong. this is a loop. you might call
        // CalculateExpression on loop 1 and then get here on loop 2. that's
        // exactly why we capture this field. it might be rare, but if it
        // happens it would be a mess. keep the captured value.
        // do not remove this.

        // actually you're both 100% wrong; because the CellData function doesn't
        // actually use call_index. not sure how this got misaligned. it's needed
        // for prep (correlation, lhs) and storing results during a simulation.
        // so it needs to go in front of the function call and the prep step.

        this.simulation_model.call_index = call_index;
        */

        if (arg.type === 'address'){
          return this.simulation_model.StoreCellResults(arg);
        }
        else if (arg.type === 'range') {
          return this.simulation_model.StoreCellResults(arg.start);
        }
        else if (arg.type === 'identifier') {
          const named_range = this.named_range_map[arg.name.toUpperCase()];
          if (named_range) {
            return this.simulation_model.StoreCellResults(named_range.start);
          }
        }

        // if we didn't have a valid reference it's an error
        argument_error = ReferenceError;

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

    if (this.simulation_model.state === SimulationState.Prep){

      // this is a separate loop because we only need to call it on prep
      // FIXME: can this move to parsing stage? (old note: probably this too,
      // with a flag)

      // we could split the simulation functions into regular and prep stage,
      // which would drop a test inside the function.

      // if you do that, though, make sure to set the captured call_index here
      // (currently that's set below for the function call).

      args.forEach((arg, arg_index) => {
        const descriptor = argument_descriptors[arg_index] || {};
        if (arg && descriptor.collector) {
          if (arg.type === 'address') {
            this.simulation_model.StoreCellResults(arg);
          }
          else if (arg.type === 'identifier') {
            const named_range = this.named_range_map[arg.name.toUpperCase()];
            if (named_range) {
              this.simulation_model.StoreCellResults(named_range.start);
            }
          }
        }
      });

    }

    // if we have any nested calls, they may have updated the index so
    // we use the captured value here.

    this.simulation_model.call_index = call_index;

    // I thought we were passing the model as this (...) ? actually
    // now we bind functions that need this, so maybe we should pass
    // null here.

    return func.fn.apply(null, mapped_args);

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
      const operator = x.operator;
      return () => {
        console.warn('unexpected unary operator:', operator);
        return ExpressionError;
      };
    }

  }

  /*

    operand = this.CalculateExpression(operand);

    if (Array.isArray(operand)){
      switch (operator){
      case '-':
        for (const column of operand){
          for (let r = 0; r < column.length; r++) column[r] = -column[r];
        }
        break;
      case '+':
        break;
      default:
        console.warn('unexpected unary operator:', operator);
        for (const column of operand){
          for (let r = 0; r < column.length; r++) {
            column[r] = ExpressionError;
          }
        }
      }
      return operand;
    }

    if (typeof operand === 'object' && operand.error) return {...operand}; // propagate

    switch (operator){
    case '-': return -operand;
    case '+': return operand;
    default:
      console.warn('unexpected unary operator:', operator);
    }

    return ExpressionError;
  }
  */

  /**
   * FIXME: did we drop this from the parser? I think we may have.
   * use logical functions AND(), OR()
   */
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
      return (expr: UnitBinary) => {
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
    // FIXME? (...)

    const upper_case = expr.name.toUpperCase();

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
          return this.CellFunction(
            named_range.start.column,
            named_range.start.row,
          );
        }
        else {
          return this.CellFunction(
            named_range.start.column,
            named_range.start.row,
            named_range.end.column,
            named_range.end.row,
          );
        }
      }

      console.info( '** identifier', name);
      return NameError;

    };

  }

  protected GroupExpression(x: UnitGroup) {
    if (!x.elements || x.elements.length !== 1){
      return () => {
        console.warn( `Can't handle group !== 1` );
        return 0;
      };
    }
    return (expr: UnitGroup) => this.CalculateExpression(expr.elements[0]);
  }

  protected CalculateExpression(expr: ExpressionUnit): any {

    // user data is a generated function for the expression, at least
    // for the simple ones (atm). see BinaryExpression for more. the
    // aim is to remove as many tests and lookups as possible.

    // may be over-optimizing here.

    if (expr.user_data) {
      return expr.user_data(expr);
    }

    switch (expr.type){
    case 'call':
      return this.CallExpression(expr.name, expr.args);

    case 'address':
      return this.CellFunction(expr.column, expr.row);

    case 'range':
      return this.CellFunction(
        expr.start.column, expr.start.row,
        expr.end.column, expr.end.row );

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

    default:
      console.warn( 'Unhandled parse expr:', expr);
      return 0;
    }
  }

}

