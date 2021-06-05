
import { ValueType, Complex, GetValueType } from './value-type';

export type CellValue = undefined | string | number | boolean | Complex;

/** utility method */
export const Is2DArray = <T>(obj: undefined|T|T[]|T[][]): obj is T[][] => {
  return !!obj && Array.isArray(obj) && Array.isArray(obj[0]);
}

/* *
 * to simplify treatment of values and errors, use a composite return
 * type that can support both without a lot of sloppy type testing
 * /
export interface UnionValue {
  type: ValueType;
  value: CellValue | any; // <-- nice (FIXME)
}
*/

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
  value: undefined;
}

export interface ExtendedUnion {
  type: ValueType.object;
  value: any;
  key?: string;
}

/** recursive structure */
export interface ArrayUnion {
  type: ValueType.array;

  // what is the case for supporting [], in this context?
  // value: UnionValue[]|UnionValue[][];

  value: UnionValue[][];
};

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
export const CreateUndefinedUnion = (): UnionValue => { 
  return { type: ValueType.undefined, value: undefined };
};

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

export const ComplexOrReal = (value: Complex): UnionValue => {
  if (value.imaginary) {
    return {
      type: ValueType.complex,
      value,
    };
  }
  return { type: ValueType.number, value: value.real };
}



