
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('SLOPE', [
  { type: 'approximate', expression: '=SLOPE(B1:B5,A1:A5)', expected: 0.8, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('INTERCEPT', [
  { type: 'approximate', expression: '=INTERCEPT(B1:B5,A1:A5)', expected: 1.6, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('STEYX', [
  { type: 'approximate', expression: '=STEYX(B1:B5,A1:A5)', expected: 0.4472135955, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('FORECAST.LINEAR', [
  { type: 'approximate', expression: '=FORECAST.LINEAR(6,B1:B5,A1:A5)', expected: 6.4, epsilon },
  { type: 'approximate', expression: '=FORECAST.LINEAR(10,B1:B5,A1:A5)', expected: 9.6, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('LINEST', [
  { type: 'approximate', expression: '=INDEX(LINEST(B1:B5,A1:A5),1,1)', expected: 0.8, epsilon },
  { type: 'approximate', expression: '=INDEX(LINEST(B1:B5,A1:A5),1,2)', expected: 1.6, epsilon },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4], [5]]);
  SetRange('B1', [[2], [4], [5], [4], [5]]);
});

AddTests('LOGEST', [
  { type: 'approximate', expression: '=INDEX(LOGEST(B1:B4,A1:A4),1,1)', expected: 1.4634479, epsilon: 1e-6 },
], SetRange => {
  SetRange('A1', [[1], [2], [3], [4]]);
  SetRange('B1', [[1], [3], [5], [10]]);
});
