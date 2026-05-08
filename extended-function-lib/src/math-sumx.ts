import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

function extractNumbers(v: UnionValue): number[] {
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

function pairedSum(
  array_x?: UnionValue,
  array_y?: UnionValue,
  op?: (x: number, y: number) => number,
): UnionValue {
  if (!array_x || !array_y || !op) return ValueError();
  const xs = extractNumbers(array_x);
  const ys = extractNumbers(array_y);
  if (xs.length !== ys.length) return ValueError();
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += op(xs[i], ys[i]);
  }
  return Box(sum);
}

AddExtendedFunction('SUMX2MY2', {
  description: 'Returns the sum of the difference of squares of corresponding values in two arrays',
  arguments: [
    { name: 'array_x', description: 'The first array', boxed: true },
    { name: 'array_y', description: 'The second array', boxed: true },
  ],
  fn: (array_x?: UnionValue, array_y?: UnionValue): UnionValue => {
    return pairedSum(array_x, array_y, (x, y) => x * x - y * y);
  },
});

AddExtendedFunction('SUMX2PY2', {
  description: 'Returns the sum of the sum of squares of corresponding values in two arrays',
  arguments: [
    { name: 'array_x', description: 'The first array', boxed: true },
    { name: 'array_y', description: 'The second array', boxed: true },
  ],
  fn: (array_x?: UnionValue, array_y?: UnionValue): UnionValue => {
    return pairedSum(array_x, array_y, (x, y) => x * x + y * y);
  },
});

AddExtendedFunction('SUMXMY2', {
  description: 'Returns the sum of squares of differences of corresponding values in two arrays',
  arguments: [
    { name: 'array_x', description: 'The first array', boxed: true },
    { name: 'array_y', description: 'The second array', boxed: true },
  ],
  fn: (array_x?: UnionValue, array_y?: UnionValue): UnionValue => {
    return pairedSum(array_x, array_y, (x, y) => (x - y) * (x - y));
  },
});
