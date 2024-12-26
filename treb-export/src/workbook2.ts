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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

// import { XMLParser } from 'fast-xml-parser';
import { IsXMLNode, XMLUtils, attrs, text, default_parser as xmlparser2, type XMLNode } from './xml-utils';

// const xmlparser2 = new XMLParser(XMLOptions2);

// import * as he from 'he';

import type { TwoCellAnchor, CellAnchor } from './drawing2/drawing2';

import { SharedStrings } from './shared-strings2';
import { StyleCache } from './workbook-style2';
import { Theme } from './workbook-theme2';
import { Sheet, VisibleState } from './workbook-sheet2';
import type { RelationshipMap } from './relationship';
import { ZipWrapper } from './zip-wrapper';
import type { CellStyle, ThemeColor } from 'treb-base-types';
import type { SerializedNamed } from 'treb-data-model';

/**
 * @privateRemarks -- FIXME: not sure about the equal/equals thing. need to check.
 */
export const ConditionalFormatOperators: Record<string, string> = {
  greaterThan: '>',
  greaterThanOrEqual: '>=',
  // greaterThanOrEquals: '>=',
  lessThan: '<',
  lessThanOrEqual: '<=',
  // lessThanOrEquals: '<=',
  equal: '=',
  notEqual: '<>',
};

export enum ChartType {
  Unknown = 0, Column, Bar, Line, Scatter, Donut, Pie, Bubble, Box
}

export interface ChartSeries {
  values?: string;
  categories?: string;
  bubble_size?: string;
  title?: string;
}

export interface ChartDescription {
  title?: string;
  type: ChartType; 
  series?: ChartSeries[];
}

export interface AnchoredImageDescription {
  type: 'image';
  image?: Uint8Array;
  filename?: string;
  anchor: TwoCellAnchor,
}

export interface AnchoredChartDescription {
  type: 'chart';
  chart?: ChartDescription, 
  anchor: TwoCellAnchor,
}

export interface AnchoredTextBoxDescription {
  type: 'textbox';
  style?: CellStyle;
  reference?: string;
  paragraphs: { 
    style?: CellStyle,
    content: {
      text: string, 
      style?: CellStyle 
      reference?: boolean,
    }[],
  }[];
  anchor: TwoCellAnchor,
}

export type AnchoredDrawingPart = 
    AnchoredChartDescription | 
    AnchoredTextBoxDescription |
    AnchoredImageDescription ;

export interface TableFooterType {
  type: 'label'|'formula';
  value: string;
}

export interface TableDescription {
  name: string;
  display_name: string;
  ref: string;
  filterRef?: string;

  totals_row_shown?: number; // number? it's 0 in the xml
  totals_row_count?: number; // apparently when there _is_ a totals row, we have this attribute instead of the other one

  rel?: string;
  index?: number;
  columns?: string[];
  footers?: TableFooterType[];

  // auto filter?

  // column names?

  // style?

}

export class Workbook {

  public xml: XMLNode = {};

  /** start with an empty strings table, if we load a file we will update it */
  public shared_strings = new SharedStrings();    

  /** document styles */
  public style_cache = new StyleCache(); // public temp

  /** theme */
  public theme = new Theme();

  /* * defined names. these can be ranges or expressions. */
  // public defined_names: Record<string, string> = {};

  public named: Array<SerializedNamed & {local_scope?: number}> = [];

  /** the workbook "rels" */
  public rels: RelationshipMap = {};

  public sheets: Sheet[] = [];

  public active_tab = 0;

  public get sheet_count(): number { 
    return this.sheets.length;
  }

  constructor(public zip: ZipWrapper) {

  }

  /**
   * given a path in the zip file, read and parse the rels file
   */
  public ReadRels(path: string): RelationshipMap {

    const rels: RelationshipMap = {};
    const data = this.zip.Has(path) ? this.zip.Get(path) : '';

    //
    // force array on <Relationship/> elements, but be slack on the rest
    // (we know they are single elements)
    //
    const xml = xmlparser2.parse(data || '');

    const relationships = XMLUtils.FindAll2(xml, 'Relationships/Relationship');
    for (const relationship of relationships) {
      if (relationship[attrs]) {
        const id = relationship[attrs].Id as string;
        rels[id] = {
          id, 
          type: relationship[attrs].Type as string,
          target: relationship[attrs].Target as string,
        };
 
      }
    }

    return rels;

  }

  public Init() {

    // read workbook rels
    this.rels = this.ReadRels( 'xl/_rels/workbook.xml.rels');

    // shared strings
    let data = this.zip.Has('xl/sharedStrings.xml') ? this.zip.Get('xl/sharedStrings.xml') : '';
    let xml = xmlparser2.parse(data || '');
    this.shared_strings.FromXML(xml);

    // theme
    data = this.zip.Get('xl/theme/theme1.xml');
    xml = xmlparser2.parse(data);
    this.theme.FromXML(xml);

    // styles
    data = this.zip.Get('xl/styles.xml');
    xml = xmlparser2.parse(data);
    this.style_cache.FromXML(xml, this.theme);

    // console.info({c: this.style_cache});

    // read workbook
    data = this.zip.Get('xl/workbook.xml');
    xml = xmlparser2.parse(data);

    // defined names
    this.named = [];
    const defined_names = XMLUtils.FindAll2(xml, 'workbook/definedNames/definedName');
    for (const defined_name of defined_names) {
      const name = defined_name[attrs]?.name as string || '';
      const expression = defined_name[text] || '';
      const sheet_index = (defined_name[attrs]?.localSheetId) ? Number(defined_name[attrs].localSheetId) : undefined;

      // console.info({defined_name, name, expression, sheet_index});

      this.named.push({
        name, 
        expression: typeof expression === 'string' ? expression : expression?.toString() || '',  
        local_scope: sheet_index,
      });

    }

    /*
    this.defined_names = {};
    const defined_names = XMLUtils.FindAll(xml, 'workbook/definedNames/definedName');

    console.info({defined_names});

    for (const defined_name of defined_names) {
      if (name && expression) {
        this.defined_names[name] = expression;
      }
    }
    */

    const workbook_views = XMLUtils.FindAll2(xml, 'workbook/bookViews/workbookView');

    if (workbook_views[0]?.[attrs]?.activeTab) {
      this.active_tab = Number(workbook_views[0][attrs].activeTab) || 0;
    }

    // read sheets. in this version we preparse everything.
    const composite = XMLUtils.FindAll2(xml, 'workbook/sheets/sheet');

    for (const element of composite) {
      const name = element[attrs]?.name as string;

      if (name) {

        const state = element[attrs]?.state;
        const rid = element[attrs]?.['r:id'] as string;
  
        const worksheet = new Sheet({
          name, rid, id: Number(element[attrs]?.sheetId) 
        });
        
        if (state === 'hidden') {
          worksheet.visible_state = VisibleState.hidden;
        }
        else if (state === 'veryHidden') {
          worksheet.visible_state = VisibleState.very_hidden;
        }
    
        worksheet.shared_strings = this.shared_strings;

        worksheet.path = `xl/${this.rels[rid].target}`;
        worksheet.rels_path = worksheet.path.replace('worksheets', 'worksheets/_rels') + '.rels';

        data = this.zip.Get(worksheet.path);
        worksheet.sheet_data = xmlparser2.parse(data || '');
        worksheet.rels = this.ReadRels(worksheet.rels_path);

        worksheet.Parse();
        // console.info("TS", worksheet);

        this.sheets.push(worksheet);
      }
    }

    // console.info("TS", this.sheets);


  }

  public ReadTable(reference: string): TableDescription|undefined {

    const data = this.zip.Get(reference.replace(/^../, 'xl'));

    if (!data) {
      return undefined;
    }

    const xml = xmlparser2.parse(data);

    if (!IsXMLNode(xml.table)) {
      throw new Error('invalid table description');
    }

    const name = xml.table[attrs]?.name as string || '';

    const table: TableDescription = {
      name,
      display_name: xml.table[attrs]?.displayName as string || name,
      ref: xml.table[attrs]?.ref as string || '',
      totals_row_shown: Number(xml.table[attrs]?.totalsRowShown || '0') || 0,
      totals_row_count: Number(xml.table[attrs]?.totalsRowCount || '0') || 0,
    };

    return table;

  }

  public ReadDrawing(reference: string): AnchoredDrawingPart[] | undefined {

    const data = this.zip.Get(reference.replace(/^../, 'xl'));
    
    if (!data) {
      return undefined;
    }
    const xml = xmlparser2.parse(data);

    const drawing_rels = this.ReadRels(reference.replace(/^..\/drawings/, 'xl/drawings/_rels') + '.rels');

    const results: AnchoredDrawingPart[] = [];

    interface TwoCelLAnchorNode {
      'xdr:col'?: { [text]: number },
      'xdr:colOff'?: { [text]: number },
      'xdr:row'?: { [text]: number },
      'xdr:rowOff'?: { [text]: number },
    };

    const anchor_nodes = XMLUtils.FindAll2(xml, 'xdr:wsDr/xdr:twoCellAnchor');

    /* FIXME: move to drawing? */
    const ParseAnchor = (node: TwoCelLAnchorNode = {}): CellAnchor => {
      const anchor: CellAnchor = {
        column: node['xdr:col']?.[text] || 0, 
        column_offset: node['xdr:colOff']?.[text] || 0,
        row: node['xdr:row']?.[text] || 0, 
        row_offset: node['xdr:rowOff']?.[text] || 0,
      };
      return anchor;
    };

    for (const anchor_node of anchor_nodes) {

      const anchor: TwoCellAnchor = {
        from: ParseAnchor(anchor_node['xdr:from'] as TwoCelLAnchorNode), 
        to: ParseAnchor(anchor_node['xdr:to'] as TwoCelLAnchorNode),
      };

      let chart_reference = XMLUtils.FindAll2(anchor_node, `xdr:graphicFrame/a:graphic/a:graphicData/c:chart`)[0];

      // check for an "alternate content" chart/chartex (wtf ms). we're 
      // supporting this for box charts only (atm) 

      if (!chart_reference) {
        chart_reference = XMLUtils.FindAll2(anchor_node, `mc:AlternateContent/mc:Choice/xdr:graphicFrame/a:graphic/a:graphicData/cx:chart`)[0];
      }

      if (chart_reference && chart_reference[attrs] && chart_reference[attrs]['r:id']) {
        const result: AnchoredChartDescription = { type: 'chart', anchor };
        const chart_rel = drawing_rels[chart_reference[attrs]['r:id'] as string];
        if (chart_rel && chart_rel.target) {
          result.chart = this.ReadChart(chart_rel.target);
        }
        results.push(result);
      }
      else {

        const media_reference = XMLUtils.FindAll2(anchor_node, `xdr:pic/xdr:blipFill/a:blip`)[0];
        if (media_reference?.[attrs] && media_reference[attrs]['r:embed']) {
          const media_rel = drawing_rels[media_reference[attrs]['r:embed'] as string];

          // const chart_rel = drawing_rels[chart_reference.a$['r:id']];
          // console.info("Maybe an image?", media_reference, media_rel)

          if (media_rel && media_rel.target) {
            if (/(?:jpg|jpeg|png|gif)$/i.test(media_rel.target)) {

              // const result: AnchoredImageDescription = { type: 'image' };
              const path = media_rel.target.replace(/^\.\./, 'xl');
              const filename = path.replace(/^.*\//, '');
              
              const result: AnchoredImageDescription = {
                type: 'image', anchor, image: this.zip.GetBinary(path), filename
              }

              results.push(result);

            }
          }

        }
        else {

          let style: CellStyle|undefined;

          interface SpPr extends XMLNode {
            'a:solidFill': {
              'a:schemeClr'?: {
                [attrs]?: {
                  val: string;
                }
                'a:lumOff'?: {
                  [attrs]?: {
                    val: string|number;
                  }
                }
              }
            };
          }

          const sp = XMLUtils.FindAll2(anchor_node, 'xdr:sp')[0];
          if (sp) {

            const reference = sp[attrs]?.textlink as string || undefined;

            const sppr = XMLUtils.FindAll2(sp, 'xdr:spPr')[0] as SpPr;

            if (sppr) {
              style = {};
              const fill = sppr['a:solidFill'];
              if (fill) {
                if (fill['a:schemeClr']?.[attrs]?.val) {
                  const m = (fill['a:schemeClr'][attrs].val).match(/accent(\d+)/);
                  if (m) {
                    style.fill = { theme: Number(m[1]) + 3 }
                    if (fill['a:schemeClr']['a:lumOff']?.[attrs]?.val) {
                      const num = Number(fill['a:schemeClr']['a:lumOff'][attrs].val);
                      if (!isNaN(num)) {
                        (style.fill as ThemeColor).tint = num / 1e5;
                      }
                    }
                  }

                }
              }
            }

            const tx = XMLUtils.FindAll2(sp, 'xdr:txBody')[0];
            if (tx) {

              const paragraphs: { 
                style?: CellStyle,
                content: {
                  text: string, 
                  style?: CellStyle 
                  reference?: boolean;
                }[],
              }[] = [];

              const p_list = XMLUtils.FindAll2(tx, 'a:p');
              for (const paragraph of p_list) {
                const para: { text: string, style?: CellStyle, reference?: boolean }[] = [];
                let style: CellStyle|undefined;

                const fld = paragraph['a:fld'];
                if (IsXMLNode(fld)) {
                  if (fld[attrs]?.type === 'TxLink') {
                    const entry: {text: string, reference?: boolean, style?: CellStyle } = { text: `{${reference}}`, reference: true };

                    // format
                    const fmt = fld['a:rPr'];
                    if (IsXMLNode(fmt)) {
                      entry.style = {};
                      if (fmt[attrs]?.b === '1') {
                        entry.style.bold = true;
                      }
                      if (fmt[attrs]?.i === '1') {
                        entry.style.italic = true;
                      }
                    }

                    para.push(entry);
                  }
                }
  
                const appr = paragraph['a:pPr'];
                if (IsXMLNode(appr)) {
                  style = {};
                  if (appr[attrs]?.algn === 'r') {
                    style.horizontal_align = 'right';
                  }
                  else if (appr[attrs]?.algn === 'ctr') {
                    style.horizontal_align = 'center';
                  }
                }

                let ar = paragraph['a:r'];
                if (ar) {
                  if (!Array.isArray(ar)) {
                    ar = [ar];
                  }
                  for (const line of ar) {

                    const entry: { text: string, style?: CellStyle } = { 
                      text: IsXMLNode(line['a:t']) ? line['a:t'][text] as string || '' : '',
                    };

                    // format
                    const fmt = line['a:rPr'];
                    if (IsXMLNode(fmt)) {
                      entry.style = {};
                      if (fmt[attrs]?.b === '1') {
                        entry.style.bold = true;
                      }
                      if (fmt[attrs]?.i === '1') {
                        entry.style.italic = true;
                      }
                    }

                    para.push(entry);

                  }
                }

                paragraphs.push({ content: para, style });

              }
              
              results.push({
                type: 'textbox', 
                style,
                paragraphs,
                anchor,
                reference,
              });

            }
          }

        }


      }

    }

    return results;

  }

  /**
   * 
   * FIXME: this is using the old options with old structure, just have
   * not updated it yet
   */
  public ReadChart(reference: string): ChartDescription|undefined {

    const data = this.zip.Get(reference.replace(/^../, 'xl'));
    if (!data) { return undefined; }

    // const xml = xmlparser1.parse(data);
    const xml = xmlparser2.parse(data);

    const result: ChartDescription = {
      type: ChartType.Unknown
    };

    // console.info("RC", xml);

    const title_node = XMLUtils.FindAll2(xml, 'c:chartSpace/c:chart/c:title')[0];

    if (title_node) {

      // FIXME: other types of title? (...)
      const node = XMLUtils.FindAll2(title_node, 'c:tx/c:strRef/c:f')[0];
      if (node) {
        if (node[text]) {
          result.title = node[text] as string; // why is this not quoted, if the later one is quoted? is this a reference?
        }
      }
      else {
        const nodes = XMLUtils.FindAll2(title_node, 'c:tx/c:rich/a:p/a:r/a:t');
        result.title = '"' + nodes.map(node => node[text] || '').join('') + '"';
      }

    }

    const ParseSeries = (node: XMLNode, type?: ChartType): ChartSeries[] => {

      const series: ChartSeries[] = [];

      // const series_nodes = node.findall('./c:ser');
      let series_nodes = node['c:ser'] || [];
      if (!Array.isArray(series_nodes)) {
        series_nodes = [series_nodes];
      }

      for (const series_node of series_nodes) {

        let index = series.length;
        const order_node = series_node['c:order'];
        if (IsXMLNode(order_node)) {
          index = Number(order_node[attrs]?.val||0) || 0;
        }

        const series_data: ChartSeries = {};

        let title_node = XMLUtils.FindAll2(series_node, 'c:tx/c:v')[0];
        if (title_node) {
          const title = title_node[text];
          if (title) {
            series_data.title = `"${title}"`;
          }
        }
        else {
          title_node = XMLUtils.FindAll2(series_node, 'c:tx/c:strRef/c:f')[0];
          if (title_node) {
            series_data.title = title_node[text] as string || '';
          }
        }

        if (type === ChartType.Scatter || type === ChartType.Bubble) {
          const x = XMLUtils.FindAll2(series_node, 'c:xVal/c:numRef/c:f')[0];
          if (x) {
            series_data.categories = x[text] as string || ''; // .text?.toString();
          }
          const y = XMLUtils.FindAll2(series_node, 'c:yVal/c:numRef/c:f')[0];
          if (y) {
            series_data.values = y[text] as string || ''; // .text?.toString();
          }

          if (type === ChartType.Bubble) {
            const z = XMLUtils.FindAll2(series_node, 'c:bubbleSize/c:numRef/c:f')[0];
            if (z) {
              series_data.bubble_size = z[text] as string || ''; // .text?.toString();
            }
          }

        }
        else {
          const value_node = XMLUtils.FindAll2(series_node, 'c:val/c:numRef/c:f')[0];
          if (value_node) {
            series_data.values = value_node[text] as string; // .text?.toString();
          }

          let cat_node = XMLUtils.FindAll2(series_node, 'c:cat/c:strRef/c:f')[0];
          if (!cat_node) {
            cat_node = XMLUtils.FindAll2(series_node, 'c:cat/c:numRef/c:f')[0];
          }
          if (cat_node) {
            series_data.categories = cat_node[text] as string; // .text?.toString();
          }
        }

        series[index] = series_data;

      }

      return series;

    };

    let node = XMLUtils.FindAll2(xml, 'c:chartSpace/c:chart/c:plotArea/c:barChart')[0];
    if (node) {

      result.type = ChartType.Bar;
      // console.info("BD", node);
      if (IsXMLNode(node['c:barDir'])) {
        if (node['c:barDir'][attrs]?.val === 'col') {
          result.type = ChartType.Column;
        }
      }
      
      result.series = ParseSeries(node);
    }

    if (!node) {
      node = XMLUtils.FindAll2(xml, 'c:chartSpace/c:chart/c:plotArea/c:lineChart')[0];
      if (node) {
        result.type = ChartType.Line;
        result.series = ParseSeries(node);
      }
    }

    if (!node) {
      node = XMLUtils.FindAll2(xml, 'c:chartSpace/c:chart/c:plotArea/c:doughnutChart')[0];
      if (node) {
        result.type = ChartType.Donut;
        result.series = ParseSeries(node);
      }
    }

    if (!node) {
      node = XMLUtils.FindAll2(xml, 'c:chartSpace/c:chart/c:plotArea/c:pieChart')[0];
      if (node) {
        result.type = ChartType.Pie;
        result.series = ParseSeries(node);
      }
    }

    if (!node) {
      node = XMLUtils.FindAll2(xml, 'c:chartSpace/c:chart/c:plotArea/c:scatterChart')[0];
      if (node) {
        result.type = ChartType.Scatter;
        result.series = ParseSeries(node, ChartType.Scatter);
      }
    }

    if (!node) {
      node = XMLUtils.FindAll2(xml, 'c:chartSpace/c:chart/c:plotArea/c:bubbleChart')[0];
      if (node) {
        result.type = ChartType.Bubble;
        result.series = ParseSeries(node, ChartType.Bubble);
        // console.info("Bubble series?", result.series);
      }
    }

    if (!node) {

      // box plot uses "extended chart" which is totally different... but we 
      // might need it again later? for the time being it's just inlined

      const ex_series = XMLUtils.FindAll(xml, 'cx:chartSpace/cx:chart/cx:plotArea/cx:plotAreaRegion/cx:series');
      if (ex_series?.length) {
        if (ex_series.every(test => test.a$?.layoutId === 'boxWhisker')) {
          result.type = ChartType.Box;
          result.series = [];
          const data = XMLUtils.FindAll(xml, 'cx:chartSpace/cx:chartData/cx:data'); // /cx:data/cx:numDim/cx:f');

          // console.info({ex_series, data})

          for (const entry of ex_series) {

            const series: ChartSeries = {};

            const id = Number(entry['cx:dataId']?.a$?.val);
            for (const data_series of data) {
              if (Number(data_series.a$?.id) === id) {
                series.values = data_series['cx:numDim']?.['cx:f'] || '';
                break;
              }
            }

            const label = XMLUtils.FindAll(entry, 'cx:tx/cx:txData');
            if (label) {
              if (label[0]?.['cx:f']) {
                series.title = label[0]['cx:f'];
              }
              else if (label[0]?.['cx:v']) {
                series.title = '"' + label[0]['cx:v'] + '"';
              }
            }

            const title = XMLUtils.FindAll(xml, 'cx:chartSpace/cx:chart/cx:title/cx:tx/cx:txData');
            if (title) {
              if (title[0]?.['cx:f']) {
                result.title = title[0]['cx:f'];
              }
              else if (title[0]?.['cx:v']) {
                result.title = '"' + title[0]['cx:v'] + '"';
              }
            }

            result.series.push(series);

          }          

          // console.info({result});
          return result; 

        }
      }
    }

    if (!node) {
      console.info("Chart type not handled");
    }

    // console.info("RX?", result);

    return result;

  }

  /** FIXME: accessor */
  public GetNamedRanges() {
    
    // ... what does this do, not do, or what is it supposed to do?
    // note that this is called by the import routine, so it probably
    // expects to do something

    // return this.defined_names;

    return this.named;

  }

}