/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

/**
 * utility functions, primarily for adjusting lightness. since we generally
 * traffic in RGB (or symbolic colors) that requires translating to/from HSL.
 */
class ColorFunctions {

  /** darken rgb color by amount (%), optionally relative */
  public Darken(r: number, g: number, b: number, amount: number, relative = false) {

    // eslint-disable-next-line prefer-const
    let { h, s, l } = this.RGBToHSL(r, g, b);
    if (relative) l -= l * amount / 100;
    else l -= amount / 100;
    l = Math.max(0, Math.min(1, l));
    return this.HSLToRGB(h, s, l);
  }

  /** lighten rgb color by amount (%), optionally relative */
  public Lighten(r: number, g: number, b: number, amount: number, relative = false) {

    // eslint-disable-next-line prefer-const
    let { h, s, l } = this.RGBToHSL(r, g, b);
    if (relative) l += l * amount / 100;
    else l += amount / 100;
    l = Math.max(0, Math.min(1, l));
    return this.HSLToRGB(h, s, l);
  }

  public RGBToHSL(r: number, g: number, b: number) {

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
  }

  public HSLToRGB(h: number, s: number, l: number) {

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
      r = this.HueToRGB(p, q, h + 1 / 3);
      g = this.HueToRGB(p, q, h);
      b = this.HueToRGB(p, q, h - 1 / 3);
    }

    return { 
      r: Math.round(r * 255), 
      g: Math.round(g * 255), 
      b: Math.round(b * 255), 
    };
  }

  private HueToRGB(p: number, q: number, t: number) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

}

export const Color = new ColorFunctions();
