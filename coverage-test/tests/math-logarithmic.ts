
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('LN', [
  { type: 'expect', expression: '=LN(1)', expected: 0 },
  { type: 'approximate', expression: '=LN(2)', expected: 0.6931471806, epsilon },
  { type: 'approximate', expression: '=LN(10)', expected: 2.302585093, epsilon },
  { type: 'approximate', expression: '=LN(EXP(1))', expected: 1, epsilon },
]);

AddTests('LOG', [
  { type: 'expect', expression: '=LOG(10,10)', expected: 1 },
  { type: 'expect', expression: '=LOG(100,10)', expected: 2 },
  { type: 'expect', expression: '=LOG(8,2)', expected: 3 },
  { type: 'approximate', expression: '=LOG(5,10)', expected: 0.6989700043, epsilon },
]);

AddTests('LOG10', [
  { type: 'expect', expression: '=LOG10(10)', expected: 1 },
  { type: 'expect', expression: '=LOG10(100)', expected: 2 },
  { type: 'expect', expression: '=LOG10(1)', expected: 0 },
  { type: 'approximate', expression: '=LOG10(5)', expected: 0.6989700043, epsilon },
]);

AddTests('EXP', [
  { type: 'expect', expression: '=EXP(0)', expected: 1 },
  { type: 'approximate', expression: '=EXP(1)', expected: 2.7182818285, epsilon },
  { type: 'approximate', expression: '=EXP(2)', expected: 7.3890560989, epsilon },
  { type: 'approximate', expression: '=EXP(-1)', expected: 0.3678794412, epsilon },
]);

AddTests('SQRTPI', [
  { type: 'approximate', expression: '=SQRTPI(1)', expected: 1.7724538509, epsilon },
  { type: 'approximate', expression: '=SQRTPI(2)', expected: 2.5066282746, epsilon },
  { type: 'expect', expression: '=SQRTPI(0)', expected: 0 },
  { type: 'approximate', expression: '=SQRTPI(4)', expected: 3.5449077018, epsilon },
]);
