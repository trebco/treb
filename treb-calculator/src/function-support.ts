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

import type { CompositeFunctionDescriptor } from './descriptors';

/*

const extended_functions: Map<string, CompositeFunctionDescriptor> = new Map();

export function AddExtendedFunction(name: string, descriptor: CompositeFunctionDescriptor) {
  extended_functions.set(name, descriptor);
}

export function GetExtendedFunctions() {
  return extended_functions;
}
*/

import { Calculator } from './calculator';
export function AddExtendedFunction(name: string, descriptor: CompositeFunctionDescriptor) {
  Calculator.AddExtendedFunction(name, descriptor);
}

/**
 * add alias. use this for functions that are identical except for the name.
 * for example we can alias the old function 'GAMMADIST' to the modern function 'GAMMA.DIST'.
 * 
 * aliases will be added _after_ functions so this can be called at any time.
 * 
 * @param aliases - an array of [alias_name, original_function_name] pairs 
 * 
 */
export function AddAlias(aliases: [string, string][]) {
  Calculator.AddAlias(aliases);
}


