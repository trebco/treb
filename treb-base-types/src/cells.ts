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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * switched to row-major, seems to have no ill effects
 * (not sure if there are benefits yet either)
 */

import type { IArea, ICellAddress} from './area';
import { Area, IsCellAddress } from './area';
import type { DataValidation } from './cell';
import { Cell } from './cell';
import type { Table } from './table';
import { type SerializedValueType, ValueType, GetValueType, ValueTypeList } from './value-type';
import type { CellValue, UnionValue } from './union';
import type { Style, CellStyle } from './style';

export interface CellSerializationOptions {
  preserve_type?: boolean;
  convert_address?: boolean;
  calculated_value?: boolean;
  expand_arrays?: boolean;
  subset?: Area;
  preserve_empty_strings?: boolean;
  decorated_cells?: boolean;
  tables?: boolean;

  /**
   * nest rows in columns, or vice-versa, depending on which is smaller.
   */
  nested?: boolean;

  /**
   * cell style refs to pack into cells
   */
  cell_style_refs?: number[][];

  /** optionally attach an ID to the cells */
  sheet_id?: number;

}

// our cell data is now somewhat complicated, from a type perspective. we 
// support the original type, which was just an array of cells with each
// cell having {row, column}. 
//
// more recent code compresses this by nesting blocks of rows or columns,
// using the structure (e.g.) { row, cells } where each cell in cells has 
// a column.
// 
// so type needs to support both flat and nested, where nested can be row-
// dominant or column-dominant.
//
// by the way, did we ever validate that this structure is significantly
// smaller, when compressed? (...)

export interface BaseCellData {
  value: CellValue;
  style_ref?: number;
  calculated?: CellValue;
  table?: Table;
  area?: IArea;
  merge_area?: IArea;
  validation?: DataValidation;
  calculated_type?: SerializedValueType; //  ValueType;
  note?: string;
  hyperlink?: string;
  type?: SerializedValueType; // ValueType;
  sheet_id?: number;
  // locked?: boolean;
}

/**
 * this type is for serialized data that includes the row and column
 * in each cell. this was the original serialized data type, and is
 * still supported. current serialization will group data into rows or
 * columns, whichever results in a smaller overall serialized representation.
 */
export interface CellDataWithAddress extends BaseCellData {
  row: number;
  column: number;
}

export interface NestedCellData {
  cells: BaseCellData[];
}

/**
 * this type is for serialized data that is grouped by row, with each
 * cell referencing a column in the spreadsheet. 
 */
export interface CellDataWithColumn extends BaseCellData {
  column: number;
}

export interface NestedRowData extends NestedCellData {
  row: number;
  cells: CellDataWithColumn[];
}

/**
 * this type is for serialized data that is grouped by column, with each
 * cell referencing a row in the spreadsheet. 
 */
export interface CellDataWithRow extends BaseCellData {
  row: number;
}

export interface NestedColumnData extends NestedCellData {
  column: number;
  cells: CellDataWithRow[];
}

export type SerializedCellData = CellDataWithAddress[]|NestedRowData[]|NestedColumnData[];

// some type guards for the various data types

/** @internal */
export const IsFlatData = (test: CellDataWithAddress|NestedCellData): test is CellDataWithAddress => {
  return !(test as NestedCellData).cells;
}

/** @internal */
export const IsFlatDataArray = (test: CellDataWithAddress[]|NestedCellData[]): test is CellDataWithAddress[] => {
  return (!!test[0]) && IsFlatData(test[0]);
};

/** @internal */
export const IsNestedRowArray = (test: NestedRowData[]|NestedColumnData[]): test is NestedRowData[] => {
  return (!!test[0]) && ((test[0] as NestedRowData).row !== undefined);
};

// ...


/** 
 * this is the reverse map, i.e. type => number 
 * FIXME: why is this getting exported by the API generator?
 * FIXME: I get why it's dynamic, but for practical purposes why not just 
 * create a static map?
 */
const ValueTypeMap = 
  ValueTypeList.map((key, index) => ({ [key]: index })).reduce((set, value) => ({...set, ...value}), {}) as Record<SerializedValueType, ValueType>;


/**
 * collection of cells, basically a wrapper around an
 * array, with some accessor and control methods.
 */
export class Cells {

  /** switching to row-major */
  public data: Cell[][] = [];

  private rows_ = 0;

  private columns_ = 0;

  get rows(): number { return this.rows_; }
  get columns(): number { return this.columns_; }

  /**
   * the sheet wants to make sure this row exists, probably because it has
   * a header. so we will update our dimensions to match. we don't actually
   * add data.
   *
   * this is not serialized. specific headers aren't serialized either, at
   * the moment, so it's sort of irrelevant. if we start serializing headers,
   * the deserialization routine can call this function to pad out, so we
   * don't need to store it here.
   */
  public EnsureRow(row: number): void {
    this.rows_ = Math.max(row + 1, this.rows_);
  }

  /** @see EnsureRow */
  public EnsureColumn(column: number): void {
    this.columns_ = Math.max(column + 1, this.columns_);
  }

  /**
   * this class does none of the validation/correction
   * required when inserting rows/columns. that should
   * be done by external logic. this method only does
   * the mechanical work of inserting rows/columns.
   */
  public InsertColumns(before = 0, count = 1): void {

    const pre = JSON.parse(JSON.stringify(this.data[13]));

    // NOTE: iterating a sparse array, in chrome at least, only
    // hits populated keys. the returned array has the same
    // indexes. that is very nice.

    this.data = this.data.map(row => {
      if (row.length >= before){
        const tmp = row.slice(0, before);
        let index = before + count;

        // this forEach is broken when there are empty values in the row,
        // which doesn't happen so much anymore but can (and does) happen
        // in some older sheets. 

        // row.slice(before).forEach((column) => tmp[index++] = column);

        // do it with an explicit index loop, should resolve

        const after = row.slice(before);
        for (let i = 0; i < after.length; i++) {
          tmp[index++] = after[i];
        }

        return tmp;
      }
      return row;
    });

    this.columns_ += count;

    // wtf is this? some old debug stuff?
    // const clone = JSON.parse(JSON.stringify(this.data[13]));
    // console.info({pre, clone});
    
  }

  public DeleteColumns(index: number, count= 1): void {

    // trap! splice returns _removed_ elements so don't use map()

    this.data.forEach((row) => row.splice(index, count));
    this.columns_ -= count;
  }

  public DeleteRows(index: number, count = 1): void {
    this.data.splice(index, count);
    this.rows_ -= count;
  }

  /**
   * this class does none of the validation/correction
   * required when inserting rows/columns. that should
   * be done by external logic. this method only does
   * the mechanical work of inserting rows/columns.
   */
  public InsertRows(before = 0, count = 1): void {
    const args: [number, number, Cell[]] = [before, 0, []];
    for ( let i = 1; i < count; i++) args.push([]);
    Array.prototype.splice.apply(this.data, args);
    this.rows_ += count;
  }

  /**
   * return or create cell at the given address
   */
  public GetCell(address: ICellAddress, create_new: true): Cell;

  /**
   * return the cell at the given address or undefined if it doesn't exist
   */
  public GetCell(address: ICellAddress, create_new?: false): Cell | undefined;

  /**
   * return the given cell or `undefined`, optionally creating
   * new cells as necessary
   *
   * @param create_new always return a cell
   */
  public GetCell(address: ICellAddress, create_new?: boolean): Cell|undefined {

    const { row, column } = address;

    if (!this.data[row]) {
      if (create_new) {
        this.data[row] = [];
        this.rows_ = Math.max(this.rows_, row + 1);
      }
      else return undefined;
    }

    if (!this.data[row][column]) {
      if (create_new) {
        this.data[row][column] = new Cell();
        this.columns_ = Math.max(this.columns_, column + 1);
      }
    }

    return this.data[row][column];

  }

  /**
   * apply function to range or address. skips empty cells (for now...)
   * (already have this function, it's called "IterateArea". "Apply" is better.)
   * /
  public Apply(target: ICellAddress|IArea, func: (cell: Cell) => void): void {

    if (IsCellAddress(target)) {
      target = new Area(target);
    }

    const start = target.start;
    const end = target.end;

    for (let r = start.row; r <= end.row; r++) {
      if (this.data[r]) {
        const row = this.data[r];
        for (let c = start.column; c < end.column; c++) {
          if (this.data[r][c]) {
            func.call(undefined, row[c]);
          }
        }
      }
    }

  }
  */

  /** returns an existing cell or creates a new cell. */
  public EnsureCell(address: ICellAddress): Cell {
    const { row, column } = address;
    let ref = this.data[row];
    if (!ref) {
      this.data[row] = ref = [];
      this.rows_ = Math.max(this.rows_, row + 1);
    }
    let cell = ref[column];
    if (!cell) {
      cell = ref[column] = new Cell();
      this.columns_ = Math.max(this.columns_, column + 1);
    }
    return cell;
  }

  /**
   * with the update, we assume the passed-in data is row-major.
   * when reading an older file, transpose.
   */
  public FromArray(data: CellValue[][] = [], transpose = false): void {
    this.data = [];

    let rows = 0;
    let columns = 0;

    if (transpose){
      columns = data.length;
      for ( let c = 0; c < columns; c++ ){
        const ref = data[c];
        rows = Math.max(rows, ref.length);
        for ( let r = 0; r < ref.length; r++ ){
          if (!this.data[r]) this.data[r] = [];
          this.data[r][c] = new Cell(ref[r]);
        }
      }
    }
    else {
      rows = data.length;
      for ( let r = 0; r < rows; r++ ){
        const column: Cell[] = [];
        const ref = data[r];
        columns = Math.max(columns, ref.length);
        for ( let c = 0; c < ref.length; c++ ) column[c] = new Cell(ref[c]);
        this.data[r] = column;
      }
    }
    this.rows_ = rows;
    this.columns_ = columns;
  }

  public SerializedTypeToValueType(type?: SerializedValueType|ValueType): ValueType|undefined {

    if (!type) {
      return undefined;
    }

    if (typeof type === 'number') {
      return type as ValueType;
    }

    return ValueTypeMap[type] || undefined;

  }

  public ValueTypeToSerializedType(type?: ValueType): SerializedValueType|undefined {
    return type ? ValueTypeList[type] : undefined;
  }

  /**
   * this method is used for importing legacy data validation types. in those
   * those we used a numeric enum. we're just dropping that altogether (c.f.
   * ValueType, which we're keeping) so we need to translate for backcompat. 
   * it's ugly, but it gets us to a better place. we can probably drop at some
   * point in the future.
   * 
   * export enum ValidationType {
   *   List = 'list',
   *   Date = 'date',
   *   Range = 'range',
   *   Number = 'number',
   *   Boolean = 'boolean',
   * }
   * 
   */
  public ImportDataValidation(value: DataValidation): DataValidation|undefined {

    if (typeof (value as any).type === 'number') {
      const types = ['list', 'date', 'range', 'number', 'boolean'];
      (value as any).type = types[(value as any).type];
      if (!value.type) {
        return undefined;
      }
    }

    return value;
  }

  /**
   * UPDATE: adding optional style refs, for export
   */
  public FromJSON(data: SerializedCellData = [], style_refs?: CellStyle[]): void {

    this.data = [];

    // handle nested data; fix. we can make the simplifying assumption
    // that data is either nested, or not, but never both. therefore, we
    // just need to check the first element.

    if (!IsFlatDataArray(data)) {

      const new_data: CellDataWithAddress[] = [];

      if (IsNestedRowArray(data)) {
        for (const block of data) {
          for (const cell of block.cells) {
            new_data.push({...cell, row: block.row});
          }
        }
      }
      else {
        for (const block of data) {
          for (const cell of block.cells) {
            new_data.push({...cell, column: block.column});
          }
        }
      }

      data = new_data;

    }

    /*
    if (data[0] && data[0].cells) {

      // console.info('reading nested data');

      const new_data: any[] = [];
      for (const element of data) {
        if (typeof element.row !== 'undefined') {
          for (const cell of element.cells) {
            new_data.push({row: element.row, ...cell});
          }
        }
        else if (typeof element.column !== 'undefined') {
          for (const cell of element.cells) {
            new_data.push({column: element.column, ...cell});
          }
        }
      }
      data = new_data;

    }
    */

    const tables: Table[] = [];

    for (const obj of data) {

      if (!this.data[obj.row]) this.data[obj.row] = [];
      const cell = new Cell(obj.value);
      if (typeof obj.calculated !== 'undefined') {
        // cell.calculated = obj.calculated;
        // cell.calculated_type = obj.calculated_type;
        cell.SetCalculatedValue(obj.calculated, this.SerializedTypeToValueType(obj.calculated_type));
      }

      if (style_refs) {
        if (typeof obj.style_ref !== 'undefined') {
          cell.style = style_refs[obj.style_ref];
        }
      }

      if (typeof obj.note !== 'undefined') {
        cell.note = obj.note;
      }
      if (typeof obj.hyperlink !== 'undefined') {
        cell.hyperlink = obj.hyperlink;
      }

      // stop wrecking arrays

      if (this.data[obj.row][obj.column] && this.data[obj.row][obj.column].area) {
        cell.area = this.data[obj.row][obj.column].area;
      }

      this.data[obj.row][obj.column] = cell;

      // since we are serializing the array data (when storing calculated
      // values), is this getting called every time? I think it might be...
      // we're fixing the former, anyway.

      if (obj.area){
        const area = new Area(obj.area.start, obj.area.end); // isn't there a clone method?
        for ( let row = area.start.row; row <= area.end.row; row++){
          for ( let column = area.start.column; column <= area.end.column; column++){
            if (!this.data[row]) this.data[row] = [];
            if (!this.data[row][column]) this.data[row][column] = new Cell();
            this.data[row][column].area = area;
          }
        }
      }

      // collect tables, then apply them after reading all the cells.
      // FIXME: why are we not doing this for merges? would be more 
      // efficient, no?

      if (obj.table) {
        tables.push({
          ...obj.table,
        });

        /*
        for ( let row = table.area.start.row; row <= table.area.end.row; row++){
          for ( let column = table.area.start.column; column <= table.area.end.column; column++){
            if (!this.data[row]) this.data[row] = [];
            if (!this.data[row][column]) this.data[row][column] = new Cell();
            this.data[row][column].table = table;
          }
        }
        */
      }

      if (obj.merge_area){
        const merge_area = new Area(obj.merge_area.start, obj.merge_area.end);
        for ( let row = merge_area.start.row; row <= merge_area.end.row; row++){
          for ( let column = merge_area.start.column; column <= merge_area.end.column; column++){
            if (!this.data[row]) this.data[row] = [];
            if (!this.data[row][column]) this.data[row][column] = new Cell();
            this.data[row][column].merge_area = merge_area;
          }
        }
      }

      if (obj.validation) {

        // the old type used a numeric enum. we just dropped that in favor
        // of a string enum, so we can export it as a type. but for backwards
        // compatibility we still need to think about the numeric enum.

        cell.validation = this.ImportDataValidation(obj.validation);

      }

    }

    for (const table of tables) {
      for ( let row = table.area.start.row; row <= table.area.end.row; row++){
        for ( let column = table.area.start.column; column <= table.area.end.column; column++){
          if (!this.data[row]) this.data[row] = [];
          if (!this.data[row][column]) this.data[row][column] = new Cell();
          this.data[row][column].table = table;
        }
      }
    }

    this.rows_ = this.data.length;
    this.columns_ = this.data.reduce((max, row) => Math.max(max, row.length), 0);

  }

  public toJSON(options: CellSerializationOptions = {}) : {
      data: SerializedCellData;
      rows: number;
      columns: number;
    } {

    let start_column = 0;
    let start_row = 0;
    let end_row = this.data.length - 1;
    let end_column;

    if (options.subset){
      start_column = options.subset.start.column;
      start_row = options.subset.start.row;
      end_row = options.subset.end.row;
    }

    const data: CellDataWithAddress[] = [];

    let last_row = -1;
    let last_col = -1;

    // unifying [FIXME: move into class]

    // FIXME: why not use the original, instead of requiring a method
    // call, and then re-order? that also makes it easier to pivot
    // (order by rows or columns)

    // ... (we did that)

    const row_keys: {[index: number]: number} = {};
    const column_keys: {[index: number]: number} = {};

    for ( let row = start_row; row <= end_row; row++ ){
      if ( this.data[row]){
        const ref = this.data[row];

        end_column = ref.length - 1;
        if (options.subset) end_column = options.subset.end.column;

        for ( let column = start_column; column <= end_column; column++ ){
          const cell = ref[column];

          // because only the array head will have a value, this test
          // will filter out empty cells and non-head array cells

          // update: also add merge heads
          const merge_head = cell && cell.merge_area
            && cell.merge_area.start.row === row
            && cell.merge_area.start.column === column;

          const array_head = cell && cell.area
            && cell.area.start.row === row
            && cell.area.start.column === column;

          const table_head = cell && cell.table
            && cell.table.area.start.row === row
            && cell.table.area.start.column === column;

          const is_empty = cell ? (cell.type === ValueType.string && !cell.value) : true;

          // NOTE: we added the check on calculated && calculated_value,
          // so we preserve rendered data for arrays. but that actually writes
          // the array data as well, which is unnecessary (?) -- FIXME
          //
          // actually, check how that's interpreted on load, because it might
          // break if we have a value but not the array area (...)

          // FIXME: what's up with this? we check style? (...) can't recall
          // why we do that, because we should ensure empty cells if there's
          // a style (separately).

          // NOTE: switching test from "calculated" to "calculated type": this
          // should preserve zeros.

          if (cell && (!is_empty || options.preserve_empty_strings) &&
              (merge_head || cell.type || (cell.calculated_type && options.expand_arrays) ||
                (cell.calculated_type && options.calculated_value) ||
                (cell.note) ||
                (cell.validation) ||
                (options.decorated_cells && cell.style &&
                  ( cell.style.fill || cell.style.border_bottom ||
                    cell.style.border_top || cell.style.border_left || cell.style.border_right)))){

            const obj: CellDataWithAddress = { row, column, value: cell.value };
            if (cell.note) {
              obj.note = cell.note;
            }
            if (cell.hyperlink) {
              obj.hyperlink = cell.hyperlink;
            }

            if (options.preserve_type) {
              obj.type = this.ValueTypeToSerializedType(cell.type);
            }
            if (options.sheet_id) obj.sheet_id = options.sheet_id;
            if (options.calculated_value &&
                typeof cell.calculated !== 'undefined') { // && cell.calculated_type !== ValueType.error) {
              obj.calculated = cell.calculated;

              // always preserve error type, because we can't infer
              if (options.preserve_type || cell.calculated_type === ValueType.error) {
                obj.calculated_type = this.ValueTypeToSerializedType(cell.calculated_type);
              }
            }
            if (cell.table && table_head) {
              if (options.tables) {
                obj.table = JSON.parse(JSON.stringify(cell.table));
              }
            }
            if (cell.area && array_head) {
              obj.area = cell.area.toJSON();
            }
            if (cell.merge_area) {
              obj.merge_area = cell.merge_area.toJSON();
            }
            if (cell.validation) {
              obj.validation = cell.validation; // safe? 
            }

            if (options.cell_style_refs &&
                options.cell_style_refs[column] &&
                options.cell_style_refs[column][row]) {

              obj.style_ref = options.cell_style_refs[column][row];
              options.cell_style_refs[column][row] = 0; // consume

              // console.info(`consume @ ${column}, ${row}: ${obj.style_ref } => ${options.cell_style_refs[column][row]}`);

            }

            row_keys[row] = row;
            column_keys[column] = column;

            last_row = Math.max(row, last_row);
            last_col = Math.max(column, last_col);

            data.push(obj);
          }

        }
      }
    }

    if (options.nested) {

      const row_key_map = Object.keys(row_keys);
      const col_key_map = Object.keys(column_keys);

      // extra test to make sure it's not empty

      if ((row_key_map.length <= col_key_map.length) && row_key_map.length) {

        const cells: {[index: number]: Array<BaseCellData & {column: number}>} = {};

        // use rows
        const new_data: NestedRowData[] = [];

        for (const element of data) {
          const {row, ...remainder} = element;
          if (!cells[element.row]) cells[element.row] = [];
          cells[element.row].push(remainder);
        }
        for (const key of row_key_map) {
          const row = Number(key);
          new_data.push({ row, cells: cells[row] });
        }
        return { data: new_data, rows: last_row, columns: last_col + 1 };

      }
      else if (col_key_map.length) {

        const cells: {[index: number]: Array<BaseCellData & {row: number}>} = {};

        // use columns
        const new_data: NestedColumnData[] = [];

        for (const element of data) {
          const {column, ...remainder} = element;
          if (!cells[element.column]) cells[element.column] = [];
          cells[element.column].push(remainder);
        }
        for (const key of col_key_map) {
          const column = Number(key);
          new_data.push({ column, cells: cells[column] });
        }
        return { data: new_data, rows: last_row, columns: last_col + 1 };

      }

    }

    return { data, rows: last_row + 1, columns: last_col + 1 };

  }

  public GetAll(transpose = false){
    return this.GetRange({row: 0, column: 0}, {row: this.rows_ - 1, column: this.columns_ - 1}, transpose);
  }

  /** overload */
  public Normalize(from: ICellAddress, to: ICellAddress): { from: ICellAddress, to: ICellAddress };

  /** overload */
  public Normalize(from: ICellAddress): { from: ICellAddress };

  /** overload */
  public Normalize<K extends ICellAddress|undefined>(from: ICellAddress, to: K): { from: ICellAddress, to: K };

  /** base */
  public Normalize(from: ICellAddress, to?: ICellAddress): { from: ICellAddress, to?: ICellAddress } {

    from = {
      ...from,
      row: from.row == Infinity ? 0 : from.row,
      column: from.column == Infinity ? 0 : from.column,
    }

    if (to) {
      to = {
        ...to,
        row: to.row == Infinity ? this.rows_ - 1 : to.row,
        column: to.column == Infinity ? this.columns_ - 1 : to.column,
      }
    }

    return { from, to };

  }

  /**
   * get raw values (i.e. not calculated). anything outside of actual
   * range will be undefined OR not populated. 
   *
   * to match GetRange, we return a single value in the case of a single cell,
   * or a matrix.
   *
   * NOTE that I'm not sure this is good behavior. if you're going to
   * return a single value for one cell, you should return a vector for
   * a single row OR a single column. alternatively, you should always
   * return a matrix.
   * 
   * @param from
   * @param to
   * @param transpose
   */
  public RawValue(from: ICellAddress, to: ICellAddress = from): CellValue | CellValue[][] | undefined {

    ({from, to} = this.Normalize(from, to));

    if (from.row === to.row && from.column === to.column) {
      if (this.data[from.row] && this.data[from.row][from.column]) {
        return this.data[from.row][from.column].value;
      }
      return undefined;
    }

    const result: CellValue[][] = [];

    // grab rows
    const rows = this.data.slice(from.row, to.row + 1);

    // now columns
    const start = from.column;
    const end = to.column + 1;

    for (const source of rows) {
      const target: CellValue[] = [];
      for (let column = start, index = 0; column < end; column++, index++ ) {
        const cell = source[column];
        target.push(cell ? cell.value : undefined);
      }
      result.push(target);
    }

    return result;

  }

  /** gets range as values */
  public GetRange(from: ICellAddress, to?: ICellAddress, transpose = false){

    ({from, to} = this.Normalize(from, to));

    // console.info("getrange", from, to, transpose);

    if (!to || from === to || (from.column === to.column && from.row === to.row )){
      if (this.data[from.row] && this.data[from.row][from.column]){
        return this.data[from.row][from.column].GetValue();
      }
      return undefined;
    }

    const value: CellValue[][] = [];

    if (transpose){
      for ( let c = from.column; c <= to.column; c++ ){
        const column: CellValue[] = [];
        for ( let r = from.row; r <= to.row; r++ ){
          if (this.data[r] && this.data[r][c]) column.push(this.data[r][c].GetValue());
          else column.push(undefined);
        }
        value.push(column);
      }
    }
    else {
      for ( let r = from.row; r <= to.row; r++ ){
        const row: CellValue[] = [];
        for ( let c = from.column; c <= to.column; c++ ){
          if (this.data[r] && this.data[r][c]) row.push(this.data[r][c].GetValue());
          else row.push(undefined);
        }
        value.push(row);
      }
    }

    // console.info(value)
    return value;

  }

  /* *
   * updated version of GetRange that preserves errors, by calling
   * the GetValue2 cell function.
   * /
  public GetRange2(from: ICellAddress, to?: ICellAddress, transpose = false) {

    if (!to || from === to || (from.column === to.column && from.row === to.row )){
      if (this.data[from.row] && this.data[from.row][from.column]){
        return this.data[from.row][from.column].GetValue2();
      }
      return undefined;
    }

    const value = [];

    if (transpose){
      for ( let c = from.column; c <= to.column; c++ ){
        const column = [];
        for ( let r = from.row; r <= to.row; r++ ){
          if (this.data[r] && this.data[r][c]) column.push(this.data[r][c].GetValue2());
          else column.push(undefined);
        }
        value.push(column);
      }
    }
    else {
      for ( let r = from.row; r <= to.row; r++ ){
        const row = [];
        for ( let c = from.column; c <= to.column; c++ ){
          if (this.data[r] && this.data[r][c]) row.push(this.data[r][c].GetValue2());
          else row.push(undefined);
        }
        value.push(row);
      }
    }

    return value;

  }
  */

  public GetRange4(from: ICellAddress, to: ICellAddress = from, transpose = false): UnionValue {

    ({from, to} = this.Normalize(from, to));

    if (from.row === to.row && from.column === to.column) {
      if (this.data[from.row] && this.data[from.row][from.column]){
        return this.data[from.row][from.column].GetValue4();
      }
      return { value: undefined, type: ValueType.undefined };
    }

    const value: UnionValue[][] = [];

    if (transpose){
      for ( let c = from.column; c <= to.column; c++ ){
        const column: UnionValue[] = [];
        for ( let r = from.row; r <= to.row; r++ ){
          if (this.data[r] && this.data[r][c]) column.push(this.data[r][c].GetValue4());
          else column.push({type: ValueType.undefined});
        }
        value.push(column);
      }
    }
    else {
      for ( let r = from.row; r <= to.row; r++ ){
        const row: UnionValue[] = [];
        for ( let c = from.column; c <= to.column; c++ ){
          if (this.data[r] && this.data[r][c]) row.push(this.data[r][c].GetValue4());
          else row.push({type: ValueType.undefined});
        }
        value.push(row);
      }
    }

    return {type: ValueType.array, value};

  }

  /* *
   * apply function to address/area
   * @deprecated - use Apply2
   * /
  public Apply(area: Area|ICellAddress, f: (cell: Cell, c?: number, r?: number) => void, create_missing_cells = false): void {

    // allow single address
    if (IsCellAddress(area)) {
      area = new Area(area);
    }

    // why not just cap? (...)
    if (area.entire_column || area.entire_row) {
      throw new Error(`don't iterate infinite cells`);
    }
    
    // these are accessors so we don't want them in the loop
    const start = area.start;
    const end = area.end;

    if (create_missing_cells){
      for ( let r = start.row; r <= end.row; r++ ){
        if (!this.data[r]) this.data[r] = [];
        const row = this.data[r];
        for ( let c = start.column; c <= end.column; c++ ){
          if (!row[c]) row[c] = new Cell();
          f(row[c], c, r);
        }
      }
    }
    else {
      // we can loop over indexes that don't exist, just check for existence
      for ( let r = start.row; r <= end.row; r++ ){
        if (this.data[r]){
          const row = this.data[r];
          for ( let c = start.column; c <= end.column; c++ ){
            if (row[c]) f(row[c], c, r);
          }
        }
      }
    }
  }
  */

  /* *
   * as a replacement for the Apply functions. testing
   * 
   * (1) it seems like almost no one uses the cell address, so returning
   *     it just adds a wasteful destructuring to every loop iteration.
   * 
   *     actually there's exactly one, and we could work around it. but
   *     it seems like it might be useful in some cases, so... ?
   * 
   * (2) can we consolidate with the IterateAll method (named Iterate)? 
   *     that would only work if we had the same return type, meaning either
   *     drop the address from this one or add it to the other one
   * 
   * @deprecated use Iterate, if possible
   * 
   * /
  public *IterateArea(area: Area|ICellAddress, create_missing_cells = false) {

    // allow single address
    if (IsCellAddress(area)) {
      area = new Area(area);
    }

    // why not just cap? (...)
    if (area.entire_column || area.entire_row) {
      throw new Error(`don't iterate infinite cells`);
    }

    const start = area.start;
    const end = area.end;

    if (create_missing_cells){
      for ( let r = start.row; r <= end.row; r++ ){
        if (!this.data[r]) this.data[r] = [];
        const row = this.data[r];
        for ( let c = start.column; c <= end.column; c++ ){
          if (!row[c]) row[c] = new Cell();
          yield { row: r, column: c, cell: row[c] };
        }
      }
    }
    else {
      // we can loop over indexes that don't exist, just check for existence
      for ( let r = start.row; r <= end.row; r++ ){
        if (this.data[r]){
          const row = this.data[r];
          for ( let c = start.column; c <= end.column; c++ ){
            if (row[c]) {
              yield { row: r, column: c, cell: row[c] };
            }
          }
        }
      }
    }    

  }
  */

  /* *
   * apply function to address/area
   * 
   * this version lets you abort by returning false from the callback function
   * /
  public Apply2(area: Area|ICellAddress, func: (cell: Cell, c?: number, r?: number) => boolean, create_missing_cells = false): void {

    // allow single address
    if (IsCellAddress(area)) {
      area = new Area(area);
    }

    // why not just cap? (...)
    if (area.entire_column || area.entire_row) {
      throw new Error(`don't iterate infinite cells`);
    }
    
    // these are accessors so we don't want them in the loop
    const start = area.start;
    const end = area.end;

    if (create_missing_cells){
      for ( let r = start.row; r <= end.row; r++ ){
        if (!this.data[r]) this.data[r] = [];
        const row = this.data[r];
        for ( let c = start.column; c <= end.column; c++ ){
          if (!row[c]) row[c] = new Cell();
          if (!func(row[c], c, r)) {
            return;
          }
        }
      }
    }
    else {
      // we can loop over indexes that don't exist, just check for existence
      for ( let r = start.row; r <= end.row; r++ ){
        if (this.data[r]){
          const row = this.data[r];
          for ( let c = start.column; c <= end.column; c++ ){
            if (row[c]) {
              if (!func(row[c], c, r)) {
                return;
              }
            }
          }
        }
      }
    }
  }
  */

  /**
   * set area. shortcut to reduce overhead. consolidates single value
   * and array value methods, although the implementation is separate.
   *
   * watch out for typed arrays, which do not satisfy Array.isArray
   * 
   * when would this function get a 1D typed array? can't figure that out.
   * just drop for the time being.
   * 
   */
  public SetArea(area: Area, values: CellValue|CellValue[][]): void {

    if (ArrayBuffer.isView(values)) {
      throw new Error('ABIV');
    }

    if (Array.isArray(values)) { // || ArrayBuffer.isView(values)) {
      for (let r = area.start.row, i = 0; r <= area.end.row; r++, i++) {
        if (!this.data[r]) this.data[r] = [];
        const row = this.data[r];
        if (values[i]) {
          for (let c = area.start.column, j = 0; c <= area.end.column; c++, j++) {
            if (!row[c]) row[c] = new Cell();
            row[c].Set(values[i][j]); // undefined should be implicit
          }
        }
      }
    }
    else {
      const value_type = GetValueType(values); // otherwise we'd just call it every time

      for (let r = area.start.row; r <= area.end.row; r++) {
        if (!this.data[r]) this.data[r] = [];
        const row = this.data[r];
        for (let c = area.start.column; c <= area.end.column; c++) {
          if (!row[c]) row[c] = new Cell();
          row[c].Set(values, value_type);
        }
      }
    }

    this.rows_ = Math.max(this.rows_, area.end.row + 1);
    this.columns_ = Math.max(this.columns_, area.end.column + 1);

  }

  /**
   * replacement for old callback iterator. this is a composite 
   * of iterating all and iterating an area. I want to remove the
   * other method, but there are still some calls that use the
   * cell address.
   * 
   * Q: is it possible to use Symbol.iterator with arguments?
   * A: apparently it is, but how would you call it? (...)
   */
  public *Iterate(area?: Area|ICellAddress, create_missing_cells = false) {

    // special case. normally iterating over all cells
    // doesn't create missing, so we use a simpler loop.

    if (!area && create_missing_cells) {
      area = new Area({
        row: 0,
        column: 0,
      }, {
        row: this.rows_ - 1,
        column: this.columns - 1,
      });
    }

    // if we have an area, iterate over the area. we need indexes.

    if (area) {
      
      // allow single address
      if (IsCellAddress(area)) {
        area = new Area(area);
      }

      // why not just cap? (...)
      // if (area.entire_column || area.entire_row) {
      //  throw new Error(`don't iterate infinite cells`);
      //}

      if (area.entire_column || area.entire_row) {
        area = new Area(area.start, area.end);
        if (area.start.column === Infinity) {
          area.start.column = 0;
          area.end.column = this.columns_ - 1;
        }
        if (area.start.row === Infinity) {
          area.start.row = 0;
          area.end.row = this.rows_ - 1;
        }
      }

      const start = area.start;
      const end = area.end;

      if (create_missing_cells){
        for ( let r = start.row; r <= end.row; r++ ){
          if (!this.data[r]) this.data[r] = [];
          const row = this.data[r];
          for ( let c = start.column; c <= end.column; c++ ){
            if (!row[c]) row[c] = new Cell();
            yield row[c]; // { row: r, column: c, cell: row[c] };
          }
        }
      }
      else {
        // we can loop over indexes that don't exist, just check for existence
        for ( let r = start.row; r <= end.row; r++ ){
          if (this.data[r]){
            const row = this.data[r];
            for ( let c = start.column; c <= end.column; c++ ){
              if (row[c]) {
                yield row[c]; // { row: r, column: c, cell: row[c] };
              }
            }
          }
        }
      }

    }
    else {

      // no area; just iterate all cells. implicitly skip undefined cells.

      for (const row of this.data) {
        if (row) {
          for (const cell of row) {
            if (cell) {
              yield cell;
            }
          }
        }
      }
    }
  }

  /* *
   * iterates over all cells (using loops) and runs function per-cell.
   * FIXME: switch to indexing on empty indexes? (...)
   * 
   * removed in favor of generator-based function
   * 
   * /
  public IterateAll(func: (cell: Cell) => void){
    / *
    const row_keys = Object.keys(this.data);
    for (const row of row_keys){
      const n_row = Number(row) || 0;
      const column_keys = Object.keys(this.data[n_row]);
      for (const column_key of column_keys){
        f(this.data[n_row][Number(column_key)]);
      }
    }
    * /
    for (const row of this.data) {
      if (row) {
        for (const cell of row) {
          if (cell) {
            func(cell);
          }
        }
      }
    }

  }
  */

  /** moved from sheet, so we can do it non-functional style (for perf) */
  public FlushCellStyles() {
    for (const row of this.data) {
      if (row) {
        for (const cell of row) {
          if (cell) {
            cell.FlushStyle();
          }
        }
      }
    }
  }

  /** moved from sheet, so we can do it non-functional style (for perf) */
  public FlushCachedValues() {
    for (const row of this.data) {
      if (row) {
        for (const cell of row) {
          if (cell) {
            cell.FlushCache();
          }
        }
      }
    }
  }

}
