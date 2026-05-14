
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('T.DIST', [
  { type: 'approximate', expression: '=T.DIST(1,10,TRUE)', expected: 0.8295534339, epsilon },
  { type: 'approximate', expression: '=T.DIST(0,10,TRUE)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=T.DIST(2,5,TRUE)', expected: 0.9490302832, epsilon },
  { type: 'approximate', expression: '=T.DIST(1,10,FALSE)', expected: 0.2303619893, epsilon },
]);

AddTests('T.DIST.2T', [
  { type: 'approximate', expression: '=T.DIST.2T(1,10)', expected: 0.3408931321, epsilon },
  { type: 'approximate', expression: '=T.DIST.2T(2,5)', expected: 0.1019394336, epsilon },
  { type: 'approximate', expression: '=T.DIST.2T(1.96,30)', expected: 0.0593423129, epsilon },
]);

AddTests('T.DIST.RT', [
  { type: 'approximate', expression: '=T.DIST.RT(1,10)', expected: 0.1704465661, epsilon },
  { type: 'approximate', expression: '=T.DIST.RT(0,10)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=T.DIST.RT(2,5)', expected: 0.0509697168, epsilon },
]);

AddTests('T.INV', [
  { type: 'approximate', expression: '=T.INV(0.5,10)', expected: 0, epsilon },
  { type: 'approximate', expression: '=T.INV(0.975,10)', expected: 2.2281388520, epsilon: 1e-6 },
  { type: 'approximate', expression: '=T.INV(0.9,5)', expected: 1.4758840488, epsilon: 1e-6 },
]);

AddTests('T.INV.2T', [
  { type: 'approximate', expression: '=T.INV.2T(0.05,10)', expected: 2.2281388520, epsilon: 1e-6 },
  { type: 'approximate', expression: '=T.INV.2T(0.1,5)', expected: 2.0150483727, epsilon: 1e-6 },
  { type: 'approximate', expression: '=T.INV.2T(0.01,30)', expected: 2.7500389868, epsilon: 1e-6 },
]);

AddTests('T.TEST', [
  { type: 'approximate', expression: '=T.TEST(A1:A5,B1:B5,2,1)', expected: 0.0790205567, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[3], [4], [5], [8], [9]]);
  SetRange('B1', [[6], [19], [3], [2], [14]]);
});
