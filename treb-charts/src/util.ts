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

// import type { UnionValue } from 'treb-base-types';
import type { RangeScale} from 'treb-utils';
import { Scale } from 'treb-utils';

export class Util {

  /**
   * given a passed range, find the best scale range. count is just a
   * suggestion -- we try to get as close as possible.
   */
  public static Scale(min: number, max: number, count = 6.5, limit_count?: boolean, discrete?: boolean): RangeScale {
    return Scale(min, max, count, limit_count, discrete);
  }

  public static Range(data: Array<number|undefined>) {

    let min: number|undefined;
    let max: number|undefined;

    for (const value of data) {
      if (typeof value === 'undefined') { continue; }
      if (typeof min === 'undefined' || min > value) { min = value; }
      if (typeof max === 'undefined' || max < value) { max = value; }
    }

    const range = (typeof min === 'undefined' || typeof max === 'undefined') ? 0 : max - min;

    return { min, max, range };
  }

  public static ApplyScale(value: number, range: number, scale: RangeScale) {
    return range * (value - scale.min) / (scale.max - scale.min);
  }

  /**
   * can we replace this with Array.flatMap?
   */
  public static Flatten<T>(args?: T|T[]|T[][]) {
    let flat: T[] = [];
    if (Array.isArray(args)) {
      for (const element of args) {
        if (Array.isArray(element)) {
          flat = flat.concat(this.Flatten(element));
        }
        else {
          flat.push(element);
        }
      }
    } 
    else if (typeof args !== 'undefined') {
      flat.push(args);
    }
    return flat;
  }

}
  

