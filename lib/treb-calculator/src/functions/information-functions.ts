
import { FunctionMap } from '../descriptors';
import { IsComplex, UnionValue, ValueType } from 'treb-base-types';
import * as Utils from '../utilities';
import { ValueError } from '../function-error';

export const InformationFunctionLibrary: FunctionMap = {

  IsBlank: {
    description: 'Returns true if the reference is blank',
    arguments: [{
      name: 'Reference',
      metadata: true,
    }],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
      return { 
        type: ValueType.boolean, 
        value: !ref?.value || typeof ref.value.value === 'undefined',
      };
    }),
  },

  IsNumber: {
    description: 'Returns true if the reference is a number',
    arguments: [{
      name: 'Reference',
      metadata: true,
    }],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
      return { 
        type: ValueType.boolean, 
        value: ref?.value && typeof ref.value.value === 'number',
      };
    }),
  },

  IsLogical: {
    description: 'Returns true if the reference is a logical TRUE or FALSE',
    arguments: [{
      name: 'Reference',
      metadata: true,
    }],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
      return { 
        type: ValueType.boolean, 
        value: ref?.value && typeof ref.value.value === 'boolean',
      };
    }),
  },

  IsText: {
    description: 'Returns true if the reference is text',
    arguments: [{
      name: 'Reference',
      metadata: true,
    }],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
      return { 
        type: ValueType.boolean, 
        value: ref?.value && typeof ref.value.value === 'string'
      };
    }),
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
