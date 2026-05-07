
import { AddTests } from '@util';

const epsilon = 1e-10;

AddTests('VAR.P', [
  { type: 'approximate', expression: '=VAR.P(A1:A5)', expected: 200, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('VAR.S', [
  { type: 'approximate', expression: '=VAR.S(A1:A5)', expected: 250, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('VARA', [
  { type: 'approximate', expression: '=VARA(A1:A5)', expected: 250, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('VARPA', [
  { type: 'approximate', expression: '=VARPA(A1:A5)', expected: 200, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('STDEV.P', [
  { type: 'approximate', expression: '=STDEV.P(A1:A5)', expected: 14.142135624, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('STDEV.S', [
  { type: 'approximate', expression: '=STDEV.S(A1:A5)', expected: 15.811388301, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('STDEVA', [
  { type: 'approximate', expression: '=STDEVA(A1:A5)', expected: 15.811388301, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});

AddTests('STDEVPA', [
  { type: 'approximate', expression: '=STDEVPA(A1:A5)', expected: 14.142135624, epsilon },
], SetRange => {
  SetRange('A1', [[10], [20], [30], [40], [50]]);
});
