import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

AddExtendedFunction('BASE', {
  description: 'Converts a number into a text representation with the given radix (base)',
  arguments: [
    { name: 'number', description: 'The number to convert', unroll: true },
    { name: 'radix', description: 'The base (2-36)' },
    { name: 'min_length', description: 'Minimum length of the returned string' },
  ],
  fn: (num?: number, radix?: number, min_length?: number): UnionValue => {
    if (num === undefined || radix === undefined) return ValueError();
    num = Math.trunc(num);
    radix = Math.trunc(radix);
    if (num < 0 || radix < 2 || radix > 36) return ValueError();
    let result = num.toString(radix).toUpperCase();
    if (min_length !== undefined) {
      min_length = Math.trunc(min_length);
      if (min_length > 0) {
        result = result.padStart(min_length, '0');
      }
    }
    return Box(result);
  },
});

AddExtendedFunction('DECIMAL', {
  description: 'Converts a text representation of a number in a given base into a decimal number',
  arguments: [
    { name: 'text', description: 'The text to convert', unroll: true },
    { name: 'radix', description: 'The base (2-36)' },
  ],
  fn: (text?: string, radix?: number): UnionValue => {
    if (text === undefined || radix === undefined) return ValueError();
    radix = Math.trunc(radix);
    if (radix < 2 || radix > 36) return ValueError();
    const result = parseInt(String(text), radix);
    if (isNaN(result)) return ValueError();
    return Box(result);
  },
});
