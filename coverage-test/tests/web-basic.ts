
import { AddTests } from '@util';

AddTests('ENCODEURL', [
  { type: 'expect', expression: '=ENCODEURL("hello world")', expected: 'hello%20world' },
  { type: 'expect', expression: '=ENCODEURL("test@email.com")', expected: 'test%40email.com' },
  { type: 'expect', expression: '=ENCODEURL("a+b=c")', expected: 'a%2Bb%3Dc' },
  { type: 'expect', expression: '=ENCODEURL("simple")', expected: 'simple' },
]);
