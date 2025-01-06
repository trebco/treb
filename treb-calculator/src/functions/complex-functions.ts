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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import type { FunctionMap } from '../descriptors';
import type { CellValue, NumberUnion, UnionValue} from 'treb-base-types';
import { IsComplex, ValueType } from 'treb-base-types';
// import * as Utils from '../utilities';
import { ValueError } from '../function-error';
import { RectangularToPolar } from '../complex-math';

import { CoerceComplex } from './function-utilities';

export const ComplexFunctionLibrary: FunctionMap = {

  IsComplex: {
    description: 'Returns true if the reference is a complex number',
    arguments: [{
      name: 'Reference',
      metadata: true, /* OK with array metadata */
      unroll: true,
    }],
    fn: (ref: UnionValue): UnionValue => {
      return { 
        type: ValueType.boolean, 
        value: !!(ref?.value) && IsComplex((ref.value as {value?: CellValue}).value),
      };
    },
  },


  Real: {
    description: 'Returns the real part of a complex number',
    arguments: [
      { boxed: true, unroll: true },
    ],
    fn: (ref: UnionValue): UnionValue => {
      if (ref.type === ValueType.number) {
        return { ...ref };
      }
      if (ref.type === ValueType.complex) {
        return {
          type: ValueType.number,
          value: ref.value.real || 0,
        };
      }
      if (ref.type === ValueType.undefined || (ref.type === ValueType.string && ref.value === '')) {
        return {
          type: ValueType.number,
          value: 0,
        };
      }
      return ValueError();
    },
  },

  Imaginary: {
    description: 'Returns the imaginary part of a complex number (as real)',
    arguments: [
      { boxed: true, unroll: true, },
    ],
    fn: (ref: UnionValue): UnionValue => {
      if (ref.type === ValueType.complex) {
        return {
          type: ValueType.number,
          value: ref.value.imaginary || 0,
        };
      }
      if (ref.type === ValueType.number ||
          ref.type === ValueType.undefined || 
          (ref.type === ValueType.string && ref.value === '')) {
        return {
          type: ValueType.number,
          value: 0,
        };
      }
      return ValueError();
    },
  },

  Conjugate: {
    description: 'Returns the conjugate of a complex number',
    arguments: [
      { boxed: true, unroll: true },
    ],
    fn: (arg: UnionValue): UnionValue => {

      const complex = CoerceComplex(arg);

      if (!complex) {
        return ValueError();
      }

      if (complex.imaginary) {
        return {
          type: ValueType.complex,
          value: {
            real: complex.real,
            imaginary: -complex.imaginary,
          },
        }
      }

      return {
        type: ValueType.number,
        value: complex.real,
      };

    },
  },

  Arg: {
    description: 'Returns the principal argument of a complex number (in radians)',
    arguments: [
      { boxed: true, unroll: true },
    ],
    fn: (ref: UnionValue): UnionValue => {
      
      if (ref.type === ValueType.complex) {
        return {
          type: ValueType.number,
          value: Math.atan2(ref.value.imaginary, ref.value.real),
        }
      }

      if (ref.type === ValueType.number ||
          ref.type === ValueType.undefined || 
          (ref.type === ValueType.string && ref.value === '')) {
        return {
          type: ValueType.number,
          value: Math.atan2(0, (ref as NumberUnion).value || 0), // this is clumsy now because typing has _improved_
        }
      }

      return ValueError();
    },
  },

  Rectangular: {
    description: 'Converts a complex number in polar form to rectangular form',
    arguments: [
      { name: 'r' },
      { name: 'θ in radians' },
    ],
    fn: (r = 0, theta = 0): UnionValue => {
      return {
        type: ValueType.complex,
        value: { 
          real: r * Math.cos(theta),
          imaginary: r * Math.sin(theta),
        },
      }
    },
  },

  Complex: {
    description: 'Ensures that the given value will be treated as a complex number',
    arguments: [
      { boxed: true, unroll: true },
    ],

    // FIXME: this should use flatten? not sure

    fn: (a: UnionValue): UnionValue => {
      
      const complex = CoerceComplex(a);
      if (complex) {
        return {
          type: ValueType.complex,
          value: complex,
        };
      }

      return ValueError();

    },
  },

  /**
   * unfortunately we can't override the log function because the complex
   * log function has a different meaning even when applied to reals, i.e.
   * Log(a + 0i) !== ln(a)
   * 
   * note that Log(0) is undefined -- we need to return an error here, but
   * what error? let's do #VALUE
   * 
   */
  ComplexLog: {
    description: 'Returns the principal value Log(z) of a complex number z',
    arguments: [
      { boxed: true, unroll: true },
    ],
    fn: (a: UnionValue): UnionValue => {

      // real -> complex
      if (a.type === ValueType.number) {

        if (!a.value) {
          return ValueError();
        }

        a = {
          type: ValueType.complex,
          value: {
            real: a.value,
            imaginary: 0,
          },
        };
      }

      // other zero -> complex
      else if (a.type === ValueType.undefined || (a.type === ValueType.string && a.value === '')) {
        return ValueError();
      }

      if (a.type === ValueType.complex) {

        // from polar form, the principal value is 
        // Log z = ln r + iθ

        const polar = RectangularToPolar(a.value);
        const value = {
          real: Math.log(polar.r),
          imaginary: polar.theta,
        };

        return (value.imaginary) ?
          { type: ValueType.complex, value } :
          { type: ValueType.number, value: value.real };

      }
      
      return ValueError();

    },
  },

};

