import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { extractNumbers, extractNumberPairs } from './stats-array-utils';

AddExtendedFunction('PERCENTILE.INC', {
  description: 'Returns the k-th percentile of values in a range (inclusive)',
  arguments: [
    { name: 'array', description: 'The values', boxed: true },
    { name: 'k', description: 'Percentile value (0 to 1)' },
  ],
  fn: (arr?: UnionValue, k?: number): UnionValue => {
    if (!arr || k === undefined) return ValueError();
    if (k < 0 || k > 1) return ValueError();
    const values = extractNumbers(arr);
    if (values.length === 0) return ValueError();
    values.sort((a, b) => a - b);
    const n = values.length;
    const rank = k * (n - 1);
    const lower = Math.floor(rank);
    const frac = rank - lower;
    if (lower + 1 >= n) return Box(values[n - 1]);
    return Box(values[lower] + frac * (values[lower + 1] - values[lower]));
  },
});

AddExtendedFunction('PERCENTILE.EXC', {
  description: 'Returns the k-th percentile of values in a range (exclusive)',
  arguments: [
    { name: 'array', description: 'The values', boxed: true },
    { name: 'k', description: 'Percentile value (0 to 1, exclusive)' },
  ],
  fn: (arr?: UnionValue, k?: number): UnionValue => {
    if (!arr || k === undefined) return ValueError();
    const values = extractNumbers(arr);
    const n = values.length;
    if (n === 0) return ValueError();
    if (k <= 1 / (n + 1) || k >= n / (n + 1)) return ValueError();
    values.sort((a, b) => a - b);
    const rank = k * (n + 1) - 1;
    const lower = Math.floor(rank);
    const frac = rank - lower;
    if (lower < 0) return Box(values[0]);
    if (lower + 1 >= n) return Box(values[n - 1]);
    return Box(values[lower] + frac * (values[lower + 1] - values[lower]));
  },
});

AddExtendedFunction('RANK.EQ', {
  description: 'Returns the rank of a number in a list (ties get lowest rank)',
  arguments: [
    { name: 'number', description: 'The number to rank' },
    { name: 'ref', description: 'The array of values', boxed: true },
    { name: 'order', description: '0 or omitted = descending, non-zero = ascending' },
  ],
  fn: (num?: number, ref?: UnionValue, order?: number): UnionValue => {
    if (num === undefined || !ref) return ValueError();
    const values = extractNumbers(ref);
    if (values.length === 0) return ValueError();
    const ascending = (order !== undefined && order !== 0);
    let rank = 1;
    for (const v of values) {
      if (ascending ? v < num : v > num) rank++;
    }
    if (!values.includes(num)) return ValueError();
    return Box(rank);
  },
});

AddExtendedFunction('RANK.AVG', {
  description: 'Returns the rank of a number in a list (ties get average rank)',
  arguments: [
    { name: 'number', description: 'The number to rank' },
    { name: 'ref', description: 'The array of values', boxed: true },
    { name: 'order', description: '0 or omitted = descending, non-zero = ascending' },
  ],
  fn: (num?: number, ref?: UnionValue, order?: number): UnionValue => {
    if (num === undefined || !ref) return ValueError();
    const values = extractNumbers(ref);
    if (values.length === 0) return ValueError();
    const ascending = (order !== undefined && order !== 0);
    let below = 0;
    let equal = 0;
    for (const v of values) {
      if (ascending ? v < num : v > num) below++;
      if (v === num) equal++;
    }
    if (equal === 0) return ValueError();
    return Box(below + 1 + (equal - 1) / 2);
  },
});

AddExtendedFunction('PERCENTRANK.INC', {
  description: 'Returns the percentile rank of a value (inclusive)',
  arguments: [
    { name: 'array', description: 'The values', boxed: true },
    { name: 'x', description: 'The value for which to find the rank' },
    { name: 'significance', description: 'Number of significant digits (default 3)' },
  ],
  fn: (arr?: UnionValue, x?: number, significance?: number): UnionValue => {
    if (!arr || x === undefined) return ValueError();
    if (significance === undefined) significance = 3;
    significance = Math.trunc(significance);
    if (significance < 1) return ValueError();
    const values = extractNumbers(arr);
    if (values.length === 0) return ValueError();
    values.sort((a, b) => a - b);
    const n = values.length;
    if (x < values[0] || x > values[n - 1]) return ValueError();
    for (let i = 0; i < n; i++) {
      if (values[i] === x) {
        const rank = i / (n - 1);
        const factor = Math.pow(10, significance);
        return Box(Math.floor(rank * factor) / factor);
      }
      if (values[i] > x) {
        const lower = values[i - 1];
        const upper = values[i];
        const frac = (x - lower) / (upper - lower);
        const rank = ((i - 1) + frac) / (n - 1);
        const factor = Math.pow(10, significance);
        return Box(Math.floor(rank * factor) / factor);
      }
    }
    return ValueError();
  },
});

AddExtendedFunction('PERCENTRANK.EXC', {
  description: 'Returns the percentile rank of a value (exclusive)',
  arguments: [
    { name: 'array', description: 'The values', boxed: true },
    { name: 'x', description: 'The value for which to find the rank' },
    { name: 'significance', description: 'Number of significant digits (default 3)' },
  ],
  fn: (arr?: UnionValue, x?: number, significance?: number): UnionValue => {
    if (!arr || x === undefined) return ValueError();
    if (significance === undefined) significance = 3;
    significance = Math.trunc(significance);
    if (significance < 1) return ValueError();
    const values = extractNumbers(arr);
    if (values.length === 0) return ValueError();
    values.sort((a, b) => a - b);
    const n = values.length;
    if (x < values[0] || x > values[n - 1]) return ValueError();
    for (let i = 0; i < n; i++) {
      if (values[i] === x) {
        const rank = (i + 1) / (n + 1);
        const factor = Math.pow(10, significance);
        return Box(Math.floor(rank * factor) / factor);
      }
      if (values[i] > x) {
        const lower = values[i - 1];
        const upper = values[i];
        const frac = (x - lower) / (upper - lower);
        const rank = (i + frac) / (n + 1);
        const factor = Math.pow(10, significance);
        return Box(Math.floor(rank * factor) / factor);
      }
    }
    return ValueError();
  },
});

AddExtendedFunction('PROB', {
  description: 'Returns the probability that values are between two limits',
  arguments: [
    { name: 'x_range', description: 'Range of numeric values', boxed: true },
    { name: 'prob_range', description: 'Probabilities associated with each value', boxed: true },
    { name: 'lower_limit', description: 'Lower bound' },
    { name: 'upper_limit', description: 'Upper bound (defaults to lower_limit)' },
  ],
  fn: (x_range?: UnionValue, prob_range?: UnionValue, lower?: number, upper?: number): UnionValue => {
    if (!x_range || !prob_range || lower === undefined) return ValueError();
    if (upper === undefined) upper = lower;
    const pairs = extractNumberPairs(x_range, prob_range);
    if (!pairs) return ValueError();
    const [xs, probs] = pairs;
    let sum = 0;
    for (let i = 0; i < xs.length; i++) {
      if (probs[i] < 0 || probs[i] > 1) return ValueError();
      if (xs[i] >= lower && xs[i] <= upper) {
        sum += probs[i];
      }
    }
    return Box(sum);
  },
});
