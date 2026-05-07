
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('PRICEDISC', [
  { type: 'approximate', expression: '=PRICEDISC(DATE(2008,2,16),DATE(2008,3,1),0.0525,100,2)', expected: 99.795833, epsilon: 0.01 },
]);

AddTests('YIELDDISC', [
  { type: 'approximate', expression: '=YIELDDISC(DATE(2008,2,16),DATE(2008,3,1),99.795,100,2)', expected: 0.053687, epsilon: 0.001 },
]);

AddTests('DISC', [
  { type: 'approximate', expression: '=DISC(DATE(2008,1,10),DATE(2008,6,11),97.975,100,2)', expected: 0.047949, epsilon: 0.001 },
]);

AddTests('RECEIVED', [
  { type: 'approximate', expression: '=RECEIVED(DATE(2008,2,15),DATE(2008,5,15),1000000,0.0575,2)', expected: 1014584.654, epsilon: 1 },
]);

AddTests('INTRATE', [
  { type: 'approximate', expression: '=INTRATE(DATE(2008,2,15),DATE(2008,5,15),1000000,1014420,2)', expected: 0.0576, epsilon: 0.001 },
]);
