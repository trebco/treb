
import {NumberFormat} from '../src/format';

test('integer format: "0"', () => {

  const integer_format = new NumberFormat('0');

  // digits
  expect(integer_format.Format(0)).toBe('0');
  expect(integer_format.Format(100)).toBe('100');

  // round up
  expect(integer_format.Format(9.9)).toBe('10');

  // round down
  expect(integer_format.Format(3.3)).toBe('3');

  // round @ .5 (away from zero)
  expect(integer_format.Format(7.5)).toBe('8');
  expect(integer_format.Format(-7.5)).toBe('-8');

});

test('decimal format: "0.00"', () => {

  const decimal_format = new NumberFormat('0.00');

  // add digits
  expect(decimal_format.Format(0)).toBe('0.00');
  expect(decimal_format.Format(0.5)).toBe('0.50');

  // don't round
  expect(decimal_format.Format(3.33)).toBe('3.33');
  expect(decimal_format.Format(99.99)).toBe('99.99');

  // round
  expect(decimal_format.Format(99.999)).toBe('100.00');

});

test('percent format: "0.00%"', () => {

  const percent_format = new NumberFormat('0.00%');

  // scale from integer
  expect(percent_format.Format(1)).toBe('100.00%');
  expect(percent_format.Format(2)).toBe('200.00%');

  // scale from fraction
  expect(percent_format.Format(.011)).toBe('1.10%');
  expect(percent_format.Format(.2)).toBe('20.00%');

  // round
  expect(percent_format.Format(.10001)).toBe('10.00%');
  expect(percent_format.Format(.40009)).toBe('40.01%');

});

test('grouping: "#,##0"', () => {

  const grouping_format = new NumberFormat('#,##0');

  // no grouping
  expect(grouping_format.Format(0)).toBe('0');

  // grouping
  expect(grouping_format.Format(10000)).toBe('10,000');
  expect(grouping_format.Format(1000)).toBe('1,000');

  // multiple, round
  expect(grouping_format.Format(999999.9)).toBe('1,000,000');

});

test('leading zeros', () => {

  const digits_format = new NumberFormat('0000');

  expect(digits_format.Format(0)).toBe('0000');
  expect(digits_format.Format(100)).toBe('0100');
  expect(digits_format.Format(1000)).toBe('1000');

  // don't truncate
  expect(digits_format.Format(10000)).toBe('10000');

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
