
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('NORMDIST', [
  { type: 'approximate', expression: '=NORMDIST(0,0,1,TRUE)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=NORMDIST(1,0,1,TRUE)', expected: 0.8413447461, epsilon },
  { type: 'approximate', expression: '=NORMDIST(0,0,1,FALSE)', expected: 0.3989422804, epsilon },
]);

AddTests('NORMINV', [
  { type: 'approximate', expression: '=NORMINV(0.5,0,1)', expected: 0, epsilon },
  { type: 'approximate', expression: '=NORMINV(0.975,0,1)', expected: 1.959963985, epsilon: 1e-6 },
]);

AddTests('NORMSDIST', [
  { type: 'approximate', expression: '=NORMSDIST(0)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=NORMSDIST(1)', expected: 0.8413447461, epsilon },
]);

AddTests('NORMSINV', [
  { type: 'approximate', expression: '=NORMSINV(0.5)', expected: 0, epsilon },
  { type: 'approximate', expression: '=NORMSINV(0.975)', expected: 1.959963985, epsilon: 1e-6 },
]);

AddTests('TDIST', [
  { type: 'approximate', expression: '=TDIST(1,10,2)', expected: 0.3408931321, epsilon },
  { type: 'approximate', expression: '=TDIST(1,10,1)', expected: 0.1704465661, epsilon },
]);

AddTests('TINV', [
  { type: 'approximate', expression: '=TINV(0.05,10)', expected: 2.2281388520, epsilon: 1e-6 },
  { type: 'approximate', expression: '=TINV(0.1,5)', expected: 2.0150483727, epsilon: 1e-6 },
]);

AddTests('TTEST', [
  { type: 'approximate', expression: '=TTEST(A1:A5,B1:B5,2,1)', expected: 0.0790205567, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[3], [4], [5], [8], [9]]);
  SetRange('B1', [[6], [19], [3], [2], [14]]);
});
