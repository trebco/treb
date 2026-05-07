
import { AddTests } from '@util';

AddTests('DROP', [
  { type: 'expect', expression: '=INDEX(DROP(A1:A5,2),1,1)', expected: 30 },
  { type: 'expect', expression: '=INDEX(DROP(A1:A5,2),3,1)', expected: 50 },
  { type: 'expect', expression: '=INDEX(DROP(A1:A5,-2),1,1)', expected: 10 },
  { type: 'expect', expression: '=INDEX(DROP(A1:A5,-2),3,1)', expected: 30 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('TAKE', [
  { type: 'expect', expression: '=INDEX(TAKE(A1:A5,3),1,1)', expected: 10 },
  { type: 'expect', expression: '=INDEX(TAKE(A1:A5,3),3,1)', expected: 30 },
  { type: 'expect', expression: '=INDEX(TAKE(A1:A5,-2),1,1)', expected: 40 },
  { type: 'expect', expression: '=INDEX(TAKE(A1:A5,-2),2,1)', expected: 50 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('EXPAND', [
  { type: 'expect', expression: '=INDEX(EXPAND(A1:B2,3,3,""),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(EXPAND(A1:B2,3,3,""),3,3)', expected: '' },
  { type: 'expect', expression: '=INDEX(EXPAND(A1:B2,3,3,0),3,1)', expected: 0 },
  { type: 'expect', expression: '=INDEX(EXPAND(A1:B2,3,3,0),2,2)', expected: 4 },
], SetRange => {
  SetRange('A1', [[1, 2], [3, 4]]);
});

AddTests('TRIMRANGE', [
  { type: 'expect', expression: '=ROWS(TRIMRANGE(A1:A5))', expected: 3 },
  { type: 'expect', expression: '=INDEX(TRIMRANGE(A1:A5),1,1)', expected: 10 },
  { type: 'expect', expression: '=INDEX(TRIMRANGE(A1:A5),3,1)', expected: 30 },
], SetRange => {
  SetRange('A1', [[10], [20], [30]]);
});
