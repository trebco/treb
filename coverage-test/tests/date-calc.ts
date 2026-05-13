
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('DAYS', [
  { type: 'expect', expression: '=DAYS(DATE(2024,12,31),DATE(2024,1,1))', expected: 365 },
  { type: 'expect', expression: '=DAYS(DATE(2023,12,31),DATE(2023,1,1))', expected: 364 },
  { type: 'expect', expression: '=DAYS(DATE(2024,3,1),DATE(2024,2,1))', expected: 29 },
  { type: 'expect', expression: '=DAYS(DATE(2024,1,1),DATE(2024,12,31))', expected: -365 },
]);

AddTests('DAYS360', [
  { type: 'expect', expression: '=DAYS360(DATE(2024,1,1),DATE(2024,12,31))', expected: 360 },
  { type: 'expect', expression: '=DAYS360(DATE(2024,1,30),DATE(2024,2,1))', expected: 1 },
  { type: 'expect', expression: '=DAYS360(DATE(2024,1,1),DATE(2025,1,1))', expected: 360 },
]);

AddTests('EDATE', [
  { type: 'expect', expression: '=EDATE(DATE(2024,1,15),1)', expected: 45337 },
  { type: 'expect', expression: '=EDATE(DATE(2024,1,31),1)', expected: 45351 },
  { type: 'expect', expression: '=EDATE(DATE(2024,3,15),-1)', expected: 45337 },
  { type: 'expect', expression: '=EDATE(DATE(2024,1,15),12)', expected: 45672 },
]);

AddTests('EOMONTH', [
  { type: 'expect', expression: '=EOMONTH(DATE(2024,1,1),0)', expected: 45322 },
  { type: 'expect', expression: '=EOMONTH(DATE(2024,1,1),1)', expected: 45351 },
  { type: 'expect', expression: '=EOMONTH(DATE(2024,1,1),-1)', expected: 45291 },
  { type: 'expect', expression: '=EOMONTH(DATE(2024,2,15),0)', expected: 45351 },
]);

AddTests('YEARFRAC', [
  { type: 'approximate', expression: '=YEARFRAC(DATE(2024,1,1),DATE(2024,7,1))', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=YEARFRAC(DATE(2024,1,1),DATE(2025,1,1))', expected: 1, epsilon },
  { type: 'approximate', expression: '=YEARFRAC(DATE(2024,1,1),DATE(2024,4,1),1)', expected: 0.2486338798, epsilon },
]);

AddTests('ISOWEEKNUM', [
  { type: 'expect', expression: '=ISOWEEKNUM(DATE(2024,1,1))', expected: 1 },
  { type: 'expect', expression: '=ISOWEEKNUM(DATE(2024,12,31))', expected: 1 },
  { type: 'expect', expression: '=ISOWEEKNUM(DATE(2024,6,15))', expected: 24 },
]);
