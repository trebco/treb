
/**
 * results looks like this:
 * Array<{row: number, column: number, data: any[]}>
 *
 * where the array length is the number of trials. assuming
 * we only handle numbers, we should be able to pack this into
 * an array.
 * 
 * container looks like this:
 * {
 *    elapsed: number;
 *    trials: number;
 *    results: Float64Array[] (actually ArrayBuffer)
 * }
 * 
 */

export interface ResultContainer {
  elapsed: number;
  trials: number;
  results: ArrayBuffer[];
}

export interface Result {
  row: number;
  column: number;
  sheet_id: number;
  data: Float64Array|number[];
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

/**
 * consolidate multiple results (from multiple threads)
 */
export const ConsolidateResults = (thread_results: ResultContainer[]): ResultContainer => {

  // special case
  if (thread_results.length === 1) {
    return thread_results[0];
  }

  let elapsed = 0;
  let trials = 0;
    
  for (const result of thread_results) {
    elapsed = Math.max(elapsed, result.elapsed);
    trials += result.trials;
  }

  // allocate, and copy first set

  const base = thread_results[0];
  const consolidated: Float64Array[] = 
    base.results.map((original: ArrayBuffer) => {
      const resized = new Float64Array(4 + trials);
      resized.set(new Float64Array(original));
      return resized;
    });

  let offset = base.trials + 4;

  // now copy the rest (omitting header)

  for (let i = 1; i < thread_results.length; i++) {
    const set = thread_results[i];
    set.results.forEach((packed: ArrayBuffer, index: number) => {
      const result = new Float64Array(packed);
      const target = consolidated[index];

      // validate
      if (target[0] !== result[0]
          || target[1] !== result[1]
          || target[2] !== result[2]) {
        throw new Error('mismatch in result address');
      }

      target.set(result.subarray(4), offset);

    });
    offset += set.trials;
  }

  // ok

  return {
    elapsed, 
    trials,
    results: consolidated.map(result => result.buffer),
  };

}
