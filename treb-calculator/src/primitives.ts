
import { UnionValue, ValueType } from 'treb-base-types/src';
import { DivideByZeroError, ValueError } from './function-error';

export type PrimitiveBinaryExpression = (a: UnionValue, b: UnionValue) => UnionValue;

type NumericTuple = [number, number, UnionValue?];

const NumericTypes = (a: UnionValue, b: UnionValue): NumericTuple => {

  if (a.type === ValueType.error) { return [0, 0, a]; }
  if (b.type === ValueType.error) { return [0, 0, b]; }

  const result: NumericTuple = [0, 0];

  switch (a.type) {
    case ValueType.number: result[0] = a.value as number; break;
    case ValueType.boolean: result[0] = a.value ? 1 : 0; break;
    case ValueType.undefined: break;
    default: return [0, 0, ValueError()]; // FIXME
  }

  switch (b.type) {
    case ValueType.number: result[1] = b.value as number; break;
    case ValueType.boolean: result[1] = b.value ? 1 : 0; break;
    case ValueType.undefined: break;
    default: return [0, 0, ValueError()]; // FIXME
  }

  return result;
}

export const Add = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z] = NumericTypes(a, b);
  if (z) { return z; }
  return { value: x + y, type: ValueType.number };
};

export const Subtract = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z] = NumericTypes(a, b);
  if (z) { return z; }
  return { value: x - y, type: ValueType.number };
};

export const Power = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z] = NumericTypes(a, b);
  if (z) { return z; }
  return { value: Math.pow(x, y), type: ValueType.number };
};

export const Multiply = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z] = NumericTypes(a, b);
  if (z) { return z; }
  return { value: x * y, type: ValueType.number };
};

export const Divide = (a: UnionValue, b: UnionValue): UnionValue => {
  const [x, y, z] = NumericTypes(a, b);
  if (z) { return z; }
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
  return { type: ValueType.boolean, value: a.value == b.value }; // note ==
};

export const NotEquals = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
  return { type: ValueType.boolean, value: a.value != b.value }; // note !=
};

// NOTE: our comparisons don't match Excel with different types -- we could
// probably figure out what Excel is doing, but I'm not sure it's useful or
// worthwhile

export const GreaterThan = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
  return { type: ValueType.boolean, value: (a.value||0) > (b.value||0) };
};

export const GreaterThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
  return { type: ValueType.boolean, value: a.value >= b.value };
};

export const LessThan = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
  return { type: ValueType.boolean, value: a.value < b.value };
};

export const LessThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
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
    case '!=': return Equals;
    case '<>': return Equals;
    case '>': return GreaterThan; 
    case '>=': return GreaterThanEqual; 
    case '<': return LessThan; 
    case '<=': return LessThanEqual; 
  }
  return undefined;
};
