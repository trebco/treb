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

// import { Parser } from 'treb-parser';

import type { Area } from './area';
import type { CellStyle } from './style';
import type { TextPart } from './text_part';
import type { Complex } from './value-type';
import { ValueType, GetValueType } from './value-type';
import type { CellValue, UnionValue } from './union';
import type { PreparedText } from './render_text';
import type { Table } from './table';

export interface RenderFunctionOptions {
  height: number;
  width: number;
  context: CanvasRenderingContext2D;
  cell: Cell;
  style: CellStyle;
  scale?: number;
}

export interface RenderFunctionResult {
  handled: boolean;

  /** set true to add text metrics to cell rendering data */
  // metrics?: boolean;

  /** set to add "title" (tooltip) info */
  // title?: string;

  /** override text [FIXME: union type?] */
  // override_text?: string;

}

export type RenderFunction = (options: RenderFunctionOptions) => RenderFunctionResult;

export interface ClickFunctionOptions {
  cell: Cell;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
}

// I believe this was intended for hyperlinks, but they don't work that
// way any more; going to remove, temp, but not sure if we actually need
// it (not used for checkbox)

/*
export interface ClickFunctionEvent {
  type: string;
  data?: any;
}
*/

export interface ClickFunctionResult {

  /**
   * change the cell value, to the value passed here
   * 
   * NOTE: this must be in canonical form (english), not translated.
   */
  value?: CellValue;

  /** 
   * set to true to block normal click handling semantics 
   * (selecting the cell, generally) 
   */
  block_selection?: boolean;

  /** 
   * return an event that will be broadcast to listeners using the standard
   * event dispatch
   */
  // event?: ClickFunctionEvent;
}

export type ClickFunction = (options: ClickFunctionOptions) => ClickFunctionResult;


/*
 * restructuring from the old system, which had lots of separate arrays for
 * things. for the most part I think having a single array (or object) with
 * objects will be more useful (if not necessarily more efficient). the
 * standout case where this will be inefficient is in passing data to a
 * calculation service, where style information is not useful.
 *
 * things that are in the cell class:
 *  - raw data (formula or value)
 *  - formatted representation
 *  - type (data type including formula or value, implicitly)
 *  - array pointer -- if this cell is part of an array, the array object
 *
 * things that are NOT in the cell class:
 *  - raw per-cell style information. this is in a separate array (object).
 */

export class Cell {

  // --- static methods -------------------------------------------------------

  public static StringToColumn(s: string): number{
    let index = 0;
    s = s.toUpperCase();
    for ( let i = 0; i < s.length; i++ ){
      index *= 26;
      index += (s.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  /*
  public static FormulaDependencies(formula: string): Area[] {

    const dependencies = [];

    if (!formula) return []; // also matches ""
    if (formula.trim()[0] !== '=') return [];

    const results = parser.Parse(formula);

    for (const key of Object.keys(results.dependencies.addresses)){
      const address = results.dependencies.addresses[key];
      dependencies.push(new Area(address));
    }

    for (const key of Object.keys(results.dependencies.ranges)){
      const range = results.dependencies.ranges[key];
      dependencies.push(new Area(range.start, range.end, true));
    }

    // dedupe (...)

    return dependencies;

  }
  */

  /*
  public static GetValueType(value: unknown): ValueType {

    switch (typeof value){
      
      case 'undefined':
        return ValueType.undefined;

      case 'number':
        return ValueType.number;

      case 'boolean':
        return ValueType.boolean;

      case 'object':
        if (value === null) {
          return ValueType.undefined;
        }
        return ValueType.object;

      case 'string':
        if (value[0] === '=') {
          return ValueType.formula;
        }
        return ValueType.string;

      default: // function or symbol
        return ValueType.error;

    }
  }
  */

  // --- class fields ---------------------------------------------------------

  // the basic value, which can be omitted (in the case of an array cell)
  public value?: CellValue; // any;

  // the value type, js intrinics plus a special type for formula
  public type: ValueType = ValueType.undefined;

  // the calculated value, returned from calculation service
  public calculated?: CellValue; // |FunctionError; // any;

  // the calculated type. we're separating calculation from rendering, since
  // we may calculate values that we don't need to render.
  public calculated_type?: ValueType;

  // the value formatted as a string, for display. this is separate from the
  // calculated value, because the renderer might still need to check the
  // value in the case of negative color or value-based styling.
  public formatted?: string | TextPart[];

  /**
   * rendered type may be different than value type: could be a function
   * returns a number, or an error. rendering an empty value should result
   * in a string, so you can test on this type -- it should never be 0
   * (or undefined) if the cell has been rendered.
   * 
   * NOTE: no one really uses this. it's only read in two places -- one in
   * grid to check if it's a number and we want to format as % (which seems 
   * wrong anyway, because what if it's a function?) -- and in sheet, as a 
   * flag indicating we have already rendered it (it gets flushed on change).
   * 
   * so we could maybe remove it or switch to a boolean or something... is 
   * boolean any smaller than number?
   */
  public rendered_type?: ValueType;

  // style is an index into the style dictionary, not the actual style
  // data (FIXME: if style is an object, this would just be a pointer, so
  // why not just use a reference?)
  // style:number = 0;
  public style?: CellStyle;

  /** if this cell is part of an array, pointer to the area. */
  public area?: Area;

  /** testing spill */
  public spill?: Area;

  /**
   * if this cell is merged, pointer to the area
   */
  public merge_area?: Area;

  /** this cell is part of a table */
  public table?: Table;

  /**
   * opaque data for cell rendering, we can cache some data
   * that's reused frequently (is that wasting space?)
   *
   * render data will be flushed any time there is any change to
   * the cell data or style.
   *
   * UPDATE: renderer data is no longer flushed. we set a dirty flag.
   */
  public renderer_data?: {
    text_data?: PreparedText;
    overflowed?: boolean;
    width?: number;
    height?: number;
  };

  /**
   * step 1: invert flag (dirty -> clean)
   */
  public render_clean: boolean[] = [];

  public note?: string;

  /**
   * moving hyperlink in here, as a cell property. hyperlink will not be
   * removed on value change, but will be removed on clear/delete.
   */
  public hyperlink?: string;

  /* flag indicates do not paint */
  public editing?: boolean;

  /** 
   * TODO: add a return value which affects control flow. default/falsy should
   * behave as now, for backwards compatibility; but it should be possible to
   * return a value that says "don't exit the standard rendering process"
   * 
   * UPDATE: return value now means "I have handled this", so if you paint you
   * should return true. that's a breaking change but we should get help from
   * tooling.
   */
  public render_function?: RenderFunction; // (options: RenderFunctionOptions) => RenderFunctionResult;

  public click_function?: ClickFunction; // (options: ClickFunctionOptions) => ClickFunctionResult;

  /** 
   * moving locked property to style. not because it's properly a style,
   * or not properly a property of cell, but rather because that will allow
   * us to cascade the property over areas.
   */

  /** not editable */
  // public locked?: boolean;

  // public validation?: DataValidation;

  // --- class methods --------------------------------------------------------

  constructor(value?: CellValue, value_type?: ValueType){
    if (typeof value !== 'undefined') this.Set(value, value_type);
  }

  /** type guard */
  public ValueIsNumber() : this is { value: number } {
    return this.type === ValueType.number;
  }

  /** type guard */
  public ValueIsFormula() : this is { value: string } {
    return this.type === ValueType.formula;
  }

  /** type guard */
  public ValueIsBoolean() : this is { value: boolean } {
    return this.type === ValueType.boolean;
  }

  /** type guard */
  public ValueIsComplex() : this is { value: Complex } {
    return this.type === ValueType.complex;
  }

  ///

  /** flush style information and things that rely on it (formatted value) */
  public FlushStyle(): void{
    this.formatted = this.rendered_type = this.style = undefined;
    this.render_clean = [];
  }

  /** flush array information */
  public FlushArray(): void{
    this.area = undefined;
  }

  /** flush cached data: formatted and calculated */
  public FlushCache(): void{
    this.calculated 
      = this.calculated_type 
      = this.formatted 
      = this.rendered_type 
      = this.render_function
      = this.click_function
      = undefined;
    this.render_clean = [];
  }

  public Reset(): void{
    this.type = ValueType.undefined;
    this.value
      = this.spill
      = this.note
      = this.hyperlink
      = this.formatted
      = this.rendered_type
      = this.style
      = this.calculated
      = this.calculated_type
      = this.area
      = this.renderer_data // keep here?
      = this.render_function
      = this.click_function
      = undefined;
    this.render_clean = [];
  }

  public Set(value: CellValue, type = GetValueType(value)): void {
    this.value = value;
    this.type = type;
    this.spill = // added
      this.formatted =
      this.rendered_type =
      this.style =
      this.calculated =
      this.calculated_type =
      this.render_function =
      this.click_function =
      this.area = undefined;
    this.render_clean = [];
  }

  /** 
   * sets calculated value and flushes cached value 
   */
  public SetCalculatedValue(value: CellValue, type = GetValueType(value)): void {

    // is it possible to explicitly set a calculated value of undefined?
    // that should be different from clearing. if the calculated value is
    // undefined, we want to set it to 0.

    if (value === undefined) {
      value = 0;
      type = ValueType.number;
    }

    if (this.calculated === value) {
      return;
    }

    this.calculated = value;
    this.calculated_type = type;
    this.formatted = this.rendered_type = undefined;
    this.render_clean = [];
  }

  /* *
   * composite method for setting value or error, based on value
   * not used? (...)
   * /
  public SetCalculatedValueOrError(value: any, type?: ValueType): void {

    console.info("SCVE", value, type);

    if (typeof type === 'undefined') {
      if (typeof value === 'object' && value.error) {
        type = ValueType.error;
        value = value.error;
      }
      else {
        type = GetValueType(value);
      }
    }
    if (this.calculated === value) return;
    this.calculated = value;
    this.calculated_type = type;
    this.formatted = this.rendered_type = undefined;
    this.render_clean = [];
  }
  */

  /**
   * get value -- calculation result (not formatted) or literal. for
   * literal strings, we strip leading apostrophes (these are used to
   * prevent parsing of literal strings that look like other things).
   */
  public GetValue(): CellValue {
    if (this.calculated_type) return this.calculated;
    // if (this.type === ValueType.string &&
    //    this.value && this.value[0] === '\'') return this.value.slice(1);

    // we maintain a type, but typescript won't associate the two so
    // this test needs to use the actual type

    if (typeof this.value === 'string' && this.value[0] === '\'') { return this.value.slice(1); }

    return this.value;
  }

  /* *
   * new version of GetValue that preserves errors. for non-errors this
   * behaves identically to the original GetValue. for errors, returns
   * an error object {error: string};
   * /
  public GetValue2(): CellValue | {error: CellValue} {
    if (this.calculated_type) {
      return (this.calculated_type === ValueType.error) ?
        { error: this.calculated } : this.calculated;
    }
    // if (this.type === ValueType.string &&
    //    this.value && this.value[0] === '\'') return this.value.slice(1);
    if (typeof this.value === 'string' && this.value[0] === '\'') { return this.value.slice(1); } // @see GetValue

    return this.value;
  }
  */

  /* *
   * we have an issue where a reference to an empty cell winds up returning
   * a string, goes into a numerical calculation, and slows everything down.
   *
   * this is kind of a corner case. it's not that there's a reference to an
   * empty cell -- that works OK. there's a reference to a cell, which is
   * itself a reference to an empty cell. that's why it's a function, which
   * is being returned as a string.
   *
   * in this case because it's the function value, I think returning 0 is ok.
   * BUT, it still might make sense to return undefined.
   * /
  public GetValue3(): CellValue|{error: string} { // |FunctionError {

    // so... what is this? shouldn't this be an object? (...)
   
    if (this.calculated_type) {
      return (this.calculated_type === ValueType.error) ?
        { error: this.calculated as string } : this.calculated;
    }

    if (this.type === ValueType.formula) {
      // formula, but no calc type... undefined or zero? (...)
      return 0; // undefined;
    }
    // if (this.type === ValueType.string &&
    //    this.value && this.value[0] === '\'') return this.value.slice(1);
    if (typeof this.value === 'string' && this.value[0] === '\'') { return this.value.slice(1); } // @see GetValue

    return this.value;
  }
  */

  /**
   * this function follows the rule of GetValue3, which is: if the type
   * is a function but there is no calculated value, then return 0.
   */
  public GetValue4(): UnionValue {

    if (this.calculated_type) {
      return {
        type: this.calculated_type,
        value: this.calculated,
      } as UnionValue;
    }

    if (this.type === ValueType.formula) {
      return {
        type: ValueType.number,
        value: 0,
      }
    }

    return { 
      type: this.type, 
      value: (typeof this.value === 'string' && this.value[0] === '\'') ? this.value.slice(1) : this.value, // @see GetValue 
    }  as UnionValue;

  }

  /**
   * set note. set undefined to clear.
   */
  public SetNote(note?: string): void {
    this.note = note;
    this.render_clean = [];
  }

  /** sets error (FIXME: error type) */
  public SetCalculationError(err = 'ERR'): void {
    this.SetCalculatedValue(err, ValueType.error);
  }

  public SetArray(area: Area): void {
    this.type = ValueType.undefined;
    this.value =
      this.formatted =
      this.rendered_type =
      this.style =
      this.hyperlink = // note?
      this.calculated =
      this.calculated_type = undefined;
    this.area = area;
    this.render_clean = [];
  }

  public SetArrayHead(area: Area, value: CellValue): void {
    this.type = GetValueType(value);
    this.value = value;
    this.formatted =
      this.rendered_type =
      this.style =
      this.calculated =
      this.calculated_type = undefined;
    this.area = area;
    this.render_clean = [];
  }

}
