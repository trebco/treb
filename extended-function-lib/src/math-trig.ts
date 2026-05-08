import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { DivideByZeroError, ValueError } from 'treb-calculator';

AddExtendedFunction('COT', {
  description: 'Returns the cotangent of an angle',
  arguments: [
    { name: 'number', description: 'The angle in radians', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    const s = Math.sin(x);
    if (s === 0) return DivideByZeroError();
    return Box(Math.cos(x) / s);
  },
});

AddExtendedFunction('COTH', {
  description: 'Returns the hyperbolic cotangent of a number',
  arguments: [
    { name: 'number', description: 'The number', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    if (x === 0) return DivideByZeroError();
    return Box(Math.cosh(x) / Math.sinh(x));
  },
});

AddExtendedFunction('CSC', {
  description: 'Returns the cosecant of an angle',
  arguments: [
    { name: 'number', description: 'The angle in radians', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    const s = Math.sin(x);
    if (s === 0) return DivideByZeroError();
    return Box(1 / s);
  },
});

AddExtendedFunction('CSCH', {
  description: 'Returns the hyperbolic cosecant of a number',
  arguments: [
    { name: 'number', description: 'The number', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    if (x === 0) return DivideByZeroError();
    return Box(1 / Math.sinh(x));
  },
});

AddExtendedFunction('SEC', {
  description: 'Returns the secant of an angle',
  arguments: [
    { name: 'number', description: 'The angle in radians', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    const c = Math.cos(x);
    if (c === 0) return DivideByZeroError();
    return Box(1 / c);
  },
});

AddExtendedFunction('SECH', {
  description: 'Returns the hyperbolic secant of a number',
  arguments: [
    { name: 'number', description: 'The number', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    return Box(1 / Math.cosh(x));
  },
});

AddExtendedFunction('ACOT', {
  description: 'Returns the arc cotangent of a number',
  arguments: [
    { name: 'number', description: 'The number', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    return Box(Math.PI / 2 - Math.atan(x));
  },
});

AddExtendedFunction('ACOTH', {
  description: 'Returns the inverse hyperbolic cotangent of a number',
  arguments: [
    { name: 'number', description: 'The number', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    if (Math.abs(x) <= 1) return ValueError();
    return Box(Math.atanh(1 / x));
  },
});

AddExtendedFunction('SQRTPI', {
  description: 'Returns the square root of (number * PI)',
  arguments: [
    { name: 'number', description: 'The number to multiply by PI', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    if (x < 0) return ValueError();
    return Box(Math.sqrt(x * Math.PI));
  },
});
