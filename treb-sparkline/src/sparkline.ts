
import { Cell } from 'treb-base-types';

/**
 * three possible cases: 
 * 
 * (1) array of numbers, possibly including missing values
 * (2) typed array
 * (3) nested array, so we need to recurse and concatenate 
 *
 * there's actually one more case, where data comes in from serialized
 * representation (loading file); in that case it's an object with numeric
 * indexes (sadly)
 */
const Unpack = (underlying: any): number[] => {

  if (Array.isArray(underlying)) {
    const test = underlying[0];
    if (Array.isArray(test) || test instanceof Float64Array || test instanceof Float32Array) {
      return underlying.reduce((a, subset) => a.concat(Unpack(subset)), []);
    }
    else {
      return underlying.map(test => isNaN(test) ? undefined : test);
    }
  }
  else if (underlying instanceof Float32Array || underlying instanceof Float64Array) {
    return Array.prototype.slice.call(underlying);
  }
  else if (underlying && typeof underlying === 'object') {

    const keys = Object.keys(underlying);
    const len = keys.length;
    
    // this is maybe overdoing it? (...) there's probably a smarter test
    // if (keys.every(key => !isNaN(Number(key)))) {

    // check first, last
    if (typeof underlying['0'] !== 'undefined' && typeof underlying[(len - 1).toString()] !== 'undefined') {
      const data: number[] = [];

      // we probably don't have to explicitly use strings -- although it's not
      // clear that it would be any faster because someone still has to do the
      // conversion

      for (let i = 0; i < len; i++) {
        data[i] = underlying[i.toString()];
      }
      return data;
    }

  }

  return [];

};

const SparklineCommon = (cell: Cell, number_of_colors = 2) => {

  // the cell function echoes back arguments. the first argument
  // should be an array, but it will be 2D...

  let values: Array<number|undefined> = [];

  // if you pass a color, it gets used for both positive and negative -- 
  // pass two colors to define both

  let colors = number_of_colors === 2 ? ['green', 'red'] : ['#888'];

  if (Array.isArray(cell.calculated)) {
    values = Unpack(cell.calculated[0]);
    if (typeof cell.calculated[1] === 'string') {
      colors = [cell.calculated[1]];
      if (number_of_colors > 1) {
        cell.calculated[2] = (typeof cell.calculated[2] === 'string') ? cell.calculated[2] : cell.calculated[1];
      }
    }
  }

  return { values, colors };

};

export const RenderSparklineLine = (
  width: number,
  height: number,
  context: CanvasRenderingContext2D,
  cell: Cell,
) => {

  const {values, colors} = SparklineCommon(cell, 1);

  const x_margin = 0.05; // FIXME: parameterize? (...)
  const y_margin = 0.10;

  let line_width = 1;
  if (Array.isArray(cell.calculated) && typeof cell.calculated[2] === 'number') {
    line_width = cell.calculated[2];
  }

  let min = 0;
  let max = 0;
  let first_index = -1;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (typeof value === 'number') {
      if (first_index >= 0) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      else {
        first_index = i;
        min = max = value;
      }
    }
  }

  if (min !== max) {

    const step = (width * (1 - 2 * x_margin)) / (values.length - 1);
    const range = max - min;
    const pixel_range = height * (1 - 2 * y_margin); // ?
    const base = height * y_margin;

    context.strokeStyle = colors[0];
    context.lineWidth = line_width;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    let x = width * x_margin + step * first_index;
    let y = height - ((values[first_index] as number) - min) * pixel_range / range - base;

    context.beginPath();
    context.moveTo(x, y);

    for (let i = first_index + 1; i < values.length; i++) {
      const value = values[i];
      if (typeof value === 'number') {
        x = width * x_margin + step * i;
        y = height - (value - min) * pixel_range / range - base;
        context.lineTo(x, y);
      }
    }

    context.stroke();
   
  }

};


export const RenderSparklineColumn = (
  width: number,
  height: number,
  context: CanvasRenderingContext2D,
  cell: Cell,
) => {

  const {values, colors} = SparklineCommon(cell);

  const x_margin = 0.05; // FIXME: parameterize? (...)
  const y_margin = 0.10;

  let min = 0;
  let max = 0;

  for (const value of values) {
    if (typeof value === 'number') {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (values.length) {

    const step = ((width * (1 - 2 * x_margin)) / (values.length));
    const pixel_range = (height * (1 - 2 * y_margin)); // ?
    const base = (height * y_margin);

    // let x = Math.round(width * x_margin);

    if (min !== max) { 

      if (min < 0 && max > 0) {

        const range = max - min;
        const zero = base + max / range * pixel_range;

        // use an indexed loop so we can multiply to get x instead of adding
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (typeof value === 'number') {
            const x = (width * x_margin + i * step);
            const bar_height = (Math.abs(value) / range) * pixel_range;

            if (value >= 0) { 
              context.fillStyle = colors[0];
              const top = zero - bar_height;
              context.fillRect(x + 2, top, step - 2, bar_height);
              }
            else { 
              context.fillStyle = colors[1];
              const top = zero;
              context.fillRect(x + 2, top, step - 2, bar_height);
              }

          }
        }  

      }
      else if (max > 0) {

        // all positive

        context.fillStyle = colors[0];
        const range = max - min;

        // use an indexed loop so we can multiply to get x instead of adding
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (typeof value === 'number') {
            const x = (width * x_margin + i * step);
            const bar_height = (value / range) * pixel_range;
            const top = height - base - bar_height;
            context.fillRect(x + 2, top, step - 2, bar_height);
          }
        }  

      }
      else {

        // all negative

        context.fillStyle = colors[1];
        const range = max - min;

        // use an indexed loop so we can multiply to get x instead of adding
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (typeof value === 'number') {
            const x = (width * x_margin + i * step);
            const bar_height = (Math.abs(value) / range) * pixel_range;
            const top = base;
            context.fillRect(x + 2, top, step - 2, bar_height);
          }
        }  

      }

    }

  }

};
