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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

/** calculated human-friendly scale for rendering axes */
export interface RangeScale {
  scale: number;
  step: number;
  count: number;
  min: number;
  max: number;
}

/**
 * making this a little more generic so we can use it outside of charts.
 * specifically, for the sheet "histogram table" function. for that, we
 * do need to ensure that the count is not greater than our request.
 * 
 * we have a new parameter for that, default behavior should not change.
 */
export const Scale = (min: number, max: number, count = 6.5, limit_count = false, discrete = false): RangeScale => {

  if (max === min) { 

    // we should either have optional behavior here or have this as
    // some sort of wrapper method -- it just seems arbitrary

    max++;
    if (min) {
      min--;
    }
  }
  else {
    
    // let's fix this specific problem, where you get accumulated fp errors. round to 5 places...

    // const tmp_range = max - min;
    const rounded = Math.round(max * 100000) / 100000;

    if (Math.abs(rounded - max) / (max - min) < 1e-5) {
      max = rounded;
    }
    
  }

  const range = max - min;

  const log10 = Math.log(range) / Math.log(10); // just avoid the problem (problem being IE11 lack of Math.log10)

  let scale = Math.floor(Math.abs(log10)) * (log10 < 0 ? -1 : 1) - 1;

  // so if you claim you have discrete data, we want the minimum 
  // step to be 1. we also have slightly different acceptable steps.

  if (discrete) {
    scale = Math.max(0, scale);
  }
  
  const steps = discrete ? 
      [1, 2, 5, 10, 15, 20, 25, 50, 100] : 
      [.1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100];

  let step = -1;
  let delta = 0;

  for (const x of steps) {
    const test_step = x * Math.pow(10, scale);
    const test_min = Math.floor(min / test_step) * test_step;
    const test_max = Math.ceil(max / test_step) * test_step;
    const test_count = (test_max - test_min) / test_step;
    const test_delta = Math.abs(test_count - count);

    if (step < 0 || test_delta < delta) {
      if (!limit_count || (test_count <= count)) {
        delta = test_delta;
        step = test_step;
      }
    }

    /*
    else if (!limit_count && (test_delta < delta)) {
      delta = test_delta;
      step = test_step;
    }
    else if (limit_count && test_delta < delta && test_count <= count) {
      delta = test_delta;
      step = test_step;
    }
    */

    /*

    if (step < 0 || test_delta < delta){
      delta = test_delta;
      step = test_step;
    }
    else if (step >= 0 && test_delta > delta) {
      if (limit_count) {
        min = Math.floor(min / step) * step;
        max = Math.ceil(max / step) * step;
        const check = Math.round((max - min) / step);
        if (check > count) { 
          delta = test_delta;
          step = test_step;
          continue; 
        }
      }
      break;
    }
    */

  }

  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  count = Math.round((max - min) / step); // accounts for fp errors

  return { scale, step, count, min, max };

}