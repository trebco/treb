
import { Givens } from './givens';
import * as Matrix from './matrix';
import { RPoly } from './rpoly';

export class Polynomial {

  /**
   * return roots of polynomial
   * 
   * @param coefficients 
   * @returns array of complex numbers 
   */
  public static Roots(coefficients: number[]): Array<{
        real: number, 
        imaginary: number,
      }> {

    // reverse, remove any leading zeros and adjust degree

    const op = coefficients.slice(0);
    op.reverse();
    while (op.length > 0 && op[0] === 0) {
      op.splice(0, 1);
    }
    const len = op.length;
    const degree = len - 1;

    const zero_r: number[] = [];
    const zero_i: number[] = [];

    const result = new RPoly().findRoots(op, degree, zero_r, zero_i);

    const complex: Array<{
      real: number, 
      imaginary: number,
    }> = [];

    for (let i = 0; i < result; i++) {
      complex.push({real: zero_r[i] || 0, imaginary: zero_i[i] || 0});
    }

    return complex;
  }

  /**
   * apply polynomial for x
   */
  public static Apply(coefficients: number[], x: number) {
    
    if (coefficients.length === 0) {
      return 0;
    }

    let result = 0;
    let xn = 1;

    for (let i = 0; i < coefficients.length; i++) {
      result += xn * coefficients[i];
      xn *= x;
    }

    return result;

  }

  /**
   * @returns coefficients -- inverted? 
   */
  public static Fit(x: number[], y: number[], degree: number): number[] {

    if (x.length !== y.length) {
      throw new Error('invalid data (x.length !== y.length)');
    }

    if (!x.length) {
      throw new Error('invalid data (len = 0)');
    }

    x = x.map(test => typeof test === 'number' ? test : 0);
    y = y.map(test => typeof test === 'number' ? test : 0);

    degree++; // account for scalar term (x^0)

    const len = x.length;

    const y_matrix = Matrix.FromData(y.map(x => [x]));

    const x_matrix = Matrix.Zero(len, degree);
    for (let r = 0; r < len; r++) {
      let value = 1.0;
      for (let c = 0; c < degree; c++) {
        x_matrix.data[r][c] = value;
        value *= x[r];
      }
    }

    // transpose X matrix
    const xt_matrix = Matrix.Transpose(x_matrix);

    // multiply transposed X matrix with X matrix
    const xtx_matrix = Matrix.Multiply(xt_matrix, x_matrix);

    // multiply transposed X matrix with Y matrix
    const xty_matrix = Matrix.Multiply(xt_matrix, y_matrix);

    const givens = new Givens();
    givens.Decompose(xtx_matrix);

    const coefficients = givens.Solve(xty_matrix);
    return coefficients.data[0];

  }

}



