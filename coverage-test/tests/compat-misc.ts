
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('CONCATENATE', [
  { type: 'expect', expression: '=CONCATENATE("Hello"," ","World")', expected: 'Hello World' },
  { type: 'expect', expression: '=CONCATENATE("A","B","C")', expected: 'ABC' },
  { type: 'expect', expression: '=CONCATENATE(1,2,3)', expected: '123' },
]);

AddTests('CEILING', [
  { type: 'expect', expression: '=CEILING(2.5,1)', expected: 3 },
  { type: 'expect', expression: '=CEILING(1.5,0.1)', expected: 1.5 },
  { type: 'expect', expression: '=CEILING(-1,2)', expected: 0 },
  { type: 'expect', expression: '=CEILING(6.3,2)', expected: 8 },
]);

AddTests('FLOOR', [
  { type: 'expect', expression: '=FLOOR(3.7,2)', expected: 2 },
  { type: 'expect', expression: '=FLOOR(2.5,1)', expected: 2 },
  { type: 'expect', expression: '=FLOOR(-2.5,-2)', expected: -2 },
  { type: 'expect', expression: '=FLOOR(6.7,2)', expected: 6 },
]);

AddTests('FORECAST', [
  { type: 'approximate', expression: '=FORECAST(6,B1:B5,A1:A5)', expected: 6.4, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('POISSON', [
  { type: 'approximate', expression: '=POISSON(2,5,FALSE)', expected: 0.0842243531, epsilon },
  { type: 'approximate', expression: '=POISSON(2,5,TRUE)', expected: 0.1246520195, epsilon },
]);

AddTests('CONFIDENCE', [
  { type: 'approximate', expression: '=CONFIDENCE(0.05,2.5,50)', expected: 0.6929519121, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CONFIDENCE(0.05,1,100)', expected: 0.1959963985, epsilon: 1e-6 },
]);
