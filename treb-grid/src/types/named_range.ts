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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { IArea, Area } from 'treb-base-types';

/**
 * I want to repurpose named ranges (a little) to allow either values or 
 * arbitrary expressions. this is sort of 1/2 way between named ranges and
 * "macro functions".
 * 
 * not sure if we should change named ranges, or create a side path for 
 * "named expressions".
 */

export class NamedRangeCollection {

  private forward: {[index: string]: Area} = {};
  private backward: Array<{name: string; range: Area}> = [];

  /** FIXME: why not an accessor? */
  public Count(): number {
    return this.backward.length;
  }

  /** FIXME: why not just use toJSON? */
  public Serialize(): Record<string, IArea> {
    return JSON.parse(JSON.stringify(this.Map()));
  }

  public Deserialize(data?: Record<string, IArea>): void {
    this.Reset();
    if (data) {
      for (const key of Object.keys(data)) {
        this.SetName(key, new Area(data[key].start, data[key].end), false);
      }
      this.RebuildList();
    }
  }

  /**
   * match an area, optionally a target within a larger area (for selections).
   * we don't use the selection directly, as we may need to adjust target for
   * merge area.
   */
  public MatchSelection(area: Area, target?: Area): string|undefined {

    if (!area.start.sheet_id) { 
      throw new Error('match selection without sheet id'); 
    }

    let label: string|undefined;
    for (const entry of this.List()) {
      if (entry.range.start.sheet_id === area.start.sheet_id) {
        if (entry.range.Equals(area)) {
          label = entry.name; // don't break, in case there's a match for target which takes precendence.
        }
        if (target?.Equals(entry.range)) {
          return entry.name;
        }
      }
    }
    return label;
  }

  /**
   * add name. names are case-insensitive. if the name already
   * exists, it will be overwritten.
   * 
   * update: returns success (FIXME: proper errors)
   */
  public SetName(name: string, range: Area, apply = true): boolean {
    const validated = this.ValidateNamed(name);
    if (!validated) {
      console.warn('invalid name');
      return false;
    }
    if (range.entire_column || range.entire_row) {
      console.warn('invalid range');
      return false;
    }
    this.forward[validated] = range;
    if (apply) {
      this.RebuildList();
    }
    return true;
  }

  public SetNames(list: {[index: string]: IArea}): void {
    for (const key of Object.keys(list)) {
      const area = list[key];
      this.SetName(key, new Area(area.start, area.end), false);
    }
    this.RebuildList();
  }

  public ClearName(name: string, apply = true): void {
    delete this.forward[name];
    if (apply) {
      this.RebuildList();
    }
  }

  /**
   * if we delete a sheet, remove ranges in that sheet
   * @param sheet_id 
   */
  public RemoveRangesForSheet(sheet_id: number, apply = true) {

    const temp: {[index: string]: Area} = {};
    const list = this.List();    
    
    for (const entry of list) {
      if (entry.range.start.sheet_id !== sheet_id) {
        temp[entry.name] = entry.range;
      }
    }

    this.forward = temp;

    if (apply) {
      this.RebuildList();
    }
  }

  public Reset(): void {
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
  public ValidateNamed(name: string): string|false {
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
  public PatchNamedRanges(sheet_id: number, before_column: number, column_count: number, before_row: number, row_count: number) {

    const copy = this.List().slice(0);

    for (const entry of copy) {

      const key = entry.name;
      const range = entry.range;

      if (range.start.sheet_id !== sheet_id) {
        console.info('skipping name', key);
        continue;
      }

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
              row: range.start.row, column: last_column + 1 + column_count, sheet_id }, {
                row: range.end.row, column: range.end.column + column_count }), false);
          }

          else if (before_column <= range.end.column) {
            const last_column = before_column - column_count - 1;

            if (last_column >= range.end.column) {
              this.SetName(key, new Area({
                row: range.start.row, column: range.start.column, sheet_id }, {
                  row: range.end.row, column: before_column - 1 }), false);
            }
            else {
              this.SetName(key, new Area({
                row: range.start.row, column: range.start.column, sheet_id }, {
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
              column: range.start.column, row: last_row + 1 + row_count, sheet_id }, {
                column: range.end.column, row: range.end.row + row_count }), false);
          }

          else if (before_row <= range.end.row) {
            const last_row = before_row - row_count - 1;
            if (last_row >= range.end.row) {
              this.SetName(key, new Area({
                column: range.start.column, row: range.start.row, sheet_id }, {
                  column: range.end.column, row: before_row - 1 }), false);
            }
            else {
              this.SetName(key, new Area({
                column: range.start.column, row: range.start.row, sheet_id }, {
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

  public RebuildList(): void {
    this.backward = [];
    for (const key of Object.keys(this.forward)) {
      this.backward.push({ name: key, range: this.forward[key] });
    }
  }

}
