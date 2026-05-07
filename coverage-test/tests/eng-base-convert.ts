
import { AddTests } from '@util';

AddTests('BIN2DEC', [
  { type: 'expect', expression: '=BIN2DEC("1100100")', expected: 100 },
  { type: 'expect', expression: '=BIN2DEC("1010")', expected: 10 },
  { type: 'expect', expression: '=BIN2DEC("0")', expected: 0 },
  { type: 'expect', expression: '=BIN2DEC("1111111111")', expected: -1 },
]);

AddTests('BIN2HEX', [
  { type: 'expect', expression: '=BIN2HEX("11111011")', expected: 'FB' },
  { type: 'expect', expression: '=BIN2HEX("1110")', expected: 'E' },
  { type: 'expect', expression: '=BIN2HEX("11101",4)', expected: '001D' },
  { type: 'expect', expression: '=BIN2HEX("0")', expected: '0' },
]);

AddTests('BIN2OCT', [
  { type: 'expect', expression: '=BIN2OCT("1001")', expected: '11' },
  { type: 'expect', expression: '=BIN2OCT("1100100")', expected: '144' },
  { type: 'expect', expression: '=BIN2OCT("0")', expected: '0' },
  { type: 'expect', expression: '=BIN2OCT("1100100",4)', expected: '0144' },
]);

AddTests('DEC2BIN', [
  { type: 'expect', expression: '=DEC2BIN(9)', expected: '1001' },
  { type: 'expect', expression: '=DEC2BIN(100)', expected: '1100100' },
  { type: 'expect', expression: '=DEC2BIN(0)', expected: '0' },
  { type: 'expect', expression: '=DEC2BIN(-1)', expected: '1111111111' },
]);

AddTests('DEC2HEX', [
  { type: 'expect', expression: '=DEC2HEX(100)', expected: '64' },
  { type: 'expect', expression: '=DEC2HEX(255)', expected: 'FF' },
  { type: 'expect', expression: '=DEC2HEX(0)', expected: '0' },
  { type: 'expect', expression: '=DEC2HEX(100,4)', expected: '0064' },
]);

AddTests('DEC2OCT', [
  { type: 'expect', expression: '=DEC2OCT(58)', expected: '72' },
  { type: 'expect', expression: '=DEC2OCT(100)', expected: '144' },
  { type: 'expect', expression: '=DEC2OCT(0)', expected: '0' },
  { type: 'expect', expression: '=DEC2OCT(58,4)', expected: '0072' },
]);

AddTests('HEX2BIN', [
  { type: 'expect', expression: '=HEX2BIN("F")', expected: '1111' },
  { type: 'expect', expression: '=HEX2BIN("A")', expected: '1010' },
  { type: 'expect', expression: '=HEX2BIN("0")', expected: '0' },
  { type: 'expect', expression: '=HEX2BIN("F",8)', expected: '00001111' },
]);

AddTests('HEX2DEC', [
  { type: 'expect', expression: '=HEX2DEC("FF")', expected: 255 },
  { type: 'expect', expression: '=HEX2DEC("A5")', expected: 165 },
  { type: 'expect', expression: '=HEX2DEC("0")', expected: 0 },
  { type: 'expect', expression: '=HEX2DEC("FFFFFFFFFF")', expected: -1 },
]);
