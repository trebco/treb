
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { Lgamma } from './stats-special-functions';

function BinomialPMF(k: number, n: number, p: number): number {
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  const log_pmf = Lgamma(n + 1) - Lgamma(k + 1) - Lgamma(n - k + 1)
    + k * Math.log(p) + (n - k) * Math.log(1 - p);
  return Math.exp(log_pmf);
}

function BinomialCDF(k: number, n: number, p: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += BinomialPMF(i, n, p);
  }
  return sum;
}

AddExtendedFunction('BINOM.DIST', {
  description: 'Returns the binomial distribution probability',
  arguments: [
    { name: 'number_s', description: 'The number of successes', unroll: true },
    { name: 'trials', description: 'The number of trials' },
    { name: 'probability_s', description: 'The probability of success on each trial' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability mass' },
  ],
  fn: (k?: number, n?: number, p?: number, cumulative?: boolean): UnionValue => {
    if (k === undefined || n === undefined || p === undefined || cumulative === undefined) {
      return ValueError();
    }
    k = Math.trunc(k);
    n = Math.trunc(n);
    if (k < 0 || k > n || n < 0 || p < 0 || p > 1) return ValueError();
    return Box(cumulative ? BinomialCDF(k, n, p) : BinomialPMF(k, n, p));
  },
});

AddExtendedFunction('BINOM.DIST.RANGE', {
  description: 'Returns the probability of a trial result using a binomial distribution',
  arguments: [
    { name: 'trials', description: 'The number of trials' },
    { name: 'probability_s', description: 'The probability of success on each trial' },
    { name: 'number_s', description: 'The minimum number of successes' },
    { name: 'number_s2', description: 'The maximum number of successes' },
  ],
  fn: (n?: number, p?: number, s?: number, s2?: number): UnionValue => {
    if (n === undefined || p === undefined || s === undefined) return ValueError();
    n = Math.trunc(n);
    s = Math.trunc(s);
    if (s2 === undefined) s2 = s;
    else s2 = Math.trunc(s2);
    if (n < 0 || p < 0 || p > 1 || s < 0 || s2 < s || s2 > n) return ValueError();
    let sum = 0;
    for (let i = s; i <= s2; i++) {
      sum += BinomialPMF(i, n, p);
    }
    return Box(sum);
  },
});

AddExtendedFunction('BINOM.INV', {
  description: 'Returns the smallest value for which the cumulative binomial distribution is greater than or equal to a criterion value',
  arguments: [
    { name: 'trials', description: 'The number of trials', unroll: true },
    { name: 'probability_s', description: 'The probability of success on each trial' },
    { name: 'alpha', description: 'The criterion value' },
  ],
  fn: (n?: number, p?: number, alpha?: number): UnionValue => {
    if (n === undefined || p === undefined || alpha === undefined) return ValueError();
    n = Math.trunc(n);
    if (n < 0 || p < 0 || p > 1 || alpha < 0 || alpha > 1) return ValueError();
    let cdf = 0;
    for (let k = 0; k <= n; k++) {
      cdf += BinomialPMF(k, n, p);
      if (cdf >= alpha) return Box(k);
    }
    return Box(n);
  },
});

function NegBinomialPMF(f: number, s: number, p: number): number {
  if (p === 0 || p === 1) return 0;
  const log_pmf = Lgamma(f + s) - Lgamma(s) - Lgamma(f + 1)
    + s * Math.log(p) + f * Math.log(1 - p);
  return Math.exp(log_pmf);
}

AddExtendedFunction('NEGBINOM.DIST', {
  description: 'Returns the negative binomial distribution probability',
  arguments: [
    { name: 'number_f', description: 'The number of failures', unroll: true },
    { name: 'number_s', description: 'The threshold number of successes' },
    { name: 'probability_s', description: 'The probability of success' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability mass' },
  ],
  fn: (f?: number, s?: number, p?: number, cumulative?: boolean): UnionValue => {
    if (f === undefined || s === undefined || p === undefined || cumulative === undefined) {
      return ValueError();
    }
    f = Math.trunc(f);
    s = Math.trunc(s);
    if (f < 0 || s < 1 || p < 0 || p > 1) return ValueError();
    if (!cumulative) return Box(NegBinomialPMF(f, s, p));
    let sum = 0;
    for (let i = 0; i <= f; i++) {
      sum += NegBinomialPMF(i, s, p);
    }
    return Box(sum);
  },
});
