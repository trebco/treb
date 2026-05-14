
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('LOGNORM.DIST', [
  { type: 'approximate', expression: '=LOGNORM.DIST(4,3.5,1.2,TRUE)', expected: 0.0390835557, epsilon },
  { type: 'approximate', expression: '=LOGNORM.DIST(4,3.5,1.2,FALSE)', expected: 0.0176175966, epsilon },
  { type: 'approximate', expression: '=LOGNORM.DIST(1,0,1,TRUE)', expected: 0.5, epsilon },
]);

AddTests('LOGNORM.INV', [
  { type: 'approximate', expression: '=LOGNORM.INV(0.0390835557,3.5,1.2)', expected: 4, epsilon: 0.01 },
  { type: 'approximate', expression: '=LOGNORM.INV(0.5,0,1)', expected: 1, epsilon },
  { type: 'approximate', expression: '=LOGNORM.INV(0.5,3.5,1.2)', expected: 33.115452, epsilon: 0.01 },
]);

AddTests('BETA.DIST', [
  { type: 'approximate', expression: '=BETA.DIST(2,8,10,TRUE,1,3)', expected: 0.6854706, epsilon: 1e-6 },
  { type: 'approximate', expression: '=BETA.DIST(0.5,2,5,TRUE)', expected: 0.8906250000, epsilon },
  { type: 'approximate', expression: '=BETA.DIST(0.5,2,5,FALSE)', expected: 0.9375, epsilon },
]);

AddTests('BETA.INV', [
  { type: 'approximate', expression: '=BETA.INV(0.6854706,8,10,1,3)', expected: 2, epsilon: 0.01 },
  { type: 'approximate', expression: '=BETA.INV(0.5,2,5)', expected: 0.2644499833, epsilon: 1e-6 },
]);

AddTests('CONFIDENCE.NORM', [
  { type: 'approximate', expression: '=CONFIDENCE.NORM(0.05,2.5,50)', expected: 0.6929519121, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CONFIDENCE.NORM(0.05,1,100)', expected: 0.1959963985, epsilon: 1e-6 },
]);

AddTests('CONFIDENCE.T', [
  { type: 'approximate', expression: '=CONFIDENCE.T(0.05,1,50)', expected: 0.2840159669, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CONFIDENCE.T(0.05,2.5,30)', expected: 0.9339781770, epsilon: 1e-6 },
]);
