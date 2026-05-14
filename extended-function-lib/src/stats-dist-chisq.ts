
import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { Lgamma, RegularizedGammaP } from './stats-special-functions';

function ChiSquaredCDF(x: number, df: number): number {
  return RegularizedGammaP(df / 2, x / 2);
}

function ChiSquaredPDF(x: number, df: number): number {
  if (x <= 0) return 0;
  const half_df = df / 2;
  return Math.exp((half_df - 1) * Math.log(x) - x / 2 - half_df * Math.log(2) - Lgamma(half_df));
}

function ChiSquaredInv(p: number, df: number): number {
  if (p === 0) return 0;
  if (p === 1) return Infinity;

  // Wilson-Hilferty initial approximation
  let x: number;
  if (df > 2) {
    const v = 2 / (9 * df);
    const z = p < 0.5
      ? -NormalInvApprox(1 - p)
      : NormalInvApprox(p);
    const sign = p < 0.5 ? -1 : 1;
    x = df * Math.pow(1 - v + sign * z * Math.sqrt(v), 3);
    if (x <= 0) x = 0.01;
  } else {
    x = Math.max(0.01, -2 * Math.log(1 - p));
  }

  for (let i = 0; i < 100; i++) {
    const cdf = ChiSquaredCDF(x, df);
    const pdf = ChiSquaredPDF(x, df);
    if (pdf < 1e-300) break;
    const delta = (cdf - p) / pdf;
    x -= delta;
    if (x <= 0) x = 0.001;
    if (Math.abs(delta) < 1e-12 * x) break;
  }
  return x;
}

// Rational approximation for inverse normal (Abramowitz & Stegun 26.2.23)
function NormalInvApprox(p: number): number {
  const t = Math.sqrt(-2 * Math.log(1 - p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t)
    / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
}

AddExtendedFunction('CHISQ.DIST', {
  description: 'Returns the chi-squared distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'deg_freedom', description: 'The degrees of freedom' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability density' },
  ],
  fn: (x?: number, df?: number, cumulative?: boolean): UnionValue => {
    if (x === undefined || df === undefined || cumulative === undefined) return ValueError();
    df = Math.trunc(df);
    if (x < 0 || df < 1) return ValueError();
    return Box(cumulative ? ChiSquaredCDF(x, df) : ChiSquaredPDF(x, df));
  },
});

AddExtendedFunction('CHISQ.DIST.RT', {
  description: 'Returns the right-tailed probability of the chi-squared distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'deg_freedom', description: 'The degrees of freedom' },
  ],
  fn: (x?: number, df?: number): UnionValue => {
    if (x === undefined || df === undefined) return ValueError();
    df = Math.trunc(df);
    if (x < 0 || df < 1) return ValueError();
    return Box(1 - ChiSquaredCDF(x, df));
  },
});

AddExtendedFunction('CHISQ.INV', {
  description: 'Returns the inverse of the left-tailed probability of the chi-squared distribution',
  arguments: [
    { name: 'probability', description: 'The probability', unroll: true },
    { name: 'deg_freedom', description: 'The degrees of freedom' },
  ],
  fn: (p?: number, df?: number): UnionValue => {
    if (p === undefined || df === undefined) return ValueError();
    df = Math.trunc(df);
    if (p < 0 || p > 1 || df < 1) return ValueError();
    return Box(ChiSquaredInv(p, df));
  },
});

AddExtendedFunction('CHISQ.INV.RT', {
  description: 'Returns the inverse of the right-tailed probability of the chi-squared distribution',
  arguments: [
    { name: 'probability', description: 'The probability', unroll: true },
    { name: 'deg_freedom', description: 'The degrees of freedom' },
  ],
  fn: (p?: number, df?: number): UnionValue => {
    if (p === undefined || df === undefined) return ValueError();
    df = Math.trunc(df);
    if (p < 0 || p > 1 || df < 1) return ValueError();
    return Box(ChiSquaredInv(1 - p, df));
  },
});

AddExtendedFunction('CHISQ.TEST', {
  description: 'Returns the chi-squared test for independence',
  arguments: [
    { name: 'actual_range', description: 'The range of observed data', boxed: true },
    { name: 'expected_range', description: 'The range of expected values', boxed: true },
  ],
  fn: (actual?: UnionValue, expected?: UnionValue): UnionValue => {
    if (!actual || !expected) return ValueError();
    if (actual.type !== ValueType.array || expected.type !== ValueType.array) return ValueError();

    const a_cols = actual.value;
    const e_cols = expected.value;
    const num_cols = a_cols.length;
    const num_rows = a_cols[0]?.length ?? 0;

    if (num_cols === 0 || num_rows === 0) return ValueError();
    if (e_cols.length !== num_cols) return ValueError();

    let chi_sq = 0;
    for (let c = 0; c < num_cols; c++) {
      if (a_cols[c].length !== num_rows || e_cols[c].length !== num_rows) return ValueError();
      for (let r = 0; r < num_rows; r++) {
        const o = a_cols[c][r];
        const e = e_cols[c][r];
        if (o.type !== ValueType.number || e.type !== ValueType.number) return ValueError();
        if (e.value === 0) return ValueError();
        const diff = o.value - e.value;
        chi_sq += diff * diff / e.value;
      }
    }

    const df = (num_rows - 1) * (num_cols - 1);
    if (df < 1) return ValueError();
    return Box(1 - ChiSquaredCDF(chi_sq, df));
  },
});
