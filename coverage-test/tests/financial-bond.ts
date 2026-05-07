
import { AddTests } from '@util';

const epsilon = 1e-6;

AddTests('PRICE', [
  { type: 'approximate', expression: '=PRICE(DATE(2008,2,15),DATE(2017,11,15),0.0575,0.065,100,2,0)', expected: 94.634361, epsilon: 0.01 },
  { type: 'approximate', expression: '=PRICE(DATE(2020,1,1),DATE(2030,1,1),0.05,0.06,100,2,0)', expected: 92.561034, epsilon: 0.1 },
]);

AddTests('YIELD', [
  { type: 'approximate', expression: '=YIELD(DATE(2008,2,15),DATE(2016,11,15),0.0575,95.04287,100,2,0)', expected: 0.065, epsilon: 0.001 },
]);

AddTests('DURATION', [
  { type: 'approximate', expression: '=DURATION(DATE(2008,1,1),DATE(2016,1,1),0.08,0.09,2,1)', expected: 5.993774, epsilon: 0.01 },
]);

AddTests('MDURATION', [
  { type: 'approximate', expression: '=MDURATION(DATE(2008,1,1),DATE(2016,1,1),0.08,0.09,2,1)', expected: 5.735669, epsilon: 0.01 },
]);

AddTests('PRICEMAT', [
  { type: 'approximate', expression: '=PRICEMAT(DATE(2008,2,15),DATE(2008,4,13),DATE(2007,11,11),0.061,0.061,0)', expected: 99.980556, epsilon: 0.01 },
]);

AddTests('YIELDMAT', [
  { type: 'approximate', expression: '=YIELDMAT(DATE(2008,3,15),DATE(2008,11,3),DATE(2007,11,8),0.0625,100.0123,0)', expected: 0.060954, epsilon: 0.001 },
]);
