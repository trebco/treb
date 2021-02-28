
import * as ElementTree from 'elementtree';
import { Element, ElementTree as Tree } from 'elementtree';
import { UnitAddress, UnitRange, UnitLiteral, ExpressionUnit } from 'treb-parser';

import { donut_json } from './donut-chart-template';
import { static_title, ref_title, chart_template } from './chart-template-components';
import { column_json, column_series } from './column-chart-template';
import { scatter_json, scatter_series } from './scatter-chart-template';
import { scatter_series as scatter2_series } from './scatter2-chart-template';

// import { v4 as uuidv4 } from 'uuid';

import { Localization } from 'treb-base-types';

export interface ChartOptions {
  type: 'donut'|'column'|'bar'|'scatter'|'scatter2';
  title?: UnitLiteral | UnitAddress;
  data: UnitRange[];
  labels?: UnitRange;
  labels2?: UnitRange[];
  names?: ExpressionUnit[];
  smooth?: boolean;
}

export class Chart {

  public static next_chart_index = 1;

  constructor(
    public options: ChartOptions,
    public index = Chart.next_chart_index++,
  ) {}

  public ProcessJSONNode(name: string, node: any) {

    // create element
    const element = Element(name, node._a as ElementTree.Attributes);
  
    if (node._t) {
      element.text = node._t;
    }
  
    for (const key of Object.keys(node)) {
      if (key === '_a' || key === '_t') { continue; }
      let val = node[key] as any;
      if (!Array.isArray(val)) { val = [val]; }
      for (const entry of val) {
        element.getchildren().push(this.ProcessJSONNode(key, entry));
      }
    }
  
    return element;
  
  }
  
  public FindNode(label: string, root: any): any {
    const label_components = label.split('/');
    while (label_components.length) {
      label = label_components.shift() as string;
      const found = this.FindNodeInternal(label, root);
      if (!found) { return undefined; }
      if (!label_components.length) { return found; }
      root = found;
    }
  }

  public FindNodeInternal(label: string, root: any): any {

    if (root[label]) { return root[label]; }

    const keys = Object.keys(root);
    for (const key of keys) {
      if (key === '_a' || key === '_t') { continue; }
      const found = this.FindNodeInternal(label, root[key]);
      if (found) return found;
    }

    return undefined;

  }

  /** set chart title, either static or reference to cell */
  public UpdateChartTitle(obj: any) {


    /*
    if (!this.options.title) {
      const atd = this.FindNode('c:autoTitleDeleted', obj);
      if (atd) {
        atd._a.val = 1;
      }
    }
    */

    const unit = this.options.title || {
      type: 'literal', value: '',
    };

    const CC = this.FindNode('c:chart', obj);
    if (CC) {
      if (unit && unit.type === 'literal') {
        const title = static_title;
        const AP = this.FindNode('a:p', title);
        AP['a:r'] = {
          'a:rPr': {
            _a: {
              lang: Localization.locale,
            },
          },
          'a:t': {
            _t: unit.value,
          }
        };
        CC['c:title'] = title;
      }
      else if (unit) {
        const title = ref_title;
        const CF = this.FindNode('c:tx/c:strRef/c:f', title);
        CF._t = unit.label;
        CC['c:title'] = title;
      }
    }

  }

  public ObjectToXML(obj: any) {

    const keys = Object.keys(obj);
    if (keys.length !== 1) {
      throw new Error('too many roots');
    }
    const root = keys[0];
    const xml = new Tree(this.ProcessJSONNode(root, obj[root]));

    return xml;
    
  }

  /**
   * this now unifies scatter and line charts
   */
  public CreateScatter2(): ElementTree.ElementTree {
    
    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = this.FindNode('c:chartSpace', template);
    const scatter = JSON.parse(JSON.stringify(scatter_json)); 

    if (this.options.smooth) {
      const scatterstyle = this.FindNode('c:scatterStyle', scatter);
      if (scatterstyle) {
        scatterstyle._a.val = 'smoothMarker';
      }
    }

    chartspace['c:chart'] = scatter;

    this.UpdateChartTitle(template);

    const cser = this.FindNode('c:ser', template);

    let legend = false;

    for (let i = 0; i < this.options.data.length; i++) {

      const series = JSON.parse(JSON.stringify(scatter2_series));

      /*
      const uniq = this.FindNode('c16:uniqueId', series);
      if (uniq) {
        uniq._a.val = `{${uuidv4()}}`
        console.info(uniq);
      }
      */

      series['c:idx'] = { _a: { val: i.toString() }};
      series['c:order'] = { _a: { val: i.toString() }};

      if (this.options.names && this.options.names[i]) {

        const name = this.options.names[i];
        switch (name.type) {
          case 'literal':
            series['c:tx'] = {
              'c:v': {
                _t: name.value.toString(),
              }
            };
            legend = true;
            break;

          case 'range':
          case 'address':
            series['c:tx'] = {
              'c:strRef': {
                'c:f': {
                  _t: name.label,
                },
              }
            };
            legend = true;
            break;
        }
      }

      series['c:spPr']['a:ln']['a:solidFill']['a:schemeClr']._a['val'] = `accent${i+1}`;

      /*
      if (!i && this.options.labels) {
        series['c:cat'] = {
          'c:strRef': {
            'c:f': {
              _t: this.options.labels.label,
            }
          }
        }
      }
      */

      let val = this.FindNode('c:yVal/c:numRef/c:f', series);
      if (val) {
        val._t = this.options.data[i]?.label;
      }

      if (this.options.labels2 && this.options.labels2[i]) {
        val = this.FindNode('c:xVal/c:numRef/c:f', series);
        if (val) {
          val._t = this.options.labels2[i]?.label;
        }
      }

      if (this.options.smooth) {
        const smooth = this.FindNode('c:smooth', series);
        if (smooth) {
          smooth._a.val = '1';
        }
      }

      // console.info("SER", JSON.stringify(series, undefined, 2));

      cser.push(series);

    }

    if (legend) {
      const cchart = this.FindNode('c:chart', template);
      if (cchart) {
        cchart['c:legend'] = {
          'c:legendPos': {
            _a: {val: 'b'},
          },
          'c:overlay': {
            _a: {val: '0'},
          }
        };
      }
    }

    return this.ObjectToXML(template);

  }

  /*
  public CreateScatterChart() {

    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = this.FindNode('c:chartSpace', template);
    const scatter = JSON.parse(JSON.stringify(scatter_json)); 

    if (this.options.smooth) {
      const scatterstyle = this.FindNode('c:scatterStyle', scatter);
      if (scatterstyle) {
        scatterstyle._a.val = 'smoothMarker';
      }
    }

    chartspace['c:chart'] = scatter;

    this.UpdateChartTitle(template);

    const cser = this.FindNode('c:ser', template);

    let legend = false;

    for (let i = 0; i < this.options.data.length; i++) {

      const series = JSON.parse(JSON.stringify(scatter_series));

      series['c:idx'] = { _a: { val: i.toString() }};
      series['c:order'] = { _a: { val: i.toString() }};

      // snip
      // ... FIXME: unify

      if (this.options.names && this.options.names[i]) {

        const name = this.options.names[i];
        switch (name.type) {
          case 'literal':
            series['c:tx'] = {
              'c:v': {
                _t: name.value.toString(),
              }
            };
            legend = true;
            break;

          case 'range':
          case 'address':
            series['c:tx'] = {
              'c:strRef': {
                'c:f': {
                  _t: name.label,
                },
              }
            };
            legend = true;
            break;
        }
      }

      // /snip

      series['c:spPr']['a:ln']['a:solidFill']['a:schemeClr']._a['val'] = `accent${i+1}`;

      / *
      if (!i && this.options.labels) {
        series['c:cat'] = {
          'c:strRef': {
            'c:f': {
              _t: this.options.labels.label,
            }
          }
        }
      }
      * /

      const val = this.FindNode('c:yVal/c:numRef/c:f', series);
      if (val) {
        val._t = this.options.data[i]?.label;
      }

      if (this.options.smooth) {
        const smooth = this.FindNode('c:smooth', series);
        if (smooth) {
          smooth._a.val = '1';
        }
      }

      cser.push(series);

    }

    if (legend) {
      const cchart = this.FindNode('c:chart', template);
      if (cchart) {
        cchart['c:legend'] = {
          'c:legendPos': {
            _a: {val: 'b'},
          },
          'c:overlay': {
            _a: {val: '0'},
          }
        };
      }
    }

    return this.ObjectToXML(template);

  }
  */

  public CreateBarChart() {

    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = this.FindNode('c:chartSpace', template);
    const bar = JSON.parse(JSON.stringify(column_json)); 

    chartspace['c:chart'] = bar;

    this.UpdateChartTitle(template);

    const column = this.FindNode('c:barChart', template);
    if (column) {

      const bardir = this.FindNode('c:barDir', column);
      
      if (bardir) {
        bardir._a.val = (this.options.type === 'bar') ? 'bar' : 'col';
      }

      const cser = this.FindNode('c:ser', column);

      for (let i = 0; i < this.options.data.length; i++) {

        const series = JSON.parse(JSON.stringify(column_series));

        series['c:idx'] = { _a: { val: i.toString() }};
        series['c:order'] = { _a: { val: i.toString() }};
        series['c:spPr']['a:solidFill']['a:schemeClr']._a['val'] = `accent${i+1}`;

        if (!i && this.options.labels) {
          series['c:cat'] = {
            'c:strRef': {
              'c:f': {
                _t: this.options.labels.label,
              }
            }
          }
        }

        const val = this.FindNode('c:val/c:numRef/c:f', series);
        if (val) {
          val._t = this.options.data[i]?.label;
        }

        cser.push(series);

      }

    }    

    return this.ObjectToXML(template);
  }

  public CreateDonutChart() {

    const template = JSON.parse(JSON.stringify(chart_template)); 
    const chartspace = this.FindNode('c:chartSpace', template);
    const chart = JSON.parse(JSON.stringify(donut_json)); 
    chartspace['c:chart'] = chart;

    // const obj = JSON.parse(JSON.stringify(donut_json)); // clone
    this.UpdateChartTitle(template);

    const donut = this.FindNode('c:doughnutChart', template);
    if (donut) {

      const cat = this.FindNode('c:cat/c:strRef/c:f', donut);
      if (cat) {
        cat._t = this.options.labels?.label;
      }

      const val = this.FindNode('c:val/c:numRef/c:f', donut);
      if (val) {
        val._t = this.options.data[0]?.label;
      }

    }    

    return this.ObjectToXML(template);
  
  }


  ///

  public GetChartXML() {

    switch (this.options.type) {
      case 'donut':
        return this.CreateDonutChart().write({xml_declaration: true});
      
      case 'scatter':
      case 'scatter2':
        return this.CreateScatter2().write({xml_declaration: true});

      //case 'scatter':
      //  return this.CreateScatterChart().write({xml_declaration: true});

      case 'column':
      case 'bar':
        return this.CreateBarChart().write({xml_declaration: true});
    }

    console.warn('missing chart type xml');
    return '';

  }

  public GetChartRels() {

    // FIXME

    // if (this.indexes.style || this.indexes.colors) {
    //   console.warn('not adding relationships for colors, style');
    // }

    /*
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships
      xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors${this.indexes.colors}.xml"/>
      <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/chartStyle" Target="style${this.indexes.style}.xml"/>
    </Relationships>`;
    */

   return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
   <Relationships
     xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
   </Relationships>`;

  }

  /*
  public GetStyleXML() {
    return ''; // style_xml;
  }

  public GetColorsXML() {
    return ''; // colors_xml;
  }
  */

}