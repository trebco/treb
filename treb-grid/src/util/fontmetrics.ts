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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

/* 
 * as of 2024 it looks like we can use proper fontmetrics in all browsers,
 * so we'll switch to that. this is a replacement for the old fontmetrics
 * (which read pixles), and any other font measurement utils.
 * 
 * as far as I can tell the alphabatic baseline is constant, and reliable,
 * in all browsers. so let's use that. other baselines seem to be slightly
 * different, at least in firefox.
 */

export interface FontMetrics {

  /** from textmetrics, this is the font ascent (max, essentially) */
  ascent: number;

  /** from textmetrics, this is the font descent (max) */
  descent: number;

  /** total height for the font (line height). just ascent + descent. should we +1 for baseline? */
  height: number;

  /** width of one paren */
  paren: number;

  /** width of one hash (#) character */
  hash: number;

}

// these two will be engine global, which is what we want
const cache: Map<string, FontMetrics> = new Map();
let canvas: HTMLCanvasElement | undefined;

/**
 * get font metrics for the given font, which includes a size.
 * precompute the size, we're not doing that anymore.
 */
export const Get = (font: string, variants?: string) => {
  
  const key = font;
  // console.info({key});

  let metrics = cache.get(key);
  
  if (metrics) {
    return metrics;
  }
  
  metrics = Measure(font, variants);
  cache.set(key, metrics);
  return metrics;

};

/**
 * flush cache. this should be called when you update the theme
 */
export const Flush = () => {
  cache.clear();
};

/**
 * do the actual measurement
 */
const Measure = (font: string, variants?: string): FontMetrics => {

  if (!canvas) {
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
    }
  }

  if (canvas) {
    if (variants) {
      canvas.style.fontVariant = variants;
    }
    else {
      canvas.style.fontVariant = '';
    }
  }

  const context = canvas?.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('invalid context');
  }
  
  context.textBaseline = 'alphabetic';
  context.textAlign = 'center';
  context.font = font;

  let metrics = context.measureText('(');
  const paren = metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft;

  metrics = context.measureText('#');
  const hash = metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft;

  metrics = context.measureText('Mljy!');

  return {

    paren,
    hash,

    ascent: metrics.fontBoundingBoxAscent,
    descent: metrics.fontBoundingBoxDescent,
    
    height: (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent),

  };

};


