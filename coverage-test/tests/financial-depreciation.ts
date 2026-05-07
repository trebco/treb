
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('SLN', [
  { type: 'expect', expression: '=SLN(30000,7500,10)', expected: 2250 },
  { type: 'expect', expression: '=SLN(10000,1000,5)', expected: 1800 },
  { type: 'expect', expression: '=SLN(5000,0,5)', expected: 1000 },
]);

AddTests('SYD', [
  { type: 'approximate', expression: '=SYD(30000,7500,10,1)', expected: 4090.909091, epsilon: 0.01 },
  { type: 'approximate', expression: '=SYD(30000,7500,10,10)', expected: 409.090909, epsilon: 0.01 },
  { type: 'expect', expression: '=SYD(10000,1000,5,1)', expected: 3000 },
]);

AddTests('DB', [
  { type: 'approximate', expression: '=DB(1000000,100000,6,1)', expected: 319000, epsilon: 0.1 },
  { type: 'approximate', expression: '=DB(1000000,100000,6,3)', expected: 147960.581, epsilon: 0.1 },
  { type: 'approximate', expression: '=DB(1000000,100000,6,7,7)', expected: 18515.102, epsilon: 1 },
]);

AddTests('DDB', [
  { type: 'approximate', expression: '=DDB(2400,300,10*365,1)', expected: 1.315068, epsilon: 0.01 },
  { type: 'approximate', expression: '=DDB(2400,300,10*12,1)', expected: 40, epsilon: 0.01 },
  { type: 'approximate', expression: '=DDB(2400,300,10,1,2)', expected: 480, epsilon: 0.01 },
]);

AddTests('VDB', [
  { type: 'approximate', expression: '=VDB(2400,300,10,0,1)', expected: 480, epsilon: 0.01 },
  { type: 'approximate', expression: '=VDB(2400,300,10,0,0.875)', expected: 420, epsilon: 0.01 },
  { type: 'approximate', expression: '=VDB(2400,300,10,6,10)', expected: 307.488, epsilon: 0.1 },
]);
