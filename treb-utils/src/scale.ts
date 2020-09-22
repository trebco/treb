
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
export const Scale = (min: number, max: number, count = 6.5, limit_count = false): RangeScale => {

  if (max === min) { 

    // we should either have optional behavior here or have this as
    // some sort of wrapper method -- it just seems arbitrary

    max++;
    if (min) {
      min--;
    }
  }

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
  }

  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  count = Math.round((max - min) / step); // accounts for fp errors

  return { scale, step, count, min, max };

}