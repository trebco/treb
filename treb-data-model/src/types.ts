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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */


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

  // has this been superceded by TREBDocument?
  // I can't tell why we're still using this.

  // ...

  // it seems like TREBDocument was a replacment,
  // but it has some required fields that this type
  // doesn't have. 

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

