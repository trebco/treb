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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import type { FunctionMap, IntrinsicValue } from '../descriptors';
import { NumberFormatCache, ValueParser } from 'treb-format';
import type { UnionValue} from 'treb-base-types';
import { Localization, ValueType } from 'treb-base-types';
import * as Utils from '../utilities';
import { ArgumentError, ValueError } from '../function-error';


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

  Value: {
    arguments: [
      { name: 'text' },
    ],
    fn: (text: string): UnionValue => {
      const value = ValueParser.TryParse(text);
      if (value.type === ValueType.number) {
        return { type: ValueType.number, value: value.value as number };
      }
      return ArgumentError();

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

  WildcardMatch: {
    visibility: 'internal',
    arguments: [
      { name: 'text', unroll: true },
      { name: 'text', unroll: true },

      // the invert parameter is optional, defaults to false. we add this
      // so we can invert wirhout requiring an extra function call.

      { name: 'invert' }, 
    ],
    fn: (a: IntrinsicValue, b: IntrinsicValue, invert = false) => {

      if (typeof a === 'string' && typeof b === 'string') {
        const pattern = Utils.ParseWildcards(b);
        const match = new RegExp('^' + pattern + '$', 'i').exec(a);

        return {
          type: ValueType.boolean,
          value: invert ? !match : !!match,
        };
      }

      return {
        type: ValueType.boolean,
        value: (a === b || a?.toString() === b?.toString()),
      }
    },
    
  },

  Exact: {
    arguments: [
      { name: 'text', boxed: true, unroll: true },
      { name: 'text', boxed: true, unroll: true },
    ],
    category: ['text'],
    fn: (a: UnionValue, b: UnionValue): UnionValue => {
      return {
        type: ValueType.boolean,
        value: (a?.value?.toString()) === (b?.value?.toString()),
      };
    },
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

        const pattern = Utils.ParseWildcards(needle);
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
  fn: (...args: IntrinsicValue[]): UnionValue => {

    const values = Utils.FlattenUnboxed(args) as unknown[];
    const value = values.map((arg) => {

      // this is used when concatenating cells that contain numbers
      // FIXME: get cell number format? we'd need to use metadata

      const string_arg = arg?.toString() || '';

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

