

import * as ElementTree from 'elementtree';
import { Element, ElementTree as Tree } from 'elementtree';
import { Sheet } from './sheet';
import { SharedStrings } from './shared-strings';
import { StyleCache } from './style';
import { Theme } from './theme';

// import { Drawing } from './drawing';

import * as JSZip from 'jszip';

interface Relationship {
  id?: string;
  type?: string;
  target?: string;
}

export class Workbook {

  public style_cache = new StyleCache(); // public temp
  public theme = new Theme();

  private zip?: JSZip;
  private shared_strings = new SharedStrings();
  // private sheets: {[index: string]: Sheet} = {};
  private sheets: Sheet[] = [];

  // private drawings: Drawing[] = [];

  private dom?: Tree;
  private rels: {[index: string]: Relationship} = {};

  private rels_dom?: Tree;

  // public GetSheet(sheet: string|number) {
  public GetSheet(sheet: number) {
    // if (typeof sheet === 'string') return this.sheets[name];
    // else return this.sheets[Object.keys(this.sheets)[0]];
    return this.sheets[sheet];
  }

  public Count() {
    return this.sheets.length;
  }

  public RenameSheet(index: number, name: string) {
    if (!this.dom) throw new Error('missing dom');

    // local: does this matter? might as well keep it consistent
    this.sheets[index].options.name = name;

    // rename in workbook
    const sheet = this.dom.find(`./sheets/sheet/[@sheetId="${index + 1}"]`);
    if (sheet) {
      sheet.set('name', name);
    }
    else {
      console.warn('rename: missing sheet', index);
    }

  }

  public async ReadStyles() {
    if (!this.zip) throw new Error('missing zip');
    const data = await this.zip.file('xl/styles.xml').async('text');
    this.style_cache.Init(data, this.theme);
  }

  public async ReadTheme() {
    if (!this.zip) throw new Error('missing zip');
    const file = this.zip.file('xl/theme/theme1.xml');
    if (file) {
      const data = await file.async('text');
      this.theme.Init(data);
    }
  }

  /**
   * break out strings table
   */
  public async ReadStringsTable(){

    if (!this.zip) throw new Error('missing zip');

    // simple unformatted strings have the structure <si><t>...</t></si>.
    // Formatted strings have the structure <si><r><rPr/><t>...</t></r></si>
    // with (potentially) multiple <r/> elements and formatting data in
    // the <rPr/> section inside each <r/>.

    const data = await this.zip.file('xl/sharedStrings.xml').async('text');

    // FOR NOW, let's just ignore complex strings.  we'll track
    // simple strings as before (but now with correct indexes).
    // FIXME.

    this.shared_strings.dom = ElementTree.parse(data);
    this.shared_strings.map = {};
    this.shared_strings.len = 0;

    this.shared_strings.dom.findall('./si').forEach((elt, idx) => {
      const children = elt.getchildren();
      if (children && children.length){
        const child = children[0];
        if (child.tag === 't' && child.text){
          this.shared_strings.map[child.text.toString()] = idx;
        }
      }
      this.shared_strings.len++;
    });

  }

  /**
   * read all sheets (async)
   */
  public async GetWorksheets(preparse = false){
    if (!this.zip) throw new Error('missing zip');

    for (const sheet of this.sheets) {
      if (sheet) {
        const rid = sheet.options.rid;
        if (rid) {
          sheet.path = `xl/${this.rels[rid].target}`;
          sheet.rels_path = sheet.path.replace('worksheets', 'worksheets/_rels') + '.rels';
          const data = await this.zip.file(sheet.path).async('text');
          sheet.xml = data;
          if (preparse) sheet.Parse();
        }
      }
    }

  }

  /**
   * finalize: rewrite xml, save in zip file.
   */
  public async Finalize(opts: any = {}){
    if (!this.zip) throw new Error('missing zip');
    if (!this.dom) throw new Error('missing dom');
    if (!this.rels_dom) throw new Error('missing rels_dom');

    if (this.shared_strings.dom) {
      const xml = this.shared_strings.dom.write({xml_declaration: true});
      await this.zip.file( 'xl/sharedStrings.xml', xml);
    }

    if (this.style_cache.modified && this.style_cache.dom) {
      const xml = this.style_cache.dom.write({xml_declaration: true});
      await this.zip.file( 'xl/styles.xml', xml);
    }

    await this.zip.file( 'xl/_rels/workbook.xml.rels', this.rels_dom.write({xml_declaration: true}));
    await this.zip.file( 'xl/workbook.xml', this.dom.write({xml_declaration: true}));

    if (opts.flushCalcChain || opts.flush){
      try {
        this.zip.remove('xl/calcChain.xml'); // what if it doesn't exist?
      }
      catch (e){
        console.warn(e);
      }
    }

    /*
    let single_color_style = false;

    for (const drawing of this.drawings) {

      drawing.Finalize();

    // this.path = `xl/drawings/drawing${index}.xml`;
    // this.rels_path = `xl/drawings/_rels/drawing${index}.xml.rels`;

      const index = drawing.index;
      let xml = drawing.dom.write({xml_declaration: true});
      await this.zip.file(`xl/drawings/drawing${index}.xml`, xml);

      xml = drawing.rels.write({xml_declaration: true}); 
      await this.zip.file(`xl/drawings/_rels/drawing${index}.xml.rels`, xml);

      xml = drawing.chart.write({xml_declaration: true}); 
      await this.zip.file(`xl/charts/chart${index}.xml`, xml);

      if (!single_color_style) {
        single_color_style = true;
        await this.zip.file(`xl/charts/colors1.xml`, Drawing.chart_colors);
        await this.zip.file(`xl/charts/style1.xml`, Drawing.chart_style);
      }

      await this.zip.file(`xl/charts/_rels/chart${index}.xml.rels`, Drawing.chart_rels);

    }
    */

    // for (const key of Object.keys(this.sheets)) {
    //  const sheet = this.sheets[key];
    for (const sheet of this.sheets) {
      if (sheet.dom && sheet.path){
        sheet.Finalize();
        const xml = sheet.dom.write({xml_declaration: true});
        // console.info('sheet xml', sheet.path, xml);
        await this.zip.file(sheet.path, xml);

        /*
        if (sheet.drawing_rels && sheet.rels_path) {
          await this.zip.file(sheet.rels_path, Drawing.SheetRels(sheet.drawing_rels));
        }
        */

      }
    }

  }

  /*
  public AddChart(): number {

    // ensure we have directory for drawings, charts

    // actually can we just create the documents? (...)

    const index = this.drawings.length + 1;
    this.drawings.push(new Drawing(index));



    return index;
  }
  */

  /**
   * clone sheet 0 so we have X total sheets
   */
  public InsertSheets(total_sheet_count: number) {
    if (!this.dom) throw new Error('missing dom');
    if (!this.rels_dom) throw new Error('missing rels_dom');

    let next_rel_index = 1;
    const NextRel = () => {
      while (true) {
        const rel = `rId${next_rel_index++}`;
        if (!this.rels[rel]) return rel;
      }
    };

    // for each sheet we add, we need to insert it in the list of
    // sheets (in workbook.xml) and insert a relationship (in
    // workbook.xml.rels).

    while (this.sheets.length < total_sheet_count) {

      const index = this.sheets.length;
      const path = `worksheets/sheet${index + 1}.xml`;
      const rel = NextRel();
      const type = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';

      console.info('inserting sheet', index);

      this.rels[rel] = {
        target: path,
        type,
        id: rel,
      };

      const relationship = ElementTree.SubElement(this.rels_dom.getroot(), 'Relationship');
      relationship.set('Id', rel);
      relationship.set('Type', type);
      relationship.set('Target', path);

      const name = 'Sheet' + (index + 1);

      const sheets = this.dom.find('./sheets');
      if (sheets) {
        const sheet_element = ElementTree.SubElement(sheets, 'sheet');
        sheet_element.set('name', name);
        sheet_element.set('sheetId', (index + 1).toString());
        sheet_element.set('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id', rel);
      }

      // insert sheet
      const worksheet = new Sheet({
        name,
        id: Number(index + 1),
        rid: rel });

      worksheet.shared_strings = this.shared_strings;
      worksheet.xml = this.sheets[0].xml;
      worksheet.path = 'xl/' + path;
      worksheet.rels_path = `xl/worksheets/_rels/sheet${index + 1}.xml.rels`;
      worksheet.Parse();

      this.sheets.push(worksheet);

    }

  }

  /**
   *
   */
  public async Init(zip?: JSZip, preparse = false){

    // let wb = this;
    if (zip) { this.zip = zip; }

    if (!this.zip) throw new Error('missing zip');

    // read rels
    let data = await this.zip.file( 'xl/_rels/workbook.xml.rels').async('text');

    this.rels_dom = ElementTree.parse(data);
    this.rels = {};

    this.rels_dom.findall('./Relationship').forEach((rel) => {
      const rid = rel.attrib.Id;
      if (rid) {
        this.rels[rid] = {
          id: rel.attrib.Id,
          type: rel.attrib.Type,
          target: rel.attrib.Target };
      }
    });

    // read workbook
    data = await this.zip.file('xl/workbook.xml').async('text');

    await this.ReadStringsTable();
    await this.ReadTheme();
    await this.ReadStyles();

    // create initial sheets; use relationship (rid) to map
    this.dom = ElementTree.parse(data);
    this.sheets = []; // {};

    this.dom.findall('./sheets/sheet').forEach((sheet) => {
      const name = sheet.attrib.name;
      if (name) {
        const worksheet = new Sheet({
          // wb: wb,
          name: sheet.attrib.name,
          id: Number(sheet.attrib.sheetId),
          rid: sheet.attrib['r:id']});
        
        worksheet.shared_strings = this.shared_strings;
        // this.sheets[name] = worksheet;
        this.sheets.push(worksheet);
      }
    });

    // await this.GetWorksheets(Object.keys(this.sheets).slice(0), preparse);
    await this.GetWorksheets(preparse);

  }

}
