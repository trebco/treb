
import { IsDimensionedQuantity, DimensionedQuantity, UnionValue, ValueType, DimensionedQuantityUnion } from 'treb-base-types';
import { ArgumentError, DivideByZeroError, IsError, ValueError } from 'treb-calculator/src/function-error';
import { calculator as volume_calculator } from '../../lib/test/us-volume-init';
import { UnitError } from './error';

// ---- rewritten to support DQs (and we're dropping complex) ------------------

export const Subtract = (a: UnionValue, b: UnionValue): UnionValue => {
  return Add(a, b, -1);
};

export const Add = (a: UnionValue, b: UnionValue, sign = 1): UnionValue => {

  // add/subtract must have the same unit type. unfortunately 
  // ts can't figure this out if we first check for ===, so we 
  // might as well do the explicit tests first
  
  if (a.type === ValueType.number && b.type === ValueType.number) {
    return {
      type: ValueType.number,
      value: (a.value as number) + (b.value as number) * sign,
    }
  }

  if (a.type === ValueType.dimensioned_quantity && b.type === ValueType.dimensioned_quantity) {

    const da = volume_calculator.ConvertValue(a.value);
    if (!da) { return ValueError(); }

    const db = volume_calculator.ConvertValue(b.value);
    if (!db) { return ValueError(); }

    if (da.unit !== db.unit) {
      console.warn('unit mismatch in +/-');
      return UnitError(); // FIXME: new error type?
    }

    return {
      type: ValueType.dimensioned_quantity,
      value: {
        unit: da.unit,
        value: da.value + (db.value * sign),
      },
    };

  }

  if ((a.type === ValueType.dimensioned_quantity && b.type === ValueType.number)
     || (a.type === ValueType.number && b.type === ValueType.dimensioned_quantity)) {
    return UnitError();
  }


  return ValueError();
  
};

export const Multiply = (a: UnionValue, b: UnionValue): UnionValue => {

  // console.info("MULT", a.type, b.type);

  // for multiply, we can have 0 or 1 dimensioned quantities (for this
  // use case, we don't support squared units).

  if (a.type === ValueType.number && b.type === ValueType.number) {
    return {
      type: ValueType.number,
      value: a.value * b.value,
    };
  }

  // swap so we only handle one case

  if (a.type === ValueType.dimensioned_quantity && b.type === ValueType.number) {
    const temp = a;
    a = b;
    b = temp;
  }

  if (a.type === ValueType.number && b.type === ValueType.dimensioned_quantity) {
    return {
      type: ValueType.dimensioned_quantity,
      value: {
        unit: b.value.unit,
        value: a.value * b.value.value,
      },
    };
  }

  // we don't support unit^x for this application, although other applications
  // should support it (length -> area -> volume, for example)

  if (a.type === ValueType.dimensioned_quantity && b.type === ValueType.dimensioned_quantity) {
    return UnitError();
  }

  return ValueError();
  
};

export const Divide = (a: UnionValue, b: UnionValue): UnionValue => {

  // two literals

  if (a.type === ValueType.number && b.type === ValueType.number) {
    return {
      type: ValueType.number,
      value: a.value / b.value,
    };
  }

  // two DQs. if the units match, we wind up with a scalar quantity. 
  // if the units don't resolve to a match we can't calculate.

  if (a.type === ValueType.dimensioned_quantity && b.type === ValueType.dimensioned_quantity) {

    const da = volume_calculator.ConvertValue(a.value);
    if (!da) { return ValueError(); }

    const db = volume_calculator.ConvertValue(b.value);
    if (!db) { return ValueError(); }
    
    if (da.unit !== db.unit) {
      console.warn('unit mismatch in +/-');
      return UnitError(); // FIXME: new error type?
    }

    return {
      type: ValueType.number,
      value: da.value / db.value,
    };

  }

  // one DQ. I determined elsewhere that you can transfer the unit even
  // if it's in the denominator, but I'm less convinced of that now.
  // not saying it's wrong, just that my earlier intuition was questionable.

  if (a.type === ValueType.number && b.type === ValueType.dimensioned_quantity) {
    return {
      type: ValueType.dimensioned_quantity,
      value: {
        unit: b.value.unit,
        value: a.value / b.value.value,
      },
    };
  }

  if (a.type === ValueType.dimensioned_quantity && b.type === ValueType.number) {
    return {
      type: ValueType.dimensioned_quantity,
      value: {
        unit: a.value.unit,
        value: a.value.value / b.value,
      },
    };
  }

  // anything else is broken

  return ValueError();

};

/**
 * internal function for inequalities. we need comparable units,
 * so check and resolve. if we can't resolve, return undefined which
 * means error.
 * 
 * not super clear how to deal with undefined, empty string, &c.
 * 
 */
export const Inequality = (a: UnionValue, b: UnionValue): [number, number]|undefined => {

  // let's treat undefined, empty string as 0

  if (a.type === ValueType.undefined || a.value === '' || a.value === 0) {
    a = { type: ValueType.number, value: 0 };
  }

  if (b.type === ValueType.undefined || b.value === '' || b.value === 0) {
    b = { type: ValueType.number, value: 0 };
  }

  // simple case. this will also (after conversion) match undefineds and empty strings

  if (a.type === ValueType.number && b.type === ValueType.number) {
    return [a.value, b.value];    
  }

  if ((a.type === ValueType.dimensioned_quantity || a.value === 0) && 
      (b.type === ValueType.dimensioned_quantity || b.value === 0)) {

    // same type. we don't need to convert.

    if (a.type === ValueType.dimensioned_quantity && b.type === ValueType.dimensioned_quantity && a.value.unit === b.value.unit) {
      return [a.value.value, b.value.value];
    }

    const da = (a.value === 0) ? { value: 0, unit: 'zero' } : volume_calculator.ConvertValue((a as DimensionedQuantityUnion).value);
    if (!da) { return undefined; }

    const db = (b.value === 0) ? { value: 0, unit: 'zero' } : volume_calculator.ConvertValue((b as DimensionedQuantityUnion).value);
    if (!db) { return undefined; }

    // don't allow invalid cross-unit, except for explicit zero

    if (da.unit !== db.unit && (da.unit !== 'zero' && db.unit !== 'zero')) {
      return undefined;
    }

    return [da.value, db.value];

  }

  // some other type? can't handle

  return undefined;

}

export const GreaterThan = (a: UnionValue, b: UnionValue): UnionValue => {
  const values = Inequality(a, b);
  if (!values) { return ValueError(); }
  return { type: ValueType.boolean, value: values[0] > values[1] };
};

export const GreaterThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {

  // could be !< (although you still have to handle errors, so it probably works out about the same)
  
  const values = Inequality(a, b);
  if (!values) { return ValueError(); }
  return { type: ValueType.boolean, value: values[0] >= values[1] };
};

export const LessThan = (a: UnionValue, b: UnionValue): UnionValue => {
  const values = Inequality(a, b);
  if (!values) { return ValueError(); }
  return { type: ValueType.boolean, value: values[0] < values[1] };
};

export const LessThanEqual = (a: UnionValue, b: UnionValue): UnionValue => {

  // see GreaterThanEqual

  const values = Inequality(a, b);
  if (!values) { return ValueError(); }
  return { type: ValueType.boolean, value: values[0] <= values[1] };
};

export const Equals = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }
  
  // empty cells equal 0 (real or complex) and ""

  if ((a.type === ValueType.undefined && (b.value === '' || b.value === 0 || (b.type === ValueType.dimensioned_quantity && b.value.value === 0)))
      || (b.type === ValueType.undefined && (a.value === '' || a.value === 0 || (a.type === ValueType.dimensioned_quantity && a.value.value === 0)))) {
    return { type: ValueType.boolean, value: true, };
  }

  if (a.type === ValueType.dimensioned_quantity && b.type === ValueType.dimensioned_quantity) {

    if (a.value.unit === b.value.unit) {
      return {
        type: ValueType.boolean,
        value: (a.value.value === b.value.value),
      };
    }

    const da = volume_calculator.ConvertValue(a.value);
    if (!da) { return ValueError(); }

    const db = volume_calculator.ConvertValue(b.value);
    if (!db) { return ValueError(); }

    return {
      type: ValueType.boolean,
      value: (da.value === db.value), // === here? (...)
    };

  }

  return { type: ValueType.boolean, value: a.value == b.value }; // note ==

};


// ---- copied verbatim: we could isolate these or extend ----------------------

export const Concatenate = (a: UnionValue, b: UnionValue): UnionValue => {
  if (a.type === ValueType.error) { return a; }
  if (b.type === ValueType.error) { return b; }

  return {
    type: ValueType.string, 
    value: `${a.type === ValueType.undefined ? '' : a.value}${b.type === ValueType.undefined ? '' : b.value}`,
  };

};

export const NotEquals = (a: UnionValue, b: UnionValue): UnionValue => {
  const result = Equals(a, b);
  if (result.type === ValueType.error) {
    return result;
  }
  return {
    type: ValueType.boolean,
    value: !result.value,
  };
};

// ---- map --------------------------------------------------------------------

export const MapOperator = (operator: string) => {
  switch(operator) {
    case '+': return Add;
    case '-': return Subtract;
    case '*': return Multiply;
    case '/': return Divide;

    case '&': return Concatenate;

    case '=': return Equals;
    case '==': return Equals;
    case '!=': return NotEquals;
    case '<>': return NotEquals;
    case '>': return GreaterThan; 
    case '>=': return GreaterThanEqual; 
    case '<': return LessThan; 
    case '<=': return LessThanEqual; 

    /*
    case '^': return Power;
    case '**': return Power;
    case '%': return Modulo;    // NOTE: not an excel operator
    */
  }
  return undefined;
};
