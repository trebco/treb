import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

function ParseTwosComplement(text: string, bits: number, radix: number): number {
  const max_unsigned = radix ** (bits / Math.log2(radix));
  const val = parseInt(text, radix);
  if (isNaN(val) || val < 0) return NaN;
  if (val >= max_unsigned) return NaN;
  const half = max_unsigned / 2;
  return val >= half ? val - max_unsigned : val;
}

function ToTwosComplement(num: number, bits: number, radix: number): string {
  const max_unsigned = 2 ** bits;
  if (num < 0) num += max_unsigned;
  const digits = Math.ceil(bits / Math.log2(radix));
  return num.toString(radix).toUpperCase().padStart(digits, '0');
}

function FormatWithPlaces(text: string, places?: number): string {
  if (places === undefined) return text;
  places = Math.trunc(places);
  if (places < 0) return text;
  return text.padStart(places, '0');
}

function ValidateBinary(text: string): boolean {
  return /^[01]{1,10}$/.test(text);
}

function ValidateOctal(text: string): boolean {
  return /^[0-7]{1,10}$/.test(text);
}

function ValidateHex(text: string): boolean {
  return /^[0-9A-Fa-f]{1,10}$/.test(text);
}

AddExtendedFunction('BIN2DEC', {
  description: 'Converts a binary number to decimal',
  arguments: [
    { name: 'number', description: 'The binary number as text', unroll: true },
  ],
  fn: (number?: string | number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateBinary(text)) return ValueError();
    const val = ParseTwosComplement(text, 10, 2);
    if (isNaN(val)) return ValueError();
    return Box(val);
  },
});

AddExtendedFunction('BIN2OCT', {
  description: 'Converts a binary number to octal',
  arguments: [
    { name: 'number', description: 'The binary number as text', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: string | number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateBinary(text)) return ValueError();
    const val = ParseTwosComplement(text, 10, 2);
    if (isNaN(val)) return ValueError();
    const result = ToTwosComplement(val, 30, 8);
    const trimmed = val < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('BIN2HEX', {
  description: 'Converts a binary number to hexadecimal',
  arguments: [
    { name: 'number', description: 'The binary number as text', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: string | number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateBinary(text)) return ValueError();
    const val = ParseTwosComplement(text, 10, 2);
    if (isNaN(val)) return ValueError();
    const result = ToTwosComplement(val, 40, 16);
    const trimmed = val < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('OCT2DEC', {
  description: 'Converts an octal number to decimal',
  arguments: [
    { name: 'number', description: 'The octal number as text', unroll: true },
  ],
  fn: (number?: string | number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateOctal(text)) return ValueError();
    const val = ParseTwosComplement(text, 30, 8);
    if (isNaN(val)) return ValueError();
    return Box(val);
  },
});

AddExtendedFunction('OCT2BIN', {
  description: 'Converts an octal number to binary',
  arguments: [
    { name: 'number', description: 'The octal number as text', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: string | number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateOctal(text)) return ValueError();
    const val = ParseTwosComplement(text, 30, 8);
    if (isNaN(val)) return ValueError();
    if (val < -512 || val > 511) return ValueError();
    const result = ToTwosComplement(val, 10, 2);
    const trimmed = val < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('OCT2HEX', {
  description: 'Converts an octal number to hexadecimal',
  arguments: [
    { name: 'number', description: 'The octal number as text', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: string | number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateOctal(text)) return ValueError();
    const val = ParseTwosComplement(text, 30, 8);
    if (isNaN(val)) return ValueError();
    const result = ToTwosComplement(val, 40, 16);
    const trimmed = val < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('DEC2BIN', {
  description: 'Converts a decimal number to binary',
  arguments: [
    { name: 'number', description: 'The decimal number', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const num = Math.trunc(number);
    if (num < -512 || num > 511) return ValueError();
    const result = ToTwosComplement(num, 10, 2);
    const trimmed = num < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('DEC2OCT', {
  description: 'Converts a decimal number to octal',
  arguments: [
    { name: 'number', description: 'The decimal number', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const num = Math.trunc(number);
    if (num < -536870912 || num > 536870911) return ValueError();
    const result = ToTwosComplement(num, 30, 8);
    const trimmed = num < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('DEC2HEX', {
  description: 'Converts a decimal number to hexadecimal',
  arguments: [
    { name: 'number', description: 'The decimal number', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const num = Math.trunc(number);
    if (num < -549755813888 || num > 549755813887) return ValueError();
    const result = ToTwosComplement(num, 40, 16);
    const trimmed = num < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('HEX2DEC', {
  description: 'Converts a hexadecimal number to decimal',
  arguments: [
    { name: 'number', description: 'The hexadecimal number as text', unroll: true },
  ],
  fn: (number?: string | number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateHex(text)) return ValueError();
    const val = ParseTwosComplement(text, 40, 16);
    if (isNaN(val)) return ValueError();
    return Box(val);
  },
});

AddExtendedFunction('HEX2BIN', {
  description: 'Converts a hexadecimal number to binary',
  arguments: [
    { name: 'number', description: 'The hexadecimal number as text', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: string | number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateHex(text)) return ValueError();
    const val = ParseTwosComplement(text, 40, 16);
    if (isNaN(val)) return ValueError();
    if (val < -512 || val > 511) return ValueError();
    const result = ToTwosComplement(val, 10, 2);
    const trimmed = val < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});

AddExtendedFunction('HEX2OCT', {
  description: 'Converts a hexadecimal number to octal',
  arguments: [
    { name: 'number', description: 'The hexadecimal number as text', unroll: true },
    { name: 'places', description: 'Number of characters to use' },
  ],
  fn: (number?: string | number, places?: number): UnionValue => {
    if (number === undefined) return ValueError();
    const text = String(number);
    if (!ValidateHex(text)) return ValueError();
    const val = ParseTwosComplement(text, 40, 16);
    if (isNaN(val)) return ValueError();
    if (val < -536870912 || val > 536870911) return ValueError();
    const result = ToTwosComplement(val, 30, 8);
    const trimmed = val < 0 ? result : result.replace(/^0+/, '') || '0';
    return Box(FormatWithPlaces(trimmed, places));
  },
});
