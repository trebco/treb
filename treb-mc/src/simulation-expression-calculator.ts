
import { ExpressionCalculator } from '../../treb-calculator/src/expression-calculator';
import { SimulationModel, SimulationState } from './simulation-model';
import { FunctionLibrary } from '../../treb-calculator/src/function-library';
import { ICellAddress } from 'treb-base-types/src/area';
import { Parser, UnitCall } from 'treb-parser';
import { FunctionError, NameError, ReferenceError } from '../../treb-calculator/src/function-error';
import { MCCompositeFunctionDescriptor } from './descriptors';
import { ValueType, Cell } from 'treb-base-types/src';


export class MCExpressionCalculator extends ExpressionCalculator {

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

    const func = this.library.Get(outer.name) as MCCompositeFunctionDescriptor;

    if (!func) {
      return () => NameError;
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

      let argument_error: FunctionError|undefined;

      const mapped_args = (expr.args).map((arg, arg_index) => {

        // short circuit
        if (argument_error) { return undefined; }

        if (typeof arg === 'undefined') { return undefined; } // FIXME: required?

        const descriptor = argument_descriptors[Math.min(arg_index, argument_descriptors.length - 1)] || {}; // recycle last one

        // FIXME (address): what about named ranges (actually those will work),
        // constructed references (we don't support them atm)?

        // NOTE: named ranges will _not_ work, because the address will be an
        // object, not a string. so FIXME.

        // FIXME?: as currently implemented, OFFSET and INDIRECT will not work.
        // we may be able to fix that, but I'm not sure we should -- this is
        // an acceptable limitation, and the cost of doing that [correctly] 
        // would be high. also, it's possible to get the same result using 
        // the spreadsheet, instead of adding here, so let that be the resolution.

        if (descriptor.address) {
          return this.parser.Render(arg).replace(/\$/g, '');
        }
        else if (descriptor.metadata) {

          return this.GetMetadata(arg, (cell_data: Cell, address: ICellAddress) => { 
            const simulation_data =
              (this.simulation_model.state === SimulationState.Null) ?
              this.simulation_model.StoreCellResults(address) : [];
            return { simulation_data };
          });

          /*
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
            {
              const result = this.CalculateExpression(arg);
              if (typeof result === 'object' && result.error && !descriptor.allow_error) {
                argument_error = result;
              }
              return result;
            }
            break;

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
            const simulation_data =
              (this.simulation_model.state === SimulationState.Null) ?
              this.simulation_model.StoreCellResults(address) :
              [];

            return {
              address: {...address},
              value: cell_data.type === ValueType.formula ? cell_data.calculated : cell_data.value,
              format: cell_data.style ? cell_data.style.number_format : undefined,
              simulation_data,
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
                const simulation_data =
                  (this.simulation_model.state === SimulationState.Null) ?
                  this.simulation_model.StoreCellResults({...range.start, row, column}) :
                  [];

                column_result.push({
                  address: {...range.start, row, column},
                  value: cell_data.type === ValueType.formula ? cell_data.calculated : cell_data.value,
                  format: cell_data.style ? cell_data.style.number_format : undefined,
                  simulation_data,
                });
              }
              range_result.push(column_result);
            }

            return range_result;

          }
          */

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

      return func.fn.apply(null, mapped_args);

    };

  }

}
