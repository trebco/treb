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

import type { UnitAddress, UnitRange, UnitLiteral, ExpressionUnit } from 'treb-parser';

import { static_title, ref_title, chart_template } from './chart-template-components2';
import { column_json, column_series } from './column-chart-template2';
import { donut_json } from './donut-chart-template2';
import { scatter_json, scatter_series } from './scatter-chart-template2';
import { bubble_json, bubble_series } from './bubble-chart-template';

import { Localization } from 'treb-base-types';
import type { RelationshipMap } from '../relationship';

export interface ChartOptions {
  type: 'donut'|'column'|'bar'|'scatter'|'scatter2' | 'bubble';
  title?: UnitLiteral | UnitAddress;
  data: UnitRange[];
  labels?: UnitRange;
  labels2?: UnitRange[];
  labels3?: UnitRange[];
  names?: ExpressionUnit[];
  smooth?: boolean;
}

export class Chart {

  public static next_chart_index = 1;

  public relationships: RelationshipMap = {};

  constructor (public options: ChartOptions, public index = Chart.next_chart_index++) {

  }


  /** set chart title, either static or reference to cell */
  public UpdateChartTitle(chartnode: any) {

    const unit = this.options.title || {
      type: 'literal', value: '',
    };

    if (unit && unit.type === 'literal') {
      const title = JSON.parse(JSON.stringify(static_title));
      const AP = title['c:tx']['c:rich']['a:p'];

      AP['a:r'] = {
        'a:rPr': {
          a$: {
            lang: Localization.locale,
          },
        },
        'a:t': unit.value,
      };
      chartnode['c:title'] = title;
    }
    else if (unit) {
      const title = JSON.parse(JSON.stringify(ref_title));
      //const CF = title['c:tx']['c:strRef']['c:f'];
      //CF.t$ = unit.label;
      title['c:tx']['c:strRef']['c:f'] = unit.label;
      chartnode['c:title'] = title;
    }

  }

  public toJSON() {

    switch (this.options.type) {
      case 'column':
      case 'bar':
        return this.CreateBarChart();

      case 'scatter':
      case 'scatter2':
        return this.CreateScatterChart();

      case 'bubble':
        return this.CreateBubbleChart();
        
      case 'donut':
        return this.CreateDonutChart();

      default:
        console.info('unhandled chart type', this.options.type);
    }
    
    return this.CreateBarChart();

  }

  public CreateBubbleChart() {

    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = template['c:chartSpace'];
    const bubble = JSON.parse(JSON.stringify(bubble_json)); 

    chartspace['c:chart'] = bubble;

    this.UpdateChartTitle(chartspace['c:chart']);

    const cser = chartspace['c:chart']['c:plotArea']['c:bubbleChart']['c:ser']; // this.FindNode('c:ser', template);

    let legend = false;

    for (let i = 0; i < this.options.data.length; i++) {

      const series = JSON.parse(JSON.stringify(bubble_series));

      series['c:idx'] = { a$: { val: i.toString() }};
      series['c:order'] = { a$: { val: i.toString() }};

      if (this.options.names && this.options.names[i]) {

        const name = this.options.names[i];
        switch (name.type) {
          case 'literal':
            series['c:tx'] = {
              'c:v': name.value.toString(),
            };
            legend = true;
            break;

          case 'range':
          case 'address':
            series['c:tx'] = {
              'c:strRef': {
                'c:f': name.label,
              }
            };
            legend = true;
            break;
        }
      }

      // "accent7" will break 

      if (i < 6) {
        series['c:spPr']['a:solidFill']['a:schemeClr'].a$['val'] = `accent${i+1}`;
      }

      series['c:yVal']['c:numRef']['c:f'] = this.options.data[i]?.label;

      if (this.options.labels2 && this.options.labels2[i]) {
        series['c:xVal']['c:numRef']['c:f'] = this.options.labels2[i]?.label;
      }

      if (this.options.labels3 && this.options.labels3[i]) {
        series['c:bubbleSize']['c:numRef']['c:f'] = this.options.labels3[i]?.label;
      }

      // console.info("SER", JSON.stringify(series, undefined, 2));

      cser.push(series);

    }

    if (legend) {
      chartspace['c:chart']['c:legend'] = {
        'c:legendPos': { a$: {val: 'b'}, },
        'c:overlay': { a$: {val: '0'}, },
      };
    }

    return template;

  }


  public CreateScatterChart() {
    
    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = template['c:chartSpace'];
    const scatter = JSON.parse(JSON.stringify(scatter_json)); 

    if (this.options.smooth) {
      scatter['c:plotArea']['c:scatterChart']['c:scatterStyle'].a$.val = 'smoothMarker';
    }

    chartspace['c:chart'] = scatter;

    this.UpdateChartTitle(chartspace['c:chart']);

    const cser = chartspace['c:chart']['c:plotArea']['c:scatterChart']['c:ser']; // this.FindNode('c:ser', template);

    let legend = false;

    for (let i = 0; i < this.options.data.length; i++) {

      const series = JSON.parse(JSON.stringify(scatter_series));

      series['c:idx'] = { a$: { val: i.toString() }};
      series['c:order'] = { a$: { val: i.toString() }};

      if (this.options.names && this.options.names[i]) {

        const name = this.options.names[i];
        switch (name.type) {
          case 'literal':
            series['c:tx'] = {
              'c:v': name.value.toString(),
            };
            legend = true;
            break;

          case 'range':
          case 'address':
            series['c:tx'] = {
              'c:strRef': {
                'c:f': name.label,
              }
            };
            legend = true;
            break;
        }
      }

      // "accent7" will break 

      if (i < 6) {
        series['c:spPr']['a:ln']['a:solidFill']['a:schemeClr'].a$['val'] = `accent${i+1}`;
      }

      series['c:yVal']['c:numRef']['c:f'] = this.options.data[i]?.label;

      if (this.options.labels2 && this.options.labels2[i]) {
        series['c:xVal']['c:numRef']['c:f'] = this.options.labels2[i]?.label;
      }

      if (this.options.smooth) {
        series['c:smooth'] = { a$: { val: 1 }};
      }

      // console.info("SER", JSON.stringify(series, undefined, 2));

      cser.push(series);

    }

    if (legend) {
      chartspace['c:chart']['c:legend'] = {
        'c:legendPos': { a$: {val: 'b'}, },
        'c:overlay': { a$: {val: '0'}, },
      };
    }

    return template;

  }

  public CreateDonutChart() {

    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = template['c:chartSpace'];
    const chart = JSON.parse(JSON.stringify(donut_json)); 
    chartspace['c:chart'] = chart;

    this.UpdateChartTitle(chartspace['c:chart']);

    const donut = chart['c:plotArea']['c:doughnutChart'];
    if (donut) {

      // const cat = this.FindNode('c:cat/c:strRef/c:f', donut);
      // if (cat) {
      //  cat._t = this.options.labels?.label;
      //}
      donut['c:ser']['c:cat']['c:strRef']['c:f'] = this.options.labels?.label || '';

      //const val = this.FindNode('c:val/c:numRef/c:f', donut);
      //if (val) {
      //  val._t = this.options.data[0]?.label;
      //}
      donut['c:ser']['c:val']['c:numRef']['c:f'] = this.options.data[0]?.label || '';

    }    

    return template;
    
  }

  public CreateBarChart() {

    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = template['c:chartSpace'];
    const bar = JSON.parse(JSON.stringify(column_json)); 

    chartspace['c:chart'] = bar;
    this.UpdateChartTitle(chartspace['c:chart']);

    const column = bar['c:plotArea']['c:barChart'];

    if (column) {

      const bardir = column['c:barDir'];

      if (bardir) {
        bardir.a$.val = (this.options.type === 'bar') ? 'bar' : 'col';
      }

      const cser = column['c:ser'];

      for (let i = 0; i < this.options.data.length; i++) {

        const series = JSON.parse(JSON.stringify(column_series));

        series['c:idx'] = { a$: { val: i.toString() }};
        series['c:order'] = { a$: { val: i.toString() }};

        // "accent7" will break 

        if (i < 6) {
          series['c:spPr']['a:solidFill']['a:schemeClr'].a$['val'] = `accent${i+1}`;
        }

        if (!i && this.options.labels) {
          series['c:cat'] = {
            'c:strRef': {
              'c:f': this.options.labels.label,
            }
          }
        }

        series['c:val']['c:numRef']['c:f'] = this.options.data[i]?.label;

        cser.push(series);

      }

    }    

    // console.info("T", JSON.stringify(template, undefined, 2));
    return template;

  }


}
