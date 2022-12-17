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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

// import { Parser, UnitLiteral, UnitBinary, UnitUnary, DecimalMarkType, UnitCall, ArgumentSeparatorType } from '../';
import { Parser } from './parser';
import { ArgumentSeparatorType,
  UnitLiteral, UnitBinary, UnitUnary, DecimalMarkType, UnitCall } from './parser-types';

const parser = new Parser();

test('constructor', () => {
  expect(typeof parser).toBe('object');
});

describe('basic parsing', () => {

  test('3 + 4', () => {
    const result = parser.Parse('3 + 4');
    expect(result).toBeDefined();
    expect(result.valid).toBeTruthy();
  });

  test('/ 2', () => {
    const result = parser.Parse('/ 2');
    expect(result).toBeDefined();
    expect(result.valid).toBeFalsy();
  });

});

describe('parsing/rendering', () => {

  const expression = '2.2 + (3 / foo(bar("1"), 8))';
  test(expression, () => {
    const result = parser.Parse(expression);
    expect(result.valid).toBeTruthy();
    expect(result.expression).toBeDefined();
    if (result.expression){
      const rendered = parser.Render(result.expression);
      expect(rendered).toEqual(expression);
    }
  });

  test('converting separators', () => {
    const result = parser.Parse(expression);
    expect(result.valid).toBeTruthy();
    expect(result.expression).toBeDefined();
    if (result.expression){
      const rendered = parser.Render(result.expression,
        undefined, undefined, DecimalMarkType.Comma, ArgumentSeparatorType.Semicolon);
      expect(rendered).toEqual('2,2 + (3 / foo(bar("1"); 8))');
    }
  });

});

describe('number parsing', () => {

  const decimals = [1, 1.11, 2.2343, 123819238, -6, -7.77, -0.00012];

  decimals.forEach((decimal) => {
    const as_string = decimal.toString();
    test(as_string, () => {
    const result = parser.Parse(as_string);
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
        expect(result.expression.type).toBe('literal');
        expect((result.expression as UnitLiteral).value).toBeCloseTo(decimal);
      }
    });
  });

  test('2.2e-7', () => {
    const result = parser.Parse('2.2e-7');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('literal');
      expect((result.expression as UnitLiteral).value).toBeCloseTo(2.2e-7);
    }
  });

  test('-1.123e8', () => {
    const result = parser.Parse('-1.123e8');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('literal');
      expect((result.expression as UnitLiteral).value).toBeCloseTo(-1.123e8);
    }
  });

  test('33.33%', () => {
    const result = parser.Parse('33.33%');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('literal');
      expect((result.expression as UnitLiteral).value).toBeCloseTo(.3333);
    }
  });

});

describe('comma decimal parsing', () => {

  test('1,23', () => {
    parser.decimal_mark = DecimalMarkType.Comma;
    const result = parser.Parse('1,23');
    parser.decimal_mark = DecimalMarkType.Period;
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('literal');
      expect((result.expression as UnitLiteral).value).toBeCloseTo(1.23);
    }
  });

  test('-2231,909', () => {
    parser.decimal_mark = DecimalMarkType.Comma;
    const result = parser.Parse('-2231,909');
    parser.decimal_mark = DecimalMarkType.Period;
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('literal');
      expect((result.expression as UnitLiteral).value).toBeCloseTo(-2231.909);
    }
  });
});

describe('unary operators', () => {

  test('2 + -3', () => {
    const result = parser.Parse('2 + -3');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('binary');
      const right = (result.expression as UnitBinary).right;
      expect(right).toBeDefined();
      if (right){
        expect(right.type).toBe('unary');
        const unary = (right as UnitUnary);
        expect(unary.operator).toBe('-');
        expect(unary.operand.type).toBe('literal');
        expect((unary.operand as UnitLiteral).value).toBeCloseTo(3);
      }
    }
  });

  test('op() / +3', () => {
    const result = parser.Parse('op() / +3');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('binary');
      const right = (result.expression as UnitBinary).right;
      expect(right).toBeDefined();
      if (right){
        expect(right.type).toBe('unary');
        const unary = (right as UnitUnary);
        expect(unary.operator).toBe('+');
        expect(unary.operand.type).toBe('literal');
        expect((unary.operand as UnitLiteral).value).toBeCloseTo(3);
      }
    }
  });
});

describe('binary operators', () => {

  test('10 * 8', () => {
    const result = parser.Parse('10 * 8');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('binary');
      const binary = result.expression as UnitBinary;
      expect(binary.operator).toBe('*');
      expect((binary.left as UnitLiteral).value).toBe(10);
      expect((binary.right as UnitLiteral).value).toBe(8);
    }
  });

});

describe('grouping/ordering', () => {
  test('(2 / (1 + (2 * 3))) * 4', () => {
    const result = parser.Parse('(2 / (1 + (2 * 3))) * 4');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression){
      expect(result.expression.type).toBe('binary');
      const binary = result.expression as UnitBinary;
      expect(binary.right.type).toBe('literal');
      expect((binary.right as UnitLiteral).value).toBe(4);
      expect(binary.left.type).toBe('group');
    }
  });
});

describe('function calls', () => {

  test('foo()', () => {
    const result = parser.Parse('foo()');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('call');
      const call = result.expression as UnitCall;
      expect(call.name).toBe('foo');
      expect(call.args.length).toBe(0);
    }
  });

  test('oof(1, "bar", 3.3)', () => {
    const result = parser.Parse('oof(1, "bar", 3.3)');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('call');
      const call = result.expression as UnitCall;
      expect(call.name).toBe('oof');
      expect(call.args.length).toBe(3);
      if (call.args.length === 3){
        expect(call.args[0].type).toBe('literal');
        expect((call.args[0] as UnitLiteral).value).toBe(1);
        expect(call.args[1].type).toBe('literal');
        expect((call.args[1] as UnitLiteral).value).toBe('bar');
        expect(call.args[2].type).toBe('literal');
        expect((call.args[2] as UnitLiteral).value).toBe(3.3);
      }
    }
  });

});

describe('addresses', () => {
  test('=A1 + $B2 - C$3 - $ZZ$40', () => {
    const result = parser.Parse('=A1 + $B2 - C$3 - $ZZ$40');
    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(parser.Render(result.expression)).toBe('A1 + $B2 - C$3 - $ZZ$40');
    }
  });
});

describe('semicolon-separated arguments', () => {

  test('xfoo(1; "xbar"; 3,33)', () => {
    parser.decimal_mark = DecimalMarkType.Comma;
    parser.argument_separator = ArgumentSeparatorType.Semicolon;
    const result = parser.Parse('xfoo(1; "xbar"; 3,33)');
    parser.decimal_mark = DecimalMarkType.Period;
    parser.argument_separator = ArgumentSeparatorType.Comma;

    expect(result).toBeDefined();
    expect(result.expression).toBeDefined();
    if (result.expression) {
      expect(result.expression.type).toBe('call');
      const call = result.expression as UnitCall;
      expect(call.name).toBe('xfoo');
      expect(call.args.length).toBe(3);
      if (call.args.length === 3){
        expect(call.args[0].type).toBe('literal');
        expect((call.args[0] as UnitLiteral).value).toBe(1);
        expect(call.args[1].type).toBe('literal');
        expect((call.args[1] as UnitLiteral).value).toBe('xbar');
        expect(call.args[2].type).toBe('literal');
        expect((call.args[2] as UnitLiteral).value).toBeCloseTo(3.33);
      }
    }
  });

});


