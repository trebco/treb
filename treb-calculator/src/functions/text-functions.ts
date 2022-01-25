
import { FunctionMap } from '../descriptors';
import { NumberFormatCache } from 'treb-format';
import { Localization, UnionValue, ValueType } from 'treb-base-types';
import * as Utils from '../utilities';
import { ValueError } from '../function-error';

/**
 * parse a string with wildcards into a regex pattern
 * 
 * from
 * https://exceljet.net/glossary/wildcard
 * 
 * Excel has 3 wildcards you can use in your formulas:
 *
 * Asterisk (*) - zero or more characters
 * Question mark (?) - any one character
 * Tilde (~) - escape for literal character (~*) a literal question mark (~?), or a literal tilde (~~)
 * 
 * they're pretty liberal with escaping, nothing is an error, just roll with it
 * 
 */
const ParseWildcards = (text: string): string => {

  const result: string[] = [];
  const length = text.length;

  const escaped_chars = '[\\^$.|?*+()';

  for (let i = 0; i < length; i++) {
    let char = text[i];
    switch (char) {

      case '*':
        result.push('.', '*');
        break;

      case '?':
        result.push('.');
        break;

      case '~':
        char = text[++i] || '';
      
      // eslint-disable-next-line no-fallthrough
      default:
        for (let j = 0; j < escaped_chars.length; j++) {
          if (char === escaped_chars[j]) {
            result.push('\\');
            break;
          }
        }
        result.push(char);
        break;

    }
  }

  return result.join('');

};

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
      return { type: ValueType.number, value: str.codePointAt(0) || 0 }; // FIXME: default?
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

  /**
   * shame we can't write a proper search function, but we need to be 
   * consistent. some notes:
   * 
   * FIND is case-sensitive and does not support wildcards
   * SEARCH is icase and supports wildcards
   * 
   * re: wildcards, from
   * https://exceljet.net/glossary/wildcard
   * 
   * Excel has 3 wildcards you can use in your formulas:
   *
   * Asterisk (*) - zero or more characters
   * Question mark (?) - any one character
   * Tilde (~) - escape for literal character (~*) a literal question mark (~?), or a literal tilde (~~)
   * 
   * start index is 1-based, and defaults to 1; < 1 is an error. if the string
   * is not found, that's an error. if needle is empty, return start.
   * 
   */
  Search: {
    description: 'Find a string (needle) in another string (haystack). Case-insensitive.',
    arguments: [
      { name: 'Needle', },
      { name: 'Haystack', },
      { name: 'Start', default: 1, },
    ],
    fn: (needle: string, haystack: string, start = 1): UnionValue => {
      if (start >= 1) {
        if (!needle) {
          return {
            type: ValueType.number, value: start,
          }
        }

        // translate into regex. do we need an actual parser for this, or 
        // can we get by with regexes? should we have some sort of cache
        // for common patterns?

        const pattern = ParseWildcards(needle);
        // console.info('n', needle, 'p', pattern);
        const match = new RegExp(pattern, 'i').exec(haystack.substr(start - 1));

        if (match) {
          return {
            type: ValueType.number, value: match.index + start,
          }
        }

      }
      return ValueError();
    },
  },

  Find: {
    description: 'Find a string (needle) in another string (haystack). Case-sensitive.',
    arguments: [
      { name: 'Needle', },
      { name: 'Haystack', },
      { name: 'Start', default: 1, },
    ],
    fn: (needle: string, haystack: string, start = 1): UnionValue => {
      if (start >= 1) {
        if (!needle) {
          return {
            type: ValueType.number, value: start,
          }
        }
        const match = new RegExp(needle).exec(haystack.substr(start - 1));
        if (match) {
          return {
            type: ValueType.number, value: match.index + start,
          }
        }
      }
      return ValueError();
    },
  },

  /** canonical should be CONCAT; concatenate can be an alias */
 Concat: {
  description: 'Pastes strings together',
  fn: (...args: unknown[]): UnionValue => {

    const values = Utils.FlattenUnboxed(args) as unknown[];
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

export const TextFunctionAliases: Record<string, string> = {
  Concatenate: 'Concat',
};

