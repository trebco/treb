
import { FunctionMap } from '../descriptors';
import { IsComplex, UnionValue, ValueType } from 'treb-base-types';
import * as Utils from '../utilities';
import { ValueError } from '../function-error';
import { RectangularToPolar } from '../complex-math';

export const ComplexFunctionLibrary: FunctionMap = {

  IsComplex: {
    description: 'Returns true if the reference is a complex number',
    arguments: [{
      name: 'Reference',
      metadata: true,
    }],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
      console.info("RR", ref);
      return { 
        type: ValueType.boolean, 
        value: ref?.value && IsComplex(ref.value.value),
      };
    }),
  },


  Real: {
    description: 'Returns the real part of a complex number',
    arguments: [
      { boxed: true },
    ],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
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
    }),
  },

  Imaginary: {
    description: 'Returns the imaginary part of a complex number (as a real)',
    arguments: [
      { boxed: true },
    ],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
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
    }),
  },

  Arg: {
    description: 'Returns the primary argument of a complex number',
    arguments: [
      { boxed: true },
    ],
    fn: Utils.ApplyAsArray((ref: UnionValue): UnionValue => {
      
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
          value: Math.atan2(0, ref.value || 0),
        }
      }

      return ValueError();
    }),
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

  /**
   * unfortunately we can't override the log function because the complex
   * log function has a different meaning even when applied to reals, i.e.
   * Log(a + 0i) !== ln(a)
   */
  ComplexLog: {
    description: 'Returns the principal value Log(z) of a complex number z',
    arguments: [
      { boxed: true },
    ],
    fn: Utils.ApplyAsArray((a: UnionValue): UnionValue => {

      // real -> complex
      if (a.type === ValueType.number) {
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
        a = {
          type: ValueType.complex,
          value: { real: 0, imaginary: 0 },
        };
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

    }),
  },

};

