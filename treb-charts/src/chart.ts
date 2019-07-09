
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { ChartRenderer, Metrics } from './renderer';
import { Area } from './rectangle';
import { Util, RangeScale } from './util';
import { DataRange, LayoutOptions } from './chart-types';

enum ChartType {
  undefined,
  histogram,
  scatter,
}

export class Chart {

  private data: DataRange = {
    data: [],
    labels: [],
    min: 0,
    max: 0,
    count: 0,
    scale: {
      scale: 1,
      step: 1,
      count: 1,
      min: 0,
      max: 1,
    }
  };

  private chart_type: ChartType = ChartType.histogram;

  constructor(
    public options: LayoutOptions = {},
    public renderer: ChartRenderer = new ChartRenderer()) {
    // ...
  }
  
  public Initialize(node: HTMLElement) {
    this.renderer.Initialize(node);
  }

  public Scale(value: number, range: number, scale: RangeScale) {
    return range * (value - scale.min) / (scale.max - scale.min);
  }

  public Clear() {
    this.data.data = [];
    this.data.labels = [];
    this.data.count = 0;
  }

  public CreateScatter(data1: number[], data2: number[]) {
    this.chart_type = ChartType.scatter;

    data1 = data1.slice(0); // , 500);
    data2 = data2.slice(0); // , 500);

    const min1 = Math.min.apply(0, data1);
    const max1 = Math.max.apply(0, data1);
    const range1 = max1 - min1;
    data1 = data1.map((value) => (value - min1) / range1);

    const min2 = Math.min.apply(0, data2);
    const max2 = Math.max.apply(0, data2);
    const range2 = max2 - min2;
    data2 = data2.map((value) => (value - min2) / range2);

    const length = Math.min(data1.length, data2.length);
    this.data.count = length;

    this.data.data = data1; // .slice(0);
    this.data.data2 = data2; // .slice(0);

  }

  /**
   * create histogram. pass in the raw data.
   */
  public CreateHistogram(data: number[]) {

    // 2 loops?
    const min = Math.min.apply(0, data);
    const max = Math.max.apply(0, data);

    const suggested_bars = (typeof this.options.histogram_bins === 'number') ?
      this.options.histogram_bins : 8;

    const scale = Util.Scale(min, max, suggested_bars);

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

    let format: NumberFormat;

    if (this.options.axes && this.options.axes.x && this.options.axes.x.format) {
      format = NumberFormatCache.Get(this.options.axes.x.format);
    }
    else {
      format = new NumberFormat('#,##0');
      if (scale.scale < 0){
        for (let i = 0; i >= scale.scale; i--) {
          format.IncreaseDecimal();
        }
      }
    }

    this.data.labels = format ? label_values.map((value) => format.Format(value)) : [];
    this.data.data = bins;

    this.data.min = Math.min.apply(0, bins);
    this.data.max = Math.max.apply(0, bins);
    this.data.scale = Util.Scale(0, this.data.max, 8); // histogram force min = 0
    this.data.count = bins.length;

    this.chart_type = ChartType.histogram;

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
    const margin_percent = (typeof this.options.margin === 'number') ? this.options.margin : 0.02;
    const chart_margin = Math.round(Math.max(area.width, area.height) * margin_percent);

    // title, top or bottom
    if (this.options.title) {

      const metrics = this.renderer.MeasureText(
        this.options.title, 'chart-title', true);

      const point = {x: area.width / 2, y: 0};

      switch (this.options.title_layout) {
        case 'bottom':
          area.bottom -= chart_margin;
          point.y = area.bottom - metrics.y_offset * 2;
          area.bottom -= (metrics.height + metrics.y_offset);
          break;

        default:
          area.top += chart_margin;
          point.y = Math.round(area.top + metrics.height - (metrics.y_offset / 2)); // + metrics.y_offset;
          area.top += (metrics.height + metrics.y_offset);
          break;
      }

      this.renderer.RenderText(this.options.title,'center', point, 'chart-title');

    }

    // pad
    area.top += chart_margin;
    area.left += chart_margin;
    area.bottom -= chart_margin;
    area.right -= chart_margin;

    // we need to measure first, then lay out the other axis, then we
    // can come back and render. it doesn't really matter which one you
    // do first.

    let x_metrics: Metrics[] = [];
    let max_x_height = 0;

    if (this.data.labels && this.options.axes && this.options.axes.x && this.options.axes.x.labels) {
      x_metrics = this.data.labels.map((text) => {
        const metrics = this.renderer.MeasureText(text, ['axis-label', 'x-axis-label'], true);
        max_x_height = Math.max(max_x_height, metrics.height);
        return metrics;
      });
    }

    // y axis: create labels

    let y_axis_format: NumberFormat;
    if (this.options.axes && this.options.axes.y && this.options.axes.y.labels) {
      if (this.options.axes && this.options.axes.y && this.options.axes.y.format) {
        y_axis_format = NumberFormatCache.Get(this.options.axes.y.format);
      }
      else {
        y_axis_format = new NumberFormat('#,##0');
        if (this.data.scale.scale < 0){
          for (let i = 0; i >= this.data.scale.scale; i--) {
            y_axis_format.IncreaseDecimal();
          }
        }
      }

      const y_labels: Array<{label: string, metrics: Metrics}> = [];
      let max_width = 0;
      let max_height = 0;
      for (let i = 0; i <= this.data.scale.count; i++ ){
        const y = this.data.scale.min + i * this.data.scale.step;
        const label = y_axis_format.Format(y);
        const metrics = this.renderer.MeasureText(label, ['axis-label', 'y-axis-label']);
        y_labels.push({ label, metrics });
        max_width = Math.max(max_width, metrics.width);
        max_height = Math.max(max_height, metrics.height);
      }

      area.bottom = Math.round(area.bottom - max_height / 2);
      area.top = Math.round(area.top + max_height / 2);

      if (x_metrics.length) {
        area.bottom -= (max_x_height + chart_margin);
      }

      this.renderer.RenderYAxis(area, area.left + max_width, y_labels, ['axis-label', 'y-axis-label']);
      area.left += (max_width + chart_margin);

    }

    // now render x axis labels

    if (x_metrics.length && this.data.labels) {

      if (this.options.axes && this.options.axes.x && this.options.axes.x.ticks) {
        this.renderer.RenderTicks(area, area.bottom, area.bottom + chart_margin, this.data.count, ['chart-ticks'])
      }

      if (this.options.axes && this.options.axes.y && this.options.axes.y.labels) {
        // undo, temp
        area.bottom += (max_x_height + chart_margin);
      }

      // render
      this.renderer.RenderXAxis(area, this.data.labels, x_metrics, ['axis-label', 'x-axis-label']);

      // update bottom (either we unwound for labels, or we need to do it the first time)
      area.bottom -= (max_x_height + chart_margin);

    }

    // --- 8< --- here's where we need to split for different chart types... --- >8 ---

    if (this.chart_type === ChartType.scatter ) {

      if (this.data.data.length && this.data.data2 && this.data.data2.length ) {

        this.renderer.RenderPoints(area, this.data.data, this.data.data2, 'points');

        /*
        for (let i = 0; i < this.data.count; i++ ){
          const a = this.data.data[i];
          const b = this.data.data2[i];

          if (typeof a === 'number' && typeof b === 'number') {
            const x = a * area.width + area.left;
            const y = b * area.height + area.top;
            this.renderer.RenderPoint(x, y, 'dot');
          }

        }
        */

      }

    }
    else if (this.chart_type === ChartType.histogram) {

      // gridlines
      this.renderer.RenderGrid(area, this.data.scale.count, 'chart-grid');

      // columns
      const column_width = area.width / this.data.count;
      const column_pct = (typeof this.options.column_width === 'number') ?
        this.options.column_width : 0.8;

      const space = column_width * (1 - column_pct) / 2;

      for (let i = 0; i < this.data.count; i++ ){
        const x = Math.round(area.left + i * column_width + space);
        const width = column_width - space * 2;
        const height = this.Scale(this.data.data[i], area.height, this.data.scale);
        const y = area.bottom - height;
        this.renderer.RenderRectangle(new Area(
          x, y, x + width, y + height,
        ), 'chart-column', this.data.data[i].toString());
      }

    }

  }


}
