
import { AddTests } from '@util';

AddTests('IMSINH', [
  { type: 'expect', expression: '=IMSINH("0")', expected: '0' },
  { type: 'expect', expression: '=IMSINH("1")', expected: '1.1752011936438' },
]);

AddTests('IMCOSH', [
  { type: 'expect', expression: '=IMCOSH("0")', expected: '1' },
  { type: 'expect', expression: '=IMCOSH("1")', expected: '1.54308063481524' },
]);

AddTests('IMEXP', [
  { type: 'expect', expression: '=IMEXP("0")', expected: '1' },
  { type: 'expect', expression: '=IMEXP("1")', expected: '2.71828182845905' },
]);

AddTests('IMLN', [
  { type: 'expect', expression: '=IMLN("1")', expected: '0' },
  { type: 'expect', expression: '=IMLN("-1")', expected: '3.14159265358979i' },
]);

AddTests('IMLOG10', [
  { type: 'expect', expression: '=IMLOG10("1")', expected: '0' },
  { type: 'expect', expression: '=IMLOG10("10")', expected: '1' },
]);

AddTests('IMLOG2', [
  { type: 'expect', expression: '=IMLOG2("1")', expected: '0' },
  { type: 'expect', expression: '=IMLOG2("4")', expected: '2' },
]);
