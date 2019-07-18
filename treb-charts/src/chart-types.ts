
import { RangeScale } from './util';

export interface AxisOptions {

  /** show labels */
  labels?: boolean;

  /** label number format */
  format?: string;

  /** tickmarks, only on x-axis (atm) */
  ticks?: boolean;

}

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
