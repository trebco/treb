
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('BETADIST', [
  { type: 'approximate', expression: '=BETADIST(2,8,10,1,3)', expected: 0.6854706, epsilon: 1e-6 },
  { type: 'approximate', expression: '=BETADIST(0.5,2,5)', expected: 0.8906250000, epsilon },
]);

AddTests('BETAINV', [
  { type: 'approximate', expression: '=BETAINV(0.6854706,8,10,1,3)', expected: 2, epsilon: 0.01 },
  { type: 'approximate', expression: '=BETAINV(0.5,2,5)', expected: 0.2644499833, epsilon: 1e-6 },
]);

AddTests('BINOMDIST', [
  { type: 'approximate', expression: '=BINOMDIST(6,10,0.5,FALSE)', expected: 0.2050781250, epsilon },
  { type: 'approximate', expression: '=BINOMDIST(6,10,0.5,TRUE)', expected: 0.8281250000, epsilon },
]);

AddTests('CHIDIST', [
  { type: 'approximate', expression: '=CHIDIST(2,5)', expected: 0.8491450361, epsilon },
  { type: 'approximate', expression: '=CHIDIST(10,5)', expected: 0.0752352461, epsilon },
]);

AddTests('CHIINV', [
  { type: 'approximate', expression: '=CHIINV(0.05,5)', expected: 11.070497694, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CHIINV(0.5,5)', expected: 4.3514601741, epsilon: 1e-6 },
]);

AddTests('CHITEST', [
  { type: 'approximate', expression: '=CHITEST(A1:B2,C1:D2)', expected: 0.0002197627, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[58, 35], [11, 25]]);
  SetRange('C1', [[45.35, 47.65], [23.65, 24.85]]);
});

AddTests('EXPONDIST', [
  { type: 'approximate', expression: '=EXPONDIST(0.2,10,TRUE)', expected: 0.8646647168, epsilon },
  { type: 'approximate', expression: '=EXPONDIST(0.2,10,FALSE)', expected: 1.353352832, epsilon },
]);

AddTests('FDIST', [
  { type: 'approximate', expression: '=FDIST(1,5,10)', expected: 0.4651194265, epsilon },
  { type: 'approximate', expression: '=FDIST(2,5,10)', expected: 0.1641949509, epsilon },
]);
