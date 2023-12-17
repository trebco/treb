
import type { ChartRenderer } from './renderer-type';
import type { ChartData } from './chart-types';
import type { ExtendedUnion, UnionValue } from 'treb-base-types';
import * as ChartUtils from './chart-utils';
import { DefaultChartRenderer } from './default-chart-renderer';

/**
 * transitioning to new structure, this should mirror the old chart 
 * interface (at least the public interface)
 */
export class Chart {

  /** flag indicating we've registered at least once */
  public static functions_registered = false;

  // always exists; default null type, no title

  protected chart_data: ChartData = {type: 'null'};

  protected node?: HTMLElement;

  constructor(
    public renderer: ChartRenderer = new DefaultChartRenderer()) {
  }

  public Initialize(node: HTMLElement) {
    this.node = node;
    this.renderer.Initialize(node);
  }

  public Exec(func: string, union: ExtendedUnion) {

    const args: any[] = union?.value || [];
    
    switch (func.toLowerCase()) {

      case 'column.chart':
        this.chart_data = ChartUtils.CreateColumnChart(args as [UnionValue?, UnionValue?, string?, string?], 'column');
        break;

      case 'bar.chart':
        this.chart_data = ChartUtils.CreateColumnChart(args as [UnionValue?, UnionValue?, string?, string?], 'bar');
        break;
              
      case 'line.chart':
        this.chart_data = ChartUtils.CreateLineChart(args, 'line');
        break;

      case 'area.chart':
        this.chart_data = ChartUtils.CreateLineChart(args, 'area');
        break;

      case 'donut.chart':
      case 'pie.chart':
        this.chart_data = ChartUtils.CreateDonut(args as [UnionValue?, UnionValue?, string?, string?, string?], func.toLowerCase() === 'pie.chart');
        break;

      case 'scatter.plot':
        this.chart_data = ChartUtils.CreateScatterChart(args, 'plot');
        break;

      case 'scatter.line':
        this.chart_data = ChartUtils.CreateScatterChart(args, 'line');
        break;
  
      default:
        this.Clear();
        break;
    }

  }

  public Clear() {
    this.chart_data = { type: 'null' };
  }

  /** pass through */
  public Resize() {
    if (this.node) {
      this.renderer.Resize(this.node, this.chart_data);
    }
  }

  /** pass through */
  public Update() {
    if (this.node) {
      this.renderer.Update(this.node, this.chart_data);
    }
  }

}