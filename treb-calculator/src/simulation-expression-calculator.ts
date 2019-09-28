
import { ExpressionCalculator } from './expression-calculator';
import { SimulationModel, SimulationState } from './simulation-model';
import { FunctionLibrary } from './function-library';
import { Cells, ICellAddress, ValueType, Area } from 'treb-base-types';
import { Parser, ExpressionUnit, UnitBinary, UnitIdentifier,
         UnitGroup, UnitUnary, UnitAddress, UnitRange, UnitCall } from 'treb-parser';
import { DataModel } from 'treb-grid';
import { FunctionError, NameError, ReferenceError, ExpressionError } from './function-error';


export class SimulationExpressionCalculator extends ExpressionCalculator {

  public readonly simulation_model = new SimulationModel();

  constructor(library: FunctionLibrary, parser: Parser) {
    super(library, parser);
    this.context = this.simulation_model;
  }

  /** excutes a function call */
  protected CallExpression(outer: UnitCall) {

    // get the function descriptor, which won't change.
    // we can bind in closure (also short-circuit check for 
    // invalid name)

    const func = this.library.Get(outer.name);

    if (!func) {
      return (expr: UnitCall) => NameError;
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

      this.simulation_model.volatile = this.simulation_model.volatile || (!!func.volatile) ||
        ((!!func.simulation_volatile) && this.simulation_model.state !== SimulationState.Null);

      // NOTE: the argument logic is (possibly) calculating unecessary operations,
      // if there's a conditional (like an IF function). although that is the
      // exception rather than the rule...

      let argument_error: FunctionError|undefined;
      const argument_descriptors = func.arguments || []; // map

      const mapped_args = expr.args.map((arg, arg_index) => {

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

        expr.args.forEach((arg, arg_index) => {
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

      this.context.call_index = call_index;

      // I thought we were passing the model as this (...) ? actually
      // now we bind functions that need this, so maybe we should pass
      // null here.

      return func.fn.apply(null, mapped_args);

    };

  }

}
