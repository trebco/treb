
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('F.INV.RT', [
  { type: 'approximate', expression: '=F.INV.RT(0.05,5,10)', expected: 3.3258345304, epsilon: 1e-6 },
  { type: 'approximate', expression: '=F.INV.RT(0.5,5,10)', expected: 0.9319331609, epsilon: 1e-6 },
  { type: 'approximate', expression: '=F.INV.RT(0.01,3,7)', expected: 8.4512850531, epsilon: 1e-6 },
]);

AddTests('F.TEST', [
  { type: 'approximate', expression: '=F.TEST(A1:A5,B1:B5)', expected: 0.6483178468, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[6], [7], [9], [15], [21]]);
  SetRange('B1', [[20], [28], [31], [38], [40]]);
});

AddTests('Z.TEST', [
  { type: 'approximate', expression: '=Z.TEST(A1:A5,4)', expected: 0.0084136959, epsilon: 1e-6 },
  { type: 'approximate', expression: '=Z.TEST(B1:B10,4)', expected: 0.0905742615, epsilon: 1e-6 },
  { type: 'approximate', expression: '=Z.TEST(B1:B10,6)', expected: 0.8630433466, epsilon: 1e-6 },
  { type: 'approximate', expression: '=Z.TEST(B1:B10,4,1)', expected: 0.0002521550, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[3], [6], [7], [8], [6]]);
  SetRange('B1', [[3], [6], [7], [8], [6], [5], [4], [2], [1], [9]]);
});
