
import { RangeScale } from './util';

export interface AxisOptions {

  /** show labels */
  labels?: boolean;

  /** label number format */
  format?: string;

  /** tickmarks, only on x-axis (atm) */
  ticks?: boolean;

}

/*
export interface LayoutOptions {

  / ** chart title * /
  title?: string;

  / ** title top/bottom * /
  title_layout?: 'top'|'bottom';

  / ** axis-specific options * /
  axes?: {
    x?: AxisOptions;
    y?: AxisOptions;
  };

  / ** column width relative to available space, as % * /
  column_width?: number;

  / ** margin around chart elements, as a % of total size * /
  margin?: number;

  / ** desired bin count (suggestion only) * /
  histogram_bins?: number;

}
*/

export interface CellData {
  address: { row: number, column: number };
  value?: any;
  simulation_data?: number[];
  format?: string;
}

export interface DataRange {
  data: number[];
  data2?: number[];
  labels?: string[];
  min: number;
  max: number;
  count: number;
  scale: RangeScale;
  scale2?: RangeScale;
}
