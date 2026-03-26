import type { OneOrMany, TextElement, XsdBoolean } from "./util.js";
import type { Color } from "./sheetProperties.js";
import type { ST_SparklineType } from "./enums.js";

export interface Sparkline {
  /** Sparkline formula (data source range) */
  f?: TextElement;
  /** Cell location where the sparkline is rendered */
  sqref?: TextElement;
}

export interface SparklineGroup {
  $attributes?: {
    type?: ST_SparklineType;
    displayEmptyCellsAs?: string;
    markers?: XsdBoolean;
    high?: XsdBoolean;
    low?: XsdBoolean;
    first?: XsdBoolean;
    last?: XsdBoolean;
    negative?: XsdBoolean;
    displayXAxis?: XsdBoolean;
    displayHidden?: XsdBoolean;
    minAxisType?: string;
    maxAxisType?: string;
    rightToLeft?: XsdBoolean;
    manualMax?: number;
    manualMin?: number;
    lineWeight?: number;
  };
  colorSeries?: Color;
  colorNegative?: Color;
  colorAxis?: Color;
  colorMarkers?: Color;
  colorFirst?: Color;
  colorLast?: Color;
  colorHigh?: Color;
  colorLow?: Color;
  sparklines: {
    sparkline: OneOrMany<Sparkline>;
  };
}

export interface SparklineGroups {
  sparklineGroup: OneOrMany<SparklineGroup>;
}
