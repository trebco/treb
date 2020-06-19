
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { ChartRenderer, Metrics } from './renderer';
import { Area } from './rectangle';
import { Util } from './util';
import { CellData, ChartData, DonutSlice, NumberOrUndefinedArray } from './chart-types';
import { ChartFunctions } from './chart-functions';

import { RangeScale } from 'treb-utils';

require('../style/charts.scss');

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

      default:
        this.Clear();
        break;
    }

  }

  public Clear() {
    this.chart_data = { type: 'null' };
  }

  /**
   * @param args arguments: data, labels, title
   * @param type 
   */
  public CreateColumnChart(args: any[], type: 'bar'|'column') {

    const title = args[2] || '';
    const raw_data = args[0];

    // we're now expecting this to be metadata (including value).
    // so we need to unpack. could be an array... could be deep...
    const flat = Util.Flatten(raw_data);

    // we still need the aggregate for range, scale
    const data = flat.map((x) => (typeof x.value === 'number') ? x.value : undefined) as number[];

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

    const range = Util.Range(data);

    // FIXME: optionally force 0 min [or max]
    if (range.min) {
      range.min = Math.min(0, range.min);
    }
    if (range.max) {
      range.max = Math.max(0, range.max);
    }

    const scale = Util.Scale(range.min || 0, range.max || 0, 7);
    const format_pattern = (flat.length && flat[0].format) ? flat[0].format : '';
    const y_format = NumberFormatCache.Get(format_pattern || DEFAULT_FORMAT);
    const y_labels: string[] = [];

    for (let i = 0; i <= scale.count; i++) {
      y_labels.push(y_format.Format(scale.min + i * scale.step));
    }

    let x_labels: string[] | undefined;

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

    // const smooth = (args[6] === 'smooth');

    this.chart_data = {
      type,
      data,
      series,
      scale,
      title,
      y_labels: type === 'bar' ? x_labels : y_labels, // swapped
      x_labels: type === 'bar' ? y_labels : x_labels, // swapped
    };

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

    if (Array.isArray(raw_data) && (raw_data as any)._type === 'series') {
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
      data,
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

    const labels = Util.Flatten(args[1]).map((x) => x ? x.toString() : '');

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

      const metrics = this.renderer.MeasureText(
        title, 'chart-title', true);

      const point = {x: area.width / 2, y: 0};

      switch (this.chart_data.title_layout) {
        case 'bottom':
          area.bottom -= chart_margin.bottom;
          point.y = area.bottom - metrics.y_offset * 2;
          area.bottom -= (metrics.height + metrics.y_offset);
          break;

        default:
          area.top += chart_margin.top;
          point.y = Math.round(area.top + metrics.height - (metrics.y_offset / 2)); // + metrics.y_offset;
          area.top += (metrics.height + metrics.y_offset);
          break;
      }

      this.renderer.RenderText(title, 'center', point, 'chart-title');

    }

    // pad
    area.top += chart_margin.top;
    area.left += chart_margin.left;
    area.bottom -= chart_margin.bottom;
    area.right -= chart_margin.right;

    // FIXME: for now this is used for histogram only, but it's probably
    // applicable to some other types as well, so leave it here...

    if (this.chart_data.type === 'histogram'
        || this.chart_data.type === 'line'
        || this.chart_data.type === 'area'
        || this.chart_data.type === 'column'
        || this.chart_data.type === 'bar'
        ) {

      // we need to measure first, then lay out the other axis, then we
      // can come back and render. it doesn't really matter which one you
      // do first.

      // measure x axis

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

        const count = (this.chart_data.type === 'bar') ? 
          this.chart_data.y_labels.length :
          this.chart_data.scale.count + 1;

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
        this.renderer.RenderXAxis(area, (this.chart_data.type !== 'line' && this.chart_data.type !== 'bar'),
          this.chart_data.x_labels, x_metrics, ['axis-label', 'x-axis-label']);

        // update bottom (either we unwound for labels, or we need to do it the first time)
        area.bottom -= (max_x_height + chart_margin.bottom);

      }

    }

    // now do type-specific rendering

    switch (this.chart_data.type) {
    case 'scatter':
      this.renderer.RenderPoints(area, this.chart_data.x, this.chart_data.y, 'points');
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
        if (this.chart_data.series) {

          let count = 0;
          const series_count = this.chart_data.series.length;

          for (const series of this.chart_data.series) {
            count = Math.max(count, series.length);
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
            const series = this.chart_data.series[s];

            for (let i = 0; i < series.length; i++ ){
              const value = series[i];
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

                this.renderer.RenderRectangle(new Area(
                  negative ? x - 1 : x, 
                  y - 1, 
                  negative ? x + width : x + width + 1, 
                  y + height + 1,
                ), ['chart-column-shadow', `series-${s + 1}`], bar_title || undefined);
      
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

        if (this.chart_data.series) {

          let count = 0;
          const series_count = this.chart_data.series.length;

          for (const series of this.chart_data.series) {
            count = Math.max(count, series.length);
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
            const series = this.chart_data.series[s];

            for (let i = 0; i < series.length; i++ ){
              const value = series[i];
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

                this.renderer.RenderRectangle(new Area(
                  x - 1, 
                  negative ? y : y - 1, 
                  x + width + 1, 
                  negative ? y + height + 1 : y + height,
                ), ['chart-column-shadow', `series-${s + 1}`], bar_title || undefined);
      
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

          this.renderer.RenderRectangle(new Area(
            x - 1, y - 1, x + width + 1, y + height,
          ), 'chart-column-shadow', bar_title || undefined);

          this.renderer.RenderRectangle(new Area(
            x, y, x + width, y + height,
          ), 'chart-column', bar_title || undefined);
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
