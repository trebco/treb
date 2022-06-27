
import type JSZip from 'jszip';
// import * as xmlparser from 'fast-xml-parser';
import { XMLParser } from 'fast-xml-parser';
import { XMLUtils, XMLOptions, XMLOptions2 } from './xml-utils';

// const xmlparser = new XMLParser();
const xmlparser1 = new XMLParser(XMLOptions);
const xmlparser2 = new XMLParser(XMLOptions2);

// import * as he from 'he';

//import { Drawing, TwoCellAnchor, CellAnchor } from './drawing/drawing';
import type { TwoCellAnchor, CellAnchor } from './drawing2/drawing2';

// import { ImportedSheetData, IArea } from 'treb-base-types/src';
import { SharedStrings } from './shared-strings2';
import { StyleCache } from './workbook-style2';
import { Theme } from './workbook-theme2';
import { Sheet, VisibleState } from './workbook-sheet2';
import type { RelationshipMap } from './relationship';


/*
const XMLTypeMap = {
  'sheet':          'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
  'theme':          'application/vnd.openxmlformats-officedocument.theme+xml',
  'drawing':        'application/vnd.openxmlformats-officedocument.drawing+xml',
  'chart':          'application/vnd.openxmlformats-officedocument.drawingml.chart+xml',
  'themeOverride':  'application/vnd.openxmlformats-officedocument.themeOverride+xml',
  'ctrlProp':       'application/vnd.ms-excel.controlproperties+xml',
  'style':          'application/vnd.ms-office.chartstyle+xml',
  'colors':         'application/vnd.ms-office.chartcolorstyle+xml',
};
*/

export enum ChartType {
  Unknown = 0, Column, Bar, Line, Scatter, Donut, Pie
}

export interface ChartSeries {
  values?: string;
  categories?: string;
  title?: string;
}

export interface ChartDescription {
  title?: string;
  type: ChartType; 
  series?: ChartSeries[];
}

export interface AnchoredChartDescription {
  chart?: ChartDescription, 
  anchor: TwoCellAnchor,
}


export class Workbook {

  public xml: any = {};

  /** start with an empty strings table, if we load a file we will update it */
  public shared_strings = new SharedStrings();    

  /** document styles */
  public style_cache = new StyleCache(); // public temp

  /** theme */
  public theme = new Theme();

  /** defined names. these can be ranges or expressions. */
  public defined_names: Record<string, string> = {};

  /** the workbook "rels" */
  public rels: RelationshipMap = {};

  public sheets: Sheet[] = [];

  public active_tab = 0;

  public get sheet_count(): number { 
    return this.sheets.length;
  }

  constructor(public zip: JSZip) {

  }

  /**
   * given a path in the zip file, read and parse the rels file
   */
  public async ReadRels(path: string): Promise<RelationshipMap> {

    const rels: RelationshipMap = {};
    const data = await this.zip.file(path)?.async('text') as string;

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

  public async Init(): Promise<void> {

    // read workbook rels
    this.rels = await this.ReadRels( 'xl/_rels/workbook.xml.rels');
    
    // shared strings
    let data = await this.zip.file('xl/sharedStrings.xml')?.async('text') as string;
    let xml = xmlparser2.parse(data || '');
    this.shared_strings.FromXML(xml);

    // theme
    data = await this.zip.file('xl/theme/theme1.xml')?.async('text') as string;
    xml = xmlparser2.parse(data);
    this.theme.FromXML(xml);

    // styles
    data = await this.zip.file('xl/styles.xml')?.async('text') as string;
    xml = xmlparser2.parse(data);
    this.style_cache.FromXML(xml, this.theme);

    // read workbook
    data = await this.zip.file('xl/workbook.xml')?.async('text') as string;
    xml = xmlparser2.parse(data);

    // defined names
    this.defined_names = {};
    const defined_names = XMLUtils.FindAll(xml, 'workbook/definedNames/definedName');
    for (const defined_name of defined_names) {
      const name = defined_name.a$?.name;
      const expression = defined_name.t$ || '';
      if (name && expression) {
        this.defined_names[name] = expression;
      }
    }

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

        data = await this.zip.file(worksheet.path)?.async('text') as string;
        worksheet.sheet_data = xmlparser2.parse(data || '');
        worksheet.rels = await this.ReadRels(worksheet.rels_path);

        worksheet.Parse();
        // console.info("TS", worksheet);

        this.sheets.push(worksheet);
      }
    }

    // console.info("TS", this.sheets);


  }

  public async ReadDrawing(reference: string): Promise<AnchoredChartDescription[] | undefined> {

    const data = await this.zip.file(reference.replace(/^../, 'xl'))?.async('text') as string;
    if (!data) {
      return undefined;
    }
    const xml = xmlparser2.parse(data);

    const drawing_rels = await this.ReadRels(reference.replace(/^..\/drawings/, 'xl/drawings/_rels') + '.rels');

    const results: AnchoredChartDescription[] = [];
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
      const result: AnchoredChartDescription = { anchor };

      const chart_reference = XMLUtils.FindAll(anchor_node, `xdr:graphicFrame/a:graphic/a:graphicData/c:chart`)[0];

      if (chart_reference && chart_reference.a$ && chart_reference.a$['r:id']) {
        const chart_rel = drawing_rels[chart_reference.a$['r:id']];
        if (chart_rel && chart_rel.target) {
          result.chart = await this.ReadChart(chart_rel.target);
        }
      }

      results.push(result);

    }

    return results;

  }

  /**
   * 
   * FIXME: this is using the old options with old structure, just have
   * not updated it yet
   */
  public async ReadChart(reference: string): Promise<ChartDescription|undefined> {

    const data = await this.zip.file(reference.replace(/^../, 'xl'))?.async('text') as string;
    if (!data) { return undefined; }

    const xml = xmlparser1.parse(data);

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
        else if (node.text__) {
          result.title = node.text__; // why is this not quoted, if the later one is quoted? is this a reference?
        }
      }
      else {
        const nodes = XMLUtils.FindAll(title_node, 'c:tx/c:rich/a:p/a:r/a:t');
        result.title = '"' + nodes.join('') + '"';
      }

    }

    const ParseSeries = (node: any, scatter = false): ChartSeries[] => {

      const series: ChartSeries[] = [];

      // const series_nodes = node.findall('./c:ser');
      let series_nodes = node['c:ser'] || [];
      if (!Array.isArray(series_nodes)) {
        series_nodes = [series_nodes];
      }

      // console.info("SN", series_nodes);

      for (const series_node of series_nodes) {

        let index = series.length;
        const order_node = series_node['c:order'];
        if (order_node) {
          index = Number(order_node.__val||0) || 0;
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

        if (scatter) {
          const x = XMLUtils.FindChild(series_node, 'c:xVal/c:numRef/c:f');
          if (x) {
            series_data.categories = x; // .text?.toString();
          }
          const y = XMLUtils.FindChild(series_node, 'c:yVal/c:numRef/c:f');
          if (y) {
            series_data.values = y; // .text?.toString();
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
        if (node['c:barDir'].__val === 'col') {
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
        result.series = ParseSeries(node, true);
      }
    }
    // console.info("RX?", result);

    return result;

  }

  /** FIXME: accessor */
  public GetNamedRanges(): Record<string, string> {
    
    // ... what does this do, not do, or what is it supposed to do?
    // note that this is called by the import routine, so it probably
    // expects to do something

    return this.defined_names;

  }

}