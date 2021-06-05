
import { ValueType, Complex, GetValueType } from './value-type';

export type CellValue = undefined | string | number | boolean | Complex;

/** utility method */
export const Is2DArray = <T>(obj: undefined|T|T[]|T[][]): obj is T[][] => {
  return !!obj && Array.isArray(obj) && Array.isArray(obj[0]);
}

/**
 * to simplify treatment of values and errors, use a composite return
 * type that can support both without a lot of sloppy type testing
 */
export interface UnionValue {
  type: ValueType;
  value: CellValue | any;
}

/** we should have these for other types as well */
export interface ComplexUnion {
  type: ValueType.complex;
  value: Complex;
}

/* * recursive structure * /
export interface ArrayUnion {
  type: ValueType.object,
  value: UnionValue[][],
};
*/

/** composite type guard */
export const UnionIs = {

  Undefined: (test: UnionValue): test is { type: ValueType.undefined, value: undefined } => {
    return test.type === ValueType.undefined;
  },

  Number: (test: UnionValue): test is { type: ValueType.number, value: number } => {
    return test.type === ValueType.number;
  },

  Formula: (test: UnionValue): test is { type: ValueType.formula, value: string } => {
    return test.type === ValueType.formula;
  },

  Boolean: (test: UnionValue): test is { type: ValueType.boolean, value: boolean } => {
    return test.type === ValueType.boolean;
  },

  Complex: (test: UnionValue): test is ComplexUnion => {
    return test.type === ValueType.complex;
  },

  String: (test: UnionValue): test is { type: ValueType.string, value: string } => {
    return test.type === ValueType.string;
  },

  Error: (test: UnionValue): test is { type: ValueType.error, value: string } => {
    return test.type === ValueType.error;
  },

  /*
  Array: (test: UnionValue): test is ArrayUnion => {
    return test.type === ValueType.object
      && !!test
      && Array.isArray(test);
  },
  */

  Extended: (test: UnionValue): test is { type: ValueType.object, value: any } => {
    return test.type === ValueType.object;
  },

};

// common types

/** 
 * this is a factory instead of a constant value to prevent any accidental pollution
 */
export const UndefinedUnion = (): UnionValue => { 
  return { type: ValueType.undefined, value: undefined };
};

/** shortcut, although this is wasteful */
export const Box = (value: unknown, type?: ValueType): UnionValue => { 
  
  if (typeof type === 'undefined') {
    type = GetValueType(value);
  }

  return {
    value, 
    type,
  }
  
};

export type UnionOrArray = UnionValue|UnionValue[][];

export const ComplexOrReal = (value: Complex): UnionValue => {
  if (value.imaginary) {
    return {
      type: ValueType.complex,
      value,
    };
  }
  return { type: ValueType.number, value: value.real };
}



