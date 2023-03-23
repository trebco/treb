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


import type { IArea } from './area';
import type { TableTheme } from './theme';

export type TableSortType = 'text'|'numeric'|'auto';

export interface TableSortOptions {

  /** 
   * when sorting, column is relative to the table (and 0-based). so the 
   * first column in the table is 0, regardless of where the table is in 
   * the spreadsheet. defaults to 0, if not specified.
   */
  column: number; 

  /** 
   * sort type. defaults to 'auto'. 'auto' looks at the values in the column,
   * and uses text sort if there are more strings, or numeric if there are 
   * more numbers. if it's even, sorts as text.
   */
  type: TableSortType;

  /** ascending sort. defaults to true. */
  asc: boolean;

}

/** @internal */
export const DefaultTableSortOptions: TableSortOptions = {
  column: 0,
  type: 'auto',
  asc: true,
};

/**
 * struct representing a table
 */
export interface Table {

  /** 
   * table must have a name
   */
  name: string;

  /** table area */
  area: IArea;

  /** 
   * table column headers. normalize case before inserting.
   */
  columns?: string[];

  /**
   * table has a totals row. this impacts layout and what's included
   * in the range when you refer to a column. also on import/export, the
   * AutoFilter element should exclude the totals row.
   * 
   * NOTE: xlsx actually uses an integer for this -- can it be > 1?
   */
  totals_row?: boolean;

  /** 
   * table is sortable. defaults to true. if false, disables UI sorting. 
   */
  sortable?: boolean;

  /**
   * theme for table. we have a default, but you can set explicitly.
   */
  theme?: TableTheme;

  /** 
   * sort data. sorts are hard, meaning we actually move data around. 
   * (not meaning difficult). we may keep track of the last sort so we 
   * can toggle asc/desc, for example. atm this will not survive serialization.
   */
  sort?: {
    column: number;
    type: TableSortType;
    asc: boolean;
  }

}

