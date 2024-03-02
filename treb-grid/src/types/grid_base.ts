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
 * grid base is a superclass for grid that takes over all (most) of the 
 * data operations, leaving UI operations (painting and interacting, plus
 * layout) in the grid subclass. 
 * 
 * this is part of an effort to support running outside of the browser,
 * but still using the command log to handle deltas.
 * 
 * this turns out to be a little like the (old) layout where we had modern
 * and legacy layouts -- a lot of stuff can be reused, but a lot can't.
 * 
 * calling this "grid" doesn't really make sense anymore, but we're not in
 * a hurry to change it either.
 * 
 */

import { EventSource } from 'treb-utils';
import type { DataModel, ConditionalFormat, // MacroFunction, SerializedModel, SerializedNamedExpression, 
              ViewModel, 
              DataValidation} from 'treb-data-model';

import type { Parser, UnitAddress} from 'treb-parser';
import { type ExpressionUnit, IllegalSheetNameRegex, ParseCSV, DecimalMarkType } from 'treb-parser';
import { Area, IsCellAddress, ValueType, DefaultTableSortOptions } from 'treb-base-types';
import type { ICellAddress, IArea, Cell, CellValue, CellStyle, Table, TableSortOptions, TableTheme, Complex, PatchOptions as PatchAreaOptions } from 'treb-base-types';

import { Sheet, type SerializeOptions, type Annotation } from 'treb-data-model';

import type { FunctionDescriptor} from '../editors/autocomplete_matcher';
import { AutocompleteMatcher } from '../editors/autocomplete_matcher';
import { NumberFormat, ValueParser } from 'treb-format';

import type { GridEvent } from './grid_events';
import { ErrorCode } from './grid_events';
import type { CommandRecord, DataValidationCommand, DuplicateSheetCommand, FreezeCommand, InsertColumnsCommand, InsertRowsCommand, ResizeColumnsCommand, ResizeRowsCommand, SelectCommand, SetRangeCommand, ShowSheetCommand, SortTableCommand } from './grid_command';
import { DefaultGridOptions, type GridOptions } from './grid_options';

import { BorderConstants } from './border_constants';

import { CommandKey } from './grid_command';
import type { Command, ActivateSheetCommand, 
               DeleteSheetCommand, UpdateBordersCommand, SheetSelection } from './grid_command';
import type { UpdateFlags } from './update_flags';
import type { FreezePane, LegacySerializedSheet } from 'treb-data-model';
import type { ClipboardCellData } from './clipboard_data';

interface PatchOptions extends PatchAreaOptions {
  sheet: Sheet;
}

// this is an assert, bascially, for completeness. we could probably
// resolve the eslint issue (there's no type option) but not sure it's
// useful to do so

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AssertNever = (value: never) => {
  console.error('invalid case');
};

export class GridBase {

  // --- public members --------------------------------------------------------

  /** events */
  public grid_events = new EventSource<GridEvent>();

  /** for recording */
  public command_log = new EventSource<CommandRecord>();

  public readonly model: DataModel;

  public readonly view: ViewModel;

  // --- public accessors ------------------------------------------------------

  public get active_sheet(): Sheet {
    return this.view.active_sheet;
  }

  public set active_sheet(sheet: Sheet) {
    this.view.active_sheet = sheet;
  }

  /** access the view index, if needed */
  public get view_index() {
    return this.view.view_index;
  }

  // --- protected members -----------------------------------------------------

  protected batch = false;

  protected batch_events: GridEvent[] = [];

  /**
   * single instance of AC. editors (function bar, ICE) have references.
   * this is in base, instead of subclass, because we use it to check
   * for valid names.
   */
  protected autocomplete_matcher = new AutocompleteMatcher();

  /**
   * flags/state (used for some recordkeeping -- not super important)
   */
  protected flags: Record<string, boolean> = {};

  /** */
  protected options: GridOptions;

  /**
   * spreadsheet language parser. used to pull out address
   * references from functions, for highlighting
   * 
   * ...
   * 
   * it's used for lots of stuff now, in addition to highlighting.
   * copy/paste with translation; csv; defines; and some other stuff.
   * still would like to share w/ parent though, if possible.
   * 
   * 
   * FIXME: need a way to share/pass parser flags
   * UPDATE: sharing parser w/ owner (embedded sheet)
   */
  protected parser: Parser;

  // --- constructor -----------------------------------------------------------

  constructor(
    options: GridOptions = {},
    model: DataModel) {

    this.model = model;

    this.view = {
      active_sheet: this.model.sheets.list[0],
      view_index: this.model.view_count++,
    };

    // shared parser

    this.parser = model.parser;

    // apply default options, meaning that you need to explicitly set/unset
    // in order to change behavior. FIXME: this is ok for flat structure, but
    // anything more complicated will need a nested merge

    this.options = { ...DefaultGridOptions, ...options };

  }

  // --- API methods -----------------------------------------------------------

  public RemoveConditionalFormat(options: {
        format?: ConditionalFormat;
        area?: IArea;
      }) {

    this.ExecCommand({
      key: CommandKey.RemoveConditionalFormat,
      ...options,
    });
  }

  public AddConditionalFormat(format: ConditionalFormat) {
    this.ExecCommand({
      key: CommandKey.AddConditionalFormat,
      format,
    });
  }

  /** remove a table. doesn't remove any data, just removes the overlay. */
  public RemoveTable(table: Table) {
    this.ExecCommand({
      key: CommandKey.RemoveTable,
      table,
    });
  }

  /**
   * create a table in the given area. the area cannot contain any 
   * merge cells, arrays, or be part of another table. if you add a table
   * with a totals row, we don't insert a new row -- allocate enough space
   * when you create it.
   * 
   * @param area - the total area for the table, including headers and totals
   * @param totals - set true to include a totals row. tables have different
   * formatting and slightly different behavior when there's a totals row.
   */
  public InsertTable(area: IArea, totals = true, sortable: boolean|undefined = undefined, theme?: TableTheme) {

    // we should validate here, so that we can throw.

    if (!area.start.sheet_id) {
      area.start.sheet_id = this.active_sheet.id;
    }

    const sheet = this.FindSheet(area);

    for (let row = area.start.row; row <= area.end.row; row++) {
      for (let column = area.start.column; column <= area.end.column; column++) {
        const cell = sheet.cells.GetCell({row, column}, false);
        if (cell && (cell.area || cell.merge_area || cell.table)) {
          // throw new Error('invalid area for table');
          this.Error(ErrorCode.invalid_area_for_table);
          return;
        }
      }
    }

    this.ExecCommand({
      key: CommandKey.InsertTable,
      area: JSON.parse(JSON.stringify(area)),
      totals,
      sortable,
      theme,
    });

  }

  /**
   * activate sheet, by name or index number
   * @param sheet number (index into the array) or string (name)
   */
  public ActivateSheet(sheet: number | string): void {

    const index = (typeof sheet === 'number') ? sheet : undefined;
    const name = (typeof sheet === 'string') ? sheet : undefined;

    this.ExecCommand({
      key: CommandKey.ActivateSheet,
      index,
      name,
    });

  }

  /**
   * activate sheet, by ID
   */
  public ActivateSheetID(id: number): void {
    this.ExecCommand({
      key: CommandKey.ActivateSheet,
      id,
    });
  }

  /**
   * duplicate sheet by index or (omitting index) the current active sheet
   */
  public DuplicateSheet(index?: number, name?: string, insert_before?: number|string): void {

    const command: DuplicateSheetCommand = {
      key: CommandKey.DuplicateSheet,
      new_name: name,
      insert_before,
    };

    if (typeof index === 'undefined') {
      command.id = this.active_sheet.id;
    }
    else {
      command.index = index;
    }

    this.ExecCommand(command);

  }

  public AddSheet(name?: string): void {
    this.ExecCommand({
      key: CommandKey.AddSheet,
      name,
      show: true,
    });
  }

  /**
   * delete sheet, by index or (omitting index) the current active sheet
   */
  public DeleteSheet(index?: number): void {

    if (typeof index === 'undefined') {
      if (!this.model.sheets.list.some((sheet, i) => {
        if (sheet === this.active_sheet) {
          index = i;
          return true;
        }
        return false;
      })) {
        throw new Error('invalid index');
      }
    }

    this.ExecCommand({
      key: CommandKey.DeleteSheet,
      index,
    });

  }

  /** insert sheet at the given index (or current index) */
  public InsertSheet(index?: number, name?: string): void {

    if (typeof index === 'undefined') {
      if (!this.model.sheets.list.some((sheet, i) => {
        if (sheet === this.active_sheet) {
          index = i + 1;
          return true;
        }
        return false;
      })) {
        throw new Error('invalid index');
      }
    }

    this.ExecCommand({
      key: CommandKey.AddSheet,
      insert_index: index,
      name,
      show: true,
    });

  }

  public DeleteSheetID(id: number): void {
    this.ExecCommand({
      key: CommandKey.DeleteSheet,
      id,
    });
  }

  /**
   * clear sheet, reset all data
   */
  public Reset(): void {
    this.ExecCommand({ key: CommandKey.Reset });
  }

  /**
   * set hyperlink, like set note
   */
  public SetLink(address: ICellAddress, reference?: string): void {

    /*
    if (!address) {
      if (this.primary_selection.empty) return;
      address = this.primary_selection.target;
    }
    */

    this.ExecCommand({
      key: CommandKey.SetLink,
      area: address,
      reference,
    });

  }

  public ShowAll(): void {

    // obviously there are better ways to do this, but this
    // will use the execcommand system and _should_ only fire
    // a single event (FIXME: check)

    const commands: ShowSheetCommand[] = [];
    for (let index = 0; index < this.model.sheets.length; index++) {
      commands.push({
        key: CommandKey.ShowSheet,
        index,
        show: true,
      });
    }
    this.ExecCommand(commands);
  }

  public ShowSheet(index: number|string = 0, show = true): void {

    const command: ShowSheetCommand = {
      key: CommandKey.ShowSheet,
      show,
    };

    if (typeof index === 'string') { command.name = index; }
    else { command.index = index; }

    this.ExecCommand(command);
    
  }

  /**
   * sort table. column is absolute.
   */
  public SortTable(table: Table, options: Partial<TableSortOptions> = {}) {

    //
    // table typically has an actual area, while we want a plain
    // object in the command queue for serialization purposes. not
    // sure how we wound up with this situation, it's problematic.
    // 

    this.ExecCommand({
      key: CommandKey.SortTable,
      table: JSON.parse(JSON.stringify(table)), 
      ...DefaultTableSortOptions,
      ...options,
    });
    
  }
  
  /** return freeze area */
  public GetFreeze(): FreezePane {
    return { ...this.active_sheet.freeze };
  }

  /**
   * insert rows(s) at some specific point
   */
  public InsertRows(before_row = 0, count = 1): void {
    this.ExecCommand({
      key: CommandKey.InsertRows,
      before_row,
      count,
    });
  }

  /**
   * return the table (if any) at the given address
   */
  public GetTableReference(address: ICellAddress): Table|undefined {
    const sheet = this.model.sheets.Find(address.sheet_id || this.active_sheet.id);
    return sheet?.CellData(address).table || undefined;
  }


  /**
   * reset sheet, set data from CSV
   *
   * FIXME: this is problematic, because it runs around the exec command
   * system. however it doesn't seem like a good candidate for a separate
   * command. it should maybe move to the import class? (...)
   *
   * one problem with that is that import is really, really heavy (jszip).
   * it seems wasteful to require all that just to import csv.
   */
  public FromCSV(text: string): void {

    // CSV assumes dot-decimal, correct? if we want to use the
    // parser we will have to check (and set/reset) the separator

    this.parser.Save();
    this.parser.SetLocaleSettings(DecimalMarkType.Period);

    /*
    const toggle_separator = this.parser.decimal_mark === DecimalMarkType.Comma;

    if (toggle_separator) 
    {
      // swap
      this.parser.argument_separator = ArgumentSeparatorType.Comma;
      this.parser.decimal_mark = DecimalMarkType.Period;
    }
    */

    const records = ParseCSV(text);
    const arr = records.map((record) =>
      record.map((field) => {
        if (field) {
          const tmp = this.parser.Parse(field);
          if (tmp.expression?.type === 'complex') {
            return tmp.expression as Complex;
          }
        }
        return ValueParser.TryParse(field).value;
      }));

    /*
    if (toggle_separator) {
      // reset
      this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
      this.parser.decimal_mark = DecimalMarkType.Comma;
    }
    */
   this.parser.Restore();
  
    const end = {
      row: Math.max(0, arr.length - 1),
      column: arr.reduce((max, row) => Math.max(max, Math.max(0, row.length - 1)), 0),
    };

    // NOTE: SetRange here does not need to be translated, because
    // we're not expecting spreadsheet functions in the CSV. CSV should
    // be data only. Famous last words.
    
    this.ExecCommand([
      { key: CommandKey.Reset },
      {
        key: CommandKey.SetRange,
        area: { start: { row: 0, column: 0 }, end },
        value: arr,
      },

      // we took this out because the data may require a layout update
      // (rebuilding tiles); in that case, this will be duplicative. maybe
      // should use setTimeout or some sort of queue...

      // { key: CommandKey.ResizeColumns }, // auto
    ]);

  }


  /**
   * insert column(s) at some specific point
   */
  public InsertColumns(before_column = 0, count = 1): void {
    this.ExecCommand({
      key: CommandKey.InsertColumns,
      before_column,
      count,
    });
  }

  /** move sheet (X) before sheet (Y) */
  public ReorderSheet(index: number, move_before: number): void {
    this.ExecCommand({
      key: CommandKey.ReorderSheet,
      index,
      move_before,
    });
  }

  /**
   * rename active sheet
   */
  public RenameSheet(sheet: Sheet, name: string): void {
    this.ExecCommand({
      key: CommandKey.RenameSheet,
      new_name: name,
      id: sheet.id,
    });
  }

  /**
   * freeze rows or columns. set to 0 (or call with no arguments) to un-freeze.
   *
   * highglight is shown by default, but we can hide it(mostly for document load)
   */
  public Freeze(rows = 0, columns = 0, highlight_transition = true): void {
    this.ExecCommand({
      key: CommandKey.Freeze,
      rows,
      columns,
      highlight_transition,
    });
  }

  /**
   * API method
   */
  public SetRowHeight(row?: number | number[], height?: number, shrink = true): void {
    this.ExecCommand({
      key: CommandKey.ResizeRows,
      row,
      height,
      shrink,
    });
  }

  /**
   * API method
   *
   * @param column column, columns, or undefined means all columns
   * @param width target width, or undefined means auto-size
   */
  public SetColumnWidth(column?: number | number[], width = 0): void {
    this.ExecCommand({
      key: CommandKey.ResizeColumns,
      column,
      width,
    });
  }

  /**
   * filter table. what this means is "show the rows that match the filter
   * and hide the other rows". it doesn't actually change data, but it does
   * show/hide rows which (now) has some data effects.
   * 
   * note that we don't pass the filter command through the command queue.
   * it uses a callback, so that would not work. rather we filter first,
   * then send hide/show row commands through the command queue. that will
   * propagate updates.
   */
  public FilterTable(table: Table, column: number, filter: (cell: Cell) => boolean) {

    const command: Command[] = [];

    if (!table.area.start.sheet_id) {
      throw new Error('invalid table area');
    }

    const sheet = this.model.sheets.Find(table.area.start.sheet_id);
    if (!sheet) {
      throw new Error('invalid table sheet');
    }

    const show_rows: number[] = [];
    const hide_rows: number[] = [];

    const end = table.totals_row ? table.area.end.row - 1 : table.area.end.row;

    column += table.area.start.column;
    for (let row = table.area.start.row + 1; row <= end; row++) {
      const cell = sheet.CellData({row, column});
      const show = filter(cell);
      const current = sheet.GetRowHeight(row);

      if (show && !current) {
        show_rows.push(row);
      }
      else if (!show && current) {
        hide_rows.push(row);
      }

    }

    if (show_rows) {
      command.push({          
        key: CommandKey.ResizeRows, 
        sheet_id: sheet.id,
        row: show_rows,
        height: sheet.default_row_height,
      });
    }
    if (hide_rows) {
      command.push({
        key: CommandKey.ResizeRows, 
        sheet_id: sheet.id,
        row: hide_rows,
        height: 0,
      });
    }

    if (command.length) {
      this.ExecCommand(command);
    }

  }

  /**
   * UpdateSheets means "set these as the sheets, drop any old stuff". there's 
   * an implicit reset (in fact we may do that twice in some cases).
   *
   * this is non-UI; specialization should handle the UI part
   */
   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   public UpdateSheets(data: LegacySerializedSheet[], render = false, activate_sheet?: number | string): void {

    Sheet.Reset(); // reset ID generation

    const sheets = data.map((sheet) => Sheet.FromJSON(sheet, this.model.theme_style_properties));

    // ensure we have a sheets[0] so we can set active

    if (sheets.length === 0) {
      sheets.push(Sheet.Blank(this.model.theme_style_properties));
    }

    // now assign sheets

    this.model.sheets.Assign(sheets);
    this.ResetMetadata(); // FIXME: shouldn't we just set metadata from the file? 

    // set active

    this.active_sheet = sheets[0];

    // possibly set an active sheet on load (shortcut)
    // could we not use a command for this?

    if (activate_sheet) {
      const sheet = this.model.sheets.Find(activate_sheet);
      if (sheet) {
        this.active_sheet = sheet;
      }
    }

    // NOTE: we're not handling annotations here. do we need to? (...)

  }


  /**
   * set functions for AC matcher. should be called by calculator on init,
   * or when any functions are added/removed.
   *
   * FIXME: we should use this to normalize function names, on insert and
   * on paste (if we're doing that).
   * 
   * FIXME: are named expressions included here? (this function predates
   * named expressions).
   * 
   * 
   * this moved to grid base because we use the list to check for conflicts
   * when setting names. 
   * 
   */
   public SetAutocompleteFunctions(functions: FunctionDescriptor[]): void {

    const expressions: FunctionDescriptor[] = [];

    for (const entry of this.model.named.list) {
      expressions.push({
        name: entry.name,
        named: true,
        type: 'token',
      });
    }

    /*
    for (const name of this.model.named_expressions.keys()) {
      expressions.push({
        name, 
        named: true,
        type: 'token',
      });
    }
    */

    const consolidated= functions.slice(0).concat(expressions);

    /*
    const consolidated = functions.slice(0).concat(
      this.model.named_ranges.List().map((named_range) => {
        return { 
          name: named_range.name, 
          named: true,
          type: 'token' 
        };
      }),
      expressions,
    );
    */

    this.autocomplete_matcher.SetFunctions(consolidated);

  }

  public ResetMetadata(): void {
    this.model.document_name = undefined;
    this.model.user_data = undefined;
  }


  // --- protected methods -----------------------------------------------------
 
  /**
   * see ResizeRowsInternal
   */
   protected ResizeColumnsInternal(command: ResizeColumnsCommand) {

    const sheet = command.sheet_id ? this.FindSheet(command.sheet_id) : this.active_sheet;

    // normalize

    let column = command.column;
    if (typeof column === 'undefined') {
      column = [];
      for (let i = 0; i < sheet.columns; i++) column.push(i);
    }
    if (typeof column === 'number') column = [column];

    if (command.width) {
      for (const entry of column) {
        sheet.SetColumnWidth(entry, command.width);
      }
    }
    else {
      console.error('auto size not supported');
    }

  }

  /**
   * resize rows. this supports auto size, but that will fail in !ui grid,
   * because it uses HTML. also non-ui doesn't really need to worry about 
   * scale... we should split.
   */
  protected ResizeRowsInternal(command: ResizeRowsCommand): IArea|undefined {

    // we're guaranteed this now, we should have a way to represent that...

    const sheet = command.sheet_id ? this.FindSheet(command.sheet_id) : this.active_sheet;

    // normalize rows -> array. undefined means all rows.

    let row = command.row;
    if (typeof row === 'undefined') {
      row = [];
      for (let i = 0; i < sheet.rows; i++) row.push(i);
    }
    if (typeof row === 'number') row = [row];

    // I guess this was intended to prevent auto-size, but what about 0? 

    if (command.height) {
      for (const entry of row) {
        sheet.SetRowHeight(entry, command.height);
      }
    }
    else {
      console.error('auto size not supported');
    }

    return undefined;

  }

  protected ResetInternal() {

    Sheet.Reset();
    this.UpdateSheets([], true);
    
    this.model.named.Reset();
    
    this.model.macro_functions.clear(); //  = {};
    this.model.tables.clear();

  }

  /**
   * check if we can paste into the target area(s). this will
   * return false if the areas contain locked cells, or part of
   * an array or merge but not the whole array or merge.
   * 
   * @param areas 
   * @returns 
   */
  protected ValidatePasteAreas(areas: Area[]): boolean {
    for (const area of areas) {

      let sheet: Sheet|undefined = this.active_sheet;
      if (area.start.sheet_id && area.start.sheet_id !== sheet.id) {
        sheet = this.model.sheets.Find(area.start.sheet_id);
      }
      if (!sheet) {
        return false;
      }

      // let valid = true;

      for (const cell of sheet.cells.Iterate(area)) {

        if (cell.style?.locked)  {
          console.info('invalid: locked cells');
          return false;
        }
        if (cell.merge_area) {
          if (!area.Contains(cell.merge_area.start) || !area.Contains(cell.merge_area.end)) {
            console.info('invalid: merge area');
            return false;
          }
        }
        if (cell.area) {
          if (!area.Contains(cell.area.start) || !area.Contains(cell.area.end)) {
            console.info('invalid: array');
            return false;
          }
        }
        
      }

      /*
      sheet.cells.Apply2(area, cell => {
        if (cell.style?.locked)  {
          console.info('invalid: locked cells');
          valid = false;
        }
        if (cell.merge_area) {
          if (!area.Contains(cell.merge_area.start) || !area.Contains(cell.merge_area.end)) {
            console.info('invalid: merge area');
            valid = false;
          }
        }
        if (cell.area) {
          if (!area.Contains(cell.area.start) || !area.Contains(cell.area.end)) {
            console.info('invalid: array');
            valid = false;
          }
        }
       
        return valid;
      });
      */

      // if (!valid) {
      //  return false;
      // }

    }
    return true;
  }

  protected SetValidationInternal(command: DataValidationCommand): void {

    const sheet = this.FindSheet(command.area);
    if (!sheet) {
      throw new Error('invalid sheet in set validation');
    }

    const target = {start: command.area.start, end: command.area.end };

    if (command.range) {

      sheet.AddValidation({
        type: 'range',
        error: !!command.error,
        area: command.range,
        target: [target],
      });

      /*
      cell.validation = {
        type: ValidationType.Range,
        area: command.range,
        error: !!command.error,
      };
      */

    }
    else if (command.list) {

      sheet.AddValidation({
        type: 'list',
        error: !!command.error,
        list: JSON.parse(JSON.stringify(command.list)),
        target: [target],
      });

      /*
      cell.validation = {
        type: ValidationType.List,
        list: JSON.parse(JSON.stringify(command.list)),
        error: !!command.error,
      }
      */

    }
    else {
      // cell.validation = undefined;

      sheet.RemoveValidations(target);

    }

  }

  /**
   * get values from a range of data
   * @param area 
   */
  protected GetValidationRange(area: IArea): CellValue[]|undefined {

    let list: CellValue[]|undefined;

    const sheet = this.FindSheet(area);

    if (sheet) {
      
      list = [];

      // clamp to actual area to avoid screwing up sheet
      // FIXME: what does that cause [problem with selections], why, and fix it

      area = sheet.RealArea(new Area(area.start, area.end), true);

      for (let row = area.start.row; row <= area.end.row; row++) {
        for (let column = area.start.column; column <= area.end.column; column++) {
          const cell = sheet.CellData({row, column});
          if (cell && cell.formatted) {
            if (typeof cell.formatted === 'string') {
              list.push(cell.formatted);
            }
            else {
              list.push(NumberFormat.FormatPartsAsText(cell.formatted));
            }
          }
        }
      }
    }

    return list;

  }



  /**
   * @returns true if we need a recalc, because references have broken.
   */
   protected DeleteSheetInternal(command: DeleteSheetCommand): boolean {

    let is_active = false;
    let index = -1;
    let target_name = '';

    let requires_recalc = false;

    // remove from array. check if this is the active sheet

    const named_sheet = command.name ? command.name.toLowerCase() : '';
    const sheets = this.model.sheets.list.filter((sheet, i) => {
      if (i === command.index || sheet.id === command.id || sheet.name.toLowerCase() === named_sheet) {
        is_active = (sheet === this.active_sheet);

        this.model.named.RemoveRangesForSheet(sheet.id);
        target_name = sheet.name;

        index = i;
        return false;
      }
      return true;
    });

    // NOTE: we might want to remove references to this sheet. see
    // how we patch references in insert columns/rows functions.

    // actually note the logic we need is already in the rename sheet
    // function; we just need to split it out from actually renaming the
    // sheet, then we can use it

    if (target_name) {
      const count = this.RenameSheetReferences(sheets, target_name, '#REF');
      if (count > 0) {
        requires_recalc = true;
      }
    }
    
    // empty? create new, activate
    // UPDATE: we also need to create if all remaining sheets are hidden

    if (!sheets.length) {
      sheets.push(Sheet.Blank(this.model.theme_style_properties));
      index = 0;
    }
    else if (sheets.every(test => !test.visible)) {

      // why insert at 0 here? shouldn't it still be last, 
      // even if all the others are empty?

      sheets.unshift(Sheet.Blank(this.model.theme_style_properties));
      index = 0;
    }
    else {
      if (index >= sheets.length) {
        index = 0;
      }
      while (!sheets[index].visible) {
        index++;
      }
    }

    // this.model.sheets = sheets;
    this.model.sheets.Assign(sheets);

    // need to activate a new sheet? use the next one (now in the slot
    // we just removed). this will roll over properly if we're at the end.

    // UPDATE: we need to make sure that the target is not hidden, or we 
    // can't activate it

    if (is_active) {
      // console.info('activate @', index);
      this.ActivateSheetInternal({ key: CommandKey.ActivateSheet, index });
    }

    return requires_recalc;

  }


  /**
   * rename a sheet. this requires changing any formulae that refer to the
   * old name to refer to the new name. if there are any references by ID
   * those don't have to change.
   *
   * FIXME: can we do this using the dependency graph? (...)
   */
   protected RenameSheetInternal(target: Sheet, name: string) {

    // validate name... ?

    if (!name || IllegalSheetNameRegex.test(name)) {
      throw new Error('invalid sheet name');
    }

    // also can't have two sheets with the same name

    const compare = name.toLowerCase();
    for (const sheet of this.model.sheets.list) {
      if (sheet !== target && sheet.name.toLowerCase() === compare) {
        throw new Error('sheet name already exists');
      }
    }

    // function will LC the name
    // const old_name = target.name.toLowerCase();
    const old_name = target.name;
    target.name = name;

    // need to update indexes
    this.model.sheets.Assign(this.model.sheets.list);

    this.RenameSheetReferences(this.model.sheets.list, old_name, name);

  }

  /**
   *
   */
  protected SortTableInternal(command: SortTableCommand): Area|undefined {

    if (!command.table.area.start.sheet_id) {
      throw new Error('table has invalid area');
    }

    const sheet = this.model.sheets.Find(command.table.area.start.sheet_id);

    if (!sheet) {
      throw new Error('invalid sheet in table area');
    }

    // I guess we're sorting on calculated value? seems weird.

    // NOTE: only sort hidden rows... what to do with !hidden rows? do they
    // get sorted anyway? [A: no, leave them as-is]

    const ranked: Array<{
        row: number; 
        text: string; 
        number: number; 
        type: ValueType;
        data: ClipboardCellData[];
      }> = [];

    // get a list of visible table rows. that will be our insert map at the end

    const visible: number[] = [];

    let end = command.table.area.end.row;
    if (command.table.totals_row) {
      end--;
    }

    // for auto-sort

    let text_count = 0;
    let number_count = 0;

    for (let row = command.table.area.start.row + 1; row <= end; row++) {

      const height = sheet.GetRowHeight(row);

      if (height) {
        visible.push(row);
      }
      else {
        continue;
      }

      const row_data = {
        row, 
        number: 0,
        text: '',
        type: ValueType.undefined,
        data: [] as ClipboardCellData[],
      };

      for (let column = command.table.area.start.column; column <= command.table.area.end.column; column++) {

        const cd = sheet.CellData({row, column});

        // sort column is relative to table

        if (column === command.column + command.table.area.start.column) {

          const check_type = cd.calculated_type || cd.type;
          if (check_type === ValueType.string) {
            text_count++;
          }
          else if (check_type === ValueType.number) {
            number_count++;
          }

          // we can precalculate the type for sorting

          const value = cd.calculated_type ? cd.calculated : cd.value;
          row_data.text = value?.toString() || '';
          row_data.number = Number(value) || 0;
          row_data.type = cd.calculated_type || cd.type;

        }

        row_data.data.push({
          address: {row, column},
          data: cd.value,
          type: cd.type,
          style: cd.style,
        });

      }

      ranked.push(row_data);

    }

    // auto sort - default to text, unless we see more numbers

    let sort_type = command.type;
    if (sort_type === 'auto') {
      if (number_count > text_count) {
        sort_type = 'numeric';
      }
      else {
        sort_type = 'text';
      }
    }

    // console.info(visible, ranked);

    // rank

    const invert = command.asc ? 1 : -1;

    switch (sort_type) {
      case 'numeric':
        ranked.sort((a, b) => {
          if (a.type === ValueType.undefined) {
            return ((b.type === ValueType.undefined) ? 0 : 1);
          }
          if (b.type === ValueType.undefined) {
            return -1;
          }
          return (a.number - b.number) * invert;
        });
        break;

      case 'text':
      default:
        ranked.sort((a, b) => {
          if (a.type === ValueType.undefined) {
            return ((b.type === ValueType.undefined) ? 0 : 1);
          }
          if (b.type === ValueType.undefined) {
            return -1;
          }

          return a.text.localeCompare(b.text) * invert;
        });
        break;
    }

    // now apply the sort

    const insert = {row: command.table.area.start.row + 1, column: command.table.area.start.column };

    for (let i = 0; i < visible.length; i++) {

      insert.row = visible[i];
      const entry = ranked[i];

      insert.column = command.table.area.start.column; // reset
      for (const cell of entry.data) {
        if (cell.type === ValueType.formula) {

          let data = cell.data as string;
          const offsets = { columns: 0, rows: insert.row - entry.row };
          const parse_result = this.parser.Parse(data);
          if (parse_result.expression) {
            data = '=' + this.parser.Render(parse_result.expression, { offset: offsets, missing: ''});
          }

          sheet.SetCellValue(insert, data);
        }
        else {
          sheet.SetCellValue(insert, cell.data);
        }
        sheet.UpdateCellStyle(insert, cell.style || {}, false);
        insert.column++; // step
      }

    }

    // keep reference. we don't have the actual table, we have a copy.
    // this is done because the command queue might be broadcast, so
    // references won't work.

    const ref = this.model.tables.get(command.table.name.toLowerCase());
    if (ref) {
      ref.sort = {
        type: command.type,
        asc: !!command.asc,
        column: command.column,
      };
    }

    // flush style in rows that don't change, to force repainting. this
    // has to do with how table styles are overlaid on other styles; it's
    // not optimal at the moment.
    {

      let row = command.table.area.start.row;
      for (let column = command.table.area.start.column; column <= command.table.area.end.column; column++) {
        sheet.cells.data[row][column]?.FlushStyle();
      }
      if (command.table.totals_row) {
        row = command.table.area.end.row;
        for (let column = command.table.area.start.column; column <= command.table.area.end.column; column++) {
          sheet.cells.data[row][column]?.FlushStyle();
        }
      }
      
    }

    // console.info(ordered);

    return new Area(command.table.area.start, command.table.area.end);

  }

  /**
   * update all columns of a table (collect column names). this
   * method rebuilds all columns; that's probably unecessary in
   * many cases, but we'll start here and we can drill down later.
   * 
   * we do two things here: we normalize column header values, and
   * we collect them for table headers.
   * 
   * @param table 
   */
  protected UpdateTableColumns(table: Table): IArea {

    if (!table.area.start.sheet_id) {
      throw new Error('invalid area in table');
    }

    const sheet = this.model.sheets.Find(table.area.start.sheet_id);
    if (!sheet) {
      throw new Error('invalid sheet in table');
    }

    // this can get called when a document is loaded, we might
    // not have column names when we start. but if we do, we will
    // need to keep the old ones so we can check deltas.

    const current_columns = table.columns?.slice(0) || undefined;

    const columns: string[] = [];

    const row = table.area.start.row;
    const count = table.area.end.column - table.area.start.column + 1;

    let column = table.area.start.column;
    for (let i = 0; i < count; i++, column++) {

      const header = sheet.CellData({row, column});
      let value = '';

      if (header.type !== ValueType.string) {
        
        if (typeof header.formatted !== 'undefined') {
          value = (header.formatted).toString();
        }
        else if (typeof header.calculated !== 'undefined') {
          value = (header.calculated).toString();
        }
        else if (typeof header.value !== 'undefined') {
          value = (header.value).toString();
        }

        header.Set(value, ValueType.string);

      }
      else {
        value = (header.value as string) || '';
      }
     
      if (!value) {
        value = `Column${i + 1}`;
      }

      let proposed = value;
      let success = false;
      let index = 1;

      while (!success) {
        success = true;
        inner_loop:
        for (const check of columns) {
          if (check.toLowerCase() === proposed.toLowerCase()) {
            success = false;
            proposed = `${value}${++index}`;
            break inner_loop;
          }
        }
      }

      header.Set(proposed, ValueType.string);
      columns.push(proposed.toLowerCase());

    }

    // TODO: this is good, and works, but we are going to have to
    // look for structured references and update them if the column
    // names change. 

    if (current_columns) {

      // if we are inserting/removing columns, we're probably 
      // not changing names at the same time. on remove, some
      // references will break, but that's to be expected. on
      // insert, new columns will get added but we don't have
      // to change references.

      if (current_columns.length === columns.length) {

        const update: Map<string, string> = new Map();
        for (let i = 0; i < current_columns.length; i++) {
          const compare = current_columns[i].toLowerCase();
          if (compare !== columns[i]) {
            update.set(compare, columns[i]); // add old -> new
          }
        }

        if (update.size) {

          // OK, we need to update. we're iterating cells, then
          // updates, so we don't accidentally oscillate if we have
          // columns that swap names. going through once should 
          // ensure that doesn't happen.

          const table_name = table.name.toLowerCase();

          for (const sheet of this.model.sheets.list) {

            // there's an additional complication: we support anonymous
            // tables, if the cell is in the table. so we also have to
            // know the address. so we can't use the IterateAll method.

            // duh, no we don't. if the cell is in the table it will have
            // a reference.

            for (const cell of sheet.cells.Iterate()) {

              if (cell.ValueIsFormula()) {
                let updated_formula = false;
                const parse_result = this.parser.Parse(cell.value);
                if (parse_result.expression) {

                  this.parser.Walk(parse_result.expression, (unit) => {
                    if (unit.type === 'structured-reference') {

                      if (unit.table.toLowerCase() === table_name || 
                          (!unit.table && cell.table === table)) {
                        
                        // we may need to rewrite...
                        for (const [key, value] of update.entries()) {
                          if (unit.column.toLowerCase() === key) {

                            // ok we need to update
                            unit.column = value;
                            updated_formula = true;

                          }
                        }

                      }
                    }
                    return true;
                  });
                  if (updated_formula) {
                    console.info('updating value');
                    cell.value = '=' + this.parser.Render(parse_result.expression, {
                      missing: '',
                    });
                  }
                }
              }

            }

            /*
            sheet.cells.IterateAll(cell => {
              if (cell.ValueIsFormula()) {
                let updated_formula = false;
                const parse_result = this.parser.Parse(cell.value);
                if (parse_result.expression) {

                  this.parser.Walk(parse_result.expression, (unit) => {
                    if (unit.type === 'structured-reference') {

                      if (unit.table.toLowerCase() === table_name || 
                          (!unit.table && cell.table === table)) {
                        
                        // we may need to rewrite...
                        for (const [key, value] of update.entries()) {
                          if (unit.column.toLowerCase() === key) {

                            // ok we need to update
                            unit.column = value;
                            updated_formula = true;

                          }
                        }

                      }
                    }
                    return true;
                  });
                  if (updated_formula) {
                    console.info('updating value');
                    cell.value = '=' + this.parser.Render(parse_result.expression, {
                      missing: '',
                    });
                  }
                }
              }
            });
            */

          }
        }


      }

    }

    table.columns = columns;

    return {
      start: { 
        ...table.area.start,
      }, end: {
        row: table.area.start.row, 
        column: table.area.end.column,
      }
    };

  }

  /**
   * set range, via command. returns affected area.
   * 
   * Adding a flags parameter (in/out) to support indicating 
   * that we need to update layout.
   */
  protected SetRangeInternal(command: SetRangeCommand, flags: UpdateFlags = {}): Area|undefined {

    // NOTE: apparently if we call SetRange with a single target
    // and the array flag set, it gets translated to an area. which
    // is OK, I guess, but there may be an unecessary branch in here.

    const area = IsCellAddress(command.area)
      ? new Area(command.area)
      : new Area(command.area.start, command.area.end);

    const sheet = this.FindSheet(area);

    if (!area.start.sheet_id) { 
      area.start.sheet_id = sheet.id;
    }

    if (!area.entire_row && !area.entire_column && (
      area.end.row >= sheet.rows
      || area.end.column >= sheet.columns)) {

      // we have to call this because the 'set area' method calls RealArea
      sheet.cells.EnsureCell(area.end);

      // should we send a structure event here? we may be increasing the
      // size, in which case we should send the event. even though no addresses
      // change, there are new cells.

      if (sheet === this.active_sheet) {
        flags.layout = true;
      }
      
    }

    // originally we called sheet methods here, but all the sheet
    // does is call methods on the cells object -- we can shortcut.

    // is that a good idea? (...)

    // at a minimum we can consolidate...

    if (IsCellAddress(command.area)) {

      // FIXME: should throw if we try to set part of an array

      const cell = sheet.CellData(command.area);
      if (cell.area && (cell.area.rows > 1 || cell.area.columns > 1)) {
        this.Error(ErrorCode.array);
        return;
      }

      // single cell
      // UPDATE: could be array

      // type is value|value[][], pull out first value. at some point 
      // we may have supported value[], or maybe they were passed in 
      // accidentally, but check regardless.

      // FIXME: no, that should throw (or otherwise error) (or fix the data?). 
      // we can't handle errors all the way down the call stack.

      let value = Array.isArray(command.value) ?
        Array.isArray(command.value[0]) ? command.value[0][0] : command.value[0] : command.value;

      // translate R1C1. in this case, we translate relative to the 
      // target address, irrspective of the array flag. this is the
      // easiest case?

      // NOTE: as noted above (top of function), if a single cell target
      // is set with the array flag, it may fall into the next branch. not 
      // sure that makes much of a difference.

      if (command.r1c1) {
        value = this.TranslateR1C1(command.area, value);
      }
     
      if (command.array) {

        // what is the case for this? not saying it doesn't happen, just
        // when is it useful?

        // A: there is the case in Excel where there are different semantics
        // for array calculation; something we mentioned in one of the kb
        // articles, something about array functions... [FIXME: ref?]

        sheet.SetArrayValue(area, value);
      }
      else {
        sheet.SetCellValue(command.area, value);
      }

      return area;
    }
    else {

      // there are a couple of options here, from the methods that
      // have accumulated in Sheet.

      // SetArrayValue -- set data as an array
      // SetAreaValues -- set values from data one-to-one
      // SetAreaValue -- single value repeated in range

      // FIXME: clean this up!

      if (command.array) {

        let value = Array.isArray(command.value) ?
          Array.isArray(command.value[0]) ? command.value[0][0] : command.value[0] : command.value;
        
        if (command.r1c1) {
          value = this.TranslateR1C1(area.start, value);
        }

        sheet.SetArrayValue(area, value);
      }
      else {

        // in this case, either value is a single value or it's a 2D array;
        // and area is a range of unknown size. we do a 1-1 map from area
        // member to data member. if the data is not the same shape, it just
        // results in empty cells (if area is larger) or dropped data (if value
        // is larger).

        // so for the purposes of R1C1, we have to run the same loop that 
        // happens internally in the Cells.SetArea routine. but I definitely
        // don't want R1C1 to get all the way in there. 

        // FIXME/TODO: we're doing this the naive way for now. it could be 
        // optimized in several ways.

        if (command.r1c1) {
          if (Array.isArray(command.value)) {

            // loop on DATA, since that's what we care about here. we can 
            // expand data, since it won't spill in the next call (spill is
            // handled earlier in the call stack).

            for (let r = 0; r < command.value.length && r < area.rows; r++) {
              if (!command.value[r]) {
                command.value[r] = [];
              }
              const row = command.value[r];
              for (let c = 0; c < row.length && c < area.columns; c++) {
                const target: ICellAddress = { ...area.start, row: area.start.row + r, column: area.start.column + c };
                row[c] = this.TranslateR1C1(target, row[c]);
              }
            }

          }
          else {

            // only have to do this for strings
            if (typeof command.value === 'string' && command.value[0] === '=') {

              // we need to rebuild the value so it is an array, so that 
              // relative addresses will be relative to the cell.

              const value: CellValue[][] = [];

              for (let r = 0; r < area.rows; r++) {
                const row: CellValue[] = [];
                for (let c = 0; c < area.columns; c++) {
                  const target: ICellAddress = { ...area.start, row: area.start.row + r, column: area.start.column + c };
                  row.push(this.TranslateR1C1(target, command.value));
                }
                value.push(row);
              }

              command.value = value;

            }
          }
        }

        sheet.SetAreaValues2(area, command.value);
      }

      return area;

    }

  }

  /**
   * basic implementation does not handle any UI, painting, or layout.
   */
   protected ActivateSheetInternal(command: ActivateSheetCommand) {

    const candidate = this.ResolveSheet(command) || this.model.sheets.list[0];

    if (this.active_sheet === candidate && !command.force) {
      return;
    }

    if (!candidate.visible) {
      throw new Error('cannot activate hidden sheet');
    }

    // hold this for the event (later)

    const deactivate = this.active_sheet;

    // select target

    this.active_sheet = candidate;

    /*
    // scrub, then add any sheet annotations. note the caller will
    // still have to inflate these or do whatever step is necessary to
    // render.

    const annotations = this.active_sheet.annotations;
    for (const element of annotations) {
      this.AddAnnotation(element, true);
    }
    */

    this.grid_events.Publish({
      type: 'sheet-change',
      deactivate,
      activate: this.active_sheet,
    });

  }

  protected ShowSheetInternal(command: ShowSheetCommand) {

    const sheet = this.ResolveSheet(command);

    // invalid
    if (!sheet) { return; }

    // not changed
    if (sheet.visible === command.show) { return; }

    // make sure at least one will be visible after the operation
    if (!command.show) {

      let count = 0;
      for (const test of this.model.sheets.list) {
        if (!sheet.visible || test === sheet) { count++; }
      }
      if (count >= this.model.sheets.length) {
        throw new Error('can\'t hide all sheets');
      }

    }

    // ok, set
    sheet.visible = command.show;

    // is this current?
    if (sheet === this.active_sheet) {

      // this needs to check the visibility field, or else we'll throw
      // when we call the activate method. given the above check we know
      // that there's at least one visible sheet.

      const list = this.model.sheets.list;

      // first find the _next_ visible sheet...

      for (let i = 0; i < list.length; i++) {
        if (list[i] === this.active_sheet) {
          for (let j = i + 1; j < list.length; j++) {
            if (list[j].visible) {
              this.ActivateSheetInternal({
                key: CommandKey.ActivateSheet,
                index: j,
              });
              return;
            }
          }

          // if we got here, then we need to start again from the beginning

          for (let j = 0; j< list.length; j++) {
            if (list[j].visible) {
              this.ActivateSheetInternal({
                key: CommandKey.ActivateSheet,
                index: j,
              });
              return;
            }
          }

          // should not be possible
          throw new Error('no visible sheet');

        }
      }
    }

  }

  /**
   * normalize commands. for co-editing support we need to ensure that
   * commands properly have sheet IDs in areas/addresses (and explicit 
   * fields in some cases).
   * 
   * at the same time we're editing the commands a little bit to make 
   * them a little more consistent (within reason).
   * 
   * @param commands 
   */
  protected NormalizeCommands(commands: Command|Command[]): Command[] {

    if (!Array.isArray(commands)) {
      commands = [commands];
    }

    const id = this.active_sheet.id;
    
    for (const command of commands) {
      switch (command.key) {
        
        // nothing
        case CommandKey.Null:
        case CommandKey.ShowHeaders:
        case CommandKey.ShowSheet:
        case CommandKey.AddSheet:
        case CommandKey.DuplicateSheet:
        case CommandKey.DeleteSheet:
        case CommandKey.ActivateSheet:
        case CommandKey.RenameSheet:
        case CommandKey.ReorderSheet:
        case CommandKey.Reset:
          break;

        /*
        // both
        case CommandKey.Clear:
          if (command.area) {
            if (!command.area.start.sheet_id) {
              command.area.start.sheet_id = id;
            }
          }
          else {
            if (!command.sheet_id) {
              command.sheet_id = id;
            }
          }
          break;
        */

        // special cases
        case CommandKey.SortTable:
        case CommandKey.RemoveTable:
          if (!command.table.area.start.sheet_id) {
            command.table.area.start.sheet_id = id;
          }
          break;

        case CommandKey.AddConditionalFormat:
          if (!command.format.area.start.sheet_id) {
            command.format.area.start.sheet_id = id;
          }
          break;

        // field
        case CommandKey.ResizeRows:
        case CommandKey.ResizeColumns:
        case CommandKey.InsertColumns:
        case CommandKey.InsertRows:
        case CommandKey.Freeze:
          if (!command.sheet_id) {
            command.sheet_id = id;
          }          
          break;

        // area: Area|Address (may be optional)
        case CommandKey.Clear:
        case CommandKey.SetNote:
        case CommandKey.SetLink:
        case CommandKey.Indent:
        case CommandKey.UpdateBorders:
        case CommandKey.MergeCells:
        case CommandKey.UnmergeCells:
        case CommandKey.DataValidation:
        case CommandKey.SetRange:
        case CommandKey.UpdateStyle:
        case CommandKey.SetName:
        case CommandKey.Select:
        case CommandKey.InsertTable:

        // note that remove conditional format could have a format
        // object (with an area) instead of an area. but in that case,
        // the format object must match an existing format, so it would
        // have to have a proper area. there's no case where we would
        // want to add it. so we only handle the area case.

        // eslint-disable-next-line no-fallthrough
        case CommandKey.RemoveConditionalFormat:

          if (command.area) {
            if (IsCellAddress(command.area)) {
              if (!command.area.sheet_id) {
                command.area.sheet_id = id;
              }
            }
            else {
              if (!command.area.start.sheet_id) {
                command.area.start.sheet_id = id;
              }
            }
          }
          break;

        default:

          // this is intended to check that we've handled all cases. if you
          // add additional commands and they're not handled, this should 
          // raise a ts error.

          AssertNever(command);

      }
    }

    return commands;

  }

  /**
   * add sheet. data only.
   */
  protected AddSheetInternal(name = Sheet.default_sheet_name, insert_index = -1): number|undefined {

    if (!this.options.add_tab) {
      console.warn('add tab option not set or false');
      return;
    }

    // validate name...

    while (this.model.sheets.list.some((test) => test.name === name)) {

      const match = name.match(/^(.*?)(\d+)$/);
      if (match) {
        name = match[1] + (Number(match[2]) + 1);
      }
      else {
        name = name + '2';
      }

    }

    // FIXME: structure event

    const sheet = Sheet.Blank(this.model.theme_style_properties, name);

    if (insert_index >= 0) {
      this.model.sheets.Splice(insert_index, 0, sheet);
    }
    else {
      this.model.sheets.Add(sheet);
    }

    // moved to ExecCmomand
    // if (this.tab_bar) { this.tab_bar.Update(); }

    return sheet.id;

  }

  /**
   * resolve sheet in a command that uses the SheetSelection interface;
   * that allows sheet selection by name, id or index.
   */
  protected ResolveSheet(command: SheetSelection): Sheet|undefined {

    // NOTE: since you are using typeof here to check for undefined,
    // it seems like it would be efficient to use typeof to check
    // the actual type; hence merging "index" and "name" might be
    // more efficient than checking each one separately.

    if (typeof command.index !== 'undefined') {
      return this.model.sheets.list[command.index];
    }
    if (typeof command.name !== 'undefined') {
      return this.model.sheets.Find(command.name);
    }
    if (command.id) {
      return this.model.sheets.Find(command.id);
    }
    return undefined;
  }

  /**
   * find sheet matching sheet_id in area.start, or active sheet
   * 
   * FIXME: should return undefined on !match
   * FIXME: should be in model, which should be a class
   */
  protected FindSheet(identifier: number|IArea|ICellAddress|undefined): Sheet {

    if (identifier === undefined) {
      return this.active_sheet;
    }

    const id = typeof identifier === 'number' ? identifier : IsCellAddress(identifier) ? identifier.sheet_id : identifier.start.sheet_id;

    if (!id || id === this.active_sheet.id) {
      return this.active_sheet;
    }

    const sheet = this.model.sheets.Find(id);
    if (sheet) { 
      return sheet;
    }

    /*
    for (const test of this.model.sheets) {
      if (test.id === id) {
        return test;
      }
    }
    */

    // FIXME: should return undefined here
    return this.active_sheet;

  }


  /** 
   * this function now works for both rows and columns, and can handle
   * sheets other than the active sheet. it does assume that you only ever
   * add rows/columns on the active sheet, but since that's all parameterized
   * you could get it to work either way.
   * 
   * in fact we should change the names of those parameters so it's a little
   * more generic.
   */
  protected PatchFormulasInternal(source: string,
      before_row: number,
      row_count: number,
      before_column: number,
      column_count: number,
      target_sheet_name: string,
      is_target: boolean) {

    const parsed = this.parser.Parse(source || '');
    let modified = false;

    // the sheet test is different for active sheet/non-active sheet.

    // on the active sheet, check for no name OR name === active sheet name.
    // on other sheets, check for name AND name === active sheet name.

    if (parsed.expression) {
      this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {

        if (element.type === 'range' || element.type === 'address') {

          // we can test if we need to modify a range or an address, but the 
          // second address in a range can't be tested properly. so the solution
          // here is to just capture the addresses that need to be modified
          // from the range, and then not recurse (we should never get here
          // as an address in a range).

          const addresses: UnitAddress[] = [];

          if (element.type === 'range') {

            // there's a problem: this breaks because the inner test fails when
            // this is TRUE... we may need to modify

            // recurse if (1) explicit name match; or (2) no name AND we are on the active sheet

            // return ((element.start.sheet && element.start.sheet.toLowerCase() === active_sheet_name) || (!element.start.sheet && active_sheet));


            if ((element.start.sheet && element.start.sheet.toLowerCase() === target_sheet_name) || (!element.start.sheet && is_target)) {
              addresses.push(element.start, element.end);
            }

          }
          else if (element.type === 'address') {
            if ((element.sheet && element.sheet.toLowerCase() === target_sheet_name) || (!element.sheet && is_target)) {
              addresses.push(element);
            }

          }

          // could switch the tests around? (referring to the count
          // tests, which switch on operation)

          for (const address of addresses) {

            if (row_count && address.row >= before_row) {
              if (row_count < 0 && address.row + row_count < before_row) {
                address.column = address.row = -1;
              }
              else {
                address.row += row_count;
              }
              modified = true;
            }
            if (column_count && address.column >= before_column) {
              if (column_count < 0 && address.column + column_count < before_column) {
                address.column = address.row = -1; // set as invalid (-1)
              }
              else {
                address.column += column_count;
              }
              modified = true;
            }

          }

          return false; // always explicit

        }

        return true; // recurse for everything else

      });

      if (modified) {
        return '=' + this.parser.Render(parsed.expression, { missing: '' });
      }
    }

    return undefined;

  }

  protected PatchExpressionSheetName(expression: string, old_name: string, name: string): string|undefined {

    let modified = false;
    const parsed = this.parser.Parse(expression || '');
    if (parsed.expression) {
      this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
        if (element.type === 'address') {
          if (element.sheet && element.sheet.toLowerCase() === old_name) {
            element.sheet = name;
            modified = true;
          }
        }
        return true; // continue walk
      });
      if (modified) {
        return '=' + this.parser.Render(parsed.expression, { missing: '' });
      }
    }

    return undefined;

  }

  /**
   * splitting this logic into a new function so we can reuse it 
   * for invalidating broken references. generally we'll call this
   * on all sheets, but I wanted to leave the option open.
   * 
   * @returns count of changes made. it's useful for the delete routine, 
   * so we can force a recalc.
   */
   protected RenameSheetReferences(sheets: Sheet[], old_name: string, name: string): number {

    let changes = 0;

    old_name = old_name.toLowerCase();

    for (const sheet of sheets) {

      // cells
      for (const cell of sheet.cells.Iterate()) {
        if (cell.ValueIsFormula()) {
          const updated = this.PatchExpressionSheetName(cell.value||'', old_name, name);
          if (updated) {
            cell.value = updated;
            changes++;
          }          
        }
      }

      /*
      sheet.cells.IterateAll((cell: Cell) => {
        if (cell.ValueIsFormula()) {
          const updated = this.PatchExpressionSheetName(cell.value||'', old_name, name);
          if (updated) {
            cell.value = updated;
            changes++;
          }          
        }
      });
      */

      // conditionals
      if (sheet.conditional_formats?.length) {
        for (const format of sheet.conditional_formats) {
          switch (format.type) {
            case 'cell-match':
            case 'expression':
              {
                const updated = this.PatchExpressionSheetName(format.expression, old_name, name);
                if (updated) {
                  format.expression = updated;
                  changes++;
                }
              }
              break;
          }
        }
      }

      // annotations
      for (const annotation of sheet.annotations) {
        if (annotation.data.formula) {
          const updated = this.PatchExpressionSheetName(annotation.data.formula, old_name, name);
          if (updated) {
            annotation.data.formula = updated;
            changes++;
          }
        }
      }
    }

    for (const element of this.model.connected_elements.values()) {
      if (element.formula) {
        const updated = this.PatchExpressionSheetName(element.formula, old_name, name);
        if (updated) {
          element.formula = updated;
          changes++;
        }
      }
    }

    return changes;

  }


  /**
   * these are all addative except for "none", which removes all borders.
   *
   * we no longer put borders into two cells at once (hurrah!). however
   * we still need to do some maintenance on the mirror cells -- because
   * if you apply a border to cell A1, then that should take precedence
   * over any border previously applied to cell A2.
   *
   * FIXME: is that right? perhaps we should just leave whatever the user
   * did -- with the exception of clearing, which should always mirror.
   *
   *
   * UPDATE: modifying function for use with ExecCommand. runs the style
   * updates and returns the affected area.
   *
   */
   protected ApplyBordersInternal(command: UpdateBordersCommand) {

    const borders = command.borders;
    const width = (command.borders === BorderConstants.None)
      ? 0 : command.width;

    const area = new Area(command.area.start, command.area.end);
    const sheet = this.FindSheet(area);

    area.start.sheet_id = sheet.id; // ensure

    /*
    let sheet = this.active_sheet;
    if (command.area.start.sheet_id && command.area.start.sheet_id !== this.active_sheet.id) {
      for (const compare of this.model.sheets) {
        if (compare.id === command.area.start.sheet_id) {
          sheet = compare;
          break;
        }
      }
    }
    */

    const top: CellStyle = { border_top: width };
    const bottom: CellStyle = { border_bottom: width };
    const left: CellStyle = { border_left: width };
    const right: CellStyle = { border_right: width };

    const clear_top: CellStyle = { border_top: 0, border_top_fill: {} };
    const clear_bottom: CellStyle = { border_bottom: 0, border_bottom_fill: {} };
    const clear_left: CellStyle = { border_left: 0, border_left_fill: {} };
    const clear_right: CellStyle = { border_right: 0, border_right_fill: {} };

    // default to "none", which means "default"

    //if (!command.color) {
    //  command.color = 'none';
    //}

    //if (typeof command.color !== 'undefined') {
    if (command.color) {

      // this is now an object so we need to clone it (might be faster to JSON->JSON)

      top.border_top_fill = {...command.color};
      bottom.border_bottom_fill = {...command.color};
      left.border_left_fill = {...command.color};
      right.border_right_fill = {...command.color};

    }
    else {

      // otherwise we should be sure to clear any color

      top.border_top_fill = {};
      bottom.border_bottom_fill = {};
      left.border_left_fill = {};
      right.border_right_fill = {};

    }
    
    // inside all/none
    if (borders === BorderConstants.None || borders === BorderConstants.All) {
      sheet.UpdateAreaStyle(area, {
        ...top, ...bottom, ...left, ...right,
      }, true);
    }

    // top
    if (borders === BorderConstants.Top || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        sheet.UpdateAreaStyle(area.top, { ...top }, true);
      }
    }

    // mirror top (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Top) {
      if (!area.entire_column) {
        if (area.start.row) {
          sheet.UpdateAreaStyle(new Area(
            { row: area.start.row - 1, column: area.start.column },
            { row: area.start.row - 1, column: area.end.column }), { ...clear_bottom }, true);
        }
      }
    }

    // bottom
    if (borders === BorderConstants.Bottom || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        sheet.UpdateAreaStyle(area.bottom, { ...bottom }, true);
      }
    }

    // mirror bottom (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Bottom) {
      if (!area.entire_column) {
        sheet.UpdateAreaStyle(new Area(
          { row: area.end.row + 1, column: area.start.column },
          { row: area.end.row + 1, column: area.end.column }), { ...clear_top }, true);
      }
    }

    // left
    if (borders === BorderConstants.Left || borders === BorderConstants.Outside) {
      if (!area.entire_row) {
        sheet.UpdateAreaStyle(area.left, { ...left }, true);
      }
    }

    // mirror left (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Left) {
      if (!area.entire_row) {
        if (area.start.column) {
          sheet.UpdateAreaStyle(new Area(
            { row: area.start.row, column: area.start.column - 1 },
            { row: area.end.row, column: area.start.column - 1 }), { ...clear_right }, true);
        }
      }
    }

    // right
    if (borders === BorderConstants.Right || borders === BorderConstants.Outside) {
      if (!area.entire_row) {
        sheet.UpdateAreaStyle(area.right, { ...right }, true);
      }
    }

    // mirror right (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Right) {
      if (!area.entire_row) {
        sheet.UpdateAreaStyle(new Area(
          { row: area.start.row, column: area.end.column + 1 },
          { row: area.end.row, column: area.end.column + 1 }), { ...clear_left }, true);
      }
    }

    /*
    // why is there not an expand method on area? (FIXME)

    this.DelayedRender(false, new Area({
      row: Math.max(0, area.start.row - 1),
      column: Math.max(0, area.start.column - 1),
    }, {
      row: area.end.row + 1,
      column: area.end.column + 1,
    }));

    // NOTE: we don't have to route through the sheet. we are the only client
    // (we republish). we can just publish directly.

    this.grid_events.Publish({ type: 'style', area });
    */

    return Area.Bleed(area);

    /*
    return new Area(
      {
        row: Math.max(0, area.start.row - 1),
        column: Math.max(0, area.start.column - 1),
      }, {
      row: area.end.row + 1,
      column: area.end.column + 1,
    },
    );
    */

  }

  protected TranslateR1C1(address: ICellAddress, value: CellValue): CellValue {

    let transformed = false;

    const cached = this.parser.flags.r1c1;
    this.parser.flags.r1c1 = true; // set
     
    if (typeof value === 'string' && value[0] === '=') {
      const result = this.parser.Parse(value);
      if (result.expression) {
        this.parser.Walk(result.expression, unit => {
          if (unit.type === 'address' && unit.r1c1) {
            transformed = true;

            // translate...
            if (unit.offset_column) {
              unit.column = unit.column + address.column;
            }
            if (unit.offset_row) {
              unit.row = unit.row + address.row;
            }

          }
          return true;
        });
        if (transformed) {

          /*
          if (!this.flags.warned_r1c1) {

            // 1-time warning

            this.flags.warned_r1c1 = true;
            console.warn('NOTE: R1C1 support is experimental. the semantics may change in the future.');
          }
          */

          value = '=' + this.parser.Render(result.expression, { missing: '' });
        }
      }
    }

    this.parser.flags.r1c1 = cached; // reset
    return value;

  }

  protected ClearAreaInternal(area: Area) {

    // updated to use sheet ID. not sure why this was still using
    // active sheet without checking ID.

    let sheet: Sheet|undefined;

    if (area.start.sheet_id) {
      sheet = this.model.sheets.Find(area.start.sheet_id);
    }
    else {
      sheet = this.active_sheet;
    }

    if (!sheet) {
      console.warn(`can't resolve sheet in ClearAreaInternal`);
      return;
    }

    // let error = false;
    area = sheet.RealArea(area); // collapse

    for (const cell of sheet.cells.Iterate(area)) {
      if (cell.area && !area.ContainsArea(cell.area)) {
        this.Error(ErrorCode.array);
        return;
      }
    }

    /*
    sheet.cells.Apply(area, (cell) => {
      if (cell.area && !area.ContainsArea(cell.area)) {
        // throw new Error('can\'t change part of an array');
        error = true;
      }
    });
    */

    // if the area completely encloses a table, delete the table
    const table_keys = this.model.tables.keys();
    for (const key of table_keys) {
      const table = this.model.tables.get(key);
      if (table && table.area.start.sheet_id === sheet.id) {
        const table_area = new Area(table.area.start, table.area.end);
        if (area.ContainsArea(table_area)) {
          for (let row = table_area.start.row; row <= table_area.end.row; row++) {
            for (let column = table_area.start.column; column <= table.area.end.column; column++) {
              const cell = sheet.cells.GetCell({row, column}, false);
              if (cell) {
                cell.table = undefined;
              }
            }
          }
          this.model.tables.delete(key);
        }
      }
    }
    
    /*
    if (error) {
      this.Error(ErrorCode.array); // `You can't change part of an array.`
    }
    else {
      sheet.ClearArea(area);
    }
    */

    sheet.ClearArea(area);

  }

  /**
   * send an error message. subscriber can figure out how to communicate it
   * to users. 
   * 
   * dropping strings, now we only allow error constants (via enum)
   *  
   * @param message 
   */
  protected Error(message: ErrorCode) {

    /*
    console.info('Error', message);
    if (typeof message === 'string') {
      this.grid_events.Publish({
        type: 'error',
        message,
      });
    }
    else {
      this.grid_events.Publish({
        type: 'error',
        code: message,
      });
    }
    */

    this.grid_events.Publish({
      type: 'error',
      code: message,
    });
  
  }


  /**
   * this breaks (or doesn't work) if the add_tab option is false; that's 
   * fine, although we might want to make a distinction between UI add-tab 
   * and API add-tab. And allow it from the API.
   * 
   * @param command 
   * @returns 
   */
   private DuplicateSheetInternal(command: DuplicateSheetCommand) {

    if (!this.options.add_tab) {
      console.warn('add tab option not set or false');
      return;
    }

    const source = this.ResolveSheet(command);
    const next_id = this.model.sheets.list.reduce((id, sheet) => Math.max(id, sheet.id), 0) + 1;

    let insert_index = -1;
    for (let i = 0; i < this.model.sheets.length; i++) {
      if (this.model.sheets.list[i] === source) {
        insert_index = i + 1;
      }
    }
    
    if (!source || insert_index < 0) {
      throw new Error('source sheet not found');
    }

    // explicit insert index

    if (typeof command.insert_before === 'number') {
      insert_index = command.insert_before;
    }
    else if (typeof command.insert_before === 'string') {
      const lc = command.insert_before.toLowerCase();
      for (let i = 0; i < this.model.sheets.length; i++) {
        if (this.model.sheets.list[i].name.toLowerCase() === lc) {
          insert_index = i;
          break;
        }
      }        
    }

    const options: SerializeOptions = {
      rendered_values: true,
    };

    const clone = Sheet.FromJSON(source.toJSON(options), this.model.theme_style_properties);
    
    let name = command.new_name || source.name;
    while (this.model.sheets.list.some((test) => test.name === name)) {
      const match = name.match(/^(.*?)(\d+)$/);
      if (match) {
        name = match[1] + (Number(match[2]) + 1);
      }
      else {
        name = name + '2';
      }
    }

    clone.name = name;
    clone.id = next_id;

    // console.info('CLONE', clone.id, clone);

    this.model.sheets.Splice(insert_index, 0, clone);

    // if (this.tab_bar) { this.tab_bar.Update(); }

    return clone.id;

  }

  /**
   * this is the callback method for the command-log select command
   * (which is not widely used). it does nothing. the specialization
   * should do something.
   * 
   * @param command 
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected SelectInternal(command: SelectCommand) {
    // does nothing
  }

  protected FreezeInternal(command: FreezeCommand) {

    const sheet = this.FindSheet(command.sheet_id || this.active_sheet.id);

    sheet.freeze.rows = command.rows;
    sheet.freeze.columns = command.columns;

  }

  /**
   * patch an expression for insert/delete row/column operations.
   * FIXME: should move, maybe to parser? (...)
   * 
   * NOTE: did I write this twice? we only need one. check which one is better.
   * @see PatchFormulasInternal
   * 
   * @returns the updated expression, or `undefined` if no changes were made.
   */
  protected PatchExpression(expression: string, options: PatchOptions) { 

    let count = 0;
    const parse_result = this.parser.Parse(expression);
    if (parse_result.expression) {

      this.parser.Walk(parse_result.expression, unit => {
        if (unit.type === 'range') {
          if (!unit.start.sheet || (unit.start.sheet.toLowerCase() === options.sheet.name.toLowerCase())) {
            const updated = Area.PatchArea(unit, options);
            if (updated) {
              unit.start.row = updated.start.row;
              unit.start.column = updated.start.column;
              unit.end.row = updated.end.row;
              unit.end.column = updated.end.column;
            }
            else {

              // FIXME: maybe have options for this? we don't really have a 
              // good way to replace nodes atm
              unit.start.row = unit.end.row = unit.start.column = unit.end.column = -1;

            }
          }
          count++;
          return false;
        }
        else if (unit.type === 'address') {
          const updated = Area.PatchArea({start: unit, end: unit}, options);
          if (updated) {
            unit.row = updated.start.row;
            unit.column = updated.start.column;
          }
          else {

            // see above
            unit.row = unit.column = -1;
          }
          count++;
          return false;
        }
        return true;
      });

      if (count) {
        const rendered = this.parser.Render(parse_result.expression, {
          missing: '',
        });
        // console.info("FROM", expression, "TO", rendered);
        return rendered;
      }

    }

    return undefined;

  }

  /**
   * patch sheet conditionals for insert/delete row/column operations.
   * some of them may be deleted.
   * 
   * UPDATE: using this routine to also patch data validations
   */
  protected PatchConditionalsAndValidations(options: PatchOptions) {

    if (options.sheet.data_validation.length) {

      const delete_list: Set<DataValidation> = new Set();
      for (const validation of options.sheet.data_validation) {

        const targets: IArea[] = [];
        for (const area of validation.target) {
          const updated = Area.PatchArea(area, options);
          if (updated) {
            targets.push(updated);
          }
        }

        if (targets.length > 0) {

          validation.target = targets;

          // format the range, if necessary

          if (validation.type === 'range') {
            if (validation.area.start.sheet_id === options.sheet.id) {
              const updated = Area.PatchArea(validation.area, options);
              if (updated) {
                validation.area = updated;
              }
              else {
                delete_list.add(validation);
              }
            }
          }

        }
        else {
          delete_list.add(validation);
        }
        
      }

      if (delete_list.size) {
        options.sheet.data_validation = options.sheet.data_validation.filter(test => !delete_list.has(test));
      }

    }

    if (options.sheet.conditional_formats?.length) {

      const delete_list: Set<ConditionalFormat> = new Set();
      for (const format of options.sheet.conditional_formats) {

        // first adjust the format area 

        const updated = Area.PatchArea(format.area, options);
        if (updated) {
          format.area = JSON.parse(JSON.stringify(updated));
        }
        else {
          delete_list.add(format);
          continue; // don't bother with formula
        }

        // next update the formula, if necessary. what do we do if the
        // area has disappeared? should be a #REF error, not sure we 
        // can encode that properly

        switch (format.type) {
          case 'expression':
          case 'cell-match':
            {
              const updated = this.PatchExpression(format.expression, options);

              if (updated) {
                format.expression = updated;
              }
            }
            break;
        }

      }

      if (delete_list.size) {
        options.sheet.conditional_formats = options.sheet.conditional_formats.filter(test => !delete_list.has(test));
      }

    }

  }

  /**
   * FIXME: should be API method
   * FIXME: need to handle annotations that are address-based
   *
   * @see InsertColumns for inline comments
   */
  protected InsertRowsInternal(command: InsertRowsCommand): {
        error?: boolean;
        update_annotations_list?: Annotation[];
        resize_annotations_list?: Annotation[];
        delete_annotations_list?: Annotation[];
      } {

    const target_sheet = this.FindSheet(command.sheet_id);

    if (command.count === Infinity) {
      command.count = 1; // ?
    }
    else if (command.count === -Infinity) {
      command.count = -target_sheet.rows; // delete all
    }
    
    if (!target_sheet.InsertRows(command.before_row, command.count)){
      // this.Error(`You can't change part of an array.`);
      this.Error(ErrorCode.array);
      return { error: true };
    }

    // conditionals
    this.PatchConditionalsAndValidations({
        sheet: target_sheet, 
        before_column: 0, 
        column_count: 0, 
        before_row: command.before_row, 
        row_count: command.count
      });

    // connected elements
    for (const external of this.model.connected_elements.values()) {
      if (external.formula) {
        const modified = this.PatchFormulasInternal(external.formula,
          command.before_row, command.count, 0, 0,
          target_sheet.name.toLowerCase(), false);
        if (modified) {
          external.formula = modified;
        }
      }
    }

    // see InsertColumnsInternal re: tables. rows are less complicated,
    // except that if you delete the header row we want to remove the 
    // table entirely.

    const tables = Array.from(this.model.tables.values());

    for (const table of tables) {
      if (table.area.start.sheet_id === command.sheet_id) {

        if (command.count > 0) {
          if (command.before_row <= table.area.start.row) {
            // shift the table down

            //console.info("shift table down");
            table.area.start.row += command.count;
            table.area.end.row += command.count;

          }
          else if (command.before_row <= table.area.end.row) {
            // insert rows. we need to add references to 
            // cells that have been inserted.

            // console.info("insert table rows");
            table.area.end.row += command.count;
            for (let row = table.area.start.row; row <= table.area.end.row; row++) {
              for (let column = table.area.start.column; column <= table.area.end.column; column++) {
                const cell = target_sheet.CellData({row, column});
                cell.table = table;
              }
            }

          }
        }
        else {
          if (command.before_row <= table.area.start.row) {
            if (command.before_row - command.count <= table.area.start.row) {
              // shift table up
              
              table.area.start.row += command.count;
              table.area.end.row += command.count;

            }
            else if (command.before_row - command.count >= table.area.end.row) {
              // remove the entire table
              
              this.model.tables.delete(table.name.toLowerCase());

            }
            else {

              // assuming this will remove the header row, drop the table
              // altogether. the alternative is to just not let you remove
              // this row. but that should be handled before you get here;
              // if you get here, and you want to delete the row, then the
              // table will go.

              this.model.tables.delete(table.name.toLowerCase());

              for (let row = command.before_row; row <= table.area.end.row; row++) {
                for (let column = table.area.start.column; column <= table.area.end.column; column++) {
                  const cell = target_sheet.CellData({row, column});
                  if (cell.table === table) {
                    cell.table = undefined;
                  }
                }
              }
              
            }
          }
          else if (command.before_row <= table.area.end.row) {
            // remove table rows from the end. cap.
            // we may be removing the totals row -- in that case, update the table to reflect.
            
            if (command.before_row - command.count > table.area.end.row) {
              table.totals_row = false;
            }

            table.area.end.row = Math.max(0, table.area.end.row + command.count, command.before_row - 1);

          }
        }

      }
    }
    

    this.model.named.PatchNamedRanges(target_sheet.id, 0, 0, command.before_row, command.count);

    const target_sheet_name = target_sheet.name.toLowerCase();

    for (const sheet of this.model.sheets.list) {
      const is_target = sheet === target_sheet;

      for (const cell of sheet.cells.Iterate()) {
        if (cell.ValueIsFormula()) {
          const modified = this.PatchFormulasInternal(cell.value || '',
            command.before_row, command.count, 0, 0,
            target_sheet_name, is_target);
          if (modified) {
            cell.value = modified;
          }
        }
      }

      /*
      sheet.cells.IterateAll((cell: Cell) => {
        if (cell.ValueIsFormula()) {
          const modified = this.PatchFormulasInternal(cell.value || '',
            command.before_row, command.count, 0, 0,
            target_sheet_name, is_target);
          if (modified) {
            cell.value = modified;
          }
        }
      });
      */

      for (const annotation of sheet.annotations) {
        if (annotation.data.formula) {
          const modified = this.PatchFormulasInternal(annotation.data.formula || '',
            command.before_row, command.count, 0, 0,
            target_sheet_name, is_target);
          if (modified) {
            annotation.data.formula = modified;
          }
        }
      }

    }


    // annotations

    const update_annotations_list: Annotation[] = [];
    const resize_annotations_list: Annotation[] = [];
    const delete_annotations_list: Annotation[] = [];

    if (command.count > 0) { // insert

      const first = command.before_row;

      for (const annotation of target_sheet.annotations) {
        if (annotation.data.layout) {
          const [start, end, endy] = [
            annotation.data.layout.tl.address.row, 
            annotation.data.layout.br.address.row,
            annotation.data.layout.br.offset.y,
          ];

          if (first <= start ) { 

            // start case 1: starts above the annotation (including exactly at the top)

            // shift
            annotation.data.layout.tl.address.row += command.count;
            annotation.data.layout.br.address.row += command.count;

          }
          else if (first < end || first === end && endy > 0) { 
            
            // start case 2: starts in the annotation, omitting the first row

            annotation.data.layout.br.address.row += command.count;

            // size changing
            resize_annotations_list.push(annotation);

          }
          else {

            // do nothing
            continue;
          }

          update_annotations_list.push(annotation);
        }
      }

    }
    else if (command.count < 0) { // delete

      // first and last column deleted

      const first = command.before_row;
      const last = command.before_row - command.count - 1;

      for (const annotation of target_sheet.annotations) {
        if (annotation.data.layout) {
          
          // start and end row of the annotation. recall that in
          // this layout, the annotation may extend into the (first,last) 
          // row but not beyond it. the offset is _within_ the row.

          const [start, end, endy] = [
            annotation.data.layout.tl.address.row, 
            annotation.data.layout.br.address.row,
            annotation.data.layout.br.offset.y,
          ];

          if (first <= start ) { 

            // start case 1: starts above the annotation (including exactly at the top)

            if (last < start) { 

              // end case 1: ends before the annotation

              // shift
              annotation.data.layout.tl.address.row += command.count;
              annotation.data.layout.br.address.row += command.count;

            }
            else if (last < end - 1 || (last === end -1 && endy > 0)) { 
            
              // end case 2: ends before the end of the annotation

              // shift + cut
              annotation.data.layout.tl.address.row = first;
              annotation.data.layout.tl.offset.y = 0;
              annotation.data.layout.br.address.row += command.count;

              // size changing
              resize_annotations_list.push(annotation);

            }
            else { 
              
              // end case 3: ends after the annotation

              // drop the annotation
              delete_annotations_list.push(annotation);
              continue;
              
            }

          }
          else if (first < end || first === end && endy > 0) { 
            
            // start case 2: starts in the annotation, omitting the first row

            if (last < end - 1 || (last === end -1 && endy > 0)) { 
              
              // end case 2: ends before the end of the annotation

              // shorten
              annotation.data.layout.br.address.row += command.count;

              // size changing
              resize_annotations_list.push(annotation);

            }
            else { 
              
              // end case 3: ends after the annotation

              // clip
              annotation.data.layout.br.address.row = first;
              annotation.data.layout.br.offset.y = 0;

              // size changing
              resize_annotations_list.push(annotation);

            }

          }
          else { 
            
            // start case 3: starts after the annotation

            // do nothing              
            
            continue;

          }

          update_annotations_list.push(annotation);

        }
      }

    }

    for (const annotation of delete_annotations_list) {
      target_sheet.annotations = target_sheet.annotations.filter(test => test !== annotation);
    }

    return {
      update_annotations_list,
      resize_annotations_list,
      delete_annotations_list,
    };
    
  }

  /**
   * 
   */
   protected InsertColumnsInternal(command: InsertColumnsCommand): {
        error?: boolean;
        update_annotations_list?: Annotation[];
        resize_annotations_list?: Annotation[];
        delete_annotations_list?: Annotation[];
      } {

    const target_sheet = this.FindSheet(command.sheet_id);

    // it seems like we never get an insert infinity. not sure why,
    // but the UI is blocking that. we should handle it anyway jic
    
    if (command.count === Infinity) {
      command.count = 1; // ?
    }
    else if (command.count === -Infinity) {
      command.count = -target_sheet.columns; // delete all
    }

    // FIXME: we need to get this error out earlier. before this call,
    // in the call that generates the insert event. otherwise if we 
    // have remotes, everyone will see the error -- we only want the 
    // actual actor to see the error.

    if (!target_sheet.InsertColumns(command.before_column, command.count)) {
      // this.Error(`You can't change part of an array.`);
      this.Error(ErrorCode.array);
      return { error: true };
    }
    
    // conditionals
    this.PatchConditionalsAndValidations({
      sheet: target_sheet, 
      before_column: command.before_column, 
      column_count: command.count, 
      before_row: 0, 
      row_count: 0 });

    // connected elements
    for (const element of this.model.connected_elements.values()) {
      if (element.formula) {
        const modified = this.PatchFormulasInternal(element.formula,
          0, 0, command.before_column, command.count,
          target_sheet.name.toLowerCase(), false);
        if (modified) {
          element.formula = modified;
        }
      }
    }

    // patch tables. we removed this from the sheet routine entirely,
    // we need to rebuild any affected tables now.

    // NOTE: we may drop tables, so we can't use a live iterator. or 
    // is the iterator precomputed? not sure. let's flatten immediately jic.

    const tables = Array.from(this.model.tables.values());

    for (const table of tables) {
      if (table.area.start.sheet_id === command.sheet_id) {

        if (command.count > 0) {
          if (command.before_column <= table.area.start.column) {
            // shift the table to the right. update the table reference,
            // we can skip updating headers as the columns haven't changed.

            // console.info("shift table right");
            table.area.start.column += command.count;
            table.area.end.column += command.count;
            
          }
          else if (command.before_column <= table.area.end.column) {
            // insert columns -- we need to add references to new 
            // cells, and update headers.

            // console.info("insert table columns");
            table.area.end.column += command.count;
            for (let row = table.area.start.row; row <= table.area.end.row; row++) {
              for (let column = table.area.start.column; column <= table.area.end.column; column++) {
                const cell = target_sheet.CellData({row, column});
                cell.table = table;
              }
            }
            this.UpdateTableColumns(table);

          }
        }
        else {
          if (command.before_column <= table.area.start.column) {
            if (command.before_column - command.count <= table.area.start.column) {
              // shift table left. update the table reference, we can skip headers.

              // console.info("shift table left");
              table.area.start.column += command.count;
              table.area.end.column += command.count;
            
            }
            else if (command.before_column - command.count >= table.area.end.column ){
              // remove entire table. cells are already removed, we can just
              // drop the table from the model.

              // console.info("remove table");
              this.model.tables.delete(table.name.toLowerCase());

            }
            else {
              // shift to the left, then remove table columns. cells are 
              // already removed, so we don't need to touch cells; just 
              // update the reference and column headers.

              // console.info("remove table columns (1)");
              table.area.start.column = command.before_column;
              table.area.end.column += command.count;
              this.UpdateTableColumns(table);

            }
          }
          else if (command.before_column <= table.area.end.column) {
            // remove table columns. as above. cap.

            // console.info("remove table columns (2)");
            table.area.end.column = Math.max(0, table.area.end.column + command.count, command.before_column - 1);
            this.UpdateTableColumns(table);

          }
        }

      }
    }


    this.model.named.PatchNamedRanges(target_sheet.id, command.before_column, command.count, 0, 0);

    // FIXME: we need an event here? 

    // A: caller sends a "structure" event after this call. that doesn't include
    //    affected areas, though. need to think about whether structure event
    //    triggers a recalc (probably should). we could track whether we've made
    //    any modifications (and maybe also whether we now have any invalid 
    //    references)

    // patch all sheets

    // you know we have a calculator that has backward-and-forward references.
    // we could theoretically ask the calculator what needs to be changed.
    //
    // for the most part, we try to maintain separation between the display
    // (this) and the calculator. we could ask, but this isn't terrible and 
    // helps maintain that separation.

    const target_sheet_name = target_sheet.name.toLowerCase();

    for (const sheet of this.model.sheets.list) {
      const is_target = sheet === target_sheet;

      for (const cell of sheet.cells.Iterate()) {
        if (cell.ValueIsFormula()) {
          const modified = this.PatchFormulasInternal(cell.value || '', 0, 0,
            command.before_column, command.count,
            target_sheet_name, is_target);
          if (modified) {
            cell.value = modified;
          }
        }
      }

      /*
      sheet.cells.IterateAll((cell: Cell) => {
        if (cell.ValueIsFormula()) {
          const modified = this.PatchFormulasInternal(cell.value || '', 0, 0,
            command.before_column, command.count,
            target_sheet_name, is_target);
          if (modified) {
            cell.value = modified;
          }
        }
      });
      */

      for (const annotation of sheet.annotations) {
        if (annotation.data.formula) {
          const modified = this.PatchFormulasInternal(annotation.data.formula,
            0, 0, command.before_column, command.count,
            target_sheet_name, is_target);
          if (modified) {
            annotation.data.formula = modified;
          }
        }
      }

    }

    // annotations

    const update_annotations_list: Annotation[] = [];
    const resize_annotations_list: Annotation[] = [];
    const delete_annotations_list: Annotation[] = [];

    if (command.count > 0) { // insert

      const first = command.before_column;

      for (const annotation of target_sheet.annotations) {
        if (annotation.data.layout) {
          const [start, end, endx] = [
            annotation.data.layout.tl.address.column, 
            annotation.data.layout.br.address.column,
            annotation.data.layout.br.offset.x,
          ];

          if (first <= start ) { 

            // start case 1: starts to the left of the annotation (including exactly at the left)

            // shift
            annotation.data.layout.tl.address.column += command.count;
            annotation.data.layout.br.address.column += command.count;

          }
          else if (first < end || first === end && endx > 0) { 
            
            // start case 2: starts in the annotation, omitting the first column

            annotation.data.layout.br.address.column += command.count;

            // size changing
            resize_annotations_list.push(annotation);

          }
          else {

            // do nothing
            continue;
          }

          update_annotations_list.push(annotation);
        }
      }

    }
    else if (command.count < 0) { // delete

      // first and last column deleted

      const first = command.before_column;
      const last = command.before_column - command.count - 1;

      for (const annotation of target_sheet.annotations) {
        if (annotation.data.layout) {
          
          // start and end column of the annotation. recall that in
          // this layout, the annotation may extend into the (first,last) 
          // column but not beyond it. the offset is _within_ the column.

          const [start, end, endx] = [
            annotation.data.layout.tl.address.column, 
            annotation.data.layout.br.address.column,
            annotation.data.layout.br.offset.x,
          ];

          if (first <= start ) { 

            // start case 1: starts to the left of the annotation (including exactly at the left)

            if (last < start) { 

              // end case 1: ends before the annotation

              // shift
              annotation.data.layout.tl.address.column += command.count;
              annotation.data.layout.br.address.column += command.count;

            }
            else if (last < end - 1 || (last === end -1 && endx > 0)) { 
            
              // end case 2: ends before the end of the annotation

              // shift + cut
              annotation.data.layout.tl.address.column = first;
              annotation.data.layout.tl.offset.x = 0;
              annotation.data.layout.br.address.column += command.count;

              // size changing
              resize_annotations_list.push(annotation);

            }
            else { 
              
              // end case 3: ends after the annotation

              // drop the annotation
              delete_annotations_list.push(annotation);
              continue;
              
            }

          }
          else if (first < end || first === end && endx > 0) { 
            
            // start case 2: starts in the annotation, omitting the first column

            if (last < end - 1 || (last === end -1 && endx > 0)) { 
              
              // end case 2: ends before the end of the annotation

              // shorten
              annotation.data.layout.br.address.column += command.count;

              // size changing
              resize_annotations_list.push(annotation);

            }
            else { 
              
              // end case 3: ends after the annotation

              // clip
              annotation.data.layout.br.address.column = first;
              annotation.data.layout.br.offset.x = 0;

              // size changing
              resize_annotations_list.push(annotation);

            }

          }
          else { 
            
            // start case 3: starts after the annotation

            // do nothing              
            
            continue;

          }

          update_annotations_list.push(annotation);

        }
      }

    }

    for (const annotation of delete_annotations_list) {
      target_sheet.annotations = target_sheet.annotations.filter(test => test !== annotation);
    }

    return {
      update_annotations_list,
      resize_annotations_list,
      delete_annotations_list,
    };

  }


  //////////////////////////////////////////////////////////////////////////////

  /**
   * pass all data/style/structure operations through a command mechanism.
   * this method should optimally act as a dispatcher, so try to minimize
   * inline code in favor of method calls.
   *
   * [NOTE: don't go crazy with that, some simple operations can be inlined]
   * 
   * NOTE: working on coediting. we will need to handle different sheets.
   * going to work one command at a time...
   * 
   * @param queue -- push on the command log. this is default true so it
   * doesn't change existing behavior, but you can turn it off if the message
   * comes from a remote queue.
   * 
   */
   public ExecCommand(commands: Command | Command[], queue = true): UpdateFlags {

    // FIXME: support ephemeral commands (...)

    // data and style events were triggered by the areas being set.
    // we are not necessarily setting them for offsheet changes, so
    // we need an explicit flag. this should be logically OR'ed with
    // the area existing (for purposes of sending an event).

    // all flags/areas moved to this struct

    const flags: UpdateFlags = {
      pending: [],
    };

    const events: GridEvent[] = [];

    // should we normalize always, or only if we're queueing?
    // it seems like it's useful here, then we can be a little
    // sloppier in the actual handlers. after normalizing, any
    // command that has an address/area (or sheet ID parameter)
    // will have an explicit sheet ID.

    commands = this.NormalizeCommands(commands);

    // FIXME: we should queue later, so we can remove any commands
    // that fail... throw errors, and so on

    if (queue) {
      this.command_log.Publish({ command: commands, timestamp: new Date().getTime() });
    }

    for (const command of commands) {

      // console.log(CommandKey[command.key], JSON.stringify(command));

      switch (command.key) {
        case CommandKey.Reset:

          // not sure how well this fits in with the command queue. it
          // doesn't look like it sends any events, so what's the point?
          // just to get a command log event?

          // the problem is that load doesn't run through the queue, so
          // even if you did a reset -> load we'd just get the reset part.

          // ...

          // OK, actually this is used in the CSV import routine. we need
          // to support it until we get rid of that (it needs to move).
          
          this.ResetInternal();
          break;

        case CommandKey.Clear:
          if (command.area) {
            const area = new Area(command.area.start, command.area.end);
            this.ClearAreaInternal(area);
            flags.data_area = Area.Join(area, flags.data_area);
            flags.formula = true;
          }
          break;

        case CommandKey.Select:

          // nobody (except one routine) is using commands for selection.
          // not sure why or why not, or if that's a problem. (it's definitely
          // a problem if we are recording the log for playback)

          // ATM the base class is just going to do nothing.

          this.SelectInternal(command);

          break;

        case CommandKey.Freeze:

          // COEDITING: ok

          this.FreezeInternal(command);

          // is the event necessary here? not sure. we were sending it as a
          // side effect, so it was added here in case there was some reason
          // it was necessary. at a minimum, it should not require a rebuild
          // because no addresses change. (although we leave it in case someone
          // else sets it).)

          flags.structure_event = true;

          break;

        case CommandKey.AddConditionalFormat:
          {

            const sheet = this.FindSheet(command.format.area);
            sheet.conditional_formats.push(command.format);

            sheet.Invalidate(new Area(command.format.area.start, command.format.area.end));

            if (sheet === this.active_sheet) {
              // flags.style_area = Area.Join(command.format.area, flags.style_area);
              flags.render_area = Area.Join(command.format.area, flags.render_area);
            }
            else {
              // flags.style_event = true;
            }

            flags.structure_event = true;
            flags.conditional_formatting_event = true;

          }
          break;

        case CommandKey.RemoveConditionalFormat:

          {
            let sheet: Sheet|undefined;
            let count = 0;

            if (command.format) {

              // we're removing by object equivalence, not strict equality.
              // this is in case we're switching contexts and the objects
              // are not strictly equal. may be unecessary. do we need to
              // normalize in some way? (...)

              const format = JSON.stringify(command.format);

              sheet = this.FindSheet(command.format.area);
              sheet.conditional_formats = sheet.conditional_formats.filter(test => {
                // if (test === command.format) {
                if (JSON.stringify(test) === format) {
                  count++;
                  flags.render_area = Area.Join(test.area, flags.render_area);
                  return false;
                }
                return true;
              });

            }
            else if (command.area) {
              const area = new Area(command.area.start, command.area.end);
              sheet = this.FindSheet(command.area);

              sheet.conditional_formats = sheet.conditional_formats.filter(test => {
                const compare = new Area(test.area.start, test.area.end);
                if (compare.Intersects(area)) {
                  count++;
                  flags.render_area = Area.Join(compare, flags.render_area);
                  return false;
                }
                return true;
              });
        
            }

            if (sheet && count) {
              sheet.FlushConditionalFormats();
              flags.structure_event = true;

              // this will flush leaf vertices. but it's expensive because
              // it's rebuilding the whole graph. we could maybe reduce a 
              // bit... the question is what's worse: rebuilding the graph
              // or leaving orphans for a while?

              // flags.structure_rebuild_required = true;

              flags.conditional_formatting_event = true;
            }

          }
          break;

        case CommandKey.InsertTable:

          // the most important thing here is validating that we can
          // create the table in the target area.

          {
            const sheet = this.FindSheet(command.area);
            const area = new Area(command.area.start, command.area.end);

            // validate first

            let valid = true;

            validation_loop:
            for (let row = area.start.row; row <= area.end.row; row++) {
              for (let column = area.start.column; column <= area.end.column; column++) {
                const cell = sheet.cells.GetCell({row, column}, false);
                if (cell && (cell.area || cell.merge_area || cell.table)) {
                  valid = false;
                  break validation_loop;
                }
              }
            }

            if (valid) {

              // we need a name for the table. needs to be unique.

              let index = this.model.tables.size + 1;
              let name = '';

              for (;;) {
                name = `Table${index++}`;
                if (!this.model.tables.has(name.toLowerCase())) {
                  break;
                }
              }

              const table: Table = {
                area: command.area,
                name,
                sortable: command.sortable, // defaults to true if !present
                theme: command.theme,
              };

              if (command.totals) {
                table.totals_row = true;
              }

              this.model.tables.set(name.toLowerCase(), table);

              for (let row = area.start.row; row <= area.end.row; row++) {
                for (let column = area.start.column; column <= area.end.column; column++) {
                  const cell = sheet.cells.GetCell({row, column}, true);
                  cell.table = table;
                }
              }
  
              this.UpdateTableColumns(table);

              // force rerendering, we don't need to flush the values

              sheet.Invalidate(new Area(table.area.start, table.area.end));

              if (sheet === this.active_sheet) {
                flags.style_area = Area.Join(area, flags.style_area);
                flags.render_area = Area.Join(area, flags.render_area);

              }
              else {
                flags.style_event = true;
              }

            }

          }

          break;


        case CommandKey.RemoveTable:

          // this is pretty easy, we can do it inline

          {
            const sheet = this.FindSheet(command.table.area);
            const area = new Area(command.table.area.start, command.table.area.end);

            for (let row = area.start.row; row <= area.end.row; row++) {
              for (let column = area.start.column; column <= area.end.column; column++) {
                const cell = sheet.cells.GetCell({row, column}, false);
                if (cell) {
                  cell.table = undefined;
                }
              }
            }

            // drop from model

            // console.info('deleting...', command.table.name);
            this.model.tables.delete(command.table.name.toLowerCase());

            // tables use nonstandard styling, we need to invalidate the sheet.
            // for edges invalidate an extra cell around the table

            const invalid = sheet.RealArea(area.Clone().Shift(-1, -1).Resize(area.rows + 2, area.columns + 2));
            sheet.Invalidate(invalid);
            
            if (sheet === this.active_sheet) {
              flags.style_area = Area.Join(area, flags.style_area);
              flags.render_area = Area.Join(area, flags.render_area);
            }
            else {
              flags.style_event = true;
            }

          }

          break;

        case CommandKey.MergeCells:
          {
            // COEDITING: ok

            const sheet = this.FindSheet(command.area);

            sheet.MergeCells(
              new Area(command.area.start, command.area.end));

            // sheet publishes a data event here, too. probably a good
            // idea because references to the secondary (non-head) merge 
            // cells will break.

            flags.structure_event = true;
            flags.structure_rebuild_required = true;

            if (sheet === this.active_sheet) {
              flags.data_area = Area.Join(command.area, flags.data_area);
              flags.render_area = Area.Join(command.area, flags.render_area);
            }
            else {
              flags.data_event = true;
              // this.pending_layout_update.add(sheet.id);
              if (!flags.pending) {
                flags.pending = [];
              }
              flags.pending.push(sheet.id);
            }
          }

          break;

        case CommandKey.UnmergeCells:
          {
            // COEDITING: ok

            // the sheet unmerge routine requires a single, contiguous merge area.
            // we want to support multiple unmerges at the same time, though,
            // so let's check for multiple. create a list.

            // FIXME: use a set

            const sheet = this.FindSheet(command.area);
            const list: Record<string, Area> = {};
            const area = new Area(command.area.start, command.area.end);

            for (const cell of sheet.cells.Iterate(area, false)) {
              if (cell.merge_area) {
                const label = Area.CellAddressToLabel(cell.merge_area.start) + ':'
                  + Area.CellAddressToLabel(cell.merge_area.end);
                list[label] = cell.merge_area;
              }
            }

            /*
            sheet.cells.Apply(area, (cell: Cell) => {
              if (cell.merge_area) {
                const label = Area.CellAddressToLabel(cell.merge_area.start) + ':'
                  + Area.CellAddressToLabel(cell.merge_area.end);
                list[label] = cell.merge_area;
              }
            }, false);
            */

            const keys = Object.keys(list);

            for (let i = 0; i < keys.length; i++) {
              sheet.UnmergeCells(list[keys[i]]);
            }

            // see above

            if (sheet === this.active_sheet) {
              flags.render_area = Area.Join(command.area, flags.render_area);
              flags.data_area = Area.Join(command.area, flags.data_area);
            }
            else {
              flags.data_event = true;
              // this.pending_layout_update.add(sheet.id);
              if (!flags.pending) {
                flags.pending = [];
              }
              flags.pending.push(sheet.id);

            }

            flags.structure_event = true;
            flags.structure_rebuild_required = true;
          }
          break;

        case CommandKey.Indent:
          {
            let area: Area|undefined;
            const sheet = this.FindSheet(command.area);

            if (IsCellAddress(command.area)) {
              area = new Area(command.area);
              const style = sheet.GetCellStyle(command.area, true);
              sheet.UpdateCellStyle(command.area, {
                indent: Math.max(0, (style.indent || 0) + command.delta),
              }, true);
            }
            else {
              area = new Area(command.area.start, command.area.end);
              for (const address of area) {
                const style = sheet.GetCellStyle(address, true);
                sheet.UpdateCellStyle(address, {
                  indent: Math.max(0, (style.indent || 0) + command.delta),
                }, true);
              }
            }

            if (sheet === this.active_sheet) {
              flags.style_area = Area.Join(area, flags.style_area);
              flags.render_area = Area.Join(area, flags.render_area);
            }
            else {
              flags.style_event = true;
            }

          }
          break;

        case CommandKey.UpdateStyle:
          {
            // COEDITING: handles sheet ID properly

            // to account for our background bleeding up/left, when applying
            // style changes we may need to render one additional row/column.

            let area: Area|undefined;
            const sheet = this.FindSheet(command.area);

            if (IsCellAddress(command.area)) {
              area = new Area(command.area);
              sheet.UpdateCellStyle(command.area, command.style, !!command.delta);
            }
            else {
              area = new Area(command.area.start, command.area.end);
              sheet.UpdateAreaStyle(area, command.style, !!command.delta);
            }

            if (sheet === this.active_sheet) {
              flags.style_area = Area.Join(area, flags.style_area);
            
              // we can limit bleed handling to cases where it's necessary...
              // if we really wanted to optimize we could call invalidate on .left, .top, &c

              if (!command.delta 
                  || command.style.fill
                  || command.style.border_top
                  || command.style.border_left
                  || command.style.border_right
                  || command.style.border_bottom) {

                area = Area.Bleed(area); // bleed by 1 to account for borders/background 
                this.active_sheet.Invalidate(area);

              }

              flags.render_area = Area.Join(area, flags.render_area);
              
            }
            else {
              flags.style_event = true;
            }

          }

          break;

        case CommandKey.DataValidation:

          // COEDITING: ok

          this.SetValidationInternal(command);
          if (!command.area.start.sheet_id || command.area.start.sheet_id === this.active_sheet.id) {
            flags.render_area = Area.Join(new Area(command.area.start, command.area.end), flags.render_area);
          }
          break;

        case CommandKey.SetName:

          // it seems like we're allowing overwriting names if those
          // names exist as expressions or named ranges. however we
          // should not allow overriding a built-in function name (or
          // a macro function name?)

          // FOR THE TIME BEING we're going to add that restriction to
          // the calling function, which (atm) is the only way to get here.

          {
            const ac_token: FunctionDescriptor = { type: 'token', named: true, name: command.name, scope: command.scope };
            if (command.area || command.expression) {
              if (command.area) {
                this.model.named.SetNamedRange(command.name, new Area(command.area.start, command.area.end), command.scope);
              }
              else if (command.expression) {
                this.model.named.SetNamedExpression(command.name, command.expression, command.scope);
              }
              this.autocomplete_matcher.AddFunctions(ac_token);
            }
            else {
              this.model.named.ClearName(command.name, command.scope);
              this.autocomplete_matcher.RemoveFunctions(ac_token);
            }

            flags.structure_event = true;
            flags.structure_rebuild_required = true;
          }
          break;

        case CommandKey.UpdateBorders:
          {
            // COEDITING: ok

            // UPDATE: actually had a problem with Area.Bleed dropping the
            // sheet ID. fixed.

            const area = this.ApplyBordersInternal(command);

            if (area.start.sheet_id === this.active_sheet.id) {
              flags.render_area = Area.Join(area, flags.render_area);
              flags.style_area = Area.Join(area, flags.style_area);
            }
            else {
              flags.style_event = true;
            }

          }
          break;

        case CommandKey.ShowSheet:

          // COEDITING: we probably don't want this to pass through
          // when coediting, but it won't break anything. you can filter.

          this.ShowSheetInternal(command);
          flags.sheets = true; // repaint tab bar
          flags.structure_event = true;
          break;

        case CommandKey.ReorderSheet:
          {
            // COEDITING: seems OK, irrespective of active sheet

            const sheets: Sheet[] = [];
            const target = this.model.sheets.list[command.index];

            for (let i = 0; i < this.model.sheets.length; i++) {
              if (i !== command.index) {
                if (i === command.move_before) {
                  sheets.push(target);
                }
                sheets.push(this.model.sheets.list[i]);
              }
            }

            if (command.move_before >= this.model.sheets.length) {
              sheets.push(target);
            }

            // this.model.sheets = sheets;
            this.model.sheets.Assign(sheets);

            flags.sheets = true;
            flags.structure_event = true;

          }
          break;

        case CommandKey.RenameSheet:
          {
            // COEDITING: seems OK, irrespective of active sheet

            const sheet = this.ResolveSheet(command);
            if (sheet) {
              this.RenameSheetInternal(sheet, command.new_name);
              flags.sheets = true;
              flags.structure_event = true;
            }
          }
          break;

        case CommandKey.ResizeRows:

          // moving this to a method so we can specialize: non-UI grid
          // should not support autosize (it can't)

          // this may impact the SUBTOTAL function. which is dumb, but
          // there you go. so treat this as a data event for rows that
          // change visibility one way or the other.

          // COEDITING: ok

          {
            const area = this.ResizeRowsInternal(command);
            if (area) {
              if (area.start.sheet_id === this.active_sheet.id) {
                const real_area = this.active_sheet.RealArea(new Area(area.start, area.end));
                flags.render_area = Area.Join(real_area, flags.render_area);
                flags.data_area = Area.Join(real_area, flags.data_area);
                flags.data_event = true;
              }
              else {
                flags.data_event = true;
                if (!flags.pending) {
                  flags.pending = [];
                }
                if (area.start.sheet_id) {
                  flags.pending.push(area.start.sheet_id);
                }
              }
            }
            flags.structure_event = true;
          }

          break;

        case CommandKey.ResizeColumns:

          this.ResizeColumnsInternal(command);
          flags.structure_event = true;
          break;

        case CommandKey.ShowHeaders:

          // FIXME: now that we don't support 2-level headers (or anything
          // other than 1-level headers), headers should be managed by/move into
          // the grid class.

          this.active_sheet.SetHeaderSize(command.show ? undefined : 1, command.show ? undefined : 1);
          this.flags.layout = true;
          this.flags.repaint = true;
          break;

        case CommandKey.InsertRows:

          // COEDITING: annotations are broken

          this.InsertRowsInternal(command);
          flags.structure_event = true;
          flags.structure_rebuild_required = true;
          break;

        case CommandKey.InsertColumns:

          // COEDITING: annotations are broken

          this.InsertColumnsInternal(command);
          flags.structure_event = true;
          flags.structure_rebuild_required = true;
          break;

        case CommandKey.SetLink:
        case CommandKey.SetNote:
          {
            // COEDITING: ok

            // note and link are basically the same, although there's a 
            // method for setting note (not sure why)

            const sheet = this.FindSheet(command.area);

            let cell = sheet.cells.GetCell(command.area, true);
            if (cell) {

              let area: Area;
              if (cell.merge_area) {
                area = new Area(cell.merge_area.start);
                cell = sheet.cells.GetCell(cell.merge_area.start, true);
              }
              else {
                area = new Area(command.area);
              }

              if (command.key === CommandKey.SetNote) {
                cell.SetNote(command.note);
              }
              else {
                cell.hyperlink = command.reference || undefined;
                cell.render_clean = [];
              }

              if (sheet === this.active_sheet) {

                // this isn't necessary because it's what the render area does
                // this.DelayedRender(false, area);

                // treat this as style, because it affects painting but
                // does not require calculation.

                flags.style_area = Area.Join(area, flags.style_area);
                flags.render_area = Area.Join(area, flags.render_area);

              }
              else {
                flags.style_event = true;
              }

            }
          }
          break;

        case CommandKey.SortTable:
          {
            // console.info(command.table.area.spreadsheet_label);
            const area = this.SortTableInternal(command);

            if (area && area.start.sheet_id === this.active_sheet.id) {
              
              flags.data_area = Area.Join(area, flags.data_area);

              // normally we don't paint, we wait for the calculator to resolve

              if (this.options.repaint_on_cell_change) {
                flags.render_area = Area.Join(area, flags.render_area);
              }

            }
            else {
              flags.data_event = true;
            }
          }
          break;
  

        case CommandKey.SetRange:
          {
            // COEDITING: handles sheet ID properly
            // FIXME: areas should check sheet

            // area could be undefined if there's an error
            // (try to change part of an array)

            const area = this.SetRangeInternal(command, flags);

            if (area) {
              const sheet = this.model.sheets.Find(area.start.sheet_id || this.active_sheet.id);
              const tables = sheet?.TablesFromArea(area, true) || [];
              for (const table of tables) {
                this.UpdateTableColumns(table);
              }
            }

            if (area && area.start.sheet_id === this.active_sheet.id) {
              
              flags.data_area = Area.Join(area, flags.data_area);

              // normally we don't paint, we wait for the calculator to resolve

              if (this.options.repaint_on_cell_change) {
                flags.render_area = Area.Join(area, flags.render_area);
              }

            }
            else {
              flags.data_event = true;
            }

          }
          break;

        case CommandKey.DeleteSheet:

          // COEDITING: looks fine

          this.DeleteSheetInternal(command);
          flags.sheets = true;
          flags.structure_event = true;
          flags.structure_rebuild_required = true;
          break;

        case CommandKey.DuplicateSheet:

          // FIXME: what happens to named ranges? we don't have sheet-local names...

          this.DuplicateSheetInternal(command);

          flags.sheets = true;
          flags.structure_event = true;
          flags.structure_rebuild_required = true;
          break;

        case CommandKey.AddSheet:

          // COEDITING: this won't break, but it shouldn't change the 
          // active sheet if this is a remote command. is there a way
          // to know? we can guess implicitly from the queue parameter,
          // but it would be better to be explicit.

          {
            const id = this.AddSheetInternal(command.name, command.insert_index); // default name
            if (typeof id === 'number' && command.show) {
              this.ActivateSheetInternal({
                key: CommandKey.ActivateSheet,
                id,
              });
            }
            flags.structure_event = true;
            flags.sheets = true;
            flags.structure = true;

          }
          break;

        case CommandKey.ActivateSheet:
          this.ActivateSheetInternal(command);
          break;

        default:
          console.warn(`unhandled command: ${CommandKey[command.key]} (${command.key})`);
      }
    }

    // consolidate events and merge areas

    if (flags.data_area) {
      if (!flags.data_area.start.sheet_id) {
        flags.data_area.SetSheetID(this.active_sheet.id);
      }
      events.push({ type: 'data', area: flags.data_area });
    }
    else if (flags.data_event) {
      events.push({ type: 'data' });
    }

    if (flags.style_area) {
      if (!flags.style_area.start.sheet_id) {
        flags.style_area.SetSheetID(this.active_sheet.id);
      }
      events.push({ type: 'style', area: flags.style_area });
    }
    else if (flags.style_event) {
      events.push({ type: 'style' });
    }

    if (flags.structure_event) {
      events.push({
        type: 'structure',
        rebuild_required: flags.structure_rebuild_required,
        conditional_format: flags.conditional_formatting_event,
      });
    }

    if (this.batch) {
      this.batch_events.push(...events);
    }
    else {
      this.grid_events.Publish(events);
      //if (flags.render_area) {
      //  this.DelayedRender(false, flags.render_area);
      //}
    }

    return flags;



  }

}