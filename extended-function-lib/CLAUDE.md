# Extended Function Library

Adds spreadsheet functions to the TREB app. Each source file default-exports a `FunctionMap` (name → descriptor); `index.ts` merges them into the exported `ExtendedFunctions` map. The consumer registers that map — the library performs no registration side-effects.

## File whitelist

Only read files listed in README.md. Ask before reading anything else in the parent TREB directory.

## Naming conventions

- Function names and helper functions: UpperCamelCase (e.g. `YearFrac`, `CalcPrice`)
- Variable names: lower_snake_case (e.g. `settlement_date`, `day_count`)

## Finding unimplemented functions

The coverage test report at `../coverage-test/test-results.json` lists all tested functions. Each entry has a `key` (function name) and a `results` object. If `results` contains `"error": "name"`, the function is not yet implemented — the spreadsheet returned a `#NAME` error because it doesn't recognize the function. Look here when deciding what to implement next.

Failed tests include the full test definition (type, expression, and expected value), which helps diagnose whether a failure is a bug in the implementation or an incorrect test expectation.

Do not read `../coverage-test/report.html` — it is generated from the JSON report and contains no additional information.

## Out of scope

- **IM* complex number functions** (IMREAL, IMABS, IMSUM, etc.) — TREB has a native complex type, so the Excel text-based complex functions are not needed. May be added later for compatibility.
- **FORECAST.\* functions** (FORECAST.LINEAR, FORECAST.ETS, etc.) — already implemented in a separate WASM-based library. They show as unimplemented in the test report but are done.
- **BESSEL functions** (BESSELI, BESSELJ, BESSELK, BESSELY) — will be implemented in a C++/WASM library, not here.

## Array layout

`ArrayUnion.value` is **column-major**: `value[col][row]`. A 3-column, 5-row range is `value.length === 3` with each inner array having 5 elements.

## Adding functions

1. Create or edit a file in `./src/` (see `./src/template.ts` for the pattern). The file
   `default`-exports one object literal (`satisfies FunctionMap`) mapping each function
   name to its descriptor — do not call any registration function.
2. In `./src/index.ts`, `import` the file's default export and spread it into the
   `ExtendedFunctions` composite map. Merge order matters: on a duplicate name the later
   spread wins.
3. Key imports:
   - `Box`, `UnionValue` from `treb-base-types`
   - `ValueError`, `DivideByZeroError` from `treb-calculator` (values); `FunctionMap` from
     `treb-calculator` (type, for `satisfies FunctionMap`)
   - `extractNumbers` from `./stats-array-utils` for array arguments
4. Use `boxed: true` on argument descriptors to receive raw `UnionValue` (for array args)
5. Use `unroll: true` on argument descriptors to auto-apply the function over array elements
6. Use `allow_error: true` on argument descriptors to receive error values instead of having the calculator short-circuit on errors (needed for functions like TYPE and ERROR.TYPE)

Module-private helper functions stay as ordinary top-level declarations in the file,
referenced from the descriptor `fn` bodies — they are not part of the exported map.

## Adding aliases

Aliases are names that will map to existing functions. For example we can use 
an alias to implement the older function GAMMADIST which will map to the modern
function GAMMA.DIST.

Aliases are `[alias_name, target_function_name]` pairs. Add them to the array in
`./src/compat-aliases.ts` (default-exported), which `index.ts` re-exports as
`ExtendedFunctionAliases`. The consumer applies aliases after registering functions.

## Testing and validation

Run from this directory:

```
npm run coverage-test
bun check-test-results.ts FUNCTION_NAME1 FUNCTION_NAME2
```

Do not modify tests unless the user specifically requests that. Tests are in ../coverage-tests/tests/. If the plan scope is writing functions, then test errors are findings and 
tests should not be adjusted. If the plan scope is validating tests, then modifying tests is ok.

## Shared helpers

- `./src/finance-date-utils.ts` — serial date conversion, day count basis (0-4), coupon date arithmetic, bisection/Newton solvers
- `./src/stats-array-utils.ts` — `extractNumbers` for flattening UnionValue arrays to number[]
