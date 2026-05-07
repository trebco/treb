

import { AddTests, type EvaluateResultType } from './src/util';

// now we can test functions. for the time being we're only
// testing literal parameters (meaning we're not referencing
// any spreadsheet cells). we'll do references later.

AddTests('SUM', [

  // simple test
  { type: 'expect', expression: '=SUM(1,2,3)', expected: 6 },

  // literal arrays
  { type: 'expect', expression: '=SUM({1;2;3}, {4,5,6})', expected: 21 },

]);

AddTests('SUM', [

  { type: 'expect', expression: '=SUM(A1:A2)', expected: 300 },

], SetRange => {
  SetRange('A1', 100);
  SetRange('A2', 200);
});

AddTests('RAND', [

  // test bounds, return type
  {
    type: 'custom', expression: '=RAND()', count: 1000, validate: (results: EvaluateResultType[]) => {
      for (const element of results) {
        if (typeof element !== 'number' || element <= 0 || element >= 1) {
          return false;
        }
      }
      return true;
    }
  }

]);





