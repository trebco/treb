
import { ICellAddress, IArea, Style, CellValue } from 'treb-base-types';
import { BorderConstants } from './border_constants';
import { Sheet } from './sheet';

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
  MergeCells,
  UnmergeCells,
  Clear,
  UpdateTheme,
  SetNote,
  Freeze,
  SetName,
  ShowHeaders,
  AddSheet,
  DeleteSheet,
  ActivateSheet,
  RenameSheet,
  ReorderSheet,
  ShowSheet,
  DataValidation,
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
 * resize row(s). undefined means "all rows". undefined height
 * means "auto size".
 */
export interface ResizeRowsCommand {
  key: CommandKey.ResizeRows;
  row?: number|number[];
  height?: number;
}

/**
 * resize columns(s). undefined means "all columns". undefined
 * width means "auto size".
 */
export interface ResizeColumnsCommand {
  key: CommandKey.ResizeColumns;
  column?: number|number[];
  width?: number;
}

/** insert one or more rows at the given insert point */
export interface InsertRowsCommand {
  key: CommandKey.InsertRows;
  before_row: number;
  count: number;
}

/** insert one or more columns at the given insert point */
export interface InsertColumnsCommand {
  key: CommandKey.InsertColumns;
  before_column: number;
  count: number;
}

/** show or hide headers */
export interface ShowHeadersCommand {
  key: CommandKey.ShowHeaders;
  show: boolean;
}

/** set or clear name (omit range to clear) */
export interface SetNameCommand {
  key: CommandKey.SetName;
  name: string;
  area?: IArea;
}

export interface DataValidationCommand {
  key: CommandKey.DataValidation;
  target: ICellAddress;
  range?: IArea;
  list?: CellValue[];
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

  /** missing data implies clear cell(s) */
  value?: any;
}

/** update borders for the given area. this is different than updating
 * style, because borders have slightly different semantics -- when applied
 * to an area, for example, "outside border" means the outside if the total
 * area, not the outside of each cell.
 */
export interface UpdateBordersCommand {
  key: CommandKey.UpdateBorders;
  area: IArea;
  borders: BorderConstants;
  color?: string; // pending

  /** defaults to one. optional for the case of "none" (remove borders) */
  width?: number;
}

/** update style in area. area can be cell(s), sheet, row(s), column(s) */
export interface UpdateStyleCommand {
  key: CommandKey.UpdateStyle;
  area: IArea|ICellAddress;
  style: Style.Properties;
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
  address: ICellAddress;
  note?: string;
}

/**
 * clear an area, or the entire sheet
 */
export interface ClearCommand {
  key: CommandKey.Clear;
  area?: IArea;
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
}

/**
 * FIXME: should this command include theme properties, or can we
 * base it on the local theme? (...) probably the former, otherwise
 * you lose synchronization
 */
export interface UpdateThemeCommand {
  key: CommandKey.UpdateTheme;
}

export interface NullCommand {
  key: CommandKey.Null;
}

export interface AddSheetCommand {
  key: CommandKey.AddSheet;
  insert_index?: number;
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
 * ephemeral flag added to commands.
 */
export interface Ephemeral {
  ephemeral?: boolean;
}

/**
 * composite command type and ephemeral flag
 */
export type Command =
  ( NullCommand
  | ClearCommand
  | SelectCommand
  | FreezeCommand
  | SetNoteCommand
  | SetNameCommand
  | AddSheetCommand
  | SetRangeCommand
  | ShowSheetCommand
  | MergeCellsCommand
  | ResizeRowsCommand
  | InsertRowsCommand
  | ShowHeadersCommand
  | DeleteSheetCommand
  | UpdateStyleCommand
  | RenameSheetCommand
  | ReorderSheetCommand
  | UnmergeCellsCommand
  | ResizeColumnsCommand
  | InsertColumnsCommand
  | UpdateBordersCommand
  | ActivateSheetCommand
  | DataValidationCommand
  ) & Ephemeral;

/**
 * record type for recording/logging commands
 */
export interface CommandRecord {
  command: Command[];
  timestamp: number;
}
