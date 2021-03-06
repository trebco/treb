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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import type { RenderFunction, ClickFunction, UnionValue } from 'treb-base-types';

// FIXME: at least some of this could move to base types

export enum ReturnType {
  value, reference
}

/**
 * descriptor for an individual argument
 */
export interface ArgumentDescriptor {

  name?: string;
  description?: string;
  default?: any;

  // moved from function arrays:

  /**
   * allows error values to propagate. otherwise, a function will
   * return an #ARG error if any arguments contain errors. used for
   * IsError and IfError, atm.
   * 
   * UPDATE: also used in IF.
   */
  allow_error?: boolean;

  /**
   * this argument (reference) should be treated as an address, not resolved.
   * it's used for identifying multivariate groups.
   *
   * UPDATE: this is used in reference + lookup functions (Offset, specifically)
   * so don't move to MC lib.
   */
  address?: boolean;

  /**
   * require the argument to be a union
   */
  boxed?: boolean;

  /**
   * similar to collector, this flag will return metadata about the cell
   *
   * supported in annotations only, not spreadsheet cells (atm)
   *
   * returns cell data type defined in chart (FIXME: move)
   */
  metadata?: boolean;

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
   * FIXME: we need to unify type with what's in the cell class
   */
  render?: RenderFunction; // (options: any) => boolean;

  click?: ClickFunction; // (options: any) => {value?: any };

  /**
   * the actual function. if this is an object member and needs access
   * to the containing instance, make sure to bind it to that instance.
   */
  fn: (...args: any[]) => UnionValue; // UnionOrArray; // |UnitAddress|UnitRange;

  /**
   * for the future. some functions should not be available in
   * spreadsheet cells (charts, basically)
   */
  visibility?: string;

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
   * support returning references
   */
  return_type?: ReturnType;

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
