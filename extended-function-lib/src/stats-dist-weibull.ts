
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

AddExtendedFunction('WEIBULL.DIST', {
  description: 'Returns the Weibull distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'alpha', description: 'The shape parameter' },
    { name: 'beta', description: 'The scale parameter' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability density' },
  ],
  fn: (x?: number, alpha?: number, beta?: number, cumulative?: boolean): UnionValue => {
    if (x === undefined || alpha === undefined || beta === undefined || cumulative === undefined) {
      return ValueError();
    }
    if (x < 0 || alpha <= 0 || beta <= 0) return ValueError();
    const ratio = x / beta;
    if (cumulative) return Box(1 - Math.exp(-Math.pow(ratio, alpha)));
    return Box((alpha / beta) * Math.pow(ratio, alpha - 1) * Math.exp(-Math.pow(ratio, alpha)));
  },
});
