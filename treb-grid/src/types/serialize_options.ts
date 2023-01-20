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

/**
 * options for serializing data
 * 
 * @privateRemarks
 * essentially a placeholder for options; we only have one at the moment.
 *
 * note that the underlying cells container has its own set of options. we
 * are explicitly not using that so we can add things that are beyond that
 * scope.
 *
 * still, we might just wrap that object [FIXME/TODO].
 */
export interface SerializeOptions {

  /** optimize for size */
  optimize?: 'size'|'speed';

  /** include the rendered/calculated value in export */
  rendered_values?: boolean;

  /** 
   * preserve cell type
   * @internal
   */
  preserve_type?: boolean;

  /** 
   * expand arrays so cells have individual values
   * @internal
   */
  expand_arrays?: boolean;

  /** translate colors to xlsx-friendly values */
  export_colors?: boolean;

  /** export cells that have no value, but have a border or background color */
  decorated_cells?: boolean;

  /** prune unused rows/columns */
  shrink?: boolean;

  /** 
   * include tables. tables will be serialized in the model, so we can
   * drop them from cells. but you can leave them in if that's useful.
   */
  tables?: boolean;

}
