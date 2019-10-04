
/**
 * results looks like this:
 * Array<{row: number, column: number, data: any[]}>
 *
 * where the array length is the number of trials. assuming
 * we only handle numbers, we should be able to pack this into
 * an array.
 */

export interface Result {
  row: number;
  column: number;
  sheet_id: number;
  data: number[];
}

export const PackOne = (result: Result) => {
  const size = 4 + result.data.length;
  const data = new Float64Array(size);
  data[0] = result.column;
  data[1] = result.row;
  data[2] = result.sheet_id;
  data[3] = result.data.length;
  data.set(result.data, 4);
  return data;
};

export const UnpackOne = (data: Float64Array) => {

  // we might have old-style data... how to know? should have
  // added a version flag (probably not, wasteful)

  if (data.length === 3 + data[2]) {
    return { column: data[0], row: data[1], sheet_id: 0, data: data.subarray(3) };
  }
  else {
    return { column: data[0], row: data[1], sheet_id: data[2], data: data.subarray(4) };
  }

};

