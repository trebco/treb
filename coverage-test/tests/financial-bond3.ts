
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('ACCRINT', [
  { type: 'approximate', expression: '=ACCRINT(DATE(2008,3,1),DATE(2008,9,1),DATE(2008,5,1),0.1,1000,2,0)', expected: 16.666667, epsilon: 0.01 },
  { type: 'approximate', expression: '=ACCRINT(DATE(2020,1,1),DATE(2020,7,1),DATE(2020,4,1),0.08,100,2,0)', expected: 2, epsilon: 0.01 },
]);

AddTests('ACCRINTM', [
  { type: 'approximate', expression: '=ACCRINTM(DATE(2008,4,1),DATE(2008,6,15),0.1,1000,3)', expected: 20.547945, epsilon: 0.01 },
  { type: 'approximate', expression: '=ACCRINTM(DATE(2020,1,1),DATE(2020,7,1),0.05,100,0)', expected: 2.527778, epsilon: 0.01 },
]);

AddTests('AMORDEGRC', [
  { type: 'approximate', expression: '=AMORDEGRC(2400,DATE(2008,8,19),DATE(2008,12,31),300,1,0.15,1)', expected: 776, epsilon: 1 },
]);

AddTests('AMORLINC', [
  { type: 'approximate', expression: '=AMORLINC(2400,DATE(2008,8,19),DATE(2008,12,31),300,1,0.15,1)', expected: 360, epsilon: 0.1 },
]);
