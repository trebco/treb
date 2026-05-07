
import { AddTests } from '@util';

AddTests('SUMX2MY2', [
  { type: 'expect', expression: '=SUMX2MY2(A1:A3,B1:B3)', expected: -63 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[4], [5], [6]]);
});

AddTests('SUMX2MY2', [
  { type: 'expect', expression: '=SUMX2MY2(A1:A4,B1:B4)', expected: 0 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
  SetRange('B1', [[1], [2], [3], [4]]);
});

AddTests('SUMX2PY2', [
  { type: 'expect', expression: '=SUMX2PY2(A1:A3,B1:B3)', expected: 91 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[4], [5], [6]]);
});

AddTests('SUMX2PY2', [
  { type: 'expect', expression: '=SUMX2PY2(A1:A3,B1:B3)', expected: 28 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[1], [2], [3]]);
});

AddTests('SUMXMY2', [
  { type: 'expect', expression: '=SUMXMY2(A1:A3,B1:B3)', expected: 27 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[4], [5], [6]]);
});

AddTests('SUMXMY2', [
  { type: 'expect', expression: '=SUMXMY2(A1:A3,B1:B3)', expected: 0 },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[1], [2], [3]]);
});
