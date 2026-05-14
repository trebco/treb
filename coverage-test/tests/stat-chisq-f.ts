
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('CHISQ.DIST', [
  { type: 'approximate', expression: '=CHISQ.DIST(2,5,TRUE)', expected: 0.1508549639, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST(10,5,TRUE)', expected: 0.9247647539, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST(2,5,FALSE)', expected: 0.1383691658, epsilon },
]);

AddTests('CHISQ.DIST.RT', [
  { type: 'approximate', expression: '=CHISQ.DIST.RT(2,5)', expected: 0.8491450361, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST.RT(10,5)', expected: 0.0752352461, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST.RT(3.84,1)', expected: 0.0500435212, epsilon },
]);

AddTests('CHISQ.INV', [
  { type: 'approximate', expression: '=CHISQ.INV(0.5,5)', expected: 4.3514601741, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CHISQ.INV(0.95,10)', expected: 18.307038054, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CHISQ.INV(0.05,1)', expected: 0.0039321400, epsilon: 1e-6 },
]);

AddTests('CHISQ.INV.RT', [
  { type: 'approximate', expression: '=CHISQ.INV.RT(0.05,5)', expected: 11.070497694, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CHISQ.INV.RT(0.5,5)', expected: 4.3514601741, epsilon: 1e-6 },
  { type: 'approximate', expression: '=CHISQ.INV.RT(0.95,1)', expected: 0.0039321400, epsilon: 1e-6 },
]);

AddTests('CHISQ.TEST', [
  { type: 'approximate', expression: '=CHISQ.TEST(A1:B2,C1:D2)', expected: 0.0002197627, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[58, 35], [11, 25]]);
  SetRange('C1', [[45.35, 47.65], [23.65, 24.85]]);
});

AddTests('F.DIST', [
  { type: 'approximate', expression: '=F.DIST(1,5,10,TRUE)', expected: 0.5348805735, epsilon },
  { type: 'approximate', expression: '=F.DIST(2,5,10,TRUE)', expected: 0.8358050491, epsilon },
  { type: 'approximate', expression: '=F.DIST(1,5,10,FALSE)', expected: 0.4954797835, epsilon },
]);

AddTests('F.DIST.RT', [
  { type: 'approximate', expression: '=F.DIST.RT(1,5,10)', expected: 0.4651194265, epsilon },
  { type: 'approximate', expression: '=F.DIST.RT(2,5,10)', expected: 0.1641949509, epsilon },
  { type: 'approximate', expression: '=F.DIST.RT(4,3,7)', expected: 0.0596308222, epsilon },
]);

AddTests('F.INV', [
  { type: 'approximate', expression: '=F.INV(0.5,5,10)', expected: 0.9319331609, epsilon: 1e-6 },
  { type: 'approximate', expression: '=F.INV(0.95,5,10)', expected: 3.3258345304, epsilon: 1e-6 },
]);
