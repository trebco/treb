
// FIXME: at least some of this could move to base types

/**
 * descriptor for an individual argument
 */
export interface ArgumentDescriptor {

  name?: string;
  description?: string;
  default?: any;

  // moved from function arrays:

  collector?: boolean;
  address?: boolean;
  metadata?: boolean;
  allow_error?: boolean;

  // new (in progress)

  dynamic_dependency?: boolean;

}

/**
 * merging the old function descriptor and decorated function types, since
 * there's a good deal of overlap and we spend a lot of effort keeping them
 * in sync.
 *
 * this is a wrapper object that contains the function and (mostly optional)
 * metadata.
 */
export interface CompositeFunctionDescriptor {

  /**
   * description for the function wizard
   */
  description?: string;

  /**
   * list of arguments, for the function wizard and tooltip
   */
  arguments?: ArgumentDescriptor[];

  /**
   * volatile: value changes on every recalc, even if dependencies
   * don't change
   */
  volatile?: boolean;

  /**
   * volatile during a simulation only
   * FIXME: MC calculator only
   */
  simulation_volatile?: boolean;

  /**
   * collect results for the given argument (should be a reference)
   * FIXME: MC calculator only
   */
  // collector?: number[]; // moved to argument descriptor

  /**
   * allows error values to propagate. otherwise, a function will
   * return an #ARG error if any arguments contain errors. used for
   * IsError and IfError, atm
   */
  // allow_error?: number[]; // moved to argument descriptor

  /**
   * the given argument (reference) should be treated as an address,
   * not resolved. this allows us to support IsError and related functions,
   * otherwise they would return #ARG errors
   */
  // address?: number[]; // moved to argument descriptor

  /**
   * the actual function. if this is an object member and needs access
   * to the containing instance, make sure to bind it to that instance.
   */
  fn: (...args: any[]) => any;

  /**
   * similar to collector, this flag will return metadata about the cell
   * argument: address, value, number format, simulation data, (...)
   *
   * supported in annotations only, not spreadsheet cells (atm)
   *
   * returns cell data type defined in chart (FIXME: move)
   *
   * {
   *   address,
   *   value: calculated value,
   *   simulation_data: [],
   *   format: number format
   * }
   *
   */
  // metadata?: number[]; // moved to argument descriptor

  /**
   * for the future. some functions should not be available in 
   * spreadsheet cells (charts, basically)
   */
  visibility?: string;

  /** for the future */
  category?: string[];

}

export interface FunctionMap {
  [index: string]: CompositeFunctionDescriptor;
}

/**
 * the stored value also includes a canonical name. this used to be separate
 * from the registered name (because those were functions, and had to adhere
 * to language rules) but now we use arbitrary tokens, so we can consolidate.
 */
export interface ExtendedFunctionDescriptor extends CompositeFunctionDescriptor {
  canonical_name: string;
}

export interface ExtendedFunctionMap {
  [index: string]: ExtendedFunctionDescriptor;
}
