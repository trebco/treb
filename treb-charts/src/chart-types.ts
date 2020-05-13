
import { RangeScale } from './util';

export type NumberOrUndefinedArray = Array<number|undefined>;

export interface AxisOptions {

  /** show labels */
  labels?: boolean;

  /** label number format */
  format?: string;

  /** tickmarks, only on x-axis (atm) */
  ticks?: boolean;

}

export interface CellData {
  address: { row: number; column: number };
  value?: any;
  simulation_data?: number[];
  format?: string;
}

/*
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
*/

export interface DonutSlice {
  index: number;
  value: number;
  percent: number;
  label?: string;
  title?: string;
}

/** common to all chart data types */
export interface ChartDataBaseType {
  title?: string;
  title_layout?: 'top'|'bottom';
}

/** default, empty chart (you can still add a title, I suppose) */
export interface NullChartData extends ChartDataBaseType {
  type: 'null';
}

/** scatter plot (only used for correlation, atm) */
export interface ScatterData extends ChartDataBaseType {
  type: 'scatter';
  x: number[];
  y: number[];
  count: number;
}

/** base for column types (FIXME: probably common to scatter/line/area also) */
export interface ColumnDataBaseType extends ChartDataBaseType {
  column_width: number;
  x_labels?: string[];
  y_labels?: string[];
}

/** histogram */
export interface HistogramData extends ColumnDataBaseType {
  type: 'histogram';
  bins: number[];
  min: number;
  max: number;
  count: number;
  scale: RangeScale;
  titles?: string[];
}

export interface LineBaseData extends ChartDataBaseType {
  data: NumberOrUndefinedArray;
  series?: NumberOrUndefinedArray[];
  scale: RangeScale;
  titles?: string[];
  x_labels?: string[];
  y_labels?: string[];
  callouts?: {values: number[]; labels: string[]};
  smooth?: boolean;
}

export interface LineData extends LineBaseData {
  type: 'line';
}

export interface AreaData extends LineBaseData {
  type: 'area';
}

export interface ColumnData extends LineBaseData {
  type: 'column';
}

export interface BarData extends LineBaseData {
  type: 'bar';
}

export interface DonutDataBaseType extends ChartDataBaseType {
  slices: DonutSlice[];
}

/** donut (FIXME: common type for pie, donut) */
export interface DonutChartData extends DonutDataBaseType {
  type: 'donut';
}

/** pie (FIXME: common type for pie, donut) */
export interface PieChartData extends DonutDataBaseType {
  type: 'pie';
}

/** union type */
export type ChartData
  = NullChartData
  | DonutChartData
  | HistogramData
  | PieChartData
  | ScatterData
  | LineData
  | AreaData
  | ColumnData
  | BarData
  ;

