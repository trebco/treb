
import { AddTests } from '@util';

AddTests('CONCAT', [
  { type: 'expect', expression: '=CONCAT("Hello"," ","World")', expected: 'Hello World' },
  { type: 'expect', expression: '=CONCAT("A","B","C")', expected: 'ABC' },
  { type: 'expect', expression: '=CONCAT(1,2,3)', expected: '123' },
  { type: 'expect', expression: '=CONCAT("test")', expected: 'test' },
]);

AddTests('TEXTJOIN', [
  { type: 'expect', expression: '=TEXTJOIN(", ",TRUE,"Sun","Mon","Tue")', expected: 'Sun, Mon, Tue' },
  { type: 'expect', expression: '=TEXTJOIN("-",TRUE,"2024","01","15")', expected: '2024-01-15' },
  { type: 'expect', expression: '=TEXTJOIN(" ",TRUE,"a","","b")', expected: 'a b' },
  { type: 'expect', expression: '=TEXTJOIN(" ",FALSE,"a","","b")', expected: 'a  b' },
]);

AddTests('TEXTJOIN', [
  { type: 'expect', expression: '=TEXTJOIN(", ",TRUE,A1:A4)', expected: 'Alice, Bob, Charlie, Diana' },
], SetRange => {
  SetRange('A1', [['Alice'], ['Bob'], ['Charlie'], ['Diana']]);
});

AddTests('REPT', [
  { type: 'expect', expression: '=REPT("*",5)', expected: '*****' },
  { type: 'expect', expression: '=REPT("ab",3)', expected: 'ababab' },
  { type: 'expect', expression: '=REPT("x",0)', expected: '' },
  { type: 'expect', expression: '=REPT("ha",2)', expected: 'haha' },
]);
