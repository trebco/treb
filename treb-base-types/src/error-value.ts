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

declare const ErrorBrand: unique symbol;

export const raw_errors = {
  Argument:   1,
  Data:       2,
  Reference:  3,
  Name:       4,
  Expression: 5,
  Value:      6,
  Unknown:    7,
  NotImpl:    8,
  Div0:       9,
  NA:         10,
  Loop:       11,
  Spill:      12,
  Num:        13,
} as const;

// map each property key to its branded literal type
export type Branded<T extends Record<string, number>> = {
  readonly [K in keyof T]: T[K] & { readonly [ErrorBrand]: K };
};

// export the single object with the branded shape cast
export const Errors = raw_errors as Branded<typeof raw_errors>;

// union type of all branded error values
export type ErrorValue = typeof Errors[keyof typeof Errors];

