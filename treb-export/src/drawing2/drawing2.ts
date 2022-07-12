/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import { EmbeddedImage, ImageOptions } from './embedded-image';
import { Chart, ChartOptions} from './chart2';
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

export interface AnchoredImage {
  anchor: TwoCellAnchor;
  image: EmbeddedImage;
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
  public images: AnchoredImage[] = [];

  public relationships: RelationshipMap = {};

  constructor(public index = Drawing.next_drawing_index++){}

  public AddImage(options: ImageOptions, anchor: TwoCellAnchor): void {
    const image = new EmbeddedImage(options);
    if (image.extension) {
      const relationship = AddRel(this.relationships,
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        `../media/image${image.index}.${image.extension}`);
      this.images.push({image, relationship, anchor});
    }
  }

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

    const image_blocks: any[] = 
      this.images.map(image => {
        const block = {
          a$: { editAs: 'oneCell' },
          ...this.AnchorToJSON(image.anchor),
          'xdr:pic': {
            'xdr:nvPicPr': {
              'xdr:cNvPr': /* image.image.extension === 'svg' ? {
                a$: { id: image.image.index + 1, name: 'Image ' + image.image.index},
                'a:extLst': {
                  'a:ext': {
                    a$: { uri: '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}' },
                    'a16:creationId': {
                      a$: {
                        'xmlns:a16': 'http://schemas.microsoft.com/office/drawing/2014/main',
                      },
                    },
                  },
                },
              } : */ 
              {
                a$: { id: image.image.index + 1, name: 'Image ' + image.image.index},
              },  
              'xdr:cNvPicPr': {
                'a:picLocks': {
                  a$: {
                    noChangeAspect: 1,
                  },
                },
              },
            },
            'xdr:blipFill': {
              'a:blip': {
                a$: image.image.extension === 'svg' ? {
                  'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                } : {
                  'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                  'r:embed': image.relationship,
                },
                'a:extLst': {
                  'a:ext': [
                    {
                      a$: {
                        uri: '{28A0092B-C50C-407E-A947-70E740481C1C}',
                      },
                      'a14:useLocalDpi': {
                        a$: {
                          'xmlns:a14': 'http://schemas.microsoft.com/office/drawing/2010/main', val: 0,
                        },
                      },
                    },
                    image.image.extension === 'svg' ? {
                      a$: {
                        uri: '{96DAC541-7B7A-43D3-8B79-37D633B846F1}',
                      },
                      'asvg:svgBlip': {
                        a$: {
                          'xmlns:asvg': 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
                          'r:embed': image.relationship,
                        },
                      }                      
                    } : undefined,
                  ],
                },
              },
              'a:stretch': {
                'a:fillRect': {},
              },
            },

            'xdr:spPr': {
              'a:xfrm': {
                'a:off': {
                  a$: { x: 0, y: 0 },
                },
                'a:ext': {
                  a$: { cx: 4057650, cy: 6172200, }, // ??
                },
              },
              'a:prstGeom': {
                a$: { prst: 'rect', },
                'a:avLst': {},
              },
            },

            /* 
      <xdr:nvPicPr>
        <xdr:cNvPr id="3" name="Graphic 2">
          <a:extLst>
            <a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}">
              <a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{9BA0B4E8-3DD4-4297-8733-48C3F5D063BA}"/>
            </a:ext>
          </a:extLst>
        </xdr:cNvPr>
        <xdr:cNvPicPr>
          <a:picLocks noChangeAspect="1"/>
        </xdr:cNvPicPr>
      </xdr:nvPicPr>
      
      <xdr:blipFill>

            [ this one is svg]

        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1">
          <a:extLst>
            <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
              <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
            </a:ext>
            <a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">
              <asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId2"/>
            </a:ext>
          </a:extLst>
        </a:blip>

            [alt]

        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId3">
          <a:extLst>
            <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
              <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
            </a:ext>
          </a:extLst>
        </a:blip>


        <a:stretch>
          <a:fillRect/>
        </a:stretch>
      </xdr:blipFill>

      <xdr:spPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="4057650" cy="6172200"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </xdr:spPr>


            */


          },
          'xdr:clientData': {},
        };
        return block;
      });

    const chart_blocks: any[] = 
      this.charts.map(chart => {
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
      });

    const dom: any = {
      'xdr:wsDr': {
        a$: {
          'xmlns:xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
          'xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        },
        'xdr:twoCellAnchor': [...chart_blocks, ...image_blocks],
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
