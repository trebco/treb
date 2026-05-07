
import { AddTests } from '@util';

AddTests('BITAND', [
  { type: 'expect', expression: '=BITAND(1,5)', expected: 1 },
  { type: 'expect', expression: '=BITAND(13,25)', expected: 9 },
  { type: 'expect', expression: '=BITAND(0,255)', expected: 0 },
  { type: 'expect', expression: '=BITAND(255,255)', expected: 255 },
]);

AddTests('BITOR', [
  { type: 'expect', expression: '=BITOR(23,10)', expected: 31 },
  { type: 'expect', expression: '=BITOR(1,5)', expected: 5 },
  { type: 'expect', expression: '=BITOR(0,0)', expected: 0 },
  { type: 'expect', expression: '=BITOR(12,8)', expected: 12 },
]);

AddTests('BITXOR', [
  { type: 'expect', expression: '=BITXOR(5,3)', expected: 6 },
  { type: 'expect', expression: '=BITXOR(0,0)', expected: 0 },
  { type: 'expect', expression: '=BITXOR(255,255)', expected: 0 },
  { type: 'expect', expression: '=BITXOR(13,25)', expected: 20 },
]);

AddTests('BITLSHIFT', [
  { type: 'expect', expression: '=BITLSHIFT(4,2)', expected: 16 },
  { type: 'expect', expression: '=BITLSHIFT(1,3)', expected: 8 },
  { type: 'expect', expression: '=BITLSHIFT(0,5)', expected: 0 },
  { type: 'expect', expression: '=BITLSHIFT(13,2)', expected: 52 },
]);

AddTests('BITRSHIFT', [
  { type: 'expect', expression: '=BITRSHIFT(13,2)', expected: 3 },
  { type: 'expect', expression: '=BITRSHIFT(8,3)', expected: 1 },
  { type: 'expect', expression: '=BITRSHIFT(0,5)', expected: 0 },
  { type: 'expect', expression: '=BITRSHIFT(255,4)', expected: 15 },
]);

AddTests('DELTA', [
  { type: 'expect', expression: '=DELTA(5,5)', expected: 1 },
  { type: 'expect', expression: '=DELTA(5,4)', expected: 0 },
  { type: 'expect', expression: '=DELTA(0,0)', expected: 1 },
  { type: 'expect', expression: '=DELTA(0)', expected: 1 },
]);

AddTests('GESTEP', [
  { type: 'expect', expression: '=GESTEP(5,4)', expected: 1 },
  { type: 'expect', expression: '=GESTEP(5,5)', expected: 1 },
  { type: 'expect', expression: '=GESTEP(4,5)', expected: 0 },
  { type: 'expect', expression: '=GESTEP(-4,-5)', expected: 1 },
]);
