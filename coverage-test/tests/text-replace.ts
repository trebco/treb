
import { AddTests } from '@util';

AddTests('REPLACE', [
  { type: 'expect', expression: '=REPLACE("abcdefghijk",6,5,"*")', expected: 'abcde*k' },
  { type: 'expect', expression: '=REPLACE("2009",3,2,"10")', expected: '2010' },
  { type: 'expect', expression: '=REPLACE("123456",1,3,"A")', expected: 'A456' },
  { type: 'expect', expression: '=REPLACE("hello",6,0," world")', expected: 'hello world' },
]);

AddTests('REPLACEB', [
  { type: 'expect', expression: '=REPLACEB("abcdefghijk",6,5,"*")', expected: 'abcde*k' },
  { type: 'expect', expression: '=REPLACEB("2009",3,2,"10")', expected: '2010' },
  { type: 'expect', expression: '=REPLACEB("123456",1,3,"A")', expected: 'A456' },
  { type: 'expect', expression: '=REPLACEB("hello",6,0," world")', expected: 'hello world' },
]);

AddTests('SUBSTITUTE', [
  { type: 'expect', expression: '=SUBSTITUTE("Sales Data","Sales","Cost")', expected: 'Cost Data' },
  { type: 'expect', expression: '=SUBSTITUTE("Quarter 1, 2024","1","2",1)', expected: 'Quarter 2, 2024' },
  { type: 'expect', expression: '=SUBSTITUTE("aaa","a","b")', expected: 'bbb' },
  { type: 'expect', expression: '=SUBSTITUTE("aaa","a","b",2)', expected: 'aba' },
]);
