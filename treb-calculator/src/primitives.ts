
import { Complex, IsComplex, UnionValue, ValueType } from 'treb-base-types/src';
import { DivideByZeroError, ValueError } from './function-error';

export type PrimitiveBinaryExpression = (a: UnionValue, b: UnionValue) => UnionValue;

type NumericTuple = [number, number, UnionValue?, UnionValue?, UnionValue?];

/** FIXME: move to complex lib */
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

/** FIXME: move to complex lib */
const PolarToRectangular = (a: {r: number, theta: number}): Complex => {

  const {r, theta} = a;

  const real = r * Math.cos(theta);
  const imaginary = r * Math.sin(theta);

  // console.info("P2R",  `r ${r} theta (o) ${theta * 57.29577951308232}`, '->', `${real||0}${imaginary < 0 ? '' : '+'}${imaginary}i`);

  return { real, imaginary }
};

/** FIXME: move to complex lib */
const RectangularToPolar = (value: Complex): {r: number, theta: number} => {

  const r = Math.sqrt(value.real * value.real + value.imaginary * value.imaginary);
  const theta = Math.atan2(value.imaginary, value.real);

  // console.info("R2P", `${value.real||0}${value.imaginary < 0 ? '' : '+'}${value.imaginary}i`, '->', `r ${r} theta (o) ${theta * 57.29577951308232}`);

  return { r, theta };
};

/** FIXME: move to complex lib */
const MultiplyComplex = (a: Complex, b: Complex): Complex => {
  return {
    real: (a.real * b.real) - (a.imaginary * b.imaginary),
    imaginary: a.real * b.imaginary + a.imaginary * b.real,
  }
};



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
    return {
      value: {
        real: c1.value.real + c2.value.real, 
        imaginary: c1.value.imaginary + c2.value.imaginary,
      },
      type: ValueType.complex,
    };
  }

  return { value: x + y, type: ValueType.number };
};

export const Subtract = (a: UnionValue, b: UnionValue): UnionValue => {

  let [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {
    return {
      value: {
        real: c1.value.real - c2.value.real, 
        imaginary: c1.value.imaginary - c2.value.imaginary,
      },
      type: ValueType.complex,
    };
  }

  return { value: x - y, type: ValueType.number };
};

export const Power = (a: UnionValue, b: UnionValue): UnionValue => {
  let [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  if (c1 && c2) {

    if (!c2.value.imaginary) {

      const polar = RectangularToPolar(c1.value);
      const result = PolarToRectangular({
        r: Math.pow(polar.r, c2.value.real), 
        theta: polar.theta * c2.value.real,
      });

      return { value: result, type: ValueType.complex };

    }
    else {
      return ValueError();
    }

  }

  return { value: Math.pow(x, y), type: ValueType.number };
};

export const Multiply = (a: UnionValue, b: UnionValue): UnionValue => {

  let [x, y, z, c1, c2] = NumericTypes(a, b);

  if (z) { return z; }

  if (c1 && c2) {

    return {
      type: ValueType.complex,
      value: MultiplyComplex(c1.value, c2.value),
    };

  }

  return { value: x * y, type: ValueType.number };
};

export const Divide = (a: UnionValue, b: UnionValue): UnionValue => {
  let [x, y, z, c1, c2] = NumericTypes(a, b);
  if (z) { return z; }

  if (c1 && c2) {

    const conjugate = { real: c2.value.real, imaginary: -c2.value.imaginary };

    const numerator = MultiplyComplex(c1.value, conjugate);
    const denominator = MultiplyComplex(c2.value, conjugate);

    if (denominator.imaginary) {
      throw new Error('invalid denom!');
    }

    return {
      type: ValueType.complex,
      value: {
        real: numerator.real / denominator.real,
        imaginary: numerator.imaginary / denominator.real, 
      },
    };

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
  
  // empty cells equal 0 and ""
  // FIXME: should also equal a complex with 0+0i

  if ((a.type === ValueType.undefined && (b.value === '' || b.value === 0))
      || (b.type === ValueType.undefined && (a.value === '' || a.value === 0))) {

    return { type: ValueType.boolean, value: true, };
  }

  if (a.type === ValueType.complex || b.type === ValueType.complex) {
    return { 
      type: ValueType.boolean, 
      value: (a.type === b.type) &&
        a.value.real == b.value.real &&         // ==
        a.value.imaginary == b.value.imaginary  // ==
    };

  }

  return { type: ValueType.boolean, value: a.value == b.value }; // note ==
};

/**
 * this is duplicative, but it seems better than another function call.
 * not sure if that is over-optimization (it is).
 */
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
