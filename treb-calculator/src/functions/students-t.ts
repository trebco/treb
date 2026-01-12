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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import { BetaInc, LnGamma } from './beta';
import { InverseNormal } from './normal';

export const tCDF = (t: number, df: number) => {
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const ib = BetaInc(x, a, b);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
};

export const tPDF = (t: number, nu: number): number => {

  const logNumerator = LnGamma((nu + 1) / 2);
  const logDenominator = LnGamma(nu / 2) + 0.5 * Math.log(nu * Math.PI);
  const logFactor = -((nu + 1) / 2) * Math.log(1 + (t * t) / nu);

  const logPDF = logNumerator - logDenominator + logFactor;

  return Math.exp(logPDF);

}

export const tInverse = (p: number, df: number) => {

  const EPS = 1e-12;

  let x = 1;

  // Hill's approximation for initial guess

  {
    const t = InverseNormal(p);
    const g1 = (Math.pow(t, 3) + t) / 4;
    const g2 = ((5 * Math.pow(t, 5)) + (16 * Math.pow(t, 3)) + (3 * t)) / 96;
    const g3 = ((3 * Math.pow(t, 7)) + (19 * Math.pow(t, 5)) + (17 * Math.pow(t, 3)) - 15 * t) / 384;
    const g4 = ((79 * Math.pow(t, 9)) + (776 * Math.pow(t, 7)) + (1482 * Math.pow(t, 5)) - (1920 * Math.pow(t, 3)) - (945 * t)) / 92160;

    x = t + g1 / df + g2 / Math.pow(df, 2) + g3 / Math.pow(df, 3) + g4 / Math.pow(df, 4);
  }

  for (let i = 0; i < 16; i++) {

    const error = tCDF(x, df) - p;
    if (Math.abs(error) < EPS) {
      break;
    }

    const derivative = tPDF(x, df);
    if (derivative === 0) {
      break;
    }

    const delta = error / derivative;
    const step = Math.max(-1, Math.min(1, delta));

    x -= step;

  }

  return x;

};

