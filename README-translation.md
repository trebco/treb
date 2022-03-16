
# Overview

Regarding translation of function names: we want the data, the actual file,
to use a consistent or common name format. For my purposes it makes sense
for this to be in English.

The reason is that there are potentially lots of languages/translations, and
we don't want to carry all of them around. Sheets should only be translated
(presented in your local language) if you specifically load that language. If
the language isn't available, the spreadsheet should still work, just in the
default language (English).

That means that translated names are ephemeral. If you are working in a 
non-english language, when you enter a function in a cell it should get 
translated to english. When you view that function, it should be translated
(for rendering and editing purposes) into the local language.

Q: Do English language function names work in non-english languages? If so, 
   when you enter an english-language function in a formula, is it translated?
   (that would be implicit given what I've described above, unless the function
   is marked in some way).

NOTE: API functions (SetRange comes to mind) need to play along as well...
NOTE: Annotation functions need to comply...

# Implementation

A good spot for this might be `Grid.NormalizeCellValue`, as it's called before
editing.

The other side (parsing) should be in `Grid.SetRangeInternal`, because that's
called when editing and from the API. The only potential issue here is it's 
going to be stored in the command queue prior to translation... when is not 
necessarily what we want... we probably need to translate earlier in the call.

For the time being let's do it in `SetRangeInternal`, and it can move out once
it's working properly.

...time passes...

# Review

Seems to work well, except that we are translating in `SetRangeInternal`, as 
noted, and that needs to move. 

One thing I missed is we need to update the AC and tooltips when language 
changes. Also the current API doesn't allow for translated tooltips.

Actually, that's OK as far as grid goes because grid only needs to know about
the names. AC functions are set by the embedded spreadsheet class, so fuller
translation can happen in there, then call the grid method with just the names.
So the grid API can stay as-is.

# TODO

 - translation files, what do they look like, how do they reference the 
   original function? I think it will be JSON, basically the output of 
   `Calculator.SupportedFunctions, with an additional field indicating the 
   function that any element is replacing.

   have an interface for this now; still needs UI and number format, but 
   has a place for the function descriptors. function descriptors use the 
   AC descriptors as a base.

 - we may need to add translation to the `DefineMacro` routine, translating
   the function you define -> common. not sure.

   ...probably (TODO).

 - how to load/where to store? should probably be individual JSON files with
   well-defined names by locale. we could have a common location, but also
   allow custom definition.

 - we'll need a similar translation system for symbolic number formats
 - not to mention the UI

