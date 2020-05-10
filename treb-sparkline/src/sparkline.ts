
import { Cell } from 'treb-base-types';

const Unpack = (data: number[]|number[][]): number[] => {
  if(!data.length) return [];
  if(Array.isArray(data[0])) {
    return (data as number[][]).reduce((a, set) => a.concat(set), []);
  }
  return (data as number[]);
};

export const RenderSparklineColumn = (
  width: number,
  height: number,
  context: CanvasRenderingContext2D,
  cell: Cell,
) => {

  // the cell function echoes back arguments. the first argument
  // should be an array, but it will be 2D...

  let values: Array<number|undefined> = [];

  // if you pass a color, it gets used for both positive and negative -- 
  // pass two colors to define both

  let colors = ['green', 'red'];

  if (Array.isArray(cell.calculated)) {
    if (Array.isArray(cell.calculated[0])) {
      const data = Unpack(cell.calculated[0]);
      values = data.map((value: any) => isNaN(value) ? undefined : Number(value));
    }
    if (typeof cell.calculated[1] === 'string') {
      colors = [cell.calculated[1], 
        typeof cell.calculated[2] === 'string' ? cell.calculated[2] : cell.calculated[1]];
    }
  }

  // background

  // bars

  // any?

  let min = 0;
  let max = 0;

  const x_margin = 0.05;
  const y_margin = 0.10;

  if (values.length) {

    for (const value of values) {
      if (typeof value === 'number') {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }

    const step = Math.floor((width * (1 - 2 * x_margin)) / (values.length));
    const pixel_range = Math.floor(height * (1 - 2 * y_margin)); // ?
    const base = Math.round(height * y_margin);

    // let x = Math.round(width * x_margin);

    if (min !== max) { 

      if (min < 0 && max > 0) {

        const range = max - min;
        const zero = base + max / range * pixel_range;

        // use an indexed loop so we can multiply to get x instead of adding
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (typeof value === 'number') {
            const x = Math.round(width * x_margin + i * step);
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
            const x = Math.round(width * x_margin + i * step);
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
            const x = Math.round(width * x_margin + i * step);
            const bar_height = (Math.abs(value) / range) * pixel_range;
            const top = base;
            context.fillRect(x + 2, top, step - 2, bar_height);
          }
        }  

      }

    }

  }

};
