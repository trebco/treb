
import * as JSZip from 'jszip';
import * as ElementTree from 'elementtree';
import { Workbook } from './workbook';
import { Style, Area, ICellAddress, Cell, Cells, ValueType } from 'treb-base-types';
import { Sheet } from './sheet';
import { is_range, RangeType, ShiftRange, InRange, AddressType } from './address-type';
import { Parser, ParseResult } from 'treb-parser';

interface SharedFormula {
  row: number;
  column: number;
  formula: string;
  parse_result: ParseResult;
}

interface SharedFormulaMap {[index: string]: SharedFormula; }

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

  public get zip() {
    return this.archive_;
  }

  public async Init(data: string|JSZip) {

    if (typeof data === 'string') {
      this.archive_ = await JSZip().loadAsync(data);
    }
    else {
      this.archive_ = data;
    }

    this.workbook = new Workbook();
    await this.workbook.Init(this.archive_);
  }

  public ParseCell(
      sheet: Sheet,
      element: ElementTree.Element,
      shared_formulae: SharedFormulaMap,
      arrays: RangeType[],
      merges: RangeType[]) {

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

    let value: any;
    let type: ValueType = ValueType.undefined;

    let calculated_value: any;
    let calculated_type: ValueType = ValueType.undefined;

    // assuming we have single element per tag...

    const mapped: {[index: string]: ElementTree.Element} = {};
    for (const child of element.getchildren()) {
      if (child.tag) mapped[child.tag.toString()] = child;
    }

    // console.info(mapped);

    if (element.attrib.t && element.attrib.t === 's') {
      type = ValueType.string;
      if (mapped.v && mapped.v.text) {
        const index = Number(mapped.v.text);
        if (!isNaN(index) && sheet.shared_strings) {
          value = sheet.shared_strings.GetSharedString(index);
        }
      }
    }
    else {
      if (mapped.f) {
        type = ValueType.formula;
        if (mapped.f.text) {
          value = '=' + mapped.f.text.toString().replace(/^_xll\./, '');
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
              });
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

    const result: any = {
      row: shifted.row, column: shifted.col, value, type,
    };

    if (typeof calculated_value !== 'undefined') {
      result.calculated_type = calculated_type;
      result.calculated = calculated_value;
    }

    if (element.attrib.s) {
      result.style_ref = Number(element.attrib.s);
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

  public GetSheet(index: string|number = 0) {

    const sheet = this.workbook.GetSheet(index);
    sheet.Parse();
    if (!sheet.dom) throw new Error('missing DOM');

    // we want a sparse array

    const data: any[] = [];
    const shared_formulae: {[index: string]: SharedFormula} = {};
    const arrays: RangeType[] = [];
    const merges: RangeType[] = [];

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
            const cell = this.ParseCell(sheet, child, shared_formulae, arrays, merges);
            if (cell) {
              data.push(cell);
              // max_column = Math.max(max_column, cell.column); // use extent
            }
          }
        }
      }
    }

    let default_column_width = 100;
    const sheet_format = sheet.dom.find('./sheetFormatPr');
    if (sheet_format && sheet_format.attrib.defaultColWidth) {
      // defaultColWidth="14.28515625" defaultRowHeight="15" x14ac:dyDescent="0.25"/>
      const width = Number(sheet_format.attrib.defaultColWidth);
      if (!isNaN(width)) {
        default_column_width = Math.round(width / one_hundred_pixels * 100);
      }
    }

    const column_widths: number[] = [];
    const columns = sheet.dom.find(`./cols`);
    if (columns) {
      for (const child of columns.getchildren()) {
        if (child.tag === 'col' && child.attrib.customWidth) {

          const min = Number(child.attrib.min);
          let max = Number(child.attrib.max);
          let width = Number(child.attrib.width);

          if (!isNaN(min) && !isNaN(max) && !isNaN(width)) {

            // otherwise it will set -> 16384
            if (sheet.extent) {
              max = Math.min(max, sheet.extent.to.col + 1);
            }

            width = Math.round(width / one_hundred_pixels * 100);
            for (let i = min; i <= max; i++) column_widths[i - 1] = width;
          }

        }
      }
    }

    /*
    const cells = new Cells();
    cells.FromJSON(data);
    return cells;
    */

    return {
      cells: data,
      default_column_width,
      column_widths,
      row_heights,
      styles: this.workbook.style_cache.CellXfToStyles(),
    };

  }

}
