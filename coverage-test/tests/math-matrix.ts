
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('MDETERM', [
  { type: 'expect', expression: '=MDETERM(A1:B2)', expected: -2 },
], SetRange => {
  SetRange('A1', [[1, 2], [3, 4]]);
});

AddTests('MDETERM', [
  { type: 'approximate', expression: '=MDETERM(A1:C3)', expected: -306, epsilon },
], SetRange => {
  SetRange('A1', [[6, 1, 1], [4, -2, 5], [2, 8, 7]]);
});

AddTests('MINVERSE', [
  { type: 'expect', expression: '=INDEX(MINVERSE(A1:B2),1,1)', expected: -2 },
  { type: 'approximate', expression: '=INDEX(MINVERSE(A1:B2),1,2)', expected: 1, epsilon },
  { type: 'approximate', expression: '=INDEX(MINVERSE(A1:B2),2,1)', expected: 1.5, epsilon },
  { type: 'approximate', expression: '=INDEX(MINVERSE(A1:B2),2,2)', expected: -0.5, epsilon },
], SetRange => {
  SetRange('A1', [[1, 2], [3, 4]]);
});

AddTests('MMULT', [
  { type: 'expect', expression: '=INDEX(MMULT(A1:B2,C1:D2),1,1)', expected: 19 },
  { type: 'expect', expression: '=INDEX(MMULT(A1:B2,C1:D2),1,2)', expected: 22 },
  { type: 'expect', expression: '=INDEX(MMULT(A1:B2,C1:D2),2,1)', expected: 43 },
  { type: 'expect', expression: '=INDEX(MMULT(A1:B2,C1:D2),2,2)', expected: 50 },
], SetRange => {
  SetRange('A1', [[1, 2], [3, 4]]);
  SetRange('C1', [[5, 6], [7, 8]]);
});

AddTests('MUNIT', [
  { type: 'expect', expression: '=INDEX(MUNIT(3),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(MUNIT(3),1,2)', expected: 0 },
  { type: 'expect', expression: '=INDEX(MUNIT(3),2,2)', expected: 1 },
  { type: 'expect', expression: '=INDEX(MUNIT(3),3,3)', expected: 1 },
]);
