
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('HEX2OCT', [
  { type: 'expect', expression: '=HEX2OCT("F")', expected: '17' },
  { type: 'expect', expression: '=HEX2OCT("3B4E")', expected: '35516' },
  { type: 'expect', expression: '=HEX2OCT("0")', expected: '0' },
  { type: 'expect', expression: '=HEX2OCT("F",4)', expected: '0017' },
]);

AddTests('OCT2BIN', [
  { type: 'expect', expression: '=OCT2BIN("3")', expected: '11' },
  { type: 'expect', expression: '=OCT2BIN("7")', expected: '111' },
  { type: 'expect', expression: '=OCT2BIN("0")', expected: '0' },
  { type: 'expect', expression: '=OCT2BIN("3",8)', expected: '00000011' },
]);

AddTests('OCT2DEC', [
  { type: 'expect', expression: '=OCT2DEC("54")', expected: 44 },
  { type: 'expect', expression: '=OCT2DEC("144")', expected: 100 },
  { type: 'expect', expression: '=OCT2DEC("0")', expected: 0 },
  { type: 'expect', expression: '=OCT2DEC("7777777777")', expected: -1 },
]);

AddTests('OCT2HEX', [
  { type: 'expect', expression: '=OCT2HEX("100")', expected: '40' },
  { type: 'expect', expression: '=OCT2HEX("17")', expected: 'F' },
  { type: 'expect', expression: '=OCT2HEX("0")', expected: '0' },
  { type: 'expect', expression: '=OCT2HEX("100",4)', expected: '0040' },
]);

AddTests('CONVERT', [
  { type: 'approximate', expression: '=CONVERT(1,"lbm","kg")', expected: 0.453592, epsilon },
  { type: 'approximate', expression: '=CONVERT(68,"F","C")', expected: 20, epsilon },
  { type: 'expect', expression: '=CONVERT(1,"m","m")', expected: 1 },
  { type: 'approximate', expression: '=CONVERT(1,"mi","km")', expected: 1.609344, epsilon },
]);
