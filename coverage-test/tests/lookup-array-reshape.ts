
import { AddTests } from '@util';

AddTests('TOCOL', [
  { type: 'expect', expression: '=INDEX(TOCOL(A1:C2),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(TOCOL(A1:C2),2,1)', expected: 4 },
  { type: 'expect', expression: '=INDEX(TOCOL(A1:C2),3,1)', expected: 2 },
  { type: 'expect', expression: '=INDEX(TOCOL(A1:C2),6,1)', expected: 6 },
], SetRange => {
  SetRange('A1', [[1, 2, 3], [4, 5, 6]]);
});

AddTests('TOROW', [
  { type: 'expect', expression: '=INDEX(TOROW(A1:B3),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(TOROW(A1:B3),1,2)', expected: 3 },
  { type: 'expect', expression: '=INDEX(TOROW(A1:B3),1,3)', expected: 5 },
  { type: 'expect', expression: '=INDEX(TOROW(A1:B3),1,4)', expected: 2 },
], SetRange => {
  SetRange('A1', [[1, 2], [3, 4], [5, 6]]);
});

AddTests('TRANSPOSE', [
  { type: 'expect', expression: '=INDEX(TRANSPOSE(A1:C2),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(TRANSPOSE(A1:C2),1,2)', expected: 4 },
  { type: 'expect', expression: '=INDEX(TRANSPOSE(A1:C2),2,1)', expected: 2 },
  { type: 'expect', expression: '=INDEX(TRANSPOSE(A1:C2),3,2)', expected: 6 },
], SetRange => {
  SetRange('A1', [[1, 2, 3], [4, 5, 6]]);
});

AddTests('WRAPCOLS', [
  { type: 'expect', expression: '=INDEX(WRAPCOLS(A1:A6,3),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(WRAPCOLS(A1:A6,3),3,1)', expected: 3 },
  { type: 'expect', expression: '=INDEX(WRAPCOLS(A1:A6,3),1,2)', expected: 4 },
  { type: 'expect', expression: '=INDEX(WRAPCOLS(A1:A6,3),3,2)', expected: 6 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6]]);
});

AddTests('WRAPROWS', [
  { type: 'expect', expression: '=INDEX(WRAPROWS(A1:A6,3),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(WRAPROWS(A1:A6,3),1,3)', expected: 3 },
  { type: 'expect', expression: '=INDEX(WRAPROWS(A1:A6,3),2,1)', expected: 4 },
  { type: 'expect', expression: '=INDEX(WRAPROWS(A1:A6,3),2,3)', expected: 6 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6]]);
});
