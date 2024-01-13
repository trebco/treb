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

import type { Sheet } from './sheet';
import type { IArea, ICellAddress, Table, CellStyle } from 'treb-base-types';
import type { SerializedSheet } from './sheet_types';
import { NamedRangeCollection } from './named_range';
import { type ExpressionUnit, type UnitAddress, type UnitStructuredReference, type UnitRange, Parser, QuotedSheetNameRegex } from 'treb-parser';
import { Area, IsCellAddress, Style } from 'treb-base-types';

export interface ConnectedElementType {
  formula: string;
  update?: (instance: ConnectedElementType) => void;
  internal?: unknown; // opaque type to prevent circular dependencies
}

export interface SerializedMacroFunction {
  name: string;
  function_def: string;
  argument_names?: string[];
  description?: string;
}

/**
 * we define this as extending the serialized version, rather
 * than taking out the parameter, so we can make that def public
 * in the API types.
 */
export interface MacroFunction extends SerializedMacroFunction {
  expression?: ExpressionUnit;
}

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

/**
 * FIXME: this should move out of the grid module, grid should be focused on view
 */
export class DataModel {

  public readonly parser: Parser = new Parser();

  /** document metadata */
  public document_name?: string;

  /** document metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public user_data?: any;

  /** 
   * list of sheets. we _should_ index these by ID, so we 
   * don't have to look up. FIXME/TODO
   */
  // public sheets: Sheet[] = [];

  /**
   * this prevents assignment, but not push/pop/splice (baby steps)
   */
  // public get sheets(): Sheet[] {
  //  return this._sheets;
  //}
  public readonly sheets = new SheetCollection();

  /** named ranges are document-scope, we don't support sheet-scope names */
  public readonly named_ranges = new NamedRangeCollection;

  /** macro functions are functions written in spreadsheet language */
  // public macro_functions: Record<string, MacroFunction> = {};
  public readonly macro_functions: Map<string, MacroFunction> = new Map();

  /** 
   * new, for parametric. these might move to a different construct. 
   */
  //public named_expressions: Record<string, ExpressionUnit> = {};
  public readonly named_expressions: Map<string, ExpressionUnit> = new Map();

  /** index for views */
  public view_count = 0;

  /**
   * base style properties moved to model, so we can have a single
   * and consistent reference.
   */
  public theme_style_properties: CellStyle = JSON.parse(JSON.stringify(Style.DefaultProperties));

  /**
   * tables are global, because we need to reference them by name; and they
   * need unique names, so we need to keep track of names. name matching is
   * icase so we lc the names before inserting.
   */
  public tables: Map<string, Table> = new Map();

  /**
   * putting this here temporarily. it should probably move into a table
   * manager class or something like that.
   */
  public ResolveStructuredReference(ref: UnitStructuredReference, context: ICellAddress): UnitAddress|UnitRange|undefined {

    let table: Table|undefined;

    // if there's no table specified, it means "I am in the table".
    // in that case we need to find the table from the cell.

    if (ref.table) {
      table = this.tables.get(ref.table.toLowerCase());
    }
    else {
      if (context.sheet_id) {
        const sheet = this.sheets.Find(context.sheet_id);
        const cell = sheet?.CellData(context);
        table = cell?.table;
      }
    }

    if (!table) {
      return undefined; // table not found
    }

    // resolve the column
    const reference_column = ref.column.toLowerCase();
    let column = -1;

    if (table.columns) { // FIXME: make this required
      for (let i = 0; i < table.columns.length; i++) {
        if (reference_column === table.columns[i]) {
          column = table.area.start.column + i;
          break;
        }
      }
    }

    if (column < 0) {
      return undefined; // invalid column
    }

    // for row scope, make sure we're in a valid row.
    
    if (ref.scope === 'row') {

      const row = context.row;
      if (row < table.area.start.row || row > table.area.end.row) {
        return undefined; // invalid row for "this row"
      }

      // OK, we can use this

      return {
        label: ref.label,
        type: 'address',
        row, 
        column,
        sheet_id: table.area.start.sheet_id,
        id: ref.id,
        position: ref.position,
      };

    }
    else {

      // the difference between 'all' and 'column' is that 'all' includes
      // the first (header) row and the last (totals) row, if we have one.

      let start_row = table.area.start.row;
      let end_row = table.area.end.row; 

      if (ref.scope === 'column') { 
        start_row++; // skip headers
        if (table.totals_row) {
          end_row--; // skip totals
        }
      }

      return {
        label: ref.label,
        type: 'range',
        position: ref.position,
        id: ref.id,
        start: {
          type: 'address',
          row: start_row,
          column,
          sheet_id: table.area.start.sheet_id,
          label: ref.label,
          position: ref.position,
          id: 0,
        },
        end: {
          type: 'address',
          row: end_row,
          column,
          label: ref.label,
          position: ref.position,
          id: 0,
        },
      }

    }
    
    return undefined;
  }

  /**
   * return an address label for this address (single cell or range)
   * 
   * @param address 
   * @param active_sheet 
   */
  public AddressToLabel(address: ICellAddress|IArea, active_sheet?: Sheet) {

    const start = IsCellAddress(address) ? address : address.start;
    const parts = IsCellAddress(address) ? 
      [Area.CellAddressToLabel(address)] : 
      [Area.CellAddressToLabel(address.start), Area.CellAddressToLabel(address.end)];

    const sheet = this.sheets.Find(start.sheet_id || 0);
    const name = (sheet?.name) ? 
        (QuotedSheetNameRegex.test(sheet.name) ? `'${sheet.name}'` : sheet.name) : '';
    
    return name + (name ? '!' : '') + (parts[0] === parts[1] ? parts[0] : parts.join(':'));
    
  }

  // --- resolution api, moved from calculator ---------------------------------

  /**
   * returns false if the sheet cannot be resolved, which probably
   * means the name changed (that's the case we are working on with
   * this fix).
   */
  public ResolveSheetID(expr: UnitAddress|UnitRange, context?: ICellAddress, active_sheet?: Sheet): boolean {

    const target = expr.type === 'address' ? expr : expr.start;

    if (target.sheet_id) {
      return true;
    }

    if (target.sheet) {
      const sheet = this.sheets.Find(target.sheet);
      if (sheet) {
        target.sheet_id = sheet.id;
        return true;
      }

      /*
      const lc = target.sheet.toLowerCase();
      for (const sheet of this.model.sheets.list) {
        if (sheet.name.toLowerCase() === lc) {
          target.sheet_id = sheet.id;
          return true;
        }
      }
      */
    }
    else if (context?.sheet_id) {
      target.sheet_id = context.sheet_id;
      return true;
    }
    else if (active_sheet?.id) {
      target.sheet_id = active_sheet.id;
      return true;
    }

    return false; // the error

  }

  /** wrapper method ensures it always returns an Area (instance, not interface) */
  public ResolveArea(address: string|ICellAddress|IArea, active_sheet: Sheet): Area {
    const resolved = this.ResolveAddress(address, active_sheet);
    return IsCellAddress(resolved) ? new Area(resolved) : new Area(resolved.start, resolved.end);
  }

  /** 
   * moved from embedded sheet. also modified to preserve ranges, so it
   * might return a range (area). if you are expecting the old behavior
   * you need to check (perhaps we could have a wrapper, or make it optional?)
   * 
   * Q: why does this not go in grid? or model? (...)
   * Q: why are we not preserving absoute/relative? (...)
   * 
   */
  public ResolveAddress(address: string|ICellAddress|IArea, active_sheet: Sheet): ICellAddress|IArea {
    
    if (typeof address === 'string') {
      const parse_result = this.parser.Parse(address);
      if (parse_result.expression && parse_result.expression.type === 'address') {
        this.ResolveSheetID(parse_result.expression, undefined, active_sheet);
        return {
          row: parse_result.expression.row,
          column: parse_result.expression.column,
          sheet_id: parse_result.expression.sheet_id,
        };
      }
      else if (parse_result.expression && parse_result.expression.type === 'range') {
        this.ResolveSheetID(parse_result.expression, undefined, active_sheet);
        return {
          start: {
            row: parse_result.expression.start.row,
            column: parse_result.expression.start.column,
            sheet_id: parse_result.expression.start.sheet_id,
          },
          end: {
            row: parse_result.expression.end.row,
            column: parse_result.expression.end.column,
          }
        };
      }
      else if (parse_result.expression && parse_result.expression.type === 'identifier') {

        // is named range guaranteed to have a sheet ID? (I think yes...)

        const named_range = this.named_ranges.Get(parse_result.expression.name);
        if (named_range) {
          return named_range;
        }
      }

      return { row: 0, column: 0 }; // default for string types -- broken

    }

    return address; // already range or address

  }
  
  public AddConnectedElement(connected_element: ConnectedElementType): number {
    const id = this.connected_element_id++;
    this.connected_elements.set(id, connected_element);
    return id;
  }

  public RemoveConnectedElement(id: number) {
    const element = this.connected_elements.get(id);
    this.connected_elements.delete(id);
    return element;
  }

  /** 
   * identifier for connected elements, used to manage. these need to be 
   * unique in the lifetime of a model instance, but no more than that.
   */
  protected connected_element_id = 100;

  /** 
   * these are intentionally NOT serialized. they're ephemeral, created 
   * at runtime and not persistent.
   * 
   * @internal
   */
  public connected_elements: Map<number, ConnectedElementType> = new Map();

}

export interface ViewModel {
  active_sheet: Sheet;
  view_index: number;
}

export interface SerializedNamedExpression {
  name: string;
  expression: string;
}

export interface SerializedModel {
  sheet_data: SerializedSheet[];
  active_sheet: number;
  named_ranges?: Record<string, IArea>;
  macro_functions?: MacroFunction[];
  tables?: Table[];
  named_expressions?: SerializedNamedExpression[];
  decimal_mark?: ','|'.';
}
