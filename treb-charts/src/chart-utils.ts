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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import { type UnionValue, ValueType, type ArrayUnion, IsComplex, type CellValue } from 'treb-base-types';
import { IsArrayUnion, IsMetadata, IsSeries, LegendStyle } from './chart-types';
import type { SubSeries, SeriesType, BarData, ChartDataBaseType, ChartData, ScatterData2, DonutSlice, BubbleChartData, BoxPlotData } from './chart-types';
import { NumberFormatCache } from 'treb-format';
import { Util } from './util';
import type { ReferenceSeries } from './chart-types';
import type { RangeScale } from 'treb-utils';

import { QuickSort } from './quicksort';

/**
 * this file is the concrete translation from function arguments
 * to chart data. chart data is a (somewhat complicated) type with
 * specializations for various chart types. we're splitting the 
 * generation of that data from the actual layout/rendering with
 * a view towards building a new (or several new) renderers.
 */

const DEFAULT_FORMAT = '#,##0.00'; // why not use "general", or whatever the usual default is?

export const ArrayMinMax = (data: number[]) => {

  let min = data[0];
  let max = data[0];

  for (const entry of data) { 
    if (entry < min) { min = entry; }
    if (entry > max) { max = entry; }
  }

  return { min, max };

  /*
  const copy = data.slice(0);
  copy.sort((a, b) => a - b);
  return {min: copy[0], max: copy[copy.length - 1]};
  */

};

export const ReadSeries = (data: ReferenceSeries['value']): SeriesType => {

  const [label, x, y, z, index, subtype, data_labels] = data;

  // series type is (now)
  //
  // [0] label, string
  // [1] X, array, metadata [* could be single value?]
  // [2] Y, array, metadata [* could be single value?]
  // [3] Z, array, metadata [* could be single value?]
  // [4] index, number
  // [5] subtype, string
  //
  
  // in this case it's (label, X, Y)
  const series: SeriesType = {
    x: { data: [] },
    y: { data: [] },
  };

  if (typeof index === 'number') {
    series.index = index;
  }

  if (subtype) {
    series.subtype = subtype.toString();
  }

  if (data_labels) {
    const labels = Util.Flatten<CellValue>(Array.isArray(data_labels) ? data_labels : [data_labels]);
    series.labels = labels.map(value => (typeof value === 'undefined') ? '' : value.toString());
  }

  if (label) {
    series.label = label.toString();
  }
  
  const ParseSubseries = (source?: UnionValue, apply_labels = false) => {

    let subseries: SubSeries|undefined;

    // convert single values -> array (is this still necessary?)

    if (IsMetadata(source)) {
      source = {
        type: ValueType.array,
        value: [[source]],
      };
    }

    if (IsArrayUnion(source)) {

      subseries = { data: [] };

      const flat = Util.Flatten<UnionValue>(source.value);
      
      subseries.data = flat.map(item => {
        if (IsMetadata(item)) {
          if (typeof item.value.value === 'number') {
            return item.value.value;
          }
        }
        else if (item.type === ValueType.number) {
          return item.value;
        }
        return undefined;
      });
  
      if (IsMetadata(flat[0]) && flat[0].value?.format) {
        subseries.format = (flat[0].value.format);
        if (apply_labels) {
          const format = NumberFormatCache.Get(subseries.format);
          subseries.labels = subseries.data.map(value => (value === undefined) ? undefined : format.Format(value));
        }
      }
  
    }
    return subseries;

  };

  // read [2] first, so we can default for [1] if necessary

  series.y = ParseSubseries(y, true) || { data: [] };
  series.x = ParseSubseries(x) || { data: [] };
  series.z = ParseSubseries(z);

  const entries = [series.x, series.y]

  for (const subseries of entries) {

    // in case of no values
    if (subseries.data.length) {
      const values = subseries.data.filter(value => value || value === 0) as number[];
      subseries.range = ArrayMinMax(values);
    }
  }

  return series;

};

export const ArrayToSeries = (array_data: ArrayUnion): SeriesType => {

  // this is an array of Y, X not provided

  const series: SeriesType = { x: { data: [] }, y: { data: [] }, };
  const flat = Util.Flatten<UnionValue>(array_data.value);

  // series.y.data = flat.map(item => typeof item.value === 'number' ? item.value : undefined);

  // console.trace();
  
  const values: number[] = []; // filter any undefineds

  for (const [index, item] of flat.entries()) {

    let value = 0;

    // why is this testing type instead of using the union type?

    if (typeof item.value === 'number') {
      value = item.value;
      // series.y.data[index] = item.value;
      values.push(item.value);
    }
    else if (IsMetadata(item)) {
      if (IsComplex(item.value.value)) {
        series.x.data[index] = item.value.value.real;
        // series.y.data[index] = item.value.value.imaginary;
        // values.push(item.value.value.imaginary);
        value = item.value.value.imaginary;
      }
      else if (typeof item.value.value === 'number') {
        // series.y.data[index] = item.value.value;
        // values.push(item.value.value);
        value = item.value.value;
      }
      else {
        continue;
      }
    }
    else {
      // series.y.data[index] = undefined;
      continue;
    }

    series.y.data[index] = value;
    values.push(value);

  }

  /*
  series.y.data = flat.map((item, index) => {

    // if the data is passed in from the output of a function, it will not
    // be inside a metadata structure

    if (typeof item.value === 'number') { return item.value; }

    // ... ok, it's metadata (why not just test?) ...

    if (IsMetadata(item)) {
     
      // experimenting with complex... put real in X axis and imaginary in Y axis
      // note should also function w/ complex not in a metadata structure

      // if (typeof item.value.value?.real === 'number') {
      if (IsComplex(item.value.value)) {
        series.x.data[index] = item.value.value.real;
        return item.value.value.imaginary;
      }
      if (typeof item.value.value === 'number') {
        return item.value.value;
      }

    }

    // return typeof item.value.value === 'number' ? item.value.value : undefined;

    return undefined;

  });
  */

  let first_format = '';
  if (IsMetadata(flat[0])) {
    first_format = flat[0].value.format || '';
  }

  if (first_format) {
    series.y.format = first_format;
    const format = NumberFormatCache.Get(series.y.format || '');
    series.y.labels = series.y.data.map(value => (value === undefined) ? undefined : format.Format(value));
  }

  // moved up, integrated loops
  // const values = series.y.data.filter(value => value || value === 0) as number[];

  series.y.range = ArrayMinMax(values);

  // experimenting with complex... this should only be set if we populated
  // it from complex values

  if (series.x.data.length) {

    const filtered: number[] = series.x.data.filter(test => typeof test === 'number') as number[];
    series.x.range = ArrayMinMax(filtered);

    if (first_format) {
      series.x.format = first_format;
      const format = NumberFormatCache.Get(series.x.format || '');
      series.x.labels = series.x.data.map(value => (value === undefined) ? undefined : format.Format(value));
    }

  }

  return series;

};

/**
 * composite data -> series. composite data can be
 * 
 * (1) set of Y values, with X not provided;
 * (2) SERIES(label, X, Y) with Y required, others optional
 * (3) GROUP(a, b, ...), where entries are either arrays as (1) or SERIES as (2)
 * 
 * FIXME: consider supporting GROUP(SERIES, [y], ...)
 * 
 * NOTE: (1) could be an array of boxed (union) values...
 * 
 */
export const TransformSeriesData = (raw_data?: UnionValue, default_x?: UnionValue): SeriesType[] => {

  if (!raw_data) { return []; }

  const list: SeriesType[] = [];

  if (raw_data.type === ValueType.object) {
    if (raw_data.key === 'group') {
      if (Array.isArray(raw_data.value)) {
        for (const [series_index, entry] of raw_data.value.entries()) {
          if (!!entry && (typeof entry === 'object')) {
            if (IsSeries(entry)) {
              const series = ReadSeries(entry.value);
              if (typeof series.index === 'undefined') {
                series.index = series_index + 1;
              }
              list.push(series);
            }
            else if (entry.type === ValueType.array) {
              list.push(ArrayToSeries(entry));
            }
          }
        }
      }
    }
    else if (IsSeries(raw_data)) {
      const series = ReadSeries(raw_data.value);
      list.push(series);
    }
  }
  else if (raw_data.type === ValueType.array) {
    list.push(ArrayToSeries(raw_data));
  }

  // now we may or may not have X for each series, so we need
  // to patch. it's also possible (as with older chart functions)
  // that there's a common X -- not sure if we want to continue
  // to support that or not...

  let baseline_x: SubSeries | undefined;
  let max_y_length = 0;

  // if we have a default, use that (and range it)

  if (default_x?.type === ValueType.array) {

    const values = Util.Flatten<UnionValue>(default_x.value);

    let format = '0.00###';

    if (IsMetadata(values[0]) && values[0].value.format) {
      format = values[0].value.format;
    }

    const data = values.map(x => {
      if (x.type === ValueType.number) { return x.value; }
      if (IsMetadata(x) && typeof x.value.value === 'number') {
        return x.value.value;
      }
      return undefined;
    }) as Array<number | undefined>;

    const filtered = data.filter(x => typeof x === 'number') as number[];

    baseline_x = {
      data,
      format,
      range: ArrayMinMax(filtered),
    }
  }

  // look for the first set that has values. at the same time, get max len

  for (const entry of list) {
    max_y_length = Math.max(max_y_length, entry.y.data.length);
    if (entry.x.data.length) {
      if (!baseline_x) {
        baseline_x = entry.x;
      }
    }
  }

  // now default for any series missing X

  if (!baseline_x) {
    baseline_x = {
      data: [],
      range: {
        min: 0,
        max: Math.max(0, max_y_length - 1),
      }
    }
    for (let i = 0; i < max_y_length; i++) { baseline_x.data.push(i); }
  }

  for (const entry of list) {
    if (!entry.x.data.length) {
      entry.x = baseline_x;
    }
  }

  return list;
};

const AutoFormat = (scale: RangeScale): string => {

  const zep = Math.abs(scale.step) % 1;
  if (!zep) {
    const log10 = Math.log10(Math.abs(scale.step));
    if (log10 >= 5) {
      return 'Scientific';
    }
    return '#,##0';
  }
  else {
    const log10 = Math.log10(Math.abs(zep));
    if (log10 < -4) {
      return 'Scientific';
    }
    let count = 0;
    for (let i = 0; i < scale.count; i++) {
      const value = ((scale.min + scale.step * i) % 1).toFixed(6).replace(/0+$/, '');
      count = Math.max(count, value.length - 2);
    }
    let format = '#,##0.';
    for (let i = 0; i < count; i++) {
      format += '0';
    }
    return format;
  }


};

/** get a unified scale, and formats */
export const CommonData = (series: SeriesType[], y_floor?: number, y_ceiling?: number, x_floor?: number, x_ceiling?: number, auto_number_format?: boolean) => {

  let x_format = '';
  let y_format = '';

  for (const entry of series) {
    if (entry.y.format && !y_format) { y_format = entry.y.format; }
    if (entry.x.format && !x_format) { x_format = entry.x.format; }
  }

  let legend: Array<{ label: string, index?: number }> | undefined; // string[]|undefined;
  if (series.some(test => test.label && (test.label.length > 0))) {
    legend = series.map((entry, i) => ({
      label: entry.label || `Series ${i + 1}`,
      index: typeof entry.index === 'number' ? entry.index : i + 1,
    }));
  }

  const x = series.filter(test => test.x.range);
  let x_min = Math.min.apply(0, x.map(test => test.x.range?.min || 0));
  let x_max = Math.max.apply(0, x.map(test => test.x.range?.max || 0));

  // const y = series.filter(test => test.y.range);
  let y_min = Math.min.apply(0, x.map(test => test.y.range?.min || 0));
  let y_max = Math.max.apply(0, x.map(test => test.y.range?.max || 0));

  // if there's z data (used for bubble size), adjust x/y min/max to
  // account for the z size so bubbles are contained within the grid

  for (const subseries of series) {
    if (subseries.z) {
      for (const [index, z] of subseries.z.data.entries()) {
        if (typeof z !== 'undefined') {
          const x = subseries.x.data[index];
          
          const half = Math.max(0, z/2); // accounting for negative values (which we don't use)

          if (typeof x !== 'undefined') {
            x_min = Math.min(x_min, x - half);
            x_max = Math.max(x_max, x + half);
          }

          const y = subseries.y.data[index];
          if (typeof y !== 'undefined') {
            y_min = Math.min(y_min, y - half);
            y_max = Math.max(y_max, y + half);
          }

        }
      }
    }
  }

  if (typeof x_floor !== 'undefined') {
    x_min = Math.min(x_min, x_floor);
  }
  if (typeof x_ceiling !== 'undefined') {
    x_min = Math.max(x_min, x_ceiling);
  }

  if (typeof y_floor !== 'undefined') {
    y_min = Math.min(y_min, y_floor);
  }
  if (typeof y_ceiling !== 'undefined') {
    y_max = Math.max(y_max, y_ceiling);
  }

  const x_scale = Util.Scale(x_min, x_max, 7);
  const y_scale = Util.Scale(y_min, y_max, 7);

  let x_labels: string[] | undefined;
  let y_labels: string[] | undefined;

  if (x_format) {
    x_labels = [];
    const format = NumberFormatCache.Get(x_format);
    for (let i = 0; i <= x_scale.count; i++) {
      x_labels.push(format.Format(x_scale.min + i * x_scale.step));
    }
  }

  if (!y_format && auto_number_format) {
    // y_format = default_number_format;
    y_format = AutoFormat(y_scale);
  }

  if (y_format) {
    y_labels = [];
    const format = NumberFormatCache.Get(y_format);
    for (let i = 0; i <= y_scale.count; i++) {
      y_labels.push(format.Format(y_scale.min + i * y_scale.step));
    }
  }

  return {
    x: {
      format: x_format,
      scale: x_scale,
      labels: x_labels,
    },
    y: {
      format: y_format,
      scale: y_scale,
      labels: y_labels,
    },
    legend,
  };

};

const ApplyLabels = (series_list: SeriesType[], pattern: string, category_labels?: string[]): void => {

  for (const series of series_list) {

    const format = {
      x: NumberFormatCache.Get(series.x.format || ''),
      y: NumberFormatCache.Get(series.y.format || ''),
    };

    series.y.labels = [];

    for (let i = 0; i < series.y.data.length; i++) {

      const x = category_labels ? category_labels[i] :
        (typeof series.x.data[i] === 'number' ? format.x.Format(series.x.data[i]) : '');
      const y = typeof series.y.data[i] === 'number' ? format.y.Format(series.y.data[i]) : '';

      series.y.labels[i] = pattern.replace(/\bx\b/g, x).replace(/\by\b/g, y);

    }

  }

};

/**
 * return quartiles. we use the Tukey hinge-style. See
 * 
 * https://en.wikipedia.org/wiki/Quartile
 * 
 * Specifically,
 * 
 * - Use the median to divide the ordered data set into two halves. The median 
 *   becomes the second quartiles.
 * 
 *   - If there are an odd number of data points in the original ordered data 
 *     set, include the median (the central value in the ordered list) in both 
 *     halves.
 * 
 *   - If there are an even number of data points in the original ordered data 
 *     set, split this data set exactly in half.
 * 
 * - The lower quartile value is the median of the lower half of the data. The 
 *   upper quartile value is the median of the upper half of the data.
 * 
 * @param data - must be sorted with no holes
 */
export const BoxStats = (data: number[]) => {

  // removed copying. still has 3 loops though.
  
  const median = (data: number[], start = 0, n = data.length) => {
    if (n % 2) {
      return data[Math.floor(n/2) + start];
    }
    else {
      return (data[n/2 + start] + data[n/2 - 1 + start])/2;
    }
  };

  const n = data.length;
  const quartiles: [number, number, number] = [0, median(data), 0];
  if (n % 2) {
    const floor = Math.floor(n/2);
    quartiles[0] = median(data, 0, Math.ceil(n/2));
    quartiles[2] = median(data, floor, data.length - floor);
  }
  else {
    quartiles[0] = median(data, 0, n/2);
    quartiles[2] = median(data, n/2, data.length - n/2);
  }

  const iqr = quartiles[2] - quartiles[0];
  const whiskers: [number, number] = [0, 0];

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += data[i];
  }
      
  for (let i = 0; i < n; i++) {
    const pt = data[i];
    if (pt >= quartiles[0] - iqr * 1.5) {
      whiskers[0] = pt;
      break;
    }
  }

  for (let i = n-1; i >= 0; i--) {
    const pt = data[i];
    if (pt <= quartiles[2] + iqr * 1.5) {
      whiskers[1] = pt;
      break;
    }
  }
 
  return {
    data, 
    quartiles, 
    whiskers,
    iqr,
    n, 
    mean: n ? sum/n : 0,
    min: data[0], 
    max: data[n-1],
  };

};

//------------------------------------------------------------------------------

export const CreateBoxPlot = (args: UnionValue[]): ChartData => {

  const series: SeriesType[] = TransformSeriesData(args[0]);

  const common = CommonData(series, undefined, undefined, undefined, undefined, true);

  let max_n = 0;

  // change to min-max style
  const minmax = !!args[2];

  const stats: BoxPlotData['data'] = series.map(series => {
    // const data = series.y.data.slice(0).filter((test): test is number => test !== undefined).sort((a, b) => a - b);
    const data: number[] = [];
    for (const entry of series.y.data) {
      if (entry !== undefined) { data.push(entry); }
    }

    // data.sort((a, b) => a - b);
    QuickSort(data);

    const result = BoxStats(data);
    max_n = Math.max(max_n, result.n);

    if (minmax) {
      result.whiskers[0] = result.min;
      result.whiskers[1] = result.max;
    }

    return result;
  });


  const title = args[1]?.toString() || undefined;
  const x_labels: string[] = [];
  const series_names: string[] = [];
  const format = NumberFormatCache.Get('#,##0');

  for (const [index, entry] of stats.entries()) {
    x_labels.push(format.Format(entry.n));
    const s = series[index];
    series_names.push(s.label || `Series ${index + 1}`);
  }

  const chart_data: BoxPlotData = {
    type: 'box',
    series,
    title,
    max_n,
    data: stats,
    x_labels, 
    series_names: series.some(test => !!test.label) ? series_names : undefined,
    scale: common.y.scale,
    y_labels: common.y.labels,
  };
  
  return chart_data;

};

//------------------------------------------------------------------------------

export const CreateBubbleChart = (args: UnionValue[]): ChartData => {

  const series: SeriesType[] = TransformSeriesData(args[0]);

  let y_floor: number|undefined = undefined;
  let x_floor: number|undefined = undefined;
  
  for (const entry of series) {

    if (typeof entry.x.range?.min === 'number' && entry.x.range.min > 0 && entry.x.range.min < 50) {
      x_floor = 0;
    }
    if (typeof entry.y.range?.min === 'number' && entry.y.range.min > 0 && entry.y.range.min < 50) {
      y_floor = 0;
    }
  }

  const common = CommonData(series, y_floor, undefined, x_floor);
  const title = args[1]?.toString() || undefined;
  // const options = args[2]?.toString() || undefined;

  // console.info({ series, common, title, options });

  const chart_data: BubbleChartData = {

    legend: common.legend,
    legend_style: LegendStyle.bubble,
    type: 'bubble',
    series,
    title,

    x_scale: common.x.scale,
    x_labels: common.x.labels,

    y_scale: common.y.scale,
    y_labels: common.y.labels,

  };
  
  return chart_data;

  /*
  const [x, y, z] = [0,1,2].map(index => {
    const arg = args[index];
    if (arg.type === ValueType.array) {
      return ArrayToSeries(arg).y;
    }
    return undefined;
  });

  let c: string[]|undefined = undefined;
  if (Array.isArray(args[3])) {
    c = Util.Flatten(args[3]).map(value => (value||'').toString());
  }
 
  const title = args[4]?.toString() || undefined;

  // FIXME: need to pad out the axes by the values at the edges,
  // so the whole circle is included in the chart area. 

  const [x_scale, y_scale] = [x, y].map(subseries => {

    let series_min = 0;
    let series_max = 1;
    let first = false;

    if (subseries?.data) {

      for (const [index, value] of subseries.data.entries()) {
        if (typeof value === 'number') {

          if (!first) {
            first = true;
            series_min = value;
            series_max = value;
          }

          const size = (z?.data?.[index]) || 0;
          series_min = Math.min(series_min, value - size / 2);
          series_max = Math.max(series_max, value + size / 2);
        }      
      }
    }

    return Util.Scale(series_min, series_max, 7);

  });

  let x_labels: string[] | undefined;
  let y_labels: string[] | undefined;

  if (x?.format) {
    x_labels = [];
    const format = NumberFormatCache.Get(x.format);
    for (let i = 0; i <= x_scale.count; i++) {
      x_labels.push(format.Format(x_scale.min + i * x_scale.step));
    }
  }

  if (y?.format) {
    y_labels = [];
    const format = NumberFormatCache.Get(y.format);
    for (let i = 0; i <= y_scale.count; i++) {
      y_labels.push(format.Format(y_scale.min + i * y_scale.step));
    }
  }

  return {

    type: 'bubble',

    title,

    x,
    y,
    z,
    c,
    
    x_scale,
    y_scale,

    x_labels, 
    y_labels,

  };

  */

};

/**
 * args is [data, title, options]
 * 
 * args[0] is the scatter data. this can be 
 * 
 * (1) set of Y values, with X not provided;
 * (2) SERIES(label, X, Y) with Y required, others optional
 * (3) GROUP(SERIES(label, X, Y), SERIES(label, X, Y), ...), with same rule for each series
 * 
 * @param args 
 */
export const CreateScatterChart = (args: [UnionValue, string, string], style: 'plot' | 'line' = 'plot'): ChartData => {

  // FIXME: transform the data, then have this function
  // operate on clean data. that way the transform can
  // be reused (and the function can be reused without the
  // transform).

  const series: SeriesType[] = TransformSeriesData(args[0]);

  const common = CommonData(series);

  const title = args[1]?.toString() || undefined;
  const options = args[2]?.toString() || undefined;

  const chart_data: ScatterData2 = {
    legend: common.legend,
    style,
    type: 'scatter2',
    series, // : [{x, y}],
    title,

    x_scale: common.x.scale,
    x_labels: common.x.labels,

    y_scale: common.y.scale,
    y_labels: common.y.labels,

    lines: style === 'line', // true,
    points: style === 'plot',

  };

  if (options) {

    chart_data.markers = /marker/i.test(options);
    chart_data.smooth = /smooth/i.test(options);
    chart_data.data_labels = /labels/i.test(options);

    let match = options.match(/labels="(.*?)"/);
    if (match && chart_data.series) {
      ApplyLabels(chart_data.series, match[1]);
    }
    else {
      match = options.match(/labels=([^\s\r\n,]+)(?:\W|$)/);
      if (match && chart_data.series) {
        ApplyLabels(chart_data.series, match[1]);
      }
    }

    match = options.match(/class=([\w_-]+)(?:\W|$)/);
    if (match) {
      chart_data.class_name = match[1];
    }

  }

  return chart_data;

};


/**
 * column/bar chart, now using common Series data and routines
 * 
 * @param args arguments: data, categories, title, options
 * @param type 
 */
export const CreateColumnChart = (
    args: [UnionValue?, UnionValue?, string?, string?], 
    type: 'bar' | 'column'): ChartData => {

  const [data, labels, args_title, args_options] = args;
      
  const series: SeriesType[] = TransformSeriesData(data);
  const common = CommonData(series);

  let category_labels: string[] | undefined;

  if (labels) {

    const values = labels.type === ValueType.array ? Util.Flatten<UnionValue>(labels.value) : Util.Flatten<UnionValue>(labels);

    category_labels = values.map((cell) => {

      if (!cell || !cell.value) { return ''; }

      if (IsMetadata(cell)) {
        if (typeof cell.value.value === 'number') {
          const format = NumberFormatCache.Get(cell.value.format || DEFAULT_FORMAT);
          return format.Format(cell.value.value);
        }
        return cell.value.value?.toString() || '';
      }

      if (typeof cell.value === 'number') {
        const format = NumberFormatCache.Get(DEFAULT_FORMAT);
        return format.Format(cell.value);
      }

      return cell.value.toString();

    });

    const count = series.reduce((a, entry) => Math.max(a, entry.y.data.length), 0);

    if (count < category_labels.length) {
      category_labels = category_labels.slice(0, count);
    }

    while (count > category_labels.length) { category_labels.push(''); }

  }

  const title = args_title?.toString() || undefined;
  const options = args_options?.toString() || undefined;

  const chart_data = {
    type,
    legend: common.legend,
    // legend_position: LegendPosition.right,
    legend_style: LegendStyle.marker,
    series2: series,
    scale: common.y.scale,
    title,
    y_labels: type === 'bar' ? category_labels : common.y.labels, // swapped
    x_labels: type === 'bar' ? common.y.labels : category_labels, // swapped
  };

  if (options) {
    (chart_data as BarData).round = /round/i.test(options);
    (chart_data as ChartDataBaseType).data_labels = /labels/i.test(options);

    let match = options.match(/labels="(.*?)"/);
    if (match && series) {
      ApplyLabels(series, match[1], category_labels);
    }
    else {
      match = options.match(/labels=([^\s\r\n,]+)(?:\W|$)/);
      if (match && series) {
        ApplyLabels(series, match[1], category_labels);
      }

    }

    match = options.match(/class=([\w_-]+)(?:\W|$)/);
    if (match) {
      (chart_data as ChartDataBaseType).class_name = match[1];
    }

  }

  return chart_data;

};


/**
 * args: data, labels, title, callouts, "smooth"
 */
export const CreateLineChart = (args: [UnionValue, UnionValue, string, string], type: 'line' | 'area'): ChartData => {

  const series: SeriesType[] = TransformSeriesData(args[0], args[1]);
  const common = CommonData(series, 0, 0);

  const title = args[2]?.toString() || undefined;
  const options = args[3]?.toString() || undefined;

  const chart_data: ChartData = {
    legend: common.legend,
    // style: type, // 'line',
    type: 'scatter2',
    series, // : [{x, y}],
    title,

    x_scale: common.x.scale,
    x_labels: common.x.labels,

    y_scale: common.y.scale,
    y_labels: common.y.labels,

    lines: true,
    filled: type === 'area',

  };

  if (options) {
    // this.chart_data.markers = /marker/i.test(options);
    chart_data.smooth = /smooth/i.test(options);
    // this.chart_data.data_labels = /labels/i.test(options);

    const match = options.match(/class=([\w_-]+)(?:\W|$)/);
    if (match) {
      chart_data.class_name = match[1];
    }

  }

  return chart_data;

};

/**
 * arguments are values, labels, title, sort, label option, ...
 */
export const CreateDonut = (args: [UnionValue?, UnionValue?, string?, string?, string?], pie_chart = false): ChartData => {

  const [_a, _c, title, _options, _slice_title] = args;

  const raw_data = args[0]?.type === ValueType.array ? args[0].value : args[0];

  const flat = raw_data ? Util.Flatten<UnionValue>(raw_data) : [];

  // we still need the aggregate for range, scale
  // let data = flat.map((x) => (typeof x.value.value === 'number') ? x.value.value : undefined) as number[];

  let data: (number|undefined)[] = flat.map(cell => {
    if (IsMetadata(cell)) {
      if (typeof cell.value.value === 'number') {
        return cell.value.value;
      }
    }
    return undefined;
  })


  // if labels are strings, just pass them in. if they're numbers then
  // use the format (we're collecting metadata for this field now)

  const raw_labels = args[1]?.type === ValueType.array ? args[1].value : args[1];

  const labels = Util.Flatten<UnionValue>(raw_labels||[]).map(label => {
    if (IsMetadata(label)) {
      if (typeof label.value.value === 'number' && label.value.format) {
        return NumberFormatCache.Get(label.value.format).Format(label.value.value);
      }
      else return label.value.value?.toString() || '';
    }
    return label.value?.toString() || '';
  });

  // no negative numbers

  let warned = false;
  data = data.map((check) => {
    if (check && check < 0) {
      if (!warned) {
        console.warn('pie/donut chart does not support negative values (omitted)');
        warned = true;
      }
      return 0;
    }
    return check;
  });

  let sum = 0;

  const slices: DonutSlice[] = data.map((value, i) => {
    if (typeof value !== 'undefined') sum += value;
    return { 
      value: value || 0, 
      label: labels[i] || '', 
      index: i + 1, 
      percent: 0,
    };
  });

  if (sum) {
    for (const slice of slices) {
      slice.percent = (slice.value || 0) / sum;
    }
  }

  // titles? label/value/percent
  // FIXME: number format(s)

  let format_pattern = '';
  for (const value of flat) {
    if (IsMetadata(value)) {
      format_pattern = value.value.format || '';
      break;
    }
  }
  
  // const format_pattern = (flat.length && flat[0].value?.format) ? flat[0].value.format : '';
  
  const format = NumberFormatCache.Get(format_pattern || DEFAULT_FORMAT);
  const percent_format = NumberFormatCache.Get('percent');

  // ensure label if we have labels array but no label format string

  if (typeof args[4] === 'undefined' && args[1]) {
    args[4] = 'label';
  }

  const slice_title = (args[4] || '');
  if (slice_title) {
    for (const slice of slices) {
      const value = /*NumberFormatCache.Get('general')*/ format.Format(slice.value || 0);
      const percent = percent_format.Format(slice.percent);
      slice.title = slice_title
        .replace(/value%/ig, percent_format.Format(slice.value || 0))
        .replace(/value/ig, value)
        .replace(/percent/ig, percent)
        .replace(/label/ig, slice.label || '')
        .trim();
    }
  }

  // optionally sort...


  // old-style...

  let sort = (_options||'').toUpperCase();
  if (sort === 'ASC' || sort === 'ASCENDING' || sort === 'INC') {
    slices.sort((a, b) => { return (a.value || 0) - (b.value || 0); });
  }
  else if (sort === 'DESC' || sort === 'DESCENDING' || sort === 'DEC') {
    slices.sort((a, b) => { return (b.value || 0) - (a.value || 0); });
  }
  else {
    const match = (_options||'').match(/sort=([\w]+)(?:\W|$)/i);
    if (match) {
      sort = match[1];
      if (/^(asc|inc)/i.test(sort)) {
        slices.sort((a, b) => { return (a.value || 0) - (b.value || 0); });
      }
      else if (/^(desc|dec)/i.test(sort)) {
        slices.sort((a, b) => { return (b.value || 0) - (a.value || 0); });
      }
    }
  }

  const chart_data: ChartData = {
    type: pie_chart ? 'pie' : 'donut',
    slices,
    title: title || '',
  };

  if (_options) {
    const match = _options.match(/class=([_-\w]+)(?:\W|$)/);
    if (match) {
      chart_data.class_name = match[1];
    }
  }

  return chart_data;

};