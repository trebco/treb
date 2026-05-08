
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('IPMT', [
  { type: 'approximate', expression: '=IPMT(0.1/12,1,36,8000)', expected: -66.666667, epsilon: 0.01 },
  { type: 'approximate', expression: '=IPMT(0.1,3,3,8000)', expected: -292.447129, epsilon: 0.01 },
]);

AddTests('PPMT', [
  { type: 'approximate', expression: '=PPMT(0.1/12,1,60,-2000)', expected: 25.125263, epsilon: 0.01 },
  { type: 'approximate', expression: '=PPMT(0.08,10,10,-200000)', expected: 27598.053274, epsilon: 0.01 },
]);

AddTests('CUMIPMT', [
  { type: 'approximate', expression: '=CUMIPMT(0.09/12,360,125000,1,1,0)', expected: -937.5, epsilon: 0.01 },
  { type: 'approximate', expression: '=CUMIPMT(0.09/12,360,125000,13,24,0)', expected: -11048.024213, epsilon: 0.01 },
]);

AddTests('CUMPRINC', [
  { type: 'approximate', expression: '=CUMPRINC(0.09/12,360,125000,1,1,0)', expected: -68.278295, epsilon: 0.01 },
  { type: 'approximate', expression: '=CUMPRINC(0.09/12,360,125000,13,24,0)', expected: -927.153460, epsilon: 0.1 },
]);

AddTests('ISPMT', [
  { type: 'approximate', expression: '=ISPMT(0.1/12,1,36,8000000)', expected: -64814.81, epsilon: 0.01 },
  { type: 'approximate', expression: '=ISPMT(0.1,1,3,8000000)', expected: -533333.333333, epsilon: 0.01 },
]);
