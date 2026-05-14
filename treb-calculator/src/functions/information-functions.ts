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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import type { FunctionMap } from '../descriptors';
import { Box, IsCellAddress, type UnionValue, ValueType } from 'treb-base-types';
import { UnionIsMetadata } from '../expression-calculator';

const match_arguments = [{
  name: 'Reference',
  boxed: true,
  unroll: true,
}];

export const InformationFunctionLibrary: FunctionMap = {

  /** this one does not unroll, it tells you if you referenced a range */
  IsRef: {
    description: 'Returns true if the reference is a reference',
    arguments: [{
      name: 'Reference',
      metadata: true,
    }],
    fn: (reference: UnionValue) => {
      if (reference.type === ValueType.array) {

        // logically, if the first cell in the array is a reference,
        // then it's a reference. there has to be one, though.

        if (reference.value.length && reference.value[0]?.length) {
          const check = reference.value[0][0];
          if (UnionIsMetadata(check) && check.type === ValueType.object) {
            return {
              type: ValueType.boolean, 
              value: IsCellAddress(check.value.address),
            };
          }
        }

      }
      if (UnionIsMetadata(reference)) {
        if (reference.type === ValueType.object) {
          return {
            type: ValueType.boolean, 
            value: IsCellAddress(reference.value.address),
          };
        }
      }
      return Box(false);
    }
  },

  IsBlank: {
    description: 'Returns true if the reference is blank',
    arguments:  [{
      name: 'Reference',
      boxed: true,
      unroll: true,
      metadata: true,
    }],
    fn: (value: UnionValue) => {
      let result = false;
      if (UnionIsMetadata(value) && value.type === ValueType.object) {
        result = value.value.value === undefined;
      }
      return { 
        type: ValueType.boolean, 
        value: result,
      };
    },
  },

  IsNumber: {
    description: 'Returns true if the reference is a number',
    arguments: match_arguments,
    fn: (value: UnionValue) => ({ type: ValueType.boolean, value: value.type === ValueType.number }),
  },

  IsLogical: {
    description: 'Returns true if the reference is a logical TRUE or FALSE',
    arguments: match_arguments,
    fn: (value: UnionValue) => ({ type: ValueType.boolean, value: value.type === ValueType.boolean }),
  },

  IsText: {
    description: 'Returns true if the reference is text',
    arguments: match_arguments,
    fn: (value: UnionValue) => ({ type: ValueType.boolean, value: value.type === ValueType.string }),
  },

  /* needs more data
  ISFORMULA: {
    description: 'Returns true if the reference is a formula',
    arguments: [{
      name: 'Reference',
      metadata: true,
    }],
    fn: (ref: UnionValue): UnionValue => {
      console.info("RR", ref);
      return { 
        type: ValueType.boolean, 
        value: ref?.value && typeof ref.value.value === 'string' && ref.value.value[0] === '=',
      };
    },
  },
  */

};

