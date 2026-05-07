
import { AddTests } from '@util';

AddTests('COUNT', [
  { type: 'expect', expression: '=COUNT(1,2,3)', expected: 3 },
  { type: 'expect', expression: '=COUNT(1,"text",3)', expected: 2 },
]);

AddTests('COUNT', [
  { type: 'expect', expression: '=COUNT(A1:A5)', expected: 3 },
], SetRange => {
  SetRange('A1', 10);
  SetRange('A2', 'hello');
  SetRange('A3', 20);
  SetRange('A4', true);
  SetRange('A5', 30);
});

AddTests('COUNTA', [
  { type: 'expect', expression: '=COUNTA(1,"text",TRUE)', expected: 3 },
]);

AddTests('COUNTA', [
  { type: 'expect', expression: '=COUNTA(A1:A5)', expected: 4 },
], SetRange => {
  SetRange('A1', 10);
  SetRange('A2', 'hello');
  SetRange('A3', 20);
  SetRange('A5', 30);
});

AddTests('COUNTBLANK', [
  { type: 'expect', expression: '=COUNTBLANK(A1:A5)', expected: 2 },
], SetRange => {
  SetRange('A1', 10);
  SetRange('A3', 20);
  SetRange('A5', 30);
});

AddTests('COUNTBLANK', [
  { type: 'expect', expression: '=COUNTBLANK(A1:A3)', expected: 0 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
});
