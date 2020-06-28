
import { NumberFormatCache } from '../src/format_cache';
import { NumberFormat } from '../src/format';

test('cache number format', () => {

  expect(NumberFormatCache.Get('0').Format(100)).toEqual(new NumberFormat('0').Format(100));
  expect(NumberFormatCache.Get('0%').Format(.99)).toEqual(new NumberFormat('0%').Format(.99));

});

test('built in formats', () => {

  expect(NumberFormatCache.Get('Integer')).toEqual(NumberFormatCache.Get('0'));
  expect(NumberFormatCache.Get('Number')).toEqual(NumberFormatCache.Get('0.00'));
  expect(NumberFormatCache.Get('Percent')).toEqual(NumberFormatCache.Get('0.00%'));

  // symbolic name icase
  expect(NumberFormatCache.Get('percent')).toEqual(NumberFormatCache.Get('PERCENT'));

});

test('custom formats', () => {

  // format not icase
  expect(NumberFormatCache.Get('mmm')).not.toEqual(NumberFormatCache.Get('MMM'));

});

test('cache operations', () => {

  // cache name -> string
  expect(NumberFormatCache.Translate('general')).toBe('0.00###');
  expect(NumberFormatCache.Translate('0,0')).toBe('0,0');
  expect(NumberFormatCache.Translate('General')).toEqual(NumberFormatCache.Translate('0.00###'));

  // icase
  expect(NumberFormatCache.Translate('General')).toBe('0.00###');

  // names
  expect(NumberFormatCache.SymbolicName('0.00%')).toBe('Percent');
  expect(NumberFormatCache.SymbolicName('0.000%')).toBeNull();

  // equals
  expect(NumberFormatCache.Equals('0', '0')).toBe(true);
  expect(NumberFormatCache.Equals('0.00###', 'General')).toBe(true);

  // icase
  expect(NumberFormatCache.Equals('0.00###', 'general')).toBe(true);

});
