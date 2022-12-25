
import type { IArea } from './area';

export type TableSortType = 'text'|'numeric';

export interface TableSortOptions {

  /** 
   * when sorting, column is relative to the table (and 0-based). so the 
   * first column in the table is 0, regardless of where the table is in 
   * the spreadsheet. defaults to 0, if not specified.
   */
  column: number; 

  /** sort type. defaults to 'text'. */
  type: TableSortType;

  /** ascending sort. defaults to true. */
  asc: boolean;

}

export const DefaultTableSortOptions: TableSortOptions = {
  column: 0,
  type: 'text',
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

  /**
   * column names. these are the same (icase) as text in the first row
   */

  /** table area */
  area: IArea;

  /** 
   * table column headers. normalize case before inserting.
   */
  columns?: string[];

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

