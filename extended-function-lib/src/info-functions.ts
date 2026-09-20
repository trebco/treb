import { Box, Errors, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import type { FunctionMap } from 'treb-calculator';
import { NAError, ValueError } from 'treb-calculator';

export default {
  'ISEVEN': {
    description: 'Returns TRUE if a number is even',
    arguments: [
      { name: 'number', description: 'The value to test', unroll: true },
    ],
    fn: (num?: number): UnionValue => {
      if (num === undefined) return ValueError();
      return Box(Math.trunc(num) % 2 === 0);
    },
  },

  'ISODD': {
    description: 'Returns TRUE if a number is odd',
    arguments: [
      { name: 'number', description: 'The value to test', unroll: true },
    ],
    fn: (num?: number): UnionValue => {
      if (num === undefined) return ValueError();
      return Box(Math.trunc(num) % 2 !== 0);
    },
  },

  'ISNONTEXT': {
    description: 'Returns TRUE if a value is not text',
    arguments: [
      { name: 'value', description: 'The value to test', boxed: true },
    ],
    fn: (value?: UnionValue): UnionValue => {
      if (!value) return Box(true);
      return Box(value.type !== ValueType.string);
    },
  },

  'N': {
    description: 'Converts a value to a number',
    arguments: [
      { name: 'value', description: 'The value to convert', boxed: true },
    ],
    fn: (value?: UnionValue): UnionValue => {
      if (!value) return Box(0);
      switch (value.type) {
        case ValueType.number:
          return value;
        case ValueType.boolean:
          return Box(value.value ? 1 : 0);
        case ValueType.error:
          return value;
        default:
          return Box(0);
      }
    },
  },

  'TYPE': {
    description: 'Returns the type of a value',
    arguments: [
      { name: 'value', description: 'The value to test', boxed: true, allow_error: true },
    ],
    fn: (value?: UnionValue): UnionValue => {
      if (!value || value.type === ValueType.undefined) return Box(1);
      switch (value.type) {
        case ValueType.number: return Box(1);
        case ValueType.string: return Box(2);
        case ValueType.boolean: return Box(4);
        case ValueType.error: return Box(16);
        case ValueType.array: return Box(64);
        default: return Box(1);
      }
    },
  },

  'ERROR.TYPE': {
    description: 'Returns the number corresponding to an error type',
    arguments: [
      { name: 'error_val', description: 'The error value', boxed: true, allow_error: true },
    ],
    fn: (value?: UnionValue): UnionValue => {
      if (!value || value.type !== ValueType.error) {
        return NAError();
      }
      switch (value.value) {
        case Errors.Value: return Box(3);
        case Errors.Reference: return Box(4);
        case Errors.Name: return Box(5);
        case Errors.Div0: return Box(2);
        case Errors.NA: return Box(7);
        case Errors.Data: return Box(3);
        default: return NAError();
      }
    },
  },
} satisfies FunctionMap;
