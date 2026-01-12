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
import { ValueType } from 'treb-base-types';

export enum ErrorType {
  Argument =    'ARG',
  Data =        'DATA',
  Reference =   'REF',
  Name =        'NAME',
  Expression =  'EXPR',
  Value =       'VALUE',
  Unknown =     'UNK',
  NotImpl =     'NOTIMPL',
  Div0 =        'DIV/0',
  NA =          'N/A',
  Loop =        'LOOP', // circular reference
  Spill =       'SPILL',
}

export interface FunctionError {
  error: ErrorType;
}

export const NotImplError: FunctionError = { error: ErrorType.NotImpl };

export const NAError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.NA };
}

export const ExpressionError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Expression };
}

export const DataError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Data };
};

export const DivideByZeroError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Div0 };
};

export const ArgumentError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Argument };
};

export const ValueError = (): /* UnionValue */ ErrorUnion => {
  return { type: ValueType.error, value: ErrorType.Value };
};

export const ReferenceError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Reference };
};

export const NameError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Name };
};

export const SpillError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Spill };
};

export const UnknownError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Unknown };
};


/** 
 * type guard function 
 *
 * ...this is maybe too precise?  
 */
export const IsError = (test: unknown): test is FunctionError => {
  return !!test && typeof test === 'object' && !!(test as FunctionError).error && (
    (test as FunctionError).error === ErrorType.Argument ||
    (test as FunctionError).error === ErrorType.Reference ||
    (test as FunctionError).error === ErrorType.Name ||
    (test as FunctionError).error === ErrorType.Expression ||
    (test as FunctionError).error === ErrorType.Data ||
    (test as FunctionError).error === ErrorType.Unknown ||
    (test as FunctionError).error === ErrorType.NotImpl ||
    (test as FunctionError).error === ErrorType.Value ||
    (test as FunctionError).error === ErrorType.Spill ||
    (test as FunctionError).error === ErrorType.Div0
  );
};
