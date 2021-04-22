
import * as JSZip from 'jszip';
import * as ElementTree from 'elementtree';
import { AnchoredChartDescription, ChartType, Workbook } from './workbook';
import { ImportedSheetData, AnchoredAnnotation, CellParseResult, ValueType, AnnotationLayout, Corner as LayoutCorner } from 'treb-base-types';
import { Sheet, VisibleState } from './sheet';
import { is_range, RangeType, ShiftRange, InRange, AddressType, is_address, HyperlinkType } from './address-type';
import { Parser, ParseResult } from 'treb-parser';
import { CellAnchor } from './drawing/drawing';
// import { Style } from 'treb-base-types';

interface SharedFormula {
  row: number;
  column: number;
  formula: string;
  parse_result: ParseResult;
}

interface SharedFormulaMap {[index: string]: SharedFormula }

/** excel HORIZONTAL units (vertical is different? seems to be 4/3) */
const one_hundred_pixels = 14.28515625;

export class Importer {

  // instance
  public parser = new Parser();

  // tslint:disable-next-line:variable-name
  public archive_!: JSZip;

  public workbook!: Workbook;

  public set zip(archive: JSZip) {
    this.archive_ = archive;
  }

  public get zip(): JSZip {
    return this.archive_;
  }

  public async Init(data: string|JSZip): Promise<void> {

    if (typeof data === 'string') {
      this.archive_ = await JSZip().loadAsync(data);
    }
    else {
      this.archive_ = data;
    }

    this.workbook = new Workbook();
    await this.workbook.Init(this.archive_, undefined, true);
    
  }

  public ParseCell(
      sheet: Sheet,
      element: ElementTree.Element,
      shared_formulae: SharedFormulaMap,
      arrays: RangeType[],
      merges: RangeType[],
      links: HyperlinkType[]): CellParseResult|undefined {

    // must have, at minimum, an address (must be a single cell? FIXME)
    const address_attr = element.attrib.r;
    if (!address_attr) {
      console.warn('cell missing address');
      return undefined;
    }

    const address = sheet.TranslateAddress(address_attr);
    if (is_range(address)) {
      console.warn('cell has range address');
      return undefined;
    }

    // console.info(element);

    let value: undefined|number|boolean|string;
    let type: ValueType = ValueType.undefined;

    let calculated_value: undefined|number|boolean|string;
    let calculated_type: ValueType = ValueType.undefined;

    // assuming we have single element per tag...

    const mapped: {[index: string]: ElementTree.Element} = {};
    for (const child of element.getchildren()) {
      if (child.tag) mapped[child.tag.toString()] = child;
    }

    // console.info(address, 'e', element, 'm', mapped);

    if (element.attrib.t && element.attrib.t === 's') {
      type = ValueType.string;
      if (mapped.v && mapped.v.text) {
        const index = Number(mapped.v.text);
        if (!isNaN(index) && sheet.shared_strings) {
          value = sheet.shared_strings.GetSharedString(index) || '';
          if (value[0] === '=') { value = '\'' + value; }
        }
      }
    }
    else {
      if (mapped.f) {
        type = ValueType.formula;
        if (mapped.f.text) {

          // doing it like this is sloppy (also does not work properly).
          value = '=' + mapped.f.text.toString().replace(/^_xll\./g, '');

          const parse_result = this.parser.Parse(mapped.f.text.toString()); // l10n?
          if (parse_result.expression) {
            this.parser.Walk(parse_result.expression, (unit) => {
              if (unit.type === 'call' && /^_xll\./.test(unit.name)) {
                unit.name = unit.name.substr(5);
              }
              return true;
            });
            value = '=' + this.parser.Render(parse_result.expression, undefined, '');
          }

          if (mapped.f.attrib.t === 'shared' && mapped.f.attrib.si) {
            shared_formulae[mapped.f.attrib.si] = {
              row: address.row - 1,
              column: address.col - 1,
              formula: value,
              parse_result: this.parser.Parse(value),
            };
          }
        }
        else if (mapped.f.attrib.t === 'shared' && mapped.f.attrib.si) {
          const f = shared_formulae[mapped.f.attrib.si];
          if (f) {
            if (f.parse_result.expression) {
              value = '=' + this.parser.Render(f.parse_result.expression, {
                rows: address.row - 1 - f.row,
                columns: address.col - 1 - f.column,
              }, '');
            }
            else value = f.formula;
          }
          else {
            // console.info("MISSING SHARED", mapped.f.attrib.si);
          }
        }

        if (mapped.f.attrib.t === 'array') {
          const translated = sheet.TranslateAddress(mapped.f.attrib.ref || '');
          if (is_range(translated)) {
            arrays.push(ShiftRange(translated, -1, -1));
          }
        }

        if (mapped.v && mapped.v.text) {
          const num = Number(mapped.v.text.toString());
          if (!isNaN(num)) {
            calculated_type = ValueType.number;
            calculated_value = num;
          }
          else {
            calculated_type = ValueType.string;
            calculated_value = mapped.v.text.toString();
          }
        }

      }
      else if (mapped.v && mapped.v.text) {
        const num = Number(mapped.v.text.toString());
        if (!isNaN(num)) {
          type = ValueType.number;
          value = num;
        }
        else {
          type = ValueType.string;
          value = mapped.v.text.toString();
        }
      }
    }

    const shifted: AddressType = {row: address.row - 1, col: address.col - 1};

    // check if we are in an array. we're relying on the fact that 
    // the array head is the top-left, which I _think_ is universal,
    // but perhaps we should check that... although at this point we have 
    // already added the array so we need to check for root

    for (const array of arrays) {
      if (InRange(array, shifted) && (shifted.row !== array.from.row || shifted.col !== array.from.col)) {
        calculated_type = type;
        calculated_value = value;
        value = undefined;
        type = ValueType.undefined;
      }
    }

    const result: CellParseResult = {
      row: shifted.row, column: shifted.col, value, type,
    };

    if (typeof calculated_value !== 'undefined') {
      result.calculated_type = calculated_type;
      result.calculated = calculated_value;
    }

    if (element.attrib.s) {
      result.style_ref = Number(element.attrib.s);
    }

    for (const link of links) {
      if (link.address.row === address.row && link.address.col === address.col) {
        result.hyperlink = link.reference;
        // FIXME: pop?
      }
    }

    for (const range of merges) {
      if (InRange(range, shifted)) {
        result.merge_area = {
          start: {
            row: range.from.row,
            column: range.from.col,
          }, end: {
            row: range.to.row,
            column: range.to.col,
          },
        };
      }
    }

    for (const range of arrays) {
      if (InRange(range, shifted)) {
        result.area = {
          start: {
            row: range.from.row,
            column: range.from.col,
          }, end: {
            row: range.to.row,
            column: range.to.col,
          },
        };
        /*
        if (shifted.col !== range.from.col || shifted.row !== range.from.row) {
          result.value = undefined;
          result.type = ValueType.undefined;
        }
        */
      }
    }

    return result;

  }

  public SheetCount(): number {
    return this.workbook.Count();
  }

  public async GetSheet(index = 0): Promise<ImportedSheetData> {

    const sheet = this.workbook.GetSheet(index);
    sheet.Parse();
    if (!sheet.dom) throw new Error('missing DOM');

    // console.info(sheet.options.name);

    // we want a sparse array

    const data: CellParseResult[] = [];
    const shared_formulae: {[index: string]: SharedFormula} = {};
    const arrays: RangeType[] = [];
    const merges: RangeType[] = [];
    const links: HyperlinkType[] = [];
    const annotations: AnchoredAnnotation[] = [];



    const merge_cells = sheet.dom.find('./mergeCells');
    if (merge_cells) {
      for (const child of merge_cells.getchildren()) {
        if (child.tag === 'mergeCell' && child.attrib.ref) {
          const merge = sheet.TranslateAddress(child.attrib.ref);
          if (is_range(merge)) {
            merges.push(ShiftRange(merge, -1, -1));
          }
        }
      }
    }

    const hyperlinks = sheet.dom.find('./hyperlinks');

    if (hyperlinks) {
      for (const child of hyperlinks.getchildren()) {

        let address = sheet.TranslateAddress(child.attrib.ref || '');
        if (is_range(address)) {
          address = address.from;
        }

        let text = '';
        let reference = '';

        if (child.attrib['r:id']) {

          text = 'remote link';
          reference = '';

          if (!sheet.rels_dom) {
            sheet.ReadRels();
          }

          if (sheet.rels_dom) {
            const relationship = sheet.rels_dom.find(`./Relationship[@Id='${child.attrib['r:id']}']`);
            if (relationship) {
              reference = relationship.attrib.Target || '';
            }
          }
          else {
            console.warn('missing rels dom!');
          }

        }
        else {
          reference = child.attrib.location || '';
          text = child.attrib.display || '';
        }

        links.push({ address, reference, text });
      }
    }

    // let max_column = 0;
    const row_heights: number[] = [];

    if (sheet.extent) {
      for (let r = sheet.extent.from.row; r <= sheet.extent.to.row; r++) {
        const row = sheet.dom.find(`./sheetData/row/[@r="${r}"]`);
        if (row) {

          if (row.attrib.ht && row.attrib.customHeight) {
            const num = Number(row.attrib.ht);
            if (!isNaN(num)) {
              row_heights[r - 1] = Math.round(num * 4 / 3); // seems to be the excel unit -> pixel ratio
            }
          }

          for (const child of row.getchildren()) {
            const cell = this.ParseCell(sheet, child, shared_formulae, arrays, merges, links);
            if (cell) {
              data.push(cell);
              // max_column = Math.max(max_column, cell.column); // use extent
            }
          }
        }
      }
    }

    let default_row_height = 21;
    let default_column_width = 100;

    const sheet_format = sheet.dom.find('./sheetFormatPr');
    if (sheet_format) {
      if (sheet_format.attrib.defaultColWidth) {
        // defaultColWidth="14.28515625" defaultRowHeight="15" x14ac:dyDescent="0.25"/>
        const width = Number(sheet_format.attrib.defaultColWidth);
        if (!isNaN(width)) {
          default_column_width = Math.round(width / one_hundred_pixels * 100);
        }
      }
      if (sheet_format.attrib.defaultRowHeight) {
        const height = Number(sheet_format.attrib.defaultRowHeight);
        if (!isNaN(height)) {
          default_row_height = Math.round(height * 4 / 3); // ??
        }
      }
    }

    const column_styles: number[] = [];
    let default_column_style = -1;

    const column_widths: number[] = [];
    const columns = sheet.dom.find(`./cols`);
    if (columns) {
      for (const child of columns.getchildren()) {
        if (child.tag === 'col') {
          if (child.attrib.style) {
            // console.info("COLUMN STYLE", child);

            const style = Number(child.attrib.style);
            const min = Number(child.attrib.min);
            const max = Number(child.attrib.max);

            if (!isNaN(min) && !isNaN(max) && !isNaN(style)) {

              // this is not the way to do this? for the time being
              // it's OK because style doesn't need to extend past
              // extent (but width does)

              if (sheet.extent && max >= sheet.extent.to.col || max - min > 100) { // just spitballing on that last one
                default_column_style = style;
              }
              else {
                for (let i = min; i <= max; i++) {
                  column_styles[i] = style;
                }
              }

            }

          }
          if (child.attrib.customWidth) {

            const min = Number(child.attrib.min);
            const max = Number(child.attrib.max);
            let width = Number(child.attrib.width);

            if (!isNaN(min) && !isNaN(max) && !isNaN(width)) {

              if (max === 16384) {

                // ...
              }
              else {

                // otherwise it will set -> 16384
                // if (sheet.extent) {
                // max = Math.min(max, sheet.extent.to.col + 1);
                // }

                width = Math.round(width / one_hundred_pixels * 100);
                for (let i = min; i <= max; i++) column_widths[i - 1] = width;
              }
            }

          }
        }
      }
      
    }

    // annotations (charts)


    // wip...

    const drawings = sheet.dom.findall('./drawing');
    
    const chart_descriptors: AnchoredChartDescription[] = [];

    if (drawings && drawings.length) {
      for (const child of drawings) {

        if (child.attrib['r:id']) {

          let reference = '';

          if (!sheet.rels_dom) {
            sheet.ReadRels();
          }

          if (sheet.rels_dom) {
            const relationship = sheet.rels_dom.find(`./Relationship[@Id='${child.attrib['r:id']}']`);
            if (relationship) {
              reference = relationship.attrib.Target || '';
            }
          }
          else {
            console.warn('missing rels dom!');
          }

          if (reference) {
             const drawing = await this.workbook.ReadDrawing(reference);
             if (drawing && drawing.length) {
               chart_descriptors.push(...drawing);
             }
          }
        }
      }
    }

    const AnchorToCorner = (anchor: CellAnchor): LayoutCorner => {

      const result: LayoutCorner = {
        address: {
          row: anchor.row, 
          column: anchor.column,
        },
        offset: {
          x: 0, // anchor.column_offset || 0, // FIXME: scale
          y: 0, // anchor.row_offset || 0,    // FIXME: scale
        },
      };

      if (anchor.row_offset) {
        let row_height = row_heights[anchor.row];
        if (row_height === undefined) {
          row_height = default_row_height; // FIXME
        }
        result.offset.y = (anchor.row_offset / 9525) / row_height;
      }

      if (anchor.column_offset) {
        let column_width = column_widths[anchor.column];
        if (column_width === undefined) {
          column_width = default_column_width;
        }
        result.offset.x = (anchor.column_offset / 9525) / column_width;
      }

      return result;

    };

    for (const descriptor of chart_descriptors) {
      if (descriptor && descriptor.chart) {

        // convert the anchor to the annotation type

        const layout: AnnotationLayout = {
          tl: AnchorToCorner(descriptor.anchor.from),
          br: AnchorToCorner(descriptor.anchor.to),
        };

        let type: string|undefined;
        const args: Array<string|undefined> = [];
        let func = '';        
        const series = descriptor.chart?.series;

        switch(descriptor.chart.type) {
          case ChartType.Scatter:
            type = 'treb-chart';
            func = 'Scatter.Line';
            if (series && series.length) {
              args[0] = `Group(${series.map(s => `Series(${s.title || ''},${s.categories||''},${s.values||''})` || '').join(', ')})`;
            }
            args[1] = descriptor.chart.title;
            break;

          case ChartType.Donut:
          case ChartType.Pie:

            func = descriptor.chart.type === ChartType.Donut ? 'Donut.Chart' : 'Pie.Chart';
            type = 'treb-chart';
            if (series && series[0]) {
              args[0] = series[0].values;
              args[1] = series[0]?.categories || '';
            }
            args[2] = descriptor.chart.title;
            break;

          case ChartType.Bar:
          case ChartType.Column:
          case ChartType.Line:

            args[2] = descriptor.chart.title;
            type = 'treb-chart';
            switch (descriptor.chart.type) {
              case ChartType.Bar:
                func = 'Bar.Chart';
                break;
              case ChartType.Column:
                func = 'Column.Chart';
                break;
              default:
                func = 'Line.Chart';
            }

            if (series) {
              if (series.length > 1) {
                args[0] = `Group(${series.map(s => `Series(${s.title || ''},,${s.values||''})` || '').join(', ')})`;
              }
              else if (series.length === 1) {
                if (series[0].title) {
                  args[0] = `Series(${series[0].title || ''},,${series[0].values||''})`;
                }
                else {
                  args[0] = series[0].values;
                }
              }
              args[1] = series[0]?.categories || '';
            }

            break;
        }

        const formula = `=${func}(${args.join(', ')})`;
        console.info('f', formula);

        if (type && formula) {
          annotations.push({
            layout,
            type,
            formula,
          });
        }

      }
    }

    // /wip

    // we can't look these up directly because of namespacing, which
    // isn't properly supported... (...)

    const ext = sheet.dom.find('./extLst/ext');
    if (ext) {
      for (const child1 of ext.getchildren()) {
        for (const child2 of child1.getchildren()) {
          if (/sparklineGroup$/.test(child2.tag.toString())) {
            let func = 'Sparkline.line';
            let reference = '';
            let source = '';

            switch (child2.get('type')) {
            case 'column':
              func = 'Sparkline.column';
              break;
            }

            // TODO: gap optional
            // TODO: colors

            for (const child3 of child2.getchildren()) {
              /*
              if (/colorSeries$/.test(child3.tag.toString())) {
                const rgb = child3.get('rgb');
                console.info('series', rgb);
              }
              else if (/colorNegative$/.test(child3.tag.toString())) {
                const rgb = child3.get('rgb');
                console.info('negative', rgb);
              }
              */
              if (/sparklines$/.test(child3.tag.toString())) {
                for (const child4 of child3.getchildren()) {
                  if (/sparkline$/.test(child4.tag.toString())) {
                    for (const child5 of child4.getchildren()) {

                      if (/(?:^|:)f$/.test(child5.tag.toString())) {
                        source = child5.text ? child5.text.toString() : '';
                      }
                      else if (/sqref$/.test(child5.tag.toString())) {
                        reference = child5.text ? child5.text.toString() : '';
                      }
                    }
                  }
                }
              }
            }

            if (source && reference) {
              const constructed_function = `=${func}(${source})`; 

              // 1: merges
              // 2: maybe already in the list? need to filter

              const translated = sheet.TranslateAddress(reference);

              if (is_address(translated)) {

                const result = {
                  row: translated.row - 1, 
                  column: translated.col - 1,
                  value: constructed_function, 
                  type: ValueType.formula,
                };

                let matched = false;

                for (const element of data) {
                  if (element.row === result.row && element.column === result.column) {
                    matched = true;
                    element.type = ValueType.formula;
                    element.value = constructed_function;
                    break;
                  }
                }
                
                if (!matched) {
                  data.push(result);
                }

              }
              
            }

          }
        }
      }
    }

    /*
    const cells = new Cells();
    cells.FromJSON(data);
    return cells;
    */

    // console.info("SS", sheet.shared_strings);
    // console.info("S", this.workbook.style_cache, this.workbook.style_cache.CellXfToStyles());

    const result: ImportedSheetData = {
      name: sheet.options.name,
      cells: data,
      default_column_width,
      column_widths,
      row_heights,
      annotations,
      styles: this.workbook.style_cache.CellXfToStyles(),
    };

    if (sheet.visible_state === VisibleState.hidden || sheet.visible_state === VisibleState.very_hidden) {
      result.hidden = true;
    }

    if (default_column_style >= 0) {
      result.sheet_style = default_column_style;
    }

    if (column_styles.length) {
      result.column_styles = column_styles;
    }

    return result;

  }

}
