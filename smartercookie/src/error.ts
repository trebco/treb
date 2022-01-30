
import { UnionValue, ValueType } from 'treb-base-types';

export const UnitError = (): UnionValue => {
  return { type: ValueType.error, value: 'UNIT' };
};
