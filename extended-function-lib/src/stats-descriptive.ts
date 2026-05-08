import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { DivideByZeroError, ValueError } from 'treb-calculator';
import { extractNumbers, extractNumbersA, mean, sampleVariance, populationVariance } from './stats-array-utils';

AddExtendedFunction('AVEDEV', {
  description: 'Returns the average of the absolute deviations from the mean',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbers(arr);
    if (values.length === 0) return ValueError();
    const m = mean(values);
    let sum = 0;
    for (const v of values) sum += Math.abs(v - m);
    return Box(sum / values.length);
  },
});

AddExtendedFunction('DEVSQ', {
  description: 'Returns the sum of squares of deviations from the mean',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbers(arr);
    if (values.length === 0) return ValueError();
    const m = mean(values);
    let sum = 0;
    for (const v of values) sum += (v - m) * (v - m);
    return Box(sum);
  },
});

AddExtendedFunction('SKEW', {
  description: 'Returns the skewness of a distribution (sample)',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbers(arr);
    const n = values.length;
    if (n < 3) return ValueError();
    const m = mean(values);
    const s = Math.sqrt(sampleVariance(values));
    if (s === 0) return DivideByZeroError();
    let sum = 0;
    for (const v of values) {
      const d = (v - m) / s;
      sum += d * d * d;
    }
    return Box((n / ((n - 1) * (n - 2))) * sum);
  },
});

AddExtendedFunction('SKEW.P', {
  description: 'Returns the skewness of a distribution (population)',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbers(arr);
    const n = values.length;
    if (n < 3) return ValueError();
    const m = mean(values);
    const s = Math.sqrt(populationVariance(values));
    if (s === 0) return DivideByZeroError();
    let sum = 0;
    for (const v of values) {
      const d = (v - m) / s;
      sum += d * d * d;
    }
    return Box(sum / n);
  },
});

AddExtendedFunction('KURT', {
  description: 'Returns the kurtosis of a data set',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbers(arr);
    const n = values.length;
    if (n < 4) return ValueError();
    const m = mean(values);
    const s = Math.sqrt(sampleVariance(values));
    if (s === 0) return DivideByZeroError();
    let sum4 = 0;
    for (const v of values) {
      const d = (v - m) / s;
      sum4 += d * d * d * d;
    }
    const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const term2 = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
    return Box(term1 * sum4 - term2);
  },
});

AddExtendedFunction('TRIMMEAN', {
  description: 'Returns the mean of the interior of a data set',
  arguments: [
    { name: 'array', description: 'The values', boxed: true },
    { name: 'percent', description: 'Fraction of data points to exclude (0 to 1)' },
  ],
  fn: (arr?: UnionValue, percent?: number): UnionValue => {
    if (!arr || percent === undefined) return ValueError();
    if (percent < 0 || percent >= 1) return ValueError();
    const values = extractNumbers(arr);
    const n = values.length;
    if (n === 0) return ValueError();
    const trimCount = Math.floor(n * percent / 2);
    values.sort((a, b) => a - b);
    const trimmed = values.slice(trimCount, n - trimCount);
    if (trimmed.length === 0) return ValueError();
    return Box(mean(trimmed));
  },
});

AddExtendedFunction('AVERAGEA', {
  description: 'Returns the average of values, including text and logicals',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbersA(arr);
    if (values.length === 0) return DivideByZeroError();
    return Box(mean(values));
  },
});

AddExtendedFunction('MINA', {
  description: 'Returns the smallest value, including text and logicals',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbersA(arr);
    if (values.length === 0) return Box(0);
    let min = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
    }
    return Box(min);
  },
});

AddExtendedFunction('MAXA', {
  description: 'Returns the largest value, including text and logicals',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbersA(arr);
    if (values.length === 0) return Box(0);
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] > max) max = values[i];
    }
    return Box(max);
  },
});

AddExtendedFunction('VARA', {
  description: 'Returns the sample variance, including text and logicals',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbersA(arr);
    if (values.length < 2) return DivideByZeroError();
    return Box(sampleVariance(values));
  },
});

AddExtendedFunction('VARPA', {
  description: 'Returns the population variance, including text and logicals',
  arguments: [{ name: 'array', description: 'The values', boxed: true }],
  fn: (arr?: UnionValue): UnionValue => {
    if (!arr) return ValueError();
    const values = extractNumbersA(arr);
    if (values.length === 0) return DivideByZeroError();
    return Box(populationVariance(values));
  },
});
