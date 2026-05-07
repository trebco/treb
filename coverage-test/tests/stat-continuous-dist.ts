
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('EXPON.DIST', [
  { type: 'approximate', expression: '=EXPON.DIST(0.2,10,TRUE)', expected: 0.8646647168, epsilon },
  { type: 'approximate', expression: '=EXPON.DIST(0.2,10,FALSE)', expected: 1.353352832, epsilon },
  { type: 'approximate', expression: '=EXPON.DIST(1,1,TRUE)', expected: 0.6321205588, epsilon },
  { type: 'approximate', expression: '=EXPON.DIST(0,1,TRUE)', expected: 0, epsilon },
]);

AddTests('GAMMA', [
  { type: 'expect', expression: '=GAMMA(5)', expected: 24 },
  { type: 'approximate', expression: '=GAMMA(0.5)', expected: 1.7724538509, epsilon },
  { type: 'expect', expression: '=GAMMA(1)', expected: 1 },
  { type: 'approximate', expression: '=GAMMA(4.5)', expected: 11.631728397, epsilon: 1e-6 },
]);

AddTests('GAMMA.DIST', [
  { type: 'approximate', expression: '=GAMMA.DIST(10.00001131,9,2,TRUE)', expected: 0.068094, epsilon: 1e-4 },
  { type: 'approximate', expression: '=GAMMA.DIST(2,3,2,TRUE)', expected: 0.0803013971, epsilon: 1e-6 },
  { type: 'approximate', expression: '=GAMMA.DIST(2,3,2,FALSE)', expected: 0.0758163325, epsilon: 1e-6 },
]);

AddTests('GAMMA.INV', [
  { type: 'approximate', expression: '=GAMMA.INV(0.068094,9,2)', expected: 10.00001131, epsilon: 0.01 },
  { type: 'approximate', expression: '=GAMMA.INV(0.5,3,2)', expected: 5.3481341135, epsilon: 1e-6 },
]);

AddTests('GAMMALN', [
  { type: 'approximate', expression: '=GAMMALN(4)', expected: 1.7917594692, epsilon },
  { type: 'expect', expression: '=GAMMALN(1)', expected: 0 },
  { type: 'approximate', expression: '=GAMMALN(0.5)', expected: 0.5723649429, epsilon },
  { type: 'approximate', expression: '=GAMMALN(10)', expected: 12.801827480, epsilon: 1e-6 },
]);

AddTests('GAMMALN.PRECISE', [
  { type: 'approximate', expression: '=GAMMALN.PRECISE(4)', expected: 1.7917594692, epsilon },
  { type: 'expect', expression: '=GAMMALN.PRECISE(1)', expected: 0 },
  { type: 'approximate', expression: '=GAMMALN.PRECISE(0.5)', expected: 0.5723649429, epsilon },
]);

AddTests('WEIBULL.DIST', [
  { type: 'approximate', expression: '=WEIBULL.DIST(105,20,100,TRUE)', expected: 0.9295813901, epsilon: 1e-6 },
  { type: 'approximate', expression: '=WEIBULL.DIST(105,20,100,FALSE)', expected: 0.0353520118, epsilon: 1e-6 },
  { type: 'approximate', expression: '=WEIBULL.DIST(1,1,1,TRUE)', expected: 0.6321205588, epsilon },
]);
