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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import type { Style } from './style';
import type { ValueType } from './value-type';
import type { IArea } from './area';
import type { AnnotationLayout } from './layout';
import type { DataValidation } from './cell';

export interface CellParseResult {
  row: number,
  column: number,
  type: ValueType,
  value: number|string|undefined|boolean,
  calculated?: number|string|undefined|boolean,
  calculated_type?: ValueType,
  style_ref?: number,
  hyperlink?: string,
  validation?: DataValidation,
  merge_area?: IArea,
  area?: IArea,
}

export interface AnchoredAnnotation {
  layout: AnnotationLayout;
  type?: string;
  formula?: string;
}

/**
 * this is moved from export to avoid a circular reference
 */
export interface ImportedSheetData {
  name: string|undefined;
  cells: CellParseResult[];
  default_column_width: number;
  column_widths: number[];
  row_heights: number[];
  styles: Style.Properties[];

  // optional, for backcompat
  sheet_style?: number;
  column_styles?: number[];

  // new
  annotations?: AnchoredAnnotation[];

  hidden?: boolean;

}

