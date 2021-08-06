
### Base Types

`manual-types.d.ts` is a set of manually-curated types to support the 
(generated) API types created from embedded-spreadsheet-base.

### Generating API Types

`generate-api-types.ts` is a script which reads the auto-generated typings
file (for embedded-spreadsheet-base) and creates the API types. the output
is concatenated with the manual types. it needs a little bit of surgery and 
then we have our composite API types.

Arguments to `generate-api-types`:

 * base - the source declaration file
 * cat - files that will be concatenated with the generated output (multiple)
 * output - output file (omit to output to shell)
 * package - path to package.json (for TREB). we use this for version info

---

UPDATE: Switching to config file. Use config file.

### Example

```bash
npx ts-node-dev generate-api-types.ts 
```

### Manual Editing

- rename `EmbeddedSpreadsheetBase` -> `EmbeddedSpreadsheet`
- drop the `TREBDocument` type, for now
- drop the event argument to `Recalculate`
- drop the `LoadSource` argument to (?)
- ?

