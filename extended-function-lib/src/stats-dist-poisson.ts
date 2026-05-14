
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { Lgamma } from './stats-special-functions';

function PoissonPMF(k: number, mean: number): number {
  if (mean === 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(mean) - mean - Lgamma(k + 1));
}

AddExtendedFunction('POISSON.DIST', {
  description: 'Returns the Poisson distribution',
  arguments: [
    { name: 'x', description: 'The number of events', unroll: true },
    { name: 'mean', description: 'The expected numeric value' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability mass' },
  ],
  fn: (x?: number, mean?: number, cumulative?: boolean): UnionValue => {
    if (x === undefined || mean === undefined || cumulative === undefined) return ValueError();
    x = Math.trunc(x);
    if (x < 0 || mean < 0) return ValueError();
    if (!cumulative) return Box(PoissonPMF(x, mean));
    let sum = 0;
    for (let i = 0; i <= x; i++) sum += PoissonPMF(i, mean);
    return Box(sum);
  },
});
