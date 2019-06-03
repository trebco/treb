
import { XML } from './xml';

export interface SparklineOptions {

  /** chart type */
  type?: 'line' | 'column' | 'win-loss';

  /** buffer for zero (as %) so there are no empty columns */
  zero?: number;

  /** column as % of available space, the rest is margin */
  column_width?: number;

}

const DefaultOptions: SparklineOptions = {
  type: 'line',
  zero: 0.025,
  column_width: .9,
};

export type RenderTarget = 'svg'|'canvas';

export class Sparkline {

  protected data: number[] = [];
  protected options: SparklineOptions;

  constructor(options: SparklineOptions = DefaultOptions, data: number[] = []) {
    this.options = {...DefaultOptions, ...options};
    this.Update(data);
  }

  public Update(data: number[] = []) {
    this.data = data.slice(0);
  }

  /**
   * render bars. we reuse for win/loss, using transformed data
   */
  public RenderColumns(data: number[], root: XML) {

    const step = 100 / data.length;
    const g = root.Append('g');
    let x = 0;

    const width = step * (this.options.column_width || 1);
    const margin = (step - width) / 2;

    let {min, max} = this.Range(data);
    let range = max - min;
    const values: number[] = data.slice(0);

    console.info("RANGE", min, max);

    const zero_buffer = range * (this.options.zero || 0);

    // if it doesn't cross zero, expand the range a little bit
    // so we can see bars at minimum (maximum) value

    if (min >= 0 && max >= 0) { // all positive
      data = this.data.map((point) => point - min + zero_buffer);
      max = max - min + zero_buffer;
      min = 0;
      range = max - min;
    }
    else if (min <= 0 && max <= 0) { // all negative
      data = this.data.map((point) => point - max - zero_buffer);
      min = min - max - zero_buffer;
      max = zero_buffer;
      range = max - min;
    }

    const zero = 100 * (max / range);

    // for (const point of data) {
    for (let i = 0; i < data.length; i++) {

      const point = data[i];
      const height = 100 * Math.abs(point) / range;
      const y = point > 0 ? zero - height : zero;

      let class_name = '';
      if (values[i] < 0) class_name = 'negative';
      else if (values[i] > 0) class_name = 'positive';

      g.Append('rect', {
        x: (x + margin).toFixed(4),
        y: (y).toFixed(4),
        width: (width).toFixed(4),
        height: (height).toFixed(4),
        class: class_name,
      });
      x += step;
    }

  }

  /**
   * renders SVG as text
   */
  public RenderSVG() {
    return this.RenderInternal().toString();
  }

  public RenderNode() {
    return this.RenderInternal().toDOM();
  }

  private RenderInternal() {
    const count = this.data.length;
    const root = new XML('svg', {
      class: 'treb-sparkline treb-sparkline-' + this.options.type,
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 100 100',
      preserveAspectRatio: 'none',
    });

    switch (this.options.type) {
    case 'win-loss':
      if (this.data.length) {
        this.RenderColumns(this.data.map((point) => {
          if (point < 0) return -1;
          if (point > 0) return 1;
          return 0;
        }), root);
      }
      break;
    case 'column':
      if (this.data.length) {
        this.RenderColumns(this.data, root);
      }
      break;

    case 'line':
    default:
      if (this.data.length) {

        const d: string[] = [];
        const {min, max} = this.Range();
        const range = max - min;
        const step = 100 / (count - 1);

        let x = 0;

        const Point = (point: number) => {
          const text = `${x.toFixed(4)},${(100 * (point - min) / range).toFixed(4)}`;
          x += step;
          return text;
        };

        // first point
        d.push(`M${Point(this.data[0])}`);

        // line
        for (const point of this.data.slice(1)) {
          d.push(`L${Point(point)}`);
        }

        root.Append('g').Append('path', {d: d.join(' ')});
      }
      break;
    }

    return root; // .toString();
  }

  private Range(data: number[] = this.data) {

    let min = data[0] || 0;
    let max = data[0] || 0;

    for (const element of data) {
      if (min > element) min = element;
      if (max < element) max = element;
    }

    return {min, max};
  }

}
