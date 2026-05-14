
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { Lgamma, NormalCDF, RegularizedBetaI } from './stats-special-functions';

AddExtendedFunction('BETADIST', {
  description: 'Returns the cumulative beta probability density function (compatibility)',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'alpha', description: 'The alpha parameter' },
    { name: 'beta', description: 'The beta parameter' },
    { name: 'A', description: 'Lower bound (default 0)' },
    { name: 'B', description: 'Upper bound (default 1)' },
  ],
  fn: (x?: number, alpha?: number, beta?: number, A?: number, B?: number): UnionValue => {
    if (x === undefined || alpha === undefined || beta === undefined) return ValueError();
    if (A === undefined) A = 0;
    if (B === undefined) B = 1;
    if (alpha <= 0 || beta <= 0 || A >= B || x < A || x > B) return ValueError();
    return Box(RegularizedBetaI((x - A) / (B - A), alpha, beta));
  },
});

AddExtendedFunction('LOGNORMDIST', {
  description: 'Returns the cumulative lognormal distribution (compatibility)',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'mean', description: 'The mean of ln(x)' },
    { name: 'standard_dev', description: 'The standard deviation of ln(x)' },
  ],
  fn: (x?: number, mean?: number, stdev?: number): UnionValue => {
    if (x === undefined || mean === undefined || stdev === undefined) return ValueError();
    if (x <= 0 || stdev <= 0) return ValueError();
    return Box(NormalCDF(Math.log(x), mean, stdev));
  },
});

AddExtendedFunction('HYPGEOMDIST', {
  description: 'Returns the hypergeometric distribution probability mass (compatibility)',
  arguments: [
    { name: 'sample_s', description: 'The number of successes in the sample', unroll: true },
    { name: 'number_sample', description: 'The size of the sample' },
    { name: 'population_s', description: 'The number of successes in the population' },
    { name: 'number_pop', description: 'The population size' },
  ],
  fn: (k?: number, n?: number, K?: number, N?: number): UnionValue => {
    if (k === undefined || n === undefined || K === undefined || N === undefined) return ValueError();
    k = Math.trunc(k);
    n = Math.trunc(n);
    K = Math.trunc(K);
    N = Math.trunc(N);
    if (k < 0 || n < 0 || K < 0 || N < 0 || n > N || K > N || k > n || k > K) return ValueError();
    return Box(Math.exp(
      Lgamma(K + 1) - Lgamma(k + 1) - Lgamma(K - k + 1)
      + Lgamma(N - K + 1) - Lgamma(n - k + 1) - Lgamma(N - K - n + k + 1)
      - Lgamma(N + 1) + Lgamma(n + 1) + Lgamma(N - n + 1)
    ));
  },
});

AddExtendedFunction('NEGBINOMDIST', {
  description: 'Returns the negative binomial distribution probability mass (compatibility)',
  arguments: [
    { name: 'number_f', description: 'The number of failures', unroll: true },
    { name: 'number_s', description: 'The threshold number of successes' },
    { name: 'probability_s', description: 'The probability of success' },
  ],
  fn: (f?: number, s?: number, p?: number): UnionValue => {
    if (f === undefined || s === undefined || p === undefined) return ValueError();
    f = Math.trunc(f);
    s = Math.trunc(s);
    if (f < 0 || s < 1 || p < 0 || p > 1) return ValueError();
    if (p === 0 || p === 1) return Box(0);
    return Box(Math.exp(
      Lgamma(f + s) - Lgamma(s) - Lgamma(f + 1)
      + s * Math.log(p) + f * Math.log(1 - p)
    ));
  },
});
