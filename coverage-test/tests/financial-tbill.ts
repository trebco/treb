
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('TBILLEQ', [
  { type: 'approximate', expression: '=TBILLEQ(DATE(2008,3,31),DATE(2008,6,1),0.0914)', expected: 0.094151, epsilon: 0.001 },
]);

AddTests('TBILLPRICE', [
  { type: 'approximate', expression: '=TBILLPRICE(DATE(2008,3,31),DATE(2008,6,1),0.09)', expected: 98.45, epsilon: 0.01 },
]);

AddTests('TBILLYIELD', [
  { type: 'approximate', expression: '=TBILLYIELD(DATE(2008,3,31),DATE(2008,6,1),98.45)', expected: 0.091417, epsilon: 0.001 },
]);
