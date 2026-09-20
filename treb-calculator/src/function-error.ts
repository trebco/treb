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

import type { ErrorUnion, UnionValue} from 'treb-base-types';
import { type ErrorValue, Errors, ValueType } from 'treb-base-types';

export interface FunctionError {
  error: ErrorValue;
}

export const NotImplError: FunctionError = { error: Errors.NotImpl };

export const NAError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.NA };
}

export const ExpressionError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Expression };
}

export const DataError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Data };
};

export const DivideByZeroError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Div0 };
};

export const ArgumentError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Argument };
};

export const ValueError = (): /* UnionValue */ ErrorUnion => {
  return { type: ValueType.error, value: Errors.Value };
};

export const NumError = (): /* UnionValue */ ErrorUnion => {
  return { type: ValueType.error, value: Errors.Num };
};

export const ReferenceError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Reference };
};

export const NameError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Name };
};

export const SpillError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Spill };
};

export const UnknownError = (): UnionValue => {
  return { type: ValueType.error, value: Errors.Unknown };
};


/** 
 * type guard function 
 *
 * ...this is maybe too precise?  
 */
export const IsError = (test: unknown): test is FunctionError => {
  return !!test && typeof test === 'object' && !!(test as FunctionError).error && (
    (test as FunctionError).error === Errors.Argument ||
    (test as FunctionError).error === Errors.Reference ||
    (test as FunctionError).error === Errors.Name ||
    (test as FunctionError).error === Errors.Expression ||
    (test as FunctionError).error === Errors.Data ||
    (test as FunctionError).error === Errors.Unknown ||
    (test as FunctionError).error === Errors.NotImpl ||
    (test as FunctionError).error === Errors.Value ||
    (test as FunctionError).error === Errors.Spill ||
    (test as FunctionError).error === Errors.Div0
  );
};
