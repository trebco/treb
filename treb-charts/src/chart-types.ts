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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import type { RangeScale } from 'treb-utils';
import type { Area } from './rectangle';
import type { UnitAddress } from 'treb-parser';
import { ValueType, type ArrayUnion, type CellValue, type ExtendedUnion, type UnionValue } from 'treb-base-types';

export interface ReferenceMetadata {
  type: 'metadata';
  address: UnitAddress;
  value: CellValue;
  format?: string;
}

export interface ReferenceSeries extends ExtendedUnion {
  key: 'series',
  value: {
    label?: string;
    x?: UnionValue;
    y?: UnionValue;
    z?: UnionValue;
    index?: number;
    subtype?: string;
    data_labels?: string[];
    axis?: number;
  }

  /*
  value: [
    CellValue?, // { name: 'Label' }, // , metadata: true, },
    UnionValue?, // { name: 'X', metadata: true, },
    UnionValue?, // { name: 'Y', metadata: true, },
    UnionValue?, // { name: 'Z', metadata: true, },
    CellValue?, // { name: 'index', },
    CellValue?, // { name: 'subtype', },
    CellValue?, // { name: 'Labels', description: 'Labels for bubble charts only (atm)' },
  ];
  */

}

export const IsMetadata = (value?: unknown): value is ExtendedUnion & { value: ReferenceMetadata } => {
  return (!!value && (typeof value === 'object') 
    && (value as ExtendedUnion).key === 'metadata'
    && !!(value as ExtendedUnion).value
    && (value as { value: ReferenceMetadata}).value.type === 'metadata');
};

export const IsSeries = (value?: unknown): value is ReferenceSeries => {
  return (!!value && (typeof value === 'object')
    && (value as ReferenceSeries).key === 'series'
    // && Array.isArray((value as ReferenceSeries).value));
    && (typeof (value as ReferenceSeries).value === 'object'));
};

export const IsArrayUnion = (value?: unknown): value is ArrayUnion => {
  return (!!value && (typeof value === 'object')
    && (value as UnionValue).type === ValueType.array
    && Array.isArray((value as ArrayUnion).value));
};

export type NumberOrUndefinedArray = Array<number|undefined>;

export interface AxisOptions {

  /** show labels */
  labels?: boolean;

  /** label number format */
  format?: string;

  /** tickmarks, only on x-axis (atm) */
  ticks?: boolean;

}

export interface CalloutType {
  value: number;
  label?: string;
}

export interface CellData {
  address: { row: number; column: number };
  value?: unknown;
  format?: string;
}

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
  // legend?: string[];
  legend?: Array<{label: string, index?: number}>;
  legend_position?: LegendPosition;
  legend_style?: LegendStyle;
  title_layout?: 'top'|'bottom';

  lines?: boolean;
  filled?: boolean;
  markers?: boolean;
  smooth?: boolean;
  data_labels?: boolean;

  class_name?: string;

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
  y2_scale?: RangeScale;

  x_labels?: string[];
  y_labels?: string[];
  y2_labels?: string[];

  style?: 'plot'|'line'|'area';

}

export interface BubbleChartData extends ChartDataBaseType {

  type: 'bubble';

  /*
  x?: SubSeries;
  y?: SubSeries;
  z?: SubSeries;
  c?: any[];
  */
  series: SeriesType[];


  x_scale: RangeScale;
  y_scale: RangeScale;

  x_labels?: string[];
  y_labels?: string[];

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
  callouts?: CalloutType[];
  smooth?: boolean;
}

export interface BoxPlotData extends ChartDataBaseType {
  type: 'box';
  series: SeriesType[];
  x_labels?: string[];
  series_names?: string[];
  y_labels?: string[];
  scale: RangeScale;
  max_n: number,

  data: {
    data: number[], 
    quartiles: [number, number, number], 
    whiskers: [number, number],
    iqr: number,
    n: number, 
    min: number, 
    max: number,
    mean: number,
  }[];

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

export interface HistogramData2 extends LineBaseData {
  type: 'histogram2';
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
  | HistogramData2
  | PieChartData
  | ScatterData
  | ScatterData2
  | LineData
  | AreaData
  | ColumnData
  | BarData
  | BubbleChartData
  | BoxPlotData
  ;

export enum LegendLayout {
  horizontal, vertical
}

export enum LegendPosition {
  top, bottom, left, right,
}

export enum LegendStyle {
  line, marker, bubble
}

export interface LegendOptions {
  // labels: string[];
  labels: Array<{label: string, index?: number}>;
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
  subtype?: string;
  x: SubSeries;
  y: SubSeries;
  y2?: SubSeries;
  z?: SubSeries;
  index?: number;
  labels?: string[];
  axis?: number;
}

