
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { RegularizedBetaI } from './stats-special-functions';
import { extractNumbers, mean } from './stats-array-utils';

function TDistCDF(x: number, df: number): number {
  const t2 = x * x;
  const p = RegularizedBetaI(df / (df + t2), df / 2, 0.5);
  return x >= 0 ? 1 - p / 2 : p / 2;
}

AddExtendedFunction('T.DIST.RT', {
  description: 'Returns the right-tailed Student t-distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'deg_freedom', description: 'The degrees of freedom' },
  ],
  fn: (x?: number, df?: number): UnionValue => {
    if (x === undefined || df === undefined) return ValueError();
    df = Math.trunc(df);
    if (df < 1) return ValueError();
    return Box(1 - TDistCDF(x, df));
  },
});

AddExtendedFunction('T.DIST.2T', {
  description: 'Returns the two-tailed Student t-distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'deg_freedom', description: 'The degrees of freedom' },
  ],
  fn: (x?: number, df?: number): UnionValue => {
    if (x === undefined || df === undefined) return ValueError();
    df = Math.trunc(df);
    if (x < 0 || df < 1) return ValueError();
    return Box(2 * (1 - TDistCDF(Math.abs(x), df)));
  },
});

AddExtendedFunction('T.TEST', {
  description: 'Returns the probability associated with a Student t-test',
  arguments: [
    { name: 'array1', description: 'The first data set', boxed: true },
    { name: 'array2', description: 'The second data set', boxed: true },
    { name: 'tails', description: '1 for one-tailed, 2 for two-tailed' },
    { name: 'type', description: '1=paired, 2=equal variance, 3=unequal variance' },
  ],
  fn: (arr1?: UnionValue, arr2?: UnionValue, tails?: number, type?: number): UnionValue => {
    if (!arr1 || !arr2 || tails === undefined || type === undefined) return ValueError();
    tails = Math.trunc(tails);
    type = Math.trunc(type);
    if (tails < 1 || tails > 2 || type < 1 || type > 3) return ValueError();

    const x = extractNumbers(arr1);
    const y = extractNumbers(arr2);
    if (x.length < 2 || y.length < 2) return ValueError();

    let t_stat: number;
    let df: number;

    if (type === 1) {
      if (x.length !== y.length) return ValueError();
      const n = x.length;
      const diffs: number[] = [];
      for (let i = 0; i < n; i++) diffs.push(x[i] - y[i]);
      const d_bar = mean(diffs);
      let ss = 0;
      for (const d of diffs) ss += (d - d_bar) * (d - d_bar);
      const sd = Math.sqrt(ss / (n - 1));
      if (sd === 0) return ValueError();
      t_stat = Math.abs(d_bar) / (sd / Math.sqrt(n));
      df = n - 1;
    } else if (type === 2) {
      const n1 = x.length, n2 = y.length;
      const m1 = mean(x), m2 = mean(y);
      let ss1 = 0, ss2 = 0;
      for (const v of x) ss1 += (v - m1) * (v - m1);
      for (const v of y) ss2 += (v - m2) * (v - m2);
      const sp2 = (ss1 + ss2) / (n1 + n2 - 2);
      if (sp2 === 0) return ValueError();
      t_stat = Math.abs(m1 - m2) / Math.sqrt(sp2 * (1 / n1 + 1 / n2));
      df = n1 + n2 - 2;
    } else {
      const n1 = x.length, n2 = y.length;
      const m1 = mean(x), m2 = mean(y);
      let ss1 = 0, ss2 = 0;
      for (const v of x) ss1 += (v - m1) * (v - m1);
      for (const v of y) ss2 += (v - m2) * (v - m2);
      const v1 = ss1 / (n1 - 1) / n1;
      const v2 = ss2 / (n2 - 1) / n2;
      if (v1 + v2 === 0) return ValueError();
      t_stat = Math.abs(m1 - m2) / Math.sqrt(v1 + v2);
      df = (v1 + v2) * (v1 + v2) / (v1 * v1 / (n1 - 1) + v2 * v2 / (n2 - 1));
    }

    const p_right = 1 - TDistCDF(t_stat, df);
    return Box(tails === 1 ? p_right : 2 * p_right);
  },
});

AddExtendedFunction('TDIST', {
  description: 'Returns the Student t-distribution (compatibility)',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate' },
    { name: 'deg_freedom', description: 'The degrees of freedom' },
    { name: 'tails', description: '1 for one-tailed, 2 for two-tailed' },
  ],
  fn: (x?: number, df?: number, tails?: number): UnionValue => {
    if (x === undefined || df === undefined || tails === undefined) return ValueError();
    df = Math.trunc(df);
    tails = Math.trunc(tails);
    if (x < 0 || df < 1 || tails < 1 || tails > 2) return ValueError();
    const p_right = 1 - TDistCDF(x, df);
    return Box(tails === 1 ? p_right : 2 * p_right);
  },
});
