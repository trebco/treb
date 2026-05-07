
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('EFFECT', [
  { type: 'approximate', expression: '=EFFECT(0.0525,4)', expected: 0.053543, epsilon: 0.001 },
  { type: 'approximate', expression: '=EFFECT(0.1,12)', expected: 0.104713, epsilon: 0.001 },
  { type: 'approximate', expression: '=EFFECT(0.1,1)', expected: 0.1, epsilon },
]);

AddTests('NOMINAL', [
  { type: 'approximate', expression: '=NOMINAL(0.053543,4)', expected: 0.0525, epsilon: 0.001 },
  { type: 'approximate', expression: '=NOMINAL(0.104713,12)', expected: 0.1, epsilon: 0.001 },
  { type: 'approximate', expression: '=NOMINAL(0.1,1)', expected: 0.1, epsilon },
]);

AddTests('DOLLARDE', [
  { type: 'approximate', expression: '=DOLLARDE(1.02,16)', expected: 1.125, epsilon },
  { type: 'approximate', expression: '=DOLLARDE(1.1,32)', expected: 1.3125, epsilon },
  { type: 'expect', expression: '=DOLLARDE(1.5,10)', expected: 1.5 },
]);

AddTests('DOLLARFR', [
  { type: 'approximate', expression: '=DOLLARFR(1.125,16)', expected: 1.02, epsilon },
  { type: 'approximate', expression: '=DOLLARFR(1.3125,32)', expected: 1.1, epsilon },
  { type: 'expect', expression: '=DOLLARFR(1.5,10)', expected: 1.5 },
]);

AddTests('PDURATION', [
  { type: 'approximate', expression: '=PDURATION(0.025,2000,2200)', expected: 3.859893, epsilon: 0.001 },
  { type: 'approximate', expression: '=PDURATION(0.1,1000,2000)', expected: 7.272541, epsilon: 0.001 },
]);

AddTests('RRI', [
  { type: 'approximate', expression: '=RRI(96,10000,11000)', expected: 0.001006, epsilon: 0.0001 },
  { type: 'approximate', expression: '=RRI(10,1000,2000)', expected: 0.071773, epsilon: 0.001 },
]);
