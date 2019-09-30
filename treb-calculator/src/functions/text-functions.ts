
import { FunctionMap } from '../descriptors';
import { NumberFormatCache } from 'treb-format';

export const TextFunctionLibrary: FunctionMap = {

  Char: {
    arguments: [{
      description: 'number',
    }],
    fn: (num: number) => {
      return String.fromCodePoint(num);
    },
    category: ['text'],
  },

  Code: {
    arguments: [{
      description: 'string',
    }],
    fn: (str: string) => {
      return str.codePointAt(0);
    },
    category: ['text'],
  },

  Text: {
    arguments: [
      { description: 'value' },
      { description: 'number format' },
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
      { description: 'string' },
      { description: 'count' },
    ],
    fn: (str: string, count: number) => {
      return str.substr(0, count);
    },
    category: ['text'],
  },

};

