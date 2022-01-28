
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

  /** include the rendered/calculated value in export */
  rendered_values?: boolean;

  /** 
   * for simulation 
   * @mc
   */
  preserve_type?: boolean;

  /** 
   * for simulation 
   * @mc
   */
   expand_arrays?: boolean;

  /** translate colors to xlsx-friendly values */
  export_colors?: boolean;

  /** export cells that have no value, but have a border or background color */
  decorated_cells?: boolean;

  /** prune unused rows/columns */
  shrink?: boolean;

}
