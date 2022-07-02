
I've been exploring how to make this a proper module, either esm module
or umd (via webpack). 

One problem with the umd module is that there's not going to be any reasonable
way to do the script path matching for loading workers. We will need another 
solution for that.

Another problem is the application is littered with references to DOM elements,
self, and document, which might not be available in scope. Needs cleanup, or 
a rethink? Maybe split core calc operations from UI? (...)

An ESM module just for the browser would still be good, but I can't figure out
how to get webpack to make one (and rollup has ts problems).


