
import { AddTests } from '@util';

const epsilon = 1e-8;

AddTests('CHISQ.DIST', [
  { type: 'approximate', expression: '=CHISQ.DIST(2,5,TRUE)', expected: 0.1508549816, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST(10,5,TRUE)', expected: 0.9246527477, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST(2,5,FALSE)', expected: 0.1383691882, epsilon },
]);

AddTests('CHISQ.DIST.RT', [
  { type: 'approximate', expression: '=CHISQ.DIST.RT(2,5)', expected: 0.8491450184, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST.RT(10,5)', expected: 0.0753472523, epsilon },
  { type: 'approximate', expression: '=CHISQ.DIST.RT(3.84,1)', expected: 0.0500518189, epsilon },
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
  { type: 'approximate', expression: '=CHISQ.TEST(A1:B2,C1:D2)', expected: 0.0003093803, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[58, 35], [11, 25]]);
  SetRange('C1', [[45.35, 47.65], [23.65, 24.85]]);
});

AddTests('F.DIST', [
  { type: 'approximate', expression: '=F.DIST(1,5,10,TRUE)', expected: 0.5356529836, epsilon },
  { type: 'approximate', expression: '=F.DIST(2,5,10,TRUE)', expected: 0.8465028702, epsilon },
  { type: 'approximate', expression: '=F.DIST(1,5,10,FALSE)', expected: 0.4451191979, epsilon },
]);

AddTests('F.DIST.RT', [
  { type: 'approximate', expression: '=F.DIST.RT(1,5,10)', expected: 0.4643470164, epsilon },
  { type: 'approximate', expression: '=F.DIST.RT(2,5,10)', expected: 0.1534971298, epsilon },
  { type: 'approximate', expression: '=F.DIST.RT(4,3,7)', expected: 0.0589782978, epsilon },
]);

AddTests('F.INV', [
  { type: 'approximate', expression: '=F.INV(0.5,5,10)', expected: 0.9276244622, epsilon: 1e-6 },
  { type: 'approximate', expression: '=F.INV(0.95,5,10)', expected: 3.3258342367, epsilon: 1e-6 },
]);
