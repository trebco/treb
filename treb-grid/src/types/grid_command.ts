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

import type { ICellAddress, IArea, CellStyle, Color, CellValue, Table, TableSortType, TableTheme, IRectangle } from 'treb-base-types';
import type { ExpressionUnit } from 'treb-parser';
import type { BorderConstants } from './border_constants';
import type { AnnotationData, ConditionalFormat, Sheet } from 'treb-data-model';

/**
 * switching to an exec-command based model, so we can serialize
 * data, layout and style changes; the intent is to support recording,
 * replaying, and transmitting modifications.
 *
 * NOTE regarding commands: let's make them as explicit as possible
 * (meaning fewer optional parameters). force callers to populate fields.
 *
 */

/**
 * commands are symbolic for (hopefully) faster switching. we use a
 * discriminated union for build-time parameter checks. see individual
 * command interfaces for comments.
 */
export enum CommandKey {

  /** use an empty value so all commands are non-zero */
  Null = 0,

  InsertRows,
  InsertColumns,
  ResizeRows,
  ResizeColumns,
  Select,
  SetRange,
  UpdateStyle,
  UpdateBorders,
  Indent,
  MergeCells,
  UnmergeCells,
  Clear,
  UpdateTheme,
  SetNote,
  SetLink,
  Freeze,
  SetName,
  ShowHeaders,
  AddSheet,
  DuplicateSheet,
  DeleteSheet,
  ActivateSheet,
  RenameSheet,
  ReorderSheet,
  ShowSheet,
  DataValidation,
  Reset,
  SortTable,
  InsertTable,
  RemoveTable,

  AddConditionalFormat,
  RemoveConditionalFormat,

  TabColor,
  CreateAnnotation,

}

export interface CreateAnnotationCommand {
  key: CommandKey.CreateAnnotation;
  sheet: Sheet;
  properties: Partial<AnnotationData>;
  add_to_sheet?: boolean;
  offset?: boolean;
  target?: IArea|IRectangle;
  focus?: boolean;

}

/** base type for sheet commands -- can select sheet by name, id or index */
export interface SheetSelection {
  index?: number;
  name?: string;
  id?: number;
}

/**
 * show or hide sheet.
 */
export interface ShowSheetCommand extends SheetSelection {
  key: CommandKey.ShowSheet;
  show: boolean;
}

/*
export interface CommandBase {

  / **
   * support commands that are not added to any recording or log.
   * this is for things like resizing rows/columns -- we don't necessarily
   * want to transmit every event, and if we don't support ephemeral commands
   * we will wind up working around the exec-command system, which I would
   * like to avoid.
   * /
  ephemeral?: boolean;

}
*/

/**
 * insert a table at the given location
 */
export interface InsertTableCommand {
  key: CommandKey.InsertTable,
  area: IArea,

  /** optionally include a totals row */
  totals?: boolean,

  /** 
   * sortable. defaults to true. you can optionally 
   * disable sorting, if you want.
   */
  sortable?: boolean,

  /**
   * optional theme
   */
  theme?: TableTheme,

}

/**
 * remove the table
 */
export interface RemoveTableCommand {
  key: CommandKey.RemoveTable,
  table: Table,
}

/**
 * sort a table. sorts are hard, meaning we actually move data around.
 * use copy/paste semantics for handling relative references (seems strange
 * to me, but hey).
 */
export interface SortTableCommand {
  key: CommandKey.SortTable,
  table: Table,
  column: number,
  asc: boolean;
  type: TableSortType,
}

/**
 * resize row(s). undefined means "all rows". undefined height
 * means "auto size".
 * 
 * UPDATE: shrink is a flag you can set to prevent shrinking rows
 * when (and only when) auto-sizing, i.e. height is undefined
 */
export interface ResizeRowsCommand {
  key: CommandKey.ResizeRows;
  row?: number|number[];
  height?: number;
  shrink?: boolean;
  sheet_id?: number;
}

/**
 * resize columns(s). undefined means "all columns". undefined
 * width means "auto size".
 */
export interface ResizeColumnsCommand {
  key: CommandKey.ResizeColumns;
  column?: number|number[];
  width?: number;
  sheet_id?: number;
}

/** insert one or more rows at the given insert point */
export interface InsertRowsCommand {
  key: CommandKey.InsertRows;
  before_row: number;
  count: number;
  sheet_id?: number;
}

/** insert one or more columns at the given insert point */
export interface InsertColumnsCommand {
  key: CommandKey.InsertColumns;
  before_column: number;
  count: number;
  sheet_id?: number;
}

/** show or hide headers */
export interface ShowHeadersCommand {
  key: CommandKey.ShowHeaders;
  show: boolean;
}

/** 
 * set or clear name (omit range to clear)
 *  
 * adding support for named expressions. you can pass either a range or
 * an expression. 
 * 
 * if you use the same name more than once, it will overwrite the old name,
 * even if you change types range/expression.
 * 
 * passing neither will cause it to erase any existing named range OR named 
 * expression. 
 * 
 */
export interface SetNameCommand {
  key: CommandKey.SetName;
  name: string;
  area?: IArea;
  expression?: ExpressionUnit;
  scope?: number;
}

export interface DataValidationCommand {
  key: CommandKey.DataValidation;
  area: IArea;

  range?: IArea;
  list?: CellValue[];
  error?: boolean;
}

/**
 * not sure if we should be serializing selections...
 * we need some indication of primary/alternative
 */
export interface SelectCommand {
  key: CommandKey.Select;

  /** missing area implies clear selection (-> no selection) */
  area?: IArea;

  /** missing target will set target as first cell of area */
  target?: ICellAddress;
}

/** set data in cell or area */
export interface SetRangeCommand {
  key: CommandKey.SetRange;
  area: IArea|ICellAddress;

  /** set as array (usually control-enter) */
  array?: boolean;

  /** 
   * support R1C1 notation, which can come from API only (atm). this 
   * flag does not mean the notation _is_ R1C1, just that we need to
   * check for it and handle it if found.
   */
  r1c1?: boolean;

  /** missing data implies clear cell(s) */
  value?: CellValue|CellValue[][];
}

/** update borders for the given area. this is different than updating
 * style, because borders have slightly different semantics -- when applied
 * to an area, for example, "outside border" means the outside of the total
 * area, not the outside of each cell.
 */
export interface UpdateBordersCommand {
  key: CommandKey.UpdateBorders;
  area: IArea;
  borders: BorderConstants;
  // color?: string; // pending
  color?: Color;

  /** defaults to one. optional for the case of "none" (remove borders) */
  width?: number;
}

export interface IndentCommand {
  key: CommandKey.Indent,
  area: IArea,
  delta: number,
}

/** update style in area. area can be cell(s), sheet, row(s), column(s) */
export interface UpdateStyleCommand {
  key: CommandKey.UpdateStyle;
  area: IArea|ICellAddress;
  style: CellStyle;
  delta?: boolean;
}

/** merge the given cells */
export interface MergeCellsCommand {
  key: CommandKey.MergeCells;
  area: IArea;
}

/**
 * unmerge the given cells. if the passed area doesn't exactly match a
 * merge area, we will look for merge areas inside the larger area and
 * unmerge those (generally useful when working with selections).
 */
export interface UnmergeCellsCommand {
  key: CommandKey.UnmergeCells;
  area: IArea;
}

/** set or clear note at given address. */
export interface SetNoteCommand {
  key: CommandKey.SetNote;
  area: ICellAddress;
  note?: string;
}

export interface SetLinkCommand {
  key: CommandKey.SetLink;
  area: ICellAddress;
  reference?: string;
}

/**
 * clear an area, or the entire sheet.
 * 
 * because this command can omit area (meaning entire sheet), to
 * support remotes we need to add a separate parameter for sheet id.
 * 
 * we could use infinite area as an indication it's a reset, but that's
 * not really the same thing -- that would be more like select all / clear.
 * 
 * not sure why clear doubled as reset, except that it probably dated
 * from before we had multiple sheets. we're now splitting so there's an
 * explicit reset event.
 * 
 * now that we have a separate reset, clear requires an area. 
 * 
 */
export interface ClearCommand {
  key: CommandKey.Clear;
  area: IArea;
  // sheet_id?: number;
}

/**
 * reset everything. 
 */
export interface ResetCommand {
  key: CommandKey.Reset;
}

/**
 * set freeze area. set rows and columns to 0 to unfreeze.
 * highlight defaults to TRUE.
 */
export interface FreezeCommand {
  key: CommandKey.Freeze;
  rows: number;
  columns: number;
  highlight_transition?: boolean;
  sheet_id?: number;
}

/**
 * FIXME: should this command include theme properties, or can we
 * base it on the local theme? (...) probably the former, otherwise
 * you lose synchronization
 * /
export interface UpdateThemeCommand {
  key: CommandKey.UpdateTheme;
}
*/

export interface NullCommand {
  key: CommandKey.Null;
}

export interface AddSheetCommand {
  key: CommandKey.AddSheet;
  insert_index?: number;
  name?: string;
  
  /** switch to the sheet immediately */
  show?: boolean;
}

export interface DuplicateSheetCommand extends SheetSelection {
  key: CommandKey.DuplicateSheet;
  new_name?: string;
  insert_before?: string|number;
}

export interface DeleteSheetCommand extends SheetSelection {
  key: CommandKey.DeleteSheet;
}

/**
 * activate a sheet. there are a couple of options for selecting
 * the sheet, defaulting to index (which defaults to 0) so if you
 * pass no selector it will select index 0.
 */
export interface ActivateSheetCommand extends SheetSelection {
  key: CommandKey.ActivateSheet;

  /** ... */
  tab_bar_event?: boolean;

  force?: boolean;
}

/**
 * rename a sheet. options are like ActivateSheetCommand, except we
 * have to be a little careful about name old/new
 */
export interface RenameSheetCommand extends SheetSelection {
  key: CommandKey.RenameSheet;
  new_name: string; // required
}

/**
 * reorder sheet; move sheet (X) before (Y). if (Y) is larger than the
 * list length, moves to end.
 */
export interface ReorderSheetCommand {
  key: CommandKey.ReorderSheet;
  index: number;
  move_before: number;
}

/**
 * add conditional format
 */
export interface AddConditionalFormatCommand {
  key: CommandKey.AddConditionalFormat;
  format: ConditionalFormat;
}

export interface TabColorCommand {
  key: CommandKey.TabColor;
  sheet: Sheet;
  color?: Color;
}

/**
 * remove conditional format, either as an object or from a target 
 * area. as an object, we'll match using object equivalence and not 
 * identity. 
 */
export interface RemoveConditionalFormatCommand {

  key: CommandKey.RemoveConditionalFormat;

  /** if format is omitted, we will remove all formats from the target range */
  format?: ConditionalFormat;

  /** one of area or format should be supplied */
  area?: IArea; 

}


/**
 * ephemeral flag added to commands.
 * /
export interface Ephemeral {
  ephemeral?: boolean;
}
*/

/**
 * composite command type and ephemeral flag
 */
export type Command =
  ( NullCommand
  | ClearCommand
  | ResetCommand
  | SelectCommand
  | FreezeCommand
  | IndentCommand
  | SetNoteCommand
  | SetLinkCommand
  | SetNameCommand
  | AddSheetCommand
  | SetRangeCommand
  | TabColorCommand
  | SortTableCommand
  | ShowSheetCommand
  | MergeCellsCommand
  | ResizeRowsCommand
  | InsertRowsCommand
  | ShowHeadersCommand
  | DeleteSheetCommand
  | UpdateStyleCommand
  | InsertTableCommand
  | RemoveTableCommand
  | RenameSheetCommand
  | ReorderSheetCommand
  | UnmergeCellsCommand
  | ResizeColumnsCommand
  | InsertColumnsCommand
  | UpdateBordersCommand
  | ActivateSheetCommand
  | DataValidationCommand
  | DuplicateSheetCommand
  | CreateAnnotationCommand
  | AddConditionalFormatCommand
  | RemoveConditionalFormatCommand
  ) ; // & Ephemeral;

/**
 * record type for recording/logging commands
 */
export interface CommandRecord {
  command: Command[];
  timestamp: number;
}
