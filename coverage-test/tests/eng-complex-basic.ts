
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('COMPLEX', [
  { type: 'expect', expression: '=COMPLEX(3,4)', expected: '3+4i' },
  { type: 'expect', expression: '=COMPLEX(3,-4)', expected: '3-4i' },
  { type: 'expect', expression: '=COMPLEX(0,1)', expected: 'i' },
  { type: 'expect', expression: '=COMPLEX(1,0)', expected: '1' },
]);

AddTests('IMREAL', [
  { type: 'expect', expression: '=IMREAL("3+4i")', expected: 3 },
  { type: 'expect', expression: '=IMREAL("5-2i")', expected: 5 },
  { type: 'expect', expression: '=IMREAL("i")', expected: 0 },
  { type: 'expect', expression: '=IMREAL("6")', expected: 6 },
]);

AddTests('IMAGINARY', [
  { type: 'expect', expression: '=IMAGINARY("3+4i")', expected: 4 },
  { type: 'expect', expression: '=IMAGINARY("5-2i")', expected: -2 },
  { type: 'expect', expression: '=IMAGINARY("i")', expected: 1 },
  { type: 'expect', expression: '=IMAGINARY("6")', expected: 0 },
]);

AddTests('IMABS', [
  { type: 'expect', expression: '=IMABS("3+4i")', expected: 5 },
  { type: 'expect', expression: '=IMABS("5+12i")', expected: 13 },
  { type: 'expect', expression: '=IMABS("1")', expected: 1 },
  { type: 'expect', expression: '=IMABS("i")', expected: 1 },
]);

AddTests('IMARGUMENT', [
  { type: 'approximate', expression: '=IMARGUMENT("3+4i")', expected: 0.9272952180, epsilon },
  { type: 'approximate', expression: '=IMARGUMENT("i")', expected: 1.5707963268, epsilon },
  { type: 'approximate', expression: '=IMARGUMENT("-1")', expected: 3.1415926536, epsilon },
  { type: 'expect', expression: '=IMARGUMENT("1")', expected: 0 },
]);

AddTests('IMCONJUGATE', [
  { type: 'expect', expression: '=IMCONJUGATE("3+4i")', expected: '3-4i' },
  { type: 'expect', expression: '=IMCONJUGATE("3-4i")', expected: '3+4i' },
  { type: 'expect', expression: '=IMCONJUGATE("i")', expected: '-i' },
  { type: 'expect', expression: '=IMCONJUGATE("5")', expected: '5' },
]);
