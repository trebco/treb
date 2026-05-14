
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { NormalCDF, NormalInv } from './stats-special-functions';

AddExtendedFunction('LOGNORM.DIST', {
  description: 'Returns the lognormal distribution',
  arguments: [
    { name: 'x', description: 'The value at which to evaluate', unroll: true },
    { name: 'mean', description: 'The mean of ln(x)' },
    { name: 'standard_dev', description: 'The standard deviation of ln(x)' },
    { name: 'cumulative', description: 'TRUE for cumulative distribution, FALSE for probability density' },
  ],
  fn: (x?: number, mean?: number, stdev?: number, cumulative?: boolean): UnionValue => {
    if (x === undefined || mean === undefined || stdev === undefined || cumulative === undefined) {
      return ValueError();
    }
    if (x <= 0 || stdev <= 0) return ValueError();
    if (cumulative) return Box(NormalCDF(Math.log(x), mean, stdev));
    const z = (Math.log(x) - mean) / stdev;
    return Box(Math.exp(-0.5 * z * z) / (x * stdev * Math.sqrt(2 * Math.PI)));
  },
});

AddExtendedFunction('LOGNORM.INV', {
  description: 'Returns the inverse of the lognormal cumulative distribution',
  arguments: [
    { name: 'probability', description: 'The probability', unroll: true },
    { name: 'mean', description: 'The mean of ln(x)' },
    { name: 'standard_dev', description: 'The standard deviation of ln(x)' },
  ],
  fn: (p?: number, mean?: number, stdev?: number): UnionValue => {
    if (p === undefined || mean === undefined || stdev === undefined) return ValueError();
    if (p <= 0 || p >= 1 || stdev <= 0) return ValueError();
    return Box(Math.exp(mean + stdev * NormalInv(p)));
  },
});
