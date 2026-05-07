# coverage-test

Excel function coverage tests for the TREB spreadsheet engine. The goal is to test every Excel function listed in `data/excel_functions.csv` (522 functions across 14 categories).

## Running tests

```
bun run main.ts
```

Results are written to `test-results.json`. Functions returning a NAME error are flagged with `error: 'name'` (function not implemented).

## Project structure

- `main.ts` — entry point, imports all test files, calls `RunAllTests()`, writes results to JSON
- `src/util.ts` — test framework with `AddTests`, `RunAllTests`, and three test types
- `tests/` — test files grouped by category and subcategory
- `data/excel_functions.csv` — master list of all Excel functions with category, compatibility mapping, and test status columns
- `template.ts` — reference example

## Writing tests

Each test file registers tests using `AddTests`. No spreadsheet boilerplate needed — `RunAllTests()` handles instance creation and reset between keys.

```typescript
import { AddTests } from '@util';

AddTests('FUNCTION_NAME', [
  { type: 'expect', expression: '=FUNCTION_NAME(args)', expected: value },
]);
```

`@util` is a path alias configured in tsconfig.json.

After creating a test file, add its import to `main.ts`.

### Tests with cell references

`AddTests` accepts an optional third argument — an init function that receives `SetRange`. Use it to set cell values before tests run. The spreadsheet is reset before each group automatically.

```typescript
AddTests('SUM', [
  { type: 'expect', expression: '=SUM(A1:A2)', expected: 300 },
], SetRange => {
  SetRange('A1', 100);
  SetRange('A2', 200);
});
```

You can call `AddTests` multiple times with the same key — once for literal tests and again with an init for cell reference tests.

### Test types

- **`expect`** — deterministic comparison with strict equality. Use for functions with known, exact results.
- **`approximate`** — tolerance-based comparison for floating point results (IEEE 754 noise). Requires `expected: number` and `epsilon: number`.
- **`custom`** — runs the expression `count` times and passes all results to a `validate` function. Use for non-deterministic functions like RAND.

### Conventions

- All expressions use EN-US locale: comma as argument separator, dot as decimal separator
- Cell reference tests use the init function to set up data; literal-only tests need no init
- Expressions start with `=`
- Literal arrays use `{semicolons for rows; commas for columns}`
- Test files are named `{category}-{subcategory}.ts` (lowercase, hyphen-separated)
- Each function gets ~4 test cases covering positive, negative, zero, and edge cases
- Expected values should match Excel behavior. Test failures are findings, not bugs in the tests.
- Keep groups small (4-8 functions per file)
