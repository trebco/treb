

/**
 * Structure represents a cell address. Note that row and column are 0-based.
 */
export interface ICellAddress {

  /** 0-based row */
  row: number;

  /** 0-based column */
  column: number;

  absolute_row?: boolean;
  absolute_column?: boolean;
  sheet_id?: number;
}

/**
 * this version of the interface requires a sheet ID
 */
export interface ICellAddress2 extends ICellAddress {
  sheet_id: number;
}

/**
 * Structure represents a 2d range of cells.
 * 
 * @privateRemarks
 * 
 * FIXME: should be just Partial<Area>? (...) OTOH, this at least
 * enforces two addresses, which seems useful
 */
export interface IArea {
  start: ICellAddress;
  end: ICellAddress;
}

/**
 * type guard function
 * FIXME: is there a naming convention for these?
 */
export const IsCellAddress = (obj: any): obj is ICellAddress => {
  return (
    typeof obj === 'object' &&
    typeof obj.row !== 'undefined' &&
    typeof obj.column !== 'undefined');
};

export interface Dimensions {
  rows: number;
  columns: number;
}

/**
 * class represents a rectangular area on a sheet. can be a range,
 * single cell, entire row/column, or entire sheet.
 *
 * "entire" row/column/sheet is represented with an infinity in the
 * start/end value for row/column/both, so watch out on loops. the
 * sheet class has a method for reducing infinite ranges to actual
 * populated ranges.
 */
export class Area implements IArea { // }, IterableIterator<ICellAddress> {

  // tslint:disable-next-line:variable-name
  private start_: ICellAddress;

  // tslint:disable-next-line:variable-name
  private end_: ICellAddress;
  
  /**
   *
   * @param start
   * @param end
   * @param normalize: calls the normalize function
   */
   constructor(start: ICellAddress, end: ICellAddress = start, normalize = false){

    /*
    // copy
    this.start_ = {
      row: start.row, column: start.column,
      absolute_column: !!start.absolute_column,
      absolute_row: !!start.absolute_row };

    this.end_ = {
      row: end.row, column: end.column,
      absolute_column: !!end.absolute_column,
      absolute_row: !!end.absolute_row };
    */

    // patch nulls. this is an effect of transferring via JSON, 
    // infinities are -> null. make sure to strict === null.

    // NOTE that the patch function returns a clone, so we can store the 
    // returned object (instead of copying, which we used to do).

    this.end_ = this.PatchNull(end);
    this.start_ = this.PatchNull(start);

    if (normalize) this.Normalize();

    // this.ResetIterator();

  }

  public static FromColumn(column: number): Area {
    return new Area({row: Infinity, column});
  }

  public static FromRow(row: number): Area {
    return new Area({row, column: Infinity});
  }

  public static ColumnToLabel(c: number): string {
    let s = String.fromCharCode(65 + c % 26);
    while (c > 25){
      c = Math.floor(c / 26) - 1;
      s = String.fromCharCode(65 + c % 26) + s;
    }
    return s;
  }

  public static CellAddressToLabel(address: ICellAddress, sheet_id = false): string {

    const prefix = sheet_id ? `${address.sheet_id || 0}!` : '';

    return prefix
      + (address.absolute_column ? '$' : '')
      + this.ColumnToLabel(address.column)
      + (address.absolute_row ? '$' : '')
      + (address.row + 1);

  }

  /**
   * merge two areas and return a new area.
   * UPDATE to support arbitrary arguments
   */
  public static Join(base: IArea, ...args: Array<IArea|undefined>): Area {
    const area = new Area(base.start, base.end);
    for (const arg of args) {
      if (arg) {
        area.ConsumeAddress(arg.start);
        area.ConsumeAddress(arg.end);
      }
    }
    return area;
  }

  /**
   * creates an area that expands the original area in all directions
   * (except at the top/left edges)
   */
  public static Bleed(area: IArea, length = 1): Area {
    return new Area({
        row: Math.max(0, area.start.row - length),
        column: Math.max(0, area.start.column - length),
      }, {
        row: area.end.row + length,
        column: area.end.column + length,
      });
  }



  /** accessor returns a _copy_ of the start address */
  public get start(): ICellAddress {
    return { ...this.start_ };
  }

  /** accessor */
  public set start(value: ICellAddress){ this.start_ = value; }

  /** accessor returns a _copy_ of the end address */
  public get end(): ICellAddress {
    return { ...this.end_ };
  }

  /** accessor */
  public set end(value: ICellAddress){ this.end_ = value; }

  /** returns number of rows, possibly infinity */
  public get rows(): number {
    if (this.start_.row === Infinity || this.end_.row === Infinity) return Infinity;
    return this.end_.row - this.start_.row + 1;
  }

  /** returns number of columns, possibly infinity */
  public get columns(): number {
    if (this.start_.column === Infinity || this.end_.column === Infinity) return Infinity;
    return this.end_.column - this.start_.column + 1;
  }

  /** returns number of cells, possibly infinity */
  public get count(): number {
    return this.rows * this.columns;
  }

  /** returns flag indicating this is the entire sheet, usually after "select all" */
  public get entire_sheet(): boolean {
    return this.entire_row && this.entire_column;
  }

  /** returns flag indicating this range includes infinite rows */
  public get entire_column(): boolean {
    return (this.start_.row === Infinity);
  }

  /** returns flag indicating this range includes infinite columns */
  public get entire_row(): boolean {
    return (this.start_.column === Infinity);
  }

  public PatchNull(address: ICellAddress): ICellAddress {
    const copy = { ...address };
    if (copy.row === null) { copy.row = Infinity; }
    if (copy.column === null) { copy.column = Infinity; }
    return copy;
  }

  public SetSheetID(id: number) {
    this.start_.sheet_id = id;
  }

  public Normalize(){
    /*
    let columns = [this.start.column, this.end.column].sort((a, b) => a-b);
    let rows = [this.start.row, this.end.row].sort((a, b) => a-b);

    this.start_ = {row: rows[0], column: columns[0]};
    this.end = {row:rows[1], column: columns[1]};
    */

    // we need to bind the element and the absolute/relative status
    // so sorting is too simple

    const start = { ...this.start_ };
    const end = { ...this.end_ };

    /*
    const start = {
      sheet_id: this.start_.sheet_id,
      row: this.start_.row,
      column: this.start_.column,
      absolute_column: this.start_.absolute_column,
      absolute_row: this.start_.absolute_row };

    const end = {
      sheet_id: this.end_.sheet_id, // we don't ever use this, but copy JIC
      row: this.end_.row,
      column: this.end_.column,
      absolute_column: this.end_.absolute_column,
      absolute_row: this.end_.absolute_row };
    */

    // swap row

    if (start.row === Infinity || end.row === Infinity){
      start.row = end.row = Infinity;
    }
    else if (start.row > end.row){
      start.row = this.end_.row;
      start.absolute_row = this.end_.absolute_row;
      end.row = this.start_.row;
      end.absolute_row = this.start_.absolute_row;
    }

    // swap column

    if (start.column === Infinity || end.column === Infinity){
      start.column = end.column = Infinity;
    }
    else if (start.column > end.column){
      start.column = this.end_.column;
      start.absolute_column = this.end_.absolute_column;
      end.column = this.start_.column;
      end.absolute_column = this.start_.absolute_column;
    }

    this.start_ = start;
    this.end_ = end;

  }

  /** returns the top-left cell in the area */
  public TopLeft(): ICellAddress {
    const address = {row: 0, column: 0};
    if (!this.entire_row) address.column = this.start.column;
    if (!this.entire_column) address.row = this.start.row;
    return address;
  }

  /** returns the bottom-right cell in the area */
  public BottomRight(): ICellAddress {
    const address = {row: 0, column: 0};
    if (!this.entire_row) address.column = this.end.column;
    if (!this.entire_column) address.row = this.end.row;
    return address;
  }

  public ContainsRow(row: number): boolean {
    return this.entire_column || (row >= this.start_.row && row <= this.end_.row);
  }

  public ContainsColumn(column: number): boolean {
    return this.entire_row || (column >= this.start_.column && column <= this.end_.column);
  }

  public Contains(address: ICellAddress): boolean {
    return (this.entire_column || (address.row >= this.start_.row && address.row <= this.end_.row))
      && (this.entire_row || (address.column >= this.start_.column && address.column <= this.end_.column));
  }

  /**
   * returns true if this area completely contains the argument area
   * (also if areas are ===, as a side effect). note that this returns
   * true if A contains B, but not vice-versa
   */
  public ContainsArea(area: Area): boolean {
    return this.start.column <= area.start.column
      && this.end.column >= area.end.column
      && this.start.row <= area.start.row
      && this.end.row >= area.end.row;
  }

  /**
   * returns true if there's an intersection. note that this won't work
   * if there are infinities -- needs real area ?
   */
  public Intersects(area: Area): boolean {
    return !(area.start.column > this.end.column
      || this.start.column > area.end.column
      || area.start.row > this.end.row
      || this.start.row > area.end.row);
  }

  public Equals(area: Area): boolean {
    return area.start_.row === this.start_.row
      && area.start_.column === this.start_.column
      && area.end_.row === this.end_.row
      && area.end_.column === this.end_.column;
  }

  public Clone(): Area {
    return new Area(this.start, this.end); // ensure copies
  }

  public Array(): ICellAddress[] {
    if (this.entire_column || this.entire_row) throw new Error('can\'t convert infinite area to array');
    const array: ICellAddress[] = new Array<ICellAddress>(this.rows * this.columns);

    const sheet_id = this.start_.sheet_id;
    let index = 0;

    // does this need sheet ID?

    for (let row = this.start_.row; row <= this.end_.row; row++){
      for (let column = this.start_.column; column <= this.end_.column; column++){
        array[index++] = { row, column, sheet_id };
      }
    }
    return array;
  }

  get left(): Area{
    const area = new Area(this.start_, this.end_);
    area.end_.column = area.start_.column;
    return area;
  }

  get right(): Area{
    const area = new Area(this.start_, this.end_);
    area.start_.column = area.end_.column;
    return area;
  }

  get top(): Area{
    const area = new Area(this.start_, this.end_);
    area.end_.row = area.start_.row;
    return area;
  }

  get bottom(): Area{
    const area = new Area(this.start_, this.end_);
    area.start_.row = area.end_.row;
    return area;
  }

  /** shifts range in place */
  public Shift(rows: number, columns: number): Area {
    this.start_.row += rows;
    this.start_.column += columns;
    this.end_.row += rows;
    this.end_.column += columns;
    return this; // fluent
  }

  /** Resizes range in place so that it includes the given address */
  public ConsumeAddress(addr: ICellAddress): void {
    if (!this.entire_row){
      if (addr.column < this.start_.column) this.start_.column = addr.column;
      if (addr.column > this.end_.column) this.end_.column = addr.column;
    }
    if (!this.entire_column){
      if (addr.row < this.start_.row) this.start_.row = addr.row;
      if (addr.row > this.end_.row) this.end_.row = addr.row;
    }
  }

  /** Resizes range in place so that it includes the given area (merge) */
  public ConsumeArea(area: IArea): void {
    this.ConsumeAddress(area.start);
    this.ConsumeAddress(area.end);
  }

  /** resizes range in place (updates end) */
  public Resize(rows: number, columns: number): Area {
    this.end_.row = this.start_.row + rows - 1;
    this.end_.column = this.start_.column + columns - 1;
    return this; // fluent
  }

  public Iterate(f: (...args: any[]) => any): void {
    if (this.entire_column || this.entire_row) {
      console.warn(`don't iterate infinite area`);
      return;
    }
    for (let c = this.start_.column; c <= this.end_.column; c++){
      for (let r = this.start_.row; r <= this.end_.row; r++){
        f({column: c, row: r, sheet_id: this.start_.sheet_id});
      }
    }
  }

  /* *
   * testing: we may have to polyfill for IE11, or just not use it at
   * all, depending on support level... but it works OK (kind of a clumsy
   * implementation though).
   *
   * as it turns out we don't really use iteration that much (I thought
   * we did) so it's probably not worth the polyfill...
   *
   * /
  public next(): IteratorResult<ICellAddress> {

    // sanity

    if (this.entire_column || this.entire_row) {
      console.warn('don\'t iterate over infinte range');
      return { value: undefined, done: true };
    }

    // return current, unless it's OOB; if so, advance

    if (this.iterator_index.column > this.end.column) {
      this.iterator_index.column = this.start_.column;
      this.iterator_index.row++;

      if (this.iterator_index.row > this.end.row) {
        this.ResetIterator();
        return { value: undefined, done: true };
      }

    }

    const result = { value: { ...this.iterator_index }, done: false };
    this.iterator_index.column++;

    return result;
  }

  public [Symbol.iterator](): IterableIterator <ICellAddress> {
    return this;
  }
  */

  /**
   * returns the range in A1-style spreadsheet addressing. if the
   * entire sheet is selected, returns nothing (there's no way to
   * express that in A1 notation). returns the row numbers for entire
   * columns and vice-versa for rows.
   */
  get spreadsheet_label(): string {

    let s: string;

    if (this.entire_sheet) return '';

    if (this.entire_column){
      s = Area.ColumnToLabel(this.start_.column);
      s += ':' + Area.ColumnToLabel(this.end_.column);
      return s;
    }

    if (this.entire_row){
      s = String(this.start_.row + 1);
      s += ':' + (this.end_.row + 1);
      return s;
    }

    s = Area.CellAddressToLabel(this.start_);
    if (this.columns > 1 || this.rows > 1) return s + ':' + Area.CellAddressToLabel(this.end_);
    return s;

  }

  /**
   * FIXME: is this different than what would be returned if
   * we just used the default json serializer? (...)
   */
  public toJSON(): any {

    return {
      start: { ...this.start_ },
      end: { ...this.end_ },
    };

    /*
    return {
      start: {
        row: this.start.row,
        absolute_row: this.start.absolute_row,
        column: this.start.column,
        absolute_column: this.start.absolute_column,
      },
      end: {
        row: this.end.row,
        absolute_row: this.end.absolute_row,
        column: this.end.column,
        absolute_column: this.end.absolute_column,
      },
    };
    */
  }

  /*
  private ResetIterator() {
    this.iterator_index = {
      row: this.start_.row,
      column: this.start_.column,
      sheet_id: this.start_.sheet_id,
    };
  }
  */

}