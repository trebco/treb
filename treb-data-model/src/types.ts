
import type { SerializedSheet } from './sheet_types';
import type { Sheet } from './sheet';
import type { IArea } from 'treb-base-types';
import type { SerializedNamed } from './named';
import type { Table } from 'treb-base-types';
import type { ExpressionUnit } from 'treb-parser';

export interface ConnectedElementType {
  formula: string;
  update?: (instance: ConnectedElementType) => void;
  internal?: unknown; // opaque type to prevent circular dependencies
}

export interface SerializedMacroFunction {
  name: string;
  function_def: string;
  argument_names?: string[];
  description?: string;
}

/**
 * we define this as extending the serialized version, rather
 * than taking out the parameter, so we can make that def public
 * in the API types.
 */
export interface MacroFunction extends SerializedMacroFunction {
  expression?: ExpressionUnit;
}

/**
 * @internal
 */
export interface ViewModel {
  active_sheet: Sheet;
  view_index: number;
}

/** 
 * this type is no longer in use, but we retain it to parse old documents
 * that use it. 
 * 
 * @deprecated
 */
export interface SerializedNamedExpression {
  name: string;
  expression: string;
}

export interface SerializedModel {
  sheet_data: SerializedSheet[];
  active_sheet: number;

  /** @deprecated */
  named_ranges?: Record<string, IArea>;

  /** @deprecated */
  named_expressions?: SerializedNamedExpression[];

  /** 
   * new type for consolidated named ranges & expressions. the old
   * types are retained for backwards compatibility on import but we won't 
   * export them anymore.
   */
  named?: SerializedNamed[];

  macro_functions?: MacroFunction[];
  tables?: Table[];
  decimal_mark?: ','|'.';
}

