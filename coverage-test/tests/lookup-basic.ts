
import { AddTests } from '@util';

AddTests('ROW', [
  { type: 'expect', expression: '=ROW(A1)', expected: 1 },
  { type: 'expect', expression: '=ROW(B5)', expected: 5 },
  { type: 'expect', expression: '=ROW(C100)', expected: 100 },
]);

AddTests('COLUMN', [
  { type: 'expect', expression: '=COLUMN(A1)', expected: 1 },
  { type: 'expect', expression: '=COLUMN(C1)', expected: 3 },
  { type: 'expect', expression: '=COLUMN(Z1)', expected: 26 },
]);

AddTests('ROWS', [
  { type: 'expect', expression: '=ROWS(A1:A5)', expected: 5 },
  { type: 'expect', expression: '=ROWS(A1:C3)', expected: 3 },
  { type: 'expect', expression: '=ROWS(A1:A1)', expected: 1 },
]);

AddTests('COLUMNS', [
  { type: 'expect', expression: '=COLUMNS(A1:C1)', expected: 3 },
  { type: 'expect', expression: '=COLUMNS(A1:C3)', expected: 3 },
  { type: 'expect', expression: '=COLUMNS(A1:A1)', expected: 1 },
]);

AddTests('CHOOSE', [
  { type: 'expect', expression: '=CHOOSE(1,"a","b","c")', expected: 'a' },
  { type: 'expect', expression: '=CHOOSE(2,"a","b","c")', expected: 'b' },
  { type: 'expect', expression: '=CHOOSE(3,"a","b","c")', expected: 'c' },
  { type: 'expect', expression: '=CHOOSE(1,10,20,30)', expected: 10 },
]);

AddTests('INDEX', [
  { type: 'expect', expression: '=INDEX(A1:C3,2,3)', expected: 60 },
  { type: 'expect', expression: '=INDEX(A1:C3,1,1)', expected: 10 },
  { type: 'expect', expression: '=INDEX(A1:C3,3,2)', expected: 80 },
], SetRange => {
  SetRange('A1', [[10, 20, 30], [40, 50, 60], [70, 80, 90]]);
});

AddTests('MATCH', [
  { type: 'expect', expression: '=MATCH(30,A1:A5,0)', expected: 3 },
  { type: 'expect', expression: '=MATCH(10,A1:A5,0)', expected: 1 },
  { type: 'expect', expression: '=MATCH(50,A1:A5,0)', expected: 5 },
  { type: 'expect', expression: '=MATCH("cherry",B1:B5,0)', expected: 3 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
  SetRange('B1', [['apple'], ['banana'], ['cherry'], ['date'], ['elderberry']]);
});
