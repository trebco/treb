
/** calculated human-friendly scale for rendering axes */
export interface RangeScale {
  scale: number;
  step: number;
  count: number;
  min: number;
  max: number;
}

export class Util {

  /**
   * given a passed range, find the best scale range. count is just a
   * suggestion -- we try to get as close as possible.
   */
  public static Scale(min: number, max: number, count = 6.5): RangeScale {

    const range = max - min;
    const log10 = // Math.log10(range);
      Math.log(range) / Math.log(10); // just avoid the problem

    const scale = Math.floor(Math.abs(log10)) * (log10 < 0 ? -1 : 1) - 1;
    const steps = [.1, .25, .5, 1, 2.5, 5, 10, 25, 100];

    let step = -1;
    let delta = 0;

    for (const x of steps) {
      const test_step = x * Math.pow(10, scale);
      const test_min = Math.floor(min / test_step) * test_step;
      const test_max = Math.ceil(max / test_step) * test_step;
      const test_count = (test_max - test_min) / test_step;
      const test_delta = Math.abs(test_count - count);

      if (step < 0 || test_delta < delta){
        delta = test_delta;
        step = test_step;
      }
      else if (step >= 0 && test_delta > delta) break;
    }

    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    count = Math.round((max - min) / step); // accounts for fp errors

    return { scale, step, count, min, max };

  }


  /**
   * flatten. we support holes in data, which means undefined values
   * in arrays, but don't push an empty value at the top level (if
   * that makes sense).
   *
   * @param args
   */
  public static Flatten(args: any) {
    let flat: any[] = [];
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
