
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('COT', [
  { type: 'approximate', expression: '=COT(1)', expected: 0.6420926160, epsilon },
  { type: 'approximate', expression: '=COT(PI()/4)', expected: 1, epsilon },
  { type: 'approximate', expression: '=COT(PI()/6)', expected: 1.7320508076, epsilon },
  { type: 'approximate', expression: '=COT(2)', expected: -0.4576575544, epsilon },
]);

AddTests('COTH', [
  { type: 'approximate', expression: '=COTH(1)', expected: 1.3130352855, epsilon },
  { type: 'approximate', expression: '=COTH(2)', expected: 1.0373147207, epsilon },
  { type: 'approximate', expression: '=COTH(-1)', expected: -1.3130352855, epsilon },
  { type: 'approximate', expression: '=COTH(0.5)', expected: 2.1639534137, epsilon },
]);

AddTests('CSC', [
  { type: 'expect', expression: '=CSC(PI()/2)', expected: 1 },
  { type: 'approximate', expression: '=CSC(1)', expected: 1.1883951058, epsilon },
  { type: 'approximate', expression: '=CSC(PI()/6)', expected: 2, epsilon },
  { type: 'approximate', expression: '=CSC(PI()/4)', expected: 1.4142135624, epsilon },
]);

AddTests('CSCH', [
  { type: 'approximate', expression: '=CSCH(1)', expected: 0.8509181282, epsilon },
  { type: 'approximate', expression: '=CSCH(2)', expected: 0.2757205648, epsilon },
  { type: 'approximate', expression: '=CSCH(-1)', expected: -0.8509181282, epsilon },
  { type: 'approximate', expression: '=CSCH(0.5)', expected: 1.9190347514, epsilon },
]);

AddTests('SEC', [
  { type: 'expect', expression: '=SEC(0)', expected: 1 },
  { type: 'approximate', expression: '=SEC(1)', expected: 1.8508157177, epsilon },
  { type: 'approximate', expression: '=SEC(PI()/3)', expected: 2, epsilon },
  { type: 'approximate', expression: '=SEC(PI()/4)', expected: 1.4142135624, epsilon },
]);

AddTests('SECH', [
  { type: 'expect', expression: '=SECH(0)', expected: 1 },
  { type: 'approximate', expression: '=SECH(1)', expected: 0.6480542737, epsilon },
  { type: 'approximate', expression: '=SECH(2)', expected: 0.2658022288, epsilon },
  { type: 'approximate', expression: '=SECH(-1)', expected: 0.6480542737, epsilon },
]);

AddTests('ACOT', [
  { type: 'approximate', expression: '=ACOT(1)', expected: 0.7853981634, epsilon },
  { type: 'approximate', expression: '=ACOT(0)', expected: 1.5707963268, epsilon },
  { type: 'approximate', expression: '=ACOT(-1)', expected: 2.3561944902, epsilon },
  { type: 'approximate', expression: '=ACOT(10)', expected: 0.0996686525, epsilon },
]);

AddTests('ACOTH', [
  { type: 'approximate', expression: '=ACOTH(2)', expected: 0.5493061443, epsilon },
  { type: 'approximate', expression: '=ACOTH(10)', expected: 0.1003353477, epsilon },
  { type: 'approximate', expression: '=ACOTH(-2)', expected: -0.5493061443, epsilon },
  { type: 'approximate', expression: '=ACOTH(1.5)', expected: 0.8047189562, epsilon },
]);
