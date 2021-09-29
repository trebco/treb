
/**
 * this is, for the moment, hand-curated. can we reuse the regular API tool?
 * ...
 */

export interface Complex {
  real: number;
  imaginary: number;
}

export declare enum Hints {
  None = 0,
  Nan = 1,
  Exponential = 2,
  Percent = 4,
  Currency = 8,
  Grouping = 16,
  Parens = 32,
  Date = 64,
  Time = 128
}

export declare enum ValueType {
  undefined = 0,
  formula = 1,
  string = 2,
  number = 3,
  boolean = 4,
  object = 5,
  error = 6,
  complex = 7,
  array = 8
}

export declare const GetValueType: (value: unknown) => ValueType;

export interface ParseResult {
  value: number | string | boolean | undefined | Complex;
  hints?: Hints;
  type: ValueType;
}

declare class ValueParserType {
  TryParse(text?: string): ParseResult;
}

export declare const ValueParser: ValueParserType;

export declare class NumberFormat {
  Format(value: any, text_width?: number): string;
}
  
export declare class NumberFormatCache {
  static Get(format: string, complex?: boolean): NumberFormat;
}

export declare class Localization {
  static UpdateLocale(locale?: string): void;
}

// ---


export type CellValue = undefined | string | number | boolean | Complex;

export interface NumberUnion {
  type: ValueType.number;
  value: number;
}

export interface StringUnion {
  type: ValueType.string;
  value: string;
}

export interface ErrorUnion {
  type: ValueType.error;
  value: string;
}

export interface FormulaUnion {
  type: ValueType.formula;
  value: string;
}

export interface BooleanUnion {
  type: ValueType.boolean;
  value: boolean;
}

/** we should have these for other types as well */
export interface ComplexUnion {
  type: ValueType.complex;
  value: Complex;
}

export interface UndefinedUnion {
  type: ValueType.undefined;
  value?: undefined;
}

export interface ExtendedUnion {
  type: ValueType.object;
  value: any;
  key?: string;
}

/** potentially recursive structure */
export interface ArrayUnion {
  type: ValueType.array;
  value: UnionValue[][]; // 2d
};

/** switch to a discriminated union. implicit type guards! */
export type UnionValue 
    = NumberUnion 
    | ArrayUnion 
    | ComplexUnion 
    | ExtendedUnion
    | StringUnion 
    | FormulaUnion
    | UndefinedUnion
    | BooleanUnion
    | ErrorUnion
    ;

// --- 

export interface RangeScale {
  scale: number;
  step: number;
  count: number;
  min: number;
  max: number;
}

export const Scale: (min: number, max: number, count?: number, limit?: boolean, discrete?: boolean) => RangeScale;

// ---

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
  filled?: boolean;
  markers?: boolean;
  smooth?: boolean;
  data_labels?: boolean;

  /** different marker type for scatter plot */
  points?: boolean;

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

  style?: 'plot'|'line'|'area';

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
  round?: boolean;
  space?: number;
}

export interface BarData extends LineBaseData {
  type: 'bar';
  round?: boolean;
  space?: number;
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
  labels?: Array<string|undefined>;
}

export interface SeriesType {
  label?: string;
  x: SubSeries;
  y: SubSeries;

}

// ---

export declare class Chart {
  chart_data: ChartData;
  Initialize(container: HTMLElement): void;
  Exec(func: string, union: ExtendedUnion): void;
  Update(): void;
}
