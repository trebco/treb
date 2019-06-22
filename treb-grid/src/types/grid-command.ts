
import { ICellAddress, IArea, Style } from 'treb-base-types';
import { BorderConstants } from './border_constants';

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
  ShowHeaders,

}

export interface CommandBase {

  /**
   * support commands that are not added to any recording or log.
   * this is for things like resizing rows/columns -- we don't necessarily
   * want to transmit every event, and if we don't support ephemeral commands
   * we will wind up working around the exec-command system, which I would
   * like to avoid.
   */
  ephemeral?: boolean;

}

/**
 * resize row(s). undefined means "all rows". undefined height
 * means "auto size".
 */
export interface ResizeRowsCommand extends CommandBase {
  key: CommandKey.ResizeRows;
  row?: number|number[];
  height?: number;
}

/**
 * resize columns(s). undefined means "all columns". undefined
 * width means "auto size".
 */
export interface ResizeColumnsCommand extends CommandBase {
  key: CommandKey.ResizeColumns;
  column?: number|number[];
  width?: number;
}

/** insert one or more rows at the given insert point */
export interface InsertRowsCommand extends CommandBase {
  key: CommandKey.InsertRows;
  before_row: number;
  count: number;
}

/** insert one or more columns at the given insert point */
export interface InsertColumnsCommand extends CommandBase {
  key: CommandKey.InsertColumns;
  before_column: number;
  count: number;
}

/** show or hide headers */
export interface ShowHeadersCommand extends CommandBase {
  key: CommandKey.ShowHeaders;
  show: boolean;
}

/**
 * not sure if we should be serializing selections...
 * we need some indication of primary/alternative
 */
export interface SelectCommand extends CommandBase {
  key: CommandKey.Select;

  /** missing area implies clear selection (-> no selection) */
  area?: IArea;

  /** missing target will set target as first cell of area */
  target?: ICellAddress;
}

/** set data in cell or area */
export interface SetRangeCommand extends CommandBase {
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
export interface UpdateBordersCommand extends CommandBase {
  key: CommandKey.UpdateBorders;
  area: IArea;
  borders: BorderConstants;
  color?: string; // pending

  /** defaults to one. optional for the case of "none" (remove borders) */
  width?: number;
}

/** update style in area. area can be cell(s), sheet, row(s), column(s) */
export interface UpdateStyleCommand extends CommandBase {
  key: CommandKey.UpdateStyle;
  area: IArea|ICellAddress;
  style: Style.Properties;
  delta?: boolean;
}

/** merge the given cells */
export interface MergeCellsCommand extends CommandBase {
  key: CommandKey.MergeCells;
  area: IArea;
}

/**
 * unmerge the given cells. if the passed area doesn't exactly match a
 * merge area, we will look for merge areas inside the larger area and
 * unmerge those (generally useful when working with selections).
 */
export interface UnmergeCellsCommand extends CommandBase {
  key: CommandKey.UnmergeCells;
  area: IArea;
}

/** set or clear note at given address. */
export interface SetNoteCommand extends CommandBase {
  key: CommandKey.SetNote;
  address: ICellAddress;
  note?: string;
}

/**
 * clear an area, or the entire sheet
 */
export interface ClearCommand extends CommandBase {
  key: CommandKey.Clear;
  area?: IArea;
}

/**
 * set freeze area. set rows and columns to 0 to unfreeze.
 * highlight defaults to TRUE.
 */
export interface FreezeCommand extends CommandBase {
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
export interface UpdateThemeCommand extends CommandBase {
  key: CommandKey.UpdateTheme;
}

export interface NullCommand extends CommandBase {
  key: CommandKey.Null;
}

export type Command
  = NullCommand
  | ClearCommand
  | SelectCommand
  | FreezeCommand
  | SetNoteCommand
  | SetRangeCommand
  | MergeCellsCommand
  | ResizeRowsCommand
  | InsertRowsCommand
  | UpdateStyleCommand
  | UnmergeCellsCommand
  | ResizeColumnsCommand
  | ShowHeadersCommand
  | InsertColumnsCommand
  | UpdateBordersCommand
  ;

