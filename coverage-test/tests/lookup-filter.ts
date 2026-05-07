
import { AddTests } from '@util';

AddTests('FILTER', [
  { type: 'expect', expression: '=INDEX(FILTER(B1:B5,A1:A5>30),1,1)', expected: 'Diana' },
  { type: 'expect', expression: '=INDEX(FILTER(B1:B5,A1:A5>30),2,1)', expected: 'Eve' },
  { type: 'expect', expression: '=INDEX(FILTER(A1:A5,A1:A5<=20),1,1)', expected: 10 },
  { type: 'expect', expression: '=INDEX(FILTER(A1:A5,A1:A5<=20),2,1)', expected: 20 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
  SetRange('B1', [['Alice'], ['Bob'], ['Charlie'], ['Diana'], ['Eve']]);
});

AddTests('SORT', [
  { type: 'expect', expression: '=INDEX(SORT(A1:A5),1,1)', expected: 10 },
  { type: 'expect', expression: '=INDEX(SORT(A1:A5),5,1)', expected: 50 },
  { type: 'expect', expression: '=INDEX(SORT(A1:A5,1,-1),1,1)', expected: 50 },
  { type: 'expect', expression: '=INDEX(SORT(A1:A5,1,-1),5,1)', expected: 10 },
], SetRange => {
  SetRange('A1', [[30], [10], [50], [20], [40]]);
});

AddTests('SORTBY', [
  { type: 'expect', expression: '=INDEX(SORTBY(A1:A5,B1:B5),1,1)', expected: 'Alice' },
  { type: 'expect', expression: '=INDEX(SORTBY(A1:A5,B1:B5),5,1)', expected: 'Eve' },
  { type: 'expect', expression: '=INDEX(SORTBY(A1:A5,B1:B5,-1),1,1)', expected: 'Eve' },
], SetRange => {
  SetRange('A1', [['Charlie'], ['Alice'], ['Eve'], ['Bob'], ['Diana']]);
  SetRange('B1', [[3], [1], [5], [2], [4]]);
});

AddTests('UNIQUE', [
  { type: 'expect', expression: '=INDEX(UNIQUE(A1:A7),1,1)', expected: 'apple' },
  { type: 'expect', expression: '=INDEX(UNIQUE(A1:A7),2,1)', expected: 'banana' },
  { type: 'expect', expression: '=INDEX(UNIQUE(A1:A7),3,1)', expected: 'cherry' },
], SetRange => {
  SetRange('A1', [['apple'], ['banana'], ['apple'], ['cherry'], ['banana'], ['apple'], ['cherry']]);
});
