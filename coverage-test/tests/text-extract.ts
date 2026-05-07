
import { AddTests } from '@util';

AddTests('TEXTAFTER', [
  { type: 'expect', expression: '=TEXTAFTER("Red-Blue-Green","-")', expected: 'Blue-Green' },
  { type: 'expect', expression: '=TEXTAFTER("Red-Blue-Green","-",2)', expected: 'Green' },
  { type: 'expect', expression: '=TEXTAFTER("Red/Blue/Green","/")', expected: 'Blue/Green' },
  { type: 'expect', expression: '=TEXTAFTER("hello world"," ")', expected: 'world' },
]);

AddTests('TEXTBEFORE', [
  { type: 'expect', expression: '=TEXTBEFORE("Red-Blue-Green","-")', expected: 'Red' },
  { type: 'expect', expression: '=TEXTBEFORE("Red-Blue-Green","-",2)', expected: 'Red-Blue' },
  { type: 'expect', expression: '=TEXTBEFORE("Red/Blue/Green","/")', expected: 'Red' },
  { type: 'expect', expression: '=TEXTBEFORE("hello world"," ")', expected: 'hello' },
]);

AddTests('TEXTSPLIT', [
  { type: 'expect', expression: '=INDEX(TEXTSPLIT("Jan,Feb,Mar",","),1,1)', expected: 'Jan' },
  { type: 'expect', expression: '=INDEX(TEXTSPLIT("Jan,Feb,Mar",","),1,2)', expected: 'Feb' },
  { type: 'expect', expression: '=INDEX(TEXTSPLIT("Jan,Feb,Mar",","),1,3)', expected: 'Mar' },
  { type: 'expect', expression: '=INDEX(TEXTSPLIT("a.b.c","."),1,1)', expected: 'a' },
]);
