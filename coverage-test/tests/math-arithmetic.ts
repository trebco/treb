
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('QUOTIENT', [
  { type: 'expect', expression: '=QUOTIENT(5,2)', expected: 2 },
  { type: 'expect', expression: '=QUOTIENT(-10,3)', expected: -3 },
  { type: 'expect', expression: '=QUOTIENT(10,3)', expected: 3 },
  { type: 'expect', expression: '=QUOTIENT(7,1)', expected: 7 },
]);

AddTests('GCD', [
  { type: 'expect', expression: '=GCD(12,8)', expected: 4 },
  { type: 'expect', expression: '=GCD(5,0)', expected: 5 },
  { type: 'expect', expression: '=GCD(24,36)', expected: 12 },
  { type: 'expect', expression: '=GCD(7,13)', expected: 1 },
]);

AddTests('LCM', [
  { type: 'expect', expression: '=LCM(4,6)', expected: 12 },
  { type: 'expect', expression: '=LCM(5,10)', expected: 10 },
  { type: 'expect', expression: '=LCM(3,7)', expected: 21 },
  { type: 'expect', expression: '=LCM(12,8)', expected: 24 },
]);

AddTests('MROUND', [
  { type: 'expect', expression: '=MROUND(10,3)', expected: 9 },
  { type: 'expect', expression: '=MROUND(7,2)', expected: 8 },
  { type: 'expect', expression: '=MROUND(-10,-3)', expected: -9 },
  { type: 'approximate', expression: '=MROUND(1.3,0.2)', expected: 1.4, epsilon },
]);

AddTests('SERIESSUM', [
  { type: 'expect', expression: '=SERIESSUM(2,0,1,{1,1,1})', expected: 7 },
  { type: 'approximate', expression: '=SERIESSUM(PI()/4,0,2,{1,-0.5,0.0417})', expected: 0.7071032148, epsilon },
  { type: 'expect', expression: '=SERIESSUM(1,0,1,{1})', expected: 1 },
  { type: 'expect', expression: '=SERIESSUM(2,1,1,{1,1})', expected: 6 },
]);
