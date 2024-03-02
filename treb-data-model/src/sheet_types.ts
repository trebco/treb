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

import type { IArea, SerializedCellData, CellStyle } from 'treb-base-types';
import type { AnnotationData } from './annotation';
import type { GridSelection, SerializedGridSelection } from './sheet_selection';
import type { ConditionalFormatList } from './conditional_format';
import type { DataValidation } from './data-validation';

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

export interface CellStyleRecord {
  row: number;
  column: number;
  ref: number;
  rows?: number;
}

export interface SerializedSheet {

  /** cell data */
  data: SerializedCellData;

  /** top-level sheet style, if any */
  sheet_style: CellStyle;

  /** row count */
  rows: number;

  /** column count */
  columns: number;

  /**
   * cell styles is for empty cells that have styling
   */
  cell_styles: CellStyleRecord[]; // Array<{row: number; column: number; ref: number, rows?: number}>;

  /** @internal */
  conditional_formats?: ConditionalFormatList;

  /** @internal */
  data_validations?: DataValidation[];

  /** 
   * @deprecated use `styles` instead
   */
  cell_style_refs?: CellStyle[]; // old 

  /** 
   * new implementation 
   */
  styles?: CellStyle[];

  /**
   * per-row styles
   */
  row_style: Record<number, CellStyle|number>;

  /**
   * per-column styles
   */
  column_style: Record<number, CellStyle|number>;

  /** 
   * @deprecated no one uses this anymore and it's weird 
   */
  row_pattern?: CellStyle[];

  /** default for new rows */
  default_row_height?: number;

  /** default for new columns */
  default_column_width?: number;

  /** list of row heights. we use a Record instead of an array because it's sparse */
  row_height?: Record<number, number>;

  /** list of column widths. we use a Record instead of an array because it's sparse */
  column_width?: Record<number, number>;

  /** 
   * @deprecated these were moved to the containing document
   */
  named_ranges?: Record<string, IArea>;

  freeze?: FreezePane;

  /** sheet ID, for serializing references */
  id?: number;

  /** sheet name */
  name?: string;

  /** current active selection */
  selection: SerializedGridSelection;

  /**  */
  annotations?: Partial<AnnotationData>[]; // Partial<Annotation>[];

  /** current scroll position */
  scroll?: ScrollOffset;

  /** visible flag. we only support visible/hidden */
  visible?: boolean;

  /** testing */
  background_image?: string;

}

/**
 * support for legacy sheet data
 * (I think we can drop)
 * 
 * @internal
 * @deprecated
 */
export type LegacySerializedSheet = SerializedSheet & { primary_selection?: GridSelection }
