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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import type { IArea, SerializedCellData, Style } from 'treb-base-types';
import type { Annotation } from './annotation';
import type { GridSelection } from './grid_selection';

export interface UpdateHints {
  data?: boolean;
  layout?: boolean;
  style?: boolean;
  annotations?: boolean;
  freeze?: boolean;
  names?: boolean;
}

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
  // data: any; // FIXME
  data: SerializedCellData;

  sheet_style: Style.Properties;
  rows: number;
  columns: number;
  cell_styles: Array<{row: number; column: number; ref: number, rows?: number}>;

  /** @deprecated */
  cell_style_refs?: Style.Properties[]; // old 
  styles?: Style.Properties[];          // new

  // row_style: Style.Properties[];
  // column_style: Style.Properties[];
  // row_style: Array<Style.Properties|number>;
  // column_style: Array<Style.Properties|number>;
  row_style: Record<number, Style.Properties|number>;
  column_style: Record<number, Style.Properties|number>;

  row_pattern?: Style.Properties[];

  default_row_height?: number;
  default_column_width?: number;

  row_height?: {[index: number]: number};
  column_width?: {[index: number]: number};
  named_ranges?: {[index: string]: IArea};
  freeze?: FreezePane;

  id?: number;
  name?: string;

  selection: GridSelection;
  annotations?: Partial<Annotation>[];
  scroll?: ScrollOffset;

  visible?: boolean;

}

/**
 * support for legacy sheet data
 * (I think we can drop)
 */
export type LegacySerializedSheet = SerializedSheet & { primary_selection?: GridSelection }
