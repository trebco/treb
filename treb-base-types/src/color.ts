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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */



/**
 * utility functions, primarily for adjusting lightness. since we generally
 * traffic in RGB (or symbolic colors) that requires translating to/from HSL.
 * 
 * @internal
 */
export const ColorFunctions = {

  /** darken rgb color by amount (%), optionally relative */
  Darken: (r: number, g: number, b: number, amount: number, relative = false) => {

    // eslint-disable-next-line prefer-const
    let { h, s, l } = ColorFunctions.RGBToHSL(r, g, b);
    if (relative) l -= l * amount / 100;
    else l -= amount / 100;
    l = Math.max(0, Math.min(1, l));
    return ColorFunctions.HSLToRGB(h, s, l);
  },

  /** lighten rgb color by amount (%), optionally relative */
  Lighten: (r: number, g: number, b: number, amount: number, relative = false) => {

    // eslint-disable-next-line prefer-const
    let { h, s, l } = ColorFunctions.RGBToHSL(r, g, b);
    if (relative) l += l * amount / 100;
    else l += amount / 100;
    l = Math.max(0, Math.min(1, l));
    return ColorFunctions.HSLToRGB(h, s, l);
  },

  RGBToHSL: (r: number, g: number, b: number) => {

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    let h = 0;
    let s = 0;

    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: h * 360, s, l };
  },

  HSLToRGB: (h: number, s: number, l: number) => {

    let r: number;
    let g: number;
    let b: number;

    if (s === 0) {
      r = g = b = l;
    }
    else {
      h = h / 360;
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = ColorFunctions.HueToRGB(p, q, h + 1 / 3);
      g = ColorFunctions.HueToRGB(p, q, h);
      b = ColorFunctions.HueToRGB(p, q, h - 1 / 3);
    }

    return { 
      r: Math.round(r * 255), 
      g: Math.round(g * 255), 
      b: Math.round(b * 255), 
    };
  },

  HueToRGB: (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  },

  ////////////////


  GetLuminance: ([r, g, b]: number[],): number => {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  },
 
  WeightedLuminance: ([r, g, b]: number[], weights: number[] = [1,1,1]): number => {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] * weights[0] + 0.7152 * a[1] * weights[1] + 0.0722 * a[2] * weights[2];
  },
 
  GetContrastRatio: (data: [number, number]): number => {
    data.sort((a, b) => b - a);
    return (data[0] + 0.05) / (data[1] + 0.05);
  },
  
  GetTextColor: (background: [number, number, number], a: [number, number, number], b: [number, number, number]) => {

    // weighted contrast ratio: assign more weight to the r channel.

    const weights = [0.4, 0.3, 0.3];
      
    const luminance = ColorFunctions.WeightedLuminance(background, weights);
    const luminance_a = ColorFunctions.WeightedLuminance(a, weights); 
    const luminance_b = ColorFunctions.WeightedLuminance(b, weights);

    const contrast_a = ColorFunctions.GetContrastRatio([luminance_a, luminance]);
    const contrast_b = ColorFunctions.GetContrastRatio([luminance_b, luminance]);

    return contrast_a > contrast_b ? a : b;

    // perceptual lightness (actually I like this one)

    /*
    const background_lightness = ColorFunctions.RGBToHSL(...background).l;
    const a_lightness = ColorFunctions.RGBToHSL(...a).l;
    const b_lightness = ColorFunctions.RGBToHSL(...b).l;

    console.info("background", background_lightness, "a", a_lightness, "b", b_lightness);

    const lighter = a_lightness > b_lightness ? a : b;
    const darker = a_lightness > b_lightness ? b : a;
    
    if (background_lightness < .6) {
      return lighter;
    }
    else {
      return darker;
    }
    */

  },
  
};



