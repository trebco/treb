
import { AddTests } from '@util';

AddTests('REGEXEXTRACT', [
  { type: 'expect', expression: '=REGEXEXTRACT("apple123","[0-9]+")', expected: '123' },
  { type: 'expect', expression: '=REGEXEXTRACT("hello world","\\w+")', expected: 'hello' },
  { type: 'expect', expression: '=REGEXEXTRACT("test@email.com","@(.+)")', expected: 'email.com' },
  { type: 'expect', expression: '=REGEXEXTRACT("2024-01-15","\\d{4}")', expected: '2024' },
]);

AddTests('REGEXREPLACE', [
  { type: 'expect', expression: '=REGEXREPLACE("hello 123","[0-9]+","456")', expected: 'hello 456' },
  { type: 'expect', expression: '=REGEXREPLACE("aabbcc","b+","X")', expected: 'aaXcc' },
  { type: 'expect', expression: '=REGEXREPLACE("hello","^h","H")', expected: 'Hello' },
  { type: 'expect', expression: '=REGEXREPLACE("test",".*","replaced")', expected: 'replaced' },
]);

AddTests('REGEXTEST', [
  { type: 'expect', expression: '=REGEXTEST("hello123","[0-9]+")', expected: true },
  { type: 'expect', expression: '=REGEXTEST("hello","[0-9]+")', expected: false },
  { type: 'expect', expression: '=REGEXTEST("abc","^abc$")', expected: true },
  { type: 'expect', expression: '=REGEXTEST("test@email.com","@")', expected: true },
]);
