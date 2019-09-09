
Issues
======

 + entering pinyin is broken, something to do with how we are constructing
   elements in the ICE/formula editor.

Done
====

 + first-calc recalc. we use cached values from the source file, but they
   are marked as dirty so they recalc on the first sheet calc, even if they
   are not volatile (they should not).

