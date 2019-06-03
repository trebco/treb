

import * as ElementTree from 'elementtree';
import { Element, ElementTree as Tree } from 'elementtree';
import { Sheet } from './sheet';
import { SharedStrings } from './shared-strings';
import { StyleCache } from './style';
import { Theme } from './theme';

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
  private sheets: {[index: string]: Sheet} = {};

  private dom?: Tree;
  private rels: {[index: string]: Relationship} = {};

  public GetSheet(sheet: string|number) {
    if (typeof sheet === 'string') return this.sheets[name];
    else return this.sheets[Object.keys(this.sheets)[0]];
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
  public async GetWorksheets(list: string[], preparse = false){
    if (!this.zip) throw new Error('missing zip');

    for (const name of list) {
      const sheet = this.sheets[name];
      if (sheet) {
        const rid = sheet.options.rid;
        if (rid) {
          sheet.path = `xl/${this.rels[rid].target}`;
          const data = await this.zip.file( sheet.path ).async('text');
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

    if (this.shared_strings.dom) {
      const xml = this.shared_strings.dom.write({xml_declaration: true});
      await this.zip.file( 'xl/sharedStrings.xml', xml);
    }

    if (this.style_cache.modified && this.style_cache.dom) {
      const xml = this.style_cache.dom.write({xml_declaration: true});
      await this.zip.file( 'xl/styles.xml', xml);
    }

    await this.zip.file( 'xl/workbook.xml', this.dom.write({xml_declaration: true}));

    if (opts.flushCalcChain || opts.flush){
      try {
        this.zip.remove('xl/calcChain.xml'); // what if it doesn't exist?
      }
      catch (e){
        console.warn(e);
      }
    }

    for (const key of Object.keys(this.sheets)) {
      const sheet = this.sheets[key];
      if (sheet.dom && sheet.path){
        sheet.Finalize();
        const xml = sheet.dom.write({xml_declaration: true});
        // console.info('sheet xml', sheet.path, xml);
        await this.zip.file(sheet.path, xml);
      }
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

    const etree = ElementTree.parse(data);
    this.rels = {};

    etree.findall('./Relationship').forEach((rel) => {
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
    this.sheets = {};

    this.dom.findall('./sheets/sheet').forEach((sheet) => {
      const name = sheet.attrib.name;
      if (name) {
        const worksheet = new Sheet({
          // wb: wb,
          name: sheet.attrib.name,
          id: Number(sheet.attrib.sheetId),
          rid: sheet.attrib['r:id']});
        
        worksheet.shared_strings = this.shared_strings;
        this.sheets[name] = worksheet;
      }
    });

    await this.GetWorksheets(Object.keys(this.sheets).slice(0), preparse);

  }

}
