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

import type { Complex, DimensionedQuantity } from './value-type';
import type { ErrorValue } from './error-value';
import { type ValueType, GetValueType } from './value-type';

export type CellValue = undefined | string | number | boolean | Complex | DimensionedQuantity;

/** 
 * utility method 
 * 
 * @internal
 */
export const Is2DArray = <T>(obj: undefined|T|T[]|T[][]): obj is T[][] => {
  return !!obj && Array.isArray(obj) && Array.isArray(obj[0]);
}

export interface TypedUnion {
  type: ValueType;
}

export interface NumberUnion extends TypedUnion {
  type: 'number';
  value: number;
} 

export interface StringUnion extends TypedUnion  {
  type: 'string';
  value: string;
}

export interface ErrorUnion extends TypedUnion  {
  type: 'error';
  value: ErrorValue;
}

export interface FormulaUnion extends TypedUnion  {
  type: 'formula';
  value: string;
}

export interface BooleanUnion extends TypedUnion  {
  type: 'boolean';
  value: boolean;
}

export interface ComplexUnion extends TypedUnion  {
  type: 'complex';
  value: Complex;
}

export interface DimensionedQuantityUnion extends TypedUnion  {
  type: 'dimensioned_quantity';
  value: DimensionedQuantity;
}

export interface UndefinedUnion extends TypedUnion  {
  type: 'undefined';
  value?: undefined;
}

export interface ExtendedUnion extends TypedUnion  {
  type: 'object';

  // this needs to come out but it's costly; we apparently relied
  // pretty heavily on this any leaking in and allowing lots of 
  // sloppy comparisons. work in progress.

  value: unknown; // any;
  key?: string;

  /** adding a source field so we can track */
  source?: string; 
}

export interface FunctionUnion extends TypedUnion  {
  type: 'function',
  value: unknown;
}

export interface ArrayUnion extends TypedUnion  {
  type: 'array';
  value: UnionValue[][]; // 2d
}

/** switch to a discriminated union. implicit type guards! */
export type UnionValue 
    = NumberUnion 
    | ArrayUnion 
    | ComplexUnion
    | DimensionedQuantityUnion 
    | ExtendedUnion
    | StringUnion 
    | FormulaUnion
    | UndefinedUnion
    | BooleanUnion
    | FunctionUnion
    | ErrorUnion
    ;

/** 
 * shortcut, although this is wasteful 
 * 
 * @internal
 */
export const Box = (value: unknown, type?: ValueType): UnionValue => { 
  
  // FIXME: type properly... instead of the GetValueType call

  if (typeof type === 'undefined') {
    type = GetValueType(value);
  }

  // assert? 

  return {
    value, 
    type,
  } as UnionValue;
  
};

/**
 * box a complex value in a union, potentially switching to a real if
 * there's no imaginary component.
 * 
 * @internal
 */
export const ComplexOrReal = (value: Complex): ComplexUnion|NumberUnion => {
  if (value.imaginary) {
    return {
      type: 'complex',
      value,
    };
  }
  return { type: 'number', value: value.real };
}



