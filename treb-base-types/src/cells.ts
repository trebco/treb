
import { Area, CellAddress } from './area';
import { Cell, ValueType } from './cell';

export interface CellSerializationOptions {
  preserve_type?: boolean;
  convert_address?: boolean;
  calculated_value?: boolean;
  expand_arrays?: boolean;
  subset?: Area;
  preserve_empty_strings?: boolean;
  decorated_cells?: boolean;
}

export class Cells {

  public data: Cell[][] = [];

  // tslint:disable-next-line:variable-name
  private rows_ = 0;

  // tslint:disable-next-line:variable-name
  private columns_ = 0;

  get rows() { return this.rows_; }
  get columns() { return this.columns_; }

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
  public EnsureRow(row: number){
    this.rows_ = Math.max(row + 1, this.rows_);
  }

  /** @see EnsureRow */
  public EnsureColumn(column: number){
    this.columns_ = Math.max(column + 1, this.columns_);
  }

  /**
   * this class does none of the validation/correction
   * required when inserting rows/columns. that should
   * be done by external logic. this method only does
   * the mechanical work of inserting rows/columns.
   */
  public InsertRows(before = 0, count = 1){

    // NOTE: iterating a sparse array, in chrome at least, only
    // hits populated keys. the returned array has the same
    // indexes. that is very nice.

    this.data = this.data.map((column, ci) => {
      if (column.length >= before){
        const tmp = column.slice(0, before);
        let index = before + count;
        column.slice(before).forEach((row) => tmp[index++] = row);
        return tmp;
      }
      return column;
    });

    this.rows_ += count;
  }

  public DeleteRows(index: number, count= 1){

    // trap! splice returns _removed_ elements so don't use map()

    this.data.forEach((column) => column.splice(index, count));
    this.rows_ -= count;
  }

  public DeleteColumns(index: number, count = 1){
    this.data.splice(index, count);
    this.columns_ -= count;
  }

  /**
   * this class does none of the validation/correction
   * required when inserting rows/columns. that should
   * be done by external logic. this method only does
   * the mechanical work of inserting rows/columns.
   */
  public InsertColumns(before = 0, count = 1){
    const args = [before, 0, []];
    for ( let i = 1; i < count; i++) args.push([]);
    console.info('ARGS', args);
    Array.prototype.splice.apply(this.data, args as [number, number, any]);
    this.columns_ += count;
  }

  /**
   * this method supports returning a new cell OR null if
   * the object doesn't exist. but that's hard for TS to
   * understand, so we should create a second method instead
   * of using a parameter. of course we will leave the parameter
   * here for backwards compatibility.
   */
  public GetCell(address: CellAddress, create_new = false){
    const { row, column } = address;
    let ref = this.data[column];
    if (!ref) {
      if (!create_new) return null;
      this.data[column] = ref = [];
      this.columns_ = Math.max(this.columns_, column + 1);
    }
    let cell = ref[row];
    if (!cell) {
      if (!create_new) return null;
      cell = ref[row] = new Cell();
      this.rows_ = Math.max(this.rows_, row + 1);
    }
    return cell;
  }

  /** returns an existing cell or creates a new cell. */
  public EnsureCell(address: CellAddress){
    const { row, column } = address;
    let ref = this.data[column];
    if (!ref) {
      this.data[column] = ref = [];
      this.columns_ = Math.max(this.columns_, column + 1);
    }
    let cell = ref[row];
    if (!cell) {
      cell = ref[row] = new Cell();
      this.rows_ = Math.max(this.rows_, row + 1);
    }
    return cell;
  }

  public FromArray(data: any[] = [], transpose = false){
    this.data = [];

    let rows = 0;
    let columns = 0;

    if (transpose){
      rows = data.length;
      for ( let r = 0; r < rows; r++ ){
        const ref = data[r];
        columns = Math.max(columns, ref.length);
        for ( let c = 0; c < ref.length; c++ ){
          if (!this.data[c]) this.data[c] = [];
          this.data[c][r] = new Cell(ref[c]);
        }
      }
    }
    else {
      columns = data.length;
      for ( let c = 0; c < columns; c++ ){
        const row: Cell[] = [];
        const ref = data[c];
        rows = Math.max(rows, ref.length);
        for ( let r = 0; r < ref.length; r++ ) row[r] = new Cell(ref[r]);
        this.data[c] = row;
      }
    }
    this.rows_ = rows;
    this.columns_ = columns;
  }

  public FromJSON(data: any[] = []){

    this.data = [];
    data.forEach((obj) => {
      if (!this.data[obj.column]) this.data[obj.column] = [];
      const cell = new Cell(obj.value);
      if (typeof obj.calculated !== 'undefined') {
        cell.calculated = obj.calculated;
        cell.calculated_type = obj.calculated_type;
      }
      this.data[obj.column][obj.row] = cell;

      if (obj.area){
        const area = new Area(obj.area.start, obj.area.end);
        for ( let column = area.start.column; column <= area.end.column; column++){
          for ( let row = area.start.row; row <= area.end.row; row++){
            if (!this.data[column]) this.data[column] = [];
            if (!this.data[column][row]) this.data[column][row] = new Cell();
            this.data[column][row].area = area;
          }
        }
      }

      if (obj.merge_area){
        const merge_area = new Area(obj.merge_area.start, obj.merge_area.end);
        for ( let column = merge_area.start.column; column <= merge_area.end.column; column++){
          for ( let row = merge_area.start.row; row <= merge_area.end.row; row++){
            if (!this.data[column]) this.data[column] = [];
            if (!this.data[column][row]) this.data[column][row] = new Cell();
            this.data[column][row].merge_area = merge_area;
          }
        }
      }

    });
    this.columns_ = this.data.length;
    this.rows_ = this.data.reduce((max, column) => Math.max(max, column.length), 0);
  }

  public toJSON(options: CellSerializationOptions = {}){

    let start_column = 0;
    let start_row = 0;
    let end_column = this.data.length - 1;
    let end_row;

    if (options.subset){
      start_column = options.subset.start.column;
      start_row = options.subset.start.row;
      end_column = options.subset.end.column;
    }


    const data: any = [];
    for ( let column = start_column; column <= end_column; column++ ){
      if ( this.data[column]){
        const ref = this.data[column];

        end_row = ref.length - 1;
        if (options.subset) end_row = options.subset.end.row;

        for ( let row = start_row; row <= end_row; row++ ){
          const cell = ref[row];

          // because only the array head will have a value, this test
          // will filter out empty cells and non-head array cells

          // update: also add merge heads
          const merge_head = cell && cell.merge_area
            && cell.merge_area.start.row === row
            && cell.merge_area.start.column === column;

          const is_empty = cell ? (cell.type === ValueType.string && !cell.value) : true;

          /*
          const decorated = options.decorated_cells && cell.style &&
            (cell.style.background ||
              cell.style.border_top ||
              cell.style.border_bottom ||
              cell.style.border_left ||
              cell.style.border_right);
          */

          // NOTE: we added the check on calculated && calculated_value,
          // so we preserve rendered data for arrays. but that actually writes
          // the array data as well, which is unnecessary (?) -- FIXME
          //
          // actually, check how that's interpreted on load, because it might
          // break if we have a value but not the array area (...)

          if (cell && (!is_empty || options.preserve_empty_strings) &&
              (merge_head || cell.type || (cell.calculated && options.expand_arrays) ||
                (cell.calculated && options.calculated_value) ||
                (options.decorated_cells && cell.style &&
                  ( cell.style.background || cell.style.border_bottom ||
                    cell.style.border_top || cell.style.border_left || cell.style.border_right)))){

            const obj: any = { row, column, value: cell.value };
            if ( options.preserve_type ) obj.type = cell.type;
            if ( options.calculated_value &&
                typeof cell.calculated !== 'undefined' ) { // && cell.calculated_type !== ValueType.error) {
              obj.calculated = cell.calculated;
              obj.calculated_type = cell.calculated_type;
            }
            if (cell.area) obj.area = cell.area.toJSON();
            if (cell.merge_area) obj.merge_area = cell.merge_area.toJSON();
            data.push(obj);
          }
        }
      }
    }

    return { data };

  }

  public GetAll(transpose= false){
    return this.GetRange({row: 0, column: 0}, {row: this.rows_ - 1, column: this.columns_ - 1}, transpose);
  }

  public GetFormattedRange(from: CellAddress, to?: CellAddress, transpose = false){

    if (!to || from === to || (from.column === to.column && from.row === to.row )){
      if (this.data[from.column] && this.data[from.column][from.row]){
        // return this.data[from.column][from.row].GetValue();
        const cell = this.data[from.column][from.row];
        return (typeof cell.formatted !== 'undefined') ? cell.formatted : cell.GetValue();
      }
      return undefined;
    }

    const value = [];

    if (transpose){
      for ( let r = from.row; r <= to.row; r++ ){
        const row = [];
        for ( let c = from.column; c <= to.column; c++ ){
          if (this.data[c] && this.data[c][r]) {
            const cell = this.data[c][r];
            row.push(typeof cell.formatted !== undefined ? cell.formatted : cell.GetValue());
          }
          else row.push(null);
        }
        value.push(row);
      }
    }
    else {
      for ( let c = from.column; c <= to.column; c++ ){
        const column = [];
        for ( let r = from.row; r <= to.row; r++ ){
          if (this.data[c] && this.data[c][r]) {
            const cell = this.data[c][r];
            column.push(typeof cell.formatted !== undefined ? cell.formatted : cell.GetValue());
          }
          else column.push(null);
        }
        value.push(column);
      }
    }

    // console.info(value)
    return value;

  }

  /** gets range as values */
  public GetRange(from: CellAddress, to?: CellAddress, transpose = false){

    // console.info("getrange", from, to, transpose);

    if (!to || from === to || (from.column === to.column && from.row === to.row )){
      if (this.data[from.column] && this.data[from.column][from.row]){
        return this.data[from.column][from.row].GetValue();
      }
      return undefined;
    }

    const value = [];

    if (transpose){
      for ( let r = from.row; r <= to.row; r++ ){
        const row = [];
        for ( let c = from.column; c <= to.column; c++ ){
          if (this.data[c] && this.data[c][r]) row.push(this.data[c][r].GetValue());
          else row.push(null);
        }
        value.push(row);
      }
    }
    else {
      for ( let c = from.column; c <= to.column; c++ ){
        const column = [];
        for ( let r = from.row; r <= to.row; r++ ){
          if (this.data[c] && this.data[c][r]) column.push(this.data[c][r].GetValue());
          else column.push(null);
        }
        value.push(column);
      }
    }

    // console.info(value)
    return value;

  }

  /**
   * updated version of GetRange that preserves errors, by calling
   * the GetValue2 cell function.
   */
  public GetRange2(from: CellAddress, to?: CellAddress, transpose = false) {

    if (!to || from === to || (from.column === to.column && from.row === to.row )){
      if (this.data[from.column] && this.data[from.column][from.row]){
        return this.data[from.column][from.row].GetValue2();
      }
      return undefined;
    }

    const value = [];

    if (transpose){
      for ( let r = from.row; r <= to.row; r++ ){
        const row = [];
        for ( let c = from.column; c <= to.column; c++ ){
          if (this.data[c] && this.data[c][r]) row.push(this.data[c][r].GetValue2());
          else row.push(null);
        }
        value.push(row);
      }
    }
    else {
      for ( let c = from.column; c <= to.column; c++ ){
        const column = [];
        for ( let r = from.row; r <= to.row; r++ ){
          if (this.data[c] && this.data[c][r]) column.push(this.data[c][r].GetValue2());
          else column.push(null);
        }
        value.push(column);
      }
    }

    return value;

  }

  /**
   * iterates over area (using loops) and runs function per-cell
   */
  public IterateArea(area: Area, f: (cell: Cell, c?: number, r?: number) => void, create_missing_cells = false){

    if (area.entire_column || area.entire_row) throw new Error('don\'t iterate infinite cells');

    if (create_missing_cells){
      for ( let c = area.start.column; c <= area.end.column; c++ ){
        if (!this.data[c]) this.data[c] = [];
        const column = this.data[c];
        for ( let r = area.start.row; r <= area.end.row; r++ ){
          if (!column[r]) column[r] = new Cell();
          f(column[r], c, r);
        }
      }
    }
    else {
      // we can loop over indexes that don't exist, just check for existence
      for ( let c = area.start.column; c <= area.end.column; c++ ){
        if (this.data[c]){
          const column = this.data[c];
          for ( let r = area.start.row; r <= area.end.row; r++ ){
            if (column[r]) f(column[r], c, r);
          }
        }
      }
    }
  }

  /**
   * iterates over all cells (using loops) and runs function per-cell.
   * FIXME: switch to indexing on empty indexes? (...)
   */
  public IterateAll(f: (cell: Cell) => void){
    const column_keys = Object.keys(this.data);
    for (const column of column_keys){
      const n_column = Number(column) || 0;
      const row_keys = Object.keys(this.data[n_column]);
      for (const row_key of row_keys){
        f(this.data[n_column][Number(row_key)]);
      }
    }
  }

}
