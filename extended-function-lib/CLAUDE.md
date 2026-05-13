# Extended Function Library

Adds spreadsheet functions to the TREB app. Each source file registers functions via `AddExtendedFunction(name, descriptor)`.

## File whitelist

Only read files listed in README.md. Ask before reading anything else in the parent TREB directory.

## Naming conventions

- Function names and helper functions: UpperCamelCase (e.g. `YearFrac`, `CalcPrice`)
- Variable names: lower_snake_case (e.g. `settlement_date`, `day_count`)

## Finding unimplemented functions

The coverage test report at `../coverage-test/test-results.json` lists all tested functions. Each entry has a `key` (function name) and a `results` object. If `results` contains `"error": "name"`, the function is not yet implemented — the spreadsheet returned a `#NAME` error because it doesn't recognize the function. Look here when deciding what to implement next.

Do not read `../coverage-test/report.html` — it is generated from the JSON report and contains no additional information.

## Out of scope

- **IM* complex number functions** (IMREAL, IMABS, IMSUM, etc.) — TREB has a native complex type, so the Excel text-based complex functions are not needed. May be added later for compatibility.
- **FORECAST.\* functions** (FORECAST.LINEAR, FORECAST.ETS, etc.) — already implemented in a separate WASM-based library. They show as unimplemented in the test report but are done.

## Adding functions

1. Create or edit a file in `./src/` (see `./src/template.ts` for the pattern)
2. Import it in `./src/index.ts`
3. Key imports:
   - `Box`, `UnionValue` from `treb-base-types`
   - `AddExtendedFunction`, `ValueError`, `DivideByZeroError` from `treb-calculator`
   - `extractNumbers` from `./stats-array-utils` for array arguments
4. Use `boxed: true` on argument descriptors to receive raw `UnionValue` (for array args)
5. Use `unroll: true` on argument descriptors to auto-apply the function over array elements
6. Use `allow_error: true` on argument descriptors to receive error values instead of having the calculator short-circuit on errors (needed for functions like TYPE and ERROR.TYPE)

## Testing and validation

Run from this directory:

```
npm run coverage-test
bun check-test-results.ts FUNCTION_NAME1 FUNCTION_NAME2
```

Do not modify tests — they live in `../coverage-test/` and are out of scope.

## Shared helpers

- `./src/finance-date-utils.ts` — serial date conversion, day count basis (0-4), coupon date arithmetic, bisection/Newton solvers
- `./src/stats-array-utils.ts` — `extractNumbers` for flattening UnionValue arrays to number[]
