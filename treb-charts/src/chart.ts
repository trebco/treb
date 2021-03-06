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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { NumberFormatCache } from 'treb-format';
import { ChartRenderer, Metrics } from './renderer';
import { Area } from './rectangle';
import { Util } from './util';
import { BarData, CellData, ChartData, DonutSlice, LegendLayout, LegendPosition, LegendStyle, SeriesType, SubSeries } from './chart-types';
import { ArrayUnion, ExtendedUnion, UnionValue, ValueType } from 'treb-base-types';

require('../style/charts.scss');

const DEFAULT_FORMAT = '#,##0.00'; // why not use "general", or whatever the usual default is?

export class Chart {

  /** flag indicating we've registered at least once */
  public static functions_registered = false;

  // always exists; default null type, no title

  protected chart_data: ChartData = {type: 'null'};

  // not chart-specific, so leave outside (FIXME: layout options?)

  // FIXME: change depending on whether there are y-axis labels
  // FIXME: different for donut charts...

  private margin = { top: 0.025, left: 0.05, bottom: 0.025, right: 0.075 };

  constructor(
    public renderer: ChartRenderer = new ChartRenderer()) {
  }

  public Initialize(node: HTMLElement) {
    this.renderer.Initialize(node);
  }

  public Exec(func: string, union: ExtendedUnion) {

    const args: any[] = union?.value || [];
    
    switch (func.toLowerCase()) {

      case 'column.chart':
        this.CreateColumnChart(args as [UnionValue?, UnionValue?, string?, string?], 'column');
        break;

      case 'bar.chart':
        this.CreateColumnChart(args as [UnionValue?, UnionValue?, string?, string?], 'bar');
        break;
              
      case 'line.chart':
        this.CreateLineChart(args, 'line');
        break;

      case 'area.chart':
        this.CreateLineChart(args, 'area');
        break;

      case 'donut.chart':
      case 'pie.chart':
        this.CreateDonut(args as [UnionValue?, UnionValue?, string?, string?, string?], func.toLowerCase() === 'pie.chart');
        break;

      case 'scatter.plot':
        this.CreateScatterChart(args, 'plot');
        break;

      case 'scatter.line':
        this.CreateScatterChart(args, 'line');
        break;
  
      default:
        this.Clear();
        break;
    }

  }

  public Clear() {
    this.chart_data = { type: 'null' };
  }

  /**
   * column/bar chart, now using common Series data and routines
   * 
   * @param args arguments: data, categories, title, options
   * @param type 
   */
  public CreateColumnChart(args: [UnionValue?, UnionValue?, string?, string?], type: 'bar'|'column'): void {

    const series: SeriesType[] = this.TransformSeriesData(args[0]);

    const common = this.CommonData(series);

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

      if(count < category_labels.length) {
        category_labels = category_labels.slice(0, count);
      }

      while (count > category_labels.length) { category_labels.push(''); }

    }

    const title = args[2]?.toString() || undefined;
    const options = args[3]?.toString() || undefined;

    this.chart_data = {
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
      (this.chart_data as BarData).round = /round/i.test(options);
      this.chart_data.data_labels = /labels/i.test(options);

      let match = options.match(/labels="(.*?)"/);
      if (match && series) {
        this.ApplyLabels(series, match[1], category_labels);
      }
      else {
        match = options.match(/labels=([^\s\r\n,]+)(?:\W|$)/);
        if (match && series) {
          this.ApplyLabels(series, match[1], category_labels);
        }
 
      }

      match = options.match(/class=([\w_-]+)(?:\W|$)/);
      if (match) {
        this.chart_data.class_name = match[1];
      }

    }

  }

  public ReadSeries(data: Array<any>): SeriesType {
    
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
          
  }

  public ArrayToSeries(array_data: ArrayUnion): SeriesType {

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

  }

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
  public TransformSeriesData(raw_data?: UnionValue, default_x?: UnionValue): SeriesType[] {

    if (!raw_data) { return []; }

    const list: SeriesType[] = [];

    if (raw_data.type === ValueType.object) {
      if (raw_data.key === 'group') {
        if (Array.isArray(raw_data.value)) {
          for (const entry of raw_data.value) {
            if (!!entry && (typeof entry === 'object')) {
              if (entry.key === 'series') {
                const series = this.ReadSeries(entry.value);
                list.push(series);
              }
              else if (entry.type === ValueType.array) {
                list.push(this.ArrayToSeries(entry));
              }
            }
          }
        }
      }
      else if (raw_data.key === 'series') {
        const series = this.ReadSeries(raw_data.value);
        list.push(series);
      }
    }
    else if (raw_data.type === ValueType.array) {
      list.push(this.ArrayToSeries(raw_data));
    }

    // now we may or may not have X for each series, so we need
    // to patch. it's also possible (as with older chart functions)
    // that there's a common X -- not sure if we want to continue
    // to support that or not...

    let baseline_x: SubSeries|undefined;
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
      }) as Array<number|undefined>;
  
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
  }

  /** get a unified scale, and formats */
  public CommonData(series: SeriesType[], y_floor?: number, y_ceiling?: number) {

    let x_format = '';
    let y_format = '';

    for (const entry of series) {
      if (entry.y.format && !y_format) { y_format = entry.y.format; }
      if (entry.x.format && !x_format) { x_format = entry.x.format; }
    }

    let legend: Array<{label: string, index?: number}>|undefined; // string[]|undefined;
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

    let x_labels: string[]|undefined;
    let y_labels: string[]|undefined;

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

  }

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
  public CreateScatterChart(args: any[], style: 'plot'|'line' = 'plot'): void {

    // FIXME: transform the data, then have this function
    // operate on clean data. that way the transform can
    // be reused (and the function can be reused without the
    // transform).

    const series: SeriesType[] = this.TransformSeriesData(args[0]);

    const common = this.CommonData(series);

    const title = args[1]?.toString() || undefined;
    const options = args[2]?.toString() || undefined;

    this.chart_data = {
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

      this.chart_data.markers = /marker/i.test(options);
      this.chart_data.smooth = /smooth/i.test(options);
      this.chart_data.data_labels = /labels/i.test(options);

      let match = options.match(/labels="(.*?)"/);
      if (match && this.chart_data.series) {
        this.ApplyLabels(this.chart_data.series, match[1]);
      }
      else {
        match = options.match(/labels=([^\s\r\n,]+)(?:\W|$)/);
        if (match && this.chart_data.series) {
          this.ApplyLabels(this.chart_data.series, match[1]);
        }
      }

      match = options.match(/class=([\w_-]+)(?:\W|$)/);
      if (match) {
        this.chart_data.class_name = match[1];
      }

    }

  }

  public ApplyLabels(series_list: SeriesType[], pattern: string, category_labels?: string[]): void {

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

  }

  /**
   * args: data, labels, title, callouts, "smooth"
   */
  public CreateLineChart(args: any[], type: 'line'|'area'): void { // |'bar'|'column') {

    const series: SeriesType[] = this.TransformSeriesData(args[0], args[1]);

    const common = this.CommonData(series, 0, 0);

    const title = args[2]?.toString() || undefined;
    const options = args[3]?.toString() || undefined;

    this.chart_data = {
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
      this.chart_data.smooth = /smooth/i.test(options);
      // this.chart_data.data_labels = /labels/i.test(options);
      
      const match = options.match(/class=([\w_-]+)(?:\W|$)/);
      if (match) {
        this.chart_data.class_name = match[1];
      }

    }

  }

  /**
   * arguments are values, labels, title, sort, label option, ...
   */
  public CreateDonut(args: [UnionValue?, UnionValue?, string?, string?, string?], pie_chart = false): void {

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
    
    this.chart_data = {
      type: pie_chart ? 'pie' : 'donut',
      slices,
      title,
    };

    if (options) {
      const match = options.match(/class=([_-\w]+)(?:\W|$)/);
      if (match) {
        this.chart_data.class_name = match[1];
      }
    }

  }


  /** pass-through */
  public Resize() {
    this.renderer.Resize();
  }

  /**
   * redraw
   */
  public Update() {

    // reset
    this.renderer.Resize(); // just too many problems
    this.renderer.Prerender();
    this.renderer.Clear(this.chart_data.class_name);

    // get usable area [FIXME: method]
    const area = new Area(0, 0, this.renderer.size.width, this.renderer.size.height);

    // chart margin
    const chart_margin = {
      top: Math.round(area.height) * this.margin.top,
      bottom: Math.round(area.height) * this.margin.bottom,
      left: Math.round(area.width) * this.margin.left,
      right: Math.round(area.width) * this.margin.right,
    };

    // title, top or bottom
    const title = this.chart_data.title;

    if (title) {
      this.renderer.RenderTitle(title, area, chart_margin.top, 
        this.chart_data.title_layout||'top');
    }

    // pad
    area.top += chart_margin.top;
    area.left += chart_margin.left;
    area.bottom -= chart_margin.bottom;
    area.right -= chart_margin.right;

    if (this.chart_data.legend && this.chart_data.legend.length) {

      let default_position = LegendPosition.top;
      if (this.chart_data.title) {
        if (!this.chart_data.title_layout || this.chart_data.title_layout === 'top') {
          default_position = LegendPosition.bottom;
        }
      }

      const position = this.chart_data.legend_position || default_position;

      this.renderer.Legend({
        labels: this.chart_data.legend,
        position,
        style: this.chart_data.legend_style,
        layout: (position === LegendPosition.top || position === LegendPosition.bottom) ? 
          LegendLayout.horizontal : LegendLayout.vertical,
        area,
      });

    }

    if (this.chart_data.type === 'histogram'
        || this.chart_data.type === 'line'
        || this.chart_data.type === 'area'
        || this.chart_data.type === 'column'
        || this.chart_data.type === 'histogram2'
        || this.chart_data.type === 'bar'
        || this.chart_data.type === 'scatter2'
        ) {

      // we need to measure first, then lay out the other axis, then we
      // can come back and render. it doesn't really matter which one you
      // do first.

      // measure x axis (height)

      let x_metrics: Metrics[] = [];
      let max_x_height = 0;

      if (this.chart_data.x_labels && this.chart_data.x_labels.length) {
        x_metrics = this.chart_data.x_labels.map((text) => {
          const metrics = this.renderer.MeasureText(text, ['axis-label', 'x-axis-label'], true);
          max_x_height = Math.max(max_x_height, metrics.height);
          return metrics;
        });
      }

      // measure & render y axis

      if (this.chart_data.y_labels && this.chart_data.y_labels.length) {

        const y_labels: Array<{label: string; metrics: Metrics}> = [];
        let max_width = 0;
        let max_height = 0;

        const scale = (this.chart_data.type === 'scatter2') ? this.chart_data.y_scale : this.chart_data.scale;
        
        const count = (this.chart_data.type === 'bar') ? 
          this.chart_data.y_labels.length :
          /* this.chart_data. */ 
          scale.count + 1;

        for (let i = 0; i < count; i++ ){
          const metrics = this.renderer.MeasureText(this.chart_data.y_labels[i], ['axis-label', 'y-axis-label']);
          y_labels.push({ label: this.chart_data.y_labels[i], metrics });
          max_width = Math.max(max_width, metrics.width);
          max_height = Math.max(max_height, metrics.height);
        }

        area.bottom = Math.round(area.bottom - max_height / 2);
        area.top = Math.round(area.top + max_height / 2);

        if (x_metrics.length) {
          area.bottom -= (max_x_height + chart_margin.bottom);
        }

        if (this.chart_data.type === 'bar') {
          this.renderer.RenderYAxisBar(area, area.left + max_width, y_labels, ['axis-label', 'y-axis-label']);
        }
        else {
          this.renderer.RenderYAxis(area, area.left + max_width, y_labels, ['axis-label', 'y-axis-label']);
        }
        area.left += (max_width + chart_margin.left);

      }

      // now render x axis

      if (x_metrics.length && this.chart_data.x_labels && this.chart_data.x_labels.length) {

        const tick = (this.chart_data.type === 'histogram2');
        const offset_tick = (
          this.chart_data.type !== 'line' && 
          this.chart_data.type !== 'area' && 
          this.chart_data.type !== 'bar' && 
          this.chart_data.type !== 'scatter2' && 
          this.chart_data.type !== 'histogram2' 
          );

        // do this before you fix the offset

        if (tick) {
          this.renderer.RenderXAxisTicks(area, offset_tick, this.chart_data.x_labels.length);
        }


        if (this.chart_data.y_labels) {
          // undo, temp
          area.bottom += (max_x_height + chart_margin.bottom);
        }

        // render
        this.renderer.RenderXAxis(area, 
          offset_tick,
          this.chart_data.x_labels, 
          x_metrics, 
          ['axis-label', 'x-axis-label']);

        // update bottom (either we unwound for labels, or we need to do it the first time)
        area.bottom -= (max_x_height + chart_margin.bottom);

      }

    }

    // now do type-specific rendering

    switch (this.chart_data.type) {
    case 'scatter':
      this.renderer.RenderPoints(area, this.chart_data.x, this.chart_data.y, 'mc mc-correlation series-1');
      break;

    case 'scatter2':

      this.renderer.RenderGrid(area, 
        this.chart_data.y_scale.count, 
        this.chart_data.x_scale.count + 1, // (sigh)
        'chart-grid');

      if (this.chart_data.series) {
        for (let i = 0; i < this.chart_data.series.length; i++) {
          const series = this.chart_data.series[i];

          let lines = !!this.chart_data.lines;
          let points = !!this.chart_data.points;

          if (series.subtype === 'plot') {
            points = true;
            lines = false;
          }
          else if (series.subtype === 'line') {
            points = false;
            lines = true;
          }

          const index = typeof series.index === 'number' ? series.index : i + 1;
          this.renderer.RenderScatterSeries(area, 
            series.x.data, 
            series.y.data, 
            this.chart_data.x_scale, 
            this.chart_data.y_scale, 
              lines,
              points,
              !!this.chart_data.filled,
              !!this.chart_data.markers,
              !!this.chart_data.smooth,
              `scatter-plot series-${index}`);
        }
        if (this.chart_data.data_labels) {
          for (let i = 0; i < this.chart_data.series.length; i++) {
            const series = this.chart_data.series[i];
            if (series.y.labels) {
              this.renderer.RenderDataLabels(
                  area, 
                  series.x.data, 
                  series.y.data, 
                  this.chart_data.x_scale, 
                  this.chart_data.y_scale, 
                  series.y.labels,
                  i + 1);
            }
          }
        }
      }
      break;

    case 'pie':
    case 'donut':
      {
        const outer = (Math.min(area.height, area.width) / 2) * .9;
        const inner = this.chart_data.type === 'pie' ? 0 : outer * .8;
        this.renderer.RenderDonut(this.chart_data.slices, area.center, outer, inner, area,
          true, 'donut');
      }
      break;

    case 'line':
    case 'area':
      {
        const scale = this.chart_data.scale;
        if (this.chart_data.series) {

          const points = this.chart_data.x_scale ? 
            this.chart_data.x_scale.max :
            Math.max.apply(0, this.chart_data.series.map(x => x.length));

          const func = this.chart_data.smooth ?
            this.renderer.RenderSmoothLine : this.renderer.RenderLine;

          // gridlines
          this.renderer.RenderGrid(area, 
            this.chart_data.scale.count, 
            this.chart_data.x_scale ? this.chart_data.x_scale.count + 1 : points, 
            'chart-grid');

          // series
          let series_index = 0;
          for (const series of this.chart_data.series) {

            

            const y = series.map((point) => {
              if (typeof point === 'undefined') { return undefined; }
              return Util.ApplyScale(point, area.height, scale);
            });

            if (y.length < points) {
              for (let i = y.length; i < points; i++) {
                y.push(undefined);
              }
            }

            const styles = [
              this.chart_data.type === 'area' ? 'chart-area' : 'chart-line',
              `series-${series_index + 1}`]

            func.call(this.renderer, area, y, (this.chart_data.type === 'area'), this.chart_data.titles, styles);
            series_index++;
          }
        }

        // TODO: callouts

      }
      break;

    case 'bar':
      {
        let corners: number[]|undefined;

        // gridlines
        this.renderer.RenderBarGrid(area, this.chart_data.scale.count, 'chart-grid');
        if (this.chart_data.series2) {

          let count = 0;
          const series_count = this.chart_data.series2.length;

          for (const series of this.chart_data.series2) {
            count = Math.max(count, series.y.data.length);
          }

          const row_height = area.height / count;
          let row_pct = .7;
          if (typeof this.chart_data.space === 'number') {
            row_pct = Math.max(0, Math.min(1, 1 - (this.chart_data.space)));
          }

          const space = row_height * (1 - row_pct) / 2;
          const height = (row_height - space * 2) / series_count;

          let zero = 0;
          if (this.chart_data.scale.min < 0) { // && this.chart_data.scale.max >= 0) {
            zero = Util.ApplyScale(0, area.width, this.chart_data.scale);
          }

          if (this.chart_data.round) {
            const half_height = Math.floor(height / 2);
            corners = [0, half_height, half_height, 0];
          }

          for (let s = 0; s < series_count; s++) {
            const series = this.chart_data.series2[s];
            const color_index = typeof series.index === 'number' ? series.index : s + 1;

            for (let i = 0; i < series.y.data.length; i++ ){
              const value = series.y.data[i];
              if (typeof value === 'number') {

                const y = Math.round(area.top + i * row_height + space) + s * height;

                let x = 0;
                let width = 0;
                let negative = false;

                if (zero) {
                  if (value > 0) {
                    width = Util.ApplyScale(value + this.chart_data.scale.min, area.width, this.chart_data.scale);
                    x = area.left + zero;
                  }
                  else {
                    width = Util.ApplyScale(this.chart_data.scale.min - value, area.width, this.chart_data.scale);
                    x = area.left + zero - width;
                    negative = true;
                  }
                }
                else {
                  width = Util.ApplyScale(value, area.width, this.chart_data.scale);
                  x = area.left;
                }

                // const bar_title = this.chart_data.titles ? this.chart_data.titles[i] : undefined;
                const bar_title = undefined;

                if (width) {
                  this.renderer.RenderRectangle(new Area(
                    x, y, x + width, y + height,
                  ), corners, ['chart-column', `series-${color_index}`], bar_title || undefined);
                }
              }
            }
          }

        }

      }
      break;

    case 'column':
    case 'histogram2':
      {

        // gridlines
        this.renderer.RenderGrid(area, this.chart_data.scale.count, 0, 'chart-grid');

        if (this.chart_data.series2) {

          let count = 0;
          const series_count = this.chart_data.series2.length;

          for (const series of this.chart_data.series2) {
            count = Math.max(count, series.y.data.length);
          }

          // columns
          const column_width = area.width / count;
          let column_pct = .7;
          if (typeof this.chart_data.space === 'number') {
            column_pct = Math.max(0, Math.min(1, 1 - (this.chart_data.space)));
          }

          const space = column_width * (1 - column_pct) / 2;
          const width = (column_width - space * 2) / series_count;

          let zero = 0;
          if (this.chart_data.scale.min < 0) { // && this.chart_data.scale.max >= 0) {
            zero = Util.ApplyScale(0, area.height, this.chart_data.scale);
          }

          if (this.chart_data.callouts && this.chart_data.x_scale) {
            const scale = this.chart_data.x_scale;
            const lines = this.chart_data.callouts.map((callout, index) => {
              const x = Math.round(area.left + Util.ApplyScale(callout.value, area.width, scale)) + .5;
              return {
                x1: x, y1: area.bottom - area.height, x2: x, y2: area.bottom,
                classes: `callout-${index + 1}`,
              }
            });
            this.renderer.RenderCalloutLines(lines);
          }

          let corners: number[]|undefined;

          if (this.chart_data.round) {
            const half_width = Math.floor(width/2);
            corners = [half_width, half_width, 0, 0];
          }

          for (let s = 0; s < series_count; s++) {
            const series = this.chart_data.series2[s];
            const color_index = typeof series.index === 'number' ? series.index : s + 1;

            for (let i = 0; i < series.y.data.length; i++ ){
              const value = series.y.data[i];
              // const format = NumberFormatCache.Get(series.y.format || '0.00');

              if (typeof value === 'number') {

                // const x = Math.round(area.left + i * column_width + space) + s * width;
                const x = (area.left + i * column_width + space) + s * width;
                
                let height = 0;
                let y = 0;
                let negative = false;

                if (zero) {
                  if (value > 0) {
                    height = Util.ApplyScale(value + this.chart_data.scale.min, area.height, this.chart_data.scale);
                    y = area.bottom - height - zero;
                  }
                  else {
                    height = Util.ApplyScale(this.chart_data.scale.min - value, area.height, this.chart_data.scale);
                    y = area.bottom - zero; // // area.bottom - height - zero;
                    negative = true;
                  }
                }
                else {
                  height = Util.ApplyScale(value, area.height, this.chart_data.scale);
                  y = area.bottom - height;
                }

                // const bar_title = this.chart_data.titles ? this.chart_data.titles[i] : undefined;
                const bar_title = undefined;

                if (height) {

                  const label = (this.chart_data.data_labels && !!series.y.labels) ? series.y.labels[i] : '';
                  const label_point = {
                    x: Math.round(x + width / 2),
                    y: Math.round(y - 10),
                  };

                  this.renderer.RenderRectangle(new Area(
                    x, y, x + width, y + height,
                  ), corners, ['chart-column', `series-${color_index}`], bar_title || undefined, label, label_point);
                }
              }
            }

          }
  
        }

      }
      break;

    case 'histogram':
      {
        // gridlines
        this.renderer.RenderGrid(area, this.chart_data.scale.count, 0, 'chart-grid');

        // columns
        const column_width = area.width / this.chart_data.count;
        const column_pct = this.chart_data.column_width;

        const space = column_width * (1 - column_pct) / 2;

        for (let i = 0; i < this.chart_data.count; i++ ){
          const x = Math.round(area.left + i * column_width + space);
          const width = column_width - space * 2;
          const height = Util.ApplyScale(this.chart_data.bins[i], area.height, this.chart_data.scale);
          const y = area.bottom - height;
          const bar_title = this.chart_data.titles ? this.chart_data.titles[i] : undefined;

          this.renderer.RenderRectangle(new Area(
            x, y, x + width, y + height,
          ), undefined, 'chart-column series-1', bar_title || undefined);
        }

      }
      break;
    }

  }

  /** type guard */
  protected IsCellData(candidate: any): candidate is CellData {
    return (
      typeof candidate === 'object' &&
      typeof candidate.address === 'object' &&
      typeof candidate.address.row === 'number' &&
      typeof candidate.address.column === 'number');
  }


}
