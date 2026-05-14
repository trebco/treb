
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('NPV', [
  { type: 'approximate', expression: '=NPV(0.1,-10000,3000,4200,6800)', expected: 1188.443412, epsilon: 0.01 },
  { type: 'approximate', expression: '=NPV(0.08,A1:A5)', expected: -7199.006517, epsilon: 0.01 },
], SetRange => {
  SetRange('A1', [[-40000], [8000], [9400], [10000], [12000]]);
});

AddTests('IRR', [
  { type: 'approximate', expression: '=IRR(A1:A5)', expected: -0.021244848, epsilon: 0.001 },
], SetRange => {
  SetRange('A1', [[-70000], [12000], [15000], [18000], [21000]]);
});

AddTests('MIRR', [
  { type: 'approximate', expression: '=MIRR(A1:A6,0.1,0.12)', expected: 0.126094587, epsilon: 0.001 },
], SetRange => {
  SetRange('A1', [[-120000], [39000], [30000], [21000], [37000], [46000]]);
});

AddTests('XNPV', [
  { type: 'approximate', expression: '=XNPV(0.09,A1:A5,B1:B5)', expected: 2086.647602, epsilon: 0.1 },
], SetRange => {
  SetRange('A1', [[-10000], [2750], [4250], [3250], [2750]]);
  SetRange('B1', [[39448], [39508], [39751], [39859], [39904]]);
});

AddTests('XIRR', [
  { type: 'approximate', expression: '=XIRR(A1:A5,B1:B5)', expected: 0.373362535, epsilon: 0.01 },
], SetRange => {
  SetRange('A1', [[-10000], [2750], [4250], [3250], [2750]]);
  SetRange('B1', [[39448], [39508], [39751], [39859], [39904]]);
});
