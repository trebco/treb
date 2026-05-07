
import { AddTests } from '@util';

AddTests('ISEVEN', [
  { type: 'expect', expression: '=ISEVEN(2)', expected: true },
  { type: 'expect', expression: '=ISEVEN(3)', expected: false },
  { type: 'expect', expression: '=ISEVEN(0)', expected: true },
  { type: 'expect', expression: '=ISEVEN(-4)', expected: true },
]);

AddTests('ISODD', [
  { type: 'expect', expression: '=ISODD(3)', expected: true },
  { type: 'expect', expression: '=ISODD(2)', expected: false },
  { type: 'expect', expression: '=ISODD(0)', expected: false },
  { type: 'expect', expression: '=ISODD(-3)', expected: true },
]);

AddTests('ISFORMULA', [
  { type: 'expect', expression: '=ISFORMULA(A1)', expected: true },
  { type: 'expect', expression: '=ISFORMULA(B1)', expected: false },
], SetRange => {
  SetRange('A1', '=1+1');
  SetRange('B1', 100);
});

AddTests('ISREF', [
  { type: 'expect', expression: '=ISREF(A1)', expected: true },
  { type: 'expect', expression: '=ISREF(1)', expected: false },
  { type: 'expect', expression: '=ISREF("hello")', expected: false },
]);

AddTests('TYPE', [
  { type: 'expect', expression: '=TYPE(1)', expected: 1 },
  { type: 'expect', expression: '=TYPE("hello")', expected: 2 },
  { type: 'expect', expression: '=TYPE(TRUE)', expected: 4 },
  { type: 'expect', expression: '=TYPE(1/0)', expected: 16 },
]);

AddTests('N', [
  { type: 'expect', expression: '=N(1)', expected: 1 },
  { type: 'expect', expression: '=N(TRUE)', expected: 1 },
  { type: 'expect', expression: '=N(FALSE)', expected: 0 },
  { type: 'expect', expression: '=N("hello")', expected: 0 },
]);

AddTests('NA', [
  { type: 'expect', expression: '=ISNA(NA())', expected: true },
  { type: 'expect', expression: '=ISERROR(NA())', expected: true },
]);
