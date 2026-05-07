
import { AddTests } from '@util';

AddTests('LOOKUP', [
  { type: 'expect', expression: '=LOOKUP(3,A1:A5,B1:B5)', expected: 'Charlie' },
  { type: 'expect', expression: '=LOOKUP(1,A1:A5,B1:B5)', expected: 'Alice' },
  { type: 'expect', expression: '=LOOKUP(5,A1:A5,B1:B5)', expected: 'Eve' },
  { type: 'expect', expression: '=LOOKUP(2.5,A1:A5,B1:B5)', expected: 'Bob' },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [['Alice'], ['Bob'], ['Charlie'], ['Diana'], ['Eve']]);
});

AddTests('XMATCH', [
  { type: 'expect', expression: '=XMATCH(3,A1:A5)', expected: 3 },
  { type: 'expect', expression: '=XMATCH(1,A1:A5)', expected: 1 },
  { type: 'expect', expression: '=XMATCH(5,A1:A5)', expected: 5 },
  { type: 'expect', expression: '=XMATCH("cherry",B1:B5,0)', expected: 3 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [['apple'], ['banana'], ['cherry'], ['date'], ['elderberry']]);
});

AddTests('AREAS', [
  { type: 'expect', expression: '=AREAS(A1:A5)', expected: 1 },
  { type: 'expect', expression: '=AREAS(A1)', expected: 1 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
});
