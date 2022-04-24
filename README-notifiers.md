
Added a notification API to calculator. Ultimately this should get a public
API in the EmbeddedSheet class.

There are two issues not handled: insert/delete row/column, and undo. The 
former seems easy but the latter requires that we maintain state somewhere,
perhaps in the model or the view. 

Since we're not storing (meaning when we save the file) the notifiers, they
can be ephemeral in the view. 

Kind of tricky to manage vertices, to avoid circular deps. How does annotation
manage vertices? (...)

A: we have an opaque data store. not optimal, but it will avoid circular deps.
TODO/FIXME: move annotation out of grid?


