
import { type EmbeddedSpreadsheet, type CellValue, TREB } from '../..';

export type EvaluateResultType = ReturnType<EmbeddedSpreadsheet['Evaluate']>;

/**
 * Transposes a 2D array (Matrix) of any dimensions.
 * Time Complexity: O(M * N)
 * Space Complexity: O(M * N)
 */
function Transpose<T>(matrix: T[][]): T[][] {

  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  const result: T[][] = new Array(cols);
  
  for (let i = 0; i < cols; i++) {
    const temp = new Array(rows);
    result[i] = new Array(rows);
    for (let j = 0; j < rows; j++) {
      temp[j] = (matrix[j] as T[])[i]; // shut up typescript
    }
    result[i] = temp;
  }

  return result;

}

/**
 * there's a known issue with TREB's `Evaluate` method that it returns
 * arrays in column-major order (this is how it works internally). for 
 * comparison purposes, this wrapper function will handle transposition.
 */
function EvaluateTranspose(spreadsheet: EmbeddedSpreadsheet, expression: string) {
  const result = spreadsheet.Evaluate(expression);
  if (Array.isArray(result)) {
    return Transpose(result);
  }
  return result;
}

export interface ExpectTest {
  type: 'expect';
  expression: string;
  expected: EvaluateResultType;
}

export interface ApproximateTest {
  type: 'approximate';
  expression: string;
  expected: number;
  epsilon: number;
}

export interface CustomTest {
  type: 'custom';
  expression: string;
  count: number;
  validate: (result: EvaluateResultType[]) => boolean;
}

export type TestType = ExpectTest | ApproximateTest | CustomTest;

interface EvalResponse {
  success: boolean;
  received?: CellValue|CellValue[][];
}

/**
 * run a function and match against an expected result.
 * only use this function if the result is known and 
 * deterministic. meaning, don't use this for "RAND" or "NOW".
 * 
 * for this test method, we will always evaluate functions in
 * an EN-US context, so use comma as the argument separator
 * and use dot as the decimal separator for numbers.
 * 
 */
function Expect(spreadsheet: EmbeddedSpreadsheet, test: ExpectTest): EvalResponse {
  
  const result = EvaluateTranspose(spreadsheet, test.expression);
  if (result === 'NAME') {
    return { success: false, received: 'name' };
  }

  if (Array.isArray(result)) {
    return {
      success: JSON.stringify(result) === JSON.stringify(test.expected),
      received: result,
    };
  }
  else if (typeof result === 'object') {
    return {
      success: JSON.stringify(result) === JSON.stringify(test.expected),
      received: result,
    };
  }

  return {
    success: (result === test.expected),
    received: result,
  };

}

/** 
 * approximate test adds an epsilon to check if results are within
 * expected bounds. this is intended for calculations that are unreliable
 * due to IEEE 754 noise.
 */
function Approximate(spreadsheet: EmbeddedSpreadsheet, test: ApproximateTest): EvalResponse {
  const result = EvaluateTranspose(spreadsheet, test.expression);
  if (result === 'NAME') {
    return { success: false, received: 'name' };
  }
  if (typeof result !== 'number') {
    return { success: false, received: result };
  }
  return { success: Math.abs(result - test.expected) <= test.epsilon, received: result };
}

/**
 * test with a custom evaluator. we'll run the function X times
 * and call the evaluator with the returned values, as an array
 */
function Custom(spreadsheet: EmbeddedSpreadsheet, test: CustomTest): EvalResponse {
  const results: EvaluateResultType[] = [];
  for (let i = 0; i < test.count; i++) {
    const result = EvaluateTranspose(spreadsheet, test.expression);
    if (result === 'NAME') {
      return {
        success: false,
        received: 'name'
      }
    }
    results.push(result);
  }
  return {
    success: test.validate(results),
  }
}

type SetRangeFunction = (address_or_range: string, data: CellValue|CellValue[][]) => void;

/** 
 * optional init function to prepare groups of tests. this passes the 
 * spreadsheet so you can set or clear cells or anything else you need to
 * do for the group of tests.
 */
type InitFunction = (SetRange: SetRangeFunction) => void;

/** composite test group */
type TestGroup = {
  tests: TestType[];
  init?: InitFunction;
};

/**
 * list of all tests. this is not exported. it's maintained here.
 * changing the structure slightly; we still have single keys but
 * there can be multiple _groups_ of tests.
 */
const global_tests: Map<string, TestGroup[]> = new Map();

/** 
 * add tests for a spreadsheet function. note that this can be called
 * multiple times with the same key (I guess that makes it idempotent?)
 */
export function AddTests(key: string, tests: TestType[], init?: InitFunction) {

  // normalize key, just in case
  key = key.toUpperCase();

  const groups = global_tests.get(key) || [];
  groups.push({tests, init});

  global_tests.set(key, groups);

}

export interface TestResultsType {
  succeeded: number;
  failed: number;
  error?: 'name';
  failed_tests?: (TestType & {received?: CellValue|CellValue[][]})[];
}

/**
 * consolidated test function. retuns success/failure count, or 
 * an error if the function does not exist
 */
function RunTestsForKey(spreadsheet: EmbeddedSpreadsheet, key: string, tests: TestType[]): TestResultsType {
  
  const results: TestResultsType = { succeeded: 0, failed: 0 };
  const failed_tests: TestResultsType['failed_tests'] = [];

  for (const [index, test] of tests.entries()) {
    let result: EvalResponse|undefined;
    switch (test.type) {
      case 'custom':
        result = Custom(spreadsheet, test);
        break;

      case 'approximate':
        result = Approximate(spreadsheet, test);
        break;

      case 'expect':
        result = Expect(spreadsheet, test);
        break;
    }

    if (result?.success) {
      results.succeeded++;
    }
    else {
      failed_tests.push({ ...test, received: result.received });
    }

  }

  results.failed = tests.length - results.succeeded;
  if (failed_tests.length) {
    results.failed_tests = failed_tests;
  }

  return results;

}

export interface KeyResultsType {
  key: string;
  results: TestResultsType;
}

function SetRangeFunctionImpl(spreadsheet: EmbeddedSpreadsheet, address_or_range: string, data: CellValue|CellValue[][]) {  
  spreadsheet.SetRange(address_or_range, data, { spill: true });
}

/**
 * run all tests and return composite results
 */
export async function RunAllTests(verbose = false, list: string[] = []) {

  const results: KeyResultsType[] = [];

  // create a new instance. we're not initializing UI.
  const spreadsheet = TREB.CreateSpreadsheet({
    headless: true,
  });

  // wait for spreadsheet init to complete
  await spreadsheet.ready;

  for (const [key, groups] of global_tests.entries()) {

    if (list.length) {
      const check = key.toUpperCase();
      if (!list.includes(check)) {
        continue;
      }
    }

    if (verbose) {
      console.info(`running tests for key ${key}`)
    }
    
    const composite: TestResultsType = { succeeded: 0, failed: 0 };

    for (const group of groups) {

      // before each test case, reset the spreadsheet
      spreadsheet.Reset();

      if (group.init) {
        group.init(SetRangeFunctionImpl.bind(0, spreadsheet));
      }

      const results = RunTestsForKey(spreadsheet, key, group.tests);
      composite.succeeded += results.succeeded;
      composite.failed += results.failed;

      if (results.error) {
        composite.error = results.error;
      }
      if (results.failed_tests?.length) {
        composite.failed_tests = (composite.failed_tests || []).concat(results.failed_tests);
      }

    }

    results.push({key, results: composite});

  }

  return results;

}
