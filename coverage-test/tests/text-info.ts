
import { AddTests } from '@util';

AddTests('CHAR', [
  { type: 'expect', expression: '=CHAR(65)', expected: 'A' },
  { type: 'expect', expression: '=CHAR(97)', expected: 'a' },
  { type: 'expect', expression: '=CHAR(49)', expected: '1' },
  { type: 'expect', expression: '=CHAR(32)', expected: ' ' },
]);

AddTests('CODE', [
  { type: 'expect', expression: '=CODE("A")', expected: 65 },
  { type: 'expect', expression: '=CODE("a")', expected: 97 },
  { type: 'expect', expression: '=CODE("1")', expected: 49 },
  { type: 'expect', expression: '=CODE(" ")', expected: 32 },
]);

AddTests('UNICHAR', [
  { type: 'expect', expression: '=UNICHAR(65)', expected: 'A' },
  { type: 'expect', expression: '=UNICHAR(8364)', expected: '€' },
  { type: 'expect', expression: '=UNICHAR(49)', expected: '1' },
  { type: 'expect', expression: '=UNICHAR(169)', expected: '©' },
]);

AddTests('UNICODE', [
  { type: 'expect', expression: '=UNICODE("A")', expected: 65 },
  { type: 'expect', expression: '=UNICODE("€")', expected: 8364 },
  { type: 'expect', expression: '=UNICODE("1")', expected: 49 },
  { type: 'expect', expression: '=UNICODE("©")', expected: 169 },
]);

AddTests('EXACT', [
  { type: 'expect', expression: '=EXACT("word","word")', expected: true },
  { type: 'expect', expression: '=EXACT("Word","word")', expected: false },
  { type: 'expect', expression: '=EXACT("hello","hello")', expected: true },
  { type: 'expect', expression: '=EXACT("","")', expected: true },
]);

AddTests('CLEAN', [
  { type: 'expect', expression: '=CLEAN("hello")', expected: 'hello' },
  { type: 'expect', expression: '=CLEAN(CHAR(9)&"text")', expected: 'text' },
  { type: 'expect', expression: '=CLEAN(CHAR(10)&"line")', expected: 'line' },
  { type: 'expect', expression: '=CLEAN("")', expected: '' },
]);

AddTests('T', [
  { type: 'expect', expression: '=T("hello")', expected: 'hello' },
  { type: 'expect', expression: '=T("")', expected: '' },
  { type: 'expect', expression: '=T("test 123")', expected: 'test 123' },
]);

AddTests('T', [
  { type: 'expect', expression: '=T(A1)', expected: '' },
], SetRange => {
  SetRange('A1', 123);
});
