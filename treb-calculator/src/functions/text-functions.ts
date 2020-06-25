
import { FunctionMap } from '../descriptors';
import { NumberFormatCache } from 'treb-format';
import { Localization } from 'treb-base-types';

export const TextFunctionLibrary: FunctionMap = {

  Char: {
    arguments: [{
      name: 'number',
    }],
    fn: (num: number) => {
      return String.fromCodePoint(num);
    },
    category: ['text'],
  },

  Code: {
    arguments: [{
      name: 'string',
    }],
    fn: (str: string) => {
      return str.codePointAt(0);
    },
    category: ['text'],
  },

  Text: {
    arguments: [
      { name: 'value' },
      { name: 'number format' },
    ],
    fn: (value: number, format?: string) => {
      if (!format || typeof format !== 'string') {
        format = '0.00####';
      }
      return NumberFormatCache.Get(format).Format(value || 0);
    },
    category: ['text'],
  },

  Left: {
    arguments: [
      { name: 'string' },
      { name: 'count' },
    ],
    fn: (str: string, count: number) => {
      return str.substr(0, count);
    },
    category: ['text'],
  },

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

};

