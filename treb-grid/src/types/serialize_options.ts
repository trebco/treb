/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
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

}
