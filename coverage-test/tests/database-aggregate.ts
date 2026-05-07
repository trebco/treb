
import { AddTests } from '@util';

AddTests('DAVERAGE', [
  { type: 'expect', expression: '=DAVERAGE(A1:C5,3,E1:E2)', expected: 52500 },
], SetRange => {
  SetRange('A1', [
    ['Name', 'Dept', 'Salary'],
    ['Alice', 'Sales', 50000],
    ['Bob', 'Engineering', 60000],
    ['Charlie', 'Sales', 55000],
    ['Diana', 'Engineering', 70000],
  ]);
  SetRange('E1', [['Dept'], ['Sales']]);
});

AddTests('DCOUNT', [
  { type: 'expect', expression: '=DCOUNT(A1:C5,3,E1:E2)', expected: 2 },
], SetRange => {
  SetRange('A1', [
    ['Name', 'Dept', 'Salary'],
    ['Alice', 'Sales', 50000],
    ['Bob', 'Engineering', 60000],
    ['Charlie', 'Sales', 55000],
    ['Diana', 'Engineering', 70000],
  ]);
  SetRange('E1', [['Dept'], ['Sales']]);
});

AddTests('DCOUNTA', [
  { type: 'expect', expression: '=DCOUNTA(A1:C5,1,E1:E2)', expected: 2 },
], SetRange => {
  SetRange('A1', [
    ['Name', 'Dept', 'Salary'],
    ['Alice', 'Sales', 50000],
    ['Bob', 'Engineering', 60000],
    ['Charlie', 'Sales', 55000],
    ['Diana', 'Engineering', 70000],
  ]);
  SetRange('E1', [['Dept'], ['Sales']]);
});

AddTests('DGET', [
  { type: 'expect', expression: '=DGET(A1:C5,3,E1:E2)', expected: 60000 },
], SetRange => {
  SetRange('A1', [
    ['Name', 'Dept', 'Salary'],
    ['Alice', 'Sales', 50000],
    ['Bob', 'Engineering', 60000],
    ['Charlie', 'Sales', 55000],
    ['Diana', 'Engineering', 70000],
  ]);
  SetRange('E1', [['Name'], ['Bob']]);
});

AddTests('DMAX', [
  { type: 'expect', expression: '=DMAX(A1:C5,3,E1:E2)', expected: 55000 },
], SetRange => {
  SetRange('A1', [
    ['Name', 'Dept', 'Salary'],
    ['Alice', 'Sales', 50000],
    ['Bob', 'Engineering', 60000],
    ['Charlie', 'Sales', 55000],
    ['Diana', 'Engineering', 70000],
  ]);
  SetRange('E1', [['Dept'], ['Sales']]);
});

AddTests('DMIN', [
  { type: 'expect', expression: '=DMIN(A1:C5,3,E1:E2)', expected: 50000 },
], SetRange => {
  SetRange('A1', [
    ['Name', 'Dept', 'Salary'],
    ['Alice', 'Sales', 50000],
    ['Bob', 'Engineering', 60000],
    ['Charlie', 'Sales', 55000],
    ['Diana', 'Engineering', 70000],
  ]);
  SetRange('E1', [['Dept'], ['Sales']]);
});

AddTests('DSUM', [
  { type: 'expect', expression: '=DSUM(A1:C5,3,E1:E2)', expected: 105000 },
], SetRange => {
  SetRange('A1', [
    ['Name', 'Dept', 'Salary'],
    ['Alice', 'Sales', 50000],
    ['Bob', 'Engineering', 60000],
    ['Charlie', 'Sales', 55000],
    ['Diana', 'Engineering', 70000],
  ]);
  SetRange('E1', [['Dept'], ['Sales']]);
});
