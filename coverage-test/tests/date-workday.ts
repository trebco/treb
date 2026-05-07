
import { AddTests } from '@util';

AddTests('NETWORKDAYS', [
  { type: 'expect', expression: '=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,31))', expected: 23 },
  { type: 'expect', expression: '=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,5))', expected: 5 },
  { type: 'expect', expression: '=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,1))', expected: 1 },
]);

AddTests('NETWORKDAYS.INTL', [
  { type: 'expect', expression: '=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31),1)', expected: 23 },
  { type: 'expect', expression: '=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31),11)', expected: 27 },
]);

AddTests('WORKDAY', [
  { type: 'expect', expression: '=WORKDAY(DATE(2024,1,1),5)', expected: 45299 },
  { type: 'expect', expression: '=WORKDAY(DATE(2024,1,1),10)', expected: 45306 },
  { type: 'expect', expression: '=WORKDAY(DATE(2024,1,1),0)', expected: 45292 },
]);

AddTests('WORKDAY.INTL', [
  { type: 'expect', expression: '=WORKDAY.INTL(DATE(2024,1,1),5,1)', expected: 45299 },
  { type: 'expect', expression: '=WORKDAY.INTL(DATE(2024,1,1),5,11)', expected: 45297 },
]);

AddTests('WEEKDAY', [
  { type: 'expect', expression: '=WEEKDAY(DATE(2024,1,1))', expected: 2 },
  { type: 'expect', expression: '=WEEKDAY(DATE(2024,1,7))', expected: 1 },
  { type: 'expect', expression: '=WEEKDAY(DATE(2024,1,1),2)', expected: 1 },
  { type: 'expect', expression: '=WEEKDAY(DATE(2024,1,1),3)', expected: 0 },
]);

AddTests('WEEKNUM', [
  { type: 'expect', expression: '=WEEKNUM(DATE(2024,1,1))', expected: 1 },
  { type: 'expect', expression: '=WEEKNUM(DATE(2024,3,9))', expected: 10 },
  { type: 'expect', expression: '=WEEKNUM(DATE(2024,1,1),2)', expected: 1 },
]);
