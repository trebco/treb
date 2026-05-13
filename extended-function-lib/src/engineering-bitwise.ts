import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

AddExtendedFunction('BITAND', {
  description: 'Returns a bitwise AND of two numbers',
  arguments: [
    { name: 'number1', description: 'The first number', unroll: true },
    { name: 'number2', description: 'The second number' },
  ],
  fn: (a?: number, b?: number): UnionValue => {
    if (a === undefined || b === undefined) return ValueError();
    a = Math.trunc(a);
    b = Math.trunc(b);
    if (a < 0 || b < 0 || a > 281474976710655 || b > 281474976710655) return ValueError();
    return Box(Number(BigInt(a) & BigInt(b)));
  },
});

AddExtendedFunction('BITOR', {
  description: 'Returns a bitwise OR of two numbers',
  arguments: [
    { name: 'number1', description: 'The first number', unroll: true },
    { name: 'number2', description: 'The second number' },
  ],
  fn: (a?: number, b?: number): UnionValue => {
    if (a === undefined || b === undefined) return ValueError();
    a = Math.trunc(a);
    b = Math.trunc(b);
    if (a < 0 || b < 0 || a > 281474976710655 || b > 281474976710655) return ValueError();
    return Box(Number(BigInt(a) | BigInt(b)));
  },
});

AddExtendedFunction('BITXOR', {
  description: 'Returns a bitwise XOR of two numbers',
  arguments: [
    { name: 'number1', description: 'The first number', unroll: true },
    { name: 'number2', description: 'The second number' },
  ],
  fn: (a?: number, b?: number): UnionValue => {
    if (a === undefined || b === undefined) return ValueError();
    a = Math.trunc(a);
    b = Math.trunc(b);
    if (a < 0 || b < 0 || a > 281474976710655 || b > 281474976710655) return ValueError();
    return Box(Number(BigInt(a) ^ BigInt(b)));
  },
});

AddExtendedFunction('BITLSHIFT', {
  description: 'Returns a number shifted left by a specified number of bits',
  arguments: [
    { name: 'number', description: 'The number to shift', unroll: true },
    { name: 'shift_amount', description: 'Number of bits to shift' },
  ],
  fn: (num?: number, shift?: number): UnionValue => {
    if (num === undefined || shift === undefined) return ValueError();
    num = Math.trunc(num);
    shift = Math.trunc(shift);
    if (num < 0 || num > 281474976710655) return ValueError();
    const result = Number(BigInt(num) << BigInt(shift));
    if (result < 0 || result > 281474976710655) return ValueError();
    return Box(result);
  },
});

AddExtendedFunction('BITRSHIFT', {
  description: 'Returns a number shifted right by a specified number of bits',
  arguments: [
    { name: 'number', description: 'The number to shift', unroll: true },
    { name: 'shift_amount', description: 'Number of bits to shift' },
  ],
  fn: (num?: number, shift?: number): UnionValue => {
    if (num === undefined || shift === undefined) return ValueError();
    num = Math.trunc(num);
    shift = Math.trunc(shift);
    if (num < 0 || num > 281474976710655) return ValueError();
    const result = Number(BigInt(num) >> BigInt(shift));
    if (result < 0 || result > 281474976710655) return ValueError();
    return Box(result);
  },
});

AddExtendedFunction('GESTEP', {
  description: 'Tests whether a number is greater than or equal to a step value',
  arguments: [
    { name: 'number', description: 'The value to test', unroll: true },
    { name: 'step', description: 'The threshold value (default 0)' },
  ],
  fn: (num?: number, step?: number): UnionValue => {
    if (num === undefined) return ValueError();
    step = step ?? 0;
    return Box(num >= step ? 1 : 0);
  },
});
