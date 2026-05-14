
import { AddTests } from '@util';

AddTests('SUMIF', [
  { type: 'expect', expression: '=SUMIF(A1:A5,">20")', expected: 120 },
  { type: 'expect', expression: '=SUMIF(A1:A5,"<30")', expected: 30 },
  { type: 'expect', expression: '=SUMIF(B1:B5,"Sales",A1:A5)', expected: 90 },
  { type: 'expect', expression: '=SUMIF(A1:A5,30)', expected: 30 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
  SetRange('B1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
});

AddTests('SUMIFS', [
  { type: 'expect', expression: '=SUMIFS(C1:C5,A1:A5,"Sales",B1:B5,">25")', expected: 70 },
  { type: 'expect', expression: '=SUMIFS(C1:C5,A1:A5,"Engineering")', expected: 100 },
  { type: 'expect', expression: '=SUMIFS(C1:C5,B1:B5,">30")', expected: 90 },
  { type: 'expect', expression: '=SUMIFS(C1:C5,A1:A5,"Sales",B1:B5,"<50")', expected: 120 },
], SetRange => {
  SetRange('A1', [['Sales'], ['Engineering'], ['Sales'], ['Engineering'], ['Sales']]);
  SetRange('B1', [[20], [25], [30], [35], [40]]);
  SetRange('C1', [[50], [60], [20], [40], [50]]);
});
