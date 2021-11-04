
import { Chart, ChartOptions } from './chart2';
import { RelationshipMap, AddRel } from '../relationship';
import { Corner } from 'treb-base-types/src';

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
  relationship: string;
}

export interface JSONCorner {
  'xdr:col': number,
  'xdr:colOff': number,
  'xdr:row': number,
  'xdr:rowOff': number,
}

export class Drawing {

  public static next_drawing_index = 1;

  /** relationship id sheet -> drawing */
  public sheet_drawing_relationship = 0;

  public charts: AnchoredChart[] = [];

  public relationships: RelationshipMap = {};

  constructor(public index = Drawing.next_drawing_index++){}

  public AddChart(options: ChartOptions, anchor: TwoCellAnchor): void {
    const chart = new Chart(options);
    const relationship = AddRel(this.relationships, 
        `http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart`,
        `../charts/chart${chart.index}.xml`);
    this.charts.push({chart, anchor, relationship});
  }

  public CornerToJSON(anchor: CellAnchor): JSONCorner {
    return {
      'xdr:col': anchor.column,
      'xdr:colOff': (anchor.column_offset || 0) * pixel_offset,
      'xdr:row': anchor.row,
      'xdr:rowOff': (anchor.row_offset || 0) * pixel_offset,
    };
  }

  public AnchorToJSON(anchor: TwoCellAnchor): { 'xdr:from': JSONCorner, 'xdr:to': JSONCorner } {
    return {
      'xdr:from': { ...this.CornerToJSON(anchor.from), },
      'xdr:to': { ...this.CornerToJSON(anchor.to), },
    };
  }

  public toJSON(): any {

    const dom: any = {
      'xdr:wsDr': {
        a$: {
          'xmlns:xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
          'xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        },
        'xdr:twoCellAnchor': this.charts.map(chart => {
          const block = {
            ...this.AnchorToJSON(chart.anchor),
            'xdr:graphicFrame': {
              a$: { macro: '' },
              'xdr:nvGraphicFramePr': {
                'xdr:cNvPr': {
                  a$: { id: chart.chart.index + 1, name: `Chart ${chart.chart.index}`, },
                  /*
                  'a:extLst': {
                    'a:ext': {
                      a$: { uri: '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}' },
                      'a16:creationId': {
                        a$: { 'xmlns:a16': 'http://schemas.microsoft.com/office/drawing/2014/main' },
                      },
                    },
                  },
                  */
                },
                'xdr:cNvGraphicFramePr': {},
              },
              'xdr:xfrm': {
                'a:off': { a$: { x: 0, y: 0, }},
                'a:ext': { a$: { cx: 0, cy: 0 }},
              },
              'a:graphic': {
                'a:graphicData': {
                  a$: { uri: 'http://schemas.openxmlformats.org/drawingml/2006/chart' },
                  'c:chart': {
                    a$: {
                      'xmlns:c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
                      'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                      'r:id': chart.relationship,
                    },
                  },
                },
              },
            },
            'xdr:clientData': {},
          };
          return block;
        }),
      },
    };

    return dom;

  }

  /*
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
  */

}
