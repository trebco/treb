
Co-editing or shared editing
============================

If two viewers are on the same sheet, we can use the command queue/command 
log to coordinate editing. that seems to work well, provided you don't get
into an endless loop (just don't re-queue the commands).

But that doesn't work for different sheets, because (ATM) command queue 
messages assume you're on the active sheet.

It seems like the best approach would be to handle sheet ID properly in
command queue. That's centralized, and probably not too difficult. Then 
we could use it for everything in coediting.

There might be another issue with inferred areas -- things like clear -- 
which target the current selection. For those we will need to put a specific
range into the command.


Data?
----

Here's an issue: RAND() (et al). this function will show different values
in different remote views. Essentially, there's no master calculator.

This is not solvable with our current scheme, we need to think about how
to share calculated state. 

A: share calculated state?
then you need a defined master/main -- maybe useful for other things as well.
also we should probably try to send deltas if possible
