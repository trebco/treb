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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */


/**
 * options for the SetRange method
 */
export interface SetRangeOptions {

  /** transpose rectangular array before inserting */
  transpose?: boolean;

  /** recycle values (R-style) */
  recycle?: boolean;

  /** apply as an array (as if you pressed ctrl+shift+enter) */
  array?: boolean;

  /** spill over */
  spill?: boolean;

  /**
   * argument separator to use when parsing the input formula. by default,
   * parsing uses the current locale. that is not optimal, because you 
   * do not necessarily know ahead of time where a spreadsheet may be viewed.
   * 
   * set this option to call SetRange with a consistent argument separator.
   * the decimal separator is implied; if the argument separator is set to
   * comma (',') the decimal mark will be a dot ('.'); and if the argument 
   * separator is set to semicolon (';') the decimal mark will be set to 
   * comma (','). you cannot mix and match these values.
   * 
   * @see EvaluateOptions for more discussion of this option.
   */
  argument_separator?: ','|';';

  /** 
   * allow R1C1-style references; these can be either 
   * direct (e.g. R2C4) or offset (e.g. R[-3]C[0]).
   */
  r1c1?: boolean;

}
