
import { Area, IArea, Style } from 'treb-base-types';
import { GridSelection } from './grid_selection';

export interface UpdateHints {
  data?: boolean;
  layout?: boolean;
  style?: boolean;
  annotations?: boolean;
  freeze?: boolean;
  names?: boolean;
}

export interface DataEvent {
  type: 'data';
  area?: Area;
}

export interface FlushEvent {
  type: 'flush';
}

export interface StyleEvent {
  type: 'style';
  area?: Area;
}

export type SheetEvent
  = DataEvent
  | StyleEvent
  | FlushEvent
  ;

export interface FreezePane {
  rows: number;
  columns: number;
}

export interface ScrollOffset {
  x: number;
  y: number;
}

export interface SerializedSheet {

  // version: string;
  data: any; // FIXME
  sheet_style: Style.Properties;
  rows: number;
  columns: number;
  cell_styles: Array<{row: number, column: number, ref: number}>;

  cell_style_refs: Style.Properties[];
  row_style: Style.Properties[];
  column_style: Style.Properties[];

  default_row_height?: number;
  default_column_width?: number;

  row_height?: {[index: number]: number};
  column_width?: {[index: number]: number};
  named_ranges?: {[index: string]: IArea};
  freeze?: FreezePane;

  id?: number;
  name?: string;

  selection: GridSelection;
  annotations?: any[];
  scroll?: ScrollOffset;

}
