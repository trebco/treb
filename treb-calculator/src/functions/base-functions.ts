
import { FunctionMap } from '../descriptors';
import * as Utils from '../utilities';
import { ReferenceError, NotImplError, ValueError, ArgumentError } from '../function-error';
import { Cell, ClickFunctionOptions, ClickFunctionResult } from 'treb-base-types';
import { Sparkline } from 'treb-sparkline';
import { LotusDate, UnlotusDate } from 'treb-format';

import { ClickCheckbox, RenderCheckbox } from './checkbox';

/**
 * BaseFunctionLibrary is a static object that has basic spreadsheet
 * functions and associated metadata (there's also a list of aliases).
 *
 * Calculator should register this one first, followed by any other
 * application-specific libraries.
 *
 * FIXME: there's no reason this has to be a single, monolithic library.
 * we could split up by category or something.
 *
 * ALSO: add category to descriptor.
 */

/** milliseconds in one day, used in time functions */
// const DAY_MS = 1000 * 60 * 60 * 24;

// some functions have semantics that can't be represented inline,
// or we may want to refer to them from other functions.

// OK, just one.

/** error function (for gaussian distribution) */
const erf = (x: number) => {

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  return 1 - ((((((a5 * t + a4) * t) + a3) * t + a2) * t) + a1) * t * Math.exp(-1 * x * x);

};

// use a single, static object for base functions

export const BaseFunctionLibrary: FunctionMap = {

    Cell: {
      description: 'Returns data about a cell',
      arguments: [
        { name: 'type', description: 'Type of data to return' },
        { name: 'reference', description: 'Cell reference', metadata: true },
      ],

      // there's no concept of "structure volatile", and structure events
      // don't trigger recalc, so this is not helpful -- we may need to 
      // think about both of those things
      
      // volatile: true, 

      fn: (type: string, reference: any) => {

        // console.info('metadata?', reference);

        if (!reference || !reference.address) return ReferenceError;
        switch (type?.toLowerCase()) {
          case 'format':
            return reference.format || ReferenceError;
          case 'address':
            return reference.address.label.replace(/\$/g, '');
        }
        return NotImplError;
      },
    },

    IsError: {
      description: 'Checks if another cell contains an error',
      arguments: [{ name: 'reference', allow_error: true }],
      fn: (ref: any) => {
        return (!!ref && !!ref.error);
      },
    },

    IfError: {
      description: 'Returns the original value, or the alternate value if the original value contains an error',
      arguments: [{ name: 'original value', allow_error: true }, { name: 'alternate value' }],
      fn: (ref: any, value_if_error: any) => {
        if (!!ref && !!ref.error) return value_if_error;
        return ref;
      },
    },

    Now: {
      description: 'Returns current time',
      volatile: true,
      fn: (): number => {
        return UnlotusDate(new Date().getTime());
      },
    },

    Today: {
      description: 'Returns current day',
      volatile: true,
      fn: (): number => {
        const date = new Date();
        date.setMilliseconds(0);
        date.setSeconds(0);
        date.setMinutes(0);
        date.setHours(12);
        return UnlotusDate(date.getTime());
      },
    },

    Year: {
      description: 'Returns year from date',
      arguments: [{
        name: 'date',
      }],
      fn: (source: number): number => {
        return new Date(LotusDate(source)).getUTCFullYear();
      },
    },


    Month: {
      description: 'Returns month from date',
      arguments: [{
        name: 'date',
      }],
      fn: (source: number): number => {
        return new Date(LotusDate(source)).getUTCMonth() + 1; // 0-based
      },
    },

    
    Day: {
      description: 'Returns day of month from date',
      arguments: [{
        name: 'date',
      }],
      fn: (source: number): number => {
        return new Date(LotusDate(source)).getUTCDate();
      },
    },

    Radians: {
      description: 'Converts degrees to radians',
      arguments: [{ name: 'Degrees', description: 'Angle in degrees' }],
      fn: (degrees: number): number => {
        return degrees * Math.PI / 180;
      },
    },

    Degrees: {
      description: 'Converts radians to degrees',
      arguments: [{ name: 'Radians', description: 'Angle in radians' }],
      fn: (radians: number): number => {
        return radians / Math.PI * 180;
      },
    },

    CountA: {
      description: 'Counts cells that are not empty',
      fn: (...args: any[]) => {
        return Utils.Flatten(args).reduce((a: number, b: any) => {
          if (typeof b === 'undefined') return a;
          return a + 1;
        }, 0);
      },
    },

    Count: {
      description: 'Counts cells that contain numbers',
      fn: (...args: any[]) => {
        return Utils.Flatten(args).reduce((a: number, b: any) => {
          if (typeof b === 'number') return a + 1;
          return a;
        }, 0);
      },
    },

    Or: {
      fn: (...args: any[]) => {
        let result = false;
        for (const arg of args) {
          result = result || !!arg;
        }
        return result;
      },
    },

    And: {
      fn: (...args: any[]) => {
        let result = true;
        for (const arg of args) {
          result = result && !!arg;
        }
        return result;
      },
    },

    Not: {
      fn: (...args: any[]) => {
        if (args.length === 0) {
          return ArgumentError;
        }
        if (args.length === 1) {
          return !args[0];
        }
        console.info(args);
        return true;
      }
    },

    /**
     * for the IF function, we need to allow error in parameter
     * because otherwise we may short-circuit the correct result.
     */
    If: {
      arguments: [
        { name: 'Test value' },
        { name: 'Value if true', allow_error: true, },
        { name: 'Value if false', allow_error: true, },
      ],
      fn: (a: any, b: any = true, c: any = false) => {

        if (a instanceof Float64Array || a instanceof Float32Array) a = Array.from(a);
        if (Array.isArray(a)) {
          return a.map((x) => {
            if ((typeof x === 'string') && (x.toLowerCase() === 'f' || x.toLowerCase() === 'false')) x = false;
            else x = Boolean(x);
            return x ? b : c;
          });
        }
        if ((typeof a === 'string') && (a.toLowerCase() === 'f' || a.toLowerCase() === 'false')) a = false;
        else a = Boolean(a);
        return a ? b : c;
      },
    },

    Power: {
      fn: (base: number, exponent: number) => Math.pow(base, exponent),
    },

    Mod: {
      fn: (num: number, divisor: number) => {
        return num % divisor;
      },
    },

    Sum: {
      description: 'Adds arguments and ranges',
      fn: (...args: any[]) => {
        return Utils.Flatten(args).reduce((a: number, b: any) => {
          const type = typeof b;
          if (type === 'undefined' || type === 'string') return a;
          return a + Number(b);
        }, 0);
      },
    },

    /*
    MMult: {
      description: 'Multiplies two matrices',
      arguments: [{ name: 'Matrix 1'}, { name: 'Matrix 2'}],
      fn: (a, b) => {
        if (!a || !b) return ArgumentError;

        const a_cols = a.length || 0;
        const a_rows = a[0]?.length || 0;

        const b_cols = b.length || 0;
        const b_rows = b[0]?.length || 0;

        if (!a_rows || !b_rows || !a_cols || !b_cols
           || a_rows !== b_cols || a_cols !== b_rows) return ValueError;

        const result: number[][] = [];

        // slightly confusing because we're column-major

        for (let c = 0; c < b_cols; c++) {
          result[c] = [];
          for (let r = 0; r < a_rows; r++) {
            result[c][r] = 0;
            for (let x = 0; x < a_cols; x++) {
              result[c][r] += a[x][r] * b[c][x];
            }
          }
        }
        return result;

      }
    },
    */

    SumProduct: {
      description: 'Returns the sum of pairwise products of two or more ranges',
      fn: (...args: any[]) => {
        // if (args.length < 2) return { error: 'VALUE' };
        // if (args.length === 0) return 0;
        // if (args.length === 1) return args[0];

        const flattened = args.map(arg => Utils.Flatten(arg));
        const len = Math.max.apply(0, flattened.map(x => x.length));

        let sum = 0;
        for (let i = 0; i < len; i++) {
          sum += flattened.reduce((a, arg) => {
            return a * (arg[i] || 0);
          }, 1);
        }        

        return sum;

        /*
        
        const cols = args[0].length;
        const rows = args[0][0].length;
        if (!rows) return ReferenceError;

        let sum = 0;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            sum += args.reduce((a, arg, index) => {
              return a * arg[c][r];
            }, 1);
          }
        }
        return sum;

        */

      },
    },

    /**
     * FIXME: does not implement inexact matching (what's the algo for
     * that, anyway? nearest? price is right style? what about ties?)
     */
    VLookup: {
      fn: (value: any, table: any[][], col: number, exact = false) => {

        col = Math.max(0, col - 1);

        let min = Math.abs(value - table[0][0]);
        let result: any = table[col][0];

        for (let i = 1; i < table[0].length; i++) {
          const abs = Math.abs(table[0][i] - value);
          if (abs < min) {
            min = abs;
            result = table[col][i];
          }
        }

        return result;
      },
    },

    Product: {
      fn: (...args: any[]) => {
        return Utils.Flatten(args).reduce((a: number, b: any) => {
          if (typeof b === 'undefined') return a;
          return a * Number(b);
        }, 1);
      },
    },

    Max: {
      fn: (...args: any[]) => {
        return Math.max.apply(0, Utils.Flatten(args));
      },
    },

    Min: {
      fn: (...args: any[]) => {
        return Math.min.apply(0, Utils.Flatten(args));
      },
    },

    Log: {
      /** default is base 10; allow specific base */
      fn: (a: number, base?: number) => {
        if (typeof base !== 'undefined') return Math.log(a) / Math.log(base);
        return Math.log10(a);
      },
    },

    Ln: {
      fn: Math.log,
    },

    Rand: {
      volatile: true,
      fn: Math.random,
    },

    RandBetween: {
      arguments: [{name: 'min'}, {name: 'max'}],
      volatile: true,
      fn: (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      },
    },

    Round: {
      description: 'Round to a specified number of digits',

      /** round with variable digits */
      fn: (value: number, digits = 0) => {
        const m = Math.pow(10, digits);
        return Math.round(m * value) / m;
      },
    },

    RoundDown: {
      /** round down with variable digits */
      fn: (value: number, digits = 0) => {
        digits = Math.max(0, digits);
        const m = Math.pow(10, digits);
        return Math.floor(m * value) / m;
      },
    },


    /**
     * sort arguments, but ensure we return empty strings to
     * fill up the result array
     */
    Sort: {
      fn: (...args: any[]) => {

        args = Utils.Flatten(args);
        if(args.every((test) => typeof test === 'number')) {
          args.sort((a, b) => a - b);
        }
        else {
          args.sort(); // lexical
        }
        return args;

        /*
        args = Utils.Flatten(Utils.UndefinedToEmptyString(args));

        const empty: string[] = [];
        const filtered = args.filter((test) => {
          if (!!test || test === 0) return true;
          empty.push('X');
          return false;
        });

        if(filtered.every((test) => typeof test === 'number')) {
          filtered.sort((a, b) => a - b);
        }
        else {
          filtered.sort(); // lexical
        }

        return filtered.concat(empty);
        */

      },
    },

    Transpose: {
      description: 'Returns transpose of input matrix',
      arguments: [{name: 'matrix'}],
      fn: Utils.TransposeArray,
    },

    Reverse: {
      fn: (a: any) => {
        if ( Array.isArray(a)) {
          if (a.length === 1 ) return [a[0].reverse()];
          return a.reverse();
        }
        return a.toString().split('').reverse().join('');
      },
    },

    Abs: {
      fn: Utils.ApplyArrayFunc(Math.abs),
    },


    Simplify: {
      fn: (value: number, significant_digits = 2) => {
        significant_digits = significant_digits || 2;
        if (value === 0) return value;
        const negative = value < 0 ? -1 : 1;
        value *= negative;
        const x = Math.pow(10, Math.floor(Math.log10(value)) + 1 - significant_digits);
        return Math.round(value / x) * x * negative;
      },
    },

    Erf: {
      fn: erf,
    },

    'Norm.Dist': {

      description: 'Cumulative normal distribution',
      arguments: [
        {name: 'value'},
        {name: 'mean', default: 0},
        {name: 'standard deviation', default: 1},
      ],

      fn: (x: number, mean = 0, stdev = 1) => {

        // generalized
        const sign = (x < mean) ? -1 : 1;
        return 0.5 * (1.0 + sign * erf((Math.abs(x - mean)) / (stdev * Math.sqrt(2))));

      },
    },

    HexToDec: {
      arguments: [{ description: 'hexadecimal string' }],
      fn: (hex: string) => {
        return parseInt(hex, 16);
      },
    },

    DecToHex: {
      arguments: [{ description: 'number' }],
      fn: (num: number) => {
        return num.toString(16);
      },
    },

    Checkbox: {
      arguments: [
        {name: 'checked'},
      ],
      click: ClickCheckbox,
      render: RenderCheckbox,
      fn: (checked: boolean): boolean => !!checked,
    },

    'Sparkline.Column': {
      arguments: [
        {name: 'data'}, 
        {name: 'color'}, 
        {name: 'negative color'}],
      render: (options: any) => {
        const context = options.context as CanvasRenderingContext2D;
        const width = options.width as number;
        const height = options.height as number;
        const cell = options.cell as Cell;

        Sparkline.RenderColumn(width, height, context, cell);
       
      },
      fn: (...args: any[]) => {
        return args;
      },
    },

    'Sparkline.Line': {
      arguments: [
        {name: 'data'}, 
        {name: 'color'},
        {name: 'line width'},
      ],
      render: (options: any) => {
        const context = options.context as CanvasRenderingContext2D;
        const width = options.width as number;
        const height = options.height as number;
        const cell = options.cell as Cell;

        Sparkline.RenderLine(width, height, context, cell);
      
      },
      fn: (...args: any[]) => {
        return args;
      },
    }


};

/*
export const BaseFunctionAliases: {[index: string]: string} = {
  Mean: 'Average',
};
*/

// alias

// add functions from Math (intrinsic), unless the name overlaps
// with something already in there

// we need to construct a separate map to match icase (this is now
// even more useful since we have a separate section for aliases)

const name_map: {[index: string]: string} = {};

for (const key of Object.keys(BaseFunctionLibrary)) {
  name_map[key.toLowerCase()] = key;
}

/*
for (const key of Object.keys(BaseFunctionAliases)) {
  name_map[key.toLowerCase()] = key;
}
*/

for (const name of Object.getOwnPropertyNames(Math)) {

  // check if it exists (we have already registered something
  // with the same name) -- don't override existing

  if (name_map[name.toLowerCase()]) { continue; }

  const descriptor = Object.getOwnPropertyDescriptor(Math, name);
  if (!descriptor) { continue; }

  const value = descriptor.value;
  const type = typeof (value);

  switch (type) {
  case 'number':
    BaseFunctionLibrary[name] = {
      fn: () => value,
      category: ['Math Functions'],
    };
    break;

  case 'function':
    BaseFunctionLibrary[name] = {
      fn: value,
      category: ['Math Functions'],
    };
    break;

  default:
    console.info('unexpected type:', type, name);
    break;
  }

}

// IE11: patch log10 function

if (!Math.log10) {
  Math.log10 = (a) => Math.log(a) / Math.log(10);
  BaseFunctionLibrary.log10 = {
    fn: (x) => Math.log(x) / Math.log(10),
    category: ['Math Functions'],
  };
}
