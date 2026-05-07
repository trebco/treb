
import { AddTests } from '@util';

AddTests('MIN', [
  { type: 'expect', expression: '=MIN(5,3,8,1,9)', expected: 1 },
  { type: 'expect', expression: '=MIN(-5,0,5)', expected: -5 },
]);

AddTests('MIN', [
  { type: 'expect', expression: '=MIN(A1:A5)', expected: 10 },
], SetRange => {
  SetRange('A1', [[30], [10], [50], [20], [40]]);
});

AddTests('MINA', [
  { type: 'expect', expression: '=MINA(A1:A5)', expected: 0 },
], SetRange => {
  SetRange('A1', 10);
  SetRange('A2', 'hello');
  SetRange('A3', true);
  SetRange('A4', false);
  SetRange('A5', 5);
});

AddTests('MAX', [
  { type: 'expect', expression: '=MAX(5,3,8,1,9)', expected: 9 },
  { type: 'expect', expression: '=MAX(-5,0,5)', expected: 5 },
]);

AddTests('MAX', [
  { type: 'expect', expression: '=MAX(A1:A5)', expected: 50 },
], SetRange => {
  SetRange('A1', [[30], [10], [50], [20], [40]]);
});

AddTests('MAXA', [
  { type: 'expect', expression: '=MAXA(A1:A4)', expected: 10 },
], SetRange => {
  SetRange('A1', 10);
  SetRange('A2', 'hello');
  SetRange('A3', true);
  SetRange('A4', false);
});

AddTests('LARGE', [
  { type: 'expect', expression: '=LARGE(A1:A5,1)', expected: 50 },
  { type: 'expect', expression: '=LARGE(A1:A5,2)', expected: 40 },
  { type: 'expect', expression: '=LARGE(A1:A5,5)', expected: 10 },
], SetRange => {
  SetRange('A1', [[30], [10], [50], [20], [40]]);
});

AddTests('SMALL', [
  { type: 'expect', expression: '=SMALL(A1:A5,1)', expected: 10 },
  { type: 'expect', expression: '=SMALL(A1:A5,2)', expected: 20 },
  { type: 'expect', expression: '=SMALL(A1:A5,5)', expected: 50 },
], SetRange => {
  SetRange('A1', [[30], [10], [50], [20], [40]]);
});
