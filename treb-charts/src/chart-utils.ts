
import { type UnionValue, ValueType, type ArrayUnion } from 'treb-base-types';
import { LegendStyle } from './chart-types';
import type { SubSeries, SeriesType, BarData, ChartDataBaseType, ChartData, ScatterData2, LineData, DonutSlice } from './chart-types';
import { NumberFormatCache } from 'treb-format';
import { Util } from './util';

/**
 * this file is the concrete translation from function arguments
 * to chart data. chart data is a (somewhat complicated) type with
 * specializations for various chart types. we're splitting the 
 * generation of that data from the actual layout/rendering with
 * a view towards building a new (or several new) renderers.
 */

const DEFAULT_FORMAT = '#,##0.00'; // why not use "general", or whatever the usual default is?

export const ReadSeries = (data: Array<any>): SeriesType => {

  // in this case it's (label, X, Y)
  const series: SeriesType = {
    x: { data: [] },
    y: { data: [] },
  };

  if (data[3] && typeof data[3] === 'number') {
    series.index = data[3];
  }
  if (data[4]) {
    series.subtype = data[4].toString();
  }

  if (data[0]) {

    const flat = Util.Flatten(data[0]);

    // this could be a string, if it's a literal, or metadata 
    // [why would we want metadata?]
    //
    // OK, check that, should be a string (or other literal)

    if (typeof flat[0] === 'object') {
      series.label = flat[0]?.value?.toString() || '';
    }
    else {
      series.label = flat[0].toString();
    }
  }

  // read [2] first, so we can default for [1] if necessary

  if (!!data[2] && (typeof data[2] === 'object') && data[2].type === ValueType.array) {
    const flat = Util.Flatten(data[2].value);
    series.y.data = flat.map(item => typeof item.value.value === 'number' ? item.value.value : undefined);
    if (flat[0].value?.format) {
      series.y.format = flat[0].value?.format as string;
      const format = NumberFormatCache.Get(series.y.format);
      series.y.labels = series.y.data.map(value => (value === undefined) ? undefined : format.Format(value));
    }
  }

  if (!!data[1] && (typeof data[1] === 'object') && data[1].type === ValueType.array) {
    const flat = Util.Flatten(data[1].value);
    series.x.data = flat.map(item => typeof item.value.value === 'number' ? item.value.value : undefined);
    if (flat[0].value.format) {
      series.x.format = flat[0].value.format;
    }
  }

  for (const subseries of [series.x, series.y]) {

    // in case of no values
    if (subseries.data.length) {
      const values = subseries.data.filter(value => value || value === 0) as number[];
      subseries.range = {
        min: Math.min.apply(0, values),
        max: Math.max.apply(0, values),
      };
    }
  }

  return series;

};

export const ArrayToSeries = (array_data: ArrayUnion): SeriesType => {

  // this is an array of Y, X not provided

  const series: SeriesType = { x: { data: [] }, y: { data: [] }, };
  const flat = Util.Flatten(array_data.value);

  // series.y.data = flat.map(item => typeof item.value === 'number' ? item.value : undefined);

  series.y.data = flat.map((item, index) => {

    // if the data is passed in from the output of a function, it will not
    // be inside a metadata structure

    if (typeof item.value === 'number') { return item.value; }

    // ... ok, it's metadata (why not just test?) ...

    // experimenting with complex... put real in X axis and imaginary in Y axis
    // note should also function w/ complex not in a metadata structure

    if (typeof item.value.value?.real === 'number') {
      series.x.data[index] = item.value.value.real;
      return item.value.value.imaginary;
    }

    return typeof item.value.value === 'number' ? item.value.value : undefined;

  });

  if (flat[0].value.format) {
    series.y.format = flat[0].value.format || '';
    const format = NumberFormatCache.Get(series.y.format || '');
    series.y.labels = series.y.data.map(value => (value === undefined) ? undefined : format.Format(value));
  }

  const values = series.y.data.filter(value => value || value === 0) as number[];
  series.y.range = {
    min: Math.min.apply(0, values),
    max: Math.max.apply(0, values),
  };

  // experimenting with complex... this should only be set if we populated
  // it from complex values

  if (series.x.data.length) {

    const filtered: number[] = series.x.data.filter(test => typeof test === 'number') as number[];
    series.x.range = {
      min: Math.min.apply(0, filtered),
      max: Math.max.apply(0, filtered),
    }

    if (flat[0].value.format) {
      series.x.format = flat[0].value.format || '';
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
        for (const entry of raw_data.value) {
          if (!!entry && (typeof entry === 'object')) {
            if (entry.key === 'series') {
              const series = ReadSeries(entry.value);
              list.push(series);
            }
            else if (entry.type === ValueType.array) {
              list.push(ArrayToSeries(entry));
            }
          }
        }
      }
    }
    else if (raw_data.key === 'series') {
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

    const values = Util.Flatten(default_x.value);

    let format = '0.00###';

    if (values[0] && values[0].type === ValueType.object) { // UnionIs.Extended(values[0])) {
      format = values[0].value.format;
    }

    const data = values.map(x => {
      if (x.type === ValueType.number) { return x.value; }
      if (x.type === ValueType.object) { // ??
        // if (UnionIs.Extended(x)) { // ?
        return x.value.value;
      }
      return undefined;
    }) as Array<number | undefined>;

    const filtered = data.filter(x => typeof x === 'number') as number[];

    baseline_x = {
      data,
      format,
      range: {
        min: Math.min.apply(0, filtered),
        max: Math.max.apply(0, filtered),
      }
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

/** get a unified scale, and formats */
export const CommonData = (series: SeriesType[], y_floor?: number, y_ceiling?: number) => {

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
  const x_min = Math.min.apply(0, x.map(test => test.x.range?.min || 0));
  const x_max = Math.max.apply(0, x.map(test => test.x.range?.max || 0));

  const y = series.filter(test => test.y.range);
  let y_min = Math.min.apply(0, x.map(test => test.y.range?.min || 0));
  let y_max = Math.max.apply(0, x.map(test => test.y.range?.max || 0));

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

//------------------------------------------------------------------------------

export const CreateBubbleChart = (args: UnionValue[]): ChartData => {

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
export const CreateScatterChart = (args: any[], style: 'plot' | 'line' = 'plot'): ChartData => {

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
export const CreateColumnChart = (args: [UnionValue?, UnionValue?, string?, string?], type: 'bar' | 'column'): ChartData => {

  const series: SeriesType[] = TransformSeriesData(args[0]);
  const common = CommonData(series);

  let category_labels: string[] | undefined;

  if (args[1]) {

    const values = args[1].type === ValueType.array ? Util.Flatten(args[1].value) : Util.Flatten(args[1]);
    category_labels = values.map((cell) => {
      if (!cell) { return ''; }

      if (cell.type === ValueType.object && cell.value.type === 'metadata') {
        if (typeof cell.value.value === 'number') {
          const format = NumberFormatCache.Get(cell.value.format || DEFAULT_FORMAT);
          return format.Format(cell.value.value);
        }
        return cell.value.value;
      }

      if (typeof cell.value === 'number') {
        const format = NumberFormatCache.Get(cell.format || DEFAULT_FORMAT);
        return format.Format(cell.value);
      }
      return cell.value;
    });

    const count = series.reduce((a, entry) => Math.max(a, entry.y.data.length), 0);

    if (count < category_labels.length) {
      category_labels = category_labels.slice(0, count);
    }

    while (count > category_labels.length) { category_labels.push(''); }

  }

  const title = args[2]?.toString() || undefined;
  const options = args[3]?.toString() || undefined;

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
export const CreateLineChart = (args: any[], type: 'line' | 'area'): ChartData => {

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

  const raw_data = args[0]?.type === ValueType.array ? args[0].value : args[0];

  // we're now expecting this to be metadata (including value).
  // so we need to unpack. could be an array... could be deep...
  const flat = Util.Flatten(raw_data);

  // we still need the aggregate for range, scale
  let data = flat.map((x) => (typeof x.value.value === 'number') ? x.value.value : undefined) as number[];


  // if labels are strings, just pass them in. if they're numbers then
  // use the format (we're collecting metadata for this field now)

  const raw_labels = args[1]?.type === ValueType.array ? args[1].value : args[1];

  const labels = Util.Flatten(raw_labels).map((label) => {
    if (label && typeof label === 'object') {
      const value = label.value?.value;
      if (typeof value === 'number' && label.value?.format) {
        return NumberFormatCache.Get(label.value?.format).Format(value);
      }
      else return value ? value.toString() : '';
    }
    else return label ? label.toString() : '';
  });

  // no negative numbers

  data = data.map((check) => {
    if (check < 0) {
      console.warn('pie/donut chart does not support negative values (omitted)');
      return 0;
    }
    return check;
  });

  const title = args[2] || '';

  let sum = 0;

  const slices: DonutSlice[] = data.map((value, i) => {
    if (typeof value !== 'undefined') sum += value;
    return { value, label: labels[i] || '', index: i + 1, percent: 0 };
  });

  if (sum) {
    for (const slice of slices) {
      slice.percent = (slice.value || 0) / sum;
    }
  }

  // titles? label/value/percent
  // FIXME: number format(s)

  const format_pattern = (flat.length && flat[0].value?.format) ? flat[0].value.format : '';
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

  const options = (args[3] || '').toString().trim();

  // old-style...

  let sort = options.toUpperCase();
  if (sort === 'ASC' || sort === 'ASCENDING' || sort === 'INC') {
    slices.sort((a, b) => { return (a.value || 0) - (b.value || 0); });
  }
  else if (sort === 'DESC' || sort === 'DESCENDING' || sort === 'DEC') {
    slices.sort((a, b) => { return (b.value || 0) - (a.value || 0); });
  }
  else {
    const match = options.match(/sort=([\w]+)(?:\W|$)/i);
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
    title,
  };

  if (options) {
    const match = options.match(/class=([_-\w]+)(?:\W|$)/);
    if (match) {
      chart_data.class_name = match[1];
    }
  }

  return chart_data;

};