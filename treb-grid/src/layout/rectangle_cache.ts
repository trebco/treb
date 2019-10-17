
import { Rectangle } from 'treb-base-types';

/**
 * FIXME: efficiency of using sparse arrays here?
 *
 * (vs what, a lookup table? sparse arrays are basically a lookup
 * table, and we can assume they're reasonably efficient)
 */
export class RectangleCache {

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
