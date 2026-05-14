
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('BESSELI', [
  { type: 'approximate', expression: '=BESSELI(1.5,1)', expected: 0.9816664286, epsilon },
  { type: 'expect', expression: '=BESSELI(0,0)', expected: 1 },
  { type: 'approximate', expression: '=BESSELI(1,0)', expected: 1.2660658778, epsilon },
]);

AddTests('BESSELJ', [
  { type: 'approximate', expression: '=BESSELJ(1.9,2)', expected: 0.3299837532, epsilon },
  { type: 'expect', expression: '=BESSELJ(0,0)', expected: 1 },
  { type: 'approximate', expression: '=BESSELJ(1,1)', expected: 0.4400505857, epsilon },
]);

AddTests('BESSELK', [
  { type: 'approximate', expression: '=BESSELK(1.5,1)', expected: 0.2773878005, epsilon },
  { type: 'approximate', expression: '=BESSELK(1,0)', expected: 0.4210244382, epsilon },
]);

AddTests('BESSELY', [
  { type: 'approximate', expression: '=BESSELY(2.5,1)', expected: 0.1459181380, epsilon },
  { type: 'approximate', expression: '=BESSELY(1,0)', expected: 0.0882569642, epsilon },
]);

AddTests('ERF', [
  { type: 'approximate', expression: '=ERF(1)', expected: 0.8427007929, epsilon },
  { type: 'approximate', expression: '=ERF(0)', expected: 0, epsilon },
  { type: 'approximate', expression: '=ERF(0.5)', expected: 0.5204998778, epsilon },
  { type: 'approximate', expression: '=ERF(0.745,1)', expected: 0.1347718289, epsilon },
]);

AddTests('ERF.PRECISE', [
  { type: 'approximate', expression: '=ERF.PRECISE(1)', expected: 0.8427007929, epsilon },
  { type: 'approximate', expression: '=ERF.PRECISE(0)', expected: 0, epsilon },
  { type: 'approximate', expression: '=ERF.PRECISE(0.5)', expected: 0.5204998778, epsilon },
]);

AddTests('ERFC', [
  { type: 'approximate', expression: '=ERFC(1)', expected: 0.1572992071, epsilon },
  { type: 'approximate', expression: '=ERFC(0)', expected: 1, epsilon },
  { type: 'approximate', expression: '=ERFC(0.5)', expected: 0.4795001222, epsilon },
]);

AddTests('ERFC.PRECISE', [
  { type: 'approximate', expression: '=ERFC.PRECISE(1)', expected: 0.1572992071, epsilon },
  { type: 'approximate', expression: '=ERFC.PRECISE(0)', expected: 1, epsilon },
  { type: 'approximate', expression: '=ERFC.PRECISE(0.5)', expected: 0.4795001222, epsilon },
]);
