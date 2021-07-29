
import { Area, CellValue, Complex, IArea, ICellAddress, IsCellAddress, Style } from 'treb-base-types';
import { APIUtils as Utils } from './api-utils';

import type { EmbeddedSpreadsheetBase } from '../embedded-spreadsheet-base';
import { NumberFormatCache, ValueParser } from 'treb-format';

type RangeReference = string | ICellAddress | IArea;

export interface GetRangeOptions {

  /** 
   * return formatted values (apply number formats and return strings)
   */
  formatted?: boolean;

  /** 
   * return formulas instead of values. formula takes precedence over
   * "formatted"; if you pass both, returned values will *not* be formatted.
   * 
   * FIXME: that should throw?
   */
  formula?: boolean;

}

export interface SetRangeOptions {

  /** transpose rectangular array before inserting */
  transpose?: boolean;

  /** recycle values (R-style) */
  recycle?: boolean;

  /** apply as an array (as if you pressed ctrl+shift+enter) */
  array?: boolean;

}

export interface ScrollToOptions {

  /** scroll in x-direction. defaults to true. */
  x?: boolean;

  /** scroll in y-direction. defaults to true. */
  y?: boolean;

  /** 
   * smooth scrolling, if supported. we use scrollTo so support is as here:
   * https://www.google.com/search?q=mdn+scrollto
   */
  smooth?: boolean;
}

/**
 * we are creating a wrapper class for calling methods in the spreadsheet.
 * the aim here is to have an API we can overlay on the underlying class
 * and modify as necessary without requiring code changes in the source.
 * 
 * we might actually move code here from the sheet class, since we don't
 * need nice formatting in the core.
 */
export class APIv1 {

  constructor(
    protected base: EmbeddedSpreadsheetBase) { }

  public get loaded(): boolean { 
    return this.base.loaded;
  }

  public get scale(): number {
    return this.base.grid.scale;
  }

  public set scale(value: number) {
    this.base.grid.scale = value;
  }

  /** scroll to the given address */
  public ScrollTo(reference: RangeReference, options: ScrollToOptions = {}): void {

    if (typeof reference === 'string') {
      reference = this.base.calculator.ResolveAddress(reference);
    }

    // the grid method has defaults, but it's not obvious what 
    // they are and they're not visible through interfaces (?)

    // in any case we can set them here explicitly

    options = {
      x: true,
      y: true,
      smooth: false,
      ...options,
    };

    this.base.grid.ScrollTo(
      IsCellAddress(reference) ? reference : reference.start,
      options.x, options.y, options.smooth);

  }

  /** recalculate spreadsheet */
  public Calculate(): Promise<void> {
    return this.base.Recalculate();
  }

  /** 
   * resolve a string address/range to a range or address object. reference
   * is a string "A1", "Sheet1!B2:C3". if a sheet name is not passed, the 
   * current active sheet is used. you can also pass a named range as reference.
   */
  public RangeReference(reference: string): ICellAddress | IArea | undefined {

    // is : a legal character in sheet names? even quoted? [A: no]

    // FIXME: we're using the sheet EnsureAddress method, but that should
    // move either in here or into some sort of helper class

    const result = this.base.calculator.ResolveAddress(reference);

    if (IsCellAddress(result)) {
      return result.sheet_id ? result : undefined;
    }

    return result.start.sheet_id ? result : undefined;

  }

  /**
   * evaluate an expression in the context of the spreadsheet. if you use 
   * relative references (ranges without sheet names), they will be evaluated
   * as referring to the current active sheet.
   */
  public Evaluate(expression: string): CellValue | CellValue[][] | undefined {
    return this.base.calculator.Evaluate(expression);
  }

  /**
   * returns the current selection, as a string reference. returns empty
   * string if there's no selection (you can test falsy on that).
   */
  public GetSelection(): string {

    const ref = this.base.grid.GetSelection();

    if (ref.empty) {
      return '';
    }

    let range = '';

    if (ref.area.count > 1) {
      range = Area.CellAddressToLabel(ref.area.start) + ':' +
        Area.CellAddressToLabel(ref.area.end);
    }
    else {
      range = Area.CellAddressToLabel(ref.area.start);
    }

    // is there a function to resolve sheet? actually, don't we know that
    // the active selection must be on the active sheet? (...)

    const sheet_id = ref.area.start.sheet_id || this.base.grid.active_sheet.id;
    const sheet_name = Utils.ResolveSheetName(this.base, sheet_id, true);

    return sheet_name ? sheet_name + '!' + range : range;

  }

  public GetRange(range?: RangeReference, options: GetRangeOptions = {}): CellValue | CellValue[][] {

    if (!range) {
      range = this.GetSelection();
    }

    if (typeof range === 'string') {
      range = this.RangeReference(range);
    }

    if (range) {
      return this.base.grid.GetRange(range, options.formula, options.formatted);
    }

    return undefined;
  }

  /**
   * set data in range
   */
  public SetRange(range: RangeReference | undefined, data: CellValue | CellValue[][], options: SetRangeOptions = {}): void {

    if (!range) {
      range = this.GetSelection();
    }

    if (typeof range === 'string') {
      range = this.RangeReference(range);
    }

    if (range) {
      return this.base.grid.SetRange(
        IsCellAddress(range) ? new Area(range) : new Area(range.start, range.end),
        data, options.recycle, options.transpose, options.array);
    }

  }

  public FormatNumber(value: number, format = 'General'): string {
    return NumberFormatCache.Get(format).Format(value);
  }

  public ParseNumber(text: string): number | boolean | string | undefined | Complex {
    return ValueParser.TryParse(text).value;
  }

  /**
   * apply style to range. 
   * 
   * @param delta optionally apply delta (only overwrite explicit properties). default TRUE.
   */
  public ApplyStyle(range: RangeReference, style: Style.Properties = {}, delta = true): void {

    const reference = this.base.calculator.ResolveAddress(range);

    const area: Area = IsCellAddress(reference) ?
      new Area(reference) :
      new Area(reference.start, reference.end);

    this.base.grid.ApplyStyle(area, style, delta);

  }

  /**
   * clear name
   */
  public ClearName(name: string): void {

    // NOTE: AC is handled internally
    this.base.grid.SetName(name);

  }

  /**
   * set name at selection
   */
  public DefineName(name: string, reference?: RangeReference): void {

    if (!reference) {
      reference = this.GetSelection();
    }

    if (typeof reference === 'string') {
      reference = this.base.calculator.ResolveAddress(reference);
    }

    if (!reference) {
      throw new Error('invalid reference');
    }

    const area: Area = IsCellAddress(reference) ?
      new Area(reference) :
      new Area(reference.start, reference.end);

    // NOTE: AC is handled internally

    this.base.grid.SetName(name, new Area(area.start, area.end));

  }

  /**
   * get the internal sheet ID for a sheet, by name or by number (in order).
   * this is useful if you are manually creating range references.
   * 
   * returns 0 on error (not found). 0 is not a valid sheet ID.
   */
  public GetSheetID(index: number|string): number {

    if (typeof index === 'number') {
      const sheet = this.base.grid.model.sheets[index];
      return sheet?.id || 0;
    }
    
    const lc = index.toLowerCase();
    for (const sheet of this.base.grid.model.sheets) {
      if (sheet.name.toLowerCase() === lc) {
        return sheet.id;
      }
    }
    
    return 0;

  }

  /**
   * show or hide sheet, by name or index
   */
  public ShowSheet(index: number | string = 0, show = true): void {
    this.base.grid.ShowSheet(index, show);
  }

  /**
   * activate sheet, by name or index
   */
  public ActivateSheet(index: number | string): void {
    this.base.grid.ActivateSheet(index);
  }

}
