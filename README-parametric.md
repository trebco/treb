
Building parametric modeling support into TREB, which also serves
the purpose of adding "named values" or "named expressions".

We currently have named ranges, which refer expressly to ranges, and
macro functions, which map from names -> functions.

What we want are more general than named ranges but not functions -- just
expressions, where the expression might be a simple value but could also
be an expression.

## Option 1: Hidden sheet

You could use existing systems with a hidden sheet and then treat named
expressions as named ranges pointing to that sheet. If you don't need support
in a spreadsheet, but just in a parametric tool, then the sheet doesn't even
need to be hidden -- just use Sheet1.

This feels sloppy though. Also you run into the problems of picking which 
cell to use when adding a new name, and cleaning up when you remove names.
Still, it would work basically out-of-the-box.

## Option 2: Implicit sheet

Another thing you could do is use a new construct that works like a sheet, 
but instead of addresses uses names -> values (expressions). This would work
like a sheet for purposes of calculation, but would have no visible 
representation. 

The drawback is that it requires a lot of changes to how the graph is 
calculated; a lot in there is implicitly based on the row/column address 
structure. 

The benefit of this (and the previous solution) is that they participate in 
the propogation of calculation changes. OTOH, that might not be a requirement.

Additional note: if we are not using the spreadsheet, we could theoretically
write a subclass of Calculator which works with a different type of 
DataModel -- that might be easier than trying to create the hybrid version,
particularly since the name-lookup model is really simple.

## Option 3: Just a lookup table

The simplest option is just another lookup table, like named ranges and macros,
which maps name -> expression. For purposes of calculation this should work
reasonably well; the only thing it won't do is update automatically like a 
cell value would, but that might not be necessary.

This means that values would always need to be calculated as expressions, 
instead of just being able to look up the value. Meaning that if you have 

`
A = 2
B = A + 1
`

there's no way to just look up the value of B; you have to calculate the 
expression every time. This is probably fine for most purposes but if you had
something like a CAD model it could get really expensive.

## Development

Because option (3) is the easiest, that's probably the best way to start. 
There's nothing that would prevent us from switching later to option (2) or
something else, if we wanted to do the work.

## Parser support

As part of this we want to make a small change to the parser to _remove_ 
support for spreadsheet addresses -- this is so we can override symbolic
names that would otherwise map to addreses. That part should be small.

We might also want to add support for units, which is more complicated.
Consider parametric CAD modeling, where you see things like

```
D1 = 3mm
D2 = 2 * D1 + .0254"
```

Generally speaking this looks like implicit multiplication (i.e. `3mm` 
means `3 * mm` where we treat mm as an identifier). That's just not supported
in the current parser but it's not a huge leap. Also symbolic units like
`"` and `'` will require changes to the identifier logic because atm that
only supports ascii-letter characters (I think).

Clients can do actual management and conversion of data with units. 


