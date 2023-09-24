conditional formatting TODO list

 - import/export 

 - run through the command queue

 - dragging selection knob should expand conditional formats
   (if you have the whole thing selected). at the moment it
   seems to be hard-copying the format, which is bad.

---

done
 
 - consolidate expression and cell-match types, in the sheet part,
   handle arrays and single cells

   note that these are now essentially the same thing, with a small
   difference when we attach the conditional format to the graph. so 
   we could combine them. but, because there's a hard distinction in 
   XLSX, we will probably need to keep track of which is which.

 - if you do the above you can remove the "applied" flag

 - update range (and formula) based on insert/delete row/col
   (+ sheet name change)

 - use a gradient function

