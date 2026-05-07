
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('FINV', [
  { type: 'approximate', expression: '=FINV(0.05,5,10)', expected: 3.3258342367, epsilon: 1e-6 },
  { type: 'approximate', expression: '=FINV(0.5,5,10)', expected: 0.9276244622, epsilon: 1e-6 },
]);

AddTests('FTEST', [
  { type: 'approximate', expression: '=FTEST(A1:A5,B1:B5)', expected: 0.6483073891, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[6], [7], [9], [15], [21]]);
  SetRange('B1', [[20], [28], [31], [38], [40]]);
});

AddTests('GAMMADIST', [
  { type: 'approximate', expression: '=GAMMADIST(2,3,2,TRUE)', expected: 0.0803013971, epsilon: 1e-6 },
  { type: 'approximate', expression: '=GAMMADIST(2,3,2,FALSE)', expected: 0.0758163325, epsilon: 1e-6 },
]);

AddTests('GAMMAINV', [
  { type: 'approximate', expression: '=GAMMAINV(0.5,3,2)', expected: 5.3481341135, epsilon: 1e-6 },
]);

AddTests('HYPGEOMDIST', [
  { type: 'approximate', expression: '=HYPGEOMDIST(1,4,8,20)', expected: 0.3632794457, epsilon: 1e-6 },
]);

AddTests('LOGNORMDIST', [
  { type: 'approximate', expression: '=LOGNORMDIST(4,3.5,1.2)', expected: 0.0390835557, epsilon },
]);

AddTests('LOGINV', [
  { type: 'approximate', expression: '=LOGINV(0.5,0,1)', expected: 1, epsilon },
  { type: 'approximate', expression: '=LOGINV(0.5,3.5,1.2)', expected: 33.115452, epsilon: 0.01 },
]);

AddTests('NEGBINOMDIST', [
  { type: 'approximate', expression: '=NEGBINOMDIST(10,5,0.25)', expected: 0.0550486247, epsilon: 1e-6 },
]);
