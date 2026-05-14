
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('STDEV', [
  { type: 'approximate', expression: '=STDEV(A1:A5)', expected: 15.811388301, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('STDEVP', [
  { type: 'approximate', expression: '=STDEVP(A1:A5)', expected: 14.142135624, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('VAR', [
  { type: 'approximate', expression: '=VAR(A1:A5)', expected: 250, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('VARP', [
  { type: 'approximate', expression: '=VARP(A1:A5)', expected: 200, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('WEIBULL', [
  { type: 'approximate', expression: '=WEIBULL(105,20,100,TRUE)', expected: 0.9295813901, epsilon: 1e-6 },
  { type: 'approximate', expression: '=WEIBULL(105,20,100,FALSE)', expected: 0.0355888640, epsilon: 1e-6 },
]);

AddTests('ZTEST', [
  { type: 'approximate', expression: '=ZTEST(A1:A5,4)', expected: 0.0084136959, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[3], [6], [7], [8], [6]]);
});
