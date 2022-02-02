
import { FunctionMap } from 'treb-calculator/src/descriptors';
import * as Utils from 'treb-calculator/src/utilities';
import { ReferenceError, NotImplError, NAError, ArgumentError, DivideByZeroError, ValueError, UnknownError } from 'treb-calculator/src/function-error';
import { Box, UnionValue, ValueType, GetValueType, 
         CellValue, RenderFunctionResult, RenderFunctionOptions, ComplexOrReal, Complex, IsDimensionedQuantity, DimensionedQuantityUnion } from 'treb-base-types';

import { calculator as volume_calculator } from '../../lib/test/us-volume-init';
import { UnitError } from './error';
         
export const FunctionLibrary: FunctionMap = {};

/**
 * sum function for scalars OR dimensioned quantities (can't mix)
 */
FunctionLibrary['Sum'] = {
  description: 'Adds arguments and ranges',
  arguments: [{ boxed: true, name: 'values or ranges' }],
  fn: (...args: UnionValue[]) => {

    const sum: { value: number, unit: string|undefined } = { value: 0, unit: undefined };
    const values = Utils.FlattenBoxed(args); // as UnionValue[];

    for (const value of values) {

      switch (value.type) {
        case ValueType.number: 
          if (sum.unit && value.value) { // allow zeros
            return UnitError();
          }
          sum.value += value.value; 
          break;
      
        case ValueType.boolean: 
          if (sum.unit) {
            return UnitError();
          }
          sum.value += (value.value ? 1 : 0); 
          break;
        
        case ValueType.dimensioned_quantity:
          if (sum.value && !sum.unit) {
            // we have value but no units, adding a DQ would be an error
            return UnitError();
          }

          // either we have unit, in which case we need to match, or we
          // have no units, in which case we can set our unit. in either
          // case we should try to convert first.

          {
            // map or preserve
            const converted = volume_calculator.ConvertValue(value.value) || value.value;
            if (!sum.unit) {
              sum.unit = converted.unit;
            }
            else if (sum.unit !== converted.unit) {
              return UnitError();
            }
            sum.value += converted.value;
          }

          break;

        case ValueType.error: return value;
      }
    }

    if (sum.unit) {
      return {
        type: ValueType.dimensioned_quantity,
        value: sum,
      }
    }
    else {
      return {
        type: ValueType.number,
        value: sum.value,
      }
    }

  },
};

FunctionLibrary['Convert'] = {

  fn: (value: DimensionedQuantityUnion, ingredient: string) => {

    ingredient = ingredient.toLowerCase();
    const unit = value?.value?.unit || '';

    // FIXME: should reduce to the known unit (ml/g), unless
    // it's a nonstandard/unknown unit (stick, egg)

    switch (ingredient) {
      case 'butter':

        if (/^sticks{0,1}$/i.test(unit)) { // stick -> g
          return {
            type: ValueType.dimensioned_quantity,
            value: {
              unit: 'g',
              value: (value?.value?.value||1) * 28.3495 * 4, // 4 oz
            },
          };
        }
        if (/Ts{0,1}$/.test(unit) || /^(?:tbsp|tbl|tablespoon)s{0,1}$/.test(unit)) { // tablespoon -> g
          return {
            type: ValueType.dimensioned_quantity,
            value: {
              unit: 'g',
              value: (value?.value?.value||1) * 28.3495 / 2, // 0.5 oz
            },
          };
        }

        if (/^(?:g|gram|gm)$/i.test(unit)) { // grams -> volume
          return {
            type: ValueType.dimensioned_quantity,
            value: {
              unit: 'tbsp',
              value: (value?.value?.value||1) / (28.3495 * 4) * 8,
            },
          };
        }

        console.info("X", {value, ingredient, unit});
        return UnitError();
    }
    
    console.info("V", {value, ingredient, unit});

    return UnknownError();
  },
  arguments: [
    { name: 'Value', boxed: true, },
    { name: 'Ingredient', },
  ],

};

//
// this should disappear in prod with tree-shaking, because we'll
// get a constant string inequality. depends on the quality of the
// tree shaking, but from what I can determine, it works.
//
if (process.env.NODE_ENV === 'dev') {

  FunctionLibrary['DQ'] = {
    fn: (value: number, unit: string) => {
      return {
        type: ValueType.dimensioned_quantity,
        value: {
          value,
          unit,
        },
      };
    },
  };

  FunctionLibrary['DQ.Unit'] = {
    fn: (value: UnionValue): UnionValue => {
      if (IsDimensionedQuantity(value)) {
        return {
          type: ValueType.string,
          value: value.unit,
        };
      }
      return ArgumentError();
    }
  };

  FunctionLibrary['DQ.Quantity'] = {
    fn: (value: UnionValue): UnionValue => {
      if (IsDimensionedQuantity(value)) {
        return {
          type: ValueType.number,
          value: value.value,
        };
      }
      return ArgumentError();
    }
  };

  FunctionLibrary['TestDQ'] = {
    fn: (): UnionValue => {

      const value = (Math.random() * 17);
      let unit = 'n/a';

      switch (Math.round(Math.random() * 7)) {
        case 0: 
          unit = 'tbsp';
          break;
        case 1:
          unit = 'tsp';
          break;
        case 2:
          unit = 'oz';
          break;
        case 3:
          unit = 'g';
          break;
        case 4:
          unit = 'mm';
          break;
        case 5:
          unit = 'cup';
          break;
        case 6:
          unit = 'fl oz';
          break;
        case 7:
          unit = 'm/s';
          break;
        }
    
      return {
        type: ValueType.dimensioned_quantity,
        value: { value, unit },
      }
    }
  };

}

