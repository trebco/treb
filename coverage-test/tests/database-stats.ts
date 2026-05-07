
import { AddTests } from '@util';

const epsilon = 1e-6;

const dbData: (string | number)[][] = [
  ['Name', 'Dept', 'Salary'],
  ['Alice', 'Sales', 50000],
  ['Bob', 'Engineering', 60000],
  ['Charlie', 'Sales', 55000],
  ['Diana', 'Engineering', 70000],
];

const criteria = [['Dept'], ['Sales']];

AddTests('DPRODUCT', [
  { type: 'expect', expression: '=DPRODUCT(A1:C5,3,E1:E2)', expected: 2750000000 },
], SetRange => {
  SetRange('A1', dbData);
  SetRange('E1', criteria);
});

AddTests('DSTDEV', [
  { type: 'approximate', expression: '=DSTDEV(A1:C5,3,E1:E2)', expected: 3535.533906, epsilon: 0.01 },
], SetRange => {
  SetRange('A1', dbData);
  SetRange('E1', criteria);
});

AddTests('DSTDEVP', [
  { type: 'expect', expression: '=DSTDEVP(A1:C5,3,E1:E2)', expected: 2500 },
], SetRange => {
  SetRange('A1', dbData);
  SetRange('E1', criteria);
});

AddTests('DVAR', [
  { type: 'expect', expression: '=DVAR(A1:C5,3,E1:E2)', expected: 12500000 },
], SetRange => {
  SetRange('A1', dbData);
  SetRange('E1', criteria);
});

AddTests('DVARP', [
  { type: 'expect', expression: '=DVARP(A1:C5,3,E1:E2)', expected: 6250000 },
], SetRange => {
  SetRange('A1', dbData);
  SetRange('E1', criteria);
});
