
// split from cell for separate import, 
// @see format-index.ts

export interface Complex {
  real: number,
  imaginary: number,
}

export const IsComplex = (value: any): value is Complex => {
  return (typeof value === 'object')
          && (!!value)
          && (typeof value.real === 'number')
          && (typeof value.imaginary === 'number');
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

  // this is new and in testing
  complex = 7,

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
