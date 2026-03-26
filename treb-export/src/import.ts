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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

// import JSZip from 'jszip';

// import UZip from 'uzip';
import Base64JS from 'base64-js';

import type { AnchoredChartDescription, AnchoredImageDescription, AnchoredTextBoxDescription} from './workbook';
import { ChartType, ConditionalFormatOperators, Workbook } from './workbook';
import type { ExpressionUnit, ParseResult, UnitCall } from 'treb-parser';
import { DecimalMarkType, Parser } from 'treb-parser';
import type { RangeType, AddressType, HyperlinkType } from './address-type';
import { is_range, ShiftRange, InRange, is_address } from './address-type';
import { type ImportedSheetData, type AnchoredAnnotation, type CellParseResult, type AnnotationLayout, type Corner as LayoutCorner, type IArea, type GradientStop, type Color, type HTMLColor, type ThemeColor, Area } from 'treb-base-types';
import type { SerializedValueType } from 'treb-base-types';
import type { Sheet} from './workbook-sheet';
import { VisibleState } from './workbook-sheet';
import type { CellAnchor } from './drawing/drawing';
// import { type GenericDOMElement, XMLUtils } from './xml-utils';

// import { one_hundred_pixels } from './constants';
import { ColumnWidthToPixels } from './column-width';
import type { DataValidation, AnnotationType } from 'treb-data-model';
import { ZipWrapper } from './zip-wrapper';
import type { ConditionalFormat } from 'treb-data-model';
import { LookupMetadata, type MetadataFlags } from './metadata';

import * as OOXML from 'ooxml-types';
import { EnsureArray, FirstTag, IterateTags } from './ooxml';


interface SharedFormula {
  row: number;
  column: number;
  formula: string;
  parse_result: ParseResult;
}

interface SharedFormulaMap { [index: string]: SharedFormula }

/*
interface CellElementType {
  a$: {
    r?: string;
    t?: string;
    s?: string;
    cm?: string;
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
*/

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
    element: OOXML.Cell, // CellElementType,
    shared_formulae: SharedFormulaMap,
    arrays: RangeType[],
    dynamic_arrays: RangeType[],
    merges: RangeType[],
    links: HyperlinkType[],
    // validations: Array<{ address: ICellAddress, validation: DataValidation }>,
    ): CellParseResult | undefined {

    // must have, at minimum, an address (must be a single cell? FIXME)
    const address_attr = element.$attributes?.r;
    if (address_attr === undefined) {
      console.warn('cell missing address');
      return undefined;
    }

    const address = sheet.TranslateAddress(address_attr);
    if (is_range(address)) {
      console.warn('cell has range address');
      return undefined;
    }

    // metadata
    let metadata_flags: MetadataFlags = {};
    if (element.$attributes?.cm !== undefined) {
      const cm_index = element.$attributes.cm;
      if (this.workbook?.metadata) {
        metadata_flags = LookupMetadata(this.workbook.metadata, 'cell', cm_index).flags;
      }
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

    if (element.$attributes?.t === 's') {
      type = 'string';
      if (element.v?.$text !== undefined) {
        const index = Number(element.v.$text);
        if (!isNaN(index) && sheet.shared_strings) {
          value = sheet.shared_strings.Get(index) || '';
          if (value[0] === '=') { value = '\'' + value; }
        }
      }
    }
    else {
      if (element.f !== undefined) {
        type = 'formula'; 
        const formula = element.f.$text || '';
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

              const TrimPrefixes = (name: string) => {

                if (/^_xll\./.test(name)) {
                  name = name.substring(5);
                }
                if (/^_xlfn\./.test(name)) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.info("xlfn:", name);
                  }
                  name = name.substring(6);
                }
                if (/^_xlws\./.test(name)) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.info("xlws:", name);
                  }
                  name = name.substring(6);
                }

                return name;
              };

              const TreeWalker = (unit: ExpressionUnit) => {
                
                if (unit.type === 'call') {

                  // if we see _xlfn.SINGLE, translate that into 
                  // @ + the name of the first parameter...
                  //
                  // this is solving the case where single appears, but it 
                  // doesn't solve the case where it does not appear -- they 
                  // may be using the array flag of the cell as an indicator?
                  // but how then do they know it _should_ be an array? not 
                  // sure, and I don't see any other indication.

                  if (/^_xlfn\.single/i.test(unit.name)) {

                    const first = unit.args[0];
                    if (first.type === 'call') {

                      // we could do this in place, we don't need to copy...
                      // although it seems like a good idea. also watch out,
                      // these SINGLEs could be nested.

                      const replacement: UnitCall = JSON.parse(JSON.stringify(first));
                      replacement.name = '@' + TrimPrefixes(replacement.name);

                      for (let i = 0; i < replacement.args.length; i++) {
                        replacement.args[i] = this.parser.Walk2(replacement.args[i], TreeWalker);
                      }

                      return replacement;
                    }
                    else {
                      console.info("_xlfn.SINGLE unexpected argument", unit.args[0]);
                    }
                  }

                  unit.name = TrimPrefixes(unit.name);

                  // excel export may be translating dynamic range references 
                  // (e.g D2#) to `ANCHORARRAY(D2)`. this is for compatibility
                  // with older versions of excel, I guess? 

                  // we can translate these but let's be conservative here and
                  // start with just ANCHORARRAY taking a single address -- 
                  // that we know we can handle. 

                  // so for example, if the formula is `=SUM(ANCHORARRAY(D2))`
                  // we can translate that to explicitly `=SUM(D2#)`. in our
                  // scheme that's just the address plus a flag bit indicating
                  // "take the full dynamic array range".

                  if (unit.name === 'ANCHORARRAY') {
                    if (unit.args.length === 1 && unit.args[0].type === 'address') {
                      return {
                        ...(unit.args[0]), spill: true,
                      }
                    }
                  }

                }
                return true;

              };

              parse_result.expression = this.parser.Walk2(parse_result.expression, TreeWalker);

              value = '=' + this.parser.Render(parse_result.expression, { missing: '' });
            }
          }

          if (element.f.$attributes?.t === 'shared' && element.f.$attributes.si !== undefined) {
            shared_formulae[element.f.$attributes.si] = {
              row: address.row - 1,
              column: address.col - 1,
              formula: value,
              parse_result: this.parser.Parse(value),
            };
          }

        }
        else if (element.f.$attributes?.t === 'shared' && element.f.$attributes.si !== undefined) {
          const f = shared_formulae[element.f.$attributes.si];
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

        //
        // arrays and spill/dynamic arrays
        //

        if (element.f.$attributes?.t === 'array') {
          const translated = sheet.TranslateAddress(element.f.$attributes.ref ?? '');

          // why are we checking "is_range" here? this should be valid 
          // even if the ref attribute is one cell, if it explicitly
          // says t="array"

          // we will need to adjust it, though? yes, because the lists 
          // only accept ranges. note that range type has a superfluous 
          // sheet parameter? ...

          let range = translated;
          if (!is_range(range)) {
            range = {
              to: { ...range },
              from: { ...range },
              sheet: range.sheet,
            };
          }

          // if (is_range(translated)) 
          {
            if (metadata_flags['dynamic-array']) {
              dynamic_arrays.push(ShiftRange(range, -1, -1));
            }
            else {
              arrays.push(ShiftRange(range, -1, -1));
            }
          }
        }

        if (element.v !== undefined) {

          const V = element.v?.$text ?? '';

          // FIXME: use parser?

          const num = Number(V);
          if (!isNaN(num)) {
            calculated_type = 'number';
            calculated_value = num;
          }
          else {
            calculated_type = 'string';
            calculated_value = V;
          }

        }

      }
      else if (element.v !== undefined) {

        // FIXME: use parser?

        const num = Number(element.v.$text || '');
        if (!isNaN(num)) {
          type = 'number';
          value = num;
        }
        else {
          type = 'string';
          value = element.v.$text || '';
        }
      }
    }

    const shifted: AddressType = { row: address.row - 1, col: address.col - 1 };

    // check if we are in an array. we're relying on the fact that 
    // the array head is the top-left, which I _think_ is universal,
    // but perhaps we should check that... although at this point we have 
    // already added the array so we need to check for root

    for (const set of [arrays, dynamic_arrays]) {
      for (const array of set) {
        if (InRange(array, shifted) && (shifted.row !== array.from.row || shifted.col !== array.from.col)) {
          calculated_type = type;
          calculated_value = value;
          value = undefined;
          type = 'undefined'; // ValueType.undefined;
        }
      }
    }

    const result: CellParseResult = {
      row: shifted.row, column: shifted.col, value, type,
    };

    if (typeof calculated_value !== 'undefined') {
      result.calculated_type = calculated_type;
      result.calculated = calculated_value;
    }

    if (element.$attributes?.s !== undefined) {
      result.style_ref = element.$attributes.s;
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

    for (const range of dynamic_arrays) {
      if (InRange(range, shifted)) {
        result.spill = {
          start: {
            row: range.from.row,
            column: range.from.col,
          }, end: {
            row: range.to.row,
            column: range.to.col,
          },
        }
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

  public ParseConditionalFormat(
      address: RangeType|AddressType, 
      rule: OOXML.CfRule, // ConditionalFormatRule, 
      extensions: OOXML.X14ConditionalFormatting[] = []): ConditionalFormat|ConditionalFormat[]|undefined {

    const area = this.AddressToArea(address);
    const operators = ConditionalFormatOperators;

    // console.info({rule});

    switch (rule.$attributes?.type) {
      case 'duplicateValues':
      case 'uniqueValues':

        {
          let style = {};

          if (rule.$attributes.dxfId !== undefined) {
            style = this.workbook?.style_cache.dxf_styles[rule.$attributes.dxfId] || {};
          }

          return {
            type: 'duplicate-values',
            area,
            style,
            unique: (rule.$attributes.type === 'uniqueValues'),
            priority: rule.$attributes.priority,
          };

        }

      case 'cellIs':
        if (rule.$attributes.operator && rule.formula) {
          let style = {};

          if (rule.$attributes.dxfId !== undefined) {
            style = this.workbook?.style_cache.dxf_styles[rule.$attributes.dxfId] || {};
          }

          if (rule.$attributes.operator === 'between') {
            if (Array.isArray(rule.formula) && rule.formula.length === 2) { 
                // && typeof rule.formula[0] === 'number' && typeof rule.formula[1] === 'number') {

              const between: [number, number] = [
                Number(rule.formula[0]?.$text || ''),
                Number(rule.formula[1]?.$text || ''),
              ];

              return {
                type: 'cell-match',
                expression: '',
                between, // : rule.formula, // special case? ugh
                area,
                style,
                priority: rule.$attributes.priority,
              };

            }
          }

          const operator = operators[rule.$attributes.operator || ''];

          if (!operator) {
            console.info('unhandled cellIs operator:', rule.$attributes.operator, {rule});
          }
          else {
            return {
              type: 'cell-match',
              expression: operator + ' ' + rule.formula,
              area,
              style,
              priority: rule.$attributes.priority,
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

          const first = FirstTag(rule.formula);
          const formula = first?.$text || '';

          /*
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
          */

          let style = {};
          
          if (rule.$attributes.dxfId !== undefined) {
            style = this.workbook?.style_cache.dxf_styles[rule.$attributes.dxfId] || {};
          }

          if (rule.$attributes.type === 'expression' && (area.start.row !== area.end.row || area.start.column !== area.end.column)) {

            // (1) this is only required if there are relative references
            //     in the formula. so we could check and short-circuit.
            //
            // (2) I'd like to find a way to apply this as a single formula,
            //     so there's only one rule required.

            this.parser.Save();
            this.parser.SetLocaleSettings(DecimalMarkType.Period);

            const list: ConditionalFormat[] = [];
            const a2 = new Area(area.start, area.end);

            const parse_result = this.parser.Parse(formula);
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
                  priority: rule.$attributes.priority,
                })

                // console.info(f);
              }
            }

            this.parser.Restore();
            return list;

          }

          return {
            type: 'expression',
            expression: formula,
            area,
            style,
            priority: rule.$attributes.priority,
          };

        }
        break;

      case 'dataBar':
        {
          const show_value = rule.dataBar?.$attributes?.showValue ?? true; // default true

          // const hide_values = !rule.dataBar?.$attributes?.showValue;
          // let extension: any = undefined;

          let extension: OOXML.X14ConditionalFormatting|undefined;

          IterateTags(rule.extLst?.ext, ext => {
            if (ext.id !== undefined) {
              for (const test of extensions) {
                return IterateTags(test.cfRule, cfRule => {
                  if (cfRule.$attributes?.id === ext.id) {
                    extension = test;
                    return false;
                  }
                });
              }
            }
          });

          if (!extension) {
            console.info("conditional format extension not found");
          }

          if (rule.dataBar?.color?.$attributes?.rgb) {

            let negative: Color|undefined = undefined;
            const first = FirstTag(extension?.cfRule);

            const rgb = first?.dataBar?.negativeFillColor?.$attributes?.rgb;
            if (rgb !== undefined) {
              negative = { text: '#' + rgb.toString().substring(2) };
            }

            const fill: Color = { text: '#' + rule.dataBar.color.$attributes.rgb.substring(2) };
            return {
              type: 'data-bar',
              area,
              fill,
              hide_values: !show_value,
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
            if (color_element.$attributes?.rgb) {
              (color as HTMLColor).text = '#' + color_element.$attributes.rgb.substring(2);
            } 
            else if (color_element.$attributes?.theme) {
              (color as ThemeColor).theme = Number(color_element.$attributes.theme) || 0;
              if (color_element.$attributes.tint) {
                (color as ThemeColor).tint = Math.round(Number(color_element.$attributes.tint) * 1000) / 1000;
              }
            }           

            switch (entry.$attributes?.type) {
              case 'min':
                value = 0;
                break;

              case 'max':
                value = 1;
                break;

              case 'percentile':
                value = (Number(entry.$attributes.val) || 0) / 100;
                break;
            }

            stops.push({ color, value });

          }

          return {
            type: 'gradient',
            stops,
            color_space: 'RGB',
            area,
            priority: rule.$attributes.priority,
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
    const dynamic_arrays: RangeType[] = [];
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

    // const FindAll: <T = GenericDOMElement>(path: string) => T[] = XMLUtils.FindAll.bind(XMLUtils, sheet.sheet_data);

    // tab color

    // const tab_color_element = FindAll('worksheet/sheetPr/tabColor');

    const tab_color_element = sheet.root.sheetPr?.tabColor;
    let tab_color: Color|undefined;
    
    if (tab_color_element) {

      if (tab_color_element.$attributes?.theme !== undefined) {
        tab_color = { theme: tab_color_element.$attributes.theme };
        if (tab_color_element.$attributes.tint !== undefined) {
          tab_color.tint = tab_color_element.$attributes.tint;
        }
      }
      if (tab_color_element.$attributes?.rgb !== undefined) {
        const argb = tab_color_element.$attributes.rgb;
        tab_color = {
          text: '#' + (
            argb.length > 6 ?
            argb.substr(argb.length - 6) :
            argb),
        };
      }

    }

    // conditionals 

    // const conditional_formatting = // FindAll('worksheet/conditionalFormatting');
    //   sheet.root.conditionalFormatting;

    // we might need extensions as well? TODO
    // const conditional_formattings = FindAll('worksheet/extLst/ext/x14:conditionalFormattings/x14:conditionalFormatting');

    const extensions: OOXML.X14ConditionalFormatting[] = [];
    IterateTags(sheet.root.extLst?.ext, ext => {
      extensions.push(...EnsureArray(ext.conditionalFormattings?.conditionalFormatting));
    });

    IterateTags(sheet.root.conditionalFormatting, element => {

      if (element.$attributes?.sqref ){

        // FIXME: this attribute might include multiple ranges? e.g.:
        //
        // <conditionalFormatting sqref="B31:I31 B10:E30 G10:I30 F14:F15">

        const parts = element.$attributes.sqref.split(/\s+/);
        for (const part of parts) {
          const area = sheet.TranslateAddress(part);
          if (element.cfRule) {
            IterateTags(element.cfRule, rule => {
              const format = this.ParseConditionalFormat(area, rule, extensions);
              if (format) {
                if (Array.isArray(format)) {
                  conditional_formats.push(...format);
                }
                else {
                  conditional_formats.push(format);
                }
              }
            });
          }
        }

      }

    });
    
    // merges

    // const merge_cells = FindAll('worksheet/mergeCells/mergeCell');

    IterateTags(sheet.root.mergeCells?.mergeCell, element => {
      if (element.$attributes?.ref) {
        const merge = sheet.TranslateAddress(element.$attributes.ref);
        if (is_range(merge)) {
          merges.push(ShiftRange(merge, -1, -1));
        }
      }
    });

    // validation

    IterateTags(sheet.root.dataValidations?.dataValidation, entry => {

      const type = entry.$attributes?.type;
      const ref = entry.$attributes?.sqref;
      const formula = entry.formula1?.$text || '';

      if (ref && formula && type === 'list') {

        let validation: DataValidation|undefined;
        let parse_result = this.parser.Parse(ref);
        const target: IArea[] = [];

        // apparently these are encoded as ranges for merged cells...

        // NOTE: actually you can have a range, then validation applies
        // to every cell in the range. also you can have multiple ranges,
        // apparently separated by spaces.

        if (parse_result.expression) {
          if (parse_result.expression.type === 'address') {
            target.push({start: parse_result.expression, end: parse_result.expression});
          }
          else if (parse_result.expression.type === 'range') {
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

    });
    
    // links

    // const hyperlinks = FindAll('worksheet/hyperlinks/hyperlink');
    // for (const child of hyperlinks) {
    IterateTags(sheet.root.hyperlinks?.hyperlink, child => {

      let address = sheet.TranslateAddress(child.$attributes?.ref || '');
      if (is_range(address)) {
        address = address.from;
      }

      let text = '';
      let reference = '';

      if (child.$attributes?.id !== undefined) {

        text = 'remote link';
        const relationship = sheet.rels[child.$attributes.id];
        if (relationship) {
          reference = relationship.target || '';
        }

      }
      else {

        // what's up with these weird attributes? did we change this at
        // some point and not update this block? (probably)

        /*
        reference = typeof child.__location === 'string' ? child.__location : '';
        text = typeof child.__display === 'string' ? child.__display : '';
        */

        reference = child.$attributes?.location || '';
        text = child.$attributes?.display || '';
        
      }

      links.push({ address, reference, text });

    });

    // base

    let default_row_height = 21;
    let default_column_width = 100; // ?

    const sheet_format = sheet.root.sheetFormatPr;
    if (sheet_format) {
      if (sheet_format.$attributes?.defaultColWidth !== undefined) {
        default_column_width = ColumnWidthToPixels(sheet_format.$attributes.defaultColWidth);
      }
      if (sheet_format.$attributes?.defaultRowHeight) {
        default_row_height = Math.round((sheet_format.$attributes.defaultRowHeight) * 4 / 3); // ??
      }
    }

    // data (and row heights)

    const row_heights: number[] = [];
    const outline: number[] = [];

    // const rows = FindAll('worksheet/sheetData/row');
    // for (const row of rows) {

    IterateTags(sheet.root.sheetData.row, row => {

      const row_index = row.$attributes?.r ?? 1;

      let height = default_row_height;
      if (row.$attributes?.ht !== undefined) {
        height = Math.round((row.$attributes.ht) * 4 / 3); // seems to be the excel unit -> pixel ratio
      }

      if (row.$attributes?.outlineLevel !== undefined) {
        outline[row_index - 1] = row.$attributes?.outlineLevel;
      }

      if (row.$attributes?.s !== undefined) {
        row_styles[row_index - 1] = row.$attributes.s;
      }

      // if there's a height which is not === default height, but 
      // the customHeight attribute is not set, then it's been auto-sized.
      // not sure that's something we need to care about necessarily...

      if (height !== default_row_height) {
        row_heights[row_index - 1] = height;
      }

      // const cells = row.c ? Array.isArray(row.c) ? row.c : [row.c] : [];
      // for (const element of cells) {
      IterateTags(row.c, element => {
        const cell = this.ParseCell(sheet, element, shared_formulae, arrays, dynamic_arrays, merges, links);
        if (cell) {
          data.push(cell);
        }
      });

    });

    const column_styles: number[] = [];
    let default_column_style = -1;
    const column_widths: number[] = [];

    IterateTags(sheet.root.cols, cols => {
      IterateTags(cols.col, child => {
          
        const min = child.$attributes?.min ?? 0; 
        const max = child.$attributes?.max ?? 0;

        if (child.$attributes?.style !== undefined) {

          const style = child.$attributes.style;

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
        if (child.$attributes?.customWidth) {

          let width = child.$attributes.width ?? 0;

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

      });
    });

    // --- import tables -------------------------------------------------------

    IterateTags(sheet.root.tableParts, tablePart => {
      IterateTags(tablePart.tablePart, child => {

        const rel = child.$attributes?.id;
        if (rel !== undefined) {
          let reference = '';

          const relationship = sheet.rels[rel];
          if (relationship) {
            reference = relationship.target || '';
            const description = this.workbook?.ReadTable(reference);
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

      });
    });

    // --- import drawings -----------------------------------------------------

    // wip...

    // const drawings = FindAll('worksheet/drawing');
    const chart_descriptors: AnchoredChartDescription[] = [];
    const image_descriptors: AnchoredImageDescription[] = [];
    const textbox_descriptors: AnchoredTextBoxDescription[] = [];

    if (this.workbook) {
      const workbook = this.workbook;
      IterateTags(sheet.root.drawing, child => {
      
        const rel = child.$attributes?.id;
        if (rel !== undefined) {

          let reference = '';

          const relationship = sheet.rels[rel];
          if (relationship) {
            reference = relationship.target || '';
          }

          if (reference) {
            const drawing = workbook.ReadDrawing(reference);
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
      });
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

          case ChartType.Histogram:
            type = 'treb-chart';
            func = 'Histogram.Plot';
            if (series?.length) {
              // ...
            }
            args[1] = descriptor.chart.title;
            break;

          case ChartType.Box:
            type = 'treb-chart';
            func = 'Box.Plot';
            if (series?.length) {
              args[0] = `Group(${series.map(s => `Series(${s.title || ''},,${s.values||''})`).join(', ')})`;
              // console.info("S?", {series}, args[0])
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

            if (descriptor.chart.type === ChartType.Column && descriptor.chart.flags?.includes('stacked')) {
              args[3] = '"stacked"';
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

    IterateTags(sheet.root.extLst?.ext, entry => {
      IterateTags(entry.sparklineGroups?.sparklineGroup, group => {

      // const groups = XMLUtils.FindAll(entry, `${prefix}:sparklineGroups/${prefix}:sparklineGroup`);
      // for (const group of groups) {

        let func = 'Sparkline.line';
        let reference = '';
        let source = '';

        if (group.$attributes?.type === 'column') {
          func = 'Sparkline.column';
        }

        // TODO: gap optional
        // TODO: colors

        IterateTags(group.sparklines.sparkline, sparkline => {
          source = sparkline.f?.$text ?? '';
          reference = sparkline.sqref?.$text ?? '';
        });

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

      });
      
    });

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