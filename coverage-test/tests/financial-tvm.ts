
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('PV', [
  { type: 'approximate', expression: '=PV(0.08/12,20*12,-500)', expected: 59777.1458, epsilon: 0.01 },
  { type: 'approximate', expression: '=PV(0.1,5,0,-10000)', expected: 6209.2132, epsilon: 0.01 },
  { type: 'approximate', expression: '=PV(0,10,-100)', expected: 1000, epsilon },
]);

AddTests('FV', [
  { type: 'approximate', expression: '=FV(0.06/12,10,-200,-500,1)', expected: 2581.403230, epsilon: 0.01 },
  { type: 'approximate', expression: '=FV(0.1,5,-100)', expected: 610.510000, epsilon: 0.01 },
  { type: 'approximate', expression: '=FV(0,10,-100)', expected: 1000, epsilon },
]);

AddTests('PMT', [
  { type: 'approximate', expression: '=PMT(0.08/12,10,-10000)', expected: 1037.032089, epsilon: 0.01 },
  { type: 'approximate', expression: '=PMT(0.06/12,360,-200000)', expected: 1199.101050, epsilon: 0.01 },
  { type: 'approximate', expression: '=PMT(0,10,-1000)', expected: 100, epsilon },
]);

AddTests('NPER', [
  { type: 'approximate', expression: '=NPER(0.12/12,-100,-1000,10000,0)', expected: 60, epsilon: 0.1 },
  { type: 'approximate', expression: '=NPER(0.1,-1000,0,10000)', expected: 7.2725, epsilon: 0.01 },
]);

AddTests('RATE', [
  { type: 'approximate', expression: '=RATE(48,-200,8000)', expected: 0.0077, epsilon: 0.001 },
  { type: 'approximate', expression: '=RATE(60,-1000,50000)', expected: 0.006185, epsilon: 0.001 },
]);

AddTests('FVSCHEDULE', [
  { type: 'approximate', expression: '=FVSCHEDULE(1,{0.09,0.11,0.1})', expected: 1.33089, epsilon: 0.001 },
  { type: 'expect', expression: '=FVSCHEDULE(100,{0,0,0})', expected: 100 },
  { type: 'approximate', expression: '=FVSCHEDULE(1000,{0.1})', expected: 1100, epsilon },
]);
