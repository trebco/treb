
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
