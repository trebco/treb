
import { AddTests } from '@util';

// VLOOKUP table (A1:C5):
//   ID  | Name    | Score
//   1   | Alice   | 90
//   2   | Bob     | 85
//   3   | Charlie | 92
//   4   | Diana   | 88
//   5   | Eve     | 95

const tableData = [
  [1, 'Alice', 90],
  [2, 'Bob', 85],
  [3, 'Charlie', 92],
  [4, 'Diana', 88],
  [5, 'Eve', 95],
];

AddTests('VLOOKUP', [
  { type: 'expect', expression: '=VLOOKUP(1,A1:C5,2,FALSE)', expected: 'Alice' },
  { type: 'expect', expression: '=VLOOKUP(3,A1:C5,3,FALSE)', expected: 92 },
  { type: 'expect', expression: '=VLOOKUP(5,A1:C5,2,FALSE)', expected: 'Eve' },
  { type: 'expect', expression: '=VLOOKUP(4,A1:C5,3,FALSE)', expected: 88 },
], SetRange => {
  SetRange('A1', tableData);
});

// HLOOKUP table (A1:E3) — transposed layout

AddTests('HLOOKUP', [
  { type: 'expect', expression: '=HLOOKUP(1,A1:E3,2,FALSE)', expected: 'Alice' },
  { type: 'expect', expression: '=HLOOKUP(3,A1:E3,3,FALSE)', expected: 92 },
  { type: 'expect', expression: '=HLOOKUP(5,A1:E3,2,FALSE)', expected: 'Eve' },
  { type: 'expect', expression: '=HLOOKUP(4,A1:E3,3,FALSE)', expected: 88 },
], SetRange => {
  SetRange('A1', [
    [1, 2, 3, 4, 5],
    ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    [90, 85, 92, 88, 95],
  ]);
});

// XLOOKUP uses the same vertical table

AddTests('XLOOKUP', [
  { type: 'expect', expression: '=XLOOKUP(1,A1:A5,B1:B5)', expected: 'Alice' },
  { type: 'expect', expression: '=XLOOKUP(3,A1:A5,C1:C5)', expected: 92 },
  { type: 'expect', expression: '=XLOOKUP(5,A1:A5,B1:B5)', expected: 'Eve' },
  { type: 'expect', expression: '=XLOOKUP(99,A1:A5,B1:B5,"not found")', expected: 'not found' },
], SetRange => {
  SetRange('A1', tableData);
});
