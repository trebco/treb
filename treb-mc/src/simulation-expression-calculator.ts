
// we're deep-linking because these types are not exported by the project

import { ExpressionCalculator, ExtendedExpressionUnit, UnionIsExpressionUnit } from '../../treb-calculator/src/expression-calculator';
import { ReturnType } from '../../treb-calculator/src/descriptors';
import { FunctionLibrary } from '../../treb-calculator/src/function-library';
import { NameError, ReferenceError } from '../../treb-calculator/src/function-error';

import { SimulationModel, SimulationState } from './simulation-model';
import { MCCompositeFunctionDescriptor } from './descriptors';

import { Cell, ICellAddress, UndefinedUnion, ValueType, UnionValue, UnionOrArray } from 'treb-base-types';
import { Parser, UnitCall } from 'treb-parser';


export class MCExpressionCalculator extends ExpressionCalculator {

  public readonly simulation_model = new SimulationModel();

  constructor(library: FunctionLibrary, parser: Parser) {
    super(library, parser);
    this.context = this.simulation_model;
  }

  /** excutes a function call */
  protected CallExpression(outer: UnitCall, return_reference = false): (expr: UnitCall) => UnionOrArray { // TEMP DISABLING

    // get the function descriptor, which won't change.
    // we can bind in closure (also short-circuit check for
    // invalid name)

    const func = this.library.Get(outer.name) as MCCompositeFunctionDescriptor;

    if (!func) {
      return (expr: UnitCall) => NameError();
    }

    // I wonder if we can handle prep separately, outside of
    // the closure. on the assumption that prep is always the
    // first call, perhaps we can check state first; do prep;
    // and then return the closure without prep calls.

    // also move this out?

    const argument_descriptors = func.arguments || []; // map

    if (this.simulation_model.state === SimulationState.Prep){

      // this is a separate loop because we only need to call it on prep
      // FIXME: can this move to parsing stage? (old note: probably this too,
      // with a flag)

      // we could split the simulation functions into regular and prep stage,
      // which would drop a test inside the function.

      // if you do that, though, make sure to set the captured call_index here
      // (currently that's set below for the function call).

      // NOTE: call_index is not relevant to StoreCellResults

      // FIXME: this uses sheet IDs, correct? [yes]

      outer.args.forEach((arg, arg_index) => {
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
          else if (arg.type === 'call') {

            // support for "offset", essentially (see also below)

            const result = this.CalculateExpression(arg as ExtendedExpressionUnit, true);
            if (result && UnionIsExpressionUnit(result)) {
              if (result.value.type === 'address') {
                this.simulation_model.StoreCellResults(result.value);
              }
              else if (result.value.type === 'range') {
                this.simulation_model.StoreCellResults(result.value.start);
              }
            }
          }
          else {
            // console.info('mark x...', arg.type)
          }

        }
      });

    }

    //

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

      // NOTE: this version omits the if shortcut -- need to allow errors in that function
      
      let argument_error: UnionValue|undefined;

      const mapped_args = (expr.args).map((arg, arg_index) => {

        // short circuit
        if (argument_error) { return undefined; }

        // get descriptor. if the number of arguments exceeds 
        // the number of descriptors, recycle the last one
        const descriptor = argument_descriptors[Math.min(arg_index, argument_descriptors.length - 1)] || {}; 

        // // if function, wrong branch
        // if (arg_index === skip_argument_index) { 
        //  return undefined; 
        // }

        if (typeof arg === 'undefined') { 
          // if (if_function && arg_index === 0) { skip_argument_index = 1; }
          return descriptor.boxed ? UndefinedUnion() : undefined;
        }
        
        // FIXME (address): what about named ranges (actually those will work),
        // constructed references (we don't support them atm)?

        // NOTE: named ranges will _not_ work, because the address will be an
        // object, not a string. so FIXME.

        // FIXME?: as currently implemented, OFFSET and INDIRECT will not work.
        // we may be able to fix that, but I'm not sure we should -- this is
        // an acceptable limitation, and the cost of doing that [correctly] 
        // would be high. also, it's possible to get the same result using 
        // the spreadsheet, instead of adding here, so let that be the resolution.

        // we can do that, now, using metadata. we should do that. it will require
        // a little snipping here and there... use metadata, then format from address.
        // is this adding overhead, with the lookup? maybe we should check type...

        if (descriptor.address) {
          return descriptor.boxed ? {
            type: ValueType.string,
            value: this.parser.Render(arg).replace(/\$/g, ''),
          } : this.parser.Render(arg).replace(/\$/g, '');
        }
        else if (descriptor.metadata) {

          return this.GetMetadata(arg, (cell_data: Cell, address: ICellAddress) => { 
            const simulation_data =
              (this.simulation_model.state === SimulationState.Null) ?
              this.simulation_model.StoreCellResults(address) : [];
            return { simulation_data };
          });

        }
        else if (descriptor.collector && this.simulation_model.state === SimulationState.Null) {

          // this branch is _getting_ simulation data, even though it uses
          // the same function that marks cells for storage. we could perhaps
          // use a separate function that doesn't allocate.

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
          else if (arg.type === 'call') {

            // support for "offset", essentially (see also above)

            const result = this.CalculateExpression(arg as ExtendedExpressionUnit, true);

            if (result && UnionIsExpressionUnit(result)) {
              if (result.value.type === 'address') {
                return this.simulation_model.StoreCellResults(result.value);
              }
              else if (result.value.type === 'range') {
                return this.simulation_model.StoreCellResults(result.value.start);
              }
            }
          }

          // if we didn't have a valid reference it's an error
          argument_error = ReferenceError();
          return argument_error;

        }
        else {

          const result = this.CalculateExpression(arg as ExtendedExpressionUnit);

          if (!Array.isArray(result) && result.type === ValueType.error) {
            if (descriptor.allow_error) {
              return result; // always boxed
            }
            argument_error = result;
            return undefined; // argument not used, so don't bother boxing
          }          
          
          if (descriptor.boxed) {
            return result;
          }
          
          if (Array.isArray(result)) {
            return result.map(row => row.map(value => value.value));
          }
          else {
            return result.value; // unboxing
          }

        }

        throw new Error('never');
        return undefined; // default

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

}
