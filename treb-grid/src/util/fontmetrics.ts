/**
 * Copyright (c) 2017-2018 Structured Data, LLC
 *
 * This file is part of BERT.
 *
 * BERT is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * BERT is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with BERT.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * this is based on
 *
 * https://github.com/soulwire/FontMetrics
 * https://pomax.github.io/fontmetrics.js/fontmetrics.js
 *
 * both of which seem reasonable but aren't exactly what we need
 */

/**
 * returned font metrics
 */
export interface Metrics {
  ascent: number;
  descent: number;
  width: number;
  text?: string;
}

/**
 * this is not static, or global, because there's a possibility
 * we are (1) running async, and (2) running in different shells;
 * in that case we want to ensure separation.
 */
export class FontMetrics {

  private canvas: HTMLCanvasElement;

  // tslint:disable-next-line:variable-name
  private context_?: CanvasRenderingContext2D;

  private padding = 0;

  private cached_font: string = '';

  public get context() { return this.context_; }

  constructor(){
    this.canvas = document.createElement('canvas');
    this.context_ = this.canvas.getContext('2d') || undefined;
  }

  public SetFont(font_family: string, font_size: number|string, font_weight = 400) {

    if (!this.context_) throw new Error('missing context in fontmetrics');
    if (!font_size ) throw new Error('invalid font size (0)');

    let font_size_pt = 0;

    if (typeof font_size === 'number') {
      font_size_pt = font_size;
      font_size = font_size + 'pt';
    }
    else if (/px/.test(font_size)) {
      font_size_pt = Math.round(Number(font_size.replace(/px/, '')) * 75) / 100;
    }
    else if (/pt/.test(font_size)) {
      font_size_pt = Number(font_size.replace(/pt/, ''));
    }
    else font_size_pt = Number(font_size.replace(/\D+/g, ''));

    const font = `${font_weight} ${font_size} ${font_family}`;
    if ( this.cached_font === font ) return;

    this.padding = font_size_pt * 1;
    this.canvas.width = font_size_pt * 4;
    this.canvas.height = font_size_pt * 4 + this.padding;
    this.context_.textBaseline = 'top';
    this.context_.textAlign = 'center';
    this.context_.font = font;

    this.cached_font = font;

  }

  public UpdateText(char: string) {
    if (!this.context_) throw new Error('missing context in fontmetrics');
    this.context_.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context_.fillText(char, this.canvas.width / 2, this.padding, this.canvas.width);
  }

  public GetPixels(char: string) {
    if (!this.context_) throw new Error('missing context in fontmetrics');
    this.UpdateText(char);
    return this.context_.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
  }

  public GetFirstIndex(pixels: Uint8ClampedArray) {
    for (let i = 3, n = pixels.length; i < n; i += 4) {
      if (pixels[i] > 0) return (i - 3) / 4;
    }
    return pixels.length;
  }

  public GetLastIndex(pixels: Uint8ClampedArray) {
    for (let i = pixels.length - 1; i >= 3; i -= 4) {
      if (pixels[i] > 0) return i / 4;
    }
    return 0;
  }

  public MeasureTop(char: string){
    return Math.round(this.GetFirstIndex(this.GetPixels(char)) / this.canvas.width) - this.padding;
  }

  public MeasureBottom(char: string){
    return Math.round(this.GetLastIndex(this.GetPixels(char)) / this.canvas.width) - this.padding;
  }

  public Width(text: string): number {
    if (!this.context_) throw new Error('missing context in fontmetrics');
    return this.context_.measureText(text).width;
  }

  public Measure(char: string): Metrics {

    if (!this.context_) throw new Error('missing context in fontmetrics');

    // use for width
    const text_metrics = this.context_.measureText(char);

    // use this one for baseline
    const baseline = this.MeasureBottom('n');

    // now measure the actual char
    const ascent = this.MeasureTop(char);
    const descent = this.MeasureBottom(char);

    // console.info("TM", char, baseline, baseline - ascent, descent - baseline, this.cached_font_)

    return {
      ascent: (baseline - ascent),
      descent: Math.max(0, descent - baseline),
      width: text_metrics.width,
      text: char,
    };

  }

}

