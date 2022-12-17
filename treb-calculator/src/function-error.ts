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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { UnionValue, ValueType } from 'treb-base-types';

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
}

export interface FunctionError {
  error: ErrorType;
}

// export const ArgumentError: FunctionError = { error: ErrorType.Argument };
// export const ReferenceError: FunctionError = { error: ErrorType.Reference };
//export const ExpressionError: FunctionError = { error: ErrorType.Expression };
// export const NameError: FunctionError = { error: ErrorType.Name };
// export const ValueError: FunctionError = { error: ErrorType.Value };
// export const DataError: FunctionError = { error: ErrorType.Data };
// export const DivideByZeroError: FunctionError = { error: ErrorType.Div0 };
// export const UnknownError: FunctionError = { error: ErrorType.Unknown };
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

export const ValueError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Value };
};

export const ReferenceError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Reference };
};

export const NameError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Name };
};

export const UnknownError = (): UnionValue => {
  return { type: ValueType.error, value: ErrorType.Unknown };
};


/** type guard function */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IsError = (test: any): test is FunctionError => {
  return test && typeof test.error && (
    test.error === ErrorType.Argument ||
    test.error === ErrorType.Reference ||
    test.error === ErrorType.Name ||
    test.error === ErrorType.Expression ||
    test.error === ErrorType.Data ||
    test.error === ErrorType.Unknown ||
    test.error === ErrorType.NotImpl ||
    test.error === ErrorType.Value ||
    test.error === ErrorType.Div0
  );
};
