
import {NumberFormatCache} from './format_cache';

test('built-in formats: accounting', () => {
  expect(NumberFormatCache.Get('accounting').Format(1234567)).toBe(' 1,234,567.00 ');
  expect(NumberFormatCache.Get('accounting').Format(-1233)).toBe('(1,233.00)');
  expect(NumberFormatCache.Get('accounting').Format(999.999)).toBe(' 1,000.00 ');
  expect(NumberFormatCache.Get('accounting').Format(0)).toBe('-   ');
});

test('built-in formats: percent', () => {
  expect(NumberFormatCache.Get('percent').Format(1)).toBe('100.00%');
  expect(NumberFormatCache.Get('percent').Format(.1)).toBe('10.00%');
  expect(NumberFormatCache.Get('percent').Format(.123)).toBe('12.30%');
  expect(NumberFormatCache.Get('percent').Format(0)).toBe('0.00%');
  expect(NumberFormatCache.Get('percent').Format(-.32123)).toBe('-32.12%');
});

test('built-in formats: exponential', () => {
  expect(NumberFormatCache.Get('exponential').Format(12.34e5)).toBe('1.234e+6');
});

test('built-in formats: general', () => {
  expect(NumberFormatCache.Get('general').Format(0)).toBe('0.00');
  expect(NumberFormatCache.Get('general').Format(1)).toBe('1.00');
  expect(NumberFormatCache.Get('general').Format(1.2)).toBe('1.20');
  expect(NumberFormatCache.Get('general').Format(1.23)).toBe('1.23');
  expect(NumberFormatCache.Get('general').Format(1.234)).toBe('1.234');
  expect(NumberFormatCache.Get('general').Format(1.2345)).toBe('1.2345');
  expect(NumberFormatCache.Get('general').Format(12345)).toBe('12345.00');
});

test('cache', () => {
  expect(NumberFormatCache.Get('0.00###')).toStrictEqual(NumberFormatCache.Get('general'));
  expect(NumberFormatCache.Get('exponential')).toStrictEqual(NumberFormatCache.Get('scientific'));
  expect(NumberFormatCache.Translate('general')).toBe('0.00###');
  expect(NumberFormatCache.Translate('0,0')).toBe('0,0');
  expect(NumberFormatCache.SymbolicName('0.00%')).toBe('percent');
  expect(NumberFormatCache.SymbolicName('0.000%')).toBeNull();
  expect(NumberFormatCache.Equals('0', '0')).toBe(true);
  expect(NumberFormatCache.Equals('0.00###', 'general')).toBe(true);
  expect(NumberFormatCache.Equals('0.00####', 'general')).toBe(false);
});
