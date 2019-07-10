
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { ChartRenderer, Metrics } from './renderer';
import { Area } from './rectangle';
import { Util, RangeScale } from './util';
import { CellData, DataRange, AxisOptions } from './chart-types';

enum ChartType {
  undefined,
  histogram,
  scatter,
}

export class Chart {

  private data = {
    data: [] as number[],
    data2: [] as number[],
    labels: [] as string[],
    min: 0,
    max: 0,
    count: 0,
    scale: {
      scale: 1,
      step: 1,
      count: 1,
      min: 0,
      max: 1,
    },
    titles: [] as string[],
  };

  private y_labels?: string[];
  private x_labels?: string[];

  // ex options

  private title = '';

  private title_layout: 'top'|'bottom' = 'top';

  private column_width = 0.8;

  private margin = { top: 0.025, left: 0.025, bottom: 0.025, right: 0.05 };

  // /options

  private chart_type: ChartType = ChartType.histogram;

  constructor(
    public renderer: ChartRenderer = new ChartRenderer()) {
  }

  public Initialize(node: HTMLElement) {
    this.renderer.Initialize(node);
  }

  public Scale(value: number, range: number, scale: RangeScale) {
    return range * (value - scale.min) / (scale.max - scale.min);
  }

  public Exec(func: string, args: any[] = []) {

    switch (func.toLowerCase()) {
      case 'mc.histogram':
        this.CreateHistogram(args);
        break;

      case 'mc.correlation':
        this.CreateScatter(args);
        break;

      default:
        this.Clear();
        break;
    }

    return;
  }

  public Clear() {

    // make sure to clear enough that we don't render anything.

    this.y_labels = undefined;
    this.x_labels = undefined;

    this.data.data = [];
    this.data.count = 0;
    this.title = '';
  }

  public CreateScatter(args: any[]) { // data1: number[], data2: number[]) {

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

    this.title = args[2] || '';

    const A: CellData = args[0];
    const B: CellData = args[1];

    this.x_labels = undefined;
    this.y_labels = undefined;

    let data1 = (A.simulation_data || []).slice(0);
    let data2 = (B.simulation_data || []).slice(0);

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

    this.chart_type = ChartType.scatter;

  }

  /**
   * create histogram.
   *
   * args: cell data, title, format-x, format-y, bins
   */
  public CreateHistogram(args: any[]) { // data: number[]) {

    // validate args (actually we only care about the first one)

    if (!this.IsCellData(args[0])) {
      console.warn('invalid args');
      this.Clear();
      return;
    }

    const src: CellData = args[0];
    const data: number[] = src.simulation_data || [];

    this.title = args[1] || '';

    // 2 loops?
    const min = Math.min.apply(0, data);
    const max = Math.max.apply(0, data);

    let suggested_bins = 8;
    if (typeof args[4] === 'number' && args[4]) { suggested_bins = args[4]; }

    const scale = Util.Scale(min, max, suggested_bins);
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
      x_format = NumberFormatCache.Get(src.format || '#,##0.00');
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

    if (args[2] === false) {
      this.x_labels = undefined;
    }
    else {
      this.x_labels = x_format ? label_values.map((value) => {
        const formatted = x_format.Format(value);
        console.info(value, '=>', formatted);
        return formatted;
      }) : [];
    }

    this.data.data = bins;

    this.data.min = Math.min.apply(0, bins);
    this.data.max = Math.max.apply(0, bins);

    // FIXME: this should change based on height, maybe? (...)
    this.data.scale = Util.Scale(0, this.data.max, 8); // histogram force min = 0
    this.data.count = bins.length;

    // always get a y-format, we use it for titles as well as the axis

    let y_format: NumberFormat;
    if (typeof args[3] === 'string') {
      y_format = NumberFormatCache.Get(args[3]);
    }
    else {
      y_format = new NumberFormat('#,##0');
      if (this.data.scale.scale < 0){
        for (let i = 0; i >= this.data.scale.scale; i--) {
          y_format.IncreaseDecimal();
        }
      }
    }

    this.y_labels = undefined;
    if (args[3] !== false) {
      this.y_labels = [];
      for (let i = 0; i <= this.data.scale.count; i++) {
        const y = this.data.scale.min + i * this.data.scale.step;
        this.y_labels.push(y_format.Format(y));
      }
    }

    this.data.titles = this.data.data.map((bin, index) =>
      x_format.Format(label_values[index]) + ' : ' + y_format.Format(bin));

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
    const chart_margin = {
      top: Math.round(area.height) * this.margin.top,
      bottom: Math.round(area.height) * this.margin.bottom,
      left: Math.round(area.width) * this.margin.left,
      right: Math.round(area.width) * this.margin.right,
    };

    // title, top or bottom
    if (this.title) {

      const metrics = this.renderer.MeasureText(
        this.title, 'chart-title', true);

      const point = {x: area.width / 2, y: 0};

      switch (this.title_layout) {
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

      this.renderer.RenderText(this.title,'center', point, 'chart-title');

    }

    // pad
    area.top += chart_margin.top;
    area.left += chart_margin.left;
    area.bottom -= chart_margin.bottom;
    area.right -= chart_margin.right;

    // we need to measure first, then lay out the other axis, then we
    // can come back and render. it doesn't really matter which one you
    // do first.

    // measure x axis

    let x_metrics: Metrics[] = [];
    let max_x_height = 0;

    if (this.x_labels && this.x_labels.length) {
      x_metrics = this.x_labels.map((text) => {
        const metrics = this.renderer.MeasureText(text, ['axis-label', 'x-axis-label'], true);
        max_x_height = Math.max(max_x_height, metrics.height);
        return metrics;
      });
    }

    // measure & render y axis

    if (this.y_labels && this.y_labels.length) {

      const y_labels: Array<{label: string, metrics: Metrics}> = [];
      let max_width = 0;
      let max_height = 0;
      for (let i = 0; i <= this.data.scale.count; i++ ){
        const metrics = this.renderer.MeasureText(this.y_labels[i], ['axis-label', 'y-axis-label']);
        y_labels.push({ label: this.y_labels[i], metrics });
        max_width = Math.max(max_width, metrics.width);
        max_height = Math.max(max_height, metrics.height);
      }

      area.bottom = Math.round(area.bottom - max_height / 2);
      area.top = Math.round(area.top + max_height / 2);

      if (x_metrics.length) {
        area.bottom -= (max_x_height + chart_margin.bottom);
      }

      this.renderer.RenderYAxis(area, area.left + max_width, y_labels, ['axis-label', 'y-axis-label']);
      area.left += (max_width + chart_margin.left);

    }

    // now render x axis

    if (x_metrics.length && this.x_labels && this.x_labels.length) {

      if (this.y_labels) {
        // undo, temp
        area.bottom += (max_x_height + chart_margin.bottom);
      }

      // render
      this.renderer.RenderXAxis(area, this.x_labels, x_metrics, ['axis-label', 'x-axis-label']);

      // update bottom (either we unwound for labels, or we need to do it the first time)
      area.bottom -= (max_x_height + chart_margin.bottom);

    }

    // --- 8< --- here's where we need to split for different chart types... --- >8 ---

    if (this.chart_type === ChartType.scatter ) {
      if (this.data.data.length && this.data.data2 && this.data.data2.length ) {
        this.renderer.RenderPoints(area, this.data.data, this.data.data2, 'points');
      }
    }
    else if (this.chart_type === ChartType.histogram) {

      // gridlines
      this.renderer.RenderGrid(area, this.data.scale.count, 'chart-grid');

      // columns
      const column_width = area.width / this.data.count;
      // const column_pct = (typeof this.options.column_width === 'number') ?
      //  this.options.column_width : 0.8;
      const column_pct = this.column_width;

      const space = column_width * (1 - column_pct) / 2;

      for (let i = 0; i < this.data.count; i++ ){
        const x = Math.round(area.left + i * column_width + space);
        const width = column_width - space * 2;
        const height = this.Scale(this.data.data[i], area.height, this.data.scale);
        const y = area.bottom - height;
        this.renderer.RenderRectangle(new Area(
          x, y, x + width, y + height,
        ), 'chart-column', this.data.titles[i] || undefined); // this.data.data[i].toString());
      }

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
