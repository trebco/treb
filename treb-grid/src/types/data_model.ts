
import { Sheet } from './sheet';
import { IArea } from 'treb-base-types';
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
  macro_functions: Record<string, MacroFunction>;

  /** 
   * new, for parametric. these might move to a different construct. 
   */
  named_expressions: Record<string, ExpressionUnit>;

}

export interface SerializedNamedExpression {
  name: string;
  expression: string;
}

export interface SerializedModel {
  sheet_data: SerializedSheet[];
  active_sheet: number;
  named_ranges?: Record<string, IArea>;
  macro_functions?: MacroFunction[];
  named_expressions?: SerializedNamedExpression[];
  decimal_mark?: ','|'.';
}
