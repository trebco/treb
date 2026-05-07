
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('BINOM.DIST', [
  { type: 'approximate', expression: '=BINOM.DIST(6,10,0.5,FALSE)', expected: 0.2050781250, epsilon },
  { type: 'approximate', expression: '=BINOM.DIST(6,10,0.5,TRUE)', expected: 0.8281250000, epsilon },
  { type: 'approximate', expression: '=BINOM.DIST(0,10,0.5,FALSE)', expected: 0.0009765625, epsilon },
  { type: 'approximate', expression: '=BINOM.DIST(10,10,0.5,FALSE)', expected: 0.0009765625, epsilon },
]);

AddTests('BINOM.DIST.RANGE', [
  { type: 'approximate', expression: '=BINOM.DIST.RANGE(60,0.75,45)', expected: 0.0838695159, epsilon: 1e-6 },
  { type: 'approximate', expression: '=BINOM.DIST.RANGE(60,0.75,40,50)', expected: 0.8538285108, epsilon: 1e-6 },
]);

AddTests('BINOM.INV', [
  { type: 'expect', expression: '=BINOM.INV(6,0.5,0.75)', expected: 4 },
  { type: 'expect', expression: '=BINOM.INV(10,0.5,0.5)', expected: 5 },
  { type: 'expect', expression: '=BINOM.INV(10,0.5,0.05)', expected: 2 },
]);

AddTests('POISSON.DIST', [
  { type: 'approximate', expression: '=POISSON.DIST(2,5,FALSE)', expected: 0.0842243531, epsilon },
  { type: 'approximate', expression: '=POISSON.DIST(2,5,TRUE)', expected: 0.1246520195, epsilon },
  { type: 'approximate', expression: '=POISSON.DIST(0,1,FALSE)', expected: 0.3678794412, epsilon },
  { type: 'approximate', expression: '=POISSON.DIST(5,5,FALSE)', expected: 0.1754673698, epsilon },
]);

AddTests('NEGBINOM.DIST', [
  { type: 'approximate', expression: '=NEGBINOM.DIST(10,5,0.25,FALSE)', expected: 0.0550486247, epsilon: 1e-6 },
  { type: 'approximate', expression: '=NEGBINOM.DIST(10,5,0.25,TRUE)', expected: 0.3464207798, epsilon: 1e-6 },
]);

AddTests('HYPGEOM.DIST', [
  { type: 'approximate', expression: '=HYPGEOM.DIST(1,4,8,20,TRUE)', expected: 0.3919599666, epsilon: 1e-6 },
  { type: 'approximate', expression: '=HYPGEOM.DIST(1,4,8,20,FALSE)', expected: 0.3632794457, epsilon: 1e-6 },
]);
