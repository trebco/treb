
import { AddTests } from '@util';

AddTests('TEXT', [
  { type: 'expect', expression: '=TEXT(1234.567,"$#,##0.00")', expected: '$1,234.57' },
  { type: 'expect', expression: '=TEXT(0.285,"0.0%")', expected: '28.5%' },
  { type: 'expect', expression: '=TEXT(42370,"MM/DD/YYYY")', expected: '01/01/2016' },
  { type: 'expect', expression: '=TEXT(5.25,"# ?/?")', expected: '5 1/4' },
]);

AddTests('DOLLAR', [
  { type: 'expect', expression: '=DOLLAR(1234.567)', expected: '$1,234.57' },
  { type: 'expect', expression: '=DOLLAR(1234.567,0)', expected: '$1,235' },
  { type: 'expect', expression: '=DOLLAR(-1234.567,2)', expected: '($1,234.57)' },
  { type: 'expect', expression: '=DOLLAR(99.888,1)', expected: '$99.9' },
]);

AddTests('FIXED', [
  { type: 'expect', expression: '=FIXED(1234.567,1)', expected: '1,234.6' },
  { type: 'expect', expression: '=FIXED(1234.567,1,TRUE)', expected: '1234.6' },
  { type: 'expect', expression: '=FIXED(44.332)', expected: '44.33' },
  { type: 'expect', expression: '=FIXED(1234,-1)', expected: '1,230' },
]);

AddTests('NUMBERVALUE', [
  { type: 'expect', expression: '=ISERROR(NUMBERVALUE("2.500,27",".",","))', expected: true },
  { type: 'expect', expression: '=NUMBERVALUE("3.5")', expected: 3.5 },
  { type: 'expect', expression: '=NUMBERVALUE("25%")', expected: 0.25 },
  { type: 'expect', expression: '=NUMBERVALUE("100")', expected: 100 },
]);

AddTests('VALUE', [
  { type: 'expect', expression: '=VALUE("123")', expected: 123 },
  { type: 'expect', expression: '=VALUE("$1,000")', expected: 1000 },
  { type: 'expect', expression: '=VALUE("16:48:00")', expected: 0.7 },
  { type: 'expect', expression: '=VALUE("3.5")', expected: 3.5 },
]);
