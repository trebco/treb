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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

const EPSILON = 2.2204460492503131e-16;

/**
 * natural log of (1+x)
 */
const Log1p = (x: number) => {
  const y = 1 + x;
  return Math.log(y) - ((y - 1) - x) / y;
}

/** 
 * continued fraction expansion 
 */
export const BetaContFrac = (a: number, b: number, x: number, epsabs: number) => {

  const cutoff = 2.0 * Number.MIN_VALUE;

  let cf = 0;

  let numerator = 1.0;
  let denominator = 1.0 - (a + b) * x / (a + 1.0);

  if (Math.abs(denominator) < cutoff) {
    denominator = Number.NaN;
  }

  denominator = 1.0 / denominator;
  cf = denominator;

  for (let k = 1; k <= 512; k++) {

    let coeff = k * (b - k) * x / (((a - 1.0) + 2 * k) * (a + 2 * k));
    let delta_frac = 0;

    denominator = 1.0 + coeff * denominator;
    numerator = 1.0 + coeff / numerator;

    if (Math.abs(denominator) < cutoff) {
      denominator = Number.NaN;
    }
    if (Math.abs(numerator) < cutoff) {
      numerator = Number.NaN;
    }

    denominator = 1.0 / denominator;

    delta_frac = denominator * numerator;
    cf *= delta_frac;

    coeff = -(a + k) * (a + b + k) * x / ((a + 2 * k) * (a + 2 * k + 1.0));

    denominator = 1.0 + coeff * denominator;
    numerator = 1.0 + coeff / numerator;

    if (Math.abs(denominator) < cutoff) {
      denominator = Number.NaN;
    }
    if (Math.abs(numerator) < cutoff) {
      numerator = Number.NaN;
    }

    denominator = 1.0 / denominator;

    delta_frac = denominator * numerator;
    cf *= delta_frac;

    if ((Math.abs(delta_frac - 1.0) < 2.0 * EPSILON) || (cf * Math.abs(delta_frac - 1.0) < epsabs)) {
      return cf;
    };

  }

  return Number.NaN;

};

/**
 * inverse beta function for beta (a, b)
 */
export const InverseBeta = (p: number, a: number, b: number): number => {

  if (a < 0.0 || b < 0.0) {
    return Number.NaN;
  }

  if (p <= 0) {
    return 0.0;
  }

  if (p >= 1) {
    return 1.0;
  }

  if (p > 0.5) {
    return 1 - InverseBeta(1 - p, b, a);
  }

  const mean = a / (a + b);

  let x = 0;

  if (p < 0.1) {
    const lx = (Math.log(a) + LnGamma(a) + LnGamma(b) - LnGamma(a + b) + Math.log(p)) / a;
    if (lx <= 0) {
      x = Math.exp(lx);
      x *= Math.pow(1 - x, -(b - 1) / a);
    }
    else {
      x = mean;
    }

    if (x > mean) {
      x = mean;
    }
  }
  else {
    x = mean;
  }

  for(let n = 0; n < 64; n++) {

    const dP = p - BetaCDF(x, a, b);
    const phi = BetaPDF(x, a, b);

    if (dP === 0) {
      return x;
    }

    const lambda = dP / Math.max(2 * Math.abs(dP / x), phi);

    const step0 = lambda;
    const step1 = -((a - 1) / x - (b - 1) / (1 - x)) * lambda * lambda / 2;
    let step = step0;

    if (Math.abs(step1) < Math.abs(step0)) {
      step += step1;
    }
    else {
      step *= 2 * Math.abs(step0 / step1);
    }

    if (x + step > 0 && x + step < 1) {
      x += step;
    }
    else {
      x = Math.sqrt(x) * Math.sqrt(mean);
    }

    if (Math.abs(step0) <= 1e-10 * x) {
      return x;
    }

  }

  return x;

};

/**
 * this is a faster approximation for real numbers
 */
export const LnGamma = (z: number) => {

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

/** PDF of the beta distribution */
export const BetaPDF = (x: number, a: number, b: number) => {
  if (x < 0 || x > 1) {
    return 0;
  }
  return Math.exp(LnGamma(a + b) - LnGamma(a) - LnGamma(b)) *
    Math.pow(x, a - 1) * Math.pow(1 - x, b - 1);
};

/** CDF of the beta distribution */
export const BetaCDF = (x: number, a: number, b: number) => {

  if (x <= 0.0) {
    return 0.0;
  }

  if (x >= 1.0) {
    return 1.0;
  }

  const ln_beta = (LnGamma(a) + LnGamma(b) - LnGamma(a + b));
  const ln_pre = -ln_beta + a * Math.log(x) + b * Log1p(-x);
  const prefactor = Math.exp(ln_pre);

  if (x < (a + 1.0) / (a + b + 2.0)) {
    const cf = BetaContFrac(a, b, x, 0);
    return (prefactor * cf / a);
  }
  else {
    const epsabs = Math.abs(b / prefactor) * EPSILON;
    const cf = BetaContFrac(b, a, 1.0 - x, epsabs);
    const term = prefactor * cf / b;
    return (1 - term);

  }

};

export const BetaInc = (x: number, a: number, b: number): number => {
  if (x < 0 || x > 1) return 0; // throw new Error("Invalid x in betainc");
  const bt =
    x === 0 || x === 1
      ? 0
      : Math.exp(LnGamma(a + b) - LnGamma(a) - LnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return bt * BetaContFrac(a, b, x, 0) / a;
  } else {
    return 1 - bt * BetaContFrac(b, a, 1 - x, 0) / b;
  }
};


