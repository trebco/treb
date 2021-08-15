
Translation (I18n)
------------------

Thinking about i18n, and how to translate. We already handle decimal-separator
issues.

1. Files should be in canonical (english) format.
 
This is not what we do for decimal separators. The rationale is that we can 
translate from english to any language and back, given a language file, but 
if we don't have a particular language file then we can't do it. That means 
that we either have to ship every language file to every instance, or store
files in canonical format and then only translate as necessary, when we have
the language file.

2. Q: if you are editing in a different language, can you use english names?

Not sure. Certainly this would be the default if there's a missing entry in
a language file, but otherwise, does this just confuse things? Is there any
possibility of collision? (Note we only have to worry about collisions with
canonical/english, not cross-language collitions).

3. Implementation

 a. When viewing a cell (in the formula bar), translate to local language

 b. When editing a cell in the ICE, translate to local

 c. On commit, translate to canonical (but still display local)

 d. Autocomplete/tooltips

 e. Messages/dialogs

Except for (d) and (e), these are pretty simple -- two-way maps should make
this trivial. Write some functions `ToCanonical`, `FromCanonical` that take 
parse trees and a language map (based on a language file). 

Tooltips and AC are updated via a method call, so that's the place to inject
language-specific data.

Messages are not organized, so that's the most difficult one. Messages are 
probably (mostly) contained in grid/embed, but we need to look at other libs
to see if they include any messages.


