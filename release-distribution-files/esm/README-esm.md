
# ES module

This directory is provided to make it easier to consume TREB as an 
es module, particularly if you are using a front-end framework.


## Why is the ES module larger than the JS module?

Traditionally, we split import/export functions (functions that operate
on XLSX files) into a separate worker module which is loaded on demand.
If you are using the JS module as a web resource, we locate the worker 
script using the path to the base script.

That doesn't necessarily work if you are using a bundler, which
is commmon with front-end frameworks. It's possible to manually place the 
worker script in a public asset directory, and set the path, but that makes
it much more difficult to import the library.

So as of version 21.2, we're including the import/export worker in the 
MJS file as a blob, and loading the worker from that blob as necessary.


## The ES module does not embed CSS

The JS module embeds CSS -- styles are attached to the document when
the JS module is loaded. 

The ES module does not embed CSS, to better support strict CSP settings. So 
if you use the ES module, you must separately include the stylesheet, 
either in your HTML or using your front-end framework.


# How to use the ES module

See README.md in this directory.

