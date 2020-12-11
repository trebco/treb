
This version of scale is much better. it renders better (not using scale), it
supports legacy layout (I think), requires many fewer code changes (and some
of those are improvements regardless), and has fewer weird corners.

Basically in this version we scale all calls to read column width/row height,
and scale fonts when rendering tiles. everything else (except annotations)
then falls into place pretty easily.

checkbox required a bit of work -- it would be easier if that were SVG and 
scaled via em size, as of now it's getting fuzzy.

TODO:
----

UI for scale
cleanup all the X functions
ICE layout, some extra pixels in there? bounces a little
update annotations on scale/rescale: not pixel-perfect (see note in code)
handle annotation move/resize: same
Q: Carry scale with file? (...) maybe non-binding reco? (...)

Done
----

API for scale (API function, init option)
freeze? check
handle annotation move/resize {+move}
row-header width, column-header height (+ corner size)
ICE (font size, layout is ok)
scale annotations
update annotations on scale/rescale
font metrics in tile render
datavalidation
legacy layout










