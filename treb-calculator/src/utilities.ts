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

import type { ArrayUnion, CellValue, UnionValue} from 'treb-base-types';
import { ValueType } from 'treb-base-types';

export const DAY_MS = 1000 * 60 * 60 * 24;

export const IsArrayOrTypedArray = (test: unknown): boolean => {
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

export const TransposeArray = <T>(arr: T[][]): T[][] => {

  if (!arr) return [];
  if (typeof arr[0] === 'undefined') return [];

  /*
  if (!IsArrayOrTypedArray(arr[0])) {
    if (arr instanceof Float32Array || arr instanceof Float64Array){
      return Array.prototype.slice.call(arr).map((x: T) => [x]);
    }
    return arr.map((x) => [x]);
  }
  */

  const tmp: T[][] = [];
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

  const cache: Record<string, string> = {};
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
    if (arg?.type === ValueType.array) {

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

/* *
 * flatten a set of arguments
 * UPDATE: we no longer accept the "arguments" object. must be an array.
 * callers can use rest spread to collect arguments.
 * 
 * @deprecated - use a better-typed version
 * /
export const FlattenCellValues = (args: any[]): any[] => {
  if (!Array.isArray(args)) { return [args]; } // special case
  return args.reduce((a: any[], b: any) => {
    if (typeof b === 'undefined') return a;
    if (Array.isArray(b)) return a.concat(FlattenCellValues(b));
    if (b instanceof Float32Array) return a.concat(Array.from(b));
    if (b instanceof Float64Array) return a.concat(Array.from(b));
    return a.concat([b]);
  }, []);
};
*/

/**
 * specialization using the CellValue type. this should be preferable
 * to using any, although we're still kind of hacking at it. also we
 * need to allow typed arrays (I think we've mostly gotten those out?)
 */
export const FlattenCellValues = (args: (CellValue|CellValue[]|CellValue[][]|Float32Array|Float64Array)[], keep_undefined = false): CellValue[] => {

  if (!Array.isArray(args)) { return [args]; } // special case
  return args.reduce((a: CellValue[], b) => {
    if (typeof b === 'undefined' && !keep_undefined) return a;
    if (Array.isArray(b)) return a.concat(FlattenCellValues(b, keep_undefined));
    if (b instanceof Float32Array) return a.concat(Array.from(b));
    if (b instanceof Float64Array) return a.concat(Array.from(b));
    return a.concat([b]);
  }, []);

};

/**
 * flatten cell values, and filter out any non-numbers. this version does
 * not account for booleans (you might want TRUE = 1). we do this a lot so
 * combining the two operations seems like a useful place to reuse code.
 */
export const FlattenNumbers = (args: Parameters<typeof FlattenCellValues>[0]) => 
  (FlattenCellValues(args)).filter((value): value is number => typeof value === 'number');

export const FilterIntrinsics = (data: unknown[], fill = false): (string|number|boolean|undefined)[] => {

  if (fill) {
    return data.map((value => {
      switch (typeof value) {
        case 'number':
        case 'undefined':
        case 'string':
        case 'boolean':
          return value;
      }
      return undefined;
    }));
  }

  return data.filter((value): value is number|boolean|undefined|string => {
    switch (typeof value) {
      case 'number':
      case 'undefined':
      case 'string':
      case 'boolean':
        return true;
    }
    return false;
  });
};

/*

// anyone using this? (...) removing

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
*/

/** type guard. FIXME: move */
const IsArrayUnion = (value: unknown): value is ArrayUnion => {
  return (!!value && typeof value === 'object' && (value as { type: ValueType, value?: Array<unknown> }).type === ValueType.array);
};

/**
 * this is an attempt at a generalized array application wrapper 
 * for functions. the rules are the same -- we apply functions pairwise
 * (or tuple-wise), not combinatorially.
 * 
 * we could simplify a bit if we require that functions used boxed
 * values. we should do that anyway, and be consistent across functions.
 * also we could get the `any`s out.
 * 
 * (swapping param order, so we don't have hanging param after inline 
 * function definition -- shades of window.setTimeout)
 * 
 * @param map - a list of parameters, by index, that can be unrolled. this
 * allows us to support both out-of-order application and functions that take
 * mixes of scalars and arrays.
 * 
 * @param base - the underlying function. for any parameters that can
 * be applied/unrolled, it should take a scalar. 
 * 
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ApplyArrayX = <TFunc extends (...args: any[]) => UnionValue>(map: boolean[], base: TFunc): (...args: Parameters<TFunc>) => UnionValue => {

  return (...args: Parameters<TFunc>) => {

    // we need to look at the actual parameters passed, not the signature.
    // spreadsheet language supports "extra" parameters. we usually just 
    // repeat the tail parameter, but in this case we will NOT repeat the 
    // application (why not?)

    const arrays: unknown[][][] = [];

    // the result needs to be the same shape as the input. so we use the 
    // first array we find to create this map.

    let shape: unknown[][] = [];
    
    for (const [i, arg] of args.entries()) {

      if (arg && map[i]) {

        const arr = Array.isArray(arg) ? arg : IsArrayUnion(arg) ? arg.value : undefined;
        if (arr) {
          arrays[i] = arr;
          if (!shape.length) {
            shape = arr;
          }
        }
      }
    }

    if (arrays.length) {

      // this is pretty, but 3 functional loops? ouch

      return {
        type: ValueType.array,
        value: shape.map((_, i) => _.map((_, j) => {

          // this was breaking on boolean false, because 
          // it used || instead of ??. if we don't require 
          // boxed arguments, we need to handle naked booleans

          // actually, this is still slightly wrong. we know (actually the 
          // caller of this function knows) if each argument is boxed or not, 
          // and if it's not, we should not return the boxed undefined type, 
          // we should just return undefined.

          // that actually would basically solve false booleans as well, even
          // if it were incorrectly returning undefined. the issue is we were
          // returning a boxed undefined, which evaluates to true.

          const apply = args.map((arg, index) => arrays[index] ? (arrays[index][i][j] ?? { type: ValueType.undefined }) : arg);

          return base(...apply as Parameters<TFunc>);

        })),
      };

    }

    // scalar case

    return base(...args);

  };

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

export const StringUnion = (value: string): UnionValue => ({ type: ValueType.string, value });
export const NumberUnion = (value: number): UnionValue => ({ type: ValueType.number, value });

