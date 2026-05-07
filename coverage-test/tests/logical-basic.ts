
import { AddTests } from '@util';

AddTests('TRUE', [
  { type: 'expect', expression: '=TRUE()', expected: true },
]);

AddTests('FALSE', [
  { type: 'expect', expression: '=FALSE()', expected: false },
]);

AddTests('AND', [
  { type: 'expect', expression: '=AND(TRUE(),TRUE())', expected: true },
  { type: 'expect', expression: '=AND(TRUE(),FALSE())', expected: false },
  { type: 'expect', expression: '=AND(FALSE(),FALSE())', expected: false },
  { type: 'expect', expression: '=AND(1,1)', expected: true },
  { type: 'expect', expression: '=AND(1,0)', expected: false },
]);

AddTests('OR', [
  { type: 'expect', expression: '=OR(TRUE(),TRUE())', expected: true },
  { type: 'expect', expression: '=OR(TRUE(),FALSE())', expected: true },
  { type: 'expect', expression: '=OR(FALSE(),FALSE())', expected: false },
  { type: 'expect', expression: '=OR(1,0)', expected: true },
  { type: 'expect', expression: '=OR(0,0)', expected: false },
]);

AddTests('NOT', [
  { type: 'expect', expression: '=NOT(TRUE())', expected: false },
  { type: 'expect', expression: '=NOT(FALSE())', expected: true },
  { type: 'expect', expression: '=NOT(1)', expected: false },
  { type: 'expect', expression: '=NOT(0)', expected: true },
]);

AddTests('XOR', [
  { type: 'expect', expression: '=XOR(TRUE(),TRUE())', expected: false },
  { type: 'expect', expression: '=XOR(TRUE(),FALSE())', expected: true },
  { type: 'expect', expression: '=XOR(FALSE(),FALSE())', expected: false },
  { type: 'expect', expression: '=XOR(TRUE(),TRUE(),TRUE())', expected: true },
]);

AddTests('IF', [
  { type: 'expect', expression: '=IF(TRUE(),"yes","no")', expected: 'yes' },
  { type: 'expect', expression: '=IF(FALSE(),"yes","no")', expected: 'no' },
  { type: 'expect', expression: '=IF(1>0,10,20)', expected: 10 },
  { type: 'expect', expression: '=IF(1<0,10,20)', expected: 20 },
  { type: 'expect', expression: '=IF(TRUE(),"yes")', expected: 'yes' },
  { type: 'expect', expression: '=IF(FALSE(),"yes")', expected: false },
]);

AddTests('IFERROR', [
  { type: 'expect', expression: '=IFERROR(1,"error")', expected: 1 },
  { type: 'expect', expression: '=IFERROR(1/0,"error")', expected: 'error' },
  { type: 'expect', expression: '=IFERROR("hello","error")', expected: 'hello' },
]);

AddTests('IFNA', [
  { type: 'expect', expression: '=IFNA(1,"not found")', expected: 1 },
  { type: 'expect', expression: '=IFNA("hello","not found")', expected: 'hello' },
]);

AddTests('IFS', [
  { type: 'expect', expression: '=IFS(TRUE(),"first",TRUE(),"second")', expected: 'first' },
  { type: 'expect', expression: '=IFS(FALSE(),"first",TRUE(),"second")', expected: 'second' },
  { type: 'expect', expression: '=IFS(1>2,"a",2>1,"b")', expected: 'b' },
]);
