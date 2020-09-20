
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { ChartRenderer, Metrics } from './renderer';
import { Area } from './rectangle';
import { Util } from './util';
import { CellData, ChartData, DonutSlice, LegendLayout, LegendPosition, LegendStyle, NumberOrUndefinedArray, SeriesType, SubSeries } from './chart-types';
import { DecoratedArray } from './chart-functions';

import { RangeScale } from 'treb-utils';

// require('../style/charts.scss');
require('../style/charts.pcss');

const DEFAULT_FORMAT = '#,##0.00'; // why not use "general", or whatever the usual default is?

export class Chart {

  /** function descriptors to register with the calculator */
  // public static chart_functions = ChartFunctions;

  /** flag indicating we've registered at least once */
  public static functions_registered = false;

  // always exists; default null type, no title

  private chart_data: ChartData = {type: 'null'};

  // not chart-specific, so leave outside (FIXME: layout options?)

  // FIXME: change depending on whether there are y-axis labels
  // FIXME: different for donut charts...

  // private margin = { top: 0.025, left: 0.025, bottom: 0.025, right: 0.05 };
  private margin = { top: 0.025, left: 0.05, bottom: 0.025, right: 0.075 };

  constructor(
    public renderer: ChartRenderer = new ChartRenderer()) {
  }

  public Initialize(node: HTMLElement) {
    this.renderer.Initialize(node);
  }

  public Exec(func: string, args: any[] = []) {

    switch (func.toLowerCase()) {
      case 'mc.histogram':
        this.CreateHistogram(args);
        break;

      case 'mc.correlation':
        this.CreateScatter(args);
        break;

      case 'column.chart':
        this.CreateColumnChart(args, 'column');
        break;

      case 'bar.chart':
        this.CreateColumnChart(args, 'bar');
        break;
              
      case 'line.chart':
        this.CreateLineChart(args, 'line');
        break;

      case 'area.chart':
        this.CreateLineChart(args, 'area');
        break;

      case 'donut.chart':
      case 'pie.chart':
        this.CreateDonut(args, func.toLowerCase() === 'pie.chart');
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
   * @param args arguments: data, categories, title
   * @param type 
   */
  public CreateColumnChart(args: any[], type: 'bar'|'column'): void {

    const series: SeriesType[] = Array.isArray(args[0]) ? this.TransformSeriesData(args[0]) : [];
    const common = this.CommonData(series);

    let category_labels: string[] | undefined;

    if (args[1]) {
      const values = Util.Flatten(args[1]);
      category_labels = values.map(cell => {
        if (!cell) { return ''; }
        if (typeof cell.value === 'number') {
          const format = NumberFormatCache.Get(cell.format || DEFAULT_FORMAT);
          return format.Format(cell.value);
        }
        return cell.value;
      });
    }

    this.chart_data = {
      type,
      legend: common.legend,
      // legend_position: LegendPosition.right,
      legend_style: LegendStyle.marker,
      series2: series,
      scale: common.y.scale,
      title: args[2] || '',
      y_labels: type === 'bar' ? category_labels : common.y.labels, // swapped
      x_labels: type === 'bar' ? common.y.labels : category_labels, // swapped
    };

  }

  public ReadSeries(data: DecoratedArray<any>): SeriesType {
    
    // in this case it's (label, X, Y)
    const series: SeriesType = {
      x: { data: [] },
      y: { data: [] },
    };

    if (data[0]) {
      
      const flat = Util.Flatten(data[0]);
      if (typeof flat[0] === 'object') {
        series.label = (flat[0] && flat[0].value) ? flat[0].value.toString() : '';
      }
      else {
        series.label = flat[0].toString();
      }
    }

    // read [2] first, so we can default for [1] if necessary

    if (data[2] && Array.isArray(data[2])) {
      const flat = Util.Flatten(data[2]);
      series.y.data = flat.map(item => typeof item.value === 'number' ? item.value : undefined);
      if (flat[0].format) {
        series.y.format = flat[0].format as string;
        const format = NumberFormatCache.Get(series.y.format);
        series.y.labels = series.y.data.map(value => (value === undefined) ? undefined : format.Format(value));
      }
    }

    if (data[1] && Array.isArray(data[1])) {
      const flat = Util.Flatten(data[1]);
      series.x.data = flat.map(item => typeof item.value === 'number' ? item.value : undefined);
      if (flat[0].format) {
        series.x.format = flat[0].format;
      }
    }

    // UPDATE: no default for X (not yet, anyway)
    /*
    else {
      series.x.data = series.y.data.map((row, i) => i);
    }
    */

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

  public ArrayToSeries(data: any): SeriesType {

    // this is an array of Y, X not provided

    const series: SeriesType = { x: { data: [] }, y: { data: [] }, };
    const flat = Util.Flatten(data);

    series.y.data = flat.map(item => typeof item.value === 'number' ? item.value : undefined);
    if (flat[0].format) {
      series.y.format = flat[0].format || '';
    }

    const values = series.y.data.filter(value => value || value === 0) as number[];
    series.y.range = {
      min: Math.min.apply(0, values), 
      max: Math.max.apply(0, values), 
    };

    /*
    // no default (not yet)
    series.x.data = flat.map((row, i) => i);
    series.x.range = {
      min: 0, 
      max: flat.length - 1, 
    };
    */

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
   */
  public TransformSeriesData(raw_data: any, default_x?: Array<number|undefined>): SeriesType[] {

    const list: SeriesType[] = [];
    
    if (Array.isArray(raw_data)) {
      const decorated = raw_data as DecoratedArray<any>;
      if (decorated._type === 'group') {
        for (const entry of decorated) {
          if (Array.isArray(entry)) {
            if ((entry as DecoratedArray<any>)._type === 'series') {
              const series = this.ReadSeries(entry as DecoratedArray<any>)
              list.push(series);
            }
            else {
              const series = this.ArrayToSeries(entry);
              list.push(series);
            }
          }
        }
      }
      else if (decorated._type === 'series') {
        const series = this.ReadSeries(decorated);
        list.push(series);
      }
      else {
        list.push(this.ArrayToSeries(decorated));
      }
    }
    
    // now we may or may not have X for each series, so we need
    // to patch. it's also possible (as with older chart functions)
    // that there's a common X -- not sure if we want to continue
    // to support that or not...

    let baseline_x: SubSeries|undefined;
    let max_y_length = 0;

    // if we have a default, use that (and range it)

    if (default_x) {
      const filtered = default_x.filter(x => x || x === 0) as number[];
      baseline_x = {
        data: default_x,
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
  public CommonData(series: SeriesType[]) {

    let x_format = '';
    let y_format = '';

    for (const entry of series) {
      if (entry.y.format && !y_format) { y_format = entry.y.format; }
      if (entry.x.format && !x_format) { x_format = entry.x.format; }
    }

    let legend: string[]|undefined;
    if (series.some(test => test.label && (test.label.length > 0))) {
      legend = series.map((entry, i) => entry.label || `Series ${i + 1}`);
    }

    const x = series.filter(test => test.x.range);
    const x_min = Math.min.apply(0, x.map(test => test.x.range?.min || 0));
    const x_max = Math.max.apply(0, x.map(test => test.x.range?.max || 0));

    const y = series.filter(test => test.y.range);
    const y_min = Math.min.apply(0, x.map(test => test.y.range?.min || 0));
    const y_max = Math.max.apply(0, x.map(test => test.y.range?.max || 0));

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

    const series: SeriesType[] = Array.isArray(args[0]) ? this.TransformSeriesData(args[0]) : [];
    const common = this.CommonData(series);
   
    this.chart_data = {
      legend: common.legend,
      style,
      type: 'scatter2', 
      series, // : [{x, y}],
      title: args[1] || '', 

      x_scale: common.x.scale, 
      x_labels: common.x.labels, 

      y_scale: common.y.scale,
      y_labels: common.y.labels,

      lines: true,

    };

    if (args[2]) {
      const options = args[2].toString();
      this.chart_data.markers = /marker/i.test(options);
      this.chart_data.smooth = /smooth/i.test(options);
      this.chart_data.data_labels = /labels/i.test(options);
    }

  }

  /**
   * args: data, labels, title, callouts, "smooth"
   */
  public CreateLineChart(args: any[], type: 'line'|'area') { // |'bar'|'column') {

    const title = args[2] || '';
    const raw_data = args[0];

    // we're now expecting this to be metadata (including value).
    // so we need to unpack. could be an array... could be deep...
    const flat = Util.Flatten(raw_data);

    // we still need the aggregate for range, scale
    const data = flat.map((x) => (typeof x.value === 'number') ? x.value : undefined) as number[];

    // but now we're potentially splitting into series
    let series: NumberOrUndefinedArray[];

    if (Array.isArray(raw_data) && ((raw_data as any)._type === 'series' || (raw_data as any)._type === 'group')) {
      series = raw_data.map(entry => {
        return Util.Flatten(entry).map((x) => (typeof x.value === 'number') ? x.value : undefined) as number[];
      });
    }
    else {
      series = [data];
    }

    /*
    // we still need the aggregate for range, scale
    const data = Util.Flatten(raw_data).map((x) => (typeof x === 'undefined') ? x : Number(x)) as number[];

    // but now we're potentially splitting into series
    let series: NumberOrUndefinedArray[];

    if (Array.isArray(raw_data) && (raw_data as any)._type === 'series') {
      series = raw_data.map(entry => {
        return Util.Flatten(entry).map((x) => (typeof x === 'undefined') ? x : Number(x)) as number[];
      });
    }
    else {
      series = [data];
    }
    */

    const range = Util.Range(data);

    // FIXME: optionally force 0 min
    if (range.min) {
      range.min = Math.min(0, range.min);
    }

    const scale = Util.Scale(range.min || 0, range.max || 0, 7);
    const format_pattern = (flat.length && flat[0].format) ? flat[0].format : '';
    const y_format = NumberFormatCache.Get(format_pattern || DEFAULT_FORMAT);
    const y_labels: string[] = [];

    for (let i = 0; i <= scale.count; i++) {
      y_labels.push(y_format.Format(scale.min + i * scale.step));
    }

    let x_labels: string[] | undefined;
    let x_scale: RangeScale | undefined;

    if (args[1]) {
      const values = Util.Flatten(args[1]);
      x_labels = values.map(cell => {
        if (!cell) { return ''; }
        if (typeof cell.value === 'number') {
          const format = NumberFormatCache.Get(cell.format || DEFAULT_FORMAT);
          return format.Format(cell.value);
        }
        return cell.value;
      });
    }
    else {
      const count = Math.max.apply(0, series.map(data => data.length));
      x_scale = Util.Scale(0, count, 7);
    }

    // const titles = x_labels ? x_labels.map((x_label, i) => `${x_label} : ${y_format.Format(data[i])}`) : undefined;
    const titles = undefined;

    let callouts: {values: number[]; labels: string[]} | undefined;

    /*
    const callout_data = args[5];
    if (callout_data && Array.isArray(callout_data)) {
      callouts = {
        values: callout_data[0],
        labels: callout_data[1] || callout_data[0].map((x: number) => x.toString()),
      };
    }
    */

    const smooth = (args[4] === 'smooth');

    this.chart_data = {
      type,
      series,
      scale,
      title,
      y_labels,
      x_labels,
      x_scale,
      callouts,
      titles,
      smooth,
    };

  }

  /**
   * arguments are values, labels, title, sort, label option, ...
   */
  public CreateDonut(args: any[], pie_chart = false) {

    /*

    // data -> number or undefined

    let data = Util.Flatten(args[0]).map((x) => (typeof x === 'undefined') ? x : Number(x)) as number[];


    */

    //////////

    const raw_data = args[0];

    // we're now expecting this to be metadata (including value).
    // so we need to unpack. could be an array... could be deep...
    const flat = Util.Flatten(raw_data);

    // we still need the aggregate for range, scale
    let data = flat.map((x) => (typeof x.value === 'number') ? x.value : undefined) as number[];

    /*
    // but now we're potentially splitting into series
    let series: NumberOrUndefinedArray[];

    if (Array.isArray(raw_data) && (raw_data as any)._type === 'series') {
      series = raw_data.map(entry => {
        return Util.Flatten(entry).map((x) => (typeof x.value === 'number') ? x.value : undefined) as number[];
      });
    }
    else {
      series = [data];
    }
    */

    //////////

    // if labels are strings, just pass them in. if they're numbers then
    // use the format (we're collecting metadata for this field now)

    const labels = Util.Flatten(args[1]).map((label) => {
      if (label && typeof label === 'object') {
        const value = label.value;
        if (typeof value === 'number' && label.format) {
          return NumberFormatCache.Get(label.format).Format(value);
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

    const format_pattern = (flat.length && flat[0].format) ? flat[0].format : '';
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

    const sort = (args[3] || '').toString().trim();

    if (/^(asc|inc)/i.test(sort)) {
      slices.sort((a, b) => {
        return (a.value || 0) - (b.value || 0);
      });
    }
    else if (/^(desc|dec)/i.test(sort)) {
      slices.sort((a, b) => {
        return (b.value || 0) - (a.value || 0);
      });
    }

    this.chart_data = {
      type: pie_chart ? 'pie' : 'donut',
      slices,
      title,
    };

  }

  public CreateScatter(args: any[]) {

    // validate first 2 args

    if (!this.IsCellData(args[0])) {
      console.warn('invalid args [0]');
      this.Clear();
      return;
    }

    if (!this.IsCellData(args[1])) {
      console.warn('invalid args [1]');
      this.Clear();
      return;
    }

    const title = args[2] || '';

    const A: CellData = args[0];
    const B: CellData = args[1];

    let x = (A.simulation_data || []).slice(0);
    let y = (B.simulation_data || []).slice(0);

    const min1 = Math.min.apply(0, x);
    const max1 = Math.max.apply(0, x);
    const range1 = max1 - min1;
    x = x.map((value) => (value - min1) / range1);

    const min2 = Math.min.apply(0, y);
    const max2 = Math.max.apply(0, y);
    const range2 = max2 - min2;
    y = y.map((value) => (value - min2) / range2);

    const count = Math.min(x.length, y.length);

    this.chart_data = {
      type: 'scatter', x, y, count, title,
    };

  }

  /**
   * create histogram.
   *
   * args: cell data, title, format-x, format-y, bins
   */
  public CreateHistogram(args: any[]) { // data: number[]) {

    // validate args (actually we only care about the first one)

    if (!this.IsCellData(args[0])) {
      console.warn('invalid args', args);
      this.Clear();
      return;
    }

    const src: CellData = args[0];
    const data: number[] = src.simulation_data || [];

    const title = args[1] || '';

    let suggested_bins = 8;
    if (typeof args[4] === 'number' && args[4]) { suggested_bins = args[4]; }

    // 2 loops?
    const scale = Util.Scale(Math.min.apply(0, data), Math.max.apply(0, data), suggested_bins);

    const bins: number[] = [];
    const label_values: number[] = [];

    for (let i = 0; i <= scale.count; i++) {
      bins[i] = 0;
      label_values[i] = (scale.min + i * scale.step);
    }

    for (const value of data) {
      const bin = Math.round((value - scale.min) / scale.step);
      bins[bin]++;
    }

    // FIXME: this should move to render
    // NO, it should not: anything that is independent of size should
    // be done here; render may be called more than once on resize/repaint.

    let x_format: NumberFormat;
    if (typeof args[2] === 'undefined' || args[2] === true) {
      x_format = NumberFormatCache.Get(src.format || DEFAULT_FORMAT);
    }
    else if (typeof args[2] === 'string') {
      x_format = NumberFormatCache.Get(args[2]);
    }
    else {
      x_format = new NumberFormat('#,##0');
      if (scale.scale < 0){
        for (let i = 0; i >= scale.scale; i--) {
          x_format.IncreaseDecimal();
        }
      }
    }

    let x_labels: string[] | undefined;

    if (args[2] !== false) {
      x_labels = x_format ? label_values.map((value) => {
        const formatted = x_format.Format(value);
        return formatted;
      }) : [];
    }

    // this.data.data = bins;

    const min = Math.min.apply(0, bins);
    const max = Math.max.apply(0, bins);

    // FIXME: this should change based on height, maybe? (...)
    const bin_scale = Util.Scale(0, max, 8); // histogram force min = 0

    // always get a y-format, we use it for titles as well as the axis

    let y_format: NumberFormat;
    if (typeof args[3] === 'string') {
      y_format = NumberFormatCache.Get(args[3]);
    }
    else {
      y_format = new NumberFormat('#,##0');
      if (bin_scale.scale < 0){
        for (let i = 0; i >= bin_scale.scale; i--) {
          y_format.IncreaseDecimal();
        }
      }
    }

    let y_labels: string[] | undefined;

    if (args[3] !== false) {
      y_labels = [];
      for (let i = 0; i <= bin_scale.count; i++) {
        const y = bin_scale.min + i * bin_scale.step;
        y_labels.push(y_format.Format(y));
      }
    }

    const titles = bins.map((bin, index) =>
      x_format.Format(label_values[index]) + ' : ' + y_format.Format(bin));

    this.chart_data = {
      type: 'histogram',
      bins,
      titles,
      x_labels,
      y_labels,
      column_width: 0.8,
      scale: bin_scale,
      min,
      max,
      count: bins.length,
      title,
    };

    // this.chart_type = ChartType.histogram;

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
    this.renderer.Prerender();
    this.renderer.Clear();

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

    // FIXME: for now this is used for histogram only, but it's probably
    // applicable to some other types as well, so leave it here...

    if (this.chart_data.type === 'histogram'
        || this.chart_data.type === 'line'
        || this.chart_data.type === 'area'
        || this.chart_data.type === 'column'
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

        if (this.chart_data.y_labels) {
          // undo, temp
          area.bottom += (max_x_height + chart_margin.bottom);
        }

        // render
        this.renderer.RenderXAxis(area, (this.chart_data.type !== 'line' && this.chart_data.type !== 'bar' && this.chart_data.type !== 'scatter2'),
          this.chart_data.x_labels, x_metrics, ['axis-label', 'x-axis-label']);

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
          this.renderer.RenderScatterSeries(area, 
            series.x.data, 
            series.y.data, 
            this.chart_data.x_scale, 
            this.chart_data.y_scale, 
              !!this.chart_data.lines,
              !!this.chart_data.markers,
              !!this.chart_data.smooth,
              `scatter-plot series-${i + 1}`);
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
            this.chart_data.x_scale ? this.chart_data.x_scale.count : points, 
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
        // gridlines
        this.renderer.RenderBarGrid(area, this.chart_data.scale.count, 'chart-grid');
        if (this.chart_data.series2) {

          let count = 0;
          const series_count = this.chart_data.series2.length;

          for (const series of this.chart_data.series2) {
            count = Math.max(count, series.y.data.length);
          }

          const row_height = area.height / count;
          const row_pct = .7;
          const space = row_height * (1 - row_pct) / 2;
          const height = (row_height - space * 2) / series_count;

          let zero = 0;
          if (this.chart_data.scale.min < 0) { // && this.chart_data.scale.max >= 0) {
            zero = Util.ApplyScale(0, area.width, this.chart_data.scale);
          }

          for (let s = 0; s < series_count; s++) {
            const series = this.chart_data.series2[s];

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

                /*
                this.renderer.RenderRectangle(new Area(
                  negative ? x - 1 : x, 
                  y - 1, 
                  negative ? x + width : x + width + 1, 
                  y + height + 1,
                ), ['chart-column-shadow', `series-${s + 1}`], bar_title || undefined);
                  */

                this.renderer.RenderRectangle(new Area(
                  x, y, x + width, y + height,
                ), ['chart-column', `series-${s + 1}`], bar_title || undefined);

              }
            }
          }

        }

      }
      break;

    case 'column':
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
          const column_pct = .7;
          const space = column_width * (1 - column_pct) / 2;
          const width = (column_width - space * 2) / series_count;

          let zero = 0;
          if (this.chart_data.scale.min < 0) { // && this.chart_data.scale.max >= 0) {
            zero = Util.ApplyScale(0, area.height, this.chart_data.scale);
          }

          for (let s = 0; s < series_count; s++) {
            const series = this.chart_data.series2[s];

            for (let i = 0; i < series.y.data.length; i++ ){
              const value = series.y.data[i];
              if (typeof value === 'number') {

                const x = Math.round(area.left + i * column_width + space) + s * width;
                
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

                /*
                this.renderer.RenderRectangle(new Area(
                  x - 1, 
                  negative ? y : y - 1, 
                  x + width + 1, 
                  negative ? y + height + 1 : y + height,
                ), ['chart-column-shadow', `series-${s + 1}`], bar_title || undefined);
                  */

                this.renderer.RenderRectangle(new Area(
                  x, y, x + width, y + height,
                ), ['chart-column', `series-${s + 1}`], bar_title || undefined);

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

          /*
          this.renderer.RenderRectangle(new Area(
            x - .5, y - .5, x + width + .5, y + height,
          ), 'chart-column-shadow', bar_title || undefined);
          */

          this.renderer.RenderRectangle(new Area(
            x, y, x + width, y + height,
          ), 'chart-column series-1', bar_title || undefined);
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
