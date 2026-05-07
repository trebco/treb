
import { AddTests } from '@util';

AddTests('SWITCH', [
  { type: 'expect', expression: '=SWITCH(1,1,"one",2,"two",3,"three")', expected: 'one' },
  { type: 'expect', expression: '=SWITCH(2,1,"one",2,"two",3,"three")', expected: 'two' },
  { type: 'expect', expression: '=SWITCH(99,1,"one",2,"two","default")', expected: 'default' },
  { type: 'expect', expression: '=SWITCH("b","a",1,"b",2,"c",3)', expected: 2 },
]);

AddTests('LET', [
  { type: 'expect', expression: '=LET(x,5,x*2)', expected: 10 },
  { type: 'expect', expression: '=LET(x,3,y,4,SQRT(x^2+y^2))', expected: 5 },
  { type: 'expect', expression: '=LET(name,"hello",UPPER(name))', expected: 'HELLO' },
  { type: 'expect', expression: '=LET(a,10,b,20,a+b)', expected: 30 },
]);
