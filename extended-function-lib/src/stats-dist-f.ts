
import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { Lgamma, RegularizedBetaI } from './stats-special-functions';
import { extractNumbers } from './stats-array-utils';

function FDistCDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  return RegularizedBetaI(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2);
}

function FDistPDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  const hd1 = d1 / 2;
  const hd2 = d2 / 2;
  return Math.exp(
    hd1 * Math.log(d1) + hd2 * Math.log(d2)
    + (hd1 - 1) * Math.log(x)
    - (hd1 + hd2) * Math.log(d1 * x + d2)
    - Lgamma(hd1) - Lgamma(hd2) + Lgamma(hd1 + hd2)
  );
}

function FDistInv(p: number, d1: number, d2: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;

  let lo = 0, hi = 1;
  while (FDistCDF(hi, d1, d2) < p) hi *= 2;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (FDistCDF(mid, d1, d2) < p) lo = mid;
    else hi = mid;
  }
  let x = (lo + hi) / 2;

  for (let i = 0; i < 20; i++) {
    const cdf = FDistCDF(x, d1, d2);
    const pdf = FDistPDF(x, d1, d2);
    if (pdf < 1e-300) break;
    const delta = (cdf - p) / pdf;
    x -= delta;
    if (x <= 0) x = lo / 2;
    if (Math.abs(delta) < 1e-12 * x) break;
  }
  return x;
}

AddExtendedFunction('F.DIST', {
  description: 'Returns the F probability distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'deg_freedom1', description: 'The numerator degrees of freedom' },
    { name: 'deg_freedom2', description: 'The denominator degrees of freedom' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability density' },
  ],
  fn: (x?: number, d1?: number, d2?: number, cumulative?: boolean): UnionValue => {
    if (x === undefined || d1 === undefined || d2 === undefined || cumulative === undefined) {
      return ValueError();
    }
    d1 = Math.trunc(d1);
    d2 = Math.trunc(d2);
    if (x < 0 || d1 < 1 || d2 < 1) return ValueError();
    return Box(cumulative ? FDistCDF(x, d1, d2) : FDistPDF(x, d1, d2));
  },
});

AddExtendedFunction('F.DIST.RT', {
  description: 'Returns the right-tailed F probability distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'deg_freedom1', description: 'The numerator degrees of freedom' },
    { name: 'deg_freedom2', description: 'The denominator degrees of freedom' },
  ],
  fn: (x?: number, d1?: number, d2?: number): UnionValue => {
    if (x === undefined || d1 === undefined || d2 === undefined) return ValueError();
    d1 = Math.trunc(d1);
    d2 = Math.trunc(d2);
    if (x < 0 || d1 < 1 || d2 < 1) return ValueError();
    return Box(1 - FDistCDF(x, d1, d2));
  },
});

AddExtendedFunction('F.INV', {
  description: 'Returns the inverse of the F probability distribution',
  arguments: [
    { name: 'probability', description: 'The probability', unroll: true },
    { name: 'deg_freedom1', description: 'The numerator degrees of freedom' },
    { name: 'deg_freedom2', description: 'The denominator degrees of freedom' },
  ],
  fn: (p?: number, d1?: number, d2?: number): UnionValue => {
    if (p === undefined || d1 === undefined || d2 === undefined) return ValueError();
    d1 = Math.trunc(d1);
    d2 = Math.trunc(d2);
    if (p < 0 || p > 1 || d1 < 1 || d2 < 1) return ValueError();
    return Box(FDistInv(p, d1, d2));
  },
});

AddExtendedFunction('F.INV.RT', {
  description: 'Returns the inverse of the right-tailed F probability distribution',
  arguments: [
    { name: 'probability', description: 'The probability', unroll: true },
    { name: 'deg_freedom1', description: 'The numerator degrees of freedom' },
    { name: 'deg_freedom2', description: 'The denominator degrees of freedom' },
  ],
  fn: (p?: number, d1?: number, d2?: number): UnionValue => {
    if (p === undefined || d1 === undefined || d2 === undefined) return ValueError();
    d1 = Math.trunc(d1);
    d2 = Math.trunc(d2);
    if (p < 0 || p > 1 || d1 < 1 || d2 < 1) return ValueError();
    return Box(FDistInv(1 - p, d1, d2));
  },
});

AddExtendedFunction('F.TEST', {
  description: 'Returns the result of an F-test',
  arguments: [
    { name: 'array1', description: 'The first data set', boxed: true },
    { name: 'array2', description: 'The second data set', boxed: true },
  ],
  fn: (arr1?: UnionValue, arr2?: UnionValue): UnionValue => {
    if (!arr1 || !arr2) return ValueError();
    const x = extractNumbers(arr1);
    const y = extractNumbers(arr2);
    if (x.length < 2 || y.length < 2) return ValueError();

    let mx = 0, my = 0;
    for (const v of x) mx += v;
    mx /= x.length;
    for (const v of y) my += v;
    my /= y.length;

    let vx = 0, vy = 0;
    for (const v of x) vx += (v - mx) * (v - mx);
    vx /= (x.length - 1);
    for (const v of y) vy += (v - my) * (v - my);
    vy /= (y.length - 1);

    if (vx === 0 || vy === 0) return ValueError();

    const f = vx / vy;
    const d1 = x.length - 1;
    const d2 = y.length - 1;
    const p = f >= 1
      ? 2 * (1 - FDistCDF(f, d1, d2))
      : 2 * FDistCDF(f, d1, d2);
    return Box(Math.min(p, 1));
  },
});
