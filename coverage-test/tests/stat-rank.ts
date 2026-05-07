
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('RANK.EQ', [
  { type: 'expect', expression: '=RANK.EQ(30,A1:A5)', expected: 3 },
  { type: 'expect', expression: '=RANK.EQ(50,A1:A5)', expected: 1 },
  { type: 'expect', expression: '=RANK.EQ(10,A1:A5)', expected: 5 },
  { type: 'expect', expression: '=RANK.EQ(10,A1:A5,1)', expected: 1 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('RANK.AVG', [
  { type: 'expect', expression: '=RANK.AVG(30,A1:A5)', expected: 3 },
  { type: 'expect', expression: '=RANK.AVG(50,A1:A5)', expected: 1 },
  { type: 'expect', expression: '=RANK.AVG(10,A1:A5,1)', expected: 1 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('PERCENTRANK.INC', [
  { type: 'approximate', expression: '=PERCENTRANK.INC(A1:A5,30)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=PERCENTRANK.INC(A1:A5,10)', expected: 0, epsilon },
  { type: 'approximate', expression: '=PERCENTRANK.INC(A1:A5,50)', expected: 1, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('PERCENTRANK.EXC', [
  { type: 'approximate', expression: '=PERCENTRANK.EXC(A1:A5,30)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=PERCENTRANK.EXC(A1:A5,10)', expected: 0.166, epsilon: 0.001 },
  { type: 'approximate', expression: '=PERCENTRANK.EXC(A1:A5,50)', expected: 0.833, epsilon: 0.001 },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('PROB', [
  { type: 'approximate', expression: '=PROB(A1:A4,B1:B4,1)', expected: 0.1, epsilon },
  { type: 'approximate', expression: '=PROB(A1:A4,B1:B4,1,3)', expected: 0.8, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
  SetRange('B1', [[0.1], [0.2], [0.5], [0.2]]);
});
