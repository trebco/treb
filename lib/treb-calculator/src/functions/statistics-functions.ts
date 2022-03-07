
import { FunctionMap } from '../descriptors';
import * as Utils from '../utilities';
import { ValueError, FunctionError } from '../function-error';
import { Complex, UnionValue, ValueType } from 'treb-base-types';
import * as ComplexMath from '../complex-math';

const Variance = (data: number[], sample = false) => {

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

  StDev: {
    description: 'Returns the standard deviation of a set of values, corresponding to a population',
    arguments: [{ name: 'data', }],
    fn: (...args: any[]): UnionValue => {
      return { type: ValueType.number, value: Math.sqrt(Variance(Utils.FlattenUnboxed(args), false)) };
    },
  },

  'StDev.S': {
    description: 'Returns the standard deviation of a set of values, corresponding to a sample of a population',
    arguments: [{ name: 'data', }],
    fn: (...args: any[]): UnionValue => {
      return { type: ValueType.number, value: Math.sqrt(Variance(Utils.FlattenUnboxed(args), true)) };
    },
  },

  Var: {
    description: 'Returns the variance of a set of values, corresponding to a population',
    arguments: [{ name: 'data', }],
    fn: (...args: any[]): UnionValue => {
      return { type: ValueType.number, value: Variance(Utils.FlattenUnboxed(args), false) };
    },
  },

  'Var.S': {
    description: 'Returns the variance of a set of values, corresponding to a sample of a population',
    arguments: [{ name: 'data', }],
    fn: (...args: any[]): UnionValue => {
      return { type: ValueType.number, value: Variance(Utils.FlattenUnboxed(args), true) };
    },
  },

  Correl: {
    description: 'Returns the correlation between two ranges of values',
    arguments: [{
      name: 'A',
    }, {
      name: 'B',
    }],
    fn: (x: any[], y: any[]): UnionValue => {

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

    fn: (...args: any[]): UnionValue => {

      args = Utils.FlattenBoxed(args); 

      let count = 0;
      let product: Complex = {real: 1, imaginary: 0};
      let complex = false;
      let negative = false;

      for (const arg of args as UnionValue[]) {
        
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

  Average: {

    description: 'Returns the arithmetic mean of all numeric arguments',
    arguments: [{ boxed: true }],

    fn: (...args: any[]): UnionValue => {
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

      const flat = Utils.FlattenUnboxed(range).filter((test) => typeof test === 'number');
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

  Median: {
    description: 'Returns the median value of the range of data',
    arguments: [
      { name: 'range' },
    ],
    fn: (...args: any[]): UnionValue => {

      const flat = Utils.FlattenUnboxed(args).filter((test) => typeof test === 'number');
      flat.sort((a, b) => a - b);
      const n = flat.length;

      const x = 1 + (n-1) * .5;
      const lo = Math.floor(x);
      const hi = Math.ceil(x);

      return { type: ValueType.number, value: (flat[lo-1] + flat[hi-1]) / 2 };

    },
  }

};

export const StatisticsFunctionAliases: {[index: string]: string} = {
  Mean: 'Average',
  'StDev.P': 'StDev',
  'Var.P': 'Var',
};