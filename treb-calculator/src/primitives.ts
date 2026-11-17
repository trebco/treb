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

import type { Complex, ComplexUnion, UnionValue} from 'treb-base-types';
import { DivideByZeroError, ValueError } from './function-error';

import * as ComplexLib from './complex-math';

// import { PolarToRectangular, RectangularToPolar, 
//         MultiplyComplex, DivideComplex, PowerComplex } from './complex-math';

export type PrimitiveBinaryExpression = (a: UnionValue, b: UnionValue) => UnionValue;

type NumericTuple = [
  number, 
  number, 
  UnionValue?, // FIXME: should be error type?
  ComplexUnion?, // UnionValue?, 
  ComplexUnion?, // UnionValue?
];

/** 
 * a is either a complex union value or undefined. if it's defined,
 * return it. if it's undefined, return a complex number with the given 
 * real value. 
 */
const EnsureComplex = (a?: UnionValue, real = 0): { type: 'complex', value: {real: number, imaginary: number}} => {

  if (a && a.type === 'complex') {
    return a as {type: 'complex', value: {real: number, imaginary: number}};
  }

  return {
    type: 'complex',
    value: {
      real,
      imaginary: 0,
    },
  };

}

/**
 * return a complex number or, if there's no imaginary component, reduce it to a real
 */
const BoxComplex = (value: Complex): UnionValue => {
  return value.imaginary ? 
    { type: 'complex', value } : 
    { type: 'number', value: value.real };
}

const NumericTypes = (a: UnionValue, b: UnionValue): NumericTuple => {

  if (a.type === 'error') { return [0, 0, a]; }
  if (b.type === 'error') { return [0, 0, b]; }

  const result: NumericTuple = [0, 0];

  // FIXME: what about empty string? should === 0?

  switch (a.type) {
    case 'number': 
      result[0] = a.value as number; 
      break;

    case 'boolean': 
      result[0] = a.value ? 1 : 0; 
      break;

    case 'undefined': 
      break;

    case 'complex': 
      result[3] = a; 
      break;

    default: 
      return [0, 0, ValueError()]; // FIXME
  }

  switch (b.type) {
    case 'number': 
      result[1] = b.value as number; 
      break;

    case 'boolean': 
      result[1] = b.value ? 1 : 0; 
      break;

    case 'undefined': 
      break;
    
    case 'complex': 
      result[4] = b; 
      break;

    default: 
      return [0, 0, ValueError()]; // FIXME
  }

  // if we have one complex value, ensure we have two, so
  // we don't have to test again.

  if (result[3] || result[4]) {
    result[3] = EnsureComplex(result[3], result[0]);
    result[4] = EnsureComplex(result[4], result[1]);
  }

  return result;
}

export const Add = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex({
        real: c1.value.real + c2.value.real, 
        imaginary: c1.value.imaginary + c2.value.imaginary,
      });
  }

  return { value: x + y, type: 'number' };
};

export const Subtract = (a: UnionValue, b: UnionValue): UnionValue => {

  const [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex({
        real: c1.value.real - c2.value.real, 
        imaginary: c1.value.imaginary - c2.value.imaginary,
      });
  }

  return { value: x - y, type: 'number' };
};

/** 
 * power function that only uses complex numbers if one of 
 * the arguments is complex. this is intended to prevent complex
 * numbers from leaking in to spreadsheets.
 */
const PowerGated = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex(ComplexLib.Power(c1.value, c2.value));
  }

  const value = Math.pow(x, y);
  if (isNaN(value)) { return ValueError(); }

  return { type: 'number', value };
  
};

/**
 * power function that uses complex exponentiation if one of the arguments
 * is complex, or if the exponent is < 1.
 */
const PowerComplex = (a: UnionValue, b: UnionValue): UnionValue => {

  const [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  // if one argument is complex, we will always get both as complex.
  // so we don't need to re-test. for the same reason if exponent 
  // is < 1 we will have to convert both.

  if (c1 && c2) {
    return BoxComplex(ComplexLib.Power(c1.value, c2.value));
  }

  if (x < 0 && y !== 0 && Math.abs(y) < 1) {
    return BoxComplex(ComplexLib.Power(
      { real: x, imaginary: 0}, { real: y, imaginary: 0 }));
  }

  const value = Math.pow(x, y);
  if (isNaN(value)) { return ValueError(); }

  return { type: 'number', value };

};

/*
export const Power = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex(ComplexLib.Power(c1.value, c2.value));
  }

  const value = Math.pow(x, y);
  if (isNaN(value)) { return ValueError(); }

  return { type: 'number', value };
  
};
*/

let Power = PowerGated;

export const Multiply = (a: UnionValue, b: UnionValue): UnionValue => {

  const [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex(ComplexLib.Multiply(c1.value, c2.value));
  }

  return { value: x * y, type: 'number' };
};

export const Divide = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  if (c1 && c2) {
    if (c2.value.real === 0 && c2.value.imaginary === 0) {
      return DivideByZeroError();
    }
    return BoxComplex(ComplexLib.Divide(c1.value, c2.value));
  }

  if (y === 0) {
    return DivideByZeroError();
  }
  return { value: x / y, type: 'number' };
};

export const Modulo = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z] = NumericTypes(a, b);
  if (z) { return z; }
  if (y === 0) {
    return DivideByZeroError();
  }
  return { value: x % y, type: 'number' };
};

/*
export const Concatenate = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === 'error') { return a; }
  if (b.type === 'error') { return b; }

  return {
    type: 'string', 
    value: `${a.type === 'undefined' ? '' : a.value}${b.type === 'undefined' ? '' : b.value}`,
  };

};
*/

export const Equals = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === 'error') { return a; }
  if (b.type === 'error') { return b; }
  
  // empty cells equal 0 (real or complex) and ""

  if ((a.type === 'undefined' && (b.value === '' || b.value === 0 || (b.type === 'complex' && b.value.real === 0 && b.value.imaginary === 0)))
      || (b.type === 'undefined' && (a.value === '' || a.value === 0 || (a.type === 'complex' && a.value.real === 0 && a.value.imaginary === 0)))) {
    return { type: 'boolean', value: true, };
  }

  if (a.type === 'complex') {
    if (b.type === 'complex') {
      return { type: 'boolean', value: ((a.value.imaginary === b.value.imaginary) && (a.value.real === b.value.real)) };
    }
    else {
      return { type: 'boolean', value: ((!a.value.imaginary) && (a.value.real === b.value)) };
    }
  }
  else if (b.type === 'complex') {
    return { type: 'boolean', value: ((!b.value.imaginary) && (a.value === b.value.real)) };
  }

  // this is standard (icase) string equality. we might also need
  // to handle wildcard string matching, although it's not the 
  // default case for = operators.

  if (a.type === 'string' && b.type === 'string') {
    return { 
      type: 'boolean', 
      value: a.value.toLowerCase() === b.value.toLowerCase(),
    };
  }

  return { type: 'boolean', value: a.value == b.value }; // note ==
};

export const NotEquals = (a: UnionValue, b: UnionValue): UnionValue => {
  const result = Equals(a, b);
  if (result.type === 'error') {
    return result;
  }
  return {
    type: 'boolean',
    value: !result.value,
  };
};

/* *
 * this is duplicative, but it seems better than another function call.
 * not sure if that is over-optimization (it is).
 * /
export const NotEquals = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === 'error') { return a; }
  if (b.type === 'error') { return b; }
  
  // empty cells equal 0 and ""
  // FIXME: should also equal a complex with 0+0i

  if ((a.type === 'undefined' && (b.value === '' || b.value === 0))
      || (b.type === 'undefined' && (a.value === '' || a.value === 0))) {

    return { type: 'boolean', value: false, };
  }

  if (a.type === 'complex' || b.type === 'complex') {
    return { 
      type: 'boolean', 
      value: !((a.type === b.type) &&
        a.value.real == b.value.real &&          // ==
        a.value.imaginary == b.value.imaginary)  // ==
    };

  }

  return { type: 'boolean', value: a.value != b.value }; // note ==
};
*/

// NOTE: our comparisons don't match Excel with different types -- we could
// probably figure out what Excel is doing, but I'm not sure it's useful or
// worthwhile

export const GreaterThan = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === 'error') { return a; }
  if (b.type === 'error') { return b; }

  if (a.type === 'complex' || b.type === 'complex') {
    return ValueError();
  }

  return { type: 'boolean', value: (a.value||0) > (b.value||0) };
};

const Comparable = (a: UnionValue, b: UnionValue) => {

  if (a.type === 'complex' ||
    a.type === 'array' ||
    a.type === 'dimensioned_quantity' ||
    a.type === 'object' ||
    b.type === 'complex' ||
    b.type === 'array' ||
    b.type === 'dimensioned_quantity' ||
    b.type === 'object' 
  ) {
    return false;
  }

  return true;
}

export const GreaterThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === 'error') { return a; }
  if (b.type === 'error') { return b; }

  if (!Comparable(a, b)) { return ValueError(); }

  return { type: 'boolean', value: (a.value||0) >= (b.value||0) };

};

export const LessThan = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === 'error') { return a; }
  if (b.type === 'error') { return b; }

  if (!Comparable(a, b)) { return ValueError(); }

  //if (a.type === 'complex' || b.type === 'complex') {
  //  return ValueError();
  //}

  return { type: 'boolean', value: (a.value||0) < (b.value||0) };
};

export const LessThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === 'error') { return a; }
  if (b.type === 'error') { return b; }

  //if (a.type === 'complex' || b.type === 'complex') {
  //  return ValueError();
  //}

  if (!Comparable(a, b)) { return ValueError(); }

  return { type: 'boolean', value: (a.value||0) <= (b.value||0) };
};

export const UseComplex = () => {
  Power = PowerComplex;
}

export const MapOperator = (operator: string) => {
  switch(operator) {
    // case '&': return Concatenate;
    case '+': return Add;
    case '-': return Subtract;
    case '*': return Multiply;
    case '/': return Divide;
    case '^': return Power;
    case '**': return Power;
    case '%': return Modulo;    // NOTE: not an excel operator
    case '=': return Equals;
    case '==': return Equals;
    case '!=': return NotEquals;
    case '<>': return NotEquals;
    case '>': return GreaterThan; 
    case '>=': return GreaterThanEqual; 
    case '<': return LessThan; 
    case '<=': return LessThanEqual; 
  }
  return undefined;
};
