import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { DivideByZeroError, ValueError } from 'treb-calculator';

AddExtendedFunction('EVEN', {
  description: 'Rounds a number up to the nearest even integer',
  arguments: [
    { name: 'number', description: 'The number to round', unroll: true },
  ],
  fn: (n?: number): UnionValue => {
    if (n === undefined) return ValueError();
    if (n === 0) return Box(0);
    return Box(Math.sign(n) * Math.ceil(Math.abs(n) / 2) * 2);
  },
});

AddExtendedFunction('ODD', {
  description: 'Rounds a number up to the nearest odd integer',
  arguments: [
    { name: 'number', description: 'The number to round', unroll: true },
  ],
  fn: (n?: number): UnionValue => {
    if (n === undefined) return ValueError();
    if (n === 0) return Box(1);
    const sign = Math.sign(n);
    const abs = Math.abs(n);
    const rounded = Math.ceil(abs);
    const result = rounded % 2 === 0 ? rounded + 1 : rounded;
    return Box(sign * result);
  },
});

AddExtendedFunction('QUOTIENT', {
  description: 'Returns the integer portion of a division',
  arguments: [
    { name: 'numerator', description: 'The dividend', unroll: true },
    { name: 'denominator', description: 'The divisor' },
  ],
  fn: (numerator?: number, denominator?: number): UnionValue => {
    if (numerator === undefined || denominator === undefined) return ValueError();
    if (denominator === 0) return DivideByZeroError();
    return Box(Math.trunc(numerator / denominator));
  },
});

AddExtendedFunction('MROUND', {
  description: 'Returns a number rounded to the desired multiple',
  arguments: [
    { name: 'number', description: 'The number to round', unroll: true },
    { name: 'multiple', description: 'The multiple to round to' },
  ],
  fn: (n?: number, multiple?: number): UnionValue => {
    if (n === undefined || multiple === undefined) return ValueError();
    if (multiple === 0) return Box(0);
    if (n > 0 && multiple < 0 || n < 0 && multiple > 0) return ValueError();
    return Box(Math.round(n / multiple) * multiple);
  },
});

const ceilingPrecise = (n?: number, significance?: number): UnionValue => {
  if (n === undefined) return ValueError();
  if (significance === undefined) significance = 1;
  if (significance === 0) return Box(0);
  const s = Math.abs(significance);
  return Box(Math.ceil(n / s) * s);
};

AddExtendedFunction('CEILING.PRECISE', {
  description: 'Rounds a number up to the nearest integer or multiple of significance',
  arguments: [
    { name: 'number', description: 'The number to round', unroll: true },
    { name: 'significance', description: 'The multiple to round to (default 1)' },
  ],
  fn: ceilingPrecise,
});

AddExtendedFunction('ISO.CEILING', {
  description: 'Rounds a number up to the nearest integer or multiple of significance',
  arguments: [
    { name: 'number', description: 'The number to round', unroll: true },
    { name: 'significance', description: 'The multiple to round to (default 1)' },
  ],
  fn: ceilingPrecise,
});

AddExtendedFunction('FLOOR.PRECISE', {
  description: 'Rounds a number down to the nearest integer or multiple of significance',
  arguments: [
    { name: 'number', description: 'The number to round', unroll: true },
    { name: 'significance', description: 'The multiple to round to (default 1)' },
  ],
  fn: (n?: number, significance?: number): UnionValue => {
    if (n === undefined) return ValueError();
    if (significance === undefined) significance = 1;
    if (significance === 0) return Box(0);
    const s = Math.abs(significance);
    return Box(Math.floor(n / s) * s);
  },
});
