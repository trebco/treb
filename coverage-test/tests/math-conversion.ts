
import { AddTests } from '@util';

AddTests('ARABIC', [
  { type: 'expect', expression: '=ARABIC("MCMXCIX")', expected: 1999 },
  { type: 'expect', expression: '=ARABIC("XIV")', expected: 14 },
  { type: 'expect', expression: '=ARABIC("I")', expected: 1 },
  { type: 'expect', expression: '=ARABIC("CDXLIV")', expected: 444 },
]);

AddTests('ROMAN', [
  { type: 'expect', expression: '=ROMAN(499)', expected: 'CDXCIX' },
  { type: 'expect', expression: '=ROMAN(1999)', expected: 'MCMXCIX' },
  { type: 'expect', expression: '=ROMAN(1)', expected: 'I' },
  { type: 'expect', expression: '=ROMAN(14)', expected: 'XIV' },
]);

AddTests('BASE', [
  { type: 'expect', expression: '=BASE(10,2)', expected: '1010' },
  { type: 'expect', expression: '=BASE(255,16)', expected: 'FF' },
  { type: 'expect', expression: '=BASE(15,8)', expected: '17' },
  { type: 'expect', expression: '=BASE(10,2,8)', expected: '00001010' },
]);

AddTests('DECIMAL', [
  { type: 'expect', expression: '=DECIMAL("1010",2)', expected: 10 },
  { type: 'expect', expression: '=DECIMAL("FF",16)', expected: 255 },
  { type: 'expect', expression: '=DECIMAL("17",8)', expected: 15 },
  { type: 'expect', expression: '=DECIMAL("111",2)', expected: 7 },
]);
