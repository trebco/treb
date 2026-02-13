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
import { ValueType } from 'treb-base-types';
import { ArgumentError } from '../function-error';

export const RegexFunctionLibrary: FunctionMap = {

  RegexExtract: {
    description: 'Extract text using a regular expression',
    arguments: [
      {
        name: 'text',
        unroll: true,
      },
      {
        name: 'pattern',
        unroll: true,
      },
      {
        name: 'return mode',
        unroll: true,
        default: 0,
        
      },
      {
        name: 'case insensitive',
        unroll: true,
        default: false,

      }
    ],
    fn: (text = '', pattern = '', return_mode = 0, icase = false) => {

      const args: string[] = [];
      if (icase) {
        args.push('i');
      }
      if (return_mode === 1) {
        args.push('g');
      }

      let rex: RegExp|undefined;

      try {
        rex = new RegExp(pattern, args.length ? args.join('') : undefined);
      }
      catch {
        return ArgumentError();
      }

      switch (return_mode) {
        case 0:
          {
            const result = text.match(rex);
            return {
              type: ValueType.string,
              value: (result === null) ? '' : result[0] ?? '',
            }
          }

        case 1:
          {
            const result = Array.from(text.matchAll(rex));
            console.info({result});

            return {
              type: ValueType.array,
              value: [result.map(entry => ({
                type: ValueType.string,
                value: entry[0] || '',
              }))],
            }
          }
        case 2:
          {
            const result = text.match(rex);
            if (result === null) {
              return {
                type: ValueType.string,
                value: '',
              };
            }

            const arr = Array.from(result).slice(1);
            return {
              type: ValueType.array,
              value: [
                arr.map(value => ({
                  type: ValueType.string,
                  value,
                }))
              ],
            };
          }

        default:
          return ArgumentError();
      }

    },
  },

  RegexReplace: {
    arguments: [
      {
        name: 'text',
        unroll: true,
      },
      {
        name: 'pattern',
        unroll: true,
      },
      {
        name: 'replacement',
        unroll: true,
      },
      {
        name: 'occurrence',
        unroll: true,
        default: 0,
      },
      {
        name: 'case insensitive',
        unroll: true,
        default: false,
      }
    ],
    description: 'Replace text in a string using a regex',
    fn: (text: string, pattern: string, replacement: string, occurrence = 0, icase = false) => {

      const args: string[] = ['g'];
      if (icase) {
        args.push('i');
      }

      const rex = new RegExp(pattern, args.length ? args.join('') : undefined);
      
      if (occurrence === 0) {
        return {
          type: ValueType.string,
          value: (text as any).replaceAll(rex, replacement), // huh?
        };
      }

      if (occurrence < 0) {
        const count = Array.from(text.matchAll(rex)).length;
        occurrence += (count + 1);
      }

      const value = text.replace(rex, (match) => {
        if (--occurrence === 0) {
          return replacement;
        }
        return match;
      });

      return {
        type: ValueType.string,
        value,
      };

    },
  },

  RegexTest: {
    arguments: [
      {
        name: 'text',
        unroll: true,
      },
      {
        name: 'pattern',
        unroll: true,
      },
      {
        name: 'case insensitive',
        unroll: true,
        default: false,

      }
    ],
    description: 'Match text against a regular expression',
    fn: (text: string, pattern: string, icase = false) => {
      const rex = new RegExp(pattern, icase ? 'i' : undefined);
      return { 
        type: ValueType.boolean,
        value: rex.test(text),
      };
    },
  },

};
