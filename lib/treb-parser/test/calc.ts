
import { ExpressionUnit, UnitBinary, UnitDimensionedQuantity, UnitLiteral, UnitLiteralString, UnitUnary } from '..';
import { UnionValue, ValueType } from '../../treb-base-types';

/**
 * simple calculator, no caching and no functions (atm). 
 * I'm walking into a trap here.
 */
export class Calculator {

  public unit_map: Record<string, {
    value: number, 
    unit: string, 
    match?: RegExp[],
    target?: false
  }> = {

    'g': {
      value: 1,
      unit: 'g',
      match: [/^(?:g\.{0,1}|gm\.{0,1}|gram)s{0,1}/],
    },

    'kg': {
      value: 1000,
      unit: 'g',
      match: [/^(?:kg\.{0,1}|kgm\.{0,1}|kilogram|kilo)s{0,1}/],
    },

    'oz': {
      value: 28.3495,
      unit: 'g',
      match: [/^(?:oz\.{0,1}|ounce)s{0,1}$/],
    },

    'lb': {
      value: 453.592,
      unit: 'g',
      match: [/^(?:lb\.{0,1}|pound|pd\.{0,1})s{0,1}\.{0,1}$/],
    },

    // ---

    'fl oz': { 
      value: 29.5735, 
      unit: 'ml', 
      match: [/^(?:fl\.{0,1}|fluid)\s*(?:oz\.{0,1}|ounce)s{0,1}$/],
    },

    'l': { 
      value: 1000, 
      unit: 'ml', 
    },

    'ml': { 
      value: 1, 
      unit: 'ml', 
      match: [ /^(?:ml|milliliter|c\.{0,1}c\.{0,1})s{0,1}$/i, 
        /^(?:cubic|c\.{0,1})\s*(?:cm\.{0,1}|centimeter)s{0,1}$/i,
        /^cm[.^]{0,1}3$/i,
      ],
    },

    'cl': { 
      value: 10, 
      unit: 'ml', 
      match: [/^(?:cl|centiliter)s{0,1}$/i,],
    },

    'tbsp': { 
      value: 14.7868, 
      unit: 'ml', 
      match: [/^T\.{0,1}s{0,1}$/, /^(?:tbl\.{0,1}|tbsp|tablespoon)s{0,1}/i],
    },

    'tsp': { 
      value: 4.92892, 
      unit: 'ml', 
      match: [/^t\.{0,1}s{0,1}$/, /^(?:tsp\.{0,1}|teaspoon)s{0,1}$/i],
    },

    'cup': { 
      value: 236.588, 
      unit: 'ml', 
      match: [/^(?:c\.{0,1}|cup)s{0,1}$/i],
    },

    'dl': { 
      value: 100, 
      unit: 'ml', 
      match: [/^(?:dl|deciliter)s{0,1}$/i,],
    },

    'pinch': { 
      value: 4.92892 / 8, 
      unit: 'ml', 
      target: false, 
      match: [/^(?:pinch|pinches)$/i,],
    },

  };

  /**
   * fudgy unit mapping
   */
  public MapUnit(text: string) {

    text = text.trim();

    for (const key of Object.keys(this.unit_map)) {
      for (const rex of this.unit_map[key]?.match || []) { 
        if (rex.test(text)) {
          return key;
        }
      }
    }

    return undefined;
    
  }

  /**
   * convert to a consistent unit
   * @param unit 
   */
  public Convert(unit: UnitDimensionedQuantity) {

    const normalized = this.MapUnit(unit.unit.name);

    if (!normalized) {
      throw new Error('unrecognized unit: ' + unit.unit.name);
    }

    const result: UnitDimensionedQuantity = JSON.parse(JSON.stringify(unit));

    if (unit.unit.name === 'ml') {
      return result; // no change
    }

    if (unit.expression.type === 'literal') {
      result.expression = {
        type: 'literal',
        position: 0,
        id: 0,
        value: this.unit_map[normalized].value * (unit.expression.value as number),
      }
    }
    else {
      result.expression = {
        type: 'binary',
        id: 0,
        position: 0,
        operator: '*',
        left: result.expression,
        right: {
          type: 'literal',
          value: this.unit_map[normalized].value,
          position: 0,
          id: 0,
        },
      }
    }

    result.unit = {
      id: 0,
      position: 0,
      type: 'identifier',
      name: this.unit_map[normalized].unit,
    };

    return result;

  }

  public Calculate(expression: ExpressionUnit): ExpressionUnit {
    const result = this.CalculateInner(expression);

    // now we should have a single value, either literal or DQ.
    switch (result.type) {
      case 'literal':
        return result;

      case 'dimensioned':
        if (result.unit.name === 'ml') {
          return result;
        }
        return this.Convert(result);

      default:
        throw new Error('unexpected result type: ' + result.type);
    }

  }

  public CalculateInner(expression: ExpressionUnit): ExpressionUnit {

    // basically we want to recurse as much as possible so
    // everything is a literal/DQ before we do any math operations;
    // at that point we can more safely convert units.

    // console.info("CALC", expression.type);

    switch (expression.type) {

      case 'dimensioned':

        // for DQ, apply conversion first (this should fail early).
        // assuming that works, run the expression part through
        // the calculation routine (this routine).

        // NO, we have to be careful about conversion before some
        // math operations (/) because the scale gets thrown off

        /*
        expression = this.Convert(expression);
        return {
          ...expression,
          expression: this.Calculate(expression.expression),
        };
        */
        return expression;

      case 'group':
        return this.CalculateInner(expression.elements[0]);

      case 'unary':
        expression.operand = this.CalculateInner(expression.operand);
        return this.CalculateUnary(expression);

      case 'binary':
        expression.left = this.CalculateInner(expression.left);
        expression.right = this.CalculateInner(expression.right);
        return this.CalculateBinary(expression);

      case 'literal': 
        return expression; // do nothing

    }

    throw new Error('unhandled type: ' + expression.type);

  }

  public Divide(a: ExpressionUnit, b: ExpressionUnit): UnitLiteral|UnitDimensionedQuantity {

    // console.info("DIV", a.type, b.type);

    // for divide, we can have 0, 1 or 2 dimensioned quantities. if there is
    // 1 DQ, where the dimension unit is doesn't matter (for an intuition, 
    // multiply both numerator and denominator by the denominator).

    if (a.type === 'literal' && b.type === 'literal') {

      // console.info("DIV1", a.value, b.value);

      return {
        type: 'literal',
        position: 0,
        id: 0,
        value: (a.value as number) / (b.value as number),
      }
    }

    if (a.type === 'dimensioned' && b.type === 'dimensioned') {

      // console.info("DIV2", a.expression, b.expression);

      if (a.unit.name !== b.unit.name) {
        a = this.Convert(a);
        b = this.Convert(b);
      }

      if (a.expression.type !== 'literal') {
        throw new Error('a not resolved in /');
      }
      if (b.expression.type !== 'literal') {
        throw new Error('b not resolved in /');
      }
      
      return {
        type: 'literal',
        position: 0,
        id: 0,
        value: (a.expression.value as number) / (b.expression.value as number),
      }
    }

    if (a.type === 'dimensioned' && b.type === 'literal') {

      // console.info("DIV3", a.expression, b.value);

      if (a.expression.type !== 'literal') {
        throw new Error('a not resolved in /');
      }

      return {
        type: 'dimensioned',
        unit: a.unit,
        id: 0,
        expression: {
          type: 'literal',
          position: 0,
          id: 0,
          value: (a.expression.value as number) / (b.value as number),
        },
      }

    }

    if (a.type === 'literal' && b.type === 'dimensioned') {

      // console.info("DIV4", a.value, b.unit.name, b.expression);

      if (b.expression.type !== 'literal') {
        throw new Error('b not resolved in /');
      }

      return {
        type: 'dimensioned',
        unit: b.unit,
        id: 0,
        expression: {
          type: 'literal',
          position: 0,
          id: 0,
          value: (a.value as number) / (b.expression.value as number),
        },
      }

    }

    throw new Error('invalid operand type in /');

  }

  public Multiply(a: ExpressionUnit, b: ExpressionUnit): UnitLiteral|UnitDimensionedQuantity {

    // console.info("MULT", a.type, b.type);

    // for multiply, we can have 0 or 1 dimensioned quantities (for this
    // use case, we don't support squared units).

    if (a.type === 'literal' && b.type === 'literal') {
      return {
        type: 'literal',
        position: 0,
        id: 0,
        value: (a.value as number) * (b.value as number),
      }
    }

    // swap so we only handle one case

    if (a.type === 'dimensioned' && b.type === 'literal') {
      const temp = a;
      a = b;
      b = temp;
    }

    if (a.type === 'literal' && b.type === 'dimensioned') {

      if (b.expression.type !== 'literal') {
        throw new Error('dimensioned quantity is not resolved in *');
      }

      return {
        type: 'dimensioned',
        id: 0,
        unit: b.unit,
        expression: {
          type: 'literal',
          position: 0,
          id: 0,
          value: (a.value as number) * (b.expression.value as number),
        }
      };
    }

    throw new Error('dimension mismatch in *');

  }

  public Add(a: ExpressionUnit, b: ExpressionUnit, sign = 1): UnitLiteral|UnitDimensionedQuantity {

    // add/subtract must have the same unit type. unfortunately 
    // ts can't figure this out if we first check for ===, so we 
    // might as well do the explicit tests first

    // FIXME: check that these are numeric? (...)

    if (a.type === 'literal' && b.type === 'literal') { // bad typescript
      return {
        type: 'literal',
        position: 0,
        id: 0,
        value: (a.value as number) + (b.value as number) * sign,
      }
    }
    
    if (a.type === 'dimensioned' && b.type === 'dimensioned') {

      a = this.Convert(a);
      b = this.Convert(b);

      if (a.unit.name !== b.unit.name) {
        throw new Error('unit mismatch in +/-');
      }

      if (a.expression.type !== 'literal') {
        throw new Error('a is not resolved in +/-');
      }
      if (b.expression.type !== 'literal') {
        throw new Error('b is not resolved in +/-');
      }

      return {
        type: 'dimensioned',
        id: 0,
        unit: a.unit,
        expression: {
          type: 'literal',
          position: 0,
          id: 0,
          value: (a.expression.value as number) + (b.expression.value as number) * sign,
        },
      }

    }

    throw new Error('dimension mismatch in +/- (add/subtract can only take 2 dimensioned or 2 literal values)');

  }

  public CalculateUnary(expression: UnitUnary): ExpressionUnit {

    switch (expression.operator) {
      case '-':
        if (expression.operand.type !== 'literal') {
          throw new Error('invalid operand in unary expression: ' + expression.operand.type);
        }
        return {
          ...expression.operand,
          value: -1 * (expression.operand.value as number),
        }
        break;

      case '+':
        return expression.operand; // basically identity

      default:
        throw new Error('invalid unary operator: ' + expression.operator);
    }
    
  }

  public CalculateBinary(expression: UnitBinary): ExpressionUnit {

    switch (expression.operator) {
      case '+':
        return this.Add(expression.left, expression.right, 1);

      case '-':
        return this.Add(expression.left, expression.right, -1);

      case '*':
        return this.Multiply(expression.left, expression.right);

      case '/': 
        return this.Divide(expression.left, expression.right); 

      default:
        throw new Error('invalid binary operator: ' + expression.operator);
    }

    throw new Error('ENOTIMPL');

  }

}
