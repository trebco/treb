import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

const roman_pairs: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

const roman_values: Record<string, number> = {
  I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
};

AddExtendedFunction('ROMAN', {
  description: 'Converts an Arabic numeral to Roman as text',
  arguments: [
    { name: 'number', description: 'The number to convert', unroll: true },
    { name: 'form', description: 'The type of Roman numeral (0-4, default 0)' },
  ],
  fn: (num?: number, _form?: number | boolean): UnionValue => {
    if (num === undefined) return ValueError();
    num = Math.trunc(num);
    if (num < 0 || num > 3999) return ValueError();
    if (num === 0) return Box('');

    let result = '';
    let remaining = num;
    for (const [value, symbol] of roman_pairs) {
      while (remaining >= value) {
        result += symbol;
        remaining -= value;
      }
    }
    return Box(result);
  },
});

AddExtendedFunction('ARABIC', {
  description: 'Converts a Roman numeral text to a number',
  arguments: [
    { name: 'text', description: 'The Roman numeral string', unroll: true },
  ],
  fn: (text?: string): UnionValue => {
    if (text === undefined || text === '') return Box(0);

    const s = String(text).trim().toUpperCase();
    if (s === '') return Box(0);

    let negative = false;
    let start = 0;
    if (s[0] === '-') {
      negative = true;
      start = 1;
    }

    let total = 0;
    for (let i = start; i < s.length; i++) {
      const current = roman_values[s[i]];
      if (current === undefined) return ValueError();
      const next = i + 1 < s.length ? roman_values[s[i + 1]] : 0;
      if (next > current) {
        total -= current;
      } else {
        total += current;
      }
    }

    return Box(negative ? -total : total);
  },
});
