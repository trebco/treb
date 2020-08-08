
import { IArea, Area } from 'treb-base-types';

export class NamedRangeCollection {

  private forward: {[index: string]: Area} = {};
  private backward: Array<{name: string; range: Area}> = [];

  /** FIXME: why not an accessor? */
  public Count(): number {
    return this.backward.length;
  }

  /** FIXME: why not just use toJSON? */
  public Serialize() {
    return JSON.parse(JSON.stringify(this.Map()));
  }

  public Deserialize(data?: {[index: string]: IArea}) {
    this.Reset();
    if (data) {
      for (const key of Object.keys(data)) {
        this.SetName(key, new Area(data[key].start, data[key].end), false);
      }
      this.RebuildList();
    }
  }

  /**
   * add name. names are case-insensitive. if the name already
   * exists, it will be overwritten.
   */
  public SetName(name: string, range: Area, apply = true) {
    const validated = this.ValidateNamed(name);
    if (!validated) {
      console.warn('invalid name');
      return;
    }
    if (range.entire_column || range.entire_row) {
      console.warn('invalid range');
      return;
    }
    this.forward[validated] = range;
    if (apply) {
      this.RebuildList();
    }
  }

  public SetNames(list: {[index: string]: IArea}) {
    for (const key of Object.keys(list)) {
      const area = list[key];
      this.SetName(key, new Area(area.start, area.end), false);
    }
    this.RebuildList();
  }

  public ClearName(name: string, apply = true) {
    delete this.forward[name];
    if (apply) {
      this.RebuildList();
    }
  }

  public Reset() {
    this.forward = {};
    this.backward = [];
  }

  public Get(name: string) {
    return this.forward[name.toUpperCase()];
  }

  /** FIXME: accessor */
  public Map() {
    return this.forward;
  }

  /** FIXME: accessor */
  public List() {
    return this.backward;
  }

  /**
   * named range rules:
   *
   * - legal characters are alphanumeric, underscore and dot.
   * - must start with letter or underscore (not a number or dot).
   * - cannot look like a spreadsheet address, which is 1-3 letters followed by numbers.
   *
   * returns a normalized name (just caps, atm)
   */
  public ValidateNamed(name: string) {
    name = name.trim();
    if (!name.length) return false;
    if (/^[A-Za-z]{1,3}\d+$/.test(name)) return false;
    if (/[^A-Za-z\d_.]/.test(name)) return false;
    if (/^[^A-Za-z_]/.test(name)) return false;
    return name.toUpperCase();
  }

  // was in sheet


  /**
   * fix named range references after row/column insert/delete
   */
  public PatchNamedRanges(before_column: number, column_count: number, before_row: number, row_count: number) {

    const copy = this.List().slice(0);

    for (const entry of copy) {

      const key = entry.name;
      const range = entry.range;

      if (column_count && before_column <= range.end.column) {

        /*
        // (1) we are before the insert point, not affected

        if (before_column > range.end.column) {
          continue;
        }
        */

        if (column_count > 0) {

          // (2) it's an insert and we are past the insert point:
          //     increment [start] and [end] by [count]

          if (before_column <= range.start.column) {
            range.Shift(0, column_count);
          }

          // (3) it's an insert and we contain the insert point:
          //     increment [end] by [count]

          else if (before_column > range.start.column && before_column <= range.end.column) {
            range.ConsumeAddress({row: range.end.row, column: range.end.column + column_count});
          }

          else {
            console.warn(`PNR X case 1`, before_column, column_count, JSON.stringify(range));
          }

        }
        else if (column_count < 0) {

          // (4) it's a delete and we are past the delete point (before+count):
          //     decrement [start] and [end] by [count]

          if (before_column - column_count <= range.start.column) {
            range.Shift(0, column_count);
          }

          // (5) it's a delete and contains the entire range

          else if (before_column <= range.start.column && before_column - column_count > range.end.column) {
            this.ClearName(key, false);
          }

          // (6) it's a delete and contains part of the range. clip the range.

          else if (before_column <= range.start.column) {
            const last_column = before_column - column_count - 1;
            this.SetName(key, new Area({
              row: range.start.row, column: last_column + 1 + column_count }, {
                row: range.end.row, column: range.end.column + column_count }), false);
          }

          else if (before_column <= range.end.column) {
            const last_column = before_column - column_count - 1;

            if (last_column >= range.end.column) {
              this.SetName(key, new Area({
                row: range.start.row, column: range.start.column }, {
                  row: range.end.row, column: before_column - 1 }), false);
            }
            else {
              this.SetName(key, new Area({
                row: range.start.row, column: range.start.column }, {
                  row: range.end.row, column: range.start.column + range.columns + column_count - 1}), false);
            }

          }

          else {
            console.warn(`PNR X case 2`, before_column, column_count, JSON.stringify(range));
          }

        }
      }


      if (row_count && before_row <= range.end.row) {

        /*
        // (1) we are before the insert point, not affected

        if (before_row > range.end.row) {
          continue;
        }
        */

        if (row_count > 0) {

          // (2) it's an insert and we are past the insert point:
          //     increment [start] and [end] by [count]

          if (before_row <= range.start.row) {
            range.Shift(row_count, 0);
          }

          // (3) it's an insert and we contain the insert point:
          //     increment [end] by [count]

          else if (before_row > range.start.row && before_row <= range.end.row) {
            range.ConsumeAddress({row: range.end.row + row_count, column: range.end.column});
          }

          else {
            console.warn(`PNR X case 3`, before_row, row_count, JSON.stringify(range));
          }

        }
        else if (row_count < 0) {

          // (4) it's a delete and we are past the delete point (before+count):
          //     decrement [start] and [end] by [count]

          if (before_row - row_count <= range.start.row) {
            range.Shift(row_count, 0);
          }

          // (5) it's a delete and contains the entire range

          else if (before_row <= range.start.row && before_row - row_count > range.end.row) {
            this.ClearName(key, false);
          }

          // (6) it's a delete and contains part of the range. clip the range.

          else if (before_row <= range.start.row) {
            const last_row = before_row - row_count - 1;
            this.SetName(key, new Area({
              column: range.start.column, row: last_row + 1 + row_count }, {
                column: range.end.column, row: range.end.row + row_count }), false);
          }

          else if (before_row <= range.end.row) {
            const last_row = before_row - row_count - 1;
            if (last_row >= range.end.row) {
              this.SetName(key, new Area({
                column: range.start.column, row: range.start.row }, {
                  column: range.end.column, row: before_row - 1 }), false);
            }
            else {
              this.SetName(key, new Area({
                column: range.start.column, row: range.start.row }, {
                  column: range.end.column, row: range.start.row + range.rows + row_count - 1 }), false);
            }

          }

          else {
            console.warn(`PNR X case 4`, before_row, row_count, JSON.stringify(range));
          }

        }
      }

    }

    this.RebuildList();

  }

  public RebuildList() {
    this.backward = [];
    for (const key of Object.keys(this.forward)) {
      this.backward.push({ name: key, range: this.forward[key] });
    }
  }

}
