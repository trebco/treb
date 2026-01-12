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


import type { ExpressionUnit } from 'treb-parser';
import type { ICellAddress } from './area';

/**
 * options for the evaluate function
 */
export interface EvaluateOptions {

  /**
   * argument separator to use when parsing input. set this option to 
   * use a consistent argument separator independent of current locale.
   */
  argument_separator?: ','|';';

  /** 
   * allow R1C1-style references. the Evaluate function cannot use
   * relative references (e.g. R[-1]C[0]), so those will always fail. 
   * however it may be useful to use direct R1C1 references (e.g. R3C4),
   * so we optionally support that behind this flag.
   */
  r1c1?: boolean;
 
  /** 
   * @internal
   * 
   * @privateRemarks
   * in some cases we may call this method after parsing an expression.
   * we don't need the evaluate method to parse it again.
   */
  preparsed?: ExpressionUnit;

  /** 
   * @internal
   * 
   * @privateRemarks
   * we also might want to pass the address of the expression, if (or as if)
   * it was originally in the spreadsheet.
   */
  address?: ICellAddress;

}
