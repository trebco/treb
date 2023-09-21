
import { Measurement } from 'treb-utils';
import { type Color } from './style';
import { type Theme, ThemeColor2 } from './theme';
import { ColorFunctions } from './color';

export interface GradientStop {
  value: number;
  color: Color;
}

export type ColorSpace = 'RGB'|'HSL';

export class Gradient {

  public mapped: Array<GradientStop & { resolved: number[] }>;

  constructor(stops: GradientStop[], theme: Theme, public color_space: ColorSpace = 'HSL') {

    this.mapped = stops.map(stop => {

      if (stop.value < 0 || stop.value > 1) {
        throw new Error('invalid stop value');
      }

      const rgb = Measurement.MeasureColor(ThemeColor2(theme, stop.color));

      let resolved: number[] = [];

      if (color_space === 'HSL') {
        const hsl = ColorFunctions.RGBToHSL(rgb[0], rgb[1], rgb[2]);
        resolved = [hsl.h, hsl.s, hsl.l];
      }
      else {
        resolved = [...rgb];
      }

      return {
        ...stop, resolved,
      };

    });

    this.mapped.sort((a, b) => a.value - b.value);

    // FIXME: we should expand the gradient, but for now we'll just clamp

    if (this.mapped[0].value > 0) {
      this.mapped.unshift({
        ...this.mapped[0], value: 0
      });
    }

    if (this.mapped[this.mapped.length - 1].value < 1) {
      this.mapped.push({
        ...this.mapped[this.mapped.length - 1], value: 1
      });
    }

  }

  public RenderColor(values: number[]) {
    if (this.color_space === 'RGB') {
      return { text: `rgb(${values})` };
    }
    return { text: `hsl(${values[0]},${values[1] * 100}%,${values[2] * 100}%)` };
  }

  public Interpolate(value: number): Color {

    value = Math.min(1, Math.max(0, value));
    for (const [index, stop] of this.mapped.entries()) {

      if (value === stop.value) {
        return this.RenderColor(stop.resolved);
      }
      if (value < stop.value) {
        const a = this.mapped[index - 1];
        const b = stop;

        const range = b.value - a.value; // FIXME: cache
        const advance = value - a.value;
        
        const values = [0,1,2].map(index => {
          return a.resolved[index] + (b.resolved[index] - a.resolved[index]) / range * advance;
        });

        return this.RenderColor(values);

      }
    }
    
    return { text: '' };

  }

}

if (typeof window !== 'undefined') {
  (window as any).Gradient = Gradient;
}
