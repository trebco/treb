
import type { FunctionMap } from '../descriptors';
import type { UnionValue} from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import type { ExpressionUnit } from 'treb-parser';

export const LambdaFunctionLibrary: FunctionMap = {

  Lambda: {

    // FIXME: we could use the create_binding_context callback
    // here to validate the original parameters, might be useful

    description: 'Creates a function',
    arguments: [
      { name: 'Argument', repeat: true, boxed: true, passthrough: true },
      { name: 'Function', boxed: true, passthrough: true },
    ],

    fn: (...args: ExpressionUnit[]) => {
      return {
        type: ValueType.function, 

        // FIXME: lock down this type

        value: {

          // we should probably clone these

          bindings: args.slice(0, args.length - 1),
          func: args[args.length - 1],

          alt: 'LAMBDA',    // metadata
          type: 'function', // metadata
        },
      };

    }

  },

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




