
// import { Parser } from 'treb-parser';

import { Area, IArea } from './area';
import { Style } from './style';
import { TextPart } from './text_part';
import { ValueType, GetValueType } from './value-type';

import { CellValue, UnionValue } from './union';

// static global to avoid export in typings file
// const parser = new Parser();

export interface RenderFunctionOptions {
  height: number;
  width: number;
  context: CanvasRenderingContext2D;
  cell: Cell;
}

export interface ClickFunctionOptions {
  cell: Cell;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ClickFunctionResult {
  value?: CellValue;
  block_selection?: boolean;
}

/**
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

/* *
 * I _think_ using enums is faster. I'm not actually sure about that, though.
 * it stands to reason that a single int compare is faster than a string
 * compare, but you never know with javascript. undefined preferred over null.
 * formula implies a string.
 *
 * undefined is 0 so we can test it as falsy.
 *
 * we're passing this type information out to calculators, so it needs
 * to have known values. DO NOT MODIFY EXISTING INDEXES, or at least be
 * aware of the implications. definitely do not change undefined => 0.
 * /
export enum ValueType {
  undefined = 0,

  // formula is a string; we usually test the first character === '='
  formula = 1,
  string = 2,
  number = 3,
  boolean = 4,

  // we don't actually use this type, it's here for matching only
  object = 5,

  // error is a STRING VALUE... object errors are layered on top? is that 
  // correct? (...) it sort of makes sense... since we have separate typing
  error = 6,
}
*/

/**
 * validation TODO: date, number, boolean, &c
 */
export enum ValidationType {
  List,
  Date,
  Range,
  Number,
  Boolean,
}

export interface DataValidationRange {
  type: ValidationType.Range;
  area: IArea;
}

export interface DataValidationList {
  type: ValidationType.List;
  list: CellValue[];
}

export interface DataValidationDate {
  type: ValidationType.Date;
}

export interface DataValidationNumber {
  type: ValidationType.Number;
}

export interface DataValidationBoolean {
  type: ValidationType.Boolean;
}

export type DataValidation 
  = DataValidationList
  | DataValidationRange
  | DataValidationNumber
  | DataValidationDate
  | DataValidationBoolean;

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

  // rendered type may be different than value type: could be a function
  // returns a number, or an error. rendering an empty value should result
  // in a string, so you can test on this type -- it should never be 0
  // (or undefined) if the cell has been rendered.
  public rendered_type?: ValueType;

  // style is an index into the style dictionary, not the actual style
  // data (FIXME: if style is an object, this would just be a pointer, so
  // why not just use a reference?)
  // style:number = 0;
  public style?: Style.Properties;

  /** if this cell is part of an array, pointer to the area. */
  public area?: Area;

  /**
   * if this cell is merged, pointer to the area
   */
  public merge_area?: Area;

  /**
   * opaque data for cell rendering, we can cache some data
   * that's reused frequently (is that wasting space?)
   *
   * render data will be flushed any time there is any change to
   * the cell data or style.
   *
   * UPDATE: renderer data is no longer flushed. we set a dirty flag.
   *
   */
  public renderer_data?: any;

  public render_dirty = true;

  public note?: string;

  public render_function?: (options: RenderFunctionOptions) => void;

  public click_function?: (options: ClickFunctionOptions) => ClickFunctionResult;

  /** not editable */
  public locked?: boolean;

  public validation?: DataValidation;

  // --- class methods --------------------------------------------------------

  constructor(value?: any, value_type?: ValueType){
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

  ///

  /** flush style information and things that rely on it (formatted value) */
  public FlushStyle(): void{
    this.formatted = this.rendered_type = this.style = undefined;
    this.render_dirty = true;
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
    this.render_dirty = true;
  }

  public Reset(): void{
    this.type = ValueType.undefined;
    this.value
      = this.note
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
    this.render_dirty = true;
  }

  public Set(value: CellValue, type = GetValueType(value)): void {
    this.value = value;
    this.type = type;
    this.formatted =
      this.rendered_type =
      this.style =
      this.calculated =
      this.calculated_type =
      this.render_function =
      this.click_function =
      this.area = undefined;
    this.render_dirty = true;
  }

  /** sets calculated value and flushes cached value */
  public SetCalculatedValue(value: CellValue, type = GetValueType(value)): void {
    if (this.calculated === value) return;
    this.calculated = value;
    this.calculated_type = type;
    this.formatted = this.rendered_type = undefined;
    this.render_dirty = true;
  }

  /**
   * composite method for setting value or error, based on value
   */
  public SetCalculatedValueOrError(value: any, type?: ValueType) {
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
    this.render_dirty = true;
  }

  /**
   * get value -- calculation result (not formatted) or literal. for
   * literal strings, we strip leading apostrophes (these are used to
   * prevent parsing of literal strings that look like other things).
   */
  public GetValue(){
    if (this.calculated_type) return this.calculated;
    // if (this.type === ValueType.string &&
    //    this.value && this.value[0] === '\'') return this.value.slice(1);

    // we maintain a type, but typescript won't associate the two so
    // this test needs to use the actual type

    if (typeof this.value === 'string' && this.value[0] === '\'') { return this.value.slice(1); }

    return this.value;
  }

  /**
   * new version of GetValue that preserves errors. for non-errors this
   * behaves identically to the original GetValue. for errors, returns
   * an error object {error: string};
   */
  public GetValue2() {
    if (this.calculated_type) {
      return (this.calculated_type === ValueType.error) ?
        { error: this.calculated } : this.calculated;
    }
    // if (this.type === ValueType.string &&
    //    this.value && this.value[0] === '\'') return this.value.slice(1);
    if (typeof this.value === 'string' && this.value[0] === '\'') { return this.value.slice(1); } // @see GetValue

    return this.value;
  }

  /**
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
   */
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

  /**
   * this function follows the rule of GetValue3, which is: if the type
   * is a function but there is no calculated value, then return 0.
   */
  public GetValue4(): UnionValue {

    if (this.calculated_type) {
      return {
        type: this.calculated_type,
        value: this.calculated,
      };
    }

    if (this.type === ValueType.formula) {
      return {
        type: ValueType.number, // but which type? (...)
        value: 0,
      }
    }

    return { 
      type: this.type, 
      value: (typeof this.value === 'string' && this.value[0] === '\'') ? this.value.slice(1) : this.value, // @see GetValue 
    };

  }

  /**
   * set note. set undefined to clear.
   */
  public SetNote(note?: string) {
    this.note = note;
    this.render_dirty = true;
  }

  /** sets error (FIXME: error type) */
  public SetCalculationError(err = 'ERR'){
    this.SetCalculatedValue(err, ValueType.error);
  }

  public SetArray(area: Area){
    this.type = ValueType.undefined;
    this.value =
      this.formatted =
      this.rendered_type =
      this.style =
      this.calculated =
      this.calculated_type = undefined;
    this.area = area;
    this.render_dirty = true;
  }

  public SetArrayHead(area: Area, value: CellValue){
    this.type = GetValueType(value);
    this.value = value;
    this.formatted =
      this.rendered_type =
      this.style =
      this.calculated =
      this.calculated_type = undefined;
    this.area = area;
    this.render_dirty = true;
  }

}
