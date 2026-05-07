
import { AddTests } from '@util';

AddTests('DATE', [
  { type: 'expect', expression: '=DATE(2024,1,1)', expected: 45292 },
  { type: 'expect', expression: '=DATE(2000,1,1)', expected: 36526 },
  { type: 'expect', expression: '=DATE(1900,1,1)', expected: 1 },
  { type: 'expect', expression: '=DATE(2024,12,31)', expected: 45657 },
]);

AddTests('YEAR', [
  { type: 'expect', expression: '=YEAR(DATE(2024,1,1))', expected: 2024 },
  { type: 'expect', expression: '=YEAR(DATE(1999,12,31))', expected: 1999 },
  { type: 'expect', expression: '=YEAR(DATE(2000,6,15))', expected: 2000 },
]);

AddTests('MONTH', [
  { type: 'expect', expression: '=MONTH(DATE(2024,1,15))', expected: 1 },
  { type: 'expect', expression: '=MONTH(DATE(2024,12,1))', expected: 12 },
  { type: 'expect', expression: '=MONTH(DATE(2024,6,30))', expected: 6 },
]);

AddTests('DAY', [
  { type: 'expect', expression: '=DAY(DATE(2024,1,15))', expected: 15 },
  { type: 'expect', expression: '=DAY(DATE(2024,2,29))', expected: 29 },
  { type: 'expect', expression: '=DAY(DATE(2024,12,31))', expected: 31 },
]);

AddTests('DATEVALUE', [
  { type: 'expect', expression: '=DATEVALUE("1/1/2024")', expected: 45292 },
  { type: 'expect', expression: '=DATEVALUE("12/31/2024")', expected: 45657 },
  { type: 'expect', expression: '=DATEVALUE("6/15/2000")', expected: 36692 },
]);

AddTests('DATEDIF', [
  { type: 'expect', expression: '=DATEDIF(DATE(2020,1,1),DATE(2024,1,1),"Y")', expected: 4 },
  { type: 'expect', expression: '=DATEDIF(DATE(2020,1,1),DATE(2024,1,1),"M")', expected: 48 },
  { type: 'expect', expression: '=DATEDIF(DATE(2020,1,1),DATE(2024,1,1),"D")', expected: 1461 },
  { type: 'expect', expression: '=DATEDIF(DATE(2024,3,1),DATE(2024,6,15),"M")', expected: 3 },
]);
