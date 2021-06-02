
import { Complex, IsComplex, UnionValue, ValueType } from 'treb-base-types/src';
import { DivideByZeroError, ValueError } from './function-error';

import * as ComplexLib from './complex-math';

// import { PolarToRectangular, RectangularToPolar, 
//         MultiplyComplex, DivideComplex, PowerComplex } from './complex-math';

export type PrimitiveBinaryExpression = (a: UnionValue, b: UnionValue) => UnionValue;

type NumericTuple = [number, number, UnionValue?, UnionValue?, UnionValue?];

/** 
 * a is either a complex union value or undefined. if it's defined,
 * return it. if it's undefined, return a complex number with the given 
 * real value. 
 */
const EnsureComplex = (a?: UnionValue, real: number = 0): { type: ValueType.complex, value: {real: number, imaginary: number}} => {

  if (a && a.type === ValueType.complex) {
    return a as {type: ValueType.complex, value: {real: number, imaginary: number}};
  }

  return {
    type: ValueType.complex,
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
    { type: ValueType.complex, value } : 
    { type: ValueType.number, value: value.real };
}

const NumericTypes = (a: UnionValue, b: UnionValue): NumericTuple => {

  if (a.type === ValueType.error) { return [0, 0, a]; }
  if (b.type === ValueType.error) { return [0, 0, b]; }

  const result: NumericTuple = [0, 0];

  // FIXME: what about empty string? should === 0?

  switch (a.type) {
    case ValueType.number: 
      result[0] = a.value as number; 
      break;

    case ValueType.boolean: 
      result[0] = a.value ? 1 : 0; 
      break;

    case ValueType.undefined: 
      break;

    case ValueType.complex: 
      result[3] = a; 
      break;

    default: 
      return [0, 0, ValueError()]; // FIXME
  }

  switch (b.type) {
    case ValueType.number: 
      result[1] = b.value as number; 
      break;

    case ValueType.boolean: 
      result[1] = b.value ? 1 : 0; 
      break;

    case ValueType.undefined: 
      break;
    
    case ValueType.complex: 
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
  let [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex({
        real: c1.value.real + c2.value.real, 
        imaginary: c1.value.imaginary + c2.value.imaginary,
      });
  }

  return { value: x + y, type: ValueType.number };
};

export const Subtract = (a: UnionValue, b: UnionValue): UnionValue => {

  let [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex({
        real: c1.value.real - c2.value.real, 
        imaginary: c1.value.imaginary - c2.value.imaginary,
      });
  }

  return { value: x - y, type: ValueType.number };
};

export const Power = (a: UnionValue, b: UnionValue): UnionValue => {
  let [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex(ComplexLib.Power(c1.value, c2.value));
  }

  return { value: Math.pow(x, y), type: ValueType.number };
};

export const Multiply = (a: UnionValue, b: UnionValue): UnionValue => {

  let [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex(ComplexLib.Multiply(c1.value, c2.value));
  }

  return { value: x * y, type: ValueType.number };
};

export const Divide = (a: UnionValue, b: UnionValue): UnionValue => {
  let [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  if (c1 && c2) {
    return BoxComplex(ComplexLib.Divide(c1.value, c2.value));
  }

  if (y === 0) {
    return DivideByZeroError();
  }
  return { value: x / y, type: ValueType.number };
};

export const Modulo = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z] = NumericTypes(a, b);
  if (z) { return z; }
  if (y === 0) {
    return DivideByZeroError();
  }
  return { value: x % y, type: ValueType.number };
};

export const Concatenate = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }

  return {
    type: ValueType.string, 
    value: `${a.type === ValueType.undefined ? '' : a.value}${b.type === ValueType.undefined ? '' : b.value}`,
  };

};

export const Equals = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
  
  // empty cells equal 0 (real or complex) and ""

  if ((a.type === ValueType.undefined && (b.value === '' || b.value === 0 || (b.type === ValueType.complex && b.value.real === 0 && b.value.complex === 0)))
      || (b.type === ValueType.undefined && (a.value === '' || a.value === 0 || (a.type === ValueType.complex && a.value.real === 0 && a.value.complex === 0)))) {
    return { type: ValueType.boolean, value: true, };
  }

  if (a.type === ValueType.complex || b.type === ValueType.complex) {

    // complex can equal real or complex
    
    let equals = false;

    if (a.type === b.type) {
      equals = 
        a.value.real == b.value.real &&         // == ?
        a.value.imaginary == b.value.imaginary  // == ?
        ;
    }
    else if (a.type === ValueType.number) {
      equals = 
        b.value.real == a.value  &&
        !b.value.imaginary;
    }
    else if (b.type === ValueType.number) {
      equals = 
        a.value.real == b.value  &&
        !a.value.imaginary;
    }

    return { type: ValueType.boolean, value: equals };

  }

  return { type: ValueType.boolean, value: a.value == b.value }; // note ==
};

export const NotEquals = (a: UnionValue, b: UnionValue): UnionValue => {
  const result = Equals(a, b);
  return {
    type: ValueType.boolean,
    value: !result.value,
  };
}

/* *
 * this is duplicative, but it seems better than another function call.
 * not sure if that is over-optimization (it is).
 * /
export const NotEquals = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
  
  // empty cells equal 0 and ""
  // FIXME: should also equal a complex with 0+0i

  if ((a.type === ValueType.undefined && (b.value === '' || b.value === 0))
      || (b.type === ValueType.undefined && (a.value === '' || a.value === 0))) {

    return { type: ValueType.boolean, value: false, };
  }

  if (a.type === ValueType.complex || b.type === ValueType.complex) {
    return { 
      type: ValueType.boolean, 
      value: !((a.type === b.type) &&
        a.value.real == b.value.real &&          // ==
        a.value.imaginary == b.value.imaginary)  // ==
    };

  }

  return { type: ValueType.boolean, value: a.value != b.value }; // note ==
};
*/

// NOTE: our comparisons don't match Excel with different types -- we could
// probably figure out what Excel is doing, but I'm not sure it's useful or
// worthwhile

export const GreaterThan = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }

  if (a.type === ValueType.complex || b.type === ValueType.complex) {
    return ValueError();
  }

  return { type: ValueType.boolean, value: (a.value||0) > (b.value||0) };
};

export const GreaterThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }

  if (a.type === ValueType.complex || b.type === ValueType.complex) {
    return ValueError();
  }

  return { type: ValueType.boolean, value: a.value >= b.value };
};

export const LessThan = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }

  if (a.type === ValueType.complex || b.type === ValueType.complex) {
    return ValueError();
  }

  return { type: ValueType.boolean, value: a.value < b.value };
};

export const LessThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }

  if (a.type === ValueType.complex || b.type === ValueType.complex) {
    return ValueError();
  }

  return { type: ValueType.boolean, value: a.value <= b.value };
};

export const MapOperator = (operator: string) => {
  switch(operator) {
    case '&': return Concatenate;
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
