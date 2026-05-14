
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { NormalInv } from './stats-special-functions';
import { RegularizedBetaI } from './stats-special-functions';

function TDistInv2T(p: number, df: number): number {
  if (p <= 0) return Infinity;
  if (p >= 1) return 0;
  let lo = 0, hi = 1e6;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (2 * (1 - TDistCDF(mid, df)) > p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function TDistCDF(x: number, df: number): number {
  const t2 = x * x;
  const p = RegularizedBetaI(df / (df + t2), df / 2, 0.5);
  return x >= 0 ? 1 - p / 2 : p / 2;
}

AddExtendedFunction('CONFIDENCE.NORM', {
  description: 'Returns the confidence interval for a population mean using a normal distribution',
  arguments: [
    { name: 'alpha', description: 'The significance level', unroll: true },
    { name: 'standard_dev', description: 'The population standard deviation' },
    { name: 'size', description: 'The sample size' },
  ],
  fn: (alpha?: number, stdev?: number, size?: number): UnionValue => {
    if (alpha === undefined || stdev === undefined || size === undefined) return ValueError();
    size = Math.trunc(size);
    if (alpha <= 0 || alpha >= 1 || stdev <= 0 || size < 1) return ValueError();
    const z = -NormalInv(alpha / 2);
    return Box(z * stdev / Math.sqrt(size));
  },
});

AddExtendedFunction('CONFIDENCE.T', {
  description: 'Returns the confidence interval for a population mean using a Student t-distribution',
  arguments: [
    { name: 'alpha', description: 'The significance level', unroll: true },
    { name: 'standard_dev', description: 'The sample standard deviation' },
    { name: 'size', description: 'The sample size' },
  ],
  fn: (alpha?: number, stdev?: number, size?: number): UnionValue => {
    if (alpha === undefined || stdev === undefined || size === undefined) return ValueError();
    size = Math.trunc(size);
    if (alpha <= 0 || alpha >= 1 || stdev <= 0 || size < 2) return ValueError();
    const t = TDistInv2T(alpha, size - 1);
    return Box(t * stdev / Math.sqrt(size));
  },
});
