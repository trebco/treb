
import { AddTests } from '@util';

AddTests('ISBLANK', [
  { type: 'expect', expression: '=ISBLANK(A1)', expected: true },
  { type: 'expect', expression: '=ISBLANK(B1)', expected: false },
  { type: 'expect', expression: '=ISBLANK(C1)', expected: false },
], SetRange => {
  SetRange('B1', 0);
  SetRange('C1', '');
});

AddTests('ISERROR', [
  { type: 'expect', expression: '=ISERROR(1/0)', expected: true },
  { type: 'expect', expression: '=ISERROR(1)', expected: false },
  { type: 'expect', expression: '=ISERROR("hello")', expected: false },
  { type: 'expect', expression: '=ISERROR(NA())', expected: true },
]);

AddTests('ISERR', [
  { type: 'expect', expression: '=ISERR(1/0)', expected: true },
  { type: 'expect', expression: '=ISERR(NA())', expected: false },
  { type: 'expect', expression: '=ISERR(1)', expected: false },
]);

AddTests('ISNA', [
  { type: 'expect', expression: '=ISNA(NA())', expected: true },
  { type: 'expect', expression: '=ISNA(1/0)', expected: false },
  { type: 'expect', expression: '=ISNA(1)', expected: false },
]);

AddTests('ISLOGICAL', [
  { type: 'expect', expression: '=ISLOGICAL(TRUE)', expected: true },
  { type: 'expect', expression: '=ISLOGICAL(FALSE)', expected: true },
  { type: 'expect', expression: '=ISLOGICAL(1)', expected: false },
  { type: 'expect', expression: '=ISLOGICAL("TRUE")', expected: false },
]);

AddTests('ISNUMBER', [
  { type: 'expect', expression: '=ISNUMBER(1)', expected: true },
  { type: 'expect', expression: '=ISNUMBER(3.14)', expected: true },
  { type: 'expect', expression: '=ISNUMBER("hello")', expected: false },
  { type: 'expect', expression: '=ISNUMBER(TRUE)', expected: false },
]);

AddTests('ISTEXT', [
  { type: 'expect', expression: '=ISTEXT("hello")', expected: true },
  { type: 'expect', expression: '=ISTEXT(1)', expected: false },
  { type: 'expect', expression: '=ISTEXT(TRUE)', expected: false },
  { type: 'expect', expression: '=ISTEXT("")', expected: true },
]);

AddTests('ISNONTEXT', [
  { type: 'expect', expression: '=ISNONTEXT(1)', expected: true },
  { type: 'expect', expression: '=ISNONTEXT("hello")', expected: false },
  { type: 'expect', expression: '=ISNONTEXT(TRUE)', expected: true },
]);
