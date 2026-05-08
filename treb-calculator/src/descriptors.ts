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

import type { RenderFunction, ClickFunction, UnionValue, ICellAddress, IArea, FunctionUnion } from 'treb-base-types';
import type { ExpressionUnit } from 'treb-parser';

/**
 * FIXME: possible to add stuff in here if we need it
 */
export interface FunctionContext {
  address: ICellAddress;
  area?: IArea;

  /** application function for fp functions */
  apply?: (fn: FunctionUnion, args: UnionValue[]) => UnionValue;
}

// FIXME: at least some of this could move to base types

/*
export enum ReturnType {
  value, reference
}
*/

/**
 * descriptor for an individual argument
 */
export interface ArgumentDescriptor {

  /** used in tooltips and function descriptions */
  name?: string;

  /** used in tooltips and function descriptions */
  description?: string;

  /** default value in tooltips and function descriptions. this has
   * no effect on the actual function. if you need a default value in
   * the function, use a default argument in the typescript declaration
   * (i.e. the normal way you'd set a default argument)
   */
  default?: number|string|boolean;

  /** @internal TODO: rename */
  passthrough?: boolean;

  /**
   * allows error values to propagate. otherwise, a function will
   * return an #ARG error if any arguments contain errors. used in
   * functions like IsError and IfError.
   */
  allow_error?: boolean;

  /**
   * this argument (reference) should be treated as an address, not resolved.
   * used in reference + lookup functions like Offset
   */
  address?: boolean;

  /**
   * require the argument to be a union
   */
  boxed?: boolean;

  /** 
   * this argument repeasts. this has no impact on the function descriptor
   * but it's useful to know for clients. 
   */
  repeat?: boolean;

  /**
   * argument will return metadata about the cell
   */
  metadata?: boolean;

  /**
   * automate array application. set this flag to allow unrolling of array 
   * parameters. "unrolling" means if you call a function with an array
   * parameter, the function will be called once for each value in the array,
   * and will return an array.
   * 
   * if this flag is set in any argument descriptor in a function, we'll
   * apply arrays. that's done when the function is installed. 
   * 
   * FIXME: this should maybe be the default, and we have an !unroll flag
   */
  unroll?: boolean;

}

/**
 * @internal
 */
export interface ContextResult {

  context: Record<string, ExpressionUnit>;

  /**
   * rewrite args
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];

  /** possibly rewrite argument descriptors, not required */
  argument_descriptors?: ArgumentDescriptor[];

}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionImplementation = (this: FunctionContext|undefined, ...args: any[]) => UnionValue; 

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
   * FIXME: we need to unify type with what's in the cell class
   */
  render?: RenderFunction; // (options: any) => boolean;

  click?: ClickFunction; // (options: any) => {value?: any };

  /**
   * the actual function. if this is an object member and needs access
   * to the containing instance, make sure to bind it to that instance.
   * 
   * otherwise, `this` will be bound to a `CalculationContext` object
   * if your function is defined as a function (i.e. not an arrow function).
   * 
   */
  fn: FunctionImplementation; 

  /**
   * limited visibility
   * 
   * internal functions do not show up in the spreadsheet. we have an 
   * annotation value which should be usef in the future but it's not 
   * implemented yet.
   * 
   * should we allow these functions to be used, and just not tooltip them;
   * or block them entirely? for now we'll do the former as it's helpful to 
   * defug.
   */
  visibility?: 'internal'|'annotation';

  /**
   * for the future
   */
  category?: string[];

  /*
   * if we want to collapse imports (convert functions -> literal calculated 
   * values) this flag indicates which functions should be converted. we could
   * theoretically use the category flag but that could be fuzzy, so we will
   * have an explicit flag. applies only to the MC functions atm.
   */
  extension?: boolean;

  /**
   * there is some set of functions that need an "_xlfn." prefix on export.
   * I'm not sure why or where the list comes from, but we want to flag
   * those functions so we can export them properly.
   */
  xlfn?: boolean;

  /**
   * support returning references. 'value' is default. FIXME: could just be a bool?
   */
  return_type?: 'reference'|'value';

  /**
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export?: (...args: any[]) => string;

  /**
   * pass through UI functions, if possible. this is for lambda and let; we
   * want to pass through sparklines, if a sparkline is the first function call
   * 
   * @internal
   */
  pass_through_ui?: 'direct' | 'indirect';

  /**
   * flag indicating we've unrolled this function. it's possible functions
   * will run through the registration process more than once and we don't
   * want to have extra depth.
   * 
   * @internal
   */
  unrolled?: boolean;

  /**
   * this is new: custom binding context for lambda functions (lambda, let, 
   * and maybe others?) still working out the semantics of this.
   * 
   * @internal
   */
  create_binding_context?: (context: {
    args: ExpressionUnit[];
    descriptors: ArgumentDescriptor[];
  }) => ContextResult | undefined;

  /** flag indicating this function needs fp support */
  fp?: boolean;

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

export type IntrinsicValue = number|string|boolean|undefined;
