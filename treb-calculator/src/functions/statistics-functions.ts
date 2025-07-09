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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import type { FunctionMap } from '../descriptors';
import * as Utils from '../utilities';
import { ValueError, ArgumentError, NAError } from '../function-error';
import { type Complex, type UnionValue, ValueType, type CellValue, ComplexOrReal } from 'treb-base-types';
import * as ComplexMath from '../complex-math';

import { BetaCDF, BetaPDF, InverseBeta, LnGamma } from './beta';
import { gamma_p } from './gamma';
import { InverseNormal } from './normal';
import { tCDF, tInverse, tPDF } from './students-t';

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

/**
 * this is a Lanczos approximation. could be cleaned up.
 * @param z 
 * @returns 
 */
const Gamma = (z: Complex): Complex => {

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

  // how about a class based on the complex type? then you could
  // use class methods on values. would be a little cleaner?

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

const GammaPDF = (x: number, alpha: number, beta: number): number => {
  const gamma_alpha = Gamma({real: alpha, imaginary: 0}).real;
  return (Math.pow(x, alpha - 1) * Math.exp(-x / beta)) / (gamma_alpha * Math.pow(beta, alpha));
};

/** bisection */
const InverseGamma = (p: number, alpha: number, beta: number): number|false => {

  let lower = 0;
  let upper = alpha * 10;

  const tolerance = 1e-6;

  let iterations = 0;

  while (upper - lower > tolerance) {
    iterations++;

    const mid = (upper + lower) / 2;

    const f_lower = gamma_p(alpha, lower/beta);
    const f_mid = gamma_p(alpha, mid/beta);

    if (f_lower === false || f_mid === false) {
      return false;
    }

    if ((f_mid - p) * (f_lower - p) < 0) {
      upper = mid;
    }
    else {
      lower = mid;
    }

  }

  return (lower + upper) / 2;

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

  Slope: {
    arguments: [
      { name: 'known_y' },
      { name: 'known_x' },
    ],
    fn: (y: CellValue[][], x: CellValue[][]) => {

      const flat_x = Utils.FlattenNumbers(x);
      const flat_y = Utils.FlattenNumbers(y);

      if (flat_x.length !== flat_y.length) {
        return ArgumentError();
      }

      let sum_x = 0;
      let sum_y = 0;
      let sum_products = 0;
      let sum_squared_x = 0;
  
      for (let i = 0; i < flat_x.length; i++) {
  
        const x = flat_x[i];
        const y = flat_y[i];
  
        sum_products += (x * y);
        sum_x += x;
        sum_y += y;
  
        sum_squared_x += (x * x);
        // sum_squared_y += (y * y);
  
      }
  
      const value = 
        ((flat_x.length * sum_products) - (sum_x * sum_y) ) /
         ((flat_x.length * sum_squared_x) - (sum_x * sum_x));

      return {
        type: ValueType.number,
        value,
      }

    },
  },

  Intercept: {
    arguments: [
      { name: 'known_y' },
      { name: 'known_x' },
    ],
    fn: (y: CellValue[][], x: CellValue[][]) => {
      const flat_x = Utils.FlattenNumbers(x);
      const flat_y = Utils.FlattenNumbers(y);

      if (flat_x.length !== flat_y.length) {
        return ArgumentError();
      }

      const N = flat_x.length;

      let sum_x = 0;
      let sum_y = 0;
      let sum_products = 0;
      let sum_squared_x = 0;

      for (let i = 0; i < N; i++) {

        const x = flat_x[i];
        const y = flat_y[i];

        sum_products += (x * y);
        sum_x += x;
        sum_y += y;

        sum_squared_x += (x * x);

      }

      let m = ((N * sum_products) - (sum_x * sum_y) );
      m /= ((N * sum_squared_x) - (sum_x * sum_x));

      return {
        type: ValueType.number, value: (sum_y - (m * sum_x)) / N,
      };

    },
  },

  Phi: {
    arguments: [
      { name: 'x', boxed: true, unroll: true }
    ],
    fn: (x: UnionValue) => {

      if (x.type === ValueType.number) {
        return {
          type: ValueType.number,
          value: (1 / Math.sqrt(Math.PI * 2)) * Math.exp(-x.value * x.value / 2),
        };
      }

      return ArgumentError();
    }
  },

  'Z.Test': {
    arguments: [
      { name: 'Array', boxed: true,  },
      { name: 'x', boxed: true, unroll: true, },
      { name: 'Sigma', boxed: true, unroll: true, },
    ],
    fn: (array: UnionValue, x: UnionValue, sigma?: UnionValue) => {

      const data: number[] = [];

      if (array.type === ValueType.array) {
        for (const row of array.value) {
          for (const cell of row) { 
            if (cell.type === ValueType.number) {
              data.push(cell.value);
            }
          }
        }
      }
      else if (array.type === ValueType.number) {
        data.push(array.value);
      }

      if (data.length && x.type === ValueType.number) {

        let average = 0; 
        const n = data.length;
        for (const value of data) { average += value; }
        average /= n;

        const s = sigma?.type === ValueType.number ? sigma.value : 
          Math.sqrt(Variance(data, true));

        return {
          type: ValueType.number,
          value: 1 - norm_dist((average - x.value) / (s / Math.sqrt(n)), 0, 1, true),
        };

      }

      return ArgumentError();

    },
  },

  'Beta.Dist': {
    description: 'beta distribution',
    arguments: [
      { name: 'x', unroll: true},
      { name: 'a', },
      { name: 'b', },
      { name: 'cumulative', },
    ],
    fn: (x: number, a: number, b: number, cumulative: boolean) => {

      if (a < 0 || b < 0) {
        return ArgumentError();
      }

      if (cumulative) {
        return {
          type: ValueType.number,
          value: BetaCDF(x, a, b),
        };
      }
      else {
        return {
          type: ValueType.number,
          value: BetaPDF(x, a, b),
        };
      }

      return ArgumentError();
    }
  },

  'Beta.Inv': {
    description: 'Inverse of the beta distribution',
    arguments: [
      {name: 'probability', unroll: true},
      {name: 'a', },
      {name: 'b', },
    ],
    fn: (x: number, a: number, b: number) => {

      if (a < 0 || b < 0) {
        return ArgumentError();
      }

      return {
        type: ValueType.number,
        value: InverseBeta(x, a, b),
      }
    }
  },

  Erf: {
    fn: (a: number): UnionValue => {
      return { type: ValueType.number, value: erf(a) };
    },
  },

  /* use alias instead 
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
  */

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
        value: InverseNormal(q) * stdev + mean,
      }
    }
  },

  'Norm.S.Inv': {
    description: 'Inverse of the standard normal cumulative distribution', 
    arguments: [
      {name: 'probability', unroll: true },
    ],
    xlfn: true,
    fn: (q: number): UnionValue => {
      return {
        type: ValueType.number,
        value: InverseNormal(q),
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

  'Gamma.Inv': {
    description: 'Returns the inverse of the gamma distribution',
    arguments: [
      {name: 'probability', unroll: true},
      {name: 'alpha', },
      {name: 'beta', },
    ],
    fn: (p: number, alpha: number, beta: number) => {

      if (p < 0 || p > 1) {
        return ArgumentError();
      }
      
      const value = InverseGamma(p, alpha, beta);

      if (value === false) {
        return ValueError();
      }

      return {
        type: ValueType.number,
        value,
      }
    },
  },

  'Gamma.Dist': {
    fn: (x: number, alpha: number, beta: number, cumulative?: boolean) => {

      if (x < 0 || alpha <= 0 || beta <= 0) {
        return ArgumentError();
      }
  
      const value = cumulative ? gamma_p(alpha, x/beta) : GammaPDF(x, alpha, beta);
        
      if (value === false) {
        return ValueError();
      }

      return {
        type: ValueType.number,
        value,
      };

    }    
  },

  'T.DIST': {  
    description: `Returns the left-tailed Student's t-distribution`,
    arguments: [
      { name: 'X', unroll: true, boxed: true, },
      { name: 'degrees of freedom', unroll: true, boxed: true, },
      { name: 'cumulative', unroll: true, boxed: true, },
    ],
    fn: (x: UnionValue, df: UnionValue, cumulative?: UnionValue) => {

      const cum = cumulative ? !!cumulative.value : false;

      if (df.type !== ValueType.number || x.type !== ValueType.number || df.value < 1) {
        return ArgumentError();
      }
      
      return {
        type: ValueType.number,
        value: cum ? tCDF(x.value, df.value) : tPDF(x.value, df.value),
      }

    },
  },

  'T.Inv': {
    description: `Returns the left-tailed inverse of the Student's t-distribution`,
    arguments: [
      { 
        name: 'Probability', boxed: true, unroll: true,
      }, 
      {
        name: 'Degrees of freedom', boxed: true, unroll: true,
      },
    ],
    fn: (p: UnionValue, df: UnionValue) => {
      if (df.type !== ValueType.number || df.value < 1 || p.type !== ValueType.number || p.value <= 0 || p.value >= 1) {
        return ArgumentError();
      }
      return {
        type: ValueType.number,
        value: tInverse(p.value, df.value),
      };
    },
  },

  'T.Inv.2T': {
    description: `Returns the two-tailed inverse of the Student's t-distribution`,
    arguments: [
      { 
        name: 'Probability', boxed: true, unroll: true,
      }, 
      {
        name: 'Degrees of freedom', boxed: true, unroll: true,
      },
    ],
    fn: (p: UnionValue, df: UnionValue) => {
      if (df.type !== ValueType.number || df.value < 1 ||p.type !== ValueType.number || p.value <= 0 || p.value >= 1) {
        return ArgumentError();
      }
      return {
        type: ValueType.number,
        value: Math.abs(tInverse(1 - p.value/2, df.value)),
      };
    },
  },

  GammaLn: {
    description: 'Returns the natural log of the gamma function',
    arguments: [{ name: 'value', boxed: true, unroll: true }],
    fn: (value: UnionValue) => {
      if (value.type === ValueType.number) {
        return {
          type: ValueType.number,
          value: LnGamma(value.value),
        };
      }
      return ArgumentError();
    },
  },

  'GammaLn.Precise': {
    description: 'Returns the natural log of the gamma function',
    arguments: [{ name: 'value', boxed: true, unroll: true }],
    fn: (value: UnionValue) => {

      let cpx: Complex|undefined;

      if (value.type === ValueType.number) {
        cpx = { real: value.value, imaginary: 0 };
      } 
      else if (value.type === ValueType.complex) {
        cpx = value.value;
      }

      if (cpx) {
        const gamma = Gamma(cpx);
        return ComplexOrReal(ComplexMath.Log(gamma));
      }

      return ArgumentError();
    },
  },

  Gamma: {
    description: 'Returns the gamma function for the given value',
    arguments: [{ name: 'value', boxed: true, unroll: true }],
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
  'StDevA': 'StDev.S',
  'StDevPA': 'StDev.P',
  'Var': 'Var.S',
  'Quartile': 'Quartile.Inc',
  'NormSInv': 'Norm.S.Inv',
  'NormSDist': 'Norm.S.Dist',
  'NormDist': 'Norm.Dist',

};
