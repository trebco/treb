
import { AddTests, type EvaluateResultType } from '@util';

const epsilon = 1e-10;

AddTests('TIME', [
  { type: 'approximate', expression: '=TIME(12,0,0)', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=TIME(6,0,0)', expected: 0.25, epsilon },
  { type: 'approximate', expression: '=TIME(0,0,0)', expected: 0, epsilon },
  { type: 'approximate', expression: '=TIME(18,0,0)', expected: 0.75, epsilon },
]);

AddTests('TIMEVALUE', [
  { type: 'approximate', expression: '=TIMEVALUE("12:00:00")', expected: 0.5, epsilon },
  { type: 'approximate', expression: '=TIMEVALUE("6:00:00")', expected: 0.25, epsilon },
  { type: 'approximate', expression: '=TIMEVALUE("18:00:00")', expected: 0.75, epsilon },
]);

AddTests('HOUR', [
  { type: 'expect', expression: '=HOUR(TIME(15,30,0))', expected: 15 },
  { type: 'expect', expression: '=HOUR(TIME(0,0,0))', expected: 0 },
  { type: 'expect', expression: '=HOUR(TIME(23,59,59))', expected: 23 },
]);

AddTests('MINUTE', [
  { type: 'expect', expression: '=MINUTE(TIME(15,30,45))', expected: 30 },
  { type: 'expect', expression: '=MINUTE(TIME(0,0,0))', expected: 0 },
  { type: 'expect', expression: '=MINUTE(TIME(12,59,0))', expected: 59 },
]);

AddTests('SECOND', [
  { type: 'expect', expression: '=SECOND(TIME(15,30,45))', expected: 45 },
  { type: 'expect', expression: '=SECOND(TIME(0,0,0))', expected: 0 },
  { type: 'expect', expression: '=SECOND(TIME(12,30,59))', expected: 59 },
]);

AddTests('NOW', [
  {
    type: 'custom', expression: '=NOW()', count: 1, validate: (results: EvaluateResultType[]) => {
      const r = results[0];
      return typeof r === 'number' && r > 40000;
    }
  }
]);

AddTests('TODAY', [
  {
    type: 'custom', expression: '=TODAY()', count: 1, validate: (results: EvaluateResultType[]) => {
      const r = results[0];
      return typeof r === 'number' && r > 40000 && r === Math.floor(r);
    }
  }
]);
