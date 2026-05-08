# Extended Function Library

Adds spreadsheet functions to the TREB app. Each source file registers functions via `AddExtendedFunction(name, descriptor)`.

## File whitelist

Only read files listed in README.md. Ask before reading anything else in the parent TREB directory.

## Naming conventions

- Function names and helper functions: UpperCamelCase (e.g. `YearFrac`, `CalcPrice`)
- Variable names: lower_snake_case (e.g. `settlement_date`, `day_count`)

## Adding functions

1. Create or edit a file in `./src/` (see `./src/template.ts` for the pattern)
2. Import it in `./src/index.ts`
3. Key imports:
   - `Box`, `UnionValue` from `treb-base-types`
   - `AddExtendedFunction`, `ValueError`, `DivideByZeroError` from `treb-calculator`
   - `extractNumbers` from `./stats-array-utils` for array arguments
4. Use `boxed: true` on argument descriptors to receive raw `UnionValue` (for array args)
5. Use `unroll: true` on argument descriptors to auto-apply the function over array elements

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
