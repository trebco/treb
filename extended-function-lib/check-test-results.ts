
/**
 * helper script to check test results for a specific function.
 * 
 * this script will not re-run test suite. it just reads the test
 * results. so be sure to run the coverage test after any function
 * changes.
 */

import results from '../coverage-test/test-results.json';
import type { KeyResultsType, TestResultsType } from '../coverage-test/src/util';

// convert to map

const map: Map<string, KeyResultsType> = new Map();

for (const result of results) {
  map.set(result.key.toUpperCase(), result as KeyResultsType);
}

const json: Record<string, TestResultsType> & { not_found?: string[] } = {};
const not_found: string[] = [];

for (const arg of process.argv) {
  if (/^[a-zA-Z0-9\.]+$/.test(arg)) {
    const results = map.get(arg.toUpperCase());
    if (results) {
      json[results.key] = results.results;
    }
    else {
      not_found.push(arg);
    }
  }
}

if (not_found.length) {
  json.not_found = not_found;
}

console.info(JSON.stringify(json, undefined, 2));



