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

import { Area } from 'treb-base-types';
import type { SerializedArea, IArea } from 'treb-base-types';
import type { ExpressionUnit } from 'treb-parser';

export interface NamedExpression {
  type: 'expression';
  expression: ExpressionUnit;
}

export interface NamedRange {
  type: 'range';
  area: Area;
}

export type Named = (NamedExpression | NamedRange) & {
  name: string;     // canonical name
  scope?: number;   // scope to sheet by ID
};

/** 
 * serialized type 
 * 
 * @privateRemarks
 * 
 * for the external type we switch on the presence of the area
 * or the expression. area uses a type that includes sheet names
 * (IArea should allow that?). expression here is a string.
 * 
 * we could theoretically switch the internal type the same way
 * and drop the string keys. something to think about.
 * 
 * when serialized, scope is either the sheet name or nothing 
 * (implicit global scope).
 */
export interface SerializedNamed {
  name: string;
  area?: SerializedArea;
  expression?: string;
  scope?: string;
}

/**
 * this is a type we're using in imports. it consolidates the 
 * two types. we should maybe switch as well, at least for
 * serialized representation? something to think about.
 */
export interface CompositeNamed {

  name: string;

  /** 
   * could be a address/range or a function expression. we'll distinguish
   * when we parse it.
   */
  expression: string;

  /** resolved sheet name */
  scope?: string;

}

/**
 * this is a replacement for the name manager, which handles 
 * operations relating to named ranges. 
 */
export class NamedRangeManager {

  /** 
   * this map is stored with normalized names. normalized names
   * here means we call `toLowerCase`. the objects themselves 
   * contain canonical names.
   * 
   * ...we've always had a map for this, for fast lookups. but
   * with scoping, we can't necessarily look up by name. let's try
   * using scope:name keys. that way we can search for scope:name
   * and then name and return the first match, if any. 
   * 
   */
  protected named: Map<string, Named> = new Map();
  
  public get list() {
    return this.named.values();
  }

  /** shorthand for setting named expression */
  public SetNamedExpression(name: string, expression: ExpressionUnit, scope?: number) {
    return this.SetName({
      type: 'expression',
      name,
      expression,
      scope,
    });
  }

  /** shorthand for setting named range */
  public SetNamedRange(name: string, area: IArea, scope?: number) {
    return this.SetName({
      type: 'range',
      name, 
      area: new Area(area.start, area.end),
      scope,
    });
  }

  /**
   * add name. names are case-insensitive. if the name already
   * exists, it will be overwritten.
   * 
   * update: returns success (FIXME: proper errors)
   */
  private SetName(named: Named): boolean {

    const name = named.name;
    // console.info('set name', named.name, {named});

    const validated = this.ValidateNamed(name);
    if (!validated) {
      console.warn('invalid name', {name});
      return false;
    }

    /*

    if (named.type === 'range') {

      // why is this considered invalid here? I've seen it done. 
      // maybe something we're doing with these ranges doesn't 
      // collapse them? (...)

      if (named.area.entire_column || named.area.entire_row) {
        console.info({named});
        console.warn('invalid range');
        return false;
      }

    }

    */

    // this.named.set(name.toLowerCase(), named);
    this.named.set(this.ScopedName(name, named.scope), named);

    return true;
  }

  private ScopedName(name: string, scope?: number) {
    if (typeof scope === 'number') {
      return scope + ':' + name.toLowerCase();
    }
    return name.toLowerCase();
  }

  public ClearName(name: string, scope?: number): void {

    if (typeof scope === 'number') {
      this.named.delete(this.ScopedName(name, scope));
    }
    else {
      this.named.delete(name.toLowerCase());
    }
  }

  /**
   * if we delete a sheet, remove ranges in that sheet. also remove
   * anything that's scoped to the sheet.
   */
  public RemoveRangesForSheet(sheet_id: number) {

    const remove: string[] = [];
    for (const [name, entry] of this.named) {
      if (entry.type === 'range' && entry.area.start.sheet_id === sheet_id) {
        remove.push(name);
      }
      else if (entry.scope === sheet_id) {
        remove.push(name);
      }
    }

    for (const name of remove) {
      this.named.delete(name)
    }

  }

  public Reset() {
    this.named.clear();
  }

  /**
   * requiring scope to help propgogate changes. we check the scoped 
   * version first; if that's not found, we default to the global version.
   * that implies that if there are both, we'll prefer the scoped name.
   * 
   * now possible to require scope, for qualified scoped names 
   */
  public Get_(name: string, scope: number, require_scope = false) {

    if (require_scope) {
      return this.named.get(this.ScopedName(name, scope));
    }
   
    return this.named.get(this.ScopedName(name, scope)) || this.named.get(name.toLowerCase());
  }

  /**
   * named range rules:
   *
   * - legal characters are alphanumeric, underscore and dot.
   * - must start with letter or underscore (not a number or dot).
   * - cannot look like a spreadsheet address, which is 1-3 letters followed by numbers.
   *
   * - apparently questuon marks are legal, but not in first position. atm 
   *   our parser will reject.
   * 
   * returns a normalized name (just caps, atm)
   */
  public ValidateNamed(name: string): string|false {
    name = name.trim();

    // can't be empty
    if (!name.length) return false;

    // can't look like a spreadsheet address
    if (/^[A-Za-z]{1,3}\d+$/.test(name)) return false;

    // can only contain legal characters
    if (/[^A-Za-z\d_.?]/.test(name)) return false;

    // must start with ascii letter or underscore
    if (/^[^A-Za-z_]/.test(name)) return false;

    return name.toUpperCase();
  }

  /**
   * match an area, optionally a target within a larger area (for selections).
   * we don't use the selection directly, as we may need to adjust target for
   * merge area. returns the name only if the area is an exact match.
   */
  public MatchSelection(area: Area, target?: Area): string|undefined {

    if (!area.start.sheet_id) { 
      throw new Error('match selection without sheet id'); 
    }

    let label: string|undefined;

    for (const entry of this.named.values()) {
      if (entry.type === 'range') {
        if (entry.area.start.sheet_id === area.start.sheet_id) {
          if (area.Equals(entry.area)) {
            label = entry.name; // don't break, in case there's a match for target which takes precendence.
          }
          if (target?.Equals(entry.area)) {
            return entry.name;
          }
        }
      }
    }

    return label;

  }


  /**
   * fix named range references after row/column insert/delete
   * 
   * surely there's overlap between this function and what we do in
   * grid when columns are added/removed. can we consolidate? (FIXME/TODO)
   * 
   */
  public PatchNamedRanges(sheet_id: number, before_column: number, column_count: number, before_row: number, row_count: number) {

    const copy = [...this.list];

    for (const entry of copy) {

      if (entry.type === 'expression') {
        continue;
      }

      const key = entry.name;
      const range = entry.area;

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
            this.ClearName(key);
          }

          // (6) it's a delete and contains part of the range. clip the range.

          else if (before_column <= range.start.column) {
            const last_column = before_column - column_count - 1;
            this.SetName({
              type: 'range', area: new Area({
              row: range.start.row, column: last_column + 1 + column_count, sheet_id }, {
                row: range.end.row, column: range.end.column + column_count }), name: key, });
          }

          else if (before_column <= range.end.column) {
            const last_column = before_column - column_count - 1;

            if (last_column >= range.end.column) {
              this.SetName({ type: 'range', area: new Area({
                row: range.start.row, column: range.start.column, sheet_id }, {
                  row: range.end.row, column: before_column - 1 }), name: key });
            }
            else {
              this.SetName({ type: 'range', name: key, area: new Area({
                row: range.start.row, column: range.start.column, sheet_id }, {
                  row: range.end.row, column: range.start.column + range.columns + column_count - 1})});
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
            this.ClearName(key);
          }

          // (6) it's a delete and contains part of the range. clip the range.

          else if (before_row <= range.start.row) {
            const last_row = before_row - row_count - 1;
            this.SetNamedRange(key, new Area({
              column: range.start.column, row: last_row + 1 + row_count, sheet_id }, {
                column: range.end.column, row: range.end.row + row_count }));
          }

          else if (before_row <= range.end.row) {
            const last_row = before_row - row_count - 1;
            if (last_row >= range.end.row) {
              this.SetNamedRange(key, new Area({
                column: range.start.column, row: range.start.row, sheet_id }, {
                  column: range.end.column, row: before_row - 1 }));
            }
            else {
              this.SetNamedRange(key, new Area({
                column: range.start.column, row: range.start.row, sheet_id }, {
                  column: range.end.column, row: range.start.row + range.rows + row_count - 1 }));
            }

          }

          else {
            console.warn(`PNR X case 4`, before_row, row_count, JSON.stringify(range));
          }

        }
      }

    }

  }

}


