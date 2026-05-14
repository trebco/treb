
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { NormalCDF } from './stats-special-functions';
import { extractNumbers, mean, sampleVariance } from './stats-array-utils';

AddExtendedFunction('Z.TEST', {
  description: 'Returns the one-tailed P-value of a z-test',
  arguments: [
    { name: 'array', description: 'The data set', boxed: true },
    { name: 'x', description: 'The value to test' },
    { name: 'sigma', description: 'Population standard deviation (optional)' },
  ],
  fn: (array?: UnionValue, x?: number, sigma?: number): UnionValue => {
    if (!array || x === undefined) return ValueError();
    const data = extractNumbers(array);
    if (data.length < 2) return ValueError();
    const m = mean(data);
    const s = sigma !== undefined ? sigma : Math.sqrt(sampleVariance(data));
    if (s <= 0) return ValueError();
    const z = (m - x) / (s / Math.sqrt(data.length));
    return Box(1 - NormalCDF(z, 0, 1));
  },
});
