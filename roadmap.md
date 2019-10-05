
One of the nice things about the monorepo is that we can centralize on a single
todo list, instead of scattering among projects.

## TODO

### multisheet issues/pending

 + selecting cells in other sheets when entering formula **important**

 + rewrite formula in other sheets when inserting/deleting rows/columns
 + rewrite formula in annotations when inserting/deleting rows/columns
 + cut and paste in different sheets (what is the desired behavior?)
 + add/remove sheet does not run through exec command
 + toggle tab bar in embedded sheet? (...)

### grid/sheet

 + redo
 + move annotations on structure events (like "move and size with cells")
 + shift simulation results (in calculator) on structure events

 + document create/reset does not (?) run through command/exec system
 + annotation create/delete/update does not (?) run through command/exec system

### meta

 + export modules
 + clean up dependency structure so format is easier to reuse

 + rollup? initial testing was mixed, although it's definitely fast. have to
   explore IE11 support.

## Done

 + named ranges
   - needs to be accessible to sheet for context highlighting
   - needs to be accessible to calculator for function resolution
   - (the above two suggest putting it in the 'sheet' object)
   - needs to adjust for add/remove rows/columns

 + multisheet
   - support changing sheet names
   - rewrite formula when changing sheet names
   - re-order sheets
   - delete sheets: ctrl+delete (not optimal)

