
import { Area, ICellAddress, IsCellAddress } from '../src/area';

test('IsCellAddress', () => {

  expect(IsCellAddress({ row: 0 })).toBeFalsy();
  expect(IsCellAddress({ row: 0 , column: 0 })).toBeTruthy();
  expect(IsCellAddress({ row: 0 , column: 0, absolute_row: true, absolute_column: false, sheet_id: 100 })).toBeTruthy();

});

test('construction', () => {

  // start only
  let area = new Area({row: 1, column: 3});
  expect(area.end.row).toEqual(1);
  expect(area.end.column).toEqual(3);

  // start, end
  area = new Area({row: 1, column: 3}, {row: 2, column: 5});
  expect(area.end.row).toEqual(2);
  expect(area.end.column).toEqual(5);

  // normalize
  area = new Area({row: 10, column: 3}, {row: 2, column: 7}, true);
  expect(area.start.row).toEqual(2);
  expect(area.end.row).toEqual(10);

  // methods
  area = Area.FromColumn(8);
  expect(area.start.column).toEqual(8);
  expect(area.end.column).toEqual(8);
  expect(area.start.row).toEqual(Infinity);
  expect(area.end.row).toEqual(Infinity);

});

test('accessors', () => {

  let area = new Area({row: 1, column: 3}, {row: 4, column: 11});

  expect(area.rows).toEqual(4);
  expect(area.columns).toEqual(9);
  expect(area.count).toEqual(36);
  expect(area.entire_column).toBeFalsy();
  expect(area.entire_row).toBeFalsy();
  expect(area.end).toEqual({row: 4, column: 11});

  area = Area.FromColumn(6);
  expect(area.entire_column).toBeTruthy();
  expect(area.entire_row).toBeFalsy();

  area = Area.FromRow(3);
  expect(area.entire_row).toBeTruthy();
  expect(area.entire_column).toBeFalsy();

});

test('methods', () => {

  let area = new Area({row: 2, column: 7}, {row: 5, column: 9});
  area.ConsumeArea(new Area({row: 4, column: 7}, {row: 12, column: 11}));

  expect(area.end.row).toEqual(12);
  expect(area.end.column).toEqual(11);


});
