
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('SINH', [
  { type: 'expect', expression: '=SINH(0)', expected: 0 },
  { type: 'approximate', expression: '=SINH(1)', expected: 1.1752011936, epsilon },
  { type: 'approximate', expression: '=SINH(-1)', expected: -1.1752011936, epsilon },
  { type: 'approximate', expression: '=SINH(2)', expected: 3.6268604079, epsilon },
]);

AddTests('COSH', [
  { type: 'expect', expression: '=COSH(0)', expected: 1 },
  { type: 'approximate', expression: '=COSH(1)', expected: 1.5430806348, epsilon },
  { type: 'approximate', expression: '=COSH(-1)', expected: 1.5430806348, epsilon },
  { type: 'approximate', expression: '=COSH(2)', expected: 3.7621956911, epsilon },
]);

AddTests('TANH', [
  { type: 'expect', expression: '=TANH(0)', expected: 0 },
  { type: 'approximate', expression: '=TANH(1)', expected: 0.7615941560, epsilon },
  { type: 'approximate', expression: '=TANH(-1)', expected: -0.7615941560, epsilon },
  { type: 'approximate', expression: '=TANH(5)', expected: 0.9999092043, epsilon },
]);

AddTests('ASINH', [
  { type: 'expect', expression: '=ASINH(0)', expected: 0 },
  { type: 'approximate', expression: '=ASINH(1)', expected: 0.8813735870, epsilon },
  { type: 'approximate', expression: '=ASINH(-1)', expected: -0.8813735870, epsilon },
  { type: 'approximate', expression: '=ASINH(10)', expected: 2.9982229503, epsilon },
]);

AddTests('ACOSH', [
  { type: 'expect', expression: '=ACOSH(1)', expected: 0 },
  { type: 'approximate', expression: '=ACOSH(2)', expected: 1.3169578969, epsilon },
  { type: 'approximate', expression: '=ACOSH(10)', expected: 2.9932228461, epsilon },
  { type: 'approximate', expression: '=ACOSH(1.5)', expected: 0.9624236501, epsilon },
]);

AddTests('ATANH', [
  { type: 'expect', expression: '=ATANH(0)', expected: 0 },
  { type: 'approximate', expression: '=ATANH(0.5)', expected: 0.5493061443, epsilon },
  { type: 'approximate', expression: '=ATANH(-0.5)', expected: -0.5493061443, epsilon },
  { type: 'approximate', expression: '=ATANH(0.9)', expected: 1.4722194896, epsilon },
]);
