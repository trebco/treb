
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('CORREL', [
  { type: 'approximate', expression: '=CORREL(A1:A5,B1:B5)', expected: 0.9970544856, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('PEARSON', [
  { type: 'approximate', expression: '=PEARSON(A1:A5,B1:B5)', expected: 0.774596669241483, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});


AddTests('RSQ', [
  { type: 'approximate', expression: '=RSQ(A1:A5,B1:B5)', expected: 0.6, epsilon },
], SetRange => {
  SetRange('A1', [[2], [4], [5], [4], [5]]);
  SetRange('B1', [[1], [2], [3], [4], [5]]);
});

AddTests('COVARIANCE.P', [
  { type: 'approximate', expression: '=COVARIANCE.P(A1:A5,B1:B5)', expected: 5.2, epsilon },
], SetRange => {
  SetRange('A1', [[3], [2], [4], [5], [6]]);
  SetRange('B1', [[9], [7], [12], [15], [17]]);
});

AddTests('COVARIANCE.S', [
  { type: 'approximate', expression: '=COVARIANCE.S(A1:A5,B1:B5)', expected: 6.5, epsilon },
], SetRange => {
  SetRange('A1', [[3], [2], [4], [5], [6]]);
  SetRange('B1', [[9], [7], [12], [15], [17]]);
});
