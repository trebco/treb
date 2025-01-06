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

import type { CellValue, IArea, CellStyle } from 'treb-base-types';


/**
 * this is a structure for copy/paste data. clipboard data may include 
 * relative formauls and resolved styles, so it's suitable for pasting into 
 * other areas of the spreadsheet.
 * 
 * @privateRemarks
 * work in progress. atm we're not using the system clipboard, although it 
 * might be useful to merge this with grid copy/paste routines in the future.
 * 
 * if it hits the clipboard this should use mime type `application/x-treb-data`
 * 
 */
export interface ClipboardDataElement {

  /** calculated cell value */
  calculated: CellValue,

  /** the actual cell value or formula */
  value: CellValue,

  /** cell style. this may include row/column styles from the copy source */
  style?: CellStyle,

  /** area. if this cell is part of an array, this is the array range */
  area?: IArea,

  /* TODO: merge, like area */

  /* TODO: table */

}

/** clipboard data is a 2d array */
export type ClipboardData = ClipboardDataElement[][];

/** 
 * optional paste options. we can paste formulas or values, and we 
 * can use the source style, target style, or just use the source
 * number formats.
 */
export interface PasteOptions {

  /**
   * when clipboard data includes formulas, optionally paste calculated
   * values instead of the original formulas. defaults to false.
   */
  values?: boolean;

  /** 
   * when pasting data from the clipboard, we can copy formatting/style 
   * from the original data, or we can retain the target range formatting
   * and just paste data. a third option allows pasting source number 
   * formats but dropping other style information.
   * 
   * defaults to "source", meaning paste source styles.
   */

  formatting?: 'source'|'target'|'number-formats'

}

