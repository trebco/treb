
# Extended function lib

This is a library for adding new functions to our spreadsheet app. It's 
split out from the main code base in an attempt to reduce complexity.

Spreadsheet functions are defined using the type `CompositeFunctionDescriptor` 
from the `treb-calculator` lib. The return type of all spreadsheet functions
is a `UnionValue` type, which is defined in the `treb-base-types` library.

Function arguments can be intrinsic types or can optionally use the same 
`UnionValue` type. This is controlled by a flag in the function descriptor.

## IMPORTANT

The full spreadsheet app (TREB) is reasonably large. We do not want you to 
read or understand this full library, because it's not necessary for this task
and it would just add a lot of noise to the context. 

As a result, please read ONLY the files and directories listed below. If you
feel that you need to read some other file or directory, please ask and we
will consider adding it to this whitelist.

Please read only the following:

- Any files in this directory (extended-function-lib)
- Any files in the coverage test directory ../coverage-test
- For function descriptor types, ../treb-calculator/src/descriptors.ts
- For the UnionValue type, ../treb-base-types/src/union.ts and ../treb-base-types/src/value-type.ts
- For error types (returning errors from functions), ../treb-calculator/src/function-error.ts

## How to add functions

See the file ./src/template.ts for an example. There's a function called 
`AddExtendedFunction` which takes the function name and a function descriptor.
Add files to the ./src/ directory with your new functions, then import them
in the file ./src/index.ts.

## Testing/validation

To test/validate functions, re-run the coverage tests and then check the results
for the functions. 

To re-run the coverage tests, use the script in this directory:

`npm run coverage-test`

That will run the full coverage test and generate the report. There's a helper
script in this directory you can use to check results for specific functions.
Pass the function names as arguments, e.g.

`bun check-test-results.ts DOLLARDE DOLLARFR`

