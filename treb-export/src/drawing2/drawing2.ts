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

import type { ImageOptions } from './embedded-image';
import { EmbeddedImage } from './embedded-image';
import type { ChartOptions} from './chart2';
import { Chart} from './chart2';
import type { RelationshipMap} from '../relationship';
import { AddRel } from '../relationship';
import type { DOMContent } from '../xml-utils';

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

    const dom: DOMContent = {
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

}
