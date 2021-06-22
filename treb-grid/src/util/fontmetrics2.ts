import { worker } from "cluster";

export interface FontMetrics2 {
  ascender: number;
  descender: number;
  block: number;
  paren: number;
  hash: number;
}

export class FontMetricsFactory {

  private canvas: HTMLCanvasElement;

  private cache: Record<string, FontMetrics2> = {};

  public base_size_px = 10;

  constructor() {

    // you don't have to attach this canvas to the document
    // in order to use it to measure. however, if the font size
    // is relative it needs to be relative to the canvas size;
    // and if the canvas is not attached to the document, size
    // doesn't work.

    // FIXME: test with a containing node? 
    //        (NOTE: that doesn't help)

    this.canvas = document.createElement('canvas');

    // FIXME: since this is prelude to drawing, couldn't we use
    // our drawing canvas to render? then we don't need to attach
    // garbage to the DOM

    // alternatively, we could munge the font description...

    // this.canvas.style.position = 'absolute';
    // this.canvas.style.top = '-1000px';
    // document.body.appendChild(this.canvas);

    // what we're doing now is calculating -- we get the base size
    // from theme and if we see em or % we scale manually.

  }

  private GetFirstIndex(pixels: Uint8ClampedArray) {
    for (let i = 3, n = pixels.length; i < n; i += 4) {
      if (pixels[i] > 0) return (i - 3) / 4;
    }
    return pixels.length;
  }

  private GetLastIndex(pixels: Uint8ClampedArray) {
    for (let i = pixels.length - 1; i >= 3; i -= 4) {
      if (pixels[i] > 0) return i / 4;
    }
    return 0;
  }

  /* *
   * set base font size. the idea here is to have a base in case font sizes 
   * are relative (% or em), they need to be relative to something. HOWEVER,
   * canvas doesn't inherit -- 
   * 
   * (moved to base_size_points)
   * 
   * /
  public BaseSize(size: string): void {
    this.canvas.style.fontSize = size || '';
  }
  */

  public Flush() {
    this.cache = {};
  }

  public Get(font: string): FontMetrics2 {
    let metrics = this.cache[font];
    if (metrics) {
      return metrics;
    }
    metrics = this.Measure(font);
    this.cache[font] = metrics;
    return metrics;
  }

  public Measure(font: string): FontMetrics2 {

    const match = font.match(/([\d.]+)((?:%|em))/);

    if (match) {
      const target = match[1] + match[2];
      let value = Number(match[1]) * this.base_size_px;
      if (match[2] === '%') { value /= 100; }
      font = font.replace(target, value + 'px');
    }

    let context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('invalid context');
    }

    context.font = font;
    const metrics = context.measureText('MMM');

    const size = Math.ceil(metrics.width);

    this.canvas.setAttribute('width', size.toString());
    this.canvas.setAttribute('height', size.toString());
    
    context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('invalid context');
    }

    context.font = font;

    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#000';

    const y = Math.round(size * 2 / 3);
    const x = Math.round(size / 2);

    context.clearRect(0, 0, size, size);
    for (let i = 0x20; i <= 0x7e; i++) {
      const s = String.fromCharCode(i);
      context.fillText(s, x, y);
    }

    const data = context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

    const top = Math.floor(this.GetFirstIndex(data)/size);
    const bottom = Math.floor(this.GetLastIndex(data)/size);

    return {
      ascender: y - top,
      descender: bottom - y,
      block: bottom - top + 1,
      paren: context.measureText('(').width,
      hash: context.measureText('##').width - context.measureText('#').width,
    };

  }


}

export const FontMetricsCache = new FontMetricsFactory();
