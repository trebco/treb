
import type { UnionValue, Complex } from 'treb-base-types';
import { ValueType } from 'treb-base-types';

export const CoerceComplex = (value: UnionValue): Complex|false => {

  switch (value.type) {
    case ValueType.complex: 
      return value.value;

    case ValueType.number:
      return { real: value.value, imaginary: 0 };

    case ValueType.boolean:
      return { real: value.value ? 1 : 0, imaginary: 0 };

    // controversial? ...
    case ValueType.undefined:
      return { real: 0, imaginary: 0 };

  }
      
  return false;

};

