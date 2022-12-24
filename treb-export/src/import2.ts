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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

//import * as JSZip from 'jszip';
import JSZip from 'jszip';

import { AnchoredChartDescription, ChartType, TableDescription, Workbook } from './workbook2';
import { Parser, ParseResult } from 'treb-parser';
import { is_range, RangeType, ShiftRange, InRange, AddressType, is_address, HyperlinkType } from './address-type';
import { ImportedSheetData, AnchoredAnnotation, CellParseResult, ValueType, AnnotationLayout, Corner as LayoutCorner, ICellAddress, DataValidation, ValidationType, IArea } from 'treb-base-types/src';
import { Sheet, VisibleState } from './workbook-sheet2';
import type { CellAnchor } from './drawing2/drawing2';
import { XMLUtils } from './xml-utils';

// import { one_hundred_pixels } from './constants';
import { ColumnWidthToPixels } from './column-width';

interface SharedFormula {
  row: number;
  column: number;
  formula: string;
  parse_result: ParseResult;
}

interface SharedFormulaMap { [index: string]: SharedFormula }

export class Importer {

  // FIXME: need a way to share/pass parser flags
  public parser = new Parser();

  public workbook?: Workbook;

  public archive?: JSZip;

  public async Init(data: string | JSZip): Promise<void> {

    if (typeof data === 'string') {
      this.archive = await JSZip().loadAsync(data);
    }
    else {
      this.archive = data;
    }

    if (this.archive) {
      this.workbook = new Workbook(this.archive);
      await this.workbook.Init();
    }

  }

  /** FIXME: accessor */
  public SheetCount(): number {
    return this.workbook?.sheet_count || 0;
  }

  public ParseCell(
    sheet: Sheet,
    element: {
      a$: {
        r?: string;
        t?: string;
        s?: string;
      };
      v?: string|number; // is this never an object? (note: booleans are numbers in Excel)
      f?: string|{ 
        t$: string;
        a$?: {
          si?: string;
          t?: string;
          ref?: string;
        },
      };
    }, // ElementTree.Element,
    shared_formulae: SharedFormulaMap,
    arrays: RangeType[],
    merges: RangeType[],
    links: HyperlinkType[],
    validations: Array<{ address: ICellAddress, validation: DataValidation }>,
    ): CellParseResult | undefined {

    // must have, at minimum, an address (must be a single cell? FIXME)
    const address_attr = element.a$?.r;
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

    let value: undefined | number | boolean | string;
    let type: ValueType = ValueType.undefined;

    let calculated_value: undefined | number | boolean | string;
    let calculated_type: ValueType = ValueType.undefined;

    // QUESTIONS:
    //
    // 1. is v always a value, or can it be an object?
    //    if it is always a value, we can drop some of the 
    //    casting stuff below
    // 
    // 2. can we reframe f so it's always an object, moving the string 
    //    inside --  to remove the simple case and remove all the testing?
    //


    // assuming we have single element per tag...

    /*
    const mapped: { [index: string]: ElementTree.Element } = {};
    for (const child of element.getchildren()) {
      if (child.tag) mapped[child.tag.toString()] = child;
    }
    */

    // console.info(address, 'e', element, 'm', mapped);

    if (element.a$?.t && element.a$.t === 's') {
      type = ValueType.string;
      if (typeof element.v !== undefined) {
        const index = Number(element.v);
        if (!isNaN(index) && sheet.shared_strings) {
          value = sheet.shared_strings.Get(index) || '';
          if (value[0] === '=') { value = '\'' + value; }
        }
      }
    }
    else {
      if (typeof element.f !== 'undefined') {
        type = ValueType.formula;

        const formula = (typeof element.f === 'string' ? element.f : element.f.t$) || '';

        if (formula) {

          // doing it like this is sloppy (also does not work properly).
          value = '=' + formula.replace(/^_xll\./g, '');

          const parse_result = this.parser.Parse(formula); // l10n?
          if (parse_result.expression) {
            this.parser.Walk(parse_result.expression, (unit) => {
              if (unit.type === 'call' && /^_xll\./.test(unit.name)) {
                unit.name = unit.name.substr(5);
              }
              return true;
            });
            value = '=' + this.parser.Render(parse_result.expression, undefined, '');
          }

          if (typeof element.f !== 'string') {
            if (element.f.a$?.t === 'shared' && element.f.a$.si) {
              shared_formulae[element.f.a$.si] = {
                row: address.row - 1,
                column: address.col - 1,
                formula: value,
                parse_result: this.parser.Parse(value),
              };
            }
          }

        }
        else if ((typeof element.f !== 'string') && element.f.a$?.t === 'shared' && element.f.a$.si) {
          const f = shared_formulae[element.f.a$.si];
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

        if (typeof element.f !== 'string' &&  element.f.a$?.t === 'array') {
          const translated = sheet.TranslateAddress(element.f.a$.ref || '');
          if (is_range(translated)) {
            arrays.push(ShiftRange(translated, -1, -1));
          }
        }

        if (typeof element.v !== 'undefined') {
          const num = Number(element.v.toString());
          if (!isNaN(num)) {
            calculated_type = ValueType.number;
            calculated_value = num;
          }
          else {
            calculated_type = ValueType.string;
            calculated_value = element.v.toString();
          }
        }

      }
      else if (typeof element.v !== 'undefined') {
        const num = Number(element.v.toString());
        if (!isNaN(num)) {
          type = ValueType.number;
          value = num;
        }
        else {
          type = ValueType.string;
          value = element.v.toString();
        }
      }
    }

    const shifted: AddressType = { row: address.row - 1, col: address.col - 1 };

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

    if (element.a$?.s) {
      result.style_ref = Number(element.a$.s);
    }

    for (const link of links) {
      if (link.address.row === address.row && link.address.col === address.col) {
        result.hyperlink = link.reference;
        // FIXME: pop?
      }
    }

    for (const validation of validations) {
      if (validation.address.row === shifted.row && validation.address.column === shifted.col) {
        result.validation = validation.validation;
        break;
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

      }
    }

    return result;

  }

  public async GetSheet(index = 0): Promise<ImportedSheetData> {

    if (!this.workbook) {
      throw new Error('missing workbook');
    }

    const sheet = this.workbook.sheets[index];
    // console.info(sheet.sheet_data);

    // console.info(sheet.options.name);

    // we want a sparse array

    const data: CellParseResult[] = [];
    const shared_formulae: {[index: string]: SharedFormula} = {};
    const arrays: RangeType[] = [];
    const merges: RangeType[] = [];
    const links: HyperlinkType[] = [];
    const validations: Array<{
      address: ICellAddress,
      validation: DataValidation,
    }> = [];
    const annotations: AnchoredAnnotation[] = [];

    const FindAll = XMLUtils.FindAll.bind(XMLUtils, sheet.sheet_data);

    // merges

    const merge_cells = FindAll('worksheet/mergeCells/mergeCell');

    for (const element of merge_cells) {
      if (element.a$.ref) {
        const merge = sheet.TranslateAddress(element.a$.ref);
        if (is_range(merge)) {
          merges.push(ShiftRange(merge, -1, -1));
        }
      }
    }

    // validation

    const validation_entries = FindAll('worksheet/dataValidations/dataValidation');
    for (const entry of validation_entries) {
      const type = entry.a$?.type;
      const ref = entry.a$?.sqref;
      const formula = entry.formula1;

      if (ref && formula && type === 'list') {
        let address: ICellAddress|undefined;
        let validation: DataValidation|undefined;
        let parse_result = this.parser.Parse(ref);

        // apparently these are encoded as ranges for merged cells...

        if (parse_result.expression) {
          if (parse_result.expression.type === 'address') {
            address = parse_result.expression;
          }
          else if (parse_result.expression.type === 'range') {
            address = parse_result.expression.start;
          }
        }

        parse_result = this.parser.Parse(formula);
        if (parse_result.expression) {
          if (parse_result.expression.type === 'range') {
            validation = {
              type: ValidationType.Range,
              area: parse_result.expression,
            };
          }
          else if (parse_result.expression.type === 'literal') {
            validation = {
              type: ValidationType.List,
              list: parse_result.expression.value.toString().split(/,/).map(value => {
                const tmp = this.parser.Parse(value);
                
                // if type is "group", that means we saw some spaces. this 
                // is (probably) an unquoted string literal. for the time
                // being let's assume that. need a counterexample.

                if (tmp.expression?.type === 'group' && /\s/.test(value)) {
                  return value;
                }
                if (tmp.expression?.type === 'literal') {
                  return tmp.expression.value;
                }
                if (tmp.expression?.type === 'identifier') {
                  return tmp.expression.name;
                }
                return undefined;
              }),
            };
          }
        }

        if (address && validation) {
          validations.push({address, validation});
        }

      }

    }
    
    // links

    const hyperlinks = FindAll('worksheet/hyperlinks/hyperlink');

    for (const child of hyperlinks) {

      let address = sheet.TranslateAddress(child.a$?.ref || '');
      if (is_range(address)) {
        address = address.from;
      }

      let text = '';
      let reference = '';

      if (child.a$ && child.a$['r:id']) {

        text = 'remote link';
        const relationship = sheet.rels[child.a$['r:id']];
        if (relationship) {
          reference = relationship.target || '';
        }

      }
      else {
        reference = child.__location || '';
        text = child.__display || '';
      }

      links.push({ address, reference, text });
    }

    // base

    let default_row_height = 21;
    let default_column_width = 100; // ?

    const sheet_format = sheet.sheet_data.worksheet?.sheetFormatPr;
    if (sheet_format) {
      if (sheet_format.a$?.defaultColWidth) {
        const width = Number(sheet_format.a$.defaultColWidth);
        if (!isNaN(width)) {
          // default_column_width = Math.round(width / one_hundred_pixels * 100);
          default_column_width = ColumnWidthToPixels(width);
        }
      }
      if (sheet_format.a$?.defaultRowHeight) {
        const height = Number(sheet_format.a$.defaultRowHeight);
        if (!isNaN(height)) {
          default_row_height = Math.round(height * 4 / 3); // ??
        }
      }
    }

    // data (and row heights)

    const row_heights: number[] = [];

    const rows = FindAll('worksheet/sheetData/row');

    for (const row of rows) {
      const row_index = row.a$?.r ? Number(row.a$.r) : 1;

      let height = default_row_height;
      if (row.a$?.ht) {
        const num = Number(row.a$.ht);
        if (!isNaN(num)) {
          height = Math.round(num * 4 / 3); // seems to be the excel unit -> pixel ratio
        }
      }

      // if there's a height which is not === default height, but 
      // the customHeight attribute is not set, then it's been auto-sized.
      // not sure that's something we need to care about necessarily...

      if (height !== default_row_height) {
        row_heights[row_index - 1] = height;
      }

      /*
      if (row.a$?.ht && row.a$?.customHeight) {
        const num = Number(row.a$.ht);
        if (!isNaN(num)) {
          row_heights[row_index - 1] = Math.round(num * 4 / 3); // seems to be the excel unit -> pixel ratio
        }
      }
      */

      let cells = row.c || [];
      if (!Array.isArray(cells)) { cells = [cells]; }

      for (const element of cells) {
        const cell = this.ParseCell(sheet, element, shared_formulae, arrays, merges, links, validations);
        if (cell) {
          data.push(cell);
        }
      }
    }

    const column_styles: number[] = [];
    let default_column_style = -1;
    const column_widths: number[] = [];

    const columns = FindAll('worksheet/cols/col');

    for (const child of columns) {

      const min = Number(child.a$?.min);
      const max = Number(child.a$?.max);

      if (child.a$?.style) {

        const style = Number(child.a$.style);

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
      if (child.a$?.customWidth) {

        let width = Number(child.a$.width);

        if (!isNaN(min) && !isNaN(max) && !isNaN(width)) {

          if (max === 16384) {

            // ...
          }
          else {

            // otherwise it will set -> 16384
            // if (sheet.extent) {
            // max = Math.min(max, sheet.extent.to.col + 1);
            // }

            // width = Math.round(width / one_hundred_pixels * 100);
            width = ColumnWidthToPixels(width);

            for (let i = min; i <= max; i++) column_widths[i - 1] = width;
          }
        }

      }
    }

    // --- import tables -------------------------------------------------------

    /*
    const tables: Array<{
      area: IArea,
      description: TableDescription,
    }> = [];
    */

    const table_references = FindAll('worksheet/tableParts/tablePart')
    for (const child of table_references) {
      const rel = child.a$ ? child.a$['r:id'] : undefined;
      if (rel) {
        let reference = '';

        const relationship = sheet.rels[rel];
        if (relationship) {
          reference = relationship.target || '';
          const description = await this.workbook.ReadTable(reference);
          if (description) {
            const ref = sheet.TranslateAddress(description.ref);
            const area: IArea = is_address(ref) ? { 
                start: { row: ref.row - 1, column: ref.col - 1}, 
                end: { row: ref.row - 1, column: ref.col - 1},
              } : { 
                start: { row: ref.from.row - 1, column: ref.from.col - 1}, 
                end: { row: ref.to.row - 1, column: ref.to.col - 1},
              };

            /*
            tables.push({
              description,
              area,
            })
            */

            for (const cell of data) {
              if (cell.row === area.start.row && cell.column === area.start.column) {
                cell.table = {
                  area,
                  headers: true,
                };
                break;
              }
            }

          }

        }
      }
    }

    // --- import drawings -----------------------------------------------------

    // wip...

    const drawings = FindAll('worksheet/drawing');
    const chart_descriptors: AnchoredChartDescription[] = [];

    for (const child of drawings) {
      const rel = child.a$ ? child.a$['r:id'] : undefined;
      if (rel) {

        let reference = '';

        const relationship = sheet.rels[rel];
        if (relationship) {
          reference = relationship.target || '';
        }

        if (reference) {
          const drawing = await this.workbook.ReadDrawing(reference);
          if (drawing && drawing.length) {
            chart_descriptors.push(...drawing);
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
        // console.info('f', formula);

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

    const ext = FindAll('worksheet/extLst/ext');
    for (const entry of ext) {
    
      // find the prefix
      let prefix = '';
      for (const key of Object.keys(entry?.a$ || {})) {
        const match = key.match(/^xmlns:(.*)$/);
        if (match) {
          prefix = match[1];
          break;
        }
      }

      const groups = XMLUtils.FindAll(entry, `${prefix}:sparklineGroups/${prefix}:sparklineGroup`);
      for (const group of groups) {
        let func = 'Sparkline.line';
        let reference = '';
        let source = '';

        if (group.a$?.type === 'column') {
          func = 'Sparkline.column';
        }

        // TODO: gap optional
        // TODO: colors

        const sparklines = XMLUtils.FindAll(group, `${prefix}:sparklines/${prefix}:sparkline`);
        for (const sparkline of sparklines) {
          for (const key of Object.keys(sparkline)) {
            if (/:f$/.test(key)) {
              source = sparkline[key];
            }
            else if (/:sqref$/.test(key)) {
              reference = sparkline[key];
            }
          }
        }

        //

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

        //

      }
      
    }

    const result: ImportedSheetData = {
      name: sheet.options.name,
      cells: data,
      default_column_width,
      column_widths,
      row_heights,
      annotations,
      styles: this.workbook?.style_cache?.CellXfToStyles() || [],
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