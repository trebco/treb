import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

AddExtendedFunction('PROPER', {
  description: 'Capitalizes the first letter of each word in a text string',
  arguments: [
    { name: 'text', description: 'The text to capitalize', unroll: true },
  ],
  fn: (text?: string): UnionValue => {
    if (text === undefined) return ValueError();
    const s = String(text).toLowerCase();
    return Box(s.replace(/(^|[^a-zA-ZÀ-ɏ])([a-zà-ÿ])/g, (_, before, ch) => before + ch.toUpperCase()));
  },
});

AddExtendedFunction('TRIM', {
  description: 'Removes extra spaces from text',
  arguments: [
    { name: 'text', description: 'The text to trim', unroll: true },
  ],
  fn: (text?: string): UnionValue => {
    if (text === undefined) return ValueError();
    return Box(String(text).trim().replace(/ +/g, ' '));
  },
});

AddExtendedFunction('REPT', {
  description: 'Repeats text a given number of times',
  arguments: [
    { name: 'text', description: 'The text to repeat', unroll: true },
    { name: 'number_times', description: 'Number of times to repeat' },
  ],
  fn: (text?: string, times?: number): UnionValue => {
    if (text === undefined || times === undefined) return ValueError();
    times = Math.trunc(times);
    if (times < 0) return ValueError();
    return Box(String(text).repeat(times));
  },
});

AddExtendedFunction('CLEAN', {
  description: 'Removes all non-printable characters from text',
  arguments: [
    { name: 'text', description: 'The text to clean', unroll: true },
  ],
  fn: (text?: string): UnionValue => {
    if (text === undefined) return ValueError();
    return Box(String(text).replace(/[\x00-\x1F]/g, ''));
  },
});

AddExtendedFunction('UNICHAR', {
  description: 'Returns the Unicode character for a given code point',
  arguments: [
    { name: 'number', description: 'The Unicode code point', unroll: true },
  ],
  fn: (num?: number): UnionValue => {
    if (num === undefined) return ValueError();
    num = Math.trunc(num);
    if (num < 1 || num > 1114111) return ValueError();
    return Box(String.fromCodePoint(num));
  },
});

AddExtendedFunction('UNICODE', {
  description: 'Returns the code point of the first character in a text string',
  arguments: [
    { name: 'text', description: 'The text', unroll: true },
  ],
  fn: (text?: string): UnionValue => {
    if (text === undefined) return ValueError();
    const s = String(text);
    if (s.length === 0) return ValueError();
    return Box(s.codePointAt(0)!);
  },
});

AddExtendedFunction('REPLACE', {
  description: 'Replaces part of a text string with a different text string',
  arguments: [
    { name: 'old_text', description: 'The original text' },
    { name: 'start_num', description: 'Position of the first character to replace (1-based)' },
    { name: 'num_chars', description: 'Number of characters to replace' },
    { name: 'new_text', description: 'The replacement text' },
  ],
  fn: (old_text?: string, start_num?: number, num_chars?: number, new_text?: string): UnionValue => {
    if (old_text === undefined || start_num === undefined || num_chars === undefined || new_text === undefined) {
      return ValueError();
    }
    const s = String(old_text);
    const start = Math.trunc(start_num) - 1;
    const count = Math.trunc(num_chars);
    return Box(s.substring(0, start) + String(new_text) + s.substring(start + count));
  },
});

AddExtendedFunction('T', {
  description: 'Returns the text referred to by value, or empty string if not text',
  arguments: [
    { name: 'value', description: 'The value to test', boxed: true },
  ],
  fn: (value?: UnionValue): UnionValue => {
    if (value && value.type === ValueType.string) {
      return value;
    }
    return Box('');
  },
});
