
import { AddTests } from '@util';

AddTests('CEILING.MATH', [
  { type: 'expect', expression: '=CEILING.MATH(6.3)', expected: 7 },
  { type: 'expect', expression: '=CEILING.MATH(-6.3)', expected: -6 },
  { type: 'expect', expression: '=CEILING.MATH(6.3,2)', expected: 8 },
  { type: 'expect', expression: '=CEILING.MATH(-6.3,2,1)', expected: -8 },
]);

AddTests('CEILING.PRECISE', [
  { type: 'expect', expression: '=CEILING.PRECISE(4.3)', expected: 5 },
  { type: 'expect', expression: '=CEILING.PRECISE(-4.3)', expected: -4 },
  { type: 'expect', expression: '=CEILING.PRECISE(4.3,2)', expected: 6 },
  { type: 'expect', expression: '=CEILING.PRECISE(-4.3,2)', expected: -4 },
]);

AddTests('ISO.CEILING', [
  { type: 'expect', expression: '=ISO.CEILING(4.3)', expected: 5 },
  { type: 'expect', expression: '=ISO.CEILING(-4.3)', expected: -4 },
  { type: 'expect', expression: '=ISO.CEILING(4.3,2)', expected: 6 },
  { type: 'expect', expression: '=ISO.CEILING(-4.3,2)', expected: -4 },
]);

AddTests('FLOOR.MATH', [
  { type: 'expect', expression: '=FLOOR.MATH(6.7)', expected: 6 },
  { type: 'expect', expression: '=FLOOR.MATH(-6.7)', expected: -7 },
  { type: 'expect', expression: '=FLOOR.MATH(6.7,2)', expected: 6 },
  { type: 'expect', expression: '=FLOOR.MATH(-6.7,2,1)', expected: -6 },
]);

AddTests('FLOOR.PRECISE', [
  { type: 'expect', expression: '=FLOOR.PRECISE(4.7)', expected: 4 },
  { type: 'expect', expression: '=FLOOR.PRECISE(-4.7)', expected: -5 },
  { type: 'expect', expression: '=FLOOR.PRECISE(6.7,2)', expected: 6 },
  { type: 'expect', expression: '=FLOOR.PRECISE(-6.7,2)', expected: -8 },
]);
