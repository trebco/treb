import type { UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';

export function extractNumbers(v: UnionValue): number[] {
  const result: number[] = [];
  if (v.type === ValueType.array) {
    for (const row of v.value) {
      for (const cell of row) {
        if (cell.type === ValueType.number) {
          result.push(cell.value);
        }
      }
    }
  } else if (v.type === ValueType.number) {
    result.push(v.value);
  }
  return result;
}

export function extractNumbersA(v: UnionValue): number[] {
  const result: number[] = [];
  if (v.type === ValueType.array) {
    for (const row of v.value) {
      for (const cell of row) {
        if (cell.type === ValueType.number) {
          result.push(cell.value);
        } else if (cell.type === ValueType.boolean) {
          result.push(cell.value ? 1 : 0);
        } else if (cell.type === ValueType.string) {
          result.push(0);
        }
      }
    }
  } else if (v.type === ValueType.number) {
    result.push(v.value);
  } else if (v.type === ValueType.boolean) {
    result.push(v.value ? 1 : 0);
  } else if (v.type === ValueType.string) {
    result.push(0);
  }
  return result;
}

export function extractNumberPairs(a: UnionValue, b: UnionValue): [number[], number[]] | null {
  const xs = extractNumbers(a);
  const ys = extractNumbers(b);
  if (xs.length !== ys.length || xs.length === 0) return null;
  return [xs, ys];
}

export function mean(values: number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function sampleVariance(values: number[]): number {
  const m = mean(values);
  let sum = 0;
  for (const v of values) sum += (v - m) * (v - m);
  return sum / (values.length - 1);
}

export function populationVariance(values: number[]): number {
  const m = mean(values);
  let sum = 0;
  for (const v of values) sum += (v - m) * (v - m);
  return sum / values.length;
}
