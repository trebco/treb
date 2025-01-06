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

import { XMLParser } from 'fast-xml-parser';
import { XMLUtils, XMLOptions2 } from './xml-utils';

// const xmlparser = new XMLParser();
// const xmlparser1 = new XMLParser(XMLOptions);
const xmlparser2 = new XMLParser(XMLOptions2);

// import * as he from 'he';

import type { TwoCellAnchor, CellAnchor } from './drawing2/drawing2';

import { SharedStrings } from './shared-strings2';
import { StyleCache } from './workbook-style2';
import { Theme } from './workbook-theme2';
import { Sheet, VisibleState } from './workbook-sheet2';
import type { RelationshipMap } from './relationship';
import { ZipWrapper } from './zip-wrapper';
import type { CellStyle, ICellAddress, ThemeColor } from 'treb-base-types';
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

  public xml: any = {};

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

    for (const relationship of xml.Relationships?.Relationship || []) {
      const id = relationship.a$.Id;
      rels[id] = {
        id, 
        type: relationship.a$.Type,
        target: relationship.a$.Target,
      };
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
    const defined_names = XMLUtils.FindAll(xml, 'workbook/definedNames/definedName');
    for (const defined_name of defined_names) {
      const name = defined_name.a$?.name;
      const expression = defined_name.t$ || '';
      const sheet_index = (defined_name.a$?.localSheetId) ? Number(defined_name.a$.localSheetId) : undefined;

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

    const workbook_views = XMLUtils.FindAll(xml, 'workbook/bookViews/workbookView');

    if (workbook_views[0]?.a$?.activeTab) {
      this.active_tab = Number(workbook_views[0].a$.activeTab) || 0;
    }

    // read sheets. in this version we preparse everything.
    const composite = XMLUtils.FindAll(xml, 'workbook/sheets/sheet');


    for (const element of composite) {
      const name = element.a$?.name;

      if (name) {

        const state = element.a$.state;
        const rid = element.a$['r:id'];
  
        const worksheet = new Sheet({
          name, rid, id: Number(element.a$.sheetId) 
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
    const name = xml.table?.a$?.name || '';

    const table: TableDescription = {
      name,
      display_name: xml.table?.a$?.displayName || name,
      ref: xml.table?.a$.ref || '',
      totals_row_shown: Number(xml.table?.a$.totalsRowShown || '0') || 0,
      totals_row_count: Number(xml.table?.a$.totalsRowCount || '0') || 0,
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
    const anchor_nodes = XMLUtils.FindAll(xml, 'xdr:wsDr/xdr:twoCellAnchor');

    /* FIXME: move to drawing? */
    const ParseAnchor = (node: any = {}): CellAnchor => {
      const anchor: CellAnchor = {
        column: node['xdr:col'] || 0, 
        column_offset: node['xdr:colOff'] || 0,
        row: node['xdr:row'] || 0, 
        row_offset: node['xdr:rowOff'] || 0,
      };
      return anchor;
    };

    for (const anchor_node of anchor_nodes) {

      const anchor: TwoCellAnchor = {
        from: ParseAnchor(anchor_node['xdr:from']), 
        to: ParseAnchor(anchor_node['xdr:to']),
      };

      let chart_reference = XMLUtils.FindAll(anchor_node, `xdr:graphicFrame/a:graphic/a:graphicData/c:chart`)[0];

      // check for an "alternate content" chart/chartex (wtf ms). we're 
      // supporting this for box charts only (atm) 

      if (!chart_reference) {
        chart_reference = XMLUtils.FindAll(anchor_node, `mc:AlternateContent/mc:Choice/xdr:graphicFrame/a:graphic/a:graphicData/cx:chart`)[0];
      }

      if (chart_reference && chart_reference.a$ && chart_reference.a$['r:id']) {
        const result: AnchoredChartDescription = { type: 'chart', anchor };
        const chart_rel = drawing_rels[chart_reference.a$['r:id']];
        if (chart_rel && chart_rel.target) {
          result.chart = this.ReadChart(chart_rel.target);
        }
        results.push(result);
      }
      else {

        const media_reference = XMLUtils.FindAll(anchor_node, `xdr:pic/xdr:blipFill/a:blip`)[0];
        if (media_reference && media_reference.a$['r:embed']) {
          const media_rel = drawing_rels[media_reference.a$['r:embed']];

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

          const sp = XMLUtils.FindAll(anchor_node, 'xdr:sp')[0];
          if (sp) {

            const reference = sp.a$?.textlink || undefined;

            const sppr = XMLUtils.FindAll(sp, 'xdr:spPr')[0];
            if (sppr) {
              style = {};
              const fill = sppr['a:solidFill'];
              if (fill) {
                if (fill['a:schemeClr']?.a$?.val) {
                  const m = (fill['a:schemeClr'].a$.val).match(/accent(\d+)/);
                  if (m) {
                    style.fill = { theme: Number(m[1]) + 3 }
                    if (fill['a:schemeClr']['a:lumOff']?.a$?.val) {
                      const num = Number(fill['a:schemeClr']['a:lumOff'].a$.val);
                      if (!isNaN(num)) {
                        (style.fill as ThemeColor).tint = num / 1e5;
                      }
                    }
                  }

                }
              }
            }

            const tx = XMLUtils.FindAll(sp, 'xdr:txBody')[0];
            if (tx) {

              const paragraphs: { 
                style?: CellStyle,
                content: {
                  text: string, 
                  style?: CellStyle 
                  reference?: boolean;
                }[],
              }[] = [];

              const p_list = XMLUtils.FindAll(tx, 'a:p');
              for (const paragraph of p_list) {
                const para: { text: string, style?: CellStyle, reference?: boolean }[] = [];
                let style: CellStyle|undefined;

                const fld = paragraph['a:fld'];
                if (fld) {
                  if (fld.a$?.type === 'TxLink') {
                    const entry: {text: string, reference?: boolean, style?: CellStyle } = { text: `{${reference}}`, reference: true };

                    // format
                    const fmt = fld['a:rPr'];
                    if (fmt) {
                      entry.style = {};
                      if (fmt.a$?.b === '1') {
                        entry.style.bold = true;
                      }
                      if (fmt.a$?.i === '1') {
                        entry.style.italic = true;
                      }
                    }

                    para.push(entry);
                  }
                }
  
                const appr = paragraph['a:pPr'];
                if (appr) {
                  style = {};
                  if (appr.a$?.algn === 'r') {
                    style.horizontal_align = 'right';
                  }
                  else if (appr.a$?.algn === 'ctr') {
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
                      text: line['a:t'] || '',
                    };

                    // format
                    const fmt = line['a:rPr'];
                    if (fmt) {
                      entry.style = {};
                      if (fmt.a$?.b === '1') {
                        entry.style.bold = true;
                      }
                      if (fmt.a$?.i === '1') {
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

    const title_node = XMLUtils.FindChild(xml, 'c:chartSpace/c:chart/c:title');

    if (title_node) {

      // FIXME: other types of title? (...)
      const node = XMLUtils.FindChild(title_node, 'c:tx/c:strRef/c:f');
      if (node) {
        if (typeof node === 'string') {
          result.title = node;
        }
        else if (node.t$) {
          result.title = node.t$; // why is this not quoted, if the later one is quoted? is this a reference?
        }
      }
      else {
        const nodes = XMLUtils.FindAll(title_node, 'c:tx/c:rich/a:p/a:r/a:t');
        result.title = '"' + nodes.join('') + '"';
      }

    }

    const ParseSeries = (node: any, type?: ChartType): ChartSeries[] => {

      const series: ChartSeries[] = [];

      // const series_nodes = node.findall('./c:ser');
      let series_nodes = node['c:ser'] || [];
      if (!Array.isArray(series_nodes)) {
        series_nodes = [series_nodes];
      }

      // console.info({SN: series_nodes});

      for (const series_node of series_nodes) {

        let index = series.length;
        const order_node = series_node['c:order'];
        if (order_node) {
          index = Number(order_node.a$?.val||0) || 0;
        }

        const series_data: ChartSeries = {};

        let title_node = XMLUtils.FindChild(series_node, 'c:tx/c:v');
        if (title_node) {
          const title = title_node;
          if (title) {
            series_data.title = `"${title}"`;
          }
        }
        else {
          title_node = XMLUtils.FindChild(series_node, 'c:tx/c:strRef/c:f');
          if (title_node) {
            series_data.title = title_node;
          }
        }

        if (type === ChartType.Scatter || type === ChartType.Bubble) {
          const x = XMLUtils.FindChild(series_node, 'c:xVal/c:numRef/c:f');
          if (x) {
            series_data.categories = x; // .text?.toString();
          }
          const y = XMLUtils.FindChild(series_node, 'c:yVal/c:numRef/c:f');
          if (y) {
            series_data.values = y; // .text?.toString();
          }

          if (type === ChartType.Bubble) {
            const z = XMLUtils.FindChild(series_node, 'c:bubbleSize/c:numRef/c:f');
            if (z) {
              series_data.bubble_size = z; // .text?.toString();
            }
          }

        }
        else {
          const value_node = XMLUtils.FindChild(series_node, 'c:val/c:numRef/c:f');
          if (value_node) {
            series_data.values = value_node; // .text?.toString();
          }

          let cat_node = XMLUtils.FindChild(series_node, 'c:cat/c:strRef/c:f');
          if (!cat_node) {
            cat_node = XMLUtils.FindChild(series_node, 'c:cat/c:numRef/c:f');
          }
          if (cat_node) {
            series_data.categories = cat_node; // .text?.toString();
          }
        }

        series[index] = series_data;

      }

      return series;

    };

    let node = XMLUtils.FindChild(xml, 'c:chartSpace/c:chart/c:plotArea/c:barChart');
    if (node) {

      result.type = ChartType.Bar;
      // console.info("BD", node);
      if (node['c:barDir']) {
        if (node['c:barDir'].a$?.val === 'col') {
          result.type = ChartType.Column;
        }
      }
      
      result.series = ParseSeries(node);
    }

    if (!node) {
      node = XMLUtils.FindChild(xml, 'c:chartSpace/c:chart/c:plotArea/c:lineChart');
      if (node) {
        result.type = ChartType.Line;
        result.series = ParseSeries(node);
      }
    }

    if (!node) {
      node = XMLUtils.FindChild(xml, 'c:chartSpace/c:chart/c:plotArea/c:doughnutChart');
      if (node) {
        result.type = ChartType.Donut;
        result.series = ParseSeries(node);
      }
    }

    if (!node) {
      node = XMLUtils.FindChild(xml, 'c:chartSpace/c:chart/c:plotArea/c:pieChart');
      if (node) {
        result.type = ChartType.Pie;
        result.series = ParseSeries(node);
      }
    }

    if (!node) {
      node = XMLUtils.FindChild(xml, 'c:chartSpace/c:chart/c:plotArea/c:scatterChart');
      if (node) {
        result.type = ChartType.Scatter;
        result.series = ParseSeries(node, ChartType.Scatter);
      }
    }

    if (!node) {
      node = XMLUtils.FindChild(xml, 'c:chartSpace/c:chart/c:plotArea/c:bubbleChart');
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