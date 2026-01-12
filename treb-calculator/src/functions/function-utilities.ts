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

