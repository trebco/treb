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

import type { FunctionMap } from '../descriptors';
import * as Utils from '../utilities';
import { ValueError, ArgumentError, NAError } from '../function-error';
import { type Complex, type UnionValue, ValueType, type CellValue } from 'treb-base-types';
import * as ComplexMath from '../complex-math';

const Median = (data: number[]) => {
  const n = data.length;
  if (n % 2) {
    return data[Math.floor(n/2)];
  }
  else {
    return (data[n/2] + data[n/2 - 1])/2;
  }
};

const InterpolatedQuartiles = (data: number[], include_median = true) => {

  data.sort((a, b) => a - b);
  const n = data.length;
 
  const interp = (p: number, base: number, skip: number) => {
    const index = base * p + skip;
    const offset = index % 1;
    if (offset) {
      const a = data[Math.floor(index)];
      const b = data[Math.ceil(index)];
      return a + (b - a) * offset;
    }
    else {
      return data[index];
    }
      
  }

  if (include_median) {
    return [data[0], interp(.25, n - 1, 0), Median(data), interp(.75, n - 1, 0), data[n-1]];
  }
  else {
    if (n % 1) {
      return [data[0], interp(.25, n - 2, 0), Median(data), interp(.75, n - 2, 1), data[n-1]];
    }
    else {
      return [data[0], interp(.25, n - 3, 0), Median(data), interp(.75, n - 3, 2), data[n-1]];
    }
  }

};

const Gamma = (z: Complex): Complex => {

  // this is a Lanczos approximation. could be cleaned up.

  const coefficients = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  // generally speaking I'm against operator overloading but 
  // it would be a big help for complex math

  const pi = Math.PI;
  const sin = ComplexMath.Sin;
  const div = ComplexMath.Divide;
  const mul = ComplexMath.Multiply;
  const cpx = (a: number) => ({ real: a, imaginary: 0 });
  const add = (a: Complex, b: Complex): Complex => ({ real: a.real + b.real, imaginary: a.imaginary + b.imaginary });
  const pow = ComplexMath.Power;
  const exp = ComplexMath.Exp;
  const inv = (a: Complex) => ({ real: -a.real, imaginary: -a.imaginary });
  const prod = ComplexMath.Product;

  if (z.real < 0.5) {
    return div(cpx(pi), mul(sin(mul(cpx(pi), z)), Gamma({ real: 1 - z.real, imaginary: -z.imaginary })));
  }

  z.real -= 1;
  let x = cpx(coefficients[0]);

  for (let i = 1; i < coefficients.length; i++) {
    x = add(x, div(cpx(coefficients[i]), add(z, cpx(i))));
  }

  const t = add(z, cpx(7.5));
  return prod(cpx(Math.sqrt(2 * pi)), pow(t, add(z, cpx(0.5))), exp(inv(t)), x);

};

export const Variance = (data: number[], sample = false) => {

  const len = data.length;
  
  let m = 0;
  let v = 0;
  // let k = 0;
  // let s = 0;

  for (let i = 0; i < len; i++) m += data[i];

  m /= len;
  // const mean = m;

  for (let i = 0; i < len; i++) {
    const d = data[i] - m;
    v += (d * d);
    // s += (d * d * d);
    // k += (d * d * d * d);
  }

  // const N = len;
  // const variance = v / len;
  // const stdev = Math.sqrt(v / len);
  return sample ? (v / (len-1)) : (v/len);

};

export const StatisticsFunctionLibrary: FunctionMap = {

  'StDev.P': {
    description: 'Returns the standard deviation of a set of values, corresponding to a population',
    arguments: [{ name: 'data', }],
    fn: (...args: CellValue[]): UnionValue => {
      return { type: ValueType.number, value: Math.sqrt(Variance(Utils.FlattenNumbers(args), false)) };
    },
  },

  'StDev.S': {
    description: 'Returns the standard deviation of a set of values, corresponding to a sample of a population',
    arguments: [{ name: 'data', }],
    fn: (...args: CellValue[]): UnionValue => {
      return { type: ValueType.number, value: Math.sqrt(Variance(Utils.FlattenNumbers(args), true)) };
    },
  },

  'Var.P': {
    description: 'Returns the variance of a set of values, corresponding to a population',
    arguments: [{ name: 'data', }],
    fn: (...args: CellValue[]): UnionValue => {
      return { type: ValueType.number, value: Variance(Utils.FlattenNumbers(args), false) };
    },
  },

  'Var.S': {
    description: 'Returns the variance of a set of values, corresponding to a sample of a population',
    arguments: [{ name: 'data', }],
    fn: (...args: CellValue[]): UnionValue => {
      return { type: ValueType.number, value: Variance(Utils.FlattenNumbers(args), true) };
    },
  },

  Covar: {
    description: 'Returns the covariance between two ranges of values',
    arguments: [{
      name: 'A',
    }, {
      name: 'B',
    }],
    fn: (x: number[][], y: number[][]): UnionValue => {

      // both must be 2d arrays, we're assuming the same or mostly similar shape
      if (!Array.isArray(x) || !Array.isArray(y)) { return ValueError(); }
      if (!Array.isArray(x[0]) || !Array.isArray(y[0])) { return ValueError(); }

      if (x.length !== y.length) {
        return ArgumentError();
      }

      let sum = 0;
      let length = 0;

      const mean = { x: 0, y: 0 };
      const data: { x: number[], y: number[] } = { x: [], y: [] };

      for (let j = 0; j < x.length; j++) {

        if (!x[j] || !y[j]) { continue; }
        if (x[j].length !== y[j].length) {
          return ArgumentError();
        }
        
        const len = x[j].length;
        length += len;

        for (let i = 0; i < len; i++) {
          mean.x += (x[j][i] || 0);
          mean.y += (y[j][i] || 0);

          data.x.push(x[j][i] || 0);
          data.y.push(y[j][i] || 0);
        }

      }

      if (length === 0) {
        return NAError();
      }

      mean.x /= length;
      mean.y /= length;

      for (let i = 0; i < length; i++) {
        sum += (data.x[i] - mean.x) * (data.y[i] - mean.y);
      }

      return { type: ValueType.number, value: sum / length, };

    },
  },

  Correl: {
    description: 'Returns the correlation between two ranges of values',
    arguments: [{
      name: 'A',
    }, {
      name: 'B',
    }],
    fn: (x: number[][], y: number[][]): UnionValue => {

      // both must be 2d arrays, we're assuming the same or mostly similar shape
      if (!Array.isArray(x) || !Array.isArray(y)) { return ValueError(); }
      if (!Array.isArray(x[0]) || !Array.isArray(y[0])) { return ValueError(); }
      
      let rslt = 0;
      let sumProduct = 0;
      let sumX = 0;
      let sumY = 0;
      let sumSquaredX = 0;
      let sumSquaredY = 0;
      let count = 0;

      for (let j = 0; j < x.length; j++) {
        if (!x[j] || !y[j]) { continue; }

        const len = x[j].length;
        for (let i = 0; i < len; i++) {
          const a = Number(x[j][i]);
          const b = Number(y[j][i]);

          if (isNaN(a) || isNaN(b)) { continue; }

          sumProduct += (a * b);
          sumX += a;
          sumY += b;
          sumSquaredX += (a * a);
          sumSquaredY += (b * b);
          count++;
        }
      }
  
      rslt = ((count * sumProduct) - (sumX * sumY));
      if (rslt) {
        rslt /= Math.sqrt(((count * sumSquaredX) - (sumX * sumX)) * ((count * sumSquaredY) - (sumY * sumY)));
      }
  
      return { type: ValueType.number, value: rslt };

    },
  },

  GeoMean: {

    description: 'Returns the geometric mean of all numeric arguments',
    arguments: [{ boxed: true }],

    fn: (...args: UnionValue[]): UnionValue => {

      args = Utils.FlattenBoxed(args); 

      let count = 0;
      let product: Complex = {real: 1, imaginary: 0};
      let complex = false;
      let negative = false;

      for (const arg of args) {
        
        if (arg.type === ValueType.complex) {
          complex = true;
          product = ComplexMath.Multiply(product, arg.value);
          count++;
        }
        else if (arg.type === ValueType.number) {
          if (arg.value < 0) {
            negative = true;
          }
          count++;
          // product = ComplexMath.Multiply(product, {real: arg.value, imaginary: 0});
          product.real *= arg.value;
          product.imaginary *= arg.value;

        }

      }

      if (complex) {
        const value = ComplexMath.Power(product, {real: 1/count, imaginary: 0});
        if (value.imaginary) {
          return { type: ValueType.complex, value };
        }
        return { type: ValueType.number, value: value.real };
      }
      else {
        if (negative) {
          return ValueError();
        }
        return { type: ValueType.number, value: Math.pow(product.real, 1 / count) };
      }

      /*
      for (const arg of args) {
        if (typeof arg === 'undefined') { continue; }
        const value = Number(arg);
        if (value < 0) { return ValueError(); }
        count++;
        product *= value;
      }
      return { type: ValueType.number, value: Math.pow(product, 1 / count) };
      */



    },
  },

  LCM: {
    description: 'Retuns the least common mulitple of the arguments',
    arguments: [{ boxed: true }],
    fn: (...args: UnionValue[]): UnionValue => {
      args = Utils.FlattenBoxed(args);
      const list: number[] = [];

      for (const ref of args as UnionValue[]) {
        if (ref.type === ValueType.error) {
          return ref;
        }
        if (ref.type === ValueType.number) {
          list.push(ref.value);
        }
        else if (ref.type !== ValueType.undefined ) {
          console.info("RT", ref.type);
          return ArgumentError();
        }
      }

      const gcd = (x: number, y: number): number => {
        if (x % y == 0) {
          return y;               // Base case
        }
        else {
          return gcd(y, x % y);   // Recusrsive case
        }
      };

      if (list.length === 0) {
        return { type: ValueType.number, value: 0 };
      }

      let lcm = list[0];

      for (let i = 1; i < list.length; i++) {
        lcm = (lcm * list[i]) / gcd(lcm, list[i]);
      }

      return {
        type: ValueType.number,
        value: lcm,
      }

    },
  },

  Gamma: {
    description: 'Returns the gamma function for the given value',
    arguments: [{ name: 'value', boxed: true }],
    fn: (value: UnionValue) => {

      let complex: Complex = { real: 0, imaginary: 0 };

      if (value.type === ValueType.complex) {
        complex = {...value.value};
      }
      else if (value.type === ValueType.number) {
        complex.real = value.value;
      }
      else {
        return ArgumentError();
      }

      if (complex.imaginary === 0 && complex.real % 1 === 0 && complex.real <= 0) {
        return ValueError();
      }

      const gamma = Gamma(complex);

      if (Math.abs(gamma.imaginary) <= 1e-7) {
        return { type: ValueType.number, value: gamma.real };
      }

      return {type: ValueType.complex, value: gamma};
      
    },
  },

  Delta: {
    arguments: [{ name: 'number', }, { name: 'number', default: 0 }],
    fn: (a: CellValue, b: CellValue = 0) => {
      if (typeof a !== 'number' || typeof b !== 'number') {
        return ValueError();
      }
      return { type: ValueType.number, value: (a === b) ? 1 : 0 };
    },
  },

  GCD: {
    description: 'Finds the greatest common divisor of the arguments',
    arguments: [{ boxed: true }],
    fn: (...args: UnionValue[]): UnionValue => {
      args = Utils.FlattenBoxed(args);
      const list: number[] = [];

      for (const ref of args as UnionValue[]) {
        if (ref.type === ValueType.error) {
          return ref;
        }
        if (ref.type === ValueType.number) {
          list.push(ref.value);
        }
        else if (ref.type !== ValueType.undefined ) {
          console.info("RT", ref.type);
          return ArgumentError();
        }
      }

      const gcd = (x: number, y: number): number => {
        if (x % y == 0) {
          return y;               // Base case
        }
        else {
          return gcd(y, x % y);   // Recusrsive case
        }
      };

      if (list.length === 0) {
        return ValueError();
      }

      if (list.length === 1) {
        return {
          type: ValueType.number, 
          value: list[0],
        };
      }

      let value = list[0];
      for (let i = 1; i < list.length; i++) {
        value = gcd(value, list[i]);
      }
      
      return {
        type: ValueType.number,
        value,
      };


    }
  },

  HarMean: {
    description: 'Returns the harmonic mean of the arguments',
    arguments: [{ boxed: true }],
    fn: (...args: UnionValue[]): UnionValue => {
      args = Utils.FlattenBoxed(args);
      const result = { real: 0, imaginary: 0 };
      let count = 0;

      for (const ref of args as UnionValue[]) {
        if (ref.type === ValueType.error) {
          return ref;
        }
        if (ref.type === ValueType.number) {
          result.real += (1/ref.value);
          count++;
        }
        if (ref.type === ValueType.complex) {
          const reciprocal = ComplexMath.Divide({real: 1, imaginary: 0}, ref.value);
          result.real += reciprocal.real;
          result.imaginary += reciprocal.imaginary;
          count++;
        }
      }

      if (result.imaginary) {
        return { type: ValueType.complex, value: ComplexMath.Divide({real: count, imaginary: 0}, result), };
      }

      return { type: ValueType.number, value: count/result.real };

    },
  },

  Average: {

    description: 'Returns the arithmetic mean of all numeric arguments',
    arguments: [{ boxed: true }],

    fn: (...args: UnionValue[]): UnionValue => {
      args = Utils.FlattenBoxed(args);

      const result = { real: 0, imaginary: 0 };
      let count = 0;

      for (const ref of args as UnionValue[]) {
        if (ref.type === ValueType.error) {
          return ref;
        }
        if (ref.type === ValueType.number) {
          result.real += ref.value;
          count++;
        }
        if (ref.type === ValueType.complex) {
          result.real += ref.value.real;
          result.imaginary += ref.value.imaginary;
          count++;
        }
      }

      result.real /= count;
      result.imaginary /= count;
      
      if (result.imaginary) {
        return { type: ValueType.complex, value: result, };
      }
      return { type: ValueType.number, value: result.real };

    },
  },

  Percentile: {
    description: 'Returns the kth percentile value from the range of data',
    arguments: [
      { name: 'range' },
      { name: 'percentile' },
    ],
    fn: (range: number[][], percentile: number): UnionValue => {

      // const flat = Utils.FlattenCellValues(range).filter((test): test is number => typeof test === 'number');
      const flat = Utils.FlattenNumbers(range);

      flat.sort((a, b) => a - b);
      const n = flat.length;

      // try to stabilize this number
      const factor = Math.pow(10,8);
      const x = Math.round((1 + (n-1) * percentile) * factor)/factor;

      const lo = Math.floor(x);
      const hi = Math.ceil(x);

      return { type: ValueType.number, value: (flat[lo-1] + flat[hi-1]) / 2 };

    },
  },

  'Quartile.Inc': {
    description: 'Returns the interpolated quartile of the data set (including median)', 
    arguments: [
      { name: 'range', },
      { name: 'quartile' }, 
    ],
    xlfn: true,
    fn: (data: CellValue[], quartile: CellValue) => {

      if (typeof quartile !== 'number' || quartile < 0 || quartile > 4 || quartile % 1) {
        return ArgumentError();
      }

      const flat = Utils.FlattenNumbers(data);
      const quartiles = InterpolatedQuartiles(flat, true);
     
      return { type: ValueType.number, value: quartiles[quartile] };
    }
  },

  'Quartile.Exc': {
    description: 'Returns the interpolated quartile of the data set (excluding median)', 
    arguments: [
      { name: 'range', },
      { name: 'quartile' }, 
    ],
    xlfn: true,
    fn: (data: CellValue[], quartile: CellValue) => {

      if (typeof quartile !== 'number' || quartile < 1 || quartile > 3 || quartile % 1) {
        return ArgumentError();
      }

      const flat = Utils.FlattenNumbers(data);
      const quartiles = InterpolatedQuartiles(flat, false);
     
      return { type: ValueType.number, value: quartiles[quartile] };
    }
  },

  Median: {
    description: 'Returns the median value of the range of data',
    arguments: [
      { name: 'range' },
    ],
    fn: (...args: number[]): UnionValue => {

      // const flat = Utils.FlattenCellValues(args).filter((test): test is number => typeof test === 'number');
      const flat = Utils.FlattenNumbers(args);

      flat.sort((a, b) => a - b);
      const n = flat.length;

      const x = 1 + (n-1) * .5;
      const lo = Math.floor(x);
      const hi = Math.ceil(x);

      return { type: ValueType.number, value: (flat[lo-1] + flat[hi-1]) / 2 };

    },
  },

  Rank: {
    arguments: [
      { name: 'Value', },
      { name: 'Source', },
      { name: 'Order', },
    ],
    fn: (value: number, source: CellValue[], order = 0) => {

      if (typeof value !== 'number') {
        return ArgumentError();
      }

      const numbers = Utils.FlattenNumbers(source);
      numbers.sort(order ? (a, b) => a - b : (a, b) => b - a);

      for (let i = 0; i < numbers.length; i++) {
        if (numbers[i] === value) {
          return {
            type: ValueType.number,
            value: i + 1,
          };
        }
      }

      return ValueError();

    },
  },


};

export const StatisticsFunctionAliases: {[index: string]: string} = {
  Mean: 'Average',
  'StDev': 'StDev.S',
  'Var': 'Var.S',
  'Quartile': 'Quartile.Inc',
};
