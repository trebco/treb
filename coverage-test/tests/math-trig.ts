
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('PI', [
  { type: 'approximate', expression: '=PI()', expected: Math.PI, epsilon },
]);

AddTests('SIN', [
  { type: 'expect', expression: '=SIN(0)', expected: 0 },
  { type: 'expect', expression: '=SIN(PI()/2)', expected: 1 },
  { type: 'approximate', expression: '=SIN(PI())', expected: 0, epsilon },
  { type: 'expect', expression: '=SIN(-PI()/2)', expected: -1 },
]);

AddTests('COS', [
  { type: 'expect', expression: '=COS(0)', expected: 1 },
  { type: 'approximate', expression: '=COS(PI()/2)', expected: 0, epsilon },
  { type: 'expect', expression: '=COS(PI())', expected: -1 },
  { type: 'expect', expression: '=COS(-PI())', expected: -1 },
]);

AddTests('TAN', [
  { type: 'expect', expression: '=TAN(0)', expected: 0 },
  { type: 'approximate', expression: '=TAN(PI()/4)', expected: 1, epsilon },
  { type: 'approximate', expression: '=TAN(-PI()/4)', expected: -1, epsilon },
]);

AddTests('ASIN', [
  { type: 'expect', expression: '=ASIN(0)', expected: 0 },
  { type: 'approximate', expression: '=ASIN(1)', expected: Math.PI / 2, epsilon },
  { type: 'approximate', expression: '=ASIN(-1)', expected: -Math.PI / 2, epsilon },
]);

AddTests('ACOS', [
  { type: 'expect', expression: '=ACOS(1)', expected: 0 },
  { type: 'approximate', expression: '=ACOS(0)', expected: Math.PI / 2, epsilon },
  { type: 'approximate', expression: '=ACOS(-1)', expected: Math.PI, epsilon },
]);

AddTests('ATAN', [
  { type: 'expect', expression: '=ATAN(0)', expected: 0 },
  { type: 'approximate', expression: '=ATAN(1)', expected: Math.PI / 4, epsilon },
  { type: 'approximate', expression: '=ATAN(-1)', expected: -Math.PI / 4, epsilon },
]);

AddTests('ATAN2', [
  { type: 'approximate', expression: '=ATAN2(1,1)', expected: Math.PI / 4, epsilon },
  { type: 'expect', expression: '=ATAN2(1,0)', expected: 0 },
  { type: 'approximate', expression: '=ATAN2(0,1)', expected: Math.PI / 2, epsilon },
  { type: 'approximate', expression: '=ATAN2(-1,-1)', expected: -3 * Math.PI / 4, epsilon },
]);

AddTests('DEGREES', [
  { type: 'expect', expression: '=DEGREES(PI())', expected: 180 },
  { type: 'expect', expression: '=DEGREES(0)', expected: 0 },
  { type: 'expect', expression: '=DEGREES(PI()/2)', expected: 90 },
]);

AddTests('RADIANS', [
  { type: 'approximate', expression: '=RADIANS(180)', expected: Math.PI, epsilon },
  { type: 'expect', expression: '=RADIANS(0)', expected: 0 },
  { type: 'approximate', expression: '=RADIANS(90)', expected: Math.PI / 2, epsilon },
]);
