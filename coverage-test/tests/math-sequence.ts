
import { AddTests } from '@util';

AddTests('SEQUENCE', [
  { type: 'expect', expression: '=SEQUENCE(4)', expected: [[1], [2], [3], [4]] },
  { type: 'expect', expression: '=SEQUENCE(2,3)', expected: [[1, 2, 3], [4, 5, 6]] },
  { type: 'expect', expression: '=SEQUENCE(3,1,0,5)', expected: [[0], [5], [10]] },
  { type: 'expect', expression: '=SEQUENCE(1,4,10,-1)', expected: [[10, 9, 8, 7]] },
]);
