
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { Lgamma } from './stats-special-functions';

function HypergeomPMF(k: number, n: number, K: number, N: number): number {
  return Math.exp(
    Lgamma(K + 1) - Lgamma(k + 1) - Lgamma(K - k + 1)
    + Lgamma(N - K + 1) - Lgamma(n - k + 1) - Lgamma(N - K - n + k + 1)
    - Lgamma(N + 1) + Lgamma(n + 1) + Lgamma(N - n + 1)
  );
}

AddExtendedFunction('HYPGEOM.DIST', {
  description: 'Returns the hypergeometric distribution',
  arguments: [
    { name: 'sample_s', description: 'The number of successes in the sample', unroll: true },
    { name: 'number_sample', description: 'The size of the sample' },
    { name: 'population_s', description: 'The number of successes in the population' },
    { name: 'number_pop', description: 'The population size' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability mass' },
  ],
  fn: (k?: number, n?: number, K?: number, N?: number, cumulative?: boolean): UnionValue => {
    if (k === undefined || n === undefined || K === undefined || N === undefined || cumulative === undefined) {
      return ValueError();
    }
    k = Math.trunc(k);
    n = Math.trunc(n);
    K = Math.trunc(K);
    N = Math.trunc(N);
    if (k < 0 || n < 0 || K < 0 || N < 0 || n > N || K > N || k > n || k > K) return ValueError();
    if (!cumulative) return Box(HypergeomPMF(k, n, K, N));
    let sum = 0;
    for (let i = 0; i <= k; i++) sum += HypergeomPMF(i, n, K, N);
    return Box(sum);
  },
});
