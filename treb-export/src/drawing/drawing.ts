
/*
import * as ElementTree from 'elementtree';
import { Element, ElementTree as Tree } from 'elementtree';
import { UnitAddress, UnitRange, UnitLiteral } from 'treb-parser/src';

import { donut_json } from './donut-chart';
import { static_title, ref_title, chart_template } from './chart-common';
import { column_json } from './column-chart';

import { Localization } from 'treb-base-types/src';
*/

import { Chart, ChartOptions } from './chart';

const pixel_offset = 9525;

export interface CellAnchor {
  row: number;
  column_offset?: number;
  column: number;
  row_offset?: number;
}

export interface TwoCellAnchor {
  from: CellAnchor;
  to: CellAnchor;
}

export interface AnchoredChart {
  anchor: TwoCellAnchor;
  chart: Chart;
}

export class Drawing {

  public static next_drawing_index = 1;

  /**
   * because we control this file, we kmow that there are no drawings
   * in there now, nor are there 'colors' or 'styles'. we can ensure
   * that the indexes are aligned, and start at 1. 
   * 
   * however you can adjust if necessary (not implemented).
   * /
  public static next_index: Indexes = {
    drawing: 1,
    chart: 1,
    colors: 1,
    style: 1,
  };

  public static ResetIndexes() {
    this.next_index = {
      drawing: 1,
      chart: 1,
      colors: 1,
      style: 1,
    };
  }
  */
  
  /*
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
  */

  /* * indexes for file names * /
  public indexes: Indexes;
  */

  /** relationship id sheet -> drawing */
  public sheet_drawing_relationship = 0;

  public charts: AnchoredChart[] = [];

  constructor(public index = Drawing.next_drawing_index++){}

  public AddChart(options: ChartOptions, anchor: TwoCellAnchor) {
    const chart = new Chart(options);
    this.charts.push({chart, anchor});
  }

  public GetDrawingXML() {
    const components: string[] = [`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`];

    for (let i = 0; i < this.charts.length; i++) {

      const index = i + 1;
      const anchor = this.charts[i].anchor;

      components.push(
        `<xdr:twoCellAnchor><xdr:from><xdr:col>${anchor.from.column}</xdr:col><xdr:colOff>${(anchor.from.column_offset || 0) * pixel_offset}</xdr:colOff>`
        + `<xdr:row>${anchor.from.row}</xdr:row><xdr:rowOff>${(anchor.from.row_offset || 0) * pixel_offset}</xdr:rowOff></xdr:from>`
        + `<xdr:to><xdr:col>${anchor.to.column}</xdr:col><xdr:colOff>${(anchor.to.column_offset || 0) * pixel_offset}</xdr:colOff>`
        + `<xdr:row>${anchor.to.row}</xdr:row><xdr:rowOff>${(anchor.to.row_offset || 0) * pixel_offset}</xdr:rowOff></xdr:to>`
        + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 1}" name="Chart ${index}"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{9948BDEE-44B2-4E72-83C8-2C9C56F04EAA}"/></a:ext></a:extLst></xdr:cNvPr><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${index}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
      );

    }
    components.push(`</xdr:wsDr>`);
    return components.join('');
  }

  public GetDrawingRels() {
    const components: string[] = [ `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`];

    for (let i = 0; i < this.charts.length; i++) {
      const index = i + 1;
      const chart = this.charts[i].chart;
      components.push(
        `<Relationship Id="rId${index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chart.index}.xml"/>`);
    }

    components.push(`</Relationships>`);
    return components.join('');
  }

}
