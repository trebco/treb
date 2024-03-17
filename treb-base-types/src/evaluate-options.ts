
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
