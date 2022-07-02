

I added export for CSV (and TSV). Should follow RFC4180, although
there are probably some edge cases that I missed (I'm working on a 
better test set). See notes on API functions below:

---

```
EmbeddedSpreadsheet.SaveLocalFile(filename)
```

Saves file to desktop. 

Filename is either a type (by extension) `'treb'`, `'json'`, `'csv'`, `'tsv'`
or a full filename `'xyz.treb'`. defaults to `'treb'`.

`'json'` uses the native format but saves with a `.json` extension. 

If only the extension is provided, the filename will be the document name 
(moderately sanitized).

CSV/TSV only support one sheet, so the currently active sheet is exported.

```
EmbeddedSpreadsheet.ExportDelimited(options)
```

Returns CSV/TSV as string. 

Options is an object with optional properties:

 - `delimiter`: either `','` or `'\t'` (default `','`)
 - `formulas`: set `true` to export formulas; `false` to export values (default `false`)
 - `sheet`: sheet name or 0-based index to export (default active sheet)
 
 



