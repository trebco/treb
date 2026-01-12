
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

/** imprecise but reasonably fast normsinv function */
export const InverseNormal = (q: number): number => {

  if (q === 0.50) {
    return 0;
  }
  
  const p = (q < 1.0 && q > 0.5) ? (1 - q) : q;
  const t = Math.sqrt(Math.log(1.0 / Math.pow(p, 2.0)));
  const x = t - (2.515517 + 0.802853 * t + 0.010328 * Math.pow(t, 2.0)) /
    (1.0 + 1.432788 * t + 0.189269 * Math.pow(t, 2.0) + 0.001308 * Math.pow(t, 3.0));

  return (q > 0.5 ? x : -x);

};