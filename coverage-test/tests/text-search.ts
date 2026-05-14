
import { AddTests } from '@util';

AddTests('FIND', [
  { type: 'expect', expression: '=FIND("M","Miriam McGovern")', expected: 1 },
  { type: 'expect', expression: '=FIND("m","Miriam McGovern")', expected: 6 },
  { type: 'expect', expression: '=FIND("M","Miriam McGovern",3)', expected: 8 },
  { type: 'expect', expression: '=FIND("abc","abcdef")', expected: 1 },
]);

/*
AddTests('FINDB', [
  { type: 'expect', expression: '=FINDB("M","Miriam McGovern")', expected: 1 },
  { type: 'expect', expression: '=FINDB("m","Miriam McGovern")', expected: 6 },
  { type: 'expect', expression: '=FINDB("M","Miriam McGovern",3)', expected: 8 },
  { type: 'expect', expression: '=FINDB("abc","abcdef")', expected: 1 },
]);
*/

AddTests('SEARCH', [
  { type: 'expect', expression: '=SEARCH("e","Statements",6)', expected: 7 },
  { type: 'expect', expression: '=SEARCH("margin","Profit Margin")', expected: 8 },
  { type: 'expect', expression: '=SEARCH("?","what?")', expected: 5 },
  { type: 'expect', expression: '=SEARCH("M","Miriam McGovern")', expected: 1 },
]);

/*
AddTests('SEARCHB', [
  { type: 'expect', expression: '=SEARCHB("e","Statements",6)', expected: 7 },
  { type: 'expect', expression: '=SEARCHB("margin","Profit Margin")', expected: 8 },
  { type: 'expect', expression: '=SEARCHB("M","Miriam")', expected: 1 },
  { type: 'expect', expression: '=SEARCHB("a","abcabc",2)', expected: 4 },
]);
*/
