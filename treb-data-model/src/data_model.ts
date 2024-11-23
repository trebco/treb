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
import { SheetCollection } from './sheet_collection';
import { type UnitAddress, type UnitStructuredReference, type UnitRange, Parser, QuotedSheetNameRegex, DecimalMarkType, ArgumentSeparatorType } from 'treb-parser';
import type { IArea, ICellAddress, Table, CellStyle, CellValue } from 'treb-base-types';
import { Is2DArray } from 'treb-base-types';
import { Area, IsCellAddress, Style } from 'treb-base-types';
import type { SerializedNamed } from './named';
import { NamedRangeManager } from './named';
import type { ConnectedElementType, MacroFunction } from './types';
import type { LanguageModel } from './language-model';

/**
 * 
 */
export class DataModel {

  public readonly parser: Parser = new Parser();

  /** moved from embedded spreadsheet */
  public language_model?: LanguageModel;

  /** document metadata */
  public document_name?: string;

  /** 
   * document metadata. this is opaque to everyone except the user, so
   * we're intentionally leaving it as unknown except where users have 
   * direct access (embedded spreadsheet). 
   */
  public user_data?: unknown;

  /**
   * 
   */
  public readonly sheets = new SheetCollection();

  /** new composite collection (TODO: add macro functions too?) */
  public readonly named = new NamedRangeManager(this.parser);

  /** macro functions are functions written in spreadsheet language */
  public readonly macro_functions: Map<string, MacroFunction> = new Map();

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
   * we're wrapping up the get name method so we can check for a sheet
   * name -- we have the list of sheet names. we could pass that to the 
   * name list manager but it's easier for us to intercept the call.
   * I thought about wrapping up more API functions here, but that seems
   * unecessary atm.
   */
  public GetName(name: string, scope: number) {

    // helpfully this is not a legal character in names or sheets, so
    // we don't need a full parser to handle the split. watch out for
    // quoted sheet names.

    const parts = name.split(/!/);

    if (parts.length === 1) {
      return this.named.Get_(name, scope);
    }

    let sheet_name = parts[0];

    // can we just test with indexes? surely faster

    if (/^'.*?'$/.test(sheet_name)) {
      sheet_name = sheet_name.substring(1, sheet_name.length - 1);
    }
    
    const sheet = this.sheets.ID(sheet_name);
    return this.named.Get_(parts[1], sheet || 0, true); // require scope in this case


  }

  /**
   * @param force_locale - always parse assuming a locale like en-us (comma
   * argument separators). the current thinking is that this is required for
   * XLSX import, although that might be incorrect.
   */
  public UnserializeNames(names: SerializedNamed[], active_sheet?: Sheet, force_locale = false) {

    this.parser.Save();
    if (force_locale) {
      this.parser.SetLocaleSettings(DecimalMarkType.Period, ArgumentSeparatorType.Comma);
    }

    //const sorted = names.map(named => {
    for (const named of names) {

      if (!named.expression) { continue; }

      console.info("NE", named.expression);

      const parse_result = this.parser.Parse(named.expression); 
      if (parse_result.expression) {

        const scope = (typeof named.scope === 'string') ? this.sheets.ID(named.scope) : undefined;

        if (parse_result.expression.type === 'address' || parse_result.expression.type === 'range') {

          const [start, end] = parse_result.expression.type === 'range' ? 
            [ parse_result.expression.start, parse_result.expression.end, ] : 
            [ parse_result.expression, parse_result.expression ];

          if (start.sheet) {
            if (/^\[\d+\]/.test(start.sheet)) {
              console.warn('named range refers to an external file');
            }
            else {
              const area = new Area({...start, sheet_id: this.sheets.ID(start.sheet), }, end);
    
              if (area.start.sheet_id) {
                this.named.SetNamedRange(named.name, area, scope);
              }
              else {
                console.warn("missing sheet ID?", start);
              }
            }
          }
          else {
            console.warn("missing sheet name?", start);
          }

        }
        else {
          this.parser.Walk(parse_result.expression, unit => {
            if (unit.type === 'address' || unit.type === 'range') {
              if (unit.type === 'range') {
                unit = unit.start;
              }
              if (!unit.sheet_id) {
                if (unit.sheet) {
                  unit.sheet_id = this.sheets.ID(unit.sheet);
                }
              }
              if (!unit.sheet_id) {
                unit.sheet_id = active_sheet?.id;
              }
              return false; // don't continue in ranges
            }
            return true;
          });

          this.named.SetNamedExpression(named.name, parse_result.expression, scope);
        }

      }

    }
    
    this.parser.Restore();

  }

  /**
   * serialize names. ranges are easy, but make sure there's a sheet name
   * in each address (and remove the ID). expressions are a little more 
   * complicated.
   */
  public SerializeNames(active_sheet?: Sheet): SerializedNamed[] {
    const list: SerializedNamed[] = [];

    for (const entry of this.named.list) {

      const named: SerializedNamed = {
        name: entry.name,
        expression: '',
        type: entry.type,
      };

      if (entry.scope) {
        named.scope = this.sheets.Name(entry.scope);
      }

      if (entry.type === 'expression') {

        this.parser.Walk(entry.expression, unit => {
          if (unit.type === 'address' || unit.type === 'range') {

            const test = unit.type === 'range' ? unit.start : unit;
            test.absolute_column = test.absolute_row = true;

            if (!test.sheet) {
              if (test.sheet_id) {
                test.sheet = this.sheets.Name(test.sheet_id);
              }
              if (!test.sheet) {
                test.sheet = active_sheet?.name;
              }
            }

            if (unit.type === 'range') {
              unit.end.absolute_column = unit.end.absolute_row = true;
            }

            return false;
          }
          /*

          // if we do the function export thing, we need to call that here
          // (exporting functions to fix missing arguments or add decorators).
          // we're not doing that, at least not yet.

          else if (unit.type === 'call' && options.export_functions) {
            // ...
          }
          */
          return true;
        });

        // this is using the current locale settings, but unserialize
        // assumes we are unserializing in US-style locale. I think we
        // do that because excel always uses that? not sure, but we need
        // to be consistent.

        named.expression = this.parser.Render(entry.expression, { missing: '' });

      }
      else {

        const area = {
          start: {
            ...entry.area.start,
            absolute_column: true,
            absolute_row: true,
          },
          end: {
            ...entry.area.end,
            absolute_column: true,
            absolute_row: true,
          },
        };

        named.expression = this.AddressToLabel(area);

      }

      list.push(named);

    }

    return list;
  }

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
  public AddressToLabel(address: ICellAddress|IArea) {

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
  public ResolveArea(address: string|ICellAddress|IArea, active_sheet: Sheet, options?: { r1c1?: boolean }): Area {
    const resolved = this.ResolveAddress(address, active_sheet, options);
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
  public ResolveAddress(address: string|ICellAddress|IArea, active_sheet: Sheet, options? : { r1c1?: boolean }): ICellAddress|IArea {
    
    if (typeof address === 'string') {

      if (options?.r1c1) {
        this.parser.Save();
        this.parser.flags.r1c1 = true;
      }

      const parse_result = this.parser.Parse(address);

      if (options?.r1c1) {
        this.parser.Restore();
      }

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

        const named = this.GetName(parse_result.expression.name, active_sheet.id);
        if (named?.type === 'range') {
          return named.area;
        }

        /*
        // is named range guaranteed to have a sheet ID? (I think yes...)

        const named_range = this.named_ranges.Get(parse_result.expression.name);
        if (named_range) {
          return named_range;
        }
        */

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



  // --- moving translation here ----------------------------------------------

  
  /** 
   * maps common language (english) -> local language. this should 
   * be passed in (actually set via a function).
   */
  private language_map?: Record<string, string>;

  /**
   * maps local language -> common (english). this should be constructed
   * when the forward function is passed in, so there's a 1-1 correspondence.
   */
 private reverse_language_map?: Record<string, string>;


  /**
   * set the language translation map. this is a set of function names 
   * (in english) -> the local equivalent. both should be in canonical form,
   * as that will be used when we translate one way or the other.
   */
  public SetLanguageMap(language_map?: Record<string, string>) {

    if (!language_map) {
      this.language_map = this.reverse_language_map = undefined;
    }
    else {

      const keys = Object.keys(language_map);

      // normalize forward
      this.language_map = {};
      for (const key of keys) {
        this.language_map[key.toUpperCase()] = language_map[key];
      }

      // normalize backward
      this.reverse_language_map = {};
      for (const key of keys) {
        const value = language_map[key];
        this.reverse_language_map[value.toUpperCase()] = key;
      }

    }

    /*
    // we might need to update the current displayed selection. depends
    // on when we expect languages to be set.

    if (!this.primary_selection.empty) {
      this.Select(this.primary_selection, this.primary_selection.area, this.primary_selection.target);
    }
    */

  }

  /**
   * translate function from common (english) -> local language. this could
   * be inlined (assuming it's only called in one place), but we are breaking
   * it out so we can develop/test/manage it.
   */
  public TranslateFunction(value: string, options?: { r1c1?: boolean }): string {
    if (this.language_map) {
      return this.TranslateInternal(value, this.language_map, this.language_model?.boolean_true, this.language_model?.boolean_false, options);
    }
    return value;
  }

  /**
   * translate from local language -> common (english).
   * @see TranslateFunction
   */
  public UntranslateFunction(value: string, options?: { r1c1?: boolean }): string {
    if (this.reverse_language_map) {
      return this.TranslateInternal(value, this.reverse_language_map, 'TRUE', 'FALSE', options);
    }
    return value;
  }

  public UntranslateData(value: CellValue|CellValue[]|CellValue[][], options?: { r1c1?: boolean }): CellValue|CellValue[]|CellValue[][] {

    if (Array.isArray(value)) {

      // could be 1d or 2d. typescript is complaining, not sure why...

      if (Is2DArray(value)) {
        return value.map(row => row.map(entry => {
          if (entry && typeof entry === 'string' && entry[0] === '=') {
            return this.UntranslateFunction(entry, options);
          }
          return entry;
        }));
      }
      else {
        return value.map(entry => {
          if (entry && typeof entry === 'string' && entry[0] === '=') {
            return this.UntranslateFunction(entry, options);
          }
          return entry;
        });
      }

    }
    else if (value && typeof value === 'string' && value[0] === '=') {

      // single value
      value = this.UntranslateFunction(value, options);

    }

    return value;

  }


  /**
   * translation back and forth is the same operation, with a different 
   * (inverted) map. although it still might be worth inlining depending
   * on cost.
   * 
   * FIXME: it's about time we started using proper maps, we dropped 
   * support for IE11 some time ago.
   */
  private TranslateInternal(value: string, map: Record<string, string>, boolean_true?: string, boolean_false?: string, options?: { r1c1?: boolean }): string {

    this.parser.Save();
    this.parser.flags.r1c1 = options?.r1c1;

    const parse_result = this.parser.Parse(value);

    if (parse_result.expression) {
      
      let modified = false;
      this.parser.Walk(parse_result.expression, unit => {
        if (unit.type === 'call') {
          const replacement = map[unit.name.toUpperCase()];
          if (replacement) {
            modified = true;
            unit.name = replacement;
          }
        }
        else if (unit.type === 'literal' && typeof unit.value === 'boolean') {

          // to/from english/locale depends on the direction, but we're not 
          // passing that in? FIXME, pass it as a parameter. it doesn't matter
          // here, but later when we render.

          modified = true;

        } 

        return true;
      });

      if (modified) {
        return '=' + this.parser.Render(parse_result.expression, { 
          missing: '', boolean_true, boolean_false,
          r1c1: options?.r1c1,
        });
      }
    }

    this.parser.Restore();
    return value;

  }
  

  /** 
   * this is not public _yet_ 
   * 
   * @internal
   */
  public SetLanguage(model?: LanguageModel): void {

    this.language_model = model;

    if (!model) {
      this.SetLanguageMap(); // clear

      // set defaults for parsing. 

      this.parser.flags.boolean_true = 'TRUE';
      this.parser.flags.boolean_false = 'FALSE';

    }
    else {

      // create a name map for grid

      const map: Record< string, string > = {};

      if (model.functions) {
        for (const entry of model.functions || []) {
          map[entry.base.toUpperCase()] = entry.name; // toUpperCase because of a data error -- fix at the source
        }
      }

      this.SetLanguageMap(map);

      // console.info({map});

      if (!model.boolean_false) {
        model.boolean_false = map['FALSE'];
      }
      if (!model.boolean_true) {
        model.boolean_true = map['TRUE'];
      }

      // set defaults for parsing. 

      this.parser.flags.boolean_true = model.boolean_true || 'TRUE';
      this.parser.flags.boolean_false = model.boolean_false || 'FALSE';

      // console.info("booleans:", this.model.parser.flags.boolean_true, ",", this.model.parser.flags.boolean_false)

    }

    for (const sheet of this.sheets.list) {
      sheet.FlushCellStyles();
    }

  }

}

