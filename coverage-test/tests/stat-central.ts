
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('AVERAGE', [
  { type: 'expect', expression: '=AVERAGE(1,2,3,4,5)', expected: 3 },
  { type: 'expect', expression: '=AVERAGE(10,20)', expected: 15 },
]);

AddTests('AVERAGE', [
  { type: 'expect', expression: '=AVERAGE(A1:A5)', expected: 30 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('AVERAGEA', [
  { type: 'expect', expression: '=AVERAGEA(A1:A5)', expected: 30 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('AVERAGEA', [
  { type: 'approximate', expression: '=AVERAGEA(A1:A4)', expected: 2.75, epsilon },
], SetRange => {
  SetRange('A1', 10);
  SetRange('A2', true);
  SetRange('A3', false);
  SetRange('A4', 'text');
});

AddTests('MEDIAN', [
  { type: 'expect', expression: '=MEDIAN(1,2,3,4,5)', expected: 3 },
  { type: 'expect', expression: '=MEDIAN(1,2,3,4)', expected: 2.5 },
  { type: 'expect', expression: '=MEDIAN(1)', expected: 1 },
  { type: 'expect', expression: '=MEDIAN(3,1,2)', expected: 2 },
]);

AddTests('MODE.SNGL', [
  { type: 'expect', expression: '=MODE.SNGL(A1:A8)', expected: 4 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [4], [5], [4], [6]]);
});

AddTests('MODE.MULT', [
  { type: 'expect', expression: '=INDEX(MODE.MULT(A1:A8),1,1)', expected: 4 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [4], [5], [4], [6]]);
});

AddTests('GEOMEAN', [
  { type: 'approximate', expression: '=GEOMEAN(4,9)', expected: 6, epsilon },
  { type: 'approximate', expression: '=GEOMEAN(1,2,3,4,5)', expected: 2.6051710847, epsilon },
  { type: 'approximate', expression: '=GEOMEAN(5,5,5)', expected: 5, epsilon },
  { type: 'approximate', expression: '=GEOMEAN(2,8)', expected: 4, epsilon },
]);

AddTests('HARMEAN', [
  { type: 'approximate', expression: '=HARMEAN(4,9)', expected: 5.5384615385, epsilon },
  { type: 'approximate', expression: '=HARMEAN(1,2,3,4,5)', expected: 2.18978102189781, epsilon },
  { type: 'approximate', expression: '=HARMEAN(5,5,5)', expected: 5, epsilon },
  { type: 'approximate', expression: '=HARMEAN(2,8)', expected: 3.2, epsilon },
]);
