
import { AddTests } from '@util';

AddTests('IMSUM', [
  { type: 'expect', expression: '=IMSUM("3+4i","5+3i")', expected: '8+7i' },
  { type: 'expect', expression: '=IMSUM("1+2i","-1-2i")', expected: '0' },
  { type: 'expect', expression: '=IMSUM("1","i")', expected: '1+i' },
]);

AddTests('IMSUB', [
  { type: 'expect', expression: '=IMSUB("13+4i","5+3i")', expected: '8+i' },
  { type: 'expect', expression: '=IMSUB("3+4i","3+4i")', expected: '0' },
  { type: 'expect', expression: '=IMSUB("5+2i","3")', expected: '2+2i' },
]);

AddTests('IMDIV', [
  { type: 'expect', expression: '=IMDIV("-238+240i","10+24i")', expected: '5+12i' },
  { type: 'expect', expression: '=IMDIV("1","i")', expected: '-i' },
  { type: 'expect', expression: '=IMDIV("4+2i","2")', expected: '2+i' },
]);

AddTests('IMPRODUCT', [
  { type: 'expect', expression: '=IMPRODUCT("3+4i","5-3i")', expected: '27+11i' },
  { type: 'expect', expression: '=IMPRODUCT("1+i","1-i")', expected: '2' },
  { type: 'expect', expression: '=IMPRODUCT("i","i")', expected: '-1' },
]);

AddTests('IMPOWER', [
  { type: 'expect', expression: '=IMPOWER("2+3i",2)', expected: '-5+12i' },
  { type: 'expect', expression: '=IMPOWER("i",2)', expected: '-1' },
  { type: 'expect', expression: '=IMPOWER("2",3)', expected: '8' },
]);

AddTests('IMSQRT', [
  { type: 'expect', expression: '=IMSQRT("1+0i")', expected: '1' },
  { type: 'expect', expression: '=IMSQRT("-1")', expected: 'i' },
  { type: 'expect', expression: '=IMSQRT("4")', expected: '2' },
]);
