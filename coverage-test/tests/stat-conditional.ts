
import { AddTests } from '@util';

AddTests('AVERAGEIF', [
  { type: 'expect', expression: '=AVERAGEIF(A1:A5,">20")', expected: 40 },
  { type: 'expect', expression: '=AVERAGEIF(B1:B5,"Sales",A1:A5)', expected: 30 },
  { type: 'expect', expression: '=AVERAGEIF(A1:A5,"<30")', expected: 15 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
  SetRange('B1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
});

AddTests('AVERAGEIFS', [
  { type: 'expect', expression: '=AVERAGEIFS(C1:C5,A1:A5,"Sales",B1:B5,">25")', expected: 35 },
  { type: 'expect', expression: '=AVERAGEIFS(C1:C5,A1:A5,"Engineering")', expected: 50 },
], SetRange => {
  SetRange('A1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
  SetRange('B1', [[20], [25], [30], [35], [40]]);
  SetRange('C1', [[50], [60], [20], [40], [50]]);
});

AddTests('COUNTIF', [
  { type: 'expect', expression: '=COUNTIF(A1:A5,">20")', expected: 3 },
  { type: 'expect', expression: '=COUNTIF(B1:B5,"Sales")', expected: 3 },
  { type: 'expect', expression: '=COUNTIF(A1:A5,30)', expected: 1 },
  { type: 'expect', expression: '=COUNTIF(A1:A5,"<=30")', expected: 3 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
  SetRange('B1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
});

AddTests('COUNTIFS', [
  { type: 'expect', expression: '=COUNTIFS(A1:A5,"Sales",B1:B5,">25")', expected: 2 },
  { type: 'expect', expression: '=COUNTIFS(A1:A5,"Engineering")', expected: 2 },
  { type: 'expect', expression: '=COUNTIFS(A1:A5,"Sales",B1:B5,">=20")', expected: 3 },
], SetRange => {
  SetRange('A1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
  SetRange('B1', [[20], [25], [30], [35], [40]]);
});

AddTests('MAXIFS', [
  { type: 'expect', expression: '=MAXIFS(B1:B5,A1:A5,"Sales")', expected: 40 },
  { type: 'expect', expression: '=MAXIFS(B1:B5,A1:A5,"Engineering")', expected: 35 },
  { type: 'expect', expression: '=MAXIFS(B1:B5,B1:B5,">25")', expected: 40 },
], SetRange => {
  SetRange('A1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
  SetRange('B1', [[20], [25], [30], [35], [40]]);
});

AddTests('MINIFS', [
  { type: 'expect', expression: '=MINIFS(B1:B5,A1:A5,"Sales")', expected: 20 },
  { type: 'expect', expression: '=MINIFS(B1:B5,A1:A5,"Engineering")', expected: 25 },
  { type: 'expect', expression: '=MINIFS(B1:B5,B1:B5,"<35")', expected: 20 },
], SetRange => {
  SetRange('A1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
  SetRange('B1', [[20], [25], [30], [35], [40]]);
});
