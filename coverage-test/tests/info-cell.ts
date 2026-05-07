
import { AddTests } from '@util';

AddTests('ERROR.TYPE', [
  { type: 'expect', expression: '=ERROR.TYPE(1/0)', expected: 2 },
  { type: 'expect', expression: '=ERROR.TYPE(NA())', expected: 7 },
]);

AddTests('CELL', [
  { type: 'expect', expression: '=CELL("col",A1)', expected: 1 },
  { type: 'expect', expression: '=CELL("col",C1)', expected: 3 },
  { type: 'expect', expression: '=CELL("row",A5)', expected: 5 },
]);

AddTests('INFO', [
  { type: 'expect', expression: '=ISTEXT(INFO("osversion"))', expected: true },
]);

AddTests('SHEET', [
  { type: 'expect', expression: '=SHEET()', expected: 1 },
]);

AddTests('SHEETS', [
  { type: 'expect', expression: '=SHEETS()', expected: 1 },
]);
