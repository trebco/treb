
import { AddTests } from '@util';

const epsilon = 1e-6;
const inv_epsilon = 1e-3;

AddTests('NORM.DIST', [
  { type: 'approximate', expression: '=NORM.DIST(0,0,1,TRUE)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=NORM.DIST(1,0,1,TRUE)', expected: 0.8413447461, epsilon },
  { type: 'approximate', expression: '=NORM.DIST(0,0,1,FALSE)', expected: 0.3989422804, epsilon },
  { type: 'approximate', expression: '=NORM.DIST(-1,0,1,TRUE)', expected: 0.1586552539, epsilon },
]);

AddTests('NORM.INV', [
  { type: 'approximate', expression: '=NORM.INV(0.5,0,1)', expected: 0, epsilon },
  { type: 'approximate', expression: '=NORM.INV(0.8413447461,0,1)', expected: 1, epsilon: inv_epsilon },
  { type: 'approximate', expression: '=NORM.INV(0.975,0,1)', expected: 1.959963985, epsilon: inv_epsilon },
  { type: 'approximate', expression: '=NORM.INV(0.5,10,2)', expected: 10, epsilon },
]);

AddTests('NORM.S.DIST', [
  { type: 'approximate', expression: '=NORM.S.DIST(0,TRUE)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=NORM.S.DIST(1,TRUE)', expected: 0.8413447461, epsilon },
  { type: 'approximate', expression: '=NORM.S.DIST(0,FALSE)', expected: 0.3989422804, epsilon },
  { type: 'approximate', expression: '=NORM.S.DIST(-1.96,TRUE)', expected: 0.0249978951, epsilon },
]);

AddTests('NORM.S.INV', [
  { type: 'approximate', expression: '=NORM.S.INV(0.5)', expected: 0, epsilon },
  { type: 'approximate', expression: '=NORM.S.INV(0.975)', expected: 1.959963985, epsilon: inv_epsilon },
  { type: 'approximate', expression: '=NORM.S.INV(0.025)', expected: -1.959963985, epsilon: inv_epsilon },
  { type: 'approximate', expression: '=NORM.S.INV(0.8413447461)', expected: 1, epsilon: inv_epsilon },
]);

AddTests('STANDARDIZE', [
  { type: 'expect', expression: '=STANDARDIZE(42,40,1.5)', expected: 4/3 },
  { type: 'expect', expression: '=STANDARDIZE(10,10,5)', expected: 0 },
  { type: 'expect', expression: '=STANDARDIZE(0,0,1)', expected: 0 },
  { type: 'expect', expression: '=STANDARDIZE(15,10,2)', expected: 2.5 },
]);

AddTests('PHI', [
  { type: 'approximate', expression: '=PHI(0)', expected: 0.3989422804, epsilon },
  { type: 'approximate', expression: '=PHI(1)', expected: 0.2419707245, epsilon },
  { type: 'approximate', expression: '=PHI(-1)', expected: 0.2419707245, epsilon },
  { type: 'approximate', expression: '=PHI(2)', expected: 0.0539909665, epsilon },
]);

AddTests('GAUSS', [
  { type: 'approximate', expression: '=GAUSS(0)', expected: 0, epsilon },
  { type: 'approximate', expression: '=GAUSS(1)', expected: 0.3413447461, epsilon },
  { type: 'approximate', expression: '=GAUSS(2)', expected: 0.4772498681, epsilon },
  { type: 'approximate', expression: '=GAUSS(-1)', expected: -0.3413447461, epsilon },
]);
