
import { AddTests } from '@util';

const epsilon = 1e-6;

/*
AddTests('FORECAST.ETS', [
  { type: 'approximate', expression: '=FORECAST.ETS(6,B1:B5,A1:A5)', expected: 6, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [3], [4], [5], [6]]);
});

AddTests('FORECAST.ETS.CONFINT', [
  { type: 'approximate', expression: '=FORECAST.ETS.CONFINT(6,B1:B5,A1:A5)', expected: 1, epsilon: 5 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [3], [4], [5], [6]]);
});

AddTests('FORECAST.ETS.SEASONALITY', [
  { type: 'expect', expression: '=FORECAST.ETS.SEASONALITY(B1:B8,A1:A8)', expected: 1 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6], [7], [8]]);
  SetRange('B1', [[10], [20], [30], [40], [50], [60], [70], [80]]);
});
*/

AddTests('TREND', [
  { type: 'approximate', expression: '=INDEX(TREND(B1:B5,A1:A5,{6}),1,1)', expected: 5.8, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('TREND', [
  { type: 'approximate', expression: '=INDEX(TREND(B1:B4,A1:A4,{5}),1,1)', expected: 15, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
  SetRange('B1', [[3], [6], [9], [12]]);
});

AddTests('TREND', [
  { type: 'approximate', expression: '=INDEX(TREND(B1:B5,A1:A5,{6}),1,1)', expected: 11, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[1], [3], [5], [7], [9]]);
});

AddTests('GROWTH', [
  { type: 'approximate', expression: '=INDEX(GROWTH(B1:B4,A1:A4,{5}),1,1)', expected: 22.360679774997894, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
  SetRange('B1', [[1], [3], [5], [10]]);
});

AddTests('GROWTH', [
  { type: 'approximate', expression: '=INDEX(GROWTH(B1:B3,A1:A3,{4}),1,1)', expected: 16, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3]]);
  SetRange('B1', [[2], [4], [8]]);
});

AddTests('GROWTH', [
  { type: 'approximate', expression: '=INDEX(GROWTH(B1:B4,A1:A4,{5}),1,1)', expected: 96, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
  SetRange('B1', [[6], [12], [24], [48]]);
});

AddTests('FREQUENCY', [
  { type: 'expect', expression: '=INDEX(FREQUENCY(A1:A10,B1:B3),1,1)', expected: 3 },
  { type: 'expect', expression: '=INDEX(FREQUENCY(A1:A10,B1:B3),2,1)', expected: 3 },
  { type: 'expect', expression: '=INDEX(FREQUENCY(A1:A10,B1:B3),3,1)', expected: 3 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]);
  SetRange('B1', [[3], [6], [9]]);
});
