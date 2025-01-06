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

// import JSZip from 'jszip';

// import UZip from 'uzip';
import Base64JS from 'base64-js';

import type { AnchoredChartDescription, AnchoredImageDescription, AnchoredTextBoxDescription} from './workbook';
import { ChartType, ConditionalFormatOperators, Workbook } from './workbook';
import type { ParseResult } from 'treb-parser';
import { DecimalMarkType, Parser } from 'treb-parser';
import type { RangeType, AddressType, HyperlinkType } from './address-type';
import { is_range, ShiftRange, InRange, is_address } from './address-type';
import { type ImportedSheetData, type AnchoredAnnotation, type CellParseResult, type AnnotationLayout, type Corner as LayoutCorner, type IArea, type GradientStop, type Color, type HTMLColor, type ThemeColor, Area } from 'treb-base-types';
import type { SerializedValueType } from 'treb-base-types';
import type { Sheet} from './workbook-sheet';
import { VisibleState } from './workbook-sheet';
import type { CellAnchor } from './drawing/drawing';
import { type GenericDOMElement, XMLUtils } from './xml-utils';

// import { one_hundred_pixels } from './constants';
import { ColumnWidthToPixels } from './column-width';
import type { DataValidation, AnnotationType } from 'treb-data-model';
import { ZipWrapper } from './zip-wrapper';
import type { ConditionalFormat } from 'treb-data-model';

interface SharedFormula {
  row: number;
  column: number;
  formula: string;
  parse_result: ParseResult;
}

interface SharedFormulaMap { [index: string]: SharedFormula }

interface CellElementType {
  a$: {
    r?: string;
    t?: string;
    s?: string;
  };
  v?: string|number|{
    t$: string;
    a$?: Record<string, string>; // DOMContent;
  }; 
  f?: string|{ 
    t$: string;
    a$?: {
      si?: string;
      t?: string;
      ref?: string;
    },
  };
};

interface ConditionalFormatRule {
  a$: {
    type?: string;
    dxfId?: string;
    priority?: string;
    operator?: string;
  };

  formula?: string|[number,number]|{t$: string};

  dataBar?: {
    a$?: {
      showValue?: string;
    },
    color?: {
      a$: {
        rgb?: string;
      }
    }
  }
  
  extLst?: {
    ext?: {
      'x14:id'?: string;
    }
  }

  colorScale?: {
    cfvo?: {
      a$: {
        type?: string;
        val?: string;
      }
    }[];
    color?: {
      a$: {
        rgb?: string;
        theme?: string;
        tint?: string;
      }
    }[];
  };
}

const ElementHasTextNode = (test: unknown): test is {t$: string} => {
  return typeof test === 'object' && typeof (test as {$t: string}).$t !== 'undefined';
}

export class Importer {

  // FIXME: need a way to share/pass parser flags
  public parser = new Parser();

  public workbook?: Workbook;

  // public archive?: JSZip;

  public zip?: ZipWrapper;

  public Init(data: ArrayBuffer) {
    this.zip = new ZipWrapper(data);
    this.workbook = new Workbook(this.zip);
    this.workbook.Init();
  }

  /** FIXME: accessor */
  public SheetCount(): number {
    return this.workbook?.sheet_count || 0;
  }

  public ParseCell(
    sheet: Sheet,
    element: CellElementType,
    shared_formulae: SharedFormulaMap,
    arrays: RangeType[],
    merges: RangeType[],
    links: HyperlinkType[],
    // validations: Array<{ address: ICellAddress, validation: DataValidation }>,
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
    let type: SerializedValueType = 'undefined';

    let calculated_value: undefined | number | boolean | string;
    let calculated_type: SerializedValueType = 'undefined';
    
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
      type = 'string'; // ValueType.string;
      if (typeof element.v !== 'undefined') {
        const index = Number(element.v);
        if (!isNaN(index) && sheet.shared_strings) {
          value = sheet.shared_strings.Get(index) || '';
          if (value[0] === '=') { value = '\'' + value; }
        }
      }
    }
    else {
      if (typeof element.f !== 'undefined') {
        type = 'formula'; // ValueType.formula;

        const formula = (typeof element.f === 'string' ? element.f : element.f.t$) || '';

        if (formula) {

          // doing it like this is sloppy (also does not work properly).
          value = '=' + formula.replace(/^_xll\./g, '');

          // drop the formula if it's a ref error, we can't handle this
          if (/#REF/.test(formula)) {
            value = formula;
          }
          else {
            const parse_result = this.parser.Parse(formula); // l10n?
            if (parse_result.expression) {
              this.parser.Walk(parse_result.expression, (unit) => {
                if (unit.type === 'call') {
                  if (/^_xll\./.test(unit.name)) {
                    unit.name = unit.name.substring(5);
                  }
                  if (/^_xlfn\./.test(unit.name)) {
                    console.info("xlfn:", unit.name);
                    unit.name = unit.name.substring(6);
                  }
                  if (/^_xlws\./.test(unit.name)) {
                    console.info("xlws:", unit.name);
                    unit.name = unit.name.substring(6);
                  }
                }
                return true;
              });
              value = '=' + this.parser.Render(parse_result.expression, { missing: '' });
            }
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
                offset: {
                  rows: address.row - 1 - f.row,
                  columns: address.col - 1 - f.column,
                }, 
                missing: ''
              });
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

          const V = (typeof element.v === 'object') ? element.v?.t$ : element.v;

          const num = Number(V.toString());
          if (!isNaN(num)) {
            calculated_type = 'number'; // ValueType.number;
            calculated_value = num;
          }
          else {
            calculated_type = 'string'; // ValueType.string;
            calculated_value = V.toString();
          }
        }

      }
      else if (typeof element.v !== 'undefined') {
        const num = Number(element.v.toString());
        if (!isNaN(num)) {
          type = 'number'; // ValueType.number;
          value = num;
        }
        else {
          type = 'string'; // ValueType.string;
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
        type = 'undefined'; // ValueType.undefined;
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

    /*
    for (const validation of validations) {
      if (validation.address.row === shifted.row && validation.address.column === shifted.col) {
        result.validation = validation.validation;
        break;
      }
    }
    */

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

  public AddressToArea(address: RangeType|AddressType): IArea {

    const area: IArea = is_address(address) ? {
      start: { row: address.row - 1, column: address.col - 1 },
      end: { row: address.row - 1, column: address.col - 1 },
    } : {
      start: { row: address.from.row - 1, column: address.from.col - 1 },
      end: { row: address.to.row - 1, column: address.to.col - 1 },
    };

    return area;

  }

  public ParseConditionalFormat(address: RangeType|AddressType, rule: ConditionalFormatRule, extensions?: any[]): ConditionalFormat|ConditionalFormat[]|undefined {

    const area = this.AddressToArea(address);
    const operators = ConditionalFormatOperators;

    // console.info({rule});

    switch (rule.a$.type) {
      case 'duplicateValues':
      case 'uniqueValues':

        {
          let style = {};

          if (rule.a$.dxfId) {
            const index = Number(rule.a$.dxfId);
            if (!isNaN(index)) {
              style = this.workbook?.style_cache.dxf_styles[index] || {};
            }
          }

          return {
            type: 'duplicate-values',
            area,
            style,
            unique: (rule.a$.type === 'uniqueValues'),
            priority: rule.a$.priority ? Number(rule.a$.priority) : undefined,

          };
        }

      case 'cellIs':
        if (rule.a$.operator && (rule.formula || typeof rule.formula === 'number')) {
          let style = {};

          if (rule.a$.dxfId) {
            const index = Number(rule.a$.dxfId);
            if (!isNaN(index)) {
              style = this.workbook?.style_cache.dxf_styles[index] || {};
            }
          }

          if (rule.a$.operator === 'between') {
            if (Array.isArray(rule.formula) && rule.formula.length === 2
                && typeof rule.formula[0] === 'number' && typeof rule.formula[1] === 'number') {

              return {
                type: 'cell-match',
                expression: '',
                between: rule.formula, // special case? ugh
                area,
                style,
                priority: rule.a$.priority ? Number(rule.a$.priority) : undefined,
              };

            }
          }

          const operator = operators[rule.a$.operator || ''];

          if (!operator) {
            console.info('unhandled cellIs operator:', rule.a$.operator, {rule});
          }
          else {
            return {
              type: 'cell-match',
              expression: operator + ' ' + rule.formula,
              area,
              style,
              priority: rule.a$.priority ? Number(rule.a$.priority) : undefined,
            };
          }

        }
        else {
          console.info("miss?", rule);
        }
        break;

      case 'containsErrors':
      case 'notContainsErrors':
      case 'expression':

        if (rule.formula) {

          if (typeof rule.formula !== 'string') {
            if (ElementHasTextNode(rule.formula)) {

              // the only case (to date) we've seen here is that the attribute 
              // is "xml:space=preserve", which we can ignore (are you sure?)
              // (should we check that?)

              rule.formula = rule.formula.t$;

            }
            else {
              console.info("unexpected conditional expression", {rule});
              rule.formula = '';
            }
          }

          let style = {};
          
          if (rule.a$.dxfId) {
            const index = Number(rule.a$.dxfId);
            if (!isNaN(index)) {
              style = this.workbook?.style_cache.dxf_styles[index] || {};
            }
          }

          if (rule.a$.type === 'expression' && (area.start.row !== area.end.row || area.start.column !== area.end.column)) {

            // (1) this is only required if there are relative references
            //     in the formula. so we could check and short-circuit.
            //
            // (2) I'd like to find a way to apply this as a single formula,
            //     so there's only one rule required.

            this.parser.Save();
            this.parser.SetLocaleSettings(DecimalMarkType.Period);

            const list: ConditionalFormat[] = [];
            const a2 = new Area(area.start, area.end);

            const parse_result = this.parser.Parse(rule.formula);
            if (parse_result.expression) {
              for (const cell of a2) {
                const f = this.parser.Render(parse_result.expression, {
                  missing: '',
                  offset: { rows: cell.row - area.start.row, columns: cell.column - area.start.column }
                });

                list.push({
                  type: 'expression',
                  expression: f,
                  style,
                  area: { start: cell, end: cell },
                  priority: rule.a$.priority ? Number(rule.a$.priority) : undefined,
                })

                // console.info(f);
              }
            }

            this.parser.Restore();
            return list;

          }

          return {
            type: 'expression',
            expression: rule.formula,
            area,
            style,
            priority: rule.a$.priority ? Number(rule.a$.priority) : undefined,
          };

        }
        break;

      case 'dataBar':
        {
          const hide_values = (rule.dataBar?.a$?.showValue === '0');
          let extension: any = undefined;

          if (rule.extLst?.ext?.['x14:id']) {
            for (const test of (extensions || [])) {
              if (test['x14:cfRule']?.a$?.id === rule.extLst.ext['x14:id']) {
                extension = test;
                break;
              }
            }
            if (!extension) {
              console.info("conditional format extension not found");
            }
          }

          if (rule.dataBar?.color?.a$?.rgb) {

            let negative: Color|undefined = undefined;

            if (extension?.['x14:cfRule']?.['x14:dataBar']?.['x14:negativeFillColor']?.a$?.rgb) {
              const rgb = extension['x14:cfRule']['x14:dataBar']['x14:negativeFillColor'].a$.rgb;
              negative = { text: '#' + rgb.toString().substring(2) };
            }

            const fill: Color = { text: '#' + rule.dataBar.color.a$.rgb.substring(2) };
            return {
              type: 'data-bar',
              area,
              fill,
              hide_values,
              negative,
            };
          }
        }
        break;

      case 'colorScale':
        if (rule.colorScale && Array.isArray(rule.colorScale.cfvo) && Array.isArray(rule.colorScale.color)) {

          const stops: GradientStop[] = [];
          for (const [index, entry] of rule.colorScale.cfvo.entries()) {
            let value = 0;
            const color: Color = {};

            const color_element = rule.colorScale.color[index];
            if (color_element.a$.rgb) {
              (color as HTMLColor).text = '#' + color_element.a$.rgb.substring(2);
            } 
            else if (color_element.a$.theme) {
              (color as ThemeColor).theme = Number(color_element.a$.theme) || 0;
              if (color_element.a$.tint) {
                (color as ThemeColor).tint = Math.round(Number(color_element.a$.tint) * 1000) / 1000;
              }
            }           

            switch (entry.a$.type) {
              case 'min':
                value = 0;
                break;

              case 'max':
                value = 1;
                break;

              case 'percentile':
                value = (Number(entry.a$.val) || 0) / 100;
                break;
            }

            stops.push({ color, value });

          }

          return {
            type: 'gradient',
            stops,
            color_space: 'RGB',
            area,
            priority: rule.a$.priority ? Number(rule.a$.priority) : undefined,

          };

        }
        else {
          console.info('unexpected colorScale', {rule});
        }
        break;

      default:
        console.info('unhandled cf type:', {rule});
    }

    return undefined;
  }

  public GetSheet(index = 0): ImportedSheetData {

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
    const conditional_formats: ConditionalFormat[] = [];
    const links: HyperlinkType[] = [];
    const row_styles: number[] = []; // may be sparse

    /*
    const validations: Array<{
      address: ICellAddress,
      validation: DataValidation,
    }> = [];
    */
    const validations: DataValidation[] = [];

    const annotations: AnchoredAnnotation[] = [];

    const FindAll: <T = GenericDOMElement>(path: string) => T[] = XMLUtils.FindAll.bind(XMLUtils, sheet.sheet_data);

    // tab color

    const tab_color_element = FindAll('worksheet/sheetPr/tabColor');

    let tab_color: Color|undefined;
    
    if (tab_color_element?.[0]) {

      const element = tab_color_element[0];
      if (element.a$?.theme) {
        tab_color = { theme: Number(element.a$.theme) };
        if (element.a$?.tint) {
          tab_color.tint = Number(element.a$.tint);
        }
      }
      if (element.a$?.rgb) {
        const argb = element.a$.rgb;
        tab_color = {
          text: '#' + (
            argb.length > 6 ?
            argb.substr(argb.length - 6) :
            argb),
        };
      }

    }

    // conditionals 

    const conditional_formatting = FindAll('worksheet/conditionalFormatting');

    // we might need extensions as well? TODO

    const conditional_formattings = FindAll('worksheet/extLst/ext/x14:conditionalFormattings/x14:conditionalFormatting');

    for (const element of conditional_formatting) {
      if (element.a$?.sqref ){

        // FIXME: this attribute might include multiple ranges? e.g.:
        //
        // <conditionalFormatting sqref="B31:I31 B10:E30 G10:I30 F14:F15">

        const parts = element.a$.sqref.split(/\s+/);
        for (const part of parts) {
          const area = sheet.TranslateAddress(part);
          if (element.cfRule) {
            const rules = Array.isArray(element.cfRule) ? element.cfRule : [element.cfRule];
            for (const rule of rules) {
              const format = this.ParseConditionalFormat(area, rule as unknown as ConditionalFormatRule, conditional_formattings);
              if (format) {
                if (Array.isArray(format)) {
                  conditional_formats.push(...format);
                }
                else {
                  conditional_formats.push(format);
                }
              }
            }
          }
        }

      }
    }
    
    // merges

    const merge_cells = FindAll('worksheet/mergeCells/mergeCell');

    for (const element of merge_cells) {
      if (element.a$?.ref) {
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

      if (ref && formula && typeof formula === 'string' && type === 'list') {
        // let address: ICellAddress|undefined;
        let validation: DataValidation|undefined;
        let parse_result = this.parser.Parse(ref);
        const target: IArea[] = [];

        // apparently these are encoded as ranges for merged cells...

        // NOTE: actually you can have a range, then validation applies
        // to every cell in the range. also you can have multiple ranges,
        // apparently separated by spaces.

        if (parse_result.expression) {
          if (parse_result.expression.type === 'address') {
            // address = parse_result.expression;
            target.push({start: parse_result.expression, end: parse_result.expression});
          }
          else if (parse_result.expression.type === 'range') {
            // address = parse_result.expression.start;
            target.push(parse_result.expression);
          }
        }

        parse_result = this.parser.Parse(formula);

        if (parse_result.expression) {
          if (parse_result.expression.type === 'range') {
            validation = {
              type: 'range',
              area: parse_result.expression,
              target,
            };
          }
          else if (parse_result.expression.type === 'literal') {
            validation = {
              type: 'list',
              target,
              list: parse_result.expression.value.toString().split(/,/).map(value => {

                // there are no formulas here. value is a string, separated
                // by commas. there is no way to escape a comma (AFAICT; not
                // official, but search). if you did want a comma, you'd need
                // to use a range.

                // but the uptake is split on commas. after that you can try
                // to check for numbers or bools, but they will be in the string.

                // I think excel might sort the entries? not sure. don't do it
                // for now.

                const num = Number(value);
                if (!isNaN(num)) {
                  return num;
                }
                if (value.toLowerCase() === 'true') {
                  return true;
                }
                if (value.toLowerCase() === 'false') {
                  return false;
                }
                return value; // string

                /*
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
                */

              }),
            };
          }
        }

        if (target.length && validation) {
          // validations.push({address, validation});
          validations.push(validation);
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
        reference = typeof child.__location === 'string' ? child.__location : '';
        text = typeof child.__display === 'string' ? child.__display : '';
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
    const outline: number[] = [];

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
      if (row.a$?.outlineLevel) {
        const num = Number(row.a$.outlineLevel);
        if (!isNaN(num)) {
          outline[row_index - 1] = num;
        }
      }

      if (row.a$?.s) {
        const style_reference = Number(row.a$?.s);
        if (!isNaN(style_reference)) {
          row_styles[row_index - 1] = style_reference;
        }
      }

      // if there's a height which is not === default height, but 
      // the customHeight attribute is not set, then it's been auto-sized.
      // not sure that's something we need to care about necessarily...

      if (height !== default_row_height) {
        row_heights[row_index - 1] = height;
      }

      const cells = row.c ? Array.isArray(row.c) ? row.c : [row.c] : [];

      for (const element of cells) {
        const cell = this.ParseCell(sheet, element as unknown as CellElementType, shared_formulae, arrays, merges, links); // , validations);
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

    const table_references = FindAll('worksheet/tableParts/tablePart')
    for (const child of table_references) {
      const rel = child.a$ ? child.a$['r:id'] : undefined;
      if (rel) {
        let reference = '';

        const relationship = sheet.rels[rel];
        if (relationship) {
          reference = relationship.target || '';
          const description = this.workbook.ReadTable(reference);
          if (description) {

            // console.info({description});

            const ref = sheet.TranslateAddress(description.ref);
            const area: IArea = is_address(ref) ? { 
                start: { row: ref.row - 1, column: ref.col - 1}, 
                end: { row: ref.row - 1, column: ref.col - 1},
              } : { 
                start: { row: ref.from.row - 1, column: ref.from.col - 1}, 
                end: { row: ref.to.row - 1, column: ref.to.col - 1},
              };

            for (const cell of data) {
              if (cell.row === area.start.row && cell.column === area.start.column) {
                cell.table = {
                  area,
                  name: description.name,
                  totals_row: (!!description.totals_row_count),

                  // NOTE: column headers are added on first load, we don't 
                  // read them from here. not super efficient but we do it
                  // that way for regular loads as well

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
    const image_descriptors: AnchoredImageDescription[] = [];
    const textbox_descriptors: AnchoredTextBoxDescription[] = [];

    for (const child of drawings) {
      
      const rel = child.a$ ? child.a$['r:id'] : undefined;
      if (rel) {

        let reference = '';

        const relationship = sheet.rels[rel];
        if (relationship) {
          reference = relationship.target || '';
        }

        if (reference) {
          const drawing = this.workbook.ReadDrawing(reference);
          if (drawing && drawing.length) {
            for (const entry of drawing) {
              switch (entry.type) {
                case 'chart':
                  chart_descriptors.push(entry);
                  break;
                case 'image':
                  image_descriptors.push(entry);
                  break;
                case 'textbox':
                  textbox_descriptors.push(entry);
                  break;
              }
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

    for (const descriptor of textbox_descriptors) {

      const layout: AnnotationLayout = {
        tl: AnchorToCorner(descriptor.anchor.from),
        br: AnchorToCorner(descriptor.anchor.to),
      };

      // console.info({descriptor});

      const anchored_annotation: AnchoredAnnotation = {
        layout, 
        type: 'textbox',
        data: {
          style: descriptor.style,
          paragraphs: descriptor.paragraphs,
        },
      };

      if (descriptor.reference) {
        anchored_annotation.formula = `=` + descriptor.reference;
      }

      annotations.push(anchored_annotation);
      
    }

    for (const descriptor of image_descriptors) {
      if (descriptor && descriptor.image) {

        const layout: AnnotationLayout = {
          tl: AnchorToCorner(descriptor.anchor.from),
          br: AnchorToCorner(descriptor.anchor.to),
        };
        
        const type: AnnotationType = 'image';
        const data = Base64JS.fromByteArray(descriptor.image);
        let imagetype: string = '';

        if (descriptor.filename) {
          if (/jpe*g$/i.test(descriptor.filename)) {
            imagetype = 'jpeg';
          }
          else if (/png$/i.test(descriptor.filename)) {
            imagetype = 'png';
          }
          else if (/gif$/i.test(descriptor.filename)) {
            imagetype = 'gif';
          }
        }

        if (imagetype && data) {
          const src = 'data:image/' + imagetype + ';base64,' + data;
          annotations.push({
            layout, type, data: { src },
          });
        }

      }
    }

    for (const descriptor of chart_descriptors) {
      if (descriptor && descriptor.chart) {

        // convert the anchor to the annotation type

        const layout: AnnotationLayout = {
          tl: AnchorToCorner(descriptor.anchor.from),
          br: AnchorToCorner(descriptor.anchor.to),
        };

        let type: AnnotationType|undefined;
        const args: Array<string|undefined> = [];
        let func = '';        
        const series = descriptor.chart?.series;

        switch(descriptor.chart.type) {

          case ChartType.Bubble:
            type = 'treb-chart';
            func = 'Bubble.Chart';

            if (series && series.length) {
              args[0] = `Group(${series.map(s => `Series(${
                [
                  s.title || '',
                  s.values || '',
                  s.categories || '',
                  s.bubble_size || '',

                ].join(', ')
              })`).join(', ')})`;
            }
           
            args[1] = descriptor.chart.title;

            break;

          case ChartType.Box:
            type = 'treb-chart';
            func = 'Box.Plot';
            if (series?.length) {
              args[0] = `Group(${series.map(s => `Series(${s.title || ''},,${s.values||''})`).join(', ')})`;
              console.info("S?", {series}, args[0])
            }
            args[1] = descriptor.chart.title;
            break;

          case ChartType.Scatter:
            type = 'treb-chart';
            func = 'Scatter.Line';
            if (series && series.length) {
              args[0] = `Group(${series.map(s => `Series(${s.title || ''},${s.categories||''},${s.values||''})`).join(', ')})`;
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
                args[0] = `Group(${series.map(s => `Series(${s.title || ''},,${s.values||''})`).join(', ')})`;
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

            const result: {
              row: number;
              column: number;
              value: string;
              type: SerializedValueType;
            } = {
              row: translated.row - 1, 
              column: translated.col - 1,
              value: constructed_function, 
              type: 'formula', // ValueType.formula,
            };

            let matched = false;

            for (const element of data) {
              if (element.row === result.row && element.column === result.column) {
                matched = true;
                element.type = 'formula'; // ValueType.formula;
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
      tab_color,
      row_styles,
      annotations,
      conditional_formats,
      data_validations: validations,
      styles: this.workbook?.style_cache?.CellXfToStyles() || [],
    };

    if (outline.length) {
      result.outline = outline;
    }

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