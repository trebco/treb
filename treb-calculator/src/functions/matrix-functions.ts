
import { FunctionMap } from '../descriptors';
import { Complex, IsComplex, ComplexUnion, UnionOrArray, UnionValue, ValueType, ComplexOrReal } from 'treb-base-types';
import * as Utils from '../utilities';
import { ArgumentError, ValueError } from '../function-error';
import * as ComplexMath from '../complex-math';

import { ComplexMatrixType } from '../complex-math';

/**
 * given a range of data, ensure it's an array, check dimensions, and 
 * convert all real entries to complex (if possible).
 */
const ComplexMatrix = (a: UnionOrArray): ComplexMatrixType => {

  // ensure array
  if (!Array.isArray(a)) { a = [[a]]; }

  const m = a.length;
  const n = m ? a[0].length : 0;
  const array: Complex[][] = [];

  // 0-length 
  if (!m || !n) {
    return { m, n, array };
  }

  for (let i = 0; i < m; i++) {
    const row: Complex[] = [];
    for (let j = 0; j < n; j++) {
      const ref = a[i][j];
      if (ref.type === ValueType.complex) {
        row.push({...ref.value});
      }
      else if (ref.type === ValueType.number) {
        row.push({real: ref.value, imaginary: 0});
      }
      else if (ref.type === ValueType.undefined || ref.value === '') {
        row.push({real: 0, imaginary: 0});
      }
      else {
        return {m, n, error: true, array: []};
      }
    }
    array.push(row);
  }

  return { m, n, array };

}

export const MatrixFunctionLibrary: FunctionMap = {

  MDeterm: {
    description: 'Returns the determinant of a matrix',
    arguments: [
      { name: 'matrix', boxed: true },
    ],
    fn: (a: UnionOrArray): UnionValue => {

      const matrix = ComplexMatrix(a);

      if (!matrix.array || !matrix.m || !matrix.n || matrix.m !== matrix.n || matrix.error) {
        return ValueError();
      }

      const result = ComplexMath.ComplexDeterminant(matrix);

      if (!result) {
        return ValueError();
      }

      return ComplexOrReal(result);

    },
  },

  MInverse: {
    description: 'Returns the inverse matrix',
    arguments: [
      { name: 'matrix', boxed: true },
    ],
    fn: (a: UnionOrArray): UnionOrArray => {
      const matrix = ComplexMatrix(a);

      if (!matrix.array || !matrix.m || !matrix.n || matrix.m !== matrix.n || matrix.error) {
        return ValueError();
      }

      // check singular
      const det = ComplexMath.ComplexDeterminant(matrix);
      if (det && (det.real === 0 && det?.imaginary === 0)) {
        return ValueError();
      }

      const inverse = ComplexMath.MatrixInverse(matrix);

      if (!inverse) {
        return ValueError();
      }
      
      return inverse.map(row => row.map(value => ComplexOrReal(value)));
      
    },
  },

  MMult: {
    description: 'Returns the dot product of A and B',
    arguments: [
      { name: 'A', boxed: true }, 
      { name: 'B', boxed: true }, 
    ],
    fn: (a: UnionOrArray, b: UnionOrArray): UnionOrArray => {

      const A = ComplexMatrix(a);
      const B = ComplexMatrix(b);

      // check data
      if (!A.array || A.error || !B.array || B.error) {
        return ValueError();
      }

      // check sizes
      if (A.m !== B.n) {
        return ValueError();
      }

      // NOTE the swap here. the input arrays are column-major,
      // so we either need to transpose three times, or we can
      // swap.

      const product = ComplexMath.ComplexProduct(B, A);

      // convert to reals where possible

      return product.map(row => row.map(value => ComplexOrReal(value)));

    },
  }



}