
/**
 * switching to a different xml library, and trying to simplify how
 * we deal with XLSX files. 
 * 
 * the original impetus for the switch was CSP -- ElementTree uses eval 
 * (actually new Function(...)) which is blocked by CSP, and I don't want to 
 * allow it (or patch ET). so we swtiched to fast-xml-parser, but optimally we 
 * should not be reliant on the actual parser, if we can have some sort of 
 * common data structure.
 * 
 * in any event, in the old scheme we were constantly updating the XML tree
 * so we could write back. in the new scheme, we'll start from raw data, build
 * a structure, and then generate XML from that. 
 * 
 * the primary problems we are going to run into are namespacing and output
 * ordering, but we can probably get through it.
 * 
 * output ordering may be the hardest one, because different browsers. if 
 * necessary we can custom roll the js -> xml side.
 */


import { AddressType, RangeType, is_range } from './address-type';
import { SharedStrings } from './shared-strings2';
import { UnitCall } from 'treb-parser';
import { Drawing, TwoCellAnchor } from './drawing2/drawing2';
import { ChartOptions } from './drawing2/chart2';
import { RelationshipMap } from './relationship';

export interface SheetOptions {
  name?: string;
  id?: number;
  rid?: any;
}

export interface RangeOptions {
  merge?: boolean;
  style?: number;
  precalc?: boolean|string|number;
  preserveStyle?: boolean;
  type?: string;
  array?: string;
}

export enum VisibleState {
  visible,
  hidden,
  very_hidden,
}

export class Sheet {

  public path?: string;
  public rels_path?: string;
  // public rels_dom?: Tree;
  // public rels_data: any = {};
  public rels: RelationshipMap = {};

  public xml?: string;
  public rels_xml?: string;
  // public dom?: Tree;
  public sheet_data: any = {};

  public shared_strings?: SharedStrings;
  public extent?: RangeType;

  public visible_state?: VisibleState;

  public tab_selected = false;
  public default_width = 0;

  private column_widths?: number[];
  private column_styles?: number[];
  private default_column_style = -1;

  private tail_width = 0;
  // private column_style?: any;

  public drawings: Drawing[] = [];

  public next_relationship = 1;

  constructor(public options: SheetOptions = {}) {

  }

  /**
   * A1 -> {row: 1, col: 1} etc.
   * in the event of a range, { from: {}, to: {} }
   */
  public TranslateAddress(s: string): AddressType | RangeType {
    s = s.toUpperCase();
    let m = s.match(/([A-Z]+\d+):([A-Z]+\d+)/);
    if (m) {
      return {
        from: this.TranslateAddress(m[1]) as AddressType,
        to: this.TranslateAddress(m[2]) as AddressType,
      };
    }

    let row = 0;
    let col = 0;

    m = s.match(/^([A-Z]+)(\d+)$/);

    if (m) {
      row = Number(m[2]);
      col = 0;
      const len = m[1].length;
      for (let i = 0; i < len; i++) {
        const c = (m[1].charCodeAt(i) - 64);
        col = col * 26 + c;
      }
    }
    return { row, col };
  }

  /**
   * { row: 1, col: 1 } -> A1.
   * for ranges, {from: {}, to: {}} -> A1:B2
   */
  public Address(r: AddressType | RangeType, absolute = false): string {
    if (is_range(r)) {
      return this.Address(r.from, absolute) + ':' + this.Address(r.to, absolute);
    }
    let c = '';
    let col = r.col;
    while (col > 0) {
      const x = ((col - 1) % 26) + 1;
      c = String.fromCharCode(64 + x) + c;
      col = (col - x) / 26;
    }
    const s = r.sheet ? `'${r.sheet}'!` : '';
    if (absolute) {
      return `${s}$${c}$${r.row}`;
    }
    return s + c + r.row;
  }


  /**
   * convert an address (either style) to BOTH A1 and R1C1
   */
  public NormalizeAddress(rng: string | AddressType | RangeType): { a: string, rc: RangeType|AddressType } {
    let a: string;
    let rc: AddressType | RangeType;
    if (typeof rng === 'string') {
      a = rng.toUpperCase();
      rc = this.TranslateAddress(a);
    }
    else {
      rc = rng;
      a = this.Address(rc);
    }
    return { a, rc };
  }

  /*
  public ReadRels(): void {

    if (this.rels_dom) {
      return;
    }

    if (!this.rels_xml) {
      console.warn('missing rels xml');
      return;
    }

    this.rels_dom = ElementTree.parse(this.rels_xml);
    if (!this.rels_dom) {
      throw new Error('parsing rels dom failed');
    }

  }
  */

  public Parse() {

    // we can read column/row sizes in here, or anything else we need to do
    // atm just extent

    const dim = this.sheet_data.worksheet?.dimension?.a$?.ref;

    const extent = this.TranslateAddress(dim || '');
    if (is_range(extent)) {
      this.extent = JSON.parse(JSON.stringify(extent));
    }
    else {
      this.extent = {
        from: JSON.parse(JSON.stringify(extent)),
        to: JSON.parse(JSON.stringify(extent)),
      };
    }

  }

  /**
   * xml string -> dom, get dimension ref
   * /
  public Parse(): void {
    if (this.dom) return;
    if (!this.xml) throw new Error('sheet missing xml');

    this.dom = ElementTree.parse(this.xml);
    if (!this.dom) throw new Error('parsing dom failed');

    const dim = this.dom.find('./dimension');
    if (!dim) throw new Error('missing dimension');

    const extent = this.TranslateAddress(dim.attrib.ref || '');

    // ensure this is from, to; we can clean up later if ===
    if (is_range(extent)) {
      this.extent = JSON.parse(JSON.stringify(extent));
    }
    else {
      this.extent = {
        from: JSON.parse(JSON.stringify(extent)),
        to: JSON.parse(JSON.stringify(extent)),
      };
    }
  }
  */

  public Finalize(): void {
    throw new Error('ENOTIMPL');
    /*
    if (!this.dom) throw new Error('can\'t call finalize without parse');

    // tab selected
    const sheet_view = this.dom.find('./sheetViews/sheetView');
    if (sheet_view) {
      sheet_view.attrib.tabSelected = this.tab_selected ? '1' : '0';
    }

    // columns
    this.UnmapColumnWidths();

    // fix extent.  don't use a range for 1 cell.
    const dim = this.dom.find('./dimension');

    if (dim && this.extent) {
      if (this.extent.from.row === this.extent.to.row &&
        this.extent.from.col === this.extent.to.col) {
        dim.attrib.ref = this.Address(this.extent.from);
      }
      else {
        dim.attrib.ref = this.Address(this.extent);
      }
    }
    */
  }

  /** remove all merges */
  public ResetMerges(): void {
    throw new Error('ENOTIMPL');
    /*
    if (!this.dom) throw new Error('missing dom');

    const mc = this.dom.find(`./mergeCells`);
    if (!mc) {
      return;
    }

    const root = this.dom.getroot();
    (root as ExtendedElement)._children = (root as ExtendedElement)._children.filter((test: Element) => test !== mc);
    */
  }

  /**
   * this adds the mergeCells/mergeCell entry. you still (apparently) need
   * empty cell references for every cell in the merge area, so add those
   * (separately).
   *
   * NOTE order matters. must be after sheetData and before pageMargins.
   * FIXME: what about hyperlinks? (...)
   * 
   * @param range
   */
  public AddMerge(range: string): void {
    throw new Error('ENOTIMPL');
    /*
    if (!this.dom) throw new Error('missing dom');

    let mc = this.dom.find(`./mergeCells`);
    if (!mc) {
      // console.info('no mc found (adding)');

      mc = Element('mergeCells');
      const root = this.dom.getroot();
      const children = [];
      for (const child of (root as ExtendedElement)._children) {
        children.push(child);
        if (child.tag === 'sheetData') {
          children.push(mc);
        }
      }
      (root as ExtendedElement)._children = children;

    }

    const count = Number(mc.attrib.count || 0) + 1;
    mc.attrib.count = count.toString();

    const merge = ElementTree.SubElement(mc, 'mergeCell');
    merge.attrib.ref = range;
    */
  }

  /*
  public CreateRelationships(): ElementTree.ElementTree {
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
    return ElementTree.parse(rels);
  }
  */

  /**
   * this is part (3) from docs/charts.md -- add a chart node to sheet.
   * NOTE: we're basing the _rels number here on drawings only. should
   * switch to an internal counter... (done; we need it for hyperlinks too)
   */
  public AddChart(anchor: TwoCellAnchor, options: ChartOptions): void {
    throw new Error('ENOTIMPL');
    /*

    if (!this.dom) throw new Error('missing dom');

    let drawing = this.drawings[0];
    if (!drawing) {

      drawing = new Drawing(); // anchor, false, false, options);
      const relationship = this.next_relationship++;

      drawing.sheet_drawing_relationship = relationship;

      this.drawings.push(drawing);

      const drawing_node = Element('drawing');
      drawing_node.attrib['r:id'] = `rId${relationship}`;

      const root = this.dom.getroot();
      root.append(drawing_node);

      // create new rels if necessary
      if (!this.rels_dom) { 
        this.rels_dom = this.CreateRelationships();
      }

      ElementTree.SubElement(this.rels_dom.getroot(), 'Relationship', {
        Id: `rId${drawing.sheet_drawing_relationship}`,
        Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
        Target: `../drawings/drawing${drawing.index}.xml`,
      });

    }

    drawing.AddChart(options, anchor);
    */

  }
 
  /**
   * set range.  if the range is more than one cell, val can be either
   * a single value (repeated) or an array (2d).
   *
   * FIXME: support 1d array if the range is one-wide or one-deep.
   * just for convenience.
   *
   * opts: {
   *  ?style: val,
   *  ?preserveStyle: bool
   * }
   *
   */
  public SetRange(rng: AddressType | RangeType | string, val: any, options: RangeOptions = {}): void {

    throw new Error('ENOTIMPL');
    /*

    const { a, rc } = this.NormalizeAddress(rng);

    if (is_range(rc)) {

      rc.from = this.NormalizeAddress(rc.from).rc as AddressType;
      rc.to = this.NormalizeAddress(rc.to).rc as AddressType;

      // split just so we don't have to repeat the test

      if (null != val && Array.isArray(val)) { // IE11? [A: yes]
        let sr = 0;
        for (let r = rc.from.row; r <= rc.to.row; r++ , sr++) {
          let sc = 0;
          for (let c = rc.from.col; c <= rc.to.col; c++ , sc++) {
            this.SetRange({ row: r, col: c }, val[sr][sc], options);
          }
        }
      }
      else {
        for (let r = rc.from.row; r <= rc.to.row; r++) {
          for (let c = rc.from.col; c <= rc.to.col; c++) {
            this.SetRange({ row: r, col: c }, val, options);
          }
        }
      }
      return;
    }

    if (typeof val === 'undefined' && !options.merge && (options.precalc === undefined) && typeof options.style !== 'undefined') {
      // console.info('decorated, setting empty string', rng);
      val = '';
    }

    const remove = (val == null && // note == null matches undefined as well
      (typeof options.merge === 'undefined') &&
      (typeof options.style === 'undefined') &&
      (typeof options.precalc === 'undefined'));

    if (!remove) this.EnsureExtent(rc);

    let row = this.dom.find(`./sheetData/row/[@r="${rc.row}"]`) as ExtendedElement;
    if (!row) {
      if (remove) {
        return; // ok
      }

      // add row. FIXME: spans
      const sheet_data = this.dom.find('./sheetData');
      if (sheet_data) {
        row = ElementTree.SubElement(sheet_data, 'row') as ExtendedElement;
        row.set('r', String(rc.row));

        // sort rows
        (sheet_data as ExtendedElement)._children.sort((a: Element, b: Element) => {
          return Number(a.attrib.r) - Number(b.attrib.r);
        });
      }
    }

    if (!row) throw new Error('adding row failed');

    // removing?
    if (remove) {
      row._children = row._children.filter((child: Element) => {
        return !(child.tag === 'c' && child.attrib.r === a);
      });
      return;
    }

    let cell = row.find(`c/[@r="${a}"]`) as ExtendedElement;
    if (!cell) {

      // add cell
      cell = ElementTree.SubElement(row, 'c') as ExtendedElement;
      cell.set('r', a);

      // sort cols.  can we cache these values somewhere?
      row._children.sort((a: Element, b: Element) => {
        const arc = this.TranslateAddress(a.attrib.r || '');
        const brc = this.TranslateAddress(b.attrib.r || '');
        return (arc as AddressType).col - (brc as AddressType).col;
      });

    }

    if (options.merge && !val) {
      console.info('exiting on merge and !value');
      return;
    }

    cell._children = [];
    cell.tail = null;

    // FIXME: I don't think this is necessary for s="0"

    if (typeof options.style !== 'undefined') {
      cell.attrib.s = options.style.toString();
    }
    else if (options.preserveStyle || (typeof options.preserveStyle === 'undefined')) {
      // do nothing
    }
    else {
      delete cell.attrib.s;
    }

    if (cell.attrib.t) delete (cell.attrib.t);

    if (typeof val === 'undefined' && options.precalc !== undefined) {
      val = options.precalc;
    }

    if (options.type === 'string' || isNaN(val)) { // test for string (vs. number)

      if (val[0] === '=') {
        const f = ElementTree.SubElement(cell, 'f');
        f.text = val.substr(1);
        if (options.array) {
          f.attrib.t = 'array';
          f.attrib.ref = options.array;
        }
        if (typeof options.precalc !== 'undefined') {
          val = options.precalc;
          if (typeof val === 'string') {
            cell.attrib.t = 'str';
          }
          else if (typeof val === 'boolean') {
            cell.attrib.t = 'b';
            val = val ? 1 : 0;
          }
        }
        else {
          return;
        }
      }
      else if (typeof options.precalc !== 'undefined') {
        if (typeof val === 'string') {
          cell.attrib.t = 'str';
        }
      }
      else if (this.shared_strings) {

        if (val[0] === '\'') {
          val = val.slice(1);
        }

        val = this.shared_strings.Ensure(val); // , opts.rPr);
        cell.attrib.t = 's';
      }
    }
    else if (typeof val === 'boolean') {
      cell.attrib.t = 'b';
      val = val ? 1 : 0;
    }

    const v = ElementTree.SubElement(cell, 'v');

    // set string 0 on value 0, otherwise xml lib will drop
    // FIXME: this might be genericized into always using strings.

    v.text = (val === 0 ? '0' : val);

    */

  }

  /**
   * pad out the "dimension" to ensure excel reads all the data.
   * this will get written on finalize().
   */
  public EnsureExtent(rc: AddressType): void {
    if (!this.extent) {
      throw new Error('missing extent');
    }

    this.extent.from.row = Math.min(this.extent.from.row, rc.row);
    this.extent.from.col = Math.min(this.extent.from.col, rc.col);

    this.extent.to.row = Math.max(this.extent.to.row, rc.row);
    this.extent.to.col = Math.max(this.extent.to.col, rc.col);
  }

  /**
   * remove cache.  will force update.
   */
  public RemoveCache(rng: AddressType | RangeType): void {

    throw new Error('ENOTIMPL');
    /*

    if (!this.dom) throw new Error('missing dom');

    const { a, rc } = this.NormalizeAddress(rng);
    if (is_range(rc)) {
      for (let r = rc.from.row; r <= rc.to.row; r++) {
        for (let c = rc.from.col; c <= rc.to.col; c++) {
          this.RemoveCache({ row: r, col: c });
        }
      }
      return;
    }

    const row = this.dom.find(`./sheetData/row/[@r="${rc.row}"]`);
    if (!row) {
      return;
    }

    const cell = row.find(`c/[@r="${a}"]`) as ExtendedElement;
    if (!cell) {
      return;
    }

    cell._children = cell._children.filter((child: Element) => {
      return (child.tag !== 'v');
    });
    */

  }


  /** 
   * updated to use the table
   * 
   * FIXME: why undefined? should return default. also, what's up with
   * both tail and default?
   */
  public GetColumnWidth(col: number): number|undefined {
    this.MapColumnWidths();
    if (this.column_widths) {
      if (col >= this.column_widths.length) return this.tail_width;
      return this.column_widths[col];
    }
  }

  /**
   * set row height. does not do anything if the row does not exist,
   * so call this after creating data.
   *
   * FIXME: make it work for empty rows
   */
  public SetRowHeight(row: number, height: number): void {
    throw new Error('ENOTIMPL');
    /*
    if (this.dom) {
      const element = this.dom.find(`./sheetData/row/[@r="${row}"]`);
      if (element) {
        element.attrib.ht = height.toString();
        element.attrib.customHeight = '1';
      }
    }
    */
  }

  public AddValidations(validations: Array<{
      row: number,
      column: number,
      // validation: DataValidation,
      formula: string,
    }>): void {

    throw new Error('ENOTIMPL');
    /*

    if (!this.dom) { return; }

    let container = this.dom.find('./dataValidations');
    if (!container) {

      // this has to be BEFORE pageMargins.

      container = Element('dataValidations');

      const root = this.dom.getroot();
      const children = [];
      for (const child of (root as ExtendedElement)._children) {
        children.push(child);
        if (child.tag === 'sheetData') {
          children.push(container);
        }
      }
      (root as ExtendedElement)._children = children;

    }

    for (const validation of validations) {

      const element = ElementTree.SubElement(container, 'dataValidation', {
        type: 'list',
        allowBlank: '1',
        showInputMessage: '1',
        showErrorMessage: '1',
        sqref: this.Address({row: validation.row, col: validation.column}),
        // 'xr:uid': '{A8CDB049-08EC-4F94-ABD3-DDB8FE664C33}',
      });

      const formula = ElementTree.SubElement(element, 'formula1');
      formula.text = validation.formula;
      
    }

    container.set('count', container.getchildren().length.toString());
    */

  }

  public AddHyperlinks(links: Array<{
      row: number;
      column: number;
      text: string;
      reference: string;
    }>): void {

    throw new Error('ENOTIMPL');
    /*

    if (!this.dom) {
      return;
    }

    let hyperlinks_node = this.dom.find('./hyperlinks');
    if (!hyperlinks_node) {

      // have to ensure that it gets put after "sheetData" and before "pageMargins"
      // or it will _not_ work. 
      //
      // FIXME: what about mergeCells, which has the same issue?

      hyperlinks_node = Element('hyperlinks');
      const root = this.dom.getroot();
      const children = [];
      for (const child of (root as ExtendedElement)._children) {
        children.push(child);
        if (child.tag === 'sheetData') {
          children.push(hyperlinks_node);
        }
      }
      (root as ExtendedElement)._children = children;

    }

    for (const link of links) {

      const ref = this.Address({row: link.row, col: link.column});

      if (/^https{0,1}:\/\//i.test(link.reference)) {

        // external URL

        // create element
        const relationship = this.next_relationship++;
        ElementTree.SubElement(hyperlinks_node, 'hyperlink', {
          ref,
          'r:id': `rId${relationship}`,
        });

        // create new rels if necessary
        if (!this.rels_dom) { 
          this.rels_dom = this.CreateRelationships();
        }

        // add relationship
        ElementTree.SubElement(this.rels_dom.getroot(), 'Relationship', {
          Id: `rId${relationship}`,
          Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
          Target: link.reference,
          TargetMode: 'External',
        });

      }
      else {

        // document reference

        // create element
        ElementTree.SubElement(hyperlinks_node, 'hyperlink', {
          ref,
          location: link.reference, // target
          display: link.text,
        });

      }
    }

    */

  }

  public AddSparklines(expressions: Array<{
    expression: UnitCall;
    row: number;
    column: number;
    reference: string;
    }>): void {

    throw new Error('ENOTIMPL');
    /*

    if (!this.dom) { return; }

    //console.info(expressions);

    let extLst = this.dom.find('./extLst');
    if (!extLst) {
      extLst = ElementTree.SubElement(this.dom.getroot(), 'extLst');
    }

    const ext = ElementTree.SubElement(extLst, 'ext', {
      uri: '{05C60535-1F16-4fd2-B633-F4F36F0B64E0}',
      'xmlns:x14': 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main',
      });

    const groups = ElementTree.SubElement(ext, 'x14:sparklineGroups', {
      'xmlns:xm': 'http://schemas.microsoft.com/office/excel/2006/main',
      });

    for (const element of expressions) {
      const group = ElementTree.SubElement(groups, 'x14:sparklineGroup', {
        displayEmptyCellsAs: 'gap',
        'xr2:uid': '{A7934558-D60A-4B70-ABDB-3FEABAFEBB5B}',
        });

      if (element.expression.name.toLowerCase() === 'sparkline.column') {
        group.set('type', 'column');
      }
     

      ElementTree.SubElement(group, 'x14:colorSeries', {rgb: 'FF376092'});
      ElementTree.SubElement(group, 'x14:colorNegative', {rgb: 'FFD00000'});

      ElementTree.SubElement(group, 'x14:colorAxis', {rgb: 'FF000000'});
      ElementTree.SubElement(group, 'x14:colorMarkers', {rgb: 'FFD00000'});
      ElementTree.SubElement(group, 'x14:colorFirst', {rgb: 'FFD00000'});
      ElementTree.SubElement(group, 'x14:colorLast', {rgb: 'FFD00000'});
      ElementTree.SubElement(group, 'x14:colorHigh', {rgb: 'FFD00000'});
      ElementTree.SubElement(group, 'x14:colorLow', {rgb: 'FFD00000'});

      const sparklines = ElementTree.SubElement(group, 'x14:sparklines');
      const sparkline = ElementTree.SubElement(sparklines, 'x14:sparkline');
      const f = ElementTree.SubElement(sparkline, 'xm:f');

      if (/!/.test(element.reference)) {
        f.text = element.reference; 
      }
      else {
        let name = this.options.name || '';
        if(/[\s]/.test(name)) { name = '"' + name + '"'; }
        f.text = name + '!' + element.reference;
      }

      const sqref = ElementTree.SubElement(sparkline, 'xm:sqref');
      sqref.text = this.Address({row: element.row, col: element.column});

    }

    */

  }

  public SetDefaultColumnStyle(style: number): void {
    this.default_column_style = style;
  }

  public SetRowStyleIndex(rows: number|number[], style: number): void {

    throw new Error('ENOTIMPL');
    /*

    if (!this.dom) { 
      throw new Error('missing dom'); 
    }

    if (!Array.isArray(rows)) { 
      rows = [rows]; 
    }

    const sheet_data = this.dom.find('./sheetData');
    let sort = false;

    for (const index of rows) {

      let row = this.dom.find(`./sheetData/row/[@r="${index}"]`);

      if (!row) {
        if (sheet_data) {
          row = ElementTree.SubElement(sheet_data, 'row');
          row.set('r', index.toString());
          sort = true;
        }
      }

      row?.set('customFormat', '1');
      row?.set('s', style.toString());

    }

    if (sort) {
      // sort rows
      (sheet_data as ExtendedElement)._children.sort((a: Element, b: Element) => {
        return Number(a.attrib.r) - Number(b.attrib.r);
      });
    }

    */

  }

  public SetColumnStyleIndex(columns: number|number[], style: number): void {

    if (!this.column_styles) {
      this.column_styles = [];
    }

    if (!Array.isArray(columns)) { columns = [columns]; }

    for (const column of columns) {
      this.column_styles[column] = style;
    }

  }

  /** 
   * updated to use the table
   */
  public SetColumnWidth(col: number | number[], width: number): void {
    this.MapColumnWidths();
    if (this.column_widths) {
      if (Array.isArray(col)) {
        for (const c of col) this.column_widths[c] = width;
      }
      else this.column_widths[col] = width;
    }
  }


  /**
   * unmap column widths from the table
   * UPDATE: use style, too
   */
  public UnmapColumnWidths(): void {

    throw new Error('ENOTIMPL');
    /*

    if (!this.column_widths || !this.column_widths.length) {
      return; // not necessary
    }

    if (!this.dom) {
      throw new Error('missing dom');
    }

    let cols = this.dom.find('./cols') as ExtendedElement;
    if (!cols) {
      cols = Element('cols') as ExtendedElement;
      const root = this.dom.getroot();
      const children = [];
      for (const child of (root as ExtendedElement)._children) {
        if (child.tag === 'sheetData') {
          children.push(cols);
        }
        children.push(child);
      }
      (root as ExtendedElement)._children = children;
    }

    cols._children = [];

    let col;
    let start = 1;
    let width = typeof this.column_widths[1] === 'undefined' ?
      this.default_width : this.column_widths[1];

    // so this is written as blocks of columns of the same width,
    // finishing with a block that ends in column 16384.
    // columns are 1-based.

    const blocks: Array<{ 
      min: number; 
      max: number; 
      width: number; }> = [];

    let max = this.column_widths.length;
    if (this.extent) max = Math.max(this.extent.to.col, max);

    for (col = 1; col < max; col++) {
      let cmp = this.column_widths[col];
      if (null == cmp) cmp = this.default_width;
      if (cmp !== width) {
        blocks.push({ min: start, max: col - 1, width });
        width = cmp;
        start = col;
      }
    }

    if (width !== this.default_width) {
      blocks.push({ min: start, max: start, width });
      blocks.push({ min: max, max: 16384, width: this.default_width });
    }
    else {
      blocks.push({ min: start, max: 16384, width });
    }

    for (const block of blocks) {

      const node = Element('col', {
        min: block.min.toString(),
        max: block.max.toString(),
        width: block.width.toString(), // style: this.column_style,
      });

      // if (typeof this.column_style !== 'undefined') node.attrib.style = this.column_style;
      
      if (this.default_column_style >= 0) {
        node.attrib.style = this.default_column_style.toString();
      }

      if (width !== this.default_width) {
        node.attrib.customWidth = '1';
        if (width === 0) node.attrib.hidden = '1';
      }
      cols._children.push(node);

    }
    */

  }

  /**
   * cache these to simplify processing.  we'll need to rebuild in finalize().
   */
  public MapColumnWidths(): void {

    console.warn('PENDING');

    /*

    if (this.column_widths) return;
    // if (!this.dom) throw new Error('missing dom');

    // create an empty slot for zero, so indexes match columns
    this.column_widths = [0];

    // set default tail width: may not be set otherwise
    this.tail_width = 9.140625;

    const cols = this.dom.find('./cols') as ExtendedElement;
    let default_width_set = false;

    if (!cols) {
      this.column_widths = [];
      this.default_width = 10; // 9.140625;
      this.tail_width = this.default_width;
      return;
    }

    for (const col of cols._children) {

      if (null != col.attrib.style) {
        //if (this.column_style && this.column_style !== col.attrib.style) {
        //  console.warn(' ** multiple column styles');
        //}
        this.default_column_style = Number(col.attrib.style);
      }

      const min = Number(col.attrib.min || 0);
      const max = Number(col.attrib.max || 0);
      const width = Number(col.attrib.width || 0);

      if (null == col.attrib.customWidth) { // allow 0
        if (this.default_width && this.default_width !== width) {
          console.warn('Multiple default widths?', this.default_width, width);
        }
        this.default_width = width;
        default_width_set = true;
      }

      if (max === 16384) {
        this.tail_width = width;
      }
      else {
        for (let i = min; i <= max; i++) this.column_widths[i] = width;
      }

    }

    if (!default_width_set) this.default_width = 9.140625;

    */

  }

}