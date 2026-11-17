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

/**
 * Complex number type
 */
export interface Complex {
  real: number,
  imaginary: number,
}

/** 
 * typeguard
 * 
 * @internal
 */
export const IsComplex = (value: unknown): value is Complex => {
  return (typeof value === 'object')
          && (!!value)
          && (typeof (value as Complex).real === 'number')
          && (typeof (value as Complex).imaginary === 'number');
};

/**
 * @internal
 */
export const ComplexToString = (value: Complex): string => {
  if (value.real) {
    if (value.imaginary) {
      if (value.imaginary > 0) {
        return `${value.real} + ${value.imaginary}i`;
      }
      else {
        return `${value.real} - ${Math.abs(value.imaginary)}i`;
      }
    }
    else {
      return value.real.toString();
    }
  }
  else if (value.imaginary) {
    return value.imaginary + 'i';
  }
  else {
    return '0';
  }
};

/**
 * dimensioned quantity: 3.2 m/s, 2kg, 5m, &c.
 */
export interface DimensionedQuantity {
  value: number;
  unit: string;
}

/**
 * typeguard
 *
 * @internal
 */
export const IsDimensionedQuantity = (value: unknown): value is DimensionedQuantity => {
  return (typeof value === 'object')
          && (!!value)
          && (typeof (value as DimensionedQuantity).value === 'number')
          && (typeof (value as DimensionedQuantity).unit === 'string');
};

/** temp until we have a solid type */
export const IsFunctionType = (value: unknown) => {
  return (typeof value === 'object' && (value as { type: string }).type === 'function');
};

/**
 * switching from enum to string union type
 */
export type ValueType
  = 'undefined'
  | 'formula'
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'function'
  | 'error'
  | 'complex'
  | 'array'
  | 'dimensioned_quantity'
  ;

/**
 * test whether a value type is set. both undefined and 'undefined' mean
 * the cell (or calculated value) is empty. use this instead of testing
 * the type for truthiness: 'undefined' is a non-empty string, so it's
 * truthy (the old enum value was 0, which was falsy).
 */
export const HasValueType = (type?: ValueType): type is Exclude<ValueType, 'undefined'> => {
  return !!type && type !== 'undefined';
};

/** 
 * in case we need backwards compatibility. this maps the new string
 * union values to the original ValueType values (was a numerical enum
 * with defined values)
 */
export const ValueTypeMap: Record<number, ValueType> = {
  0: 'undefined',
  1: 'formula',
  2: 'string',
  3: 'number',
  4: 'boolean',
  5: 'object',
  6: 'function',
  7: 'error',
  8: 'complex',
  9: 'array',
  10: 'dimensioned_quantity',
} as const;

/** @internal */
export const GetValueType = (value: unknown): ValueType => {

  const type = typeof value;

  switch (type){
    case 'undefined':
    case 'number':
    case 'boolean':
      return type;

    case 'object':
      if (value === null) {
        return 'undefined';
      }
      else if (IsFunctionType(value)) {
        return 'function';
      }
      else if (IsComplex(value)) {
        return 'complex';
      }
      else if (IsDimensionedQuantity(value)) {
        return 'dimensioned_quantity';
      }
      return 'object';

    case 'string':
      if (String(value)[0] === '=') {
        return 'formula';
      }
      return 'string';

    default: // function or symbol
      return 'error';

  }
  
}
