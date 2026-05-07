
import { AddTests } from '@util';

AddTests('SUM', [
  { type: 'expect', expression: '=SUM(1,2,3)', expected: 6 },
  { type: 'expect', expression: '=SUM({1;2;3},{4,5,6})', expected: 21 },
]);

AddTests('SUM', [
  { type: 'expect', expression: '=SUM(A1:A5)', expected: 150 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('SUMSQ', [
  { type: 'expect', expression: '=SUMSQ(1,2,3)', expected: 14 },
  { type: 'expect', expression: '=SUMSQ(4,5)', expected: 41 },
  { type: 'expect', expression: '=SUMSQ(0)', expected: 0 },
  { type: 'expect', expression: '=SUMSQ(-3,3)', expected: 18 },
]);

AddTests('PRODUCT', [
  { type: 'expect', expression: '=PRODUCT(2,3,4)', expected: 24 },
  { type: 'expect', expression: '=PRODUCT(5,0)', expected: 0 },
  { type: 'expect', expression: '=PRODUCT(-2,3)', expected: -6 },
  { type: 'expect', expression: '=PRODUCT(1,2,3,4,5)', expected: 120 },
]);

AddTests('SUMPRODUCT', [
  { type: 'expect', expression: '=SUMPRODUCT({1,2,3},{4,5,6})', expected: 32 },
  { type: 'expect', expression: '=SUMPRODUCT({1;2},{3;4})', expected: 11 },
]);

AddTests('SUMPRODUCT', [
  { type: 'expect', expression: '=SUMPRODUCT(A1:A3,B1:B3)', expected: 32 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[4], [5], [6]]);
});

AddTests('SUBTOTAL', [
  { type: 'expect', expression: '=SUBTOTAL(9,A1:A5)', expected: 150 },
  { type: 'expect', expression: '=SUBTOTAL(1,A1:A5)', expected: 30 },
  { type: 'expect', expression: '=SUBTOTAL(2,A1:A5)', expected: 5 },
  { type: 'expect', expression: '=SUBTOTAL(4,A1:A5)', expected: 50 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('AGGREGATE', [
  { type: 'expect', expression: '=AGGREGATE(9,6,A1:A5)', expected: 150 },
  { type: 'expect', expression: '=AGGREGATE(1,6,A1:A5)', expected: 30 },
  { type: 'expect', expression: '=AGGREGATE(4,6,A1:A5)', expected: 50 },
  { type: 'expect', expression: '=AGGREGATE(5,6,A1:A5)', expected: 10 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});
