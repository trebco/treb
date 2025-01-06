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


import type { ChartRenderer } from './renderer-type';
import type { ChartData } from './chart-types';
import type { ExtendedUnion, UnionValue } from 'treb-base-types';
import * as ChartUtils from './chart-utils';
import { DefaultChartRenderer } from './default-chart-renderer';
import type { ChartFunction } from './chart-functions';

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

  public Exec(func: ChartFunction, union: ExtendedUnion) {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args: any[] = (union?.value as any[]) || [];
    
    switch (func.toLowerCase()) {

      case 'column.chart':
        this.chart_data = ChartUtils.CreateColumnChart(args as [UnionValue?, UnionValue?, string?, string?], 'column');
        break;

      case 'bar.chart':
        this.chart_data = ChartUtils.CreateColumnChart(args as [UnionValue?, UnionValue?, string?, string?], 'bar');
        break;
              
      case 'line.chart':
        this.chart_data = ChartUtils.CreateLineChart(args as Parameters<typeof ChartUtils.CreateLineChart>[0], 'line');
        break;

      case 'area.chart':
        this.chart_data = ChartUtils.CreateLineChart(args as Parameters<typeof ChartUtils.CreateLineChart>[0], 'area');
        break;

      case 'donut.chart':
      case 'pie.chart':
        this.chart_data = ChartUtils.CreateDonut(args as [UnionValue?, UnionValue?, string?, string?, string?], func.toLowerCase() === 'pie.chart');
        break;

      case 'scatter.plot':
        this.chart_data = ChartUtils.CreateScatterChart(args as Parameters<typeof ChartUtils.CreateScatterChart>[0], 'plot');
        break;

      case 'scatter.line':
        this.chart_data = ChartUtils.CreateScatterChart(args as Parameters<typeof ChartUtils.CreateScatterChart>[0], 'line');
        break;
  
      case 'bubble.chart':
        this.chart_data = ChartUtils.CreateBubbleChart(args);
        break;

      case 'box.plot':
        this.chart_data = ChartUtils.CreateBoxPlot(args);
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