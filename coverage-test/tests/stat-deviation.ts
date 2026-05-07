
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('AVEDEV', [
  { type: 'approximate', expression: '=AVEDEV(A1:A5)', expected: 12, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('DEVSQ', [
  { type: 'approximate', expression: '=DEVSQ(A1:A5)', expected: 1000, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('KURT', [
  { type: 'approximate', expression: '=KURT(A1:A10)', expected: -1.2, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]);
});

AddTests('SKEW', [
  { type: 'approximate', expression: '=SKEW(A1:A5)', expected: 0, epsilon },
  { type: 'approximate', expression: '=SKEW(A1:A10)', expected: 0, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]);
});

AddTests('SKEW.P', [
  { type: 'approximate', expression: '=SKEW.P(A1:A10)', expected: 0, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]);
});
