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
import * as Utils from '../utilities';
// import { StringUnion, NumberUnion } from '../utilities';
import { ReferenceError, NotImplError, NAError, ArgumentError, DivideByZeroError, ValueError } from '../function-error';
import type { UnionValue, 
         RenderFunctionResult, RenderFunctionOptions, Complex, CellValue, 
        // ICellAddress
        } from 'treb-base-types';
import { Box, ValueType, GetValueType, ComplexOrReal, IsComplex, Area } from 'treb-base-types';
import { Sparkline } from './sparkline';
import { LotusDate, UnlotusDate } from 'treb-format';

import { ClickCheckbox, RenderCheckbox } from './checkbox';
import { UnionIsMetadata } from '../expression-calculator';

import { Exp as ComplexExp, Power as ComplexPower, Multiply as ComplexMultply } from '../complex-math';
import * as ComplexMath from '../complex-math';

import { CoerceComplex } from './function-utilities';
import type { UnitAddress, UnitRange } from 'treb-parser';
import { ConstructDate } from './date-utils';

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
const erf = (x: number): number => {

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

const sqrt2pi = Math.sqrt(2 * Math.PI);

const norm_dist = (x: number, mean: number, stdev: number, cumulative: boolean) => {
  
  let value = 0;

  if (cumulative) {
    const sign = (x < mean) ? -1 : 1;
    value = 0.5 * (1.0 + sign * erf((Math.abs(x - mean)) / (stdev * Math.sqrt(2))));
  }
  else {
    value = Math.exp(-1/2 * Math.pow((x - mean) / stdev, 2)) / (stdev * sqrt2pi);
  }

  return value;

}

/** imprecise but reasonably fast normsinv function */
const inverse_normal = (q: number): number => {

  if (q === 0.50) {
    return 0;
  }
  
  const p = (q < 1.0 && q > 0.5) ? (1 - q) : q;
  const t = Math.sqrt(Math.log(1.0 / Math.pow(p, 2.0)));
  const x = t - (2.515517 + 0.802853 * t + 0.010328 * Math.pow(t, 2.0)) /
    (1.0 + 1.432788 * t + 0.189269 * Math.pow(t, 2.0) + 0.001308 * Math.pow(t, 3.0));

  return (q > 0.5 ? x : -x);

};


const edate_calc = (start: number, months: number) => {
  
  let date = new Date(LotusDate(start));
  let month = date.getUTCMonth() + months;
  let year = date.getUTCFullYear();

  // if we don't ensure the time we'll wind up hitting boundary cases

  date.setUTCHours(12);
  date.setUTCMinutes(0);
  date.setUTCSeconds(0);
  date.setUTCMilliseconds(0);

  while (month < 0) {
    month += 12;
    year--;
  }
  while (month > 11) {
    month -= 12;
    year++;
  }

  date.setUTCMonth(month);
  date.setUTCFullYear(year);

  // if this rolls over the month, then we need to go back to the 
  // last valid day of the month. so jan 31 + 1 month needs to equal
  // feb 28 (feb 29 in leap year).

  const check_month = date.getUTCMonth();
  if (check_month !== month) {
    const days = date.getUTCDate();
    date = new Date(date.getTime() - (days * 86400 * 1000));
  }

  return date;

};

const zlookup_arguments = [
  {
    name: "Lookup value",
  },
  {
    name: "Table",
  },
  {
    name: "Result index",
  },
  {
    name: "Inexact",
    default: true,
  },
];

/**
 * unified VLOOKUP/HLOOKUP. ordinarily we'd call it XLOOKUP but that's taken.
 * FIXME: can't use use that function for this? 
 */
const ZLookup = (value: number|string|boolean|undefined, table: (number|string|boolean|undefined)[][], col: number, inexact = true, transpose = false): UnionValue => {

  if (transpose) {
    table = Utils.TransposeArray(table);
  }

  col = Math.max(0, col - 1);

  // inexact is the default. this assumes that the data is sorted,
  // either numerically or alphabetically. it returns the closest
  // value without going over -- meaning walk the list, and when
  // you're over return the _previous_ item. except if there's an
  // exact match, I guess, in that case return the exact match.
  
  // FIXME: there's a hint in the docs for XLOOKUP that this might
  // be using a binary search. not sure why, but that might be 
  // correct.

  if (inexact) {

    let result: number|string|boolean|undefined = table[col][0];

    if (typeof value === 'number') {

      let compare = Number(table[0][0]);
      if (isNaN(compare) || compare > value) {
        return NAError();
      }

      for (let i = 1; i < table[0].length; i++) {
        compare = Number(table[0][i]);
        if (isNaN(compare) || compare > value) {
          break;
        }
        result = table[col][i];

      }

    }
    else {

      value = (value||'').toString().toLowerCase(); // ?
      let compare: string = (table[0][0] || '').toString().toLowerCase();
      if (compare.localeCompare(value) > 0) {
        return NAError();
      }

      for (let i = 1; i < table[0].length; i++) {
        compare = (table[0][i] || '').toString().toLowerCase();
        if (compare.localeCompare(value) > 0) {
          break;
        }
        result = table[col][i];

      }

    }

    return Box(result);

  }
  else {
    for (let i = 0; i < table[0].length; i++) {
      if (table[0][i] == value) { // ==
        return Box(table[col][i]);
      }
    }
    return NAError();
  }

};

const NumberArgument = (argument?: UnionValue, default_value: number|false = false) => {

  if (!argument) {
    return default_value;
  }

  switch (argument.type) {
    case ValueType.number:
      return argument.value;
    case ValueType.undefined:
      return default_value;
  }

  return false;

};

/**
 * alternate functions. these are used (atm) only for changing complex 
 * behavior.
 */
export const AltFunctionLibrary: FunctionMap = {

  Sqrt: {
    description: 'Returns the square root of the argument',
    arguments: [
      { boxed: true, unroll: true },
    ],
    fn: (ref: UnionValue): UnionValue => {

      if (ref.type === ValueType.complex) {
        const value = ComplexPower(ref.value, {real: 0.5, imaginary: 0});
        return ComplexOrReal(value);
      }
      else if (ref.type === ValueType.undefined || !ref.value) {
        return {
          type: ValueType.number, value: 0,
        }
      }
      else if (ref.type === ValueType.number && ref.value < 0) {
        const value = ComplexPower({real: ref.value, imaginary: 0}, {real: 0.5, imaginary: 0});
        return {
          type: ValueType.complex,
          value,
        }
      }
      else if (ref.type === ValueType.number) {
        const value = Math.sqrt(ref.value);
        if (isNaN(value)) {
          return ValueError();
        }
        return { type: ValueType.number, value };
      }
      else {
        /*
        const value = Math.sqrt(ref.value);
        if (isNaN(value)) {
          return ValueError();
        }
        return { type: ValueType.number, value };
        */
        return ValueError();
      }
    },
  },
  
  Power: {
    description: 'Returns base raised to the given power',
    arguments: [
      { name: 'base', boxed: true, unroll: true, },
      { name: 'exponent', boxed: true, unroll: true, }
    ],
    fn: (base: UnionValue, exponent: UnionValue): UnionValue => {

      // we're leaking complex numbers here because our functions are
      // very slightly imprecise. I would like to stop doing that. try to
      // use real math unless absolutely necessary.
      
      // in the alternative we could update the epsilon on our ComplexOrReal
      // function, but I would prefer not to do that if we don't have to.

      // so: if both arguments are real, and base is >= 0 we can use real math.
      // also if exponent is either 0 or >= 1 we can use real math.

      if (base.type === ValueType.number && exponent.type === ValueType.number) {
        if (base.value >= 0 || exponent.value === 0 || Math.abs(exponent.value) >= 1) {
          const value = Math.pow(base.value, exponent.value);
          if (isNaN(value)) {
            return ValueError();
          }
          return { type: ValueType.number, value };
        }
      }
      
      const a = CoerceComplex(base);
      const b = CoerceComplex(exponent);

      if (a && b) {
        const value = ComplexPower(a, b);
        return ComplexOrReal(value);
      }

      return ValueError();


    },
  },

};

// use a single, static object for base functions

export const BaseFunctionLibrary: FunctionMap = {

  // not sure why there are functions for booleans, but there are
  True: {
    fn: () => ({ type: ValueType.boolean, value: true }),
  },

  False: {
    fn: () => ({ type: ValueType.boolean, value: false }),
  },

  Int: {
    fn: (value: number) => {
      return {type: ValueType.number, value: Math.floor(value) };
    },
  },

  Rand: {
    volatile: true,
    fn: () => { return { type: ValueType.number, value: Math.random() }},
  },

  RandBetween: {
    arguments: [{name: 'min'}, {name: 'max'}],
    volatile: true,
    fn: (min = 0, max = 1) => { 
      if (min > max) { 
        const tmp = min;
        min = max;
        max = tmp;
      }
      return { type: ValueType.number, value: Math.floor(Math.random() * (max + 1 - min) + min) }
    },
  },

  Sum: {
    description: 'Adds arguments and ranges',
    arguments: [{ boxed: true, name: 'values or ranges' }],
    fn: (...args: UnionValue[]) => {

      const sum = { real: 0, imaginary: 0 };

      const values = Utils.FlattenBoxed(args); // as UnionValue[];

      for (const value of values) {

        switch (value.type) {
          case ValueType.number: sum.real += value.value; break;
          case ValueType.boolean: sum.real += (value.value ? 1 : 0); break;
          case ValueType.complex:
            sum.real += value.value.real;
            sum.imaginary += value.value.imaginary;
            break;
          case ValueType.error: return value;
        }
      }

      return ComplexOrReal(sum);

    },
  },

  // --- FIXME: break out date functions? --------------------------------------

  EDate: {
    arguments: [
      { 
        name: 'Start date',
        unroll: true,
      },
      {
        name: 'Months',
        unroll: true,
      },
    ],
    fn: (start: number, months = 0) => {
      if (typeof start !== 'number' || typeof months !== 'number') {
        return ArgumentError();
      }
      const date = edate_calc(start, months);
      return { type: ValueType.number, value: UnlotusDate(date.getTime(), false) };
    }
  },

  EOMonth: {
    arguments: [
      { 
        name: 'Start date',
        unroll: true,
      },
      {
        name: 'Months',
        unroll: true,
      },
    ],
    fn: (start: number, months = 0) => {

      // this is the same as edate, except it advances to the end of the
      // month. so jan 15, 2023 plus one month -> feb 28, 2023 (last day).

      if (typeof start !== 'number' || typeof months !== 'number') {
        return ArgumentError();
      }
      const date = edate_calc(start, months);

      const month = date.getUTCMonth();
      switch (month) {
        case 1: // feb, special
          {
            const year = date.getUTCFullYear();

            // it's a leap year if it is divisible by 4, unless it's also 
            // divisible by 100 AND NOT divisible by 400. 1900 is grand-
            // fathered in via an error in Lotus. 

            if (year % 4 === 0 && (year === 1900 || (year % 400 === 0) || (year % 100 !== 0))) {
              date.setUTCDate(29);
            } 
            else {
              date.setUTCDate(28);
            }
          }
          break;

        case 0: // jan
        case 2:
        case 4:
        case 6: // july
        case 7: // august
        case 9:
        case 11: // dec
          date.setUTCDate(31);
          break;

        default:
          date.setUTCDate(30);
          break;
      }
      

      
      return { type: ValueType.number, value: UnlotusDate(date.getTime(), false) };

    }
  },

  Now: {
    description: 'Returns current time',
    volatile: true,
    fn: () => {
      return { type: ValueType.number, value: UnlotusDate(new Date().getTime()) };
    },
  },

  YearFrac: {
    description: 'Returns the fraction of a year between two dates',
    arguments: [
      { name: 'Start', }, 
      { name: 'End', },
      { name: 'Basis', default: 0 },
    ],
    fn: (start: number, end: number, basis: number): UnionValue => {

      // is this in the spec? should it not be negative here? (...)

      if (end < start) {
        const temp = start;
        start = end;
        end = temp;
      }

      const delta = Math.max(0, end - start);
      let divisor = 360;

      if (basis && basis < 0 || basis > 4) {
        return ArgumentError();
      }

      // console.info({start, end, basis, delta});

      switch (basis) {
        case 1:
          break;
        case 2:
          break;
        case 3:
          divisor = 365;
          break;
      }

      return {
        type: ValueType.number,
        value: delta / divisor,
      };

    },
  },

  Date: {
    description: 'Constructs a date from year/month/day',
    arguments: [
      { name: 'year', unroll: true },
      { name: 'month', unroll: true },
      { name: 'day', unroll: true },
    ],
    fn: (year: number, month: number, day: number) => {
      const date = ConstructDate(year, month, day);
      if (date === false) {
        return ArgumentError();
      }
      return { type: ValueType.number, value: date };
    },
  },

  Today: {
    description: 'Returns current day',
    volatile: true,
    fn: () => {
      const date = new Date();
      date.setMilliseconds(0);
      date.setSeconds(0);
      date.setMinutes(0);
      date.setHours(12);
      return { type: ValueType.number, value: UnlotusDate(date.getTime()) };
    },
  },

  // ---------------------------------------------------------------------------

  IfError: {
    description: 'Returns the original value, or the alternate value if the original value contains an error',
    arguments: [{ name: 'original value', allow_error: true, boxed: true }, { name: 'alternate value' }],
    fn: (ref: UnionValue, value_if_error: unknown = 0): UnionValue => {
      if (ref && ref.type === ValueType.error) {
        return { value: value_if_error, type: GetValueType(value_if_error) } as UnionValue;
      }
      return ref;
    },
  },

  IsNA: {
    description: 'Checks if another cell contains a #NA error',
    arguments: [{ name: 'reference', allow_error: true, boxed: true }],
    fn: (...args: UnionValue[]): UnionValue => {

      const values = Utils.FlattenBoxed(args);
      for (const value of values) {
        if (value.type === ValueType.error) {
          if (value.value === 'N/A') {
            return { type: ValueType.boolean, value: true };
          }
        }
      }

      return { type: ValueType.boolean, value: false };

    },
  },

  IsErr: {
    description: 'Checks if another cell contains an error',
    arguments: [{ name: 'reference', allow_error: true, boxed: true }],
    fn: (...args: UnionValue[]): UnionValue => {

      const values = Utils.FlattenBoxed(args);
      for (const value of values) {
        if (value.type === ValueType.error && value.value !== 'N/A') {
          return { type: ValueType.boolean, value: true };
        }
      }

      /*
      if (Array.isArray(ref)) {
        const values = Utils.Flatten(ref) as UnionValue[];
        for (const value of values) {
          if (value.type === ValueType.error) {
            return { type: ValueType.boolean, value: true };
          }
        }
      }
      else if (ref) {
        return { type: ValueType.boolean, value: ref.type === ValueType.error };
      }
      */

      return { type: ValueType.boolean, value: false };

    },
  },

  IsError: {
    description: 'Checks if another cell contains an error',
    arguments: [{ name: 'reference', allow_error: true, boxed: true }],
    fn: (...args: UnionValue[]): UnionValue => {

      const values = Utils.FlattenBoxed(args);
      for (const value of values) {
        if (value.type === ValueType.error) {
          return { type: ValueType.boolean, value: true };
        }
      }

      /*
      if (Array.isArray(ref)) {
        const values = Utils.Flatten(ref) as UnionValue[];
        for (const value of values) {
          if (value.type === ValueType.error) {
            return { type: ValueType.boolean, value: true };
          }
        }
      }
      else if (ref) {
        return { type: ValueType.boolean, value: ref.type === ValueType.error };
      }
      */

      return { type: ValueType.boolean, value: false };

    },
  },


    Cell: {
      description: 'Returns data about a cell',
      arguments: [
        { name: 'type', description: 'Type of data to return', unroll: true,  },
        { name: 'reference', description: 'Cell reference', metadata: true, unroll: true,  },
      ],

      // there's no concept of "structure volatile", and structure events
      // don't trigger recalc, so this is not helpful -- we may need to 
      // think about both of those things
      
      // volatile: true, 

      fn: (type: string, reference: UnionValue): UnionValue => {

        if (!UnionIsMetadata(reference)) {
          return ReferenceError();
        }

        if (type) {
          switch (type.toString().toLowerCase()) {
            case 'format':
              return reference.value.format ? // || ReferenceError;
                { type: ValueType.string, value: reference.value.format } : ReferenceError();
            case 'address':
              return { type: ValueType.string, value: reference.value.address.label.replace(/\$/g, '') };
          }
        }

        return { type: ValueType.error, value: NotImplError.error };

      },

    },

    Year: {
      description: 'Returns year from date',
      arguments: [{
        name: 'date', unroll: true,
      }],
      fn: (source: number): UnionValue => {
        return Box(new Date(LotusDate(source)).getUTCFullYear());
      },
    },


    Month: {
      description: 'Returns month from date',
      arguments: [{
        name: 'date', unroll: true,
      }],
      fn: (source: number): UnionValue => {
        return Box(new Date(LotusDate(source)).getUTCMonth() + 1); // 0-based
      },
    },

    
    Day: {
      description: 'Returns day of month from date',
      arguments: [{
        name: 'date', unroll: true,
      }],
      fn: (source: number): UnionValue => {
        return Box(new Date(LotusDate(source)).getUTCDate());
      },
    },

    Radians: {
      description: 'Converts degrees to radians',
      arguments: [{ name: 'Degrees', description: 'Angle in degrees', unroll: true }],
      fn: (degrees: number): UnionValue => {
        return Box(degrees * Math.PI / 180);
      },
    },

    Degrees: {
      description: 'Converts radians to degrees',
      arguments: [{ name: 'Radians', description: 'Angle in radians', unroll: true }],
      fn: (radians: number): UnionValue => {
        return Box(radians / Math.PI * 180);
      },
    },

    CountA: {
      description: 'Counts cells that are not empty',
      fn: (...args: CellValue[]): UnionValue => {
        return Box(Utils.FlattenCellValues(args).reduce((a: number, b: unknown) => {
          if (typeof b === 'undefined') return a;
          return a + 1;
        }, 0));
      },
    },

    Count: {
      description: 'Counts cells that contain numbers',
      fn: (...args: CellValue[]): UnionValue => {
        return Box(Utils.FlattenCellValues(args).reduce((a: number, b: unknown) => {
          if (typeof b === 'number' || IsComplex(b)) return a + 1;
          return a;
        }, 0));
      },
    },

    Or: {
      fn: (...args: CellValue[]): UnionValue => {
        let result = false;
        args = Utils.FlattenCellValues(args);
        for (const arg of args) {
          result = result || !!arg;
        }
        return Box(result);
      },
    },

    And: {
      fn: (...args: CellValue[]): UnionValue => {
        let result = true;
        args = Utils.FlattenCellValues(args);
        for (const arg of args) {
          result = result && !!arg;
        }
        return Box(result);
      },
    },

    Not: {
      arguments: [{ unroll: true }],
      fn: (...args: unknown[]): UnionValue => {
        if (args.length === 0) {
          return ArgumentError();
        }
        if (args.length === 1) {
          return Box(!args[0]);
        }
        return Box(true);
      },
    },

    If: {
      arguments: [
        { name: 'test value', boxed: true },
        { name: 'value if true', boxed: true, allow_error: true },
        { name: 'value if false', boxed: true, allow_error: true },
      ],

      /**
       * should we really have defaults for the t/f paths? not sure what X does
       * @returns 
       */
      fn: (a: UnionValue, 
           b: UnionValue = {type: ValueType.boolean, value: true}, 
           c: UnionValue = {type: ValueType.boolean, value: false}): UnionValue => {

        const b_array = b.type === ValueType.array;
        const c_array = c.type === ValueType.array;

        if (a.type === ValueType.array) {
          return {
            type: ValueType.array,
            value: a.value.map((row, x) => row.map((cell, y) => {
              const value = (cell.type === ValueType.string) ?
                (cell.value.toLowerCase() !== 'false' && cell.value.toLowerCase() !== 'f') : !!cell.value;
              return value ? (b_array ? b.value[x][y] : b) : (c_array ? c.value[x][y] : c);
            })) as UnionValue[][],
          };
        }

        const value = a.type === ValueType.string ? //  UnionIs.String(a) ? 
          (a.value.toLowerCase() !== 'false' && a.value.toLowerCase() !== 'f') : !!a.value;

        return value ? b : c;

      },
    },

    Fact: {
      description: 'Returns the factorial of a number',
      arguments: [
        { name: 'number', unroll: true },
      ],
      fn: (number: number): UnionValue => {
        number = Math.round(number);

        let value = 1;
        while (number > 1) {
          value *= number;
          number--;
        }
        return {
          type: ValueType.number,
          value,
        }
      },
    },

    Power: {
      description: 'Returns base raised to the given power',
      arguments: [
        { name: 'base', boxed: true, unroll: true, },
        { name: 'exponent', boxed: true, unroll: true, }
      ],
      fn: (base: UnionValue, exponent: UnionValue): UnionValue => {
      
        const a = CoerceComplex(base);
        const b = CoerceComplex(exponent);

        if (!a || !b) {
          return ValueError();
        }

        if (base.type === ValueType.complex || exponent.type === ValueType.complex) {
          return ComplexOrReal(ComplexPower(a, b));
        }
        else {
          const value = Math.pow(a.real, b.real);
          if (isNaN(value)) {
            return ValueError();
          }
          return { type: ValueType.number, value };
          // return Box(Math.pow(base.value, exponent.value))
        }

      },
    },

    Mod: {
      arguments: [
        { unroll: true },
        { unroll: true },
      ],
      fn: (num: number, divisor: number): UnionValue => {
        if (!divisor) { 
          return DivideByZeroError();
        }
        return Box(num % divisor);
      },
    },

    Large: {
      description: 'Returns the nth numeric value from the data, in descending order',
      arguments: [
        {
          name: 'values',
        }, 
        {
          name: 'index', unroll: true,
        }
      ],

      fn: (data: CellValue[], index: number) => {

        if (index <= 0) {
          return ArgumentError();
        }

        // const flat = Utils.FlattenCellValues(data);
        // const numeric: number[] = flat.filter((test): test is number => typeof test === 'number');
        const numeric = Utils.FlattenNumbers(data);
        numeric.sort((a, b) => b - a);

        if (index <= numeric.length) {
          return {
            type: ValueType.number,
            value: numeric[index - 1],
          };
        }

        return ArgumentError();
      },

    },

    Small: {
      description: 'Returns the nth numeric value from the data, in ascending order',
      arguments: [
        {
          name: 'values',
        }, 
        {
          name: 'index', unroll: true,
        }
      ],

      fn: (data: CellValue[], index: number) => {

        if (index <= 0) {
          return ArgumentError();
        }

        // const flat = Utils.FlattenCellValues(data);
        // const numeric: number[] = flat.filter((test): test is number => typeof test === 'number');
        const numeric = Utils.FlattenNumbers(data);
        numeric.sort((a, b) => a - b);

        if (index <= numeric.length) {
          return {
            type: ValueType.number,
            value: numeric[index - 1],
          };
        }

        return ArgumentError();

      },

    },

    /**
     * 
     */
    Filter: {
      description: "Filter an array using a second array.",
      arguments: [
        { name: 'source', description: 'Source array' },
        { name: 'filter', description: 'Filter array' },
        // if_empty
      ],

      fn: (source: CellValue|CellValue[][], filter: CellValue|CellValue[][]) => {

        if (typeof source === 'undefined' || typeof filter === 'undefined') {
          return ArgumentError();
        }

        if (!Array.isArray(source)) {
          source = [[source]];
        }
        if (!Array.isArray(filter)) {
          filter = [[filter]];
        }

        const source_cols = source.length;
        const source_rows = source[0].length;

        const filter_cols = filter.length;
        const filter_rows = filter[0].length;

        // prefer rows

        if (source_rows === filter_rows) {

          const result: UnionValue[][] = [];

          for (let i = 0; i < source_cols; i++) {
            result.push([]);
          }

          for (const [index, entry] of filter[0].entries()) {

            // FIXME: don't allow strings? errors? (...)

            if (entry) {
              for (let i = 0; i < source_cols; i++) {
                result[i].push(Box(source[i][index]));
              }
            }
 
          }
          
          return {
            type: ValueType.array,
            value: result,
          }

        }
        else if (source_cols === filter_cols) {

          const result: UnionValue[][] = [];

          for (const [index, [entry]] of filter.entries()) {

            // FIXME: don't allow strings? errors? (...)

            if (entry) {
              result.push(source[index].map(value => Box(value)));
            }
 
          }
          
          return {
            type: ValueType.array,
            value: result,
          }

        }

        return ArgumentError();

      },

    },

    /**
     * sort arguments, but ensure we return empty strings to
     * fill up the result array
     * 
     * FIXME: instead of boxing all the values, why not pass them in boxed?
     * was this function just written at the wrong time?
     */
    Sort: {
      arguments: [
        { name: 'values' }
      ],
      fn: (...args: CellValue[]): UnionValue => {

        args = Utils.FlattenCellValues(args);

        if(args.every(test => typeof test === 'number')) {
          (args as number[]).sort((a, b) => a - b);
        }
        else {
          args.sort(); // lexical
        }

        return { type: ValueType.array, value: [args.map(value => Box(value))] };

      },
    },

    Transpose: {
      description: 'Returns transpose of input matrix',
      arguments: [{name: 'matrix', boxed: true}],
      fn: (mat: UnionValue): UnionValue => {

        if (mat.type === ValueType.array) {
          return {
            type: ValueType.array,
            value: Utils.Transpose2(mat.value),
          };
        }

        /*
        if (Array.isArray(mat)) {
          return Utils.Transpose2(mat);
        }
        */

        return mat;
      } 
    },

    Max: {
      fn: (...args: number[]): UnionValue => {
        return { 
          type: ValueType.number, 
          // value: Math.max.apply(0, Utils.FlattenCellValues(args).filter((x): x is number => typeof x === 'number')),
          value: Math.max.apply(0, Utils.FlattenNumbers(args)),
        };
      },
    },

    Min: {
      fn: (...args: number[]): UnionValue => {
        return { 
          type: ValueType.number, 
          // value: Math.min.apply(0, Utils.FlattenCellValues(args).filter((x): x is number => typeof x === 'number')),
          value: Math.min.apply(0, Utils.FlattenNumbers(args)),
        };
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
      fn: (...args: CellValue[][]): UnionValue  => {

        const flattened = args.map(arg => Utils.FlattenCellValues(arg));
        const len = Math.max.apply(0, flattened.map(x => x.length));

        let sum = 0;
        for (let i = 0; i < len; i++) {
          sum += flattened.reduce((a, arg) => {
            let ai: CellValue = arg[i];
            if (ai === true) {
              ai = 1;
            }
            return (typeof ai === 'number') ? a * ai : 0;
          }, 1);
        }        

        return { type: ValueType.number, value: sum };

      },
    },

    /**
     * 
     * match type: 
     * 
     *  1: largest value <= target value; assumes table is in ascending order.
     *  0: exact match only.
     * -1: smallest value >= target value; assumes table is in descending order.
     * 
     * NOTE that string matches can accept wildcards in Excel, not sure if we 
     * necessarily want to support that... how does string matching deal with
     * inequalities?
     * /
    Match: {
      fn: (value: CellValue, table: CellValue[][], match_type: 1|0|-1 = 1) => {

        const flat = table.reduce((a, row) => ([...a, ...row]), []);
        for (let i = 0; i < flat.length; i++) {

          const compare = flat[i];

          console.info("CV", compare, value);

          // this is true regardless of match type... right?
          if (compare === value) {
            return { type: ValueType.number, value: i + 1 };
          }
 
          if ((typeof compare !== 'undefined' && typeof value !== 'undefined') && (
              (match_type === 1 && compare > value) || 
              (match_type === -1 && compare < value))) {

            if (i === 0 || i === flat.length - 1) {
              return NAError();
            }

            return { type: ValueType.number, value: i }; // implicit -1
          }

        }
        return NAError();
      },
    },
    */
   

    Row: {
      arguments: [{ name: 'reference', metadata: true }],
      fn: (ref: UnionValue): UnionValue => {
        if (ref.type === ValueType.array) {
          const arr = ref.value;
          const first = arr[0][0];

          if (UnionIsMetadata(first)) {
            return {
              type: ValueType.array,
              value: [arr[0].map((row, index) => ({
                type: ValueType.number,
                value: index + first.value.address.row + 1
              }))],
            };
          }

        }
        else if (UnionIsMetadata(ref)) {
          return {
            type: ValueType.number, value: ref.value.address.row + 1,
          }
        }
        return ArgumentError();
      },
    },

    Column: {
      arguments: [{ name: 'reference', metadata: true }],
      fn: (ref: UnionValue): UnionValue => {
        if (ref.type === ValueType.array) {
          const arr = ref.value;
          const first = arr[0][0];

          if (UnionIsMetadata(first)) {
            return {
              type: ValueType.array,
              value: arr.map((row, index) => [{
                type: ValueType.number,
                value: index + first.value.address.column + 1
              }]),
            };
          }

        }
        else if (UnionIsMetadata(ref)) {
          return {
            type: ValueType.number, value: ref.value.address.row + 1,
          }
        }
        return ArgumentError();
      },
    },
    
    Choose: {
      arguments: [
        { name: 'Selected index', },
        { name: 'Choice 1...', metadata: true },
      ],
      return_type: 'reference',
      description: 'Returns one of a list of choices',
      fn: (selected: number, ...choices: UnionValue[]): UnionValue => {

        if (selected < 1 || selected > choices.length) {
          return ValueError();
        }

        const value = choices[selected - 1];

        // this should be metadata. is there a different object we 
        // might run into? maybe we should refactor how metadata works

        if (UnionIsMetadata(value)) {
          return {
            type: ValueType.object,
            value: value.value.address,
          }
        }

        // check if array is metadata. if it's a literal array
        // we just want to return it.

        if (value.type === ValueType.array) {
          const arr = value.value;
          const rows = arr.length;
          const cols = arr[0].length;
          const first = arr[0][0];
          const last = arr[rows - 1][cols - 1];

          if (rows === 1 && cols === 1) {
            if (UnionIsMetadata(first)) {
              return {
                type: ValueType.object,
                value: first.value.address,
              };
            }
          }
          else {
            if (UnionIsMetadata(first) && UnionIsMetadata(last)) {
              return {
                type: ValueType.object,
                value: {
                  type: 'range',
                  position: 0, id: 0, label: '',
                  start: first.value.address,
                  end: last.value.address,
                }
              }
            }

          }
        }
        
        return {
          ...value, // should we deep-copy in case of an array?
        };

      },
    },

    /*
     * rewrite of xlookup to return a reference. better compatibility.
     * ---
     *
     * unsaid anywhere (that I can locate) aboud XLOOKUP is that lookup 
     * array must be one-dimensional. it can be either a row or a column,
     * but one dimension must be one. that simplifies things quite a bit.
     * 
     * there's a note in the docs about binary search over the data -- 
     * that might explain how inexact VLOOKUP works as well. seems an odd
     * choice but maybe back in the day it made sense
     */
    XLOOKUP: {
      arguments: [
        { name: 'Lookup value', },
        { name: 'Lookup array',  },
        { name: 'Return array', metadata: true, },
        { name: 'Not found', boxed: true },
        { name: 'Match mode', default: 0, },
        { name: 'Search mode', default: 1, },
      ],
      return_type: 'reference',
      xlfn: true,
      fn: (
          lookup_value: IntrinsicValue, 
          lookup_array: IntrinsicValue[][], 
          return_array: UnionValue,
          not_found?: UnionValue,
          match_mode = 0,
          search_mode = 1,
          ): UnionValue => {

        ////////

        if (!return_array) {
          return ArgumentError();
        }

        // const parse_result = this.parser.Parse(reference);
        // if (parse_result.error || !parse_result.expression) {
        //  return ReferenceError;
        //}

        let rng: Area|undefined;

        if (return_array.type === ValueType.array) {
          // console.info({return_array});

          const arr = return_array.value;
          const r = arr.length;
          const c = arr[0].length;

          const start = arr[0][0];
          const end = arr[r-1][c-1];

          if (UnionIsMetadata(start) && UnionIsMetadata(end)) {
            rng = new Area(start.value.address, end.value.address);
          }

        }

        if (!rng) {
          console.info('invalid range');
          return ReferenceError(); 
        }
        
        // console.info({rng});

        /*
        if (return_array.type === ValueType.array) {

          // subset array. this is constructed, so we can take ownership
          // and modify it, although it would be safer to copy. also, what's
          // the cost of functional vs imperative loops these days?

          const end_row = typeof height === 'number' ? (rows + height) : undefined;
          const end_column = typeof width === 'number' ? (columns + width) : undefined;

          const result: UnionValue = {
            type: ValueType.array,
            value: reference.value.slice(rows, end_row).map(row => row.slice(columns, end_column)),
          };

          return result;

        }
        */

        // FIXME: we could I suppose be more graceful about single values
        // if passed instead of arrays

        if (!Array.isArray(lookup_array)) {
          console.info("lookup is not an array");
          return ValueError();
        }

        const first = lookup_array[0];
        if (!Array.isArray(first)) {
          console.info("lookup is not a 2d array");
          return ValueError();
        }

        if (lookup_array.length !== 1 && first.length !== 1) {
          console.info("lookup array has invalid dimensions");
          return ValueError();
        }

        // FIXME: is it required that the return array be (at least) the 
        // same size? we can return undefineds, but maybe we should error

        /*
        if (!Array.isArray(return_array)) {
          console.info("return array is not an array");
          return ValueError();
        }
        */

        const transpose = (lookup_array.length === 1);
        if (transpose) {
          lookup_array = Utils.TransposeArray(lookup_array);
          // return_array = Utils.TransposeArray(return_array);
        }

        // maybe reverse...

        if (search_mode < 0) {
          lookup_array.reverse();
          // return_array.reverse();
        }

        //
        // return value at index, transpose if necessary, and return
        // an array. we might prefer to return a scalar if there's only 
        // one value, not sure what's the intended behavior
        // 
        const ReturnIndex = (rng: Area, index: number): UnionValue => {

          // console.info("transpose?", transpose, {rng}, 'shape', rng.rows, rng.columns);

          let start: UnitAddress|undefined;
          let end: UnitAddress|undefined;

          // I guess "transpose" in this context means "return a row from column(s)"? rename

          if (transpose) {
         
            if (search_mode < 0) {
              index = rng.rows - 1 - index; // invert FIXME: test
            }

            if (index >= 0 && index < rng.rows) {
              start = {
                type: 'address',
                position: 0, id: 1, label: '',
                row: rng.start.row + index,
                column: rng.start.column,
                sheet_id: rng.start.sheet_id,
              };

              end = {
                type: 'address',
                position: 0, id: 2, label: '',
                row: rng.start.row + index,
                column: rng.end.column,
                sheet_id: rng.start.sheet_id,
              };
            }

          }
          else {

            if (search_mode < 0) {
              index = rng.columns - 1 - index; // invert FIXME: test
            }

            if (index >= 0 && index < rng.columns) {
              start = {
                type: 'address',
                position: 0, id: 1, label: '',
                row: rng.start.row,
                column: rng.start.column + index,
                sheet_id: rng.start.sheet_id,
              };

              end = {
                type: 'address',
                position: 0, id: 2, label: '',
                row: rng.end.row,
                column: rng.start.column + index,
                sheet_id: rng.start.sheet_id,
              };
            }
          }

          if (start && end) {

            const expr: UnitRange = {
              type: 'range',
              position: 0,
              id: 0,
              label: '',
              start, end,
            };

            // console.info({expr});

            return {
              type: ValueType.object,
              value: expr,
            }
            
          }

          return { type: ValueType.undefined };

        };
      
        // if value is not a string, then we can ignore wildcards.
        // in that case convert to exact match.

        if (match_mode === 2 && typeof lookup_value !== 'string') {
          match_mode = 0;
        }

        // what does inexact matching mean in this case if the lookup
        // value is a string or boolean? (...)

        if ((match_mode === 1 || match_mode === -1) && typeof lookup_value === 'number') {

          let min_delta = 0;
          let index = -1;

          for (let i = 0; i < lookup_array.length; i++) {
            const value = lookup_array[i][0];
           

            if (typeof value === 'number') {

              // check for exact match first, just in case
              if (value === lookup_value) {
                return ReturnIndex(rng, i); 
              }

              const delta = Math.abs(value - lookup_value);

              if ((match_mode === 1 && value > lookup_value) || (match_mode === -1 && value < lookup_value)){
                if (index < 0 || delta < min_delta) {
                  min_delta = delta;
                  index = i;
                }
              }

            }
          }

          if (index >= 0) {
            return ReturnIndex(rng, index);
          }

        }
        
        switch (match_mode) {

          case 2:
            {
              // wildcard string match. we only handle strings for 
              // this case (see above).

              const pattern = Utils.ParseWildcards(lookup_value?.toString() || '');
              const regex = new RegExp('^' + pattern + '$', 'i'); //.exec(lookup_value);

              for (let i = 0; i < lookup_array.length; i++) {
                const value = lookup_array[i][0];
                if (typeof value === 'string' && regex.exec(value)) {
                  return ReturnIndex(rng, i);
                }
              }

            }
            break;

          case 0:
            if (typeof lookup_value === 'string') {
              lookup_value = lookup_value.toLowerCase();
            }
            for (let i = 0; i < lookup_array.length; i++) {
              let value = lookup_array[i][0];
 
              if (typeof value === 'string') {
                value = value.toLowerCase();
              }
              if (value === lookup_value) {
                return ReturnIndex(rng, i);
              }
            }

            break;
        }


        // FIXME: if we're expecting to return an array maybe we should
        // pack it up as an array? if it's not already an array? (...)

        return (not_found && not_found.type !== ValueType.undefined) ? not_found : NAError();

      },
    },


    /*
     * unsaid anywhere (that I can locate) aboud XLOOKUP is that lookup 
     * array must be one-dimensional. it can be either a row or a column,
     * but one dimension must be one. that simplifies things quite a bit.
     * 
     * there's a note in the docs about binary search over the data -- 
     * that might explain how inexact VLOOKUP works as well. seems an odd
     * choice but maybe back in the day it made sense
     * /
    XLOOKUP: {
      arguments: [
        { name: 'Lookup value', },
        { name: 'Lookup array',  },
        { name: 'Return array', address: true, },
        { name: 'Not found', boxed: true },
        { name: 'Match mode', default: 0, },
        { name: 'Search mode', default: 1, },
      ],
      return_type: 'reference',
      xlfn: true,
      fn: (
          lookup_value: IntrinsicValue, 
          lookup_array: IntrinsicValue[][], 
          return_array: string,
          not_found?: UnionValue,
          match_mode = 0,
          search_mode = 1,
          ): UnionValue => {

        console.info({return_array});
            

        // FIXME: we could I suppose be more graceful about single values
        // if passed instead of arrays
        
        if (!Array.isArray(lookup_array)) {
          console.info("lookup is not an array");
          return ValueError();
        }

        const first = lookup_array[0];
        if (!Array.isArray(first)) {
          console.info("lookip is not a 2d array");
          return ValueError();
        }

        if (lookup_array.length !== 1 && first.length !== 1) {
          console.info("lookup array has invalid dimensions");
          return ValueError();
        }

        // FIXME: is it required that the return array be (at least) the 
        // same size? we can return undefineds, but maybe we should error

        if (!Array.isArray(return_array)) {
          console.info("return array is not an array");
          return ValueError();
        }

        const transpose = (lookup_array.length === 1);
        if (transpose) {
          lookup_array = Utils.TransposeArray(lookup_array);
          return_array = Utils.TransposeArray(return_array);
        }

        // maybe reverse...

        if (search_mode < 0) {
          lookup_array.reverse();
          return_array.reverse();
        }

        //
        // return value at index, transpose if necessary, and return
        // an array. we might prefer to return a scalar if there's only 
        // one value, not sure what's the intended behavior
        // 
        const ReturnIndex = (index: number): UnionValue => {

          const values = return_array[index];

          if (!values) {
            return { type: ValueType.undefined };
          }
          
          if (!Array.isArray(values)) {
            return Box(values);
          }

          let boxes = [values.map(value => Box(value))];
          
          if (transpose) {
            boxes = Utils.TransposeArray(boxes);
          }

          return {
            type: ValueType.array,
            value: boxes,
          }

        };
      
        // if value is not a string, then we can ignore wildcards.
        // in that case convert to exact match.

        if (match_mode === 2 && typeof lookup_value !== 'string') {
          match_mode = 0;
        }

        // what does inexact matching mean in this case if the lookup
        // value is a string or boolean? (...)

        if ((match_mode === 1 || match_mode === -1) && typeof lookup_value === 'number') {

          let min_delta = 0;
          let index = -1;

          for (let i = 0; i < lookup_array.length; i++) {
            const value = lookup_array[i][0];
           

            if (typeof value === 'number') {

              // check for exact match first, just in case
              if (value === lookup_value) {
                return ReturnIndex(i); 
              }

              const delta = Math.abs(value - lookup_value);

              if ((match_mode === 1 && value > lookup_value) || (match_mode === -1 && value < lookup_value)){
                if (index < 0 || delta < min_delta) {
                  min_delta = delta;
                  index = i;
                }
              }

            }
          }

          if (index >= 0) {
            return ReturnIndex(index);
          }

        }
        
        switch (match_mode) {

          case 2:
            {
              // wildcard string match. we only handle strings for 
              // this case (see above).

              const pattern = Utils.ParseWildcards(lookup_value?.toString() || '');
              const regex = new RegExp('^' + pattern + '$', 'i'); //.exec(lookup_value);

              for (let i = 0; i < lookup_array.length; i++) {
                const value = lookup_array[i][0];
                if (typeof value === 'string' && regex.exec(value)) {
                  return ReturnIndex(i);
                }
              }

            }
            break;

          case 0:
            if (typeof lookup_value === 'string') {
              lookup_value = lookup_value.toLowerCase();
            }
            for (let i = 0; i < lookup_array.length; i++) {
              let value = lookup_array[i][0];
 
              if (typeof value === 'string') {
                value = value.toLowerCase();
              }
              if (value === lookup_value) {
                return ReturnIndex(i);
              }
            }

            break;
        }


        // FIXME: if we're expecting to return an array maybe we should
        // pack it up as an array? if it's not already an array? (...)

        return (not_found && not_found.type !== ValueType.undefined) ? not_found : NAError();

      },
    },
    */

    /**
     * copied from HLOOKUP, fix that one first
     */
    HLookup: {
      arguments: [...zlookup_arguments],
      fn: (value: number|boolean|string|undefined, table: (number|boolean|string|undefined)[][], col: number, inexact = true): UnionValue => {
        return ZLookup(value, table, col, inexact, true);
      },
    },

    /**
     * FIXME: does not implement inexact matching (what's the algo for
     * that, anyway? nearest? price is right style? what about ties?)
     */
    VLookup: {
      arguments: [...zlookup_arguments],
      fn: (value: number|boolean|string|undefined, table: (number|boolean|string|undefined)[][], col: number, inexact = true): UnionValue => {
        return ZLookup(value, table, col, inexact, false);
      },
    },

    Product: {
      arguments: [{boxed: true}],
      fn: (...args: UnionValue[]): UnionValue => {

        let product: Complex = { real: 1, imaginary: 0 };

        args = Utils.FlattenBoxed(args);

        for (const arg of args as UnionValue[]) {
          if (arg.type === ValueType.complex) {
            product = ComplexMultply(product, arg.value);
          }
          else if (arg.type === ValueType.number) {
            product.real *= arg.value;
            product.imaginary *= arg.value;
          }
        }

        return ComplexOrReal(product);

        /*
        return { type: ValueType.number, value: Utils.Flatten(args).reduce((a: number, b: any) => {
          if (typeof b === 'undefined') return a;
          return a * Number(b);
        }, 1) };
        */

      },
    },

    Log: {
      arguments: [ { unroll: true }, { unroll: true } ], 

      /** default is base 10; allow specific base */
      fn: (a: number, base = 10): UnionValue => {
        return { type: ValueType.number, value: Math.log(a) / Math.log(base) };
      },
    },

    Log10: {
      arguments: [{ unroll: true }], 
      fn: (a: number): UnionValue => {
        return { type: ValueType.number, value: Math.log(a) / Math.log(10) };
      },
    },

    Ln: {
      arguments: [{ unroll: true }], 
      fn: (a: number): UnionValue => {
        return { type: ValueType.number, value: Math.log(a) };
      },
    },

    Ceiling: {
      arguments: [ { unroll: true }, { unroll: true } ], // FIXME: lazy

      fn: (a: number) => {
        return { 
          type: ValueType.number, 
          value: Math.ceil(a),
        };
      },
    },

    Round: {
      arguments: [ { unroll: true }, { unroll: true } ], // FIXME: lazy

      fn: (a, digits = 0) => {
        const m = Math.pow(10, digits);
        return { 
          type: ValueType.number, 
          value: Math.round(m * a) / m,
        };
      },
    },

    RoundDown: {
      arguments: [ { unroll: true }, { unroll: true } ], // FIXME: lazy

      fn: (a, digits = 0) => {
        const m = Math.pow(10, digits);
        const positive = a >= 0;
        return { 
          type: ValueType.number, 
          value: positive ? Math.floor(m * a) / m : Math.ceil(m * a) / m,
        };
      },
    },

    RoundUp: {
      arguments: [ { unroll: true }, { unroll: true } ], // FIXME: lazy

      fn: (a, digits = 0) => {
        const m = Math.pow(10, digits);
        const positive = a >= 0;
        return { 
          type: ValueType.number, 
          value: positive ? Math.ceil(m * a) / m : Math.floor(m * a) / m,
        };
      },
    },

    /*

    Round: {
      description: 'Round to a specified number of digits',

      / ** round with variable digits * /
      fn: (value: number, digits = 0) => {
        const m = Math.pow(10, digits);
        return Math.round(m * value) / m;
      },
    },

    RoundDown: {
      / ** round down with variable digits * /
      fn: (value: number, digits = 0) => {
        digits = Math.max(0, digits);
        const m = Math.pow(10, digits);
        return Math.floor(m * value) / m;
      },
    },


    */


    Reverse: {
      arguments: [
        { boxed: true },
      ],
      fn: (a: UnionValue): UnionValue => {

        /*

        what is this? this would do anything useful
        ...oh I see, it reverses along one axis or the other

        if ( Array.isArray(a)) {
          if (a.length === 1 ) return [a[0].reverse()];
          return a.reverse();
        }
        */

        if (a.type === ValueType.array) {
          if (a.value.length === 1) {
            a.value[0].reverse();
          }
          else {
            a.value.reverse();
          }
          return a;
        }

        return { 
          type: ValueType.string, 
          value: (a.value??'').toString().split('').reverse().join(''),
        };
      },
    },
    
    /**
     * exp was not broken out, but added so we can support complex numbers.
     */
    Exp: {
      arguments: [
        { boxed: true, unroll: true },
      ],
      fn: (x: UnionValue) => {
        
        if (x.type === ValueType.complex) {
          const value = ComplexExp(x.value);
          return ComplexOrReal(value);
        }

        if (x.type !== ValueType.number) {
          return ValueError();
        }

        return { type: ValueType.number, value: Math.exp(x.value) };
      },
    },

    /**
     * abs was already broken out so we could support array application,
     * then updated to support complex numbers.
     */
    Abs: {
      arguments: [
        { boxed: true, unroll: true },
      ],
      fn: (a: UnionValue) => {
        if (a.type === ValueType.complex) {
          return { 
            type: ValueType.number, 
            value: Math.sqrt(a.value.real * a.value.real + a.value.imaginary * a.value.imaginary), 
          };
        }

        if (a.type !== ValueType.number) {
          return ValueError();
        }

        return { type: ValueType.number, value: Math.abs(a.value || 0) };
      },
    },

    Simplify: {
      arguments: [
        { name: 'value', unroll: true, }, 
        { name: 'significant digits', unroll: true, },
      ],
      fn: (value: number, significant_digits = 2): UnionValue => {
        significant_digits = significant_digits || 2;
        if (value === 0) {
          return { type: ValueType.number, value };
        }
        const negative = value < 0 ? -1 : 1;
        value *= negative;
        const x = Math.pow(10, Math.floor(Math.log10(value)) + 1 - significant_digits);
        return {
          type: ValueType.number,
          value: Math.round(value / x) * x * negative
        };
      },
    },
 
    Erf: {
      fn: (a: number): UnionValue => {
        return { type: ValueType.number, value: erf(a) };
      },
    },

    'NormsInv': {
      
      description: 'Inverse of the normal cumulative distribution', 
      arguments: [
        {name: 'probability'},
      ],

      fn: (q: number): UnionValue => {
        return {
          type: ValueType.number,
          value: inverse_normal(q),
        }
      }
    },

    'Norm.Inv': {
      description: 'Inverse of the normal cumulative distribution', 
      arguments: [
        {name: 'probability'},
        {name: 'mean', default: 0},
        {name: 'standard deviation', default: 1},
      ],
      xlfn: true,
      fn: (q: number, mean = 0, stdev = 1): UnionValue => {
        return {
          type: ValueType.number,
          value: inverse_normal(q) * stdev + mean,
        }
      }
    },

    'Norm.S.Inv': {
      description: 'Inverse of the normal cumulative distribution', 
      arguments: [
        {name: 'probability'},
        {name: 'mean', default: 0},
        {name: 'standard deviation', default: 1},
      ],
      xlfn: true,
      fn: (q: number, mean = 0, stdev = 1): UnionValue => {
        return {
          type: ValueType.number,
          value: inverse_normal(q) * stdev + mean,
        }
      }
    }, 

    'Norm.Dist': {

      description: 'Cumulative normal distribution',
      arguments: [
        {name: 'value'},
        {name: 'mean', default: 0},
        {name: 'standard deviation', default: 1},
        {name: 'cumulative', default: true},
      ],

      // this does need xlfn but it also requires four parameters
      // (we have three and they are not required).
      
      xlfn: true,

      fn: (x: number, mean = 0, stdev = 1, cumulative = true): UnionValue => {
        return { type: ValueType.number, value: norm_dist(x, mean, stdev, cumulative) };
      },
    },

    'Norm.S.Dist': {

      description: 'Cumulative normal distribution',
      arguments: [
        {name: 'value'},
        {name: 'cumulative', default: true},
      ],

      xlfn: true,

      fn: (x: number, cumulative = true): UnionValue => {
        return { type: ValueType.number, value: norm_dist(x, 0, 1, cumulative) };
      },
    },

    Sqrt: {
      description: 'Returns the square root of the argument',
      arguments: [
        { boxed: true, unroll: true },
      ],
      fn: (ref: UnionValue): UnionValue => {

        // little bit torn on this. what should sqrt(-1) return? a complex 
        // number, or NaN? or should we control that with a flag? 

        // UPDATE: now optional, see AltFunctionLibrary

        if (ref.type === ValueType.complex) {
          const value = ComplexPower(ref.value, {real: 0.5, imaginary: 0});
          return ComplexOrReal(value);
        }
        else if (ref.type === ValueType.undefined || !ref.value) {
          return {
            type: ValueType.number, value: 0,
          }
        }
        /*
        else if (ref.type === ValueType.number && ref.value < 0) {
          const value = ComplexPower({real: ref.value, imaginary: 0}, {real: 0.5, imaginary: 0});
          return {
            type: ValueType.complex,
            value,
          }
        }
        */
        else if (ref.type === ValueType.number) {
          return { 
            type: ValueType.number, value: Math.sqrt(ref.value),
          };
        }

        return ValueError();

        /*
        else {
          const value = Math.sqrt(ref.value);
          if (isNaN(value)) {
            return ValueError();
          }
          return { type: ValueType.number, value };
        }
        */
      },
    },

    HexToDec: {
      arguments: [{ description: 'hexadecimal string', unroll: true }],
      fn: (hex: string): UnionValue => {
        return { type: ValueType.number, value: parseInt(hex, 16) };
      },
    },

    DecToHex: {
      arguments: [{ description: 'number', unroll: true }],
      fn: (num: number): UnionValue => {
        return { type: ValueType.string, value: num.toString(16) };
      },
    },

    Checkbox: {
      arguments: [
        { name: 'checked' },
      ],
      click: ClickCheckbox,
      render: RenderCheckbox,
      fn: (checked: boolean): UnionValue => {
        return { value: !!checked, type: ValueType.boolean, }
      },
    },

    'Sparkline.Column': {
      arguments: [
        {name: 'data' }, 
        {name: 'color'}, 
        {name: 'negative color'}],
      render: (options: RenderFunctionOptions): RenderFunctionResult => {
        Sparkline.RenderColumn(options.width, options.height, options.context, options.cell, options.style);
        return { handled: true }; // painted
      },
      fn: (...args: unknown[]): UnionValue => {
        return { type: ValueType.object, value: args, key: 'sparkline-data' };
      },
    },

    'Sparkline.Line': {
      arguments: [
        {name: 'data'}, 
        {name: 'color'},
        {name: 'line width'},
      ],
      render: (options: RenderFunctionOptions): RenderFunctionResult => {
        Sparkline.RenderLine(options.width, options.height, options.context, options.cell, options.style);
        return { handled: true }; // painted
      },
      fn: (...args: unknown[]): UnionValue => {
        return { type: ValueType.object, value: args, key: 'sparkline-data' };
      },
    },

    UniqueValues: {
      arguments: [
        { name: 'range', boxed: true },
      ],
      visibility: 'internal',
      fn: (area: UnionValue): UnionValue => {

        if (area.type === ValueType.array) {

          // const cols = area.value.length;
          // const rows = area.value[0]?.length;

          // how is uniqueness defined in this context? (...)

          const Normalize = (cell?: UnionValue): string|number|boolean => {

            if (!cell) {
              return '';
            }
            else switch (cell.type) {
            case ValueType.string:
            case ValueType.number:
            case ValueType.boolean:
              return cell.value;

            case ValueType.undefined:
              return '';

            default:
              console.info("check", cell, cell.value)
              return cell.value?.toString() || '';
            }

          };

          const set: Set<number|string|boolean> = new Set();
          const duplicates: Set<number|string|boolean> = new Set();

          for (const column of area.value) {
            for (const cell of column) {
              const normalized = Normalize(cell);
              if (set.has(normalized)) {
                duplicates.add(normalized);
              }
              else {
                set.add(normalized);
              }
            }
          }

          const result: UnionValue[][] = [];
          for (const column of area.value) {
            const column_result: UnionValue[] = [];
            for (const cell of column) {
              const value = Normalize(cell);
              column_result.push({
                type: ValueType.boolean,
                value: !duplicates.has(value),
              });
            }
            result.push(column_result);
          }

          return {
            type: ValueType.array,
            value: result,
          };

        }

        // if it's not an array, by definition it's unique

        return {
          type: ValueType.boolean,
          value: true,
        }

      },
    },

    Gradient: {
      arguments: [
        { name: 'range', boxed: true },
        { name: 'min', },
        { name: 'max', },
      ],
      visibility: 'internal',
      fn: (area: UnionValue, static_min?: number, static_max?: number): UnionValue => {

        const tmp = Utils.FlattenBoxed([area]);

        // let sum = 0;
        let count = 0;
        let min = 0; 
        let max = 0;

        for (const ref of tmp as UnionValue[]) {
          if (ref.type === ValueType.error) {
            return ref;
          }
          if (ref.type === ValueType.number) {
            if (count === 0) {
              min = ref.value;
              max = ref.value;
            }
            else {
              min = Math.min(min, ref.value);
              max = Math.max(max, ref.value);
            }
            count++;
          }
        }

        if (typeof static_max === 'number') {
          max = static_max;
        }
        if (typeof static_min === 'number') {
          min = static_min;
        }

        const range = max - min;

        let rows = 1;
        let columns = 1;

        if (area.type === ValueType.array) {

          rows = area.value.length;
          columns = area.value[0]?.length || 0;

          const result: UnionValue[][] = [];

          for (let r = 0; r < rows; r++) {
            const row: UnionValue[] = [];
            for (let c = 0; c < columns; c++) {
              const src = area.value[r][c];
              if (src.type === ValueType.number) {
                let calc = 0;

                // special case: max === min. this can be used to do binary 
                // coloring over a set of data (ignoring the pivot).

                // FIXME: use a separate loop?

                if (max === min) {
                  if (src.value > max) {
                    calc = 1;
                  }
                  else if (src.value < max) {
                    calc = 0;
                  }
                  else {
                    calc = 0.5
                  }
                }
                else if (range > 0) {
                  calc = (src.value - min) / range;
                }
                row.push({ type: ValueType.number, value: calc });
              }
              else {
                row.push({ type: ValueType.undefined });
              }

            }
            result.push(row);
          }
  
          return { type: ValueType.array, value: result };
  

        }
        else {
          return ArgumentError();
        }
  
      },
    },

    Sin: {
      arguments: [
        { name: 'angle in radians', boxed: true, unroll: true, }
      ],
      fn: (a: UnionValue) => {

        if (a.type === ValueType.number) {
          return { type: ValueType.number, value: Math.sin(a.value) };
        }
        if (a.type === ValueType.complex) {
          return { type: ValueType.complex, value: ComplexMath.Sin(a.value) }; 
        }

        return ArgumentError();

      },
    },

    Cos: {
      arguments: [
        { name: 'angle in radians', boxed: true, unroll: true, }
      ],
      fn: (a: UnionValue) => {

        if (a.type === ValueType.number) {
          return { type: ValueType.number, value: Math.cos(a.value) };
        }
        if (a.type === ValueType.complex) {
          return { type: ValueType.complex, value: ComplexMath.Cos(a.value) }; 
        }

        return ArgumentError();

      },
    },
    
    Tan: {
      arguments: [
        { name: 'angle in radians', boxed: true, unroll: true, }
      ],
      fn: (a: UnionValue) => {

        if (a.type === ValueType.number) {
          return { type: ValueType.number, value: Math.tan(a.value) };
        }
        if (a.type === ValueType.complex) {
          return { type: ValueType.complex, value: ComplexMath.Tan(a.value) }; 
        }

        return ArgumentError();

      },
    },

    Sequence: {
      arguments:[
        { name: 'rows', boxed: true },
        { name: 'columns', default: 1, boxed: true },
        { name: 'start', default: 1, boxed: true },
        { name: 'step', default: 1, boxed: true }
      ],
      fn: (rows: UnionValue, columns: UnionValue, start: UnionValue, step: UnionValue) => {

        const rx = NumberArgument(rows, 1);
        const cx = NumberArgument(columns, 1);
        const step_ = NumberArgument(step, 1);
        const start_ = NumberArgument(start, 1);

        if (rx === false || cx === false || step_ === false || start_ === false) {
          return ArgumentError();
        }

        const value: UnionValue[][] = [];
        for (let c = 0; c < cx; c++) {
          const col: UnionValue[] = [];
          for (let r = 0; r < rx; r++) {
            col.push({ type: ValueType.number, value: start_ + r * step_ * cx + c * step_ });
          }
          value.push(col);
        }

        return { type: ValueType.array, value };

      },

    },


};

// alias

// add functions from Math (intrinsic), unless the name overlaps
// with something already in there

// we need to construct a separate map to match icase (this is now
// even more useful since we have a separate section for aliases)

const name_map: {[index: string]: string} = {};

for (const key of Object.keys(BaseFunctionLibrary)) {
  name_map[key.toLowerCase()] = key;
}

// block these names from auto-import from Math

const block_list = [
  'pow', 
];

const block_map: Record<string, string> = {};
for (const entry of block_list) {
  block_map[entry.toLowerCase()] = entry;
}

for (const name of Object.getOwnPropertyNames(Math)) {

  // check if it exists (we have already registered something
  // with the same name) -- don't override existing

  const lc = name.toLowerCase();

  if (name_map[lc]) { continue; }

  // also explicitly block some names we don't want to include (pow vs. power, etc)

  if (block_map[lc]) { continue; }

  const descriptor = Object.getOwnPropertyDescriptor(Math, name);
  if (!descriptor) { continue; }

  const value = descriptor.value;
  const type = typeof (value);

  switch (type) {
  case 'number':
    // console.info("MATH CONSTANT", name);
    BaseFunctionLibrary[name] = {
      fn: () => { 
        return { type: ValueType.number, value }
      },
      category: ['Math Functions'],
    };
    break;

  case 'function':
    // console.info("MATH FUNC", name);
    BaseFunctionLibrary[name] = {
      // description: 'Math function',
      fn: (...args: unknown[]) => {
        return Box(value(...args));
      },
      category: ['Math Functions'],
    };
    break;

  default:
    console.info('unexpected type:', type, name);
    break;
  }

}

// IE11: patch log10 function // FIXME: is this necessary anymore?

if (!Math.log10) {
  Math.log10 = (a) => Math.log(a) / Math.log(10);
  /*
  BaseFunctionLibrary.log10 = {
    fn: (x) => Math.log(x) / Math.log(10),
    category: ['Math Functions'],
  };
  */
}
