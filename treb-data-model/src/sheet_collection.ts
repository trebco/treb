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


import type { Sheet } from './sheet';

/**
 * we spend a lot of time looking up sheets by name, or id, or 
 * sometimes index. it makes sense to have a class that can 
 * support all of these, ideally without looping.
 * 
 * we just have to make sure that no one is assigning to the
 * array, or we'll lose track. 
 * 
 * also there are some operations -- rename, in particular -- that
 * require updating indexes.
 * 
 * 
 * FIXME: new file (1 class per file)
 */
export class SheetCollection {

  /** 
   * returns a read-only copy of the list. useful for indexing or 
   * functional-style calls. it's not actually read-only, but it's a 
   * copy, so changes will be ignored.
   */
  public get list() {
    return this.sheets_.slice(0);
  }

  /**
   * length of list
   */
  public get length() {
    return this.sheets_.length;
  }

  /** map of (normalized) name -> sheet */
  protected names: Map<string, Sheet> = new Map();

  /** map of id -> sheet */
  protected ids: Map<number, Sheet> = new Map();

  /** the actual list */
  private sheets_: Sheet[] = [];

  /**
   * remove any existing sheets and add the passed list. updates indexes.
   */
  public Assign(sheets: Sheet[]) {
    this.sheets_ = [...sheets];
    this.UpdateIndexes();
  }

  /** 
   * add a new sheet to the end of the list (push). updates indexes. 
   */
  public Add(sheet: Sheet) {
    this.sheets_.push(sheet);
    this.UpdateIndexes();
  }

  /** 
   * wrapper for array splice. updates indexes. 
   */
  public Splice(insert_index: number, delete_count: number, ...items: Sheet[]) {
    this.sheets_.splice(insert_index, delete_count, ...items);
    this.UpdateIndexes();
  }
  
  /**
   * so our new strategy is to add lookup methods first -- then 
   * we can fix the underlying storage implementation.
   * 
   * NOTE we normalize strings here so you do not need to do it (don't)
   */
   public Find(id: string|number): Sheet|undefined {

    // console.info('get', typeof id);

    if (typeof id === 'string') {
      return this.names.get(id.toLocaleUpperCase());
    }
    else {
      return this.ids.get(id);
    }

    return undefined;
  }

  /** get name for sheet with given id */
  public Name(id: number): string|undefined {
    return this.ids.get(id)?.name || undefined;
  }

  /** get ID for sheet with given name */
  public ID(name: string): number|undefined {
    return this.names.get(name.toLocaleUpperCase())?.id || undefined;
  }

  /** not sure why this is private, makes it a little more complicated */
  public UpdateIndexes(): void {

    this.names.clear();
    this.ids.clear();

    for (const sheet of this.sheets_) {
      const uc = sheet.name.toLocaleUpperCase();
      this.names.set(uc, sheet);
      this.ids.set(sheet.id, sheet);
    }

  }


}
