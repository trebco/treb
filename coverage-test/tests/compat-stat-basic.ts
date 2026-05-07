
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('CRITBINOM', [
  { type: 'expect', expression: '=CRITBINOM(6,0.5,0.75)', expected: 4 },
  { type: 'expect', expression: '=CRITBINOM(10,0.5,0.5)', expected: 5 },
]);

AddTests('COVAR', [
  { type: 'approximate', expression: '=COVAR(A1:A5,B1:B5)', expected: 5.2, epsilon },
], SetRange => {
  SetRange('A1', [[3], [2], [4], [5], [6]]);
  SetRange('B1', [[9], [7], [12], [15], [17]]);
});

AddTests('MODE', [
  { type: 'expect', expression: '=MODE(A1:A8)', expected: 4 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [4], [5], [4], [6]]);
});

AddTests('PERCENTILE', [
  { type: 'expect', expression: '=PERCENTILE(A1:A5,0.5)', expected: 30 },
  { type: 'approximate', expression: '=PERCENTILE(A1:A5,0.25)', expected: 20, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('PERCENTRANK', [
  { type: 'approximate', expression: '=PERCENTRANK(A1:A5,30)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=PERCENTRANK(A1:A5,10)', expected: 0, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('QUARTILE', [
  { type: 'expect', expression: '=QUARTILE(A1:A5,2)', expected: 30 },
  { type: 'approximate', expression: '=QUARTILE(A1:A5,1)', expected: 20, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('RANK', [
  { type: 'expect', expression: '=RANK(30,A1:A5)', expected: 3 },
  { type: 'expect', expression: '=RANK(50,A1:A5)', expected: 1 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});
