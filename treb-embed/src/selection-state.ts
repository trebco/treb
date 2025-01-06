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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */


import type { GridSelection } from 'treb-data-model';
import type { CellStyle } from 'treb-base-types';

/**
 * state that should be reflected in toolbar buttons/selections
 */
export interface SelectionState {
  style?: CellStyle;
  merge?: boolean;
  table?: boolean;
  frozen?: boolean;
  empty?: boolean;
  comment?: string;
  selection?: GridSelection;
  relative_font_size?: number;
}
