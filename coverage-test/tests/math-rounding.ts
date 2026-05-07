
import { AddTests } from '@util';

AddTests('ROUND', [
  { type: 'expect', expression: '=ROUND(2.149,1)', expected: 2.1 },
  { type: 'expect', expression: '=ROUND(2.15,1)', expected: 2.2 },
  { type: 'expect', expression: '=ROUND(-1.475,2)', expected: -1.48 },
  { type: 'expect', expression: '=ROUND(21.5,-1)', expected: 20 },
  { type: 'expect', expression: '=ROUND(1.5,0)', expected: 2 },
]);

AddTests('ROUNDUP', [
  { type: 'expect', expression: '=ROUNDUP(3.2,0)', expected: 4 },
  { type: 'expect', expression: '=ROUNDUP(-3.2,0)', expected: -4 },
  { type: 'expect', expression: '=ROUNDUP(76.9,0)', expected: 77 },
  { type: 'expect', expression: '=ROUNDUP(3.14159,3)', expected: 3.142 },
]);

AddTests('ROUNDDOWN', [
  { type: 'expect', expression: '=ROUNDDOWN(3.7,0)', expected: 3 },
  { type: 'expect', expression: '=ROUNDDOWN(-3.7,0)', expected: -3 },
  { type: 'expect', expression: '=ROUNDDOWN(3.14159,3)', expected: 3.141 },
  { type: 'expect', expression: '=ROUNDDOWN(31415.92654,-2)', expected: 31400 },
]);

AddTests('TRUNC', [
  { type: 'expect', expression: '=TRUNC(8.9)', expected: 8 },
  { type: 'expect', expression: '=TRUNC(-8.9)', expected: -8 },
  { type: 'expect', expression: '=TRUNC(0.45)', expected: 0 },
  { type: 'expect', expression: '=TRUNC(3.14159,2)', expected: 3.14 },
]);
