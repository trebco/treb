
import { AddTests } from '@util';

AddTests('COMBIN', [
  { type: 'expect', expression: '=COMBIN(8,2)', expected: 28 },
  { type: 'expect', expression: '=COMBIN(5,0)', expected: 1 },
  { type: 'expect', expression: '=COMBIN(5,5)', expected: 1 },
  { type: 'expect', expression: '=COMBIN(10,3)', expected: 120 },
]);

AddTests('COMBINA', [
  { type: 'expect', expression: '=COMBINA(4,3)', expected: 20 },
  { type: 'expect', expression: '=COMBINA(10,2)', expected: 55 },
  { type: 'expect', expression: '=COMBINA(5,0)', expected: 1 },
  { type: 'expect', expression: '=COMBINA(1,1)', expected: 1 },
]);

AddTests('FACT', [
  { type: 'expect', expression: '=FACT(5)', expected: 120 },
  { type: 'expect', expression: '=FACT(0)', expected: 1 },
  { type: 'expect', expression: '=FACT(1)', expected: 1 },
  { type: 'expect', expression: '=FACT(10)', expected: 3628800 },
]);

AddTests('FACTDOUBLE', [
  { type: 'expect', expression: '=FACTDOUBLE(7)', expected: 105 },
  { type: 'expect', expression: '=FACTDOUBLE(6)', expected: 48 },
  { type: 'expect', expression: '=FACTDOUBLE(0)', expected: 1 },
  { type: 'expect', expression: '=FACTDOUBLE(1)', expected: 1 },
]);

AddTests('MULTINOMIAL', [
  { type: 'expect', expression: '=MULTINOMIAL(2,3,4)', expected: 1260 },
  { type: 'expect', expression: '=MULTINOMIAL(1,1,1)', expected: 6 },
  { type: 'expect', expression: '=MULTINOMIAL(3,3)', expected: 20 },
  { type: 'expect', expression: '=MULTINOMIAL(5)', expected: 1 },
]);

AddTests('EVEN', [
  { type: 'expect', expression: '=EVEN(1.5)', expected: 2 },
  { type: 'expect', expression: '=EVEN(3)', expected: 4 },
  { type: 'expect', expression: '=EVEN(2)', expected: 2 },
  { type: 'expect', expression: '=EVEN(-1)', expected: -2 },
]);

AddTests('ODD', [
  { type: 'expect', expression: '=ODD(1.5)', expected: 3 },
  { type: 'expect', expression: '=ODD(3)', expected: 3 },
  { type: 'expect', expression: '=ODD(2)', expected: 3 },
  { type: 'expect', expression: '=ODD(-1)', expected: -1 },
]);
