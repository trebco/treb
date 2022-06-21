
# Co-editing or shared editing

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

One last thing: undo isn't passed through the command queue, and it's 
applied differently. Need to figure out a way to get this to remotes.

## Data?

Here's an issue: RAND() (et al). this function will show different values
in different remote views. Essentially, there's no master calculator.

This is not solvable with our current scheme, we need to think about how
to share calculated state. 

A: share calculated state?
then you need a defined master/main -- maybe useful for other things as well.
also we should probably try to send deltas if possible

UPDATE: seems to work pretty well. we add two functions to calculator: 
`ExportCalculatedValues` and `ApplyCalculatedValues`. along with some calls to
repaint and update annotations, works great. also you should set calculation
to manual for "followers" (i.e. not "leader").

One remaining issue is if one of the followers hits recalculate, it calculates
locally instead of remote. we need to trap that and send a message.


## Notes

Add sheet -- remote should not change sheets (handled with an additional
parameter, which can be set when passing to the queue)

Annotations -- moving, resizing (adding? deleting?) aren't running through
the command queue, so they're lost.

Dragging the nub to fill in a pattern does not run through queue, doesn't 
broadcast

~~Paste doesn't broadcast~~ actually paste is fine -- it generates a large 
number of events, which could be consolidated, but not the end of the world

HOWEVER, paste is generating unnecessary style events? (not pruning)

If you create a new sheet, we can't necessarily guaranteee that it will 
get the same ID in main/remote. this is a problem because if the IDs diverge,
every subsequent operation will be out of sync.

Maybe remotes should set calculation -> manual (if that works) and then have
some scheme for having the main instance broadcast calculated values (or deltas)

# Update June 2022

Everything in coediting works reasonably well, except (1) annotations aren't
covered by the command log, and (2) using a leader client to calculate is too
slow for follower clients.

The first issue can be resolved (and annotations do generate events) but to
solve the second issue I think we need to be able to calculate on the server,
which requires some unwinding to get running in a node environment.

ATM I'm splitting grid so we can have a "null" grid, with no UI, suitable for
the server.


