
import { AddTests } from '@util';

AddTests('ADDRESS', [
  { type: 'expect', expression: '=ADDRESS(2,3)', expected: '$C$2' },
  { type: 'expect', expression: '=ADDRESS(2,3,2)', expected: 'C$2' },
  { type: 'expect', expression: '=ADDRESS(2,3,3)', expected: '$C2' },
  { type: 'expect', expression: '=ADDRESS(2,3,4)', expected: 'C2' },
]);

AddTests('INDIRECT', [
  { type: 'expect', expression: '=INDIRECT("A1")', expected: 100 },
  { type: 'expect', expression: '=INDIRECT("B2")', expected: 50 },
  { type: 'expect', expression: '=INDIRECT("A"&"2")', expected: 200 },
], SetRange => {
  SetRange('A1', [[100], [200]]);
  SetRange('B1', [[25], [50]]);
});

AddTests('OFFSET', [
  { type: 'expect', expression: '=OFFSET(A1,1,0)', expected: 20 },
  { type: 'expect', expression: '=OFFSET(A1,2,1)', expected: 60 },
  { type: 'expect', expression: '=SUM(OFFSET(A1,0,0,3,1))', expected: 60 },
  { type: 'expect', expression: '=OFFSET(A1,0,0)', expected: 10 },
], SetRange => {
  SetRange('A1', [[10, 40], [20, 50], [30, 60]]);
});

AddTests('FORMULATEXT', [
  { type: 'expect', expression: '=FORMULATEXT(A1)', expected: '=1+2' },
], SetRange => {
  SetRange('A1', '=1+2');
});
