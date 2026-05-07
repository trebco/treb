
import { AddTests } from '@util';

AddTests('ARRAYTOTEXT', [
  { type: 'expect', expression: '=ARRAYTOTEXT(A1:B2)', expected: '1, 2, 3, 4' },
], SetRange => {
  SetRange('A1', [[1, 2], [3, 4]]);
});

AddTests('ARRAYTOTEXT', [
  { type: 'expect', expression: '=ARRAYTOTEXT(A1:A3,1)', expected: '{"hello";"world";"test"}' },
], SetRange => {
  SetRange('A1', [['hello'], ['world'], ['test']]);
});

AddTests('VALUETOTEXT', [
  { type: 'expect', expression: '=VALUETOTEXT(123)', expected: '123' },
  { type: 'expect', expression: '=VALUETOTEXT("hello")', expected: 'hello' },
  { type: 'expect', expression: '=VALUETOTEXT(TRUE)', expected: 'TRUE' },
  { type: 'expect', expression: '=VALUETOTEXT("hello",1)', expected: '"hello"' },
]);
