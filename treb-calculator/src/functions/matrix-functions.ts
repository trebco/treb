/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import type { FunctionMap } from '../descriptors';
import type { Complex, UnionValue} from 'treb-base-types';
import { ValueType, ComplexOrReal } from 'treb-base-types';
import { ValueError } from '../function-error';
import * as ComplexMath from '../complex-math';

import type { ComplexMatrixType } from '../complex-math';

/**
 * given a range of data, ensure it's an array, check dimensions, and 
 * convert all real entries to complex (if possible).
 */
const ComplexMatrix = (input: UnionValue): ComplexMatrixType => {

  let a: UnionValue[][] = [];

  // ensure array

  if (input.type === ValueType.array) {
    a = input.value;
  }
  else {
    a = [[input.value]];
  }

  // if (!Array.isArray(a)) { a = [[a]]; }

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
    fn: (a: UnionValue): UnionValue => {

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
    fn: (a: UnionValue): UnionValue => {
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
      
      return {
        type: ValueType.array,
        value: inverse.map(row => row.map(value => ComplexOrReal(value))),
      }

      // return inverse.map(row => row.map(value => ComplexOrReal(value)));
      
    },
  },

  MMult: {
    description: 'Returns the dot product of A and B',
    arguments: [
      { name: 'A', boxed: true }, 
      { name: 'B', boxed: true }, 
    ],
    fn: (a: UnionValue, b: UnionValue): UnionValue => {

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

      return {
        type: ValueType.array,
        value: product.map(row => row.map(value => ComplexOrReal(value))),
      };

      // return product.map(row => row.map(value => ComplexOrReal(value)));

    },
  }



}