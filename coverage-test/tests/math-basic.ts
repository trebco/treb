
import { AddTests } from '@util';

AddTests('ABS', [
  { type: 'expect', expression: '=ABS(5)', expected: 5 },
  { type: 'expect', expression: '=ABS(-5)', expected: 5 },
  { type: 'expect', expression: '=ABS(0)', expected: 0 },
  { type: 'expect', expression: '=ABS(-3.14)', expected: 3.14 },
]);

AddTests('SIGN', [
  { type: 'expect', expression: '=SIGN(10)', expected: 1 },
  { type: 'expect', expression: '=SIGN(-10)', expected: -1 },
  { type: 'expect', expression: '=SIGN(0)', expected: 0 },
  { type: 'expect', expression: '=SIGN(-0.001)', expected: -1 },
]);

AddTests('INT', [
  { type: 'expect', expression: '=INT(5.7)', expected: 5 },
  { type: 'expect', expression: '=INT(-5.7)', expected: -6 },
  { type: 'expect', expression: '=INT(0)', expected: 0 },
  { type: 'expect', expression: '=INT(1.9999)', expected: 1 },
]);

AddTests('MOD', [
  { type: 'expect', expression: '=MOD(10,3)', expected: 1 },
  { type: 'expect', expression: '=MOD(10,5)', expected: 0 },
  { type: 'expect', expression: '=MOD(-10,3)', expected: 2 },
  { type: 'expect', expression: '=MOD(10,-3)', expected: -2 },
]);

AddTests('POWER', [
  { type: 'expect', expression: '=POWER(2,10)', expected: 1024 },
  { type: 'expect', expression: '=POWER(5,0)', expected: 1 },
  { type: 'expect', expression: '=POWER(9,0.5)', expected: 3 },
  { type: 'expect', expression: '=POWER(-2,3)', expected: -8 },
]);

AddTests('SQRT', [
  { type: 'expect', expression: '=SQRT(9)', expected: 3 },
  { type: 'expect', expression: '=SQRT(0)', expected: 0 },
  { type: 'expect', expression: '=SQRT(2.25)', expected: 1.5 },
  { type: 'expect', expression: '=SQRT(1)', expected: 1 },
]);
