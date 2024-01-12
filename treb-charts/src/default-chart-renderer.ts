
import type { ChartRenderer as ChartRendererType } from './renderer-type';

import type { Metrics } from './renderer';
import { ChartRenderer } from './renderer';
import { Area } from './rectangle';
import { Util } from './util';
import type { ChartData } from './chart-types';
import { LegendLayout, LegendPosition } from './chart-types';

/**
 * this class contains the original chart rendering functions, mapped
 * to the new interface.
 */
export class DefaultChartRenderer implements ChartRendererType {

  private renderer = new ChartRenderer();

  // not chart-specific, so leave outside (FIXME: layout options?)

  // FIXME: change depending on whether there are y-axis labels
  // FIXME: different for donut charts...

  private margin = { top: 0.025, left: 0.05, bottom: 0.025, right: 0.075 };

  public Resize(target: HTMLElement, data: ChartData) {
    this.renderer.Resize();
  }

  public Initialize(target: HTMLElement) {
    this.renderer.Initialize(target);
  }
  
  /**
   * redraw
   */
  public Update(target: HTMLElement, chart_data: ChartData) {

    // reset
    this.renderer.Resize(); // just too many problems
    this.renderer.Prerender();
    this.renderer.Clear(chart_data.class_name);

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
    const title = chart_data.title;

    if (title) {
      this.renderer.RenderTitle(title, area, chart_margin.top, 
        chart_data.title_layout||'top');
    }

    // pad
    area.top += chart_margin.top;
    area.left += chart_margin.left;
    area.bottom -= chart_margin.bottom;
    area.right -= chart_margin.right;

    if (chart_data.legend && chart_data.legend.length) {

      let default_position = LegendPosition.top;
      if (chart_data.title) {
        if (!chart_data.title_layout || chart_data.title_layout === 'top') {
          default_position = LegendPosition.bottom;
        }
      }

      const position = chart_data.legend_position || default_position;

      this.renderer.Legend({
        labels: chart_data.legend,
        position,
        style: chart_data.legend_style,
        layout: (position === LegendPosition.top || position === LegendPosition.bottom) ? 
          LegendLayout.horizontal : LegendLayout.vertical,
        area,
      });

    }

    if (chart_data.type === 'histogram'
        || chart_data.type === 'line'
        || chart_data.type === 'area'
        || chart_data.type === 'column'
        || chart_data.type === 'histogram2'
        || chart_data.type === 'bar'
        || chart_data.type === 'scatter2'
        || chart_data.type === 'bubble'
        ) {

      // we need to measure first, then lay out the other axis, then we
      // can come back and render. it doesn't really matter which one you
      // do first.

      // measure x axis (height)

      let x_metrics: Metrics[] = [];
      let max_x_height = 0;

      if (chart_data.x_labels && chart_data.x_labels.length) {
        x_metrics = chart_data.x_labels.map((text) => {
          const metrics = this.renderer.MeasureText(text, ['axis-label', 'x-axis-label'], true);
          max_x_height = Math.max(max_x_height, metrics.height);
          return metrics;
        });
      }

      // measure & render y axis

      if (chart_data.y_labels && chart_data.y_labels.length) {

        const y_labels: Array<{label: string; metrics: Metrics}> = [];
        let max_width = 0;
        let max_height = 0;

        const scale = (chart_data.type === 'scatter2' || chart_data.type === 'bubble') ? chart_data.y_scale : chart_data.scale;
        
        const count = (chart_data.type === 'bar') ? 
          chart_data.y_labels.length :
          /* chart_data. */ 
          scale.count + 1;

        for (let i = 0; i < count; i++ ){
          const metrics = this.renderer.MeasureText(chart_data.y_labels[i], ['axis-label', 'y-axis-label']);
          y_labels.push({ label: chart_data.y_labels[i], metrics });
          max_width = Math.max(max_width, metrics.width);
          max_height = Math.max(max_height, metrics.height);
        }

        area.bottom = Math.round(area.bottom - max_height / 2);
        area.top = Math.round(area.top + max_height / 2);

        if (x_metrics.length) {
          area.bottom -= (max_x_height + chart_margin.bottom);
        }

        if (chart_data.type === 'bar') {
          this.renderer.RenderYAxisBar(area, area.left + max_width, y_labels, ['axis-label', 'y-axis-label']);
        }
        else {
          this.renderer.RenderYAxis(area, area.left + max_width, y_labels, ['axis-label', 'y-axis-label']);
        }
        area.left += (max_width + chart_margin.left);

      }

      // now render x axis

      if (x_metrics.length && chart_data.x_labels && chart_data.x_labels.length) {

        const tick = (chart_data.type === 'histogram2');
        const offset_tick = (
          chart_data.type !== 'line' && 
          chart_data.type !== 'area' && 
          chart_data.type !== 'bar' && 
          chart_data.type !== 'scatter2' && 
          chart_data.type !== 'bubble' && 
          chart_data.type !== 'histogram2' 
          );

        // do this before you fix the offset

        if (tick) {
          this.renderer.RenderXAxisTicks(area, offset_tick, chart_data.x_labels.length);
        }


        if (chart_data.y_labels) {
          // undo, temp
          area.bottom += (max_x_height + chart_margin.bottom);
        }

        // render
        this.renderer.RenderXAxis(area, 
          offset_tick,
          chart_data.x_labels, 
          x_metrics, 
          ['axis-label', 'x-axis-label']);

        // update bottom (either we unwound for labels, or we need to do it the first time)
        area.bottom -= (max_x_height + chart_margin.bottom);

      }

    }

    // now do type-specific rendering

    switch (chart_data.type) {
    case 'scatter':
      this.renderer.RenderPoints(area, chart_data.x, chart_data.y, 'mc mc-correlation series-1');
      break;

    case 'bubble':

      this.renderer.RenderGrid(area, 
        chart_data.y_scale.count, 
        chart_data.x_scale.count + 1, // (sigh)
        'chart-grid');

      for (const [index, series] of chart_data.series.entries()) {
        const series_index = (typeof series.index === 'number') ? series.index : index;
        this.renderer.RenderBubbleSeries(area, series, chart_data.x_scale, chart_data.y_scale, `bubble-chart series-${series_index + 1}`);
      }

      break;

    case 'scatter2':

      this.renderer.RenderGrid(area, 
        chart_data.y_scale.count, 
        chart_data.x_scale.count + 1, // (sigh)
        'chart-grid');

      if (chart_data.series) {
        for (let i = 0; i < chart_data.series.length; i++) {
          const series = chart_data.series[i];

          let lines = !!chart_data.lines;
          let points = !!chart_data.points;

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
            chart_data.x_scale, 
            chart_data.y_scale, 
              lines,
              points,
              !!chart_data.filled,
              !!chart_data.markers,
              !!chart_data.smooth,
              `scatter-plot series-${index}`);
        }
        if (chart_data.data_labels) {
          for (let i = 0; i < chart_data.series.length; i++) {
            const series = chart_data.series[i];
            if (series.y.labels) {
              this.renderer.RenderDataLabels(
                  area, 
                  series.x.data, 
                  series.y.data, 
                  chart_data.x_scale, 
                  chart_data.y_scale, 
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
        const inner = chart_data.type === 'pie' ? 0 : outer * .8;
        this.renderer.RenderDonut(chart_data.slices, area.center, outer, inner, area,
          true, 'donut');
      }
      break;

    case 'line':
    case 'area':
      {
        const scale = chart_data.scale;
        if (chart_data.series) {

          const points = chart_data.x_scale ? 
            chart_data.x_scale.max :
            Math.max.apply(0, chart_data.series.map(x => x.length));

          const func = chart_data.smooth ?
            this.renderer.RenderSmoothLine : this.renderer.RenderLine;

          // gridlines
          this.renderer.RenderGrid(area, 
            chart_data.scale.count, 
            chart_data.x_scale ? chart_data.x_scale.count + 1 : points, 
            'chart-grid');

          // series
          let series_index = 0;
          for (const series of chart_data.series) {

            

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
              chart_data.type === 'area' ? 'chart-area' : 'chart-line',
              `series-${series_index + 1}`]

            func.call(this.renderer, area, y, (chart_data.type === 'area'), chart_data.titles, styles);
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
        this.renderer.RenderBarGrid(area, chart_data.scale.count, 'chart-grid');
        if (chart_data.series2) {

          let count = 0;
          const series_count = chart_data.series2.length;

          for (const series of chart_data.series2) {
            count = Math.max(count, series.y.data.length);
          }

          const row_height = area.height / count;
          let row_pct = .7;
          if (typeof chart_data.space === 'number') {
            row_pct = Math.max(0, Math.min(1, 1 - (chart_data.space)));
          }

          const space = row_height * (1 - row_pct) / 2;
          const height = (row_height - space * 2) / series_count;

          let zero = 0;
          if (chart_data.scale.min < 0) { // && chart_data.scale.max >= 0) {
            zero = Util.ApplyScale(0, area.width, chart_data.scale);
          }

          if (chart_data.round) {
            const half_height = Math.floor(height / 2);
            corners = [0, half_height, half_height, 0];
          }

          for (let s = 0; s < series_count; s++) {
            const series = chart_data.series2[s];
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
                    width = Util.ApplyScale(value + chart_data.scale.min, area.width, chart_data.scale);
                    x = area.left + zero;
                  }
                  else {
                    width = Util.ApplyScale(chart_data.scale.min - value, area.width, chart_data.scale);
                    x = area.left + zero - width;
                    negative = true;
                  }
                }
                else {
                  width = Util.ApplyScale(value, area.width, chart_data.scale);
                  x = area.left;
                }

                // const bar_title = chart_data.titles ? chart_data.titles[i] : undefined;
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
        this.renderer.RenderGrid(area, chart_data.scale.count, 0, 'chart-grid');

        if (chart_data.series2) {

          let count = 0;
          const series_count = chart_data.series2.length;

          for (const series of chart_data.series2) {
            count = Math.max(count, series.y.data.length);
          }

          // columns
          const column_width = area.width / count;
          let column_pct = .7;
          if (typeof chart_data.space === 'number') {
            column_pct = Math.max(0, Math.min(1, 1 - (chart_data.space)));
          }

          const space = column_width * (1 - column_pct) / 2;
          const width = (column_width - space * 2) / series_count;

          let zero = 0;
          if (chart_data.scale.min < 0) { // && chart_data.scale.max >= 0) {
            zero = Util.ApplyScale(0, area.height, chart_data.scale);
          }

          if (chart_data.callouts && chart_data.x_scale) {
            const scale = chart_data.x_scale;
            const lines = chart_data.callouts.map((callout, index) => {
              const x = Math.round(area.left + Util.ApplyScale(callout.value, area.width, scale)) + .5;
              return {
                x1: x, y1: area.bottom - area.height, x2: x, y2: area.bottom,
                classes: `callout-${index + 1}`,
              }
            });
            this.renderer.RenderCalloutLines(lines);
          }

          let corners: number[]|undefined;

          if (chart_data.round) {
            const half_width = Math.floor(width/2);
            corners = [half_width, half_width, 0, 0];
          }

          for (let s = 0; s < series_count; s++) {
            const series = chart_data.series2[s];
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
                    height = Util.ApplyScale(value + chart_data.scale.min, area.height, chart_data.scale);
                    y = area.bottom - height - zero;
                  }
                  else {
                    height = Util.ApplyScale(chart_data.scale.min - value, area.height, chart_data.scale);
                    y = area.bottom - zero; // // area.bottom - height - zero;
                    negative = true;
                  }
                }
                else {
                  height = Util.ApplyScale(value, area.height, chart_data.scale);
                  y = area.bottom - height;
                }

                // const bar_title = chart_data.titles ? chart_data.titles[i] : undefined;
                const bar_title = undefined;

                if (height) {

                  const label = (chart_data.data_labels && !!series.y.labels) ? series.y.labels[i] : '';
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
        this.renderer.RenderGrid(area, chart_data.scale.count, 0, 'chart-grid');

        // columns
        const column_width = area.width / chart_data.count;
        const column_pct = chart_data.column_width;

        const space = column_width * (1 - column_pct) / 2;

        for (let i = 0; i < chart_data.count; i++ ){
          const x = Math.round(area.left + i * column_width + space);
          const width = column_width - space * 2;
          const height = Util.ApplyScale(chart_data.bins[i], area.height, chart_data.scale);
          const y = area.bottom - height;
          const bar_title = chart_data.titles ? chart_data.titles[i] : undefined;

          this.renderer.RenderRectangle(new Area(
            x, y, x + width, y + height,
          ), undefined, 'chart-column series-1', bar_title || undefined);
        }

      }
      break;
    }

  }


}