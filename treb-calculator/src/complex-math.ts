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

import type { Complex } from 'treb-base-types/src';

export interface ComplexMatrixType {
  array: Complex[][];
  m: number;
  n: number;
  error?: boolean;
}

export interface RealMatrixType {
  array: number[][];
  m: number;
  n: number;
  error?: boolean;
}

/** returns a aquare complex matrix of size n, initialized to 0 */
const ComplexMatrix = (n: number): ComplexMatrixType => {
  const mat: ComplexMatrixType = {
    m: n, n, array: [],
  };
  for (let i = 0; i < n; i++) {
    const row: Complex[] = [];
    for (let j = 0; j < n; j++) {
      row.push({real: 0, imaginary: 0});
    }
    mat.array.push(row);
  }
  return mat;
}

/** returns a aquare complex matrix of size n, initialized to 0 */
const RealMatrix = (n: number): RealMatrixType => {
  const mat: RealMatrixType = {
    m: n, n, array: [],
  };
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(0);
    }
    mat.array.push(row);
  }
  return mat;
}

// not used? (...)

/* * returns the identity matrix of size n, as complex * /
const ComplexIdentity = (n: number): ComplexMatrixType => {
  const mat = ComplexMatrix(n);
  for (let i = 0; i < n; i++) {
    mat.array[i][i].real = 1;
  }
  return mat;
};
*/

export const PolarToRectangular = (a: { r: number, theta: number }): Complex => {

  const { r, theta } = a;

  const real = r * Math.cos(theta);
  const imaginary = r * Math.sin(theta);

  // console.info("P2R",  `r ${r} theta (o) ${theta * 57.29577951308232}`, '->', `${real||0}${imaginary < 0 ? '' : '+'}${imaginary}i`);

  return { real, imaginary }
};

export const RectangularToPolar = (value: Complex): { r: number, theta: number } => {

  const r = Math.sqrt(value.real * value.real + value.imaginary * value.imaginary);
  const theta = Math.atan2(value.imaginary, value.real);

  // console.info("R2P", `${value.real||0}${value.imaginary < 0 ? '' : '+'}${value.imaginary}i`, '->', `r ${r} theta (o) ${theta * 57.29577951308232}`);

  return { r, theta };
};

export const TanH = (z: Complex): Complex => {

  // tanh(a+bi) = (sinh a cos b + i cosh a sin b) / (cosh a cos b + i sinh a sin b)

  const num: Complex = {
    real: Math.sinh(z.real) * Math.cos(z.imaginary),
    imaginary: Math.cosh(z.real) * Math.sin(z.imaginary),
  };

  const denom: Complex = {
    real: Math.cosh(z.real) * Math.cos(z.imaginary),
    imaginary: Math.sinh(z.real) * Math.sin(z.imaginary),
  };

  return Divide(num, denom);

};

export const Tan = (z: Complex) => {

  // tan(a+bi) = (tan(a) + i tanh(b)) / (1 - i tan(a) tanh(b))

  return Divide({
    real: Math.tan(z.real),
    imaginary: Math.tanh(z.imaginary),
  }, {
    real: 1,
    imaginary: -(Math.tan(z.real) * Math.tanh(z.imaginary)),
  });

};

export const CosH = (z: Complex): Complex => {

  // cosh(a+bi) = cosh a cos b + i sinh a sin b

  return {
    real: Math.cosh(z.real) * Math.cos(z.imaginary),
    imaginary: Math.sinh(z.real) * Math.sin(z.imaginary),
  };

};

export const Cos = (z: Complex) => {
   
  // sin(a+bi) = cos(a) cosh(b) + i sin(a) sinh(b)

  return {
    real: Math.cos(z.real) * Math.cosh(z.imaginary),
    imaginary: Math.sin(z.real) * Math.sinh(z.imaginary),
  };

};

export const SinH = (z: Complex): Complex => {

  // sinh(a+bi) = sinh a cos b + i cosh a sin b

  return {
    real: Math.sinh(z.real) * Math.cos(z.imaginary),
    imaginary: Math.cosh(z.real) * Math.sin(z.imaginary),
  };
  
};

export const Sin = (z: Complex) => {
   
  // sin(a+bi) = sin(a) cosh(b) + i cos(a) sinh(b)

  return {
    real: Math.sin(z.real) * Math.cosh(z.imaginary),
    imaginary: Math.cos(z.real) * Math.sinh(z.imaginary),
  };

};

export const ASin = (cpx: Complex) => {

  if (cpx.imaginary === 0) {
    return { 
      real: Math.asin(cpx.real), 
      imaginary: 0,
    };
  }

  const x = Math.hypot(cpx.real + 1, cpx.imaginary) / 2;
  const y = Math.hypot(cpx.real - 1, cpx.imaginary) / 2;

  const sum = x + y;
  const difference = x - y;

  const result: Complex = {
    real: Math.asin(difference),
    imaginary: Math.log(sum + Math.sqrt(sum * sum - 1)),
  };

  if(cpx.imaginary < 0 || (cpx.imaginary === 0 && cpx.real > 1)) {
    result.imaginary = -result.imaginary;
  }

  return result;

};

export const ACos = (cpx: Complex) => {

  if (cpx.imaginary === 0) {
    return {
      real: Math.acos(cpx.real),
      imaginary: 0,
    };
  }

  const asin = ASin(cpx);

  return {
    real: Math.PI / 2 - asin.real,
    imaginary: asin.imaginary,
  }

};

export const Product = (...args: Complex[]): Complex => {
  let base = args.shift();
  if (!base) { 
    return { real: 0, imaginary: 0 };
  }
  for (const arg of args) {
    base = Multiply(base, arg);
  }
  return base;
};

export const Multiply = (a: Complex, b: Complex): Complex => {
  return {
    real: (a.real * b.real) - (a.imaginary * b.imaginary),
    imaginary: a.real * b.imaginary + a.imaginary * b.real,
  }
};

export const RealSum = (a: RealMatrixType, b: RealMatrixType): RealMatrixType => {
 
  const array: number[][] = [];
  for (let i = 0; i < a.m; i++) {
    const row: number[] = [];
    for (let j = 0; j < a.n; j++) {
      row.push(a.array[i][j] + b.array[i][j]);
    }
    array.push(row);
  }
  return {m: a.m, n: a.n, array};

};

export const RealProduct = (a: RealMatrixType, b: RealMatrixType): RealMatrixType => {
  const array: number[][] = [];

  for (let i = 0; i < a.m; i++) {
    const row: number[] = [];
    for (let j = 0; j < b.n; j++) {
      let sum = 0;
      for (let k = 0; k < a.n; k++) {
        sum += a.array[i][k] * b.array[k][j];
      }
      row.push(sum);
    }
    array.push(row);
  }

  return { array, m: a.m, n: b.n };
  
};

export const ComplexProduct = (a: ComplexMatrixType, b: ComplexMatrixType): Complex[][] => {

  const result: Complex[][] = [];

  for (let i = 0; i < a.m; i++) {
    const row: Complex[] = [];
    for (let j = 0; j < b.n; j++) {
      const sum = { real: 0, imaginary: 0 };
      for (let k = 0; k < a.n; k++) {
        // const product = Multiply(a.array[i][k], b.array[k][j]);
        sum.real += ((a.array[i][k].real * b.array[k][j].real) - (a.array[i][k].imaginary * b.array[k][j].imaginary));
        sum.imaginary += (a.array[i][k].real * b.array[k][j].imaginary + a.array[i][k].imaginary * b.array[k][j].real);
      }
      row.push(sum);
    }
    result.push(row);
  }

  return result;

};

interface SplitFlags {

  /** the matrix has some real values != 0 */
  real_values: boolean;

  /** the matrix has some imaginary values != 0 */
  imaginary_values: boolean;

  /** the matrix is square */
  square: boolean;

  /** the matrix has unit diagonal */
  unit_diagonal: boolean;

}

/**
 * this function DOES NOT check if the matrix is square, because it's
 * recursive and we don't want to do that every time. check before you
 * call it.
 */
export const ComplexDeterminant = (matrix: ComplexMatrixType): Complex => {

  const det: Complex = { real: 0, imaginary: 0 };
  const n = matrix.n;

  if (n == 2) {

    const a = Multiply(matrix.array[0][0], matrix.array[1][1]);
    const b = Multiply(matrix.array[1][0], matrix.array[0][1]);

    return {
      real: a.real - b.real,
      imaginary: a.imaginary - b.imaginary,
    };

  }

  const submatrix = ComplexMatrix(matrix.n);

  for (let x = 0; x < n; x++) {
    let subi = 0;
    for (let i = 1; i < n; i++) {
       let subj = 0;
       for (let j = 0; j < n; j++) {
          if (j == x) {
            continue;
          }
          submatrix.array[subi][subj] = {...matrix.array[i][j]};
          subj++;
       }
       subi++;
    }

    submatrix.m = submatrix.n = n - 1;

    const factor = Math.pow(-1, x)
    const product = Multiply({
      real: matrix.array[0][x].real * factor,
      imaginary: matrix.array[0][x].imaginary * factor,
    }, ComplexDeterminant(submatrix));

    det.real += product.real;
    det.imaginary += product.imaginary;

  }

  return det;

};

export const RealDeterminant = (matrix: RealMatrixType): number => {

  let det = 0;
  const n = matrix.n;
  const submatrix = RealMatrix(n);

  if (n === 2) {
    return( (matrix.array[0][0] * matrix.array[1][1]) - (matrix.array[1][0] * matrix.array[0][1]));
  }

  for (let x = 0; x < n; x++) {
    let subi = 0;
    for (let i = 1; i < n; i++) {
       let subj = 0;
       for (let j = 0; j < n; j++) {
          if (j == x)
            continue;
          submatrix.array[subi][subj] = matrix.array[i][j];
          subj++;
       }
       subi++;
    }

    console.info(JSON.stringify(submatrix.array, undefined, 2));

    submatrix.n = submatrix.m = n - 1;
    det = det + (Math.pow(-1, x) * matrix.array[0][x] * RealDeterminant(submatrix));
 }

 // console.info("N", n, "det", det);

 return det;

};

/**
 * split a complex matrix into two real matrices representing the real and imaginary parts
 */
const Split = (matrix: ComplexMatrixType): {real: RealMatrixType, imaginary: RealMatrixType, flags: SplitFlags} => {

  const flags = {
    real_values: false,
    imaginary_values: false,
    square: (matrix.m === matrix.n),
    unit_diagonal: true,
  };

  const real: RealMatrixType = {
    m: matrix.m,
    n: matrix.n,
    array: [],
  };

  const imaginary: RealMatrixType = {
    m: matrix.m,
    n: matrix.n,
    array: [],
  };

  for (let i = 0; i< matrix.m; i++) {
    const row = matrix.array[i];
    const real_row: number[] = [];
    const imaginary_row: number[] = [];

    for (let j = 0; j< matrix.n; j++) {

      if (row[j].real) { flags.real_values = true; }
      if (row[j].imaginary) { flags.imaginary_values = true; }

      if (j === i && flags.unit_diagonal) {
        if (row[j].real !== 1 || row[j].imaginary !== 0) {
          flags.unit_diagonal = false;
        }
      }

      real_row.push(row[j].real);
      imaginary_row.push(row[j].imaginary);
    }

    real.array.push(real_row);
    imaginary.array.push(imaginary_row);
  }

  return {real, imaginary, flags};

};

/**
 * clone a matrix using slice() on rows? hope this is faster than JSONJSON.
 * 
 * actually if you care about perf, should probably not use functional-style
 */
const CloneReal = (matrix: RealMatrixType): RealMatrixType => {
  const array = matrix.array.map(row => row.slice(0));
  return { m: matrix.m, n: matrix.n, array };
};

export const RealInverse = (matrix: RealMatrixType): RealMatrixType|undefined => {

  if (matrix.m !== matrix.n) {
    return undefined;
  }

  const result = CloneReal(matrix);

  // FIXME: exception on !square, zero in diagonal, &c

  const M = result.array;

  let sum = 0;
  let i = 0;
  let j = 0;
  let k = 0;

  const order = matrix.m;

  for (i = 1; i < order; i++) M[0][i] /= M[0][0]; // normalize row 0

  for (i = 1; i < order; i++) {
    for (j = i; j < order; j++) { // do a column of L
      sum = 0;
      for (k = 0; k < i; k++) {
        sum += M[j][k] * M[k][i];
      }
      M[j][i] -= sum;
    }
    if (i == order - 1) continue;
    for (j = i + 1; j < order; j++) { // do a row of U
      sum = 0;
      for (k = 0; k < i; k++) {
        sum += M[i][k] * M[k][j];
      }
      M[i][j] = (M[i][j] - sum) / M[i][i];
    }
  }

  for (i = 0; i < order; i++) { // invert L
    for (j = i; j < order; j++) {
      let x = 1;
      if (i != j) {
        x = 0;
        for (k = i; k < j; k++) {
          x -= M[j][k] * M[k][i];
        }
      }
      M[j][i] = x / M[j][j];
    }
  }
  for (i = 0; i < order; i++) {  // invert U
    for (j = i; j < order; j++) {
      if (i == j) continue;
      sum = 0;
      for (k = i; k < j; k++) {
        sum += M[k][j] * ((i == k) ? 1 : M[i][k]);
      }
      M[i][j] = -sum;
    }
  }
  for (i = 0; i < order; i++) {   // final inversion
    for (j = 0; j < order; j++) {
      sum = 0;
      for (k = ((i > j) ? i : j); k < order; k++) {
        sum += ((j == k) ? 1 : M[j][k]) * M[k][i];
      }
      M[j][i] = sum;
    }
  }

  return result;

};

/**
 * returns the inverse of a complex matrix. the first step in this is
 * to split into {real, imaginary} and then invert the real matrix. we
 * can use that as a shortcut if there are no imaginary values, just return
 * the inverted real matrix (here converted to complex, but we don't necessarily 
 * need to do that)
 * 
 * @param a 
 * @returns 
 */
export const MatrixInverse = (a: ComplexMatrixType): Complex[][] | undefined => {

  // FIXME: support for this algorithm?

  const result: Complex[][] = [];

  if (a.m !== a.n) { return undefined; }

  const { real, imaginary, flags } = Split(a);

  const C1 = RealInverse(real);

  if (!C1) { return undefined; }

  if (!flags.imaginary_values) {

    // shortcut, 
    
    for (let i = 0; i < a.m; i++) {
      const row: Complex[] = [];
      for (let j = 0; j < a.n; j++) {
        row.push({
          real: C1.array[i][j],
          imaginary: 0,
        });
      }
      result.push(row);
    }

    return result;
  }

  const C2 = RealProduct(C1, imaginary);
  const C3 = RealProduct(imaginary, C2);
  const C4 = RealSum(real, C3);
  const C5 = RealInverse(C4);

  if (!C5) { return undefined; }

  const C6 = RealProduct(C2, C5);

  for (let i = 0; i < a.m; i++) {
    const row: Complex[] = [];
    for (let j = 0; j < a.n; j++) {
      row.push({
        real: C5.array[i][j],
        imaginary: -C6.array[i][j],
      });
    }
    result.push(row);
  }

  return result;

};

export const Divide = (a: Complex, b: Complex): Complex => {

  const conjugate = { real: b.real, imaginary: -b.imaginary };
  const numerator = Multiply(a, conjugate);
  const denominator = Multiply(b, conjugate);

  return {
    real: numerator.real / denominator.real,
    imaginary: numerator.imaginary / denominator.real,
  };

};

export const Exp = (value: Complex): Complex => {

  const a = value.real || 0;
  const b = value.imaginary || 0;

  // e^(a + bi) = e^a * e^ib = e^a * (cos b - i sin b)

  return Multiply(
    { real: Math.exp(a), imaginary: 0, },
    { real: Math.cos(b), imaginary: Math.sin(b), },
  );

};

/**
 * from polar form, the principal value is
 * Log z = ln r + iθ
 */
export const Log = (value: Complex): Complex => {
  const polar = RectangularToPolar(value);
  return {
    real: Math.log(polar.r),
    imaginary: polar.theta,
  };
}

/**
 * returns a^b where a and b are (possibly) complex
 */
export const Power = (a: Complex, b: Complex): Complex => {

  if (!b.imaginary) {

    // we could potentially clean up some simple cases, to help
    // with numerical stability. in particular, I'm thinking about
    // square roots of reals (possibly negative).

    /*
    if (b.real === .5 && !a.imaginary) {
      if (a.real < 0) {
        return {
          real: 0,
          imaginary: Math.sqrt(-a.real),
        };
      }
      return {
        real: Math.sqrt(a.real),
        imaginary: 0,
      };
    }
    */

    const polar = RectangularToPolar(a);
    const value = PolarToRectangular({
      r: Math.pow(polar.r, b.real),
      theta: polar.theta * b.real,
    });

    return value;

  }
  else {

    // in this case, 
    // (a + bi)^(c + di) = exp((c + di) * Log(a + bi))

    return Exp(Multiply(b, Log(a)));

  }


};

