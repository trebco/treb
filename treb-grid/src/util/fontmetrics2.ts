
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

  constructor() {
    this.canvas = document.createElement('canvas');
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

    // console.info("measure", font);

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
