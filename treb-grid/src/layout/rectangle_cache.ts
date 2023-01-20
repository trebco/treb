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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import type { Rectangle } from 'treb-base-types';

/**
 * FIXME: efficiency of using sparse arrays here?
 *
 * (vs what, a lookup table? sparse arrays are basically a lookup
 * table, and we can assume they're reasonably efficient)
 */
/*export*/ class RectangleCache {

  private cache: Rectangle[][] = [];

  /*

  private hits = 0;
  private misses = 0;

  public Stats(){
    return {
      hits: this.hits,
      misses: this.misses,
      hit_rate: (this.hits + this.misses) ? this.hits / (this.hits + this.misses) : 0,
    };
  }

  */

  /** flush cache */
  public Clear(){
    this.cache = [];
  }

  /**
   * cache lookup.
   * FIXME: why row/column and not address type?
   */
  public Get(column: number, row: number): Rectangle|undefined {

    if (!this.cache[column]) return undefined;
    const rect = this.cache[column][row];
    return rect ? rect.Shift(0, 0) : undefined;

    /*
    if (this.cache[column]) {
      const rect = this.cache[column][row];
      if (rect) {
        this.hits++;
        return rect.Shift(0, 0);
      }
    }
    this.misses++;
    return undefined;
    */
  }

  /**
   * cache set.
   * FIXME: why row/column and not address type?
   */
  public Set(column: number, row: number, rect: Rectangle) {
    if (!this.cache[column]) this.cache[column] = [];
    this.cache[column][row] = rect.Shift(0, 0); // clone
  }

}
