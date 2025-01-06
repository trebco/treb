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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

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




