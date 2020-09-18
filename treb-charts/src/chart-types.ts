
import { RangeScale } from 'treb-utils';
import { Area } from './rectangle';

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
  legend?: string[];
  legend_position?: LegendPosition;
  legend_style?: LegendStyle;
  title_layout?: 'top'|'bottom';

  lines?: boolean;
  markers?: boolean;
  smooth?: boolean;

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

/** scatter plot used for line charting */
export interface ScatterData2 extends ChartDataBaseType {
  type: 'scatter2';

  series?: SeriesType[];

  x_scale: RangeScale;
  y_scale: RangeScale;

  x_labels?: string[];
  y_labels?: string[];

  style?: 'plot'|'line';

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
  series?: NumberOrUndefinedArray[];
  series2?: SeriesType[];
  scale: RangeScale;
  x_scale?: RangeScale;
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
  | ScatterData2
  | LineData
  | AreaData
  | ColumnData
  | BarData
  ;

export enum LegendLayout {
  horizontal, vertical
}

export enum LegendPosition {
  top, bottom, left, right,
}

export enum LegendStyle {
  line, marker
}

export interface LegendOptions {
  labels: string[];
  layout?: LegendLayout;
  position?: LegendPosition;
  style?: LegendStyle;
  area: Area;
}

export interface SubSeries {
  data: Array<number|undefined>;
  format?: string;
  range?: { min: number, max: number };
}

export interface SeriesType {
  label?: string;
  x: SubSeries;
  y: SubSeries;

}

