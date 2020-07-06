
import { FunctionMap } from '../descriptors';
import * as Utils from '../utilities';
import { ValueError } from '../function-error';

export const StatisticsFunctionLibrary: FunctionMap = {

  GeoMean: {
    fn: (...args: any[]) => {
      args = Utils.Flatten(args);
      let count = 0;
      let product = 1;
      for (const arg of args) {
        if (typeof arg === 'undefined') { continue; }
        const value = Number(arg);
        if (value < 0) { return ValueError; }
        count++;
        product *= value;
      }
      return Math.pow(product, 1 / count);
    },
  },

  Average: {
    fn: (...args: any[]) => {
      args = Utils.Flatten(args);
      return args.reduce((a: number, b: any) => {
        if (typeof b === 'undefined') return a;
        return a + Number(b);
      }, 0) / args.length;
    },
  },

  Percentile: {
    description: 'Returns the kth percentile value from the range of data',
    arguments: [
      { name: 'range' },
      { name: 'percentile' },
    ],
    fn: (range: number[][], percentile: number) => {

      const flat = Utils.Flatten(range).filter((test) => typeof test === 'number');
      flat.sort((a, b) => a - b);
      const n = flat.length;

      // try to stabilize this number
      const factor = Math.pow(10,8);
      const x = Math.round((1 + (n-1) * percentile) * factor)/factor;

      const lo = Math.floor(x);
      const hi = Math.ceil(x);

      return (flat[lo-1] + flat[hi-1]) / 2;

    },
  },

  Median: {
    description: 'Returns the median value of the range of data',
    arguments: [
      { name: 'range' },
    ],
    fn: (...args: any[]) => {

      const flat = Utils.Flatten(args).filter((test) => typeof test === 'number');
      flat.sort((a, b) => a - b);
      const n = flat.length;

      const x = 1 + (n-1) * .5;
      const lo = Math.floor(x);
      const hi = Math.ceil(x);

      return (flat[lo-1] + flat[hi-1]) / 2;

    },
  }

};

export const StatisticsFunctionAliases: {[index: string]: string} = {
  Mean: 'Average',
};
