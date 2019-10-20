
import { Style } from 'treb-base-types';
import { FontMetrics } from './fontmetrics';
let fontmetrics_instance: FontMetrics;

export interface FontMetricsInfo {
  block: number;
  ascent: number;
  descent: number;
  paren: number;
  hash: number;
}

class FontMetricsCacheInstance {

  private cache: {[index: string]: FontMetricsInfo} = {};

  public get(style: Style.Properties){
    const font = Style.Font(style);
    let metrics: FontMetricsInfo = this.cache[font] || { ascent: 10, descent: 2, block: 18 };
    if (!this.cache[font] || this.cache[font].block === 1) {
      metrics = this.cache[font] = this.MeasureFont(style);
    }
    return metrics;
  }

  private MeasureFont(properties: Style.Properties): FontMetricsInfo {
    if (!fontmetrics_instance) fontmetrics_instance = new FontMetrics();
    fontmetrics_instance.SetFont(properties.font_face || '',
      (properties.font_size_value || 0) + (properties.font_size_unit || 'pt'),
      properties.font_bold ? 600 : 400);

    const fm1 = fontmetrics_instance.Measure('M');
    const fm2 = fontmetrics_instance.Measure('p');

    const paren = fontmetrics_instance.Measure(')');
    const hash1 = fontmetrics_instance.Measure('#');
    const hash2 = fontmetrics_instance.Measure('##');

    return {
      ascent: fm1.ascent,
      descent: fm2.descent,
      block: Math.ceil((fm1.ascent + fm2.descent) * 1.5),
      paren: paren.width,
      hash: hash2.width - hash1.width,
    };
  }

}

export const FontMetricsCache = new FontMetricsCacheInstance();
