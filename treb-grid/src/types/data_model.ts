
import { Sheet } from './sheet';
import { SerializedSheet } from './sheet_types';
import { NamedRangeCollection } from './named_range';
import { ExpressionUnit } from 'treb-parser';

export interface MacroFunction {
  name: string;
  function_def: string;
  argument_names?: string[];
  // argument_default_values?: any[]; // <- new
  description?: string;
  expression?: ExpressionUnit;
}

export interface MacroFunctionMap {
  [index: string]: MacroFunction;
}

/**
 * FIXME: this should move out of the grid module, grid should be focused on view
 */
export interface DataModel {

  /** document metadata */
  document_name?: string;

  /** document metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_data?: any;

  /** reference */
  active_sheet: Sheet;

  /** 
   * list of sheets. we _should_ index these by ID, so we 
   * don't have to look up. FIXME/TODO
   */
  sheets: Sheet[];

  /** named ranges are document-scope, we don't support sheet-scope names */
  named_ranges: NamedRangeCollection;

  /** macro functions are functions written in spreadsheet language */
  macro_functions: MacroFunctionMap;

}

export interface SerializedModel {
  sheet_data: SerializedSheet[];
  active_sheet: number;
  named_ranges?: any;
  macro_functions?: MacroFunction[];
  decimal_mark?: ','|'.';
}
