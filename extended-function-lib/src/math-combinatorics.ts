import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

function combinations(n: number, k: number): number {
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

AddExtendedFunction('COMBIN', {
  description: 'Returns the number of combinations for a given number of items',
  arguments: [
    { name: 'number', description: 'The total number of items', unroll: true },
    { name: 'number_chosen', description: 'The number of items in each combination' },
  ],
  fn: (n?: number, k?: number): UnionValue => {
    if (n === undefined || k === undefined) return ValueError();
    n = Math.trunc(n);
    k = Math.trunc(k);
    if (n < 0 || k < 0 || k > n) return ValueError();
    return Box(combinations(n, k));
  },
});

AddExtendedFunction('COMBINA', {
  description: 'Returns the number of combinations with repetitions',
  arguments: [
    { name: 'number', description: 'The total number of items', unroll: true },
    { name: 'number_chosen', description: 'The number of items in each combination' },
  ],
  fn: (n?: number, k?: number): UnionValue => {
    if (n === undefined || k === undefined) return ValueError();
    n = Math.trunc(n);
    k = Math.trunc(k);
    if (n < 0 || k < 0) return ValueError();
    if (n === 0 && k === 0) return Box(1);
    return Box(combinations(n + k - 1, k));
  },
});

AddExtendedFunction('MULTINOMIAL', {
  description: 'Returns the multinomial of a set of numbers',
  arguments: [
    { name: 'number', description: 'A number', repeat: true },
  ],
  fn: (...args: (number | undefined)[]): UnionValue => {
    let sum = 0;
    let denominator = 1;
    for (const arg of args) {
      if (arg === undefined) continue;
      const n = Math.trunc(arg);
      if (n < 0) return ValueError();
      sum += n;
      denominator *= factorial(n);
    }
    return Box(factorial(sum) / denominator);
  },
});

AddExtendedFunction('SERIESSUM', {
  description: 'Returns the sum of a power series',
  arguments: [
    { name: 'x', description: 'The input value to the power series' },
    { name: 'n', description: 'The initial power to which x is raised' },
    { name: 'm', description: 'The step by which to increase n for each term' },
    { name: 'coefficients', description: 'The coefficients of the power series', boxed: true },
  ],
  fn: (x?: number, n?: number, m?: number, coefficients?: UnionValue): UnionValue => {
    if (x === undefined || n === undefined || m === undefined || coefficients === undefined) {
      return ValueError();
    }

    const values: number[] = [];
    if (coefficients.type === ValueType.array) {
      for (const row of coefficients.value) {
        for (const cell of row) {
          if (cell.type === ValueType.number) {
            values.push(cell.value);
          }
        }
      }
    } else if (coefficients.type === ValueType.number) {
      values.push(coefficients.value);
    }

    let result = 0;
    for (let i = 0; i < values.length; i++) {
      result += values[i] * Math.pow(x, n + i * m);
    }
    return Box(result);
  },
});
