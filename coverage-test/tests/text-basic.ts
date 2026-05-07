
import { AddTests } from '@util';

AddTests('UPPER', [
  { type: 'expect', expression: '=UPPER("hello")', expected: 'HELLO' },
  { type: 'expect', expression: '=UPPER("Hello World")', expected: 'HELLO WORLD' },
  { type: 'expect', expression: '=UPPER("ABC")', expected: 'ABC' },
  { type: 'expect', expression: '=UPPER("")', expected: '' },
]);

AddTests('LOWER', [
  { type: 'expect', expression: '=LOWER("HELLO")', expected: 'hello' },
  { type: 'expect', expression: '=LOWER("Hello World")', expected: 'hello world' },
  { type: 'expect', expression: '=LOWER("abc")', expected: 'abc' },
  { type: 'expect', expression: '=LOWER("")', expected: '' },
]);

AddTests('PROPER', [
  { type: 'expect', expression: '=PROPER("hello world")', expected: 'Hello World' },
  { type: 'expect', expression: '=PROPER("HELLO WORLD")', expected: 'Hello World' },
  { type: 'expect', expression: '=PROPER("hello-world")', expected: 'Hello-World' },
  { type: 'expect', expression: '=PROPER("")', expected: '' },
]);

AddTests('LEN', [
  { type: 'expect', expression: '=LEN("hello")', expected: 5 },
  { type: 'expect', expression: '=LEN("")', expected: 0 },
  { type: 'expect', expression: '=LEN(" ")', expected: 1 },
  { type: 'expect', expression: '=LEN("hello world")', expected: 11 },
]);

AddTests('TRIM', [
  { type: 'expect', expression: '=TRIM("  hello  ")', expected: 'hello' },
  { type: 'expect', expression: '=TRIM("hello  world")', expected: 'hello world' },
  { type: 'expect', expression: '=TRIM("  hello  world  ")', expected: 'hello world' },
  { type: 'expect', expression: '=TRIM("")', expected: '' },
]);

AddTests('LEFT', [
  { type: 'expect', expression: '=LEFT("hello",3)', expected: 'hel' },
  { type: 'expect', expression: '=LEFT("hello",1)', expected: 'h' },
  { type: 'expect', expression: '=LEFT("hello")', expected: 'h' },
  { type: 'expect', expression: '=LEFT("hello",10)', expected: 'hello' },
]);

AddTests('RIGHT', [
  { type: 'expect', expression: '=RIGHT("hello",3)', expected: 'llo' },
  { type: 'expect', expression: '=RIGHT("hello",1)', expected: 'o' },
  { type: 'expect', expression: '=RIGHT("hello")', expected: 'o' },
  { type: 'expect', expression: '=RIGHT("hello",10)', expected: 'hello' },
]);

AddTests('MID', [
  { type: 'expect', expression: '=MID("hello",2,3)', expected: 'ell' },
  { type: 'expect', expression: '=MID("hello",1,5)', expected: 'hello' },
  { type: 'expect', expression: '=MID("hello",3,10)', expected: 'llo' },
  { type: 'expect', expression: '=MID("hello",1,1)', expected: 'h' },
]);
