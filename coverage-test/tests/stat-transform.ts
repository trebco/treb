
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('FISHER', [
  { type: 'approximate', expression: '=FISHER(0.75)', expected: 0.9729550745, epsilon },
  { type: 'expect', expression: '=FISHER(0)', expected: 0 },
  { type: 'approximate', expression: '=FISHER(0.5)', expected: 0.5493061443, epsilon },
  { type: 'approximate', expression: '=FISHER(-0.5)', expected: -0.5493061443, epsilon },
]);

AddTests('FISHERINV', [
  { type: 'approximate', expression: '=FISHERINV(0.9729550745)', expected: 0.75, epsilon },
  { type: 'expect', expression: '=FISHERINV(0)', expected: 0 },
  { type: 'approximate', expression: '=FISHERINV(0.5493061443)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=FISHERINV(-0.5493061443)', expected: -0.5, epsilon },
]);

AddTests('PERMUT', [
  { type: 'expect', expression: '=PERMUT(100,3)', expected: 970200 },
  { type: 'expect', expression: '=PERMUT(5,2)', expected: 20 },
  { type: 'expect', expression: '=PERMUT(5,5)', expected: 120 },
  { type: 'expect', expression: '=PERMUT(10,0)', expected: 1 },
]);

AddTests('PERMUTATIONA', [
  { type: 'expect', expression: '=PERMUTATIONA(3,2)', expected: 9 },
  { type: 'expect', expression: '=PERMUTATIONA(4,3)', expected: 64 },
  { type: 'expect', expression: '=PERMUTATIONA(2,2)', expected: 4 },
  { type: 'expect', expression: '=PERMUTATIONA(5,0)', expected: 1 },
]);
