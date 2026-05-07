
import { AddTests } from '@util';

AddTests('LAMBDA', [
  { type: 'expect', expression: '=LET(double,LAMBDA(x,x*2),double(5))', expected: 10 },
  { type: 'expect', expression: '=LET(add,LAMBDA(a,b,a+b),add(3,4))', expected: 7 },
  { type: 'expect', expression: '=LET(sq,LAMBDA(x,x^2),sq(6))', expected: 36 },
  { type: 'expect', expression: '=LET(greet,LAMBDA(n,"Hello "&n),greet("World"))', expected: 'Hello World' },
]);

AddTests('MAP', [
  { type: 'expect', expression: '=INDEX(MAP(A1:A4,LAMBDA(x,x*2)),1,1)', expected: 2 },
  { type: 'expect', expression: '=INDEX(MAP(A1:A4,LAMBDA(x,x*2)),2,1)', expected: 4 },
  { type: 'expect', expression: '=INDEX(MAP(A1:A4,LAMBDA(x,x*2)),4,1)', expected: 8 },
  { type: 'expect', expression: '=INDEX(MAP(A1:A4,LAMBDA(x,x+10)),1,1)', expected: 11 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
});

AddTests('REDUCE', [
  { type: 'expect', expression: '=REDUCE(0,A1:A4,LAMBDA(acc,x,acc+x))', expected: 10 },
  { type: 'expect', expression: '=REDUCE(1,A1:A4,LAMBDA(acc,x,acc*x))', expected: 24 },
  { type: 'expect', expression: '=REDUCE(0,A1:A4,LAMBDA(acc,x,acc+1))', expected: 4 },
  { type: 'expect', expression: '=REDUCE("",A1:A3,LAMBDA(acc,x,acc&x))', expected: 'abc' },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
});

AddTests('REDUCE', [
  { type: 'expect', expression: '=REDUCE("",A1:A3,LAMBDA(acc,x,acc&x))', expected: 'abc' },
], SetRange => {
  SetRange('A1', [['a'], ['b'], ['c']]);
});

AddTests('SCAN', [
  { type: 'expect', expression: '=INDEX(SCAN(0,A1:A4,LAMBDA(acc,x,acc+x)),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(SCAN(0,A1:A4,LAMBDA(acc,x,acc+x)),2,1)', expected: 3 },
  { type: 'expect', expression: '=INDEX(SCAN(0,A1:A4,LAMBDA(acc,x,acc+x)),4,1)', expected: 10 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
});

AddTests('BYCOL', [
  { type: 'expect', expression: '=INDEX(BYCOL(A1:C2,LAMBDA(c,SUM(c))),1,1)', expected: 5 },
  { type: 'expect', expression: '=INDEX(BYCOL(A1:C2,LAMBDA(c,SUM(c))),1,2)', expected: 7 },
  { type: 'expect', expression: '=INDEX(BYCOL(A1:C2,LAMBDA(c,SUM(c))),1,3)', expected: 9 },
], SetRange => {
  SetRange('A1', [[1, 2, 3], [4, 5, 6]]);
});

AddTests('BYROW', [
  { type: 'expect', expression: '=INDEX(BYROW(A1:C2,LAMBDA(r,SUM(r))),1,1)', expected: 6 },
  { type: 'expect', expression: '=INDEX(BYROW(A1:C2,LAMBDA(r,SUM(r))),2,1)', expected: 15 },
], SetRange => {
  SetRange('A1', [[1, 2, 3], [4, 5, 6]]);
});

AddTests('MAKEARRAY', [
  { type: 'expect', expression: '=INDEX(MAKEARRAY(2,3,LAMBDA(r,c,r*c)),1,1)', expected: 1 },
  { type: 'expect', expression: '=INDEX(MAKEARRAY(2,3,LAMBDA(r,c,r*c)),1,3)', expected: 3 },
  { type: 'expect', expression: '=INDEX(MAKEARRAY(2,3,LAMBDA(r,c,r*c)),2,2)', expected: 4 },
  { type: 'expect', expression: '=INDEX(MAKEARRAY(2,3,LAMBDA(r,c,r*c)),2,3)', expected: 6 },
]);
