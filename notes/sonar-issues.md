Outstanding issues from a Sonar (SonarQube) scan of the build output. The 
scan runs against the bundled/minified .mjs files in dist/, not the source, 
so some findings are artifacts of minification.

To check locally:

 - `npm run lint:sonar` runs eslint-plugin-sonarjs against TS source
 - `npm run lint:sonar-dist` runs it against dist/*.mjs (build first)

Both use eslint.sonar.config.js, which is separate from the main eslint 
config. The rule set is large; look for the specific rules below.

Resolved:

 - S1219 (no-case-label-in-switch): `validation_loop` label in GridBase 
   InsertTable command. Replaced with `valid` in both loop conditions.

 - S3516 (no-invariant-returns): Editor.SubstringToCaret2. Early exit now
   returns a literal.

Still TODO:

 - S3516 (no-invariant-returns): Parser.ConsumeArray 
   (treb-parser/src/parser.ts, returns at 2067 and 2095)

    False positive from minification. The rule only recognizes an object 
    mutation if the assignment is its own statement; the minifier folds 
    `expression.values[row] = ...` into comma/&& expressions, so the rule 
    thinks `expression` is never modified. Source is not flagged.

    The rule requires at least two returns, so a fix is to remove the early
    return. Note the early return (case CLOSE_BRACE) is inside a switch 
    inside the while loop, so `break` won't do it; use a flag in the while 
    condition. index is already incremented before the switch, so state 
    matches the current early return.

 - S128 (no-fallthrough): three intentional fall-throughs, all commented in
   source. Sonar accepts a "fall through" comment (matches eslint's 
   /falls?\s?through/i) but comments are stripped by the bundler.

    - treb-grid/src/editors/formula_bar.ts:568, case 'Enter' falls into 
      case 'Tab' (unless alt). Hardest to fix, the Tab block is shared; 
      would need to move it to a method.

    - treb-grid/src/editors/external_editor.ts:121, case '/' falls into 
      default (unless ctrl). Easy: `if (ctrlKey) break; return;`.

    - treb-calculator/src/utilities.ts:368 (ParseWildcards), case '~' falls
      into default. Small: advance, then share the escape logic.

 - S128: the report listed 4 fall-throughs, but only 3 exist in the current
   (split) build. Not located. The scanned build may have been unsplit 
   (`npm run alt`) or an older version; try linting that output.

 - S1119 (no-labels, not in the original report): redundant `inner_loop:` 
   labels in column-name dedupe. `break inner_loop` is the same as `break`
   here, so the label can just be removed.

    - treb-grid/src/types/grid_base.ts:1499
    - treb-export/src/export.ts:1400

Note on counts: the report had 2 label flags and 4 invariant-return flags 
vs 1 and 2 in our build. That matches the shared chunk being duplicated into
both treb-spreadsheet.mjs and treb-export-worker.mjs, as in an unsplit 
build. It doesn't explain the 4th fall-through (doubling would give 5).

Unrelated, found along the way:

 - treb-calculator/src/functions/finance-functions.ts:539, leftover debug
   `console.info` in the RATE solver loop (logs every iteration).

