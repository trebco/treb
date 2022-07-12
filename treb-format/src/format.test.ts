/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import {NumberFormat} from './format';

test('integer format: "0"', () => {
  const integer_format = new NumberFormat('0');
  expect(integer_format.Format(0)).toBe('0');
  expect(integer_format.Format(100)).toBe('100');
  expect(integer_format.Format(9.9)).toBe('10');
  expect(integer_format.Format(3.3)).toBe('3');
});

test('decimal format: "0.00"', () => {
  const decimal_format = new NumberFormat('0.00');
  expect(decimal_format.Format(0)).toBe('0.00');
  expect(decimal_format.Format(0.5)).toBe('0.50');
  expect(decimal_format.Format(3.33)).toBe('3.33');
  expect(decimal_format.Format(99.99)).toBe('99.99');
  expect(decimal_format.Format(99.999)).toBe('100.00');
});

test('scaling: #,##0, and #,##0,,', () => {
  const thousands_format = new NumberFormat('#,##0,');
  expect(thousands_format.Format(0)).toBe('0');
  expect(thousands_format.Format(20000)).toBe('20');
  expect(thousands_format.Format(20000000)).toBe('20,000');

  const millions_format = new NumberFormat('#,##0,,');
  expect(millions_format.Format(0)).toBe('0');
  expect(millions_format.Format(20000)).toBe('0');
  expect(millions_format.Format(20000000)).toBe('20');
});

test('grouping: "#,##0"', () => {
  const grouping_format = new NumberFormat('#,##0');
  expect(grouping_format.Format(0)).toBe('0');
  expect(grouping_format.Format(10000)).toBe('10,000');
  expect(grouping_format.Format(1000)).toBe('1,000');
  expect(grouping_format.Format(999999.9)).toBe('1,000,000');
});

test('digits', () => {
  const digits_format = new NumberFormat('0000');
  expect(digits_format.Format(0)).toBe('0000');
  expect(digits_format.Format(100)).toBe('0100');
});

test('sections', () => {
  const section_format = new NumberFormat('a 0;b 0;c 0;d 0');
  expect(section_format.Format(1)).toBe('a 1');
  expect(section_format.Format(-100)).toBe('b 100');
  expect(section_format.Format(0)).toBe('c 0');
  expect(section_format.Format('x')).toBe('d 0');
});

test('strings', () => {
  const string_format = new NumberFormat('1: @;2: @;3: @;4: @');
  expect(string_format.Format(1)).toBe('1: 1');
  expect(string_format.Format(-1)).toBe('2: -1');
  expect(string_format.Format(0)).toBe('3: 0');
  expect(string_format.Format('test')).toBe('4: test');
});

test('default string', () => {
  const a = new NumberFormat('0;-0;0;@');
  expect(a.Format(100)).toBe('100');

  const b = new NumberFormat('@');
  expect(b.Format(100)).toBe('100');

});

test('escape', () => {
  let escape_format = new NumberFormat('\\* 0');
  expect(escape_format.Format(100)).toBe('* 100');

  escape_format = new NumberFormat('mm/dd/yy \\*');
  expect(escape_format.Format(0)).toBe('12/31/69 *');

  expect(() => {
    escape_format = new NumberFormat('0 \\');
  }).toThrow();

  expect(() => {
    escape_format = new NumberFormat('mm/dd/yy \\');
  }).toThrow();
});

test('layout', () => {
  let layout_format = new NumberFormat('$* _(#,##0_);[red]$* (#,##0);$* -_)');
  expect(layout_format.Format(1, 12)).toBe('$         1 ');
  expect(layout_format.Format(0, 12)).toBe('$         - ');
  expect(layout_format.Format(999999.99, 12)).toBe('$ 1,000,000 ');
  expect(layout_format.Format(-3333, 12)).toBe('$    (3,333)');

  expect(() => {
    layout_format = new NumberFormat(' *');
  }).toThrow();

  expect(() => {
    layout_format = new NumberFormat(' _');
  }).toThrow();

  expect(() => {
    layout_format = new NumberFormat(' * * 0');
  }).toThrow();

  expect(() => {
    layout_format = new NumberFormat('mm/dd/yy *');
  }).toThrow();

  expect(() => {
    layout_format = new NumberFormat('mm/dd/yy _');
  }).toThrow();

  expect(() => {
    layout_format = new NumberFormat('mm/dd/yy * * ');
  }).toThrow();

});

test('short date', () => {
  const short_date_format = new NumberFormat('mm/dd/yy');
  expect(short_date_format.Format(0)).toBe('12/31/69');
  expect(short_date_format.Format(1)).toBe('01/01/70');
  expect(short_date_format.Format(3456.78)).toBe('06/19/79');
});

test('timestamp', () => {
  const timestamp_format = new NumberFormat('dddd mmmm dd, yyyy hh:mm:ss AM/PM');
  expect(timestamp_format.Format(0)).toBe('Wednesday December 31, 1969 04:00:00 PM');
  expect(timestamp_format.Format(1)).toBe('Thursday January 01, 1970 04:00:00 PM');
  expect(timestamp_format.Format(3456.78)).toBe('Tuesday June 19, 1979 11:43:12 AM');
});

test('short/long day/month', () => {
  const time_format = new NumberFormat('ddd DDD DDDD mmm mmmmm MMM MMMM');
  expect(time_format.Format(0)).toBe('Wed WED WEDNESDAY Dec D DEC DECEMBER');
  expect(time_format.Format(1)).toBe('Thu THU THURSDAY Jan J JAN JANUARY');
  expect(time_format.Format(3456.78)).toBe('Tue TUE TUESDAY Jun J JUN JUNE');
});

test('variable time fields', () => {
  const time_format = new NumberFormat('m d yyyy h:m:s');
  expect(time_format.Format(0)).toBe('12 31 1969 16:0:0');
  expect(time_format.Format(1)).toBe('1 1 1970 16:0:0');
  expect(time_format.Format(3456.78)).toBe('6 19 1979 11:43:12');
  expect(time_format.Format(5591.5008)).toBe('4 23 1985 4:1:9');
});

test('millis', () => {
  const millis_format = new NumberFormat('hh:mm:ss.00');
  expect(millis_format.Format(1.23456)).toBe('21:37:45.98');
});

test('mutation', () => {
  const base_format = new NumberFormat('0');
  expect(base_format.toString()).toBe('0');

  base_format.IncreaseDecimal();
  expect(base_format.toString()).toBe('0.0');
  base_format.IncreaseDecimal();
  expect(base_format.toString()).toBe('0.00');
  base_format.DecreaseDecimal();
  expect(base_format.toString()).toBe('0.0');

  base_format.ToggleGrouping();
  expect(base_format.toString()).toBe('#,##0.0');
  base_format.RemoveGrouping();
  expect(base_format.toString()).toBe('0.0');
  base_format.AddGrouping();
  expect(base_format.toString()).toBe('#,##0.0');
  base_format.ToggleGrouping();
  expect(base_format.toString()).toBe('0.0');
});

test('representation', () => {
  let format = new NumberFormat('$* _(#,##0_);[red]$* (#,##0);$* -_;@)');
  expect(format.pattern).toBe('$* _(#,##0_);[red]$* (#,##0);$* -_;@)');
  expect(format.toString()).toBe('$* _(#,##0_);[red]$* (#,##0);$* -_;@)');
  expect(format.date_format).toBe(false);

  format = new NumberFormat('0,,');
  expect(format.pattern).toBe('0,,');
  expect(format.toString()).toBe('0,,');
  expect(format.date_format).toBe(false);

  format = new NumberFormat('mmmm dd yyyy');
  expect(format.pattern).toBe('mmmm dd yyyy');
  expect(format.toString()).toBe('mmmm dd yyyy');
  expect(format.date_format).toBe(true);

});

