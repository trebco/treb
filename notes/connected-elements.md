

"Connected elements" refers to a new API that's intended to link things 
outside of the spreadsheet to the spreadsheet's graph and calculation events.

The canonical example is a chart that lives outside of the spreadsheet.
It should be updated any time the spreadsheet data changes. It should 
also gracefully handle layout modifications (change sheet name, insert/delete
rows/columns) as if it were inside the spreadsheet.

One thing about these is that they're ephemeral; they have no persistent 
representation in the data model. So you create them when you lay out your 
web page, and they only exist for the lifetime of that page.

Still TODO:

 - clean up junk (when?)
    As long as we remove the leaf nodes from the graph, it should be
    clean. 

 - deal with model rebuild (elements are getting orphaned here)
    I think this is handled? still maybe an issue on Reset()

 - API to update elements (e.g. change formula w/o removing)
    that last one could be implemented as remove/add, possibly 
    reusing the generated ID. at least as a first cut.

Done:

 - API to remove elements

 - rewrite formula on layout changes

Open Qs:

 - what happens if you completely flush the data model (reset, load new file?)

