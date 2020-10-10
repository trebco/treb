
import { FunctionMap } from '../descriptors';
import { NumberFormatCache } from 'treb-format';
import { Localization, UnionValue, ValueType } from 'treb-base-types';
import * as Utils from '../utilities';

export const TextFunctionLibrary: FunctionMap = {

  Char: {
    arguments: [{
      name: 'number',
    }],
    fn: (num: number): UnionValue => {
      return { type: ValueType.string, value: String.fromCodePoint(num||32) };
    },
    category: ['text'],
  },

  Code: {
    arguments: [{
      name: 'string',
    }],
    fn: (str: string): UnionValue => {
      return { type: ValueType.number, value: str.codePointAt(0) };
    },
    category: ['text'],
  },

  Text: {
    arguments: [
      { name: 'value' },
      { name: 'number format' },
    ],
    fn: (value: number, format = '0.00####'): UnionValue => {
      return { type: ValueType.string, value: NumberFormatCache.Get(format).Format(value || 0) };
    },
    category: ['text'],
  },

  Left: {
    arguments: [
      { name: 'string' },
      { name: 'count' },
    ],
    fn: (str: string, count = 1): UnionValue => {
      return { type: ValueType.string, value: str.substr(0, count) };
    },
    category: ['text'],
  },

  Right: {
    arguments: [
      { name: 'string' },
      { name: 'count' },
    ],
    fn: (str: string, count = 1): UnionValue => {
      return { type: ValueType.string, value: str.slice(-count) };
    },
    category: ['text'],
  },

  Mid: {
    arguments: [
      { name: 'string' },
      { name: 'left' },
      { name: 'count' },
    ],
    fn: (str: string, left = 0, count = 1): UnionValue => {
      return { type: ValueType.string, value: str.substr(Math.max(0, left - 1), count) };
    },
    category: ['text'],
  },

/*

  Concatenate: {
    description: 'Pastes strings together',
    fn: (...args: any[]) => {
      return args.map((arg) => {

        // this is used when concatenating cells that contain numbers
        // FIXME: get cell number format?

        const string_arg = (typeof arg === 'undefined') ? '' : arg.toString();

        if (typeof arg === 'number' && Localization.decimal_separator === ',') {
          return string_arg.replace(/\./, ',');
        }

        return string_arg;
      }).join('');
    },
  },

  */

 Concatenate: {
  description: 'Pastes strings together',
  fn: (...args: unknown[]): UnionValue => {

    const values = Utils.Flatten(args) as unknown[];
    const value = values.map((arg) => {

      // this is used when concatenating cells that contain numbers
      // FIXME: get cell number format? we'd need to use metadata

      const string_arg = (arg as any)?.toString() || '';

      if (typeof arg === 'number' && Localization.decimal_separator === ',') {
        return string_arg.replace(/\./, ',');
      }

      return string_arg;

    }).join('');

    return { type: ValueType.string, value };

  },
},

};

export const TextFunctionAliases: {[index: string]: string} = {
  Concat: 'Concatenate',
};

