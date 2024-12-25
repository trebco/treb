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

//
// functions and constants for gamma distribution. we're
// returning false instead of throwing so we can return
// a spreadsheet-style eror. TODO: optional?
//

const max_iterations = 1000;
const epsilon = 3.0e-9;
const min_value = 1.0e-30;

/**
 * faster approximation for real numbers
 */
export const gamma_ln = (z: number): number => {

  let x = z - 1.0;
  let y = x + 5.5;
  y -= (x + 0.5) * Math.log(y);
  let a = 1.0;

  const coefficients = [
    76.18009173,
    -86.50532033,
    24.01409822,
    -1.231739516,
    0.120858003e-2,
    -0.536382e-5,
  ];

  for (const coeff of coefficients) {
    a += coeff / (++x);
  }

  return (-y + Math.log(2.50662827465 * a));

};

/** 
 * series representation
 */
export const gamma_series = (a: number, x: number): number|false => {

  const gamma_ln_a = gamma_ln(a);

  if (x === 0) {
    return 0;
  }

  let ap = a;
  let sum = 1.0 / a;
  let del = sum;
  for (let n = 1; n < max_iterations; n++) {
    ++ap;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * epsilon) {
      return sum * Math.exp(-x + a * Math.log(x) - (gamma_ln_a));
    }
  }

  // throw new Error('too many iterations');
  console.error('too many iterations');
  return false;

};

/**
 * continued fraction
 */
export const gamma_cf = (a: number, x: number): number|false => {

  const gamma_ln_a = gamma_ln(a);

  let b = x + 1.0 - a;
  let c = 1.0 / min_value;
  let d = 1.0 / b;
  let h = d;

  for (let i = 1; i <= max_iterations; i++) {

    const an = -i * (i - a); b += 2.0; d = an * d + b;

    if (Math.abs(d) < min_value) d = min_value;
    c = b + an / c;

    if (Math.abs(c) < min_value) c = min_value;

    d = 1.0 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1.0) < epsilon) {
      return Math.exp(-x + a * Math.log(x) - (gamma_ln_a)) * h;
    }

  }

  // throw new Error('too many iterations');
  console.error('too many iterations');
  return false;

};

/**
 * regularized gamma function; CDF of gamma distribution with scale 1
 */
export const gamma_p = (a: number, x: number) => {

  if (x < 0.0 || a <= 0.0) {
    // throw new Error('invalid parameter');
    console.error('invalid parameter');
    return false;
  }
  if (x < (a + 1.0)) {
    return gamma_series(a, x);
  }
  else {
    const cf = gamma_cf(a, x);
    if (cf === false) { return false; }
    return 1 - cf;
  }

}

/** 
 * regularized gamma function 
 */
export const gamma_q = (a: number, x: number) => {

  if (x < 0.0 || a <= 0.0) {
    // throw new Error('invalid parameter');
    console.error('invalid parameter');
    return false;
  }
  if (x < (a + 1.0)) {
    const series = gamma_series(a, x);
    if (series === false) { return false; }
    return 1 - series;
  }
  else {
    return gamma_cf(a, x);
  }
}
