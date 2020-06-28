
import { ValueParser, Hints  } from '../src/value_parser';
import { ValueType } from 'treb-base-types'; // ugh

test('parsing', () => {

  // explicit string
  expect(ValueParser.TryParse('\'hello').type).toEqual(ValueType.string);
  expect(ValueParser.TryParse('\'100').type).toEqual(ValueType.string);

  // implicit string
  expect(ValueParser.TryParse('hello').type).toEqual(ValueType.string);

  // various number types
  expect(ValueParser.TryParse('100').type).toEqual(ValueType.number);
  expect(ValueParser.TryParse('$30,000').type).toEqual(ValueType.number);
  expect(ValueParser.TryParse('.44').type).toEqual(ValueType.number);
  expect(ValueParser.TryParse('-.44').type).toEqual(ValueType.number);
  expect(ValueParser.TryParse('100%').type).toEqual(ValueType.number);
  expect(ValueParser.TryParse('1.2e-7').type).toEqual(ValueType.number);
  expect(ValueParser.TryParse('100,000').type).toEqual(ValueType.number); // FIXME: l10n
  expect(ValueParser.TryParse('(33.33)').type).toEqual(ValueType.number);

  // date
  expect(ValueParser.TryParse('Jun 3, 2020').type).toEqual(ValueType.number); // FIXME: l10n
  expect(ValueParser.TryParse('7/7/2021').type).toEqual(ValueType.number);    // FIXME: l10n
  expect(ValueParser.TryParse('1/1/22').type).toEqual(ValueType.number);      // FIXME: l10n

  // boolean 
  expect(ValueParser.TryParse('true').type).toEqual(ValueType.boolean);
  expect(ValueParser.TryParse('FaLsE').type).toEqual(ValueType.boolean);

  // number values
  expect(ValueParser.TryParse('100').value).toEqual(100);
  expect(ValueParser.TryParse('100%').value).toEqual(1);
  expect(ValueParser.TryParse('1.2e-7').value).toEqual(1.2e-7);
  expect(ValueParser.TryParse('100,000').value).toEqual(100000); // FIXME: l10n
  expect(ValueParser.TryParse('NaN').value).toEqual(Number.NaN);
  expect(ValueParser.TryParse('(33.33)').value).toEqual(-33.33);
  expect(ValueParser.TryParse('-.99').value).toEqual(-.99);
  expect(ValueParser.TryParse('$30,000').value).toEqual(30000);

  // hints
  expect(ValueParser.TryParse('string').hints || 0).toEqual(Hints.None);
  expect(ValueParser.TryParse('100').hints || 0).toEqual(Hints.None);
  expect(ValueParser.TryParse('NaN').hints || 0).toEqual(Hints.Nan);

  expect((ValueParser.TryParse('Jun 3, 2020').hints || 0) & Hints.Date).toBeTruthy(); // FIXME: l10n
  expect((ValueParser.TryParse('7/7/2021').hints || 0) & Hints.Date).toBeTruthy();    // FIXME: l10n
  expect((ValueParser.TryParse('1/1/22').hints || 0) & Hints.Date).toBeTruthy();      // FIXME: l10n

  expect((ValueParser.TryParse('Jun 3, 2020 12:30').hints || 0) & Hints.Time).toBeTruthy(); // FIXME: l10n
  
  expect((ValueParser.TryParse('100%').hints || 0) & Hints.Percent).toBeTruthy();
  expect((ValueParser.TryParse('100%').hints || 0) & Hints.Exponential).toBeFalsy();
  expect((ValueParser.TryParse('100').hints || 0) & Hints.Percent).toBeFalsy();
  expect((ValueParser.TryParse('100').hints || 0) & Hints.Exponential).toBeFalsy();
  expect((ValueParser.TryParse('1.2e-7').hints || 0) & Hints.Percent).toBeFalsy();
  expect((ValueParser.TryParse('1.2e-7').hints || 0) & Hints.Exponential).toBeTruthy();
  expect((ValueParser.TryParse('$50.50').hints || 0) & Hints.Currency).toBeTruthy();

  // multiple
  expect((ValueParser.TryParse('(100,000)').hints || 0) & Hints.Grouping).toBeTruthy();   // FIXME: l10n
  expect((ValueParser.TryParse('(100,000)').hints || 0) & Hints.Parens).toBeTruthy();     // 
  expect((ValueParser.TryParse('(100,000)').hints || 0) & Hints.Exponential).toBeFalsy(); //
  
});
