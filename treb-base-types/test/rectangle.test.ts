
import { Rectangle, IRectangle } from '../src/rectangle';

test('construction', () => {

  const rect_1 = new Rectangle(3, 7, 100, 200);
  expect(rect_1.width).toEqual(100);
  expect(rect_1.right).toEqual(103);
  expect(rect_1.height).toEqual(200);
  expect(rect_1.bottom).toEqual(207);

  const rect_2 = Rectangle.Create({top: 3, left: 7, height: 100, width: 200});
  expect(rect_2.width).toEqual(200);
  expect(rect_2.right).toEqual(207);
  expect(rect_2.height).toEqual(100);
  expect(rect_2.bottom).toEqual(103);

});

test('operations', () => {

  // shift
  let base = new Rectangle(0, 0, 100, 100);
  let adjusted = base.Shift(10, -20);
  expect(adjusted.left).toEqual(10);
  expect(adjusted.top).toEqual(-20);
  expect(adjusted.width).toEqual(100);
  expect(adjusted.height).toEqual(100);

  // expand
  base = new Rectangle(0, 0, 100, 100);
  adjusted = base.Expand(-10, 7);
  expect(adjusted.left).toEqual(0);
  expect(adjusted.top).toEqual(0);
  expect(adjusted.width).toEqual(90);
  expect(adjusted.height).toEqual(107);

  // combine
  const A = new Rectangle(100, 100, 100, 100);
  const B = new Rectangle(150, 150, 100, 100);
  const C = A.Combine(B);

  expect(C.left).toEqual(100);
  expect(C.top).toEqual(100);
  expect(C.width).toEqual(150);
  expect(C.height).toEqual(150);

  // contains
  base = new Rectangle(50, 50, 100, 100);
  expect(base.Contains(10, 10)).toBeFalsy();
  expect(base.Contains(90, 90)).toBeTruthy();
  expect(base.Contains(90, 190)).toBeFalsy();

  // clamp
  expect(base.Clamp(10, 10)).toEqual({x: 50, y: 50});
  expect(base.Clamp(90, 90)).toEqual({x: 90, y: 90});
  expect(base.Clamp(90, 190)).toEqual({x: 90, y: 150});


});
