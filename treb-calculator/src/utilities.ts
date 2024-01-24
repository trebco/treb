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

import type { ArrayUnion, UnionValue} from 'treb-base-types';
import { ValueType } from 'treb-base-types';

export const DAY_MS = 1000 * 60 * 60 * 24;

export const IsArrayOrTypedArray = (test: any): boolean => {
  return Array.isArray(test) || (test instanceof Float64Array) || (test instanceof Float64Array);
};

export const Transpose2 = <T> (arr: T[][]): T[][] => {

  const result: T[][] = [];

  const cols = arr.length;
  const rows = arr[0].length;
  for (let r = 0; r < rows; r++) {
    result[r] = [];
    for (let c = 0; c < cols; c++ ) {
      result[r][c] = arr[c][r];
    }
  }

  return result;

};

export const TransposeArray = (arr: any[][]) => {

  if (!arr) return [];
  if (typeof arr[0] === 'undefined') return [];

  if (!IsArrayOrTypedArray(arr[0])) {
    if (arr instanceof Float32Array || arr instanceof Float64Array){
      return Array.prototype.slice.call(arr).map((x: any) => [x]);
    }
    return arr.map((x) => [x]);
  }

  const tmp: any = [];
  const cols = arr.length;
  const rows = arr[0].length;
  for (let r = 0; r < rows; r++) {
    tmp[r] = [];
    for (let c = 0; c < cols; c++ ) {
      tmp[r][c] = arr[c][r];
    }
  }
  return tmp;

};

export const StringToColumn = (s: string) => {
  let index = 0;
  s = s.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    index *= 26;
    index += (s.charCodeAt(i) - 64);
  }
  return index - 1;
};

export const ColumnToString = (column: number) => {

  // there's some weird case where this hangs, not sure
  // how that happens. trap it and figure it out.

  const original = column;

  let s = '';
  for (;;) {
    const c = column % 26;
    s = String.fromCharCode(65 + c) + s;
    column = Math.floor(column / 26);
    if (column) column--;
    if (column < 0) throw(new Error('Column < 0!, original was ' + original));
    else break;
  }
  return s;
};

export const OffsetFormula = (formula: string, offset: {columns: number, rows: number}) => {

  const cache: any = {};
  formula = formula.replace(/\b([A-Za-z]+)(\d+)\b/g, (m, p1, p2) => {
    if (!cache[m]) {
      const c = ColumnToString(StringToColumn(p1) + offset.columns);
      const r = Number(p2) + offset.rows;
      cache[m] = c + r.toString();
    }
    return cache[m];
  });
  return formula;

};

/**
 * assuming boxed (union) arguments, return a flat list of values.
 * @param args 
 */
export const FlattenBoxed = (args: UnionValue[]): UnionValue[] => {

  // let's go back to imperative style for now

  let result: UnionValue[] = [];
  for (const arg of args) {
    if (arg.type === ValueType.array) {

      // possibly recursive
      for (const row of arg.value) {

        // what's faster, concatenate or ...push?
        
        // result.push(...FlattenBoxed(row));
        result = result.concat(FlattenBoxed(row));
      }

    }
    else {
      result.push(arg);
    }
  }

  return result;

};

/**
 * flatten a set of arguments
 * UPDATE: we no longer accept the "arguments" object. must be an array.
 * callers can use rest spread to collect arguments.
 */
export const FlattenUnboxed = (args: any[]): any[] => {
  if (!Array.isArray(args)) { return [args]; } // special case
  return args.reduce((a: any[], b: any) => {
    if (typeof b === 'undefined') return a;
    if (Array.isArray(b)) return a.concat(FlattenUnboxed(b));
    if (b instanceof Float32Array) return a.concat(Array.from(b));
    if (b instanceof Float64Array) return a.concat(Array.from(b));
    return a.concat([b]);
  }, []);
};

export const UndefinedToEmptyString = (args: any[]): any[] => {
  for (let i = 0; i < args.length; i++) {
    if (Array.isArray(args[i])) {
      args[i] = UndefinedToEmptyString(args[i]);
    }
    else if (typeof args[i] === 'undefined') {
      args[i] = '';
    }
  }
  return args;
};

/**
 * returns a function that applies the given function to a scalar or a matrix
 * @param base the underlying function
 */
export const ApplyArrayFunc = (base: (...args: any[]) => any) => {
  return (a: any) => {
    if (Array.isArray(a)) {
      const tmp: any[] = [];
      const rows = a[0].length;
      for (let c = 0; c < a.length; c++) {
        const col: any[] = [];
        for (let r = 0; r < rows; r++) col[r] = base(a[c][r]);
        tmp.push(col);
      }
      return tmp;
    }
    return base(a);
  };
};

export const ApplyAsArray = (base: (a: any, ...rest: any[]) => UnionValue) => {
  return (a: any, ...rest: any[]): UnionValue => {
    if (Array.isArray(a)) {

      return {
        type: ValueType.array,
        value: a.map(row => row.map((element: any) => {
          return base(element, ...rest);
        })),
      };

      /*
      return a.map(row => row.map((element: any) => {
        return base(element, ...rest);
      }));
      */
    }
    else if (typeof a === 'object' && !!a && a.type === ValueType.array ) {
      return {
        type: ValueType.array,
        value: (a as ArrayUnion).value.map(row => row.map((element: any) => {
          return base(element, ...rest);
        })),
      };
      
    }
    else {
      return base(a, ...rest);
    }
  }
};

export const ApplyAsArray2 = (base: (a: any, b: any, ...rest: any[]) => UnionValue) => {
  return (a: any, b: any, ...rest: any[]): UnionValue => {

    // do we need to worry about unboxed values? probably
    // what about combinations of boxed/unboxed (implying there are 4)

    // we could simplify this by pulling out the lists...

    let a_array = false;
    let b_array = false;

    if (!!a && typeof a === 'object' && a.type === ValueType.array) {
      a = (a as ArrayUnion).value;
      a_array = true; // don't test again
    }
    else {
      a_array = Array.isArray(a);
    }

    if (!!b && typeof b === 'object' && b.type === ValueType.array) {
      b = (b as ArrayUnion).value;
      b_array = true; // don't test again
    }
    else {
      b_array = Array.isArray(b);
    }

    if (a_array){
      if (b_array) {
        // a and b are arrays
        return {
          type: ValueType.array,
          value: a.map((row: any[], i: number) => row.map((element: any, j: number) => {
            return base(element, b[i][j], ...rest);
          })),
        };
      }
      // a is array, b is scalar
      return {
        type: ValueType.array,
        value: a.map((row: any[]) => row.map((element: any) => {
          return base(element, b, ...rest);
        })),
      };
    }
    else if (b_array) {
      // a is scalar, b is array
      return {
        type: ValueType.array,
        value: b.map((row: any[]) => row.map((element: any) => {
          return base(a, element, ...rest);
        })),
      };
    }

    /*
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        return a.map((row, i: number) => row.map((element: any, j: number) => {
          return base(element, b[i][j], ...rest);
        }));
      }
      else {
        return a.map(row => row.map((element: any) => {
          return base(element, b, ...rest);
        }));
      }
    }
    else {
      return base(a, b, ...rest);
    }
    */
    return base(a, b, ...rest);

  }
};


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
export const ParseWildcards = (text: string): string => {

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