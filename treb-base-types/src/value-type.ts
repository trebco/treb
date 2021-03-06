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

// split from cell for separate import, 
// @see format-index.ts

/**
 * Complex number type
 */
export interface Complex {
  real: number,
  imaginary: number,
}

export const IsComplex = (value: unknown): value is Complex => {
  return (typeof value === 'object')
          && (!!value)
          && (typeof (value as Complex).real === 'number')
          && (typeof (value as Complex).imaginary === 'number');
};

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

export interface DimensionedQuantity {
  value: number;
  unit: string;
}

export const IsDimensionedQuantity = (value: unknown): value is DimensionedQuantity => {
  return (typeof value === 'object')
          && (!!value)
          && (typeof (value as DimensionedQuantity).value === 'number')
          && (typeof (value as DimensionedQuantity).unit === 'string');
};

/**
 * I _think_ using enums is faster. I'm not actually sure about that, though.
 * it stands to reason that a single int compare is faster than a string
 * compare, but you never know with javascript. undefined preferred over null.
 * formula implies a string.
 *
 * undefined is 0 so we can test it as falsy.
 *
 * we're passing this type information out to calculators, so it needs
 * to have known values. DO NOT MODIFY EXISTING INDEXES, or at least be
 * aware of the implications. definitely do not change undefined => 0.
 */
export enum ValueType {
  undefined = 0,

  // formula is a string; we usually test the first character === '='
  formula = 1,
  string = 2,
  number = 3,
  boolean = 4,

  // we don't actually use this type, it's here for matching only
  object = 5,

  // error is a STRING VALUE... object errors are layered on top? is that 
  // correct? (...) it sort of makes sense... since we have separate typing
  error = 6,

  // complex is pretty stable by now
  complex = 7,

  // this is new though. this is not a cell value, it's 
  // only for union types. perhaps we should move or rename 
  // this array, and then cells could have a subset?
  array = 8,

  // adding DQ to union
  dimensioned_quantity = 9,

}

export const GetValueType = (value: unknown): ValueType => {

  switch (typeof value){
    
    case 'undefined':
      return ValueType.undefined;

    case 'number':
      return ValueType.number;

    case 'boolean':
      return ValueType.boolean;

    case 'object':
      if (value === null) {
        return ValueType.undefined;
      }
      else if (IsComplex(value)) {
        return ValueType.complex;
      }
      else if (IsDimensionedQuantity(value)) {
        return ValueType.dimensioned_quantity;
      }
      return ValueType.object;

    case 'string':
      if (value[0] === '=') {
        return ValueType.formula;
      }
      return ValueType.string;

    default: // function or symbol
      return ValueType.error;

  }
}
