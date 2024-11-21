
import type { FunctionMap } from '../descriptors';
import type { CellValue, NumberUnion, UnionValue} from 'treb-base-types';
import { IsComplex, ValueType } from 'treb-base-types';
import { ValueError } from '../function-error';
import { RectangularToPolar } from '../complex-math';
import type { ExpressionUnit } from 'treb-parser';

export const LambdaFunctionLibrary: FunctionMap = {

  Let: {

    // this function has weird semantics we don't normally see -- 
    // the first two arguments repeat, and the last one is constant.
    // our tooltips aren't prepared for this.

    // also it creates temporary names, we'll need to create some sort
    // of temporary binding context. complicated!

    description: 'Binds values to names for a calculation',
    arguments: [
      { name: 'Name', repeat: true },
      { name: 'Value', repeat: true },
      { name: 'Calculation', boxed: true },
    ],

    create_binding_context: ({args, descriptors}) => {
      
      if (args.length % 2 !== 1) {
        return undefined; // error
      }
      
      const context: Record<string, ExpressionUnit> = {};

      for (let i = 0; i < args.length - 1; i += 2) {
        const name = args[i];
        const value = args[i+1];

        if (name.type === 'identifier') {
          context[name.name] = value;
        }
        else {
          return undefined; // error
        }

      }
      
      return {
        context,
        args: args.slice(-1),
        argument_descriptors: descriptors.slice(-1),
      }
    },

    fn: (arg?: UnionValue) => {
      return arg ? arg : { type: ValueType.undefined };
    },

  },

};




