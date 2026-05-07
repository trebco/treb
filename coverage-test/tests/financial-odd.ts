
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('ODDFPRICE', [
  { type: 'approximate', expression: '=ODDFPRICE(DATE(2008,11,11),DATE(2021,3,1),DATE(2008,10,15),DATE(2009,3,1),0.0785,0.0625,100,2,1)', expected: 113.597717, epsilon: 0.1 },
]);

AddTests('ODDFYIELD', [
  { type: 'approximate', expression: '=ODDFYIELD(DATE(2008,11,11),DATE(2021,3,1),DATE(2008,10,15),DATE(2009,3,1),0.0785,84.50,100,2,1)', expected: 0.1006, epsilon: 0.01 },
]);

AddTests('ODDLPRICE', [
  { type: 'approximate', expression: '=ODDLPRICE(DATE(2008,2,7),DATE(2008,6,15),DATE(2007,10,15),0.0375,0.0405,100,2,1)', expected: 99.878172, epsilon: 0.01 },
]);

AddTests('ODDLYIELD', [
  { type: 'approximate', expression: '=ODDLYIELD(DATE(2008,4,20),DATE(2008,6,15),DATE(2007,12,24),0.0375,99.875,100,2,1)', expected: 0.045192, epsilon: 0.001 },
]);
