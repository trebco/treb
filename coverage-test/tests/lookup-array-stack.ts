
import { AddTests } from '@util';

AddTests('HSTACK', [
  { type: 'expect', expression: '=INDEX(HSTACK(A1:A3,B1:B3),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(HSTACK(A1:A3,B1:B3),1,2)', expected: 4 },
  { type: 'expect', expression: '=INDEX(HSTACK(A1:A3,B1:B3),3,1)', expected: 3 },
  { type: 'expect', expression: '=INDEX(HSTACK(A1:A3,B1:B3),3,2)', expected: 6 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[4], [5], [6]]);
});

AddTests('VSTACK', [
  { type: 'expect', expression: '=INDEX(VSTACK(A1:C1,A2:C2),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(VSTACK(A1:C1,A2:C2),2,1)', expected: 4 },
  { type: 'expect', expression: '=INDEX(VSTACK(A1:C1,A2:C2),1,3)', expected: 3 },
  { type: 'expect', expression: '=INDEX(VSTACK(A1:C1,A2:C2),2,3)', expected: 6 },
], SetRange => {
  SetRange('A1', [[1, 2, 3], [4, 5, 6]]);
});

AddTests('CHOOSECOLS', [
  { type: 'expect', expression: '=INDEX(CHOOSECOLS(A1:C3,1,3),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(CHOOSECOLS(A1:C3,1,3),1,2)', expected: 3 },
  { type: 'expect', expression: '=INDEX(CHOOSECOLS(A1:C3,2),2,1)', expected: 5 },
  { type: 'expect', expression: '=INDEX(CHOOSECOLS(A1:C3,3,1),1,1)', expected: 3 },
], SetRange => {
  SetRange('A1', [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
});

AddTests('CHOOSEROWS', [
  { type: 'expect', expression: '=INDEX(CHOOSEROWS(A1:C3,1,3),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(CHOOSEROWS(A1:C3,1,3),2,1)', expected: 7 },
  { type: 'expect', expression: '=INDEX(CHOOSEROWS(A1:C3,2),1,2)', expected: 5 },
  { type: 'expect', expression: '=INDEX(CHOOSEROWS(A1:C3,3,1),1,1)', expected: 7 },
], SetRange => {
  SetRange('A1', [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
});
