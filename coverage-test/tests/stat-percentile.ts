
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('PERCENTILE.INC', [
  { type: 'expect', expression: '=PERCENTILE.INC(A1:A5,0)', expected: 10 },
  { type: 'expect', expression: '=PERCENTILE.INC(A1:A5,1)', expected: 50 },
  { type: 'expect', expression: '=PERCENTILE.INC(A1:A5,0.5)', expected: 30 },
  { type: 'approximate', expression: '=PERCENTILE.INC(A1:A5,0.25)', expected: 20, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('PERCENTILE.EXC', [
  { type: 'expect', expression: '=PERCENTILE.EXC(A1:A5,0.5)', expected: 30 },
  { type: 'approximate', expression: '=PERCENTILE.EXC(A1:A5,0.25)', expected: 15, epsilon },
  { type: 'approximate', expression: '=PERCENTILE.EXC(A1:A5,0.75)', expected: 45, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('QUARTILE.INC', [
  { type: 'expect', expression: '=QUARTILE.INC(A1:A5,0)', expected: 10 },
  { type: 'expect', expression: '=QUARTILE.INC(A1:A5,2)', expected: 30 },
  { type: 'expect', expression: '=QUARTILE.INC(A1:A5,4)', expected: 50 },
  { type: 'approximate', expression: '=QUARTILE.INC(A1:A5,1)', expected: 20, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('QUARTILE.EXC', [
  { type: 'approximate', expression: '=QUARTILE.EXC(A1:A5,1)', expected: 15, epsilon },
  { type: 'expect', expression: '=QUARTILE.EXC(A1:A5,2)', expected: 30 },
  { type: 'approximate', expression: '=QUARTILE.EXC(A1:A5,3)', expected: 45, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('TRIMMEAN', [
  { type: 'expect', expression: '=TRIMMEAN(A1:A10,0.2)', expected: 5.5 },
  { type: 'expect', expression: '=TRIMMEAN(A1:A10,0)', expected: 5.5 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]);
});
