
import * as ElementTree from 'elementtree';
import { Element, ElementTree as Tree } from 'elementtree';
import { UnitAddress, UnitRange, UnitLiteral } from 'treb-parser/src';

import { donut_json, static_title, ref_title } from './donut-chart';
import { Localization } from 'treb-base-types/src';

interface Indexes {
  drawing: number;
  chart: number;
  colors: number;
  style: number;
}

export interface ChartOptions {
  type: 'donut';
  title?: UnitLiteral | UnitAddress;
  data?: UnitRange;
  labels?: UnitRange;
}

export interface CellAnchor {
  row: number;
  column: number;
}

export class Drawing {

  /**
   * because we control this file, we kmow that there are no drawings
   * in there now, nor are there 'colors' or 'styles'. we can ensure
   * that the indexes are aligned, and start at 1. 
   * 
   * however you can adjust if necessary (not implemented).
   */
  public static next_index: Indexes = {
    drawing: 1,
    chart: 1,
    colors: 1,
    style: 1,
  };

  public static AssignIndexes(colors = true, style = true): Indexes {
    const indexes = {...this.next_index};
    this.next_index.drawing++;
    this.next_index.chart++;

    if (colors) {
      this.next_index.colors++;
    }
    else {
      indexes.colors = 0;
    }

    if (style) { 
      this.next_index.style++;
    }
    else {
      indexes.style = 0;
    }
    
    return indexes;
  }

  /** indexes for file names */
  public indexes: Indexes;

  /** relationship id sheet -> drawing */
  public sheet_drawing_relationship = 0;

  constructor(
    public from_cell: CellAnchor, // TODO: offset
    public to_cell: CellAnchor,
    colors = true, 
    style = true,
    public options: ChartOptions,
    ) {
    this.indexes = Drawing.AssignIndexes(colors, style);
  }

  public ProcessJSONNode(name: string, node: any) {

    // create element
    const element = Element(name, node._a as ElementTree.Attributes);
  
    if (node._t) {
      element.text = node._t;
    }
  
    for (const key of Object.keys(node)) {
      if (key === '_a' || key === '_t') { continue; }
      element.getchildren().push(this.ProcessJSONNode(key, node[key] as any));
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

  public CreateDonutChart() {

    const obj = JSON.parse(JSON.stringify(donut_json)); // clone
    const CC = this.FindNode('c:chart', obj);

    if (CC) {
      if (this.options.title && this.options.title.type === 'literal') {
        const title = static_title;
        const AP = this.FindNode('a:p', title);
        AP['a:r'] = {
          'a:rPr': {
            _a: {
              lang: Localization.locale,
            },
          },
          'a:t': {
            _t: this.options.title.value,
          }
        };
        CC['c:title'] = title;
      }
      else if (this.options.title) {
        const title = ref_title;
        const CF = this.FindNode('c:tx/c:strRef/c:f', title);
        CF._t = this.options.title.label;
        CC['c:title'] = title;
      }
    }

    const donut = this.FindNode('c:doughnutChart', obj);
    if (donut) {

      const cat = this.FindNode('c:cat/c:strRef/c:f', donut);
      if (cat) {
        cat._t = this.options.labels?.label;
      }

      const val = this.FindNode('c:val/c:numRef/c:f', donut);
      if (val) {
        val._t = this.options.data?.label;
      }

    }    

    const keys = Object.keys(obj);
    if (keys.length !== 1) {
      throw new Error('too many roots');
    }
    const root = keys[0];
    const xml = new Tree(this.ProcessJSONNode(root, obj[root]));
  

    return xml;
  
  }


  ///

  public GetChartXML() {
    return this.CreateDonutChart().write({xml_declaration: true});
  }

  public GetChartRels() {

    // FIXME

    if (this.indexes.style || this.indexes.colors) {
      console.warn('not adding relationships for colors, style');
    }

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

  public GetStyleXML() {
    return ''; // style_xml;
  }

  public GetColorsXML() {
    return ''; // colors_xml;
  }

  public GetDrawingXML() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>${this.from_cell.column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${this.from_cell.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${this.to_cell.column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${this.to_cell.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart ${this.indexes.chart}"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{9948BDEE-44B2-4E72-83C8-2C9C56F04EAA}"/></a:ext></a:extLst></xdr:cNvPr><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
  }

  public GetDrawingRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships
      xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${this.indexes.chart}.xml"/>
    </Relationships>
    `;
  }

}
