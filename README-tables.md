
Looking at tables, there's an obvious question: are tables "hard" or "soft"?

Meaning, if you sort a table, does that change the values in the underlying
cells, or does it simply add a note that cells in the table are sorted?

From the XLSX file, it looks like the answer is "both". There is a table object,
which includes layout and sort information; but if you sort, the actual cell
values are moved around. So tables are "hard" from the POV of values.

Styling seems to be owned by the table object, meaning it's not applied to
the cells. At least from what I can tell, although I've seen some strange
behavior when resizing tables. But generally it looks like tables are "soft" 
from the POV of styling -- at least background/border styling.

...

This turns out to be kind of nice from an implementation perspective. If the 
values are "hard" managed, then no changes need to be made to any value lookup
functions when using a table.

Rendering will have to look at the table object and figure out what to do, 
though. I think if there is a table object, it will override border and 
background. Background will have to count (visible) rows/columns if there are
alternating colors.




