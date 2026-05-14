
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

AddExtendedFunction('EXPON.DIST', {
  description: 'Returns the exponential distribution',
  arguments: [
    { name: 'x', description: 'The value of the function', unroll: true },
    { name: 'lambda', description: 'The parameter value' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability density' },
  ],
  fn: (x?: number, lambda?: number, cumulative?: boolean): UnionValue => {
    if (x === undefined || lambda === undefined || cumulative === undefined) return ValueError();
    if (x < 0 || lambda <= 0) return ValueError();
    if (cumulative) return Box(1 - Math.exp(-lambda * x));
    return Box(lambda * Math.exp(-lambda * x));
  },
});
