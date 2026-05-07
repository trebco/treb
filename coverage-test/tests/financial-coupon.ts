
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('COUPDAYBS', [
  { type: 'expect', expression: '=COUPDAYBS(DATE(2008,11,11),DATE(2012,3,1),4,1)', expected: 71 },
  { type: 'expect', expression: '=COUPDAYBS(DATE(2020,2,1),DATE(2025,6,1),2,0)', expected: 60 },
]);

AddTests('COUPDAYS', [
  { type: 'expect', expression: '=COUPDAYS(DATE(2008,11,11),DATE(2012,3,1),4,1)', expected: 91 },
  { type: 'expect', expression: '=COUPDAYS(DATE(2020,2,1),DATE(2025,6,1),2,0)', expected: 180 },
]);

AddTests('COUPDAYSNC', [
  { type: 'expect', expression: '=COUPDAYSNC(DATE(2008,11,11),DATE(2012,3,1),4,1)', expected: 20 },
  { type: 'expect', expression: '=COUPDAYSNC(DATE(2020,2,1),DATE(2025,6,1),2,0)', expected: 120 },
]);

AddTests('COUPNCD', [
  { type: 'expect', expression: '=COUPNCD(DATE(2008,11,11),DATE(2012,3,1),4,1)', expected: 39783 },
]);

AddTests('COUPNUM', [
  { type: 'expect', expression: '=COUPNUM(DATE(2008,11,11),DATE(2012,3,1),4,1)', expected: 14 },
  { type: 'expect', expression: '=COUPNUM(DATE(2020,1,1),DATE(2025,1,1),2,0)', expected: 10 },
]);

AddTests('COUPPCD', [
  { type: 'expect', expression: '=COUPPCD(DATE(2008,11,11),DATE(2012,3,1),4,1)', expected: 39692 },
]);
