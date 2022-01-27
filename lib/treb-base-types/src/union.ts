
import { ValueType, Complex, GetValueType } from './value-type';

export type CellValue = undefined | string | number | boolean | Complex;

/** utility method */
export const Is2DArray = <T>(obj: undefined|T|T[]|T[][]): obj is T[][] => {
  return !!obj && Array.isArray(obj) && Array.isArray(obj[0]);
}

export interface NumberUnion {
  type: ValueType.number;
  value: number;
}

export interface StringUnion {
  type: ValueType.string;
  value: string;
}

export interface ErrorUnion {
  type: ValueType.error;
  value: string;
}

export interface FormulaUnion {
  type: ValueType.formula;
  value: string;
}

export interface BooleanUnion {
  type: ValueType.boolean;
  value: boolean;
}

/** we should have these for other types as well */
export interface ComplexUnion {
  type: ValueType.complex;
  value: Complex;
}

export interface UndefinedUnion {
  type: ValueType.undefined;
  value?: undefined;
}

export interface ExtendedUnion {
  type: ValueType.object;
  value: any;
  key?: string;
}

/** potentially recursive structure */
export interface ArrayUnion {
  type: ValueType.array;
  value: UnionValue[][]; // 2d
}

/** switch to a discriminated union. implicit type guards! */
export type UnionValue 
    = NumberUnion 
    | ArrayUnion 
    | ComplexUnion 
    | ExtendedUnion
    | StringUnion 
    | FormulaUnion
    | UndefinedUnion
    | BooleanUnion
    | ErrorUnion
    ;

// common types

/** 
 * this is a factory instead of a constant value to prevent any accidental pollution
 */
// export const CreateUndefinedUnion = (): UnionValue => { 
//  return { type: ValueType.undefined, value: undefined };
//};

/** shortcut, although this is wasteful */
export const Box = (value: unknown, type?: ValueType): UnionValue => { 
  
  // FIXME: type properly... instead of the GetValueType call

  if (typeof type === 'undefined') {
    type = GetValueType(value);
  }

  // assert? 

  return {
    value, 
    type,
  } as UnionValue;
  
};

// export type UnionOrArray = UnionValue|UnionValue[][];

/**
 * box a complex value in a union, potentially switching to a real if
 * there's no imaginary component.
 */
export const ComplexOrReal = (value: Complex): ComplexUnion|NumberUnion => {
  if (value.imaginary) {
    return {
      type: ValueType.complex,
      value,
    };
  }
  return { type: ValueType.number, value: value.real };
}



