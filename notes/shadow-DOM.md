
### Note on shadow DOM
Date: March 4 2023

---

I spent the last couple of weeks building TREB as a custom element using 
shadow DOM. 

The benefits of shadow DOM would be tremendous, particularly style isolation.
But ultimately there are just too many things broken for this to be practical
as of today (March 2023). We can revisit in the future.

### Selection

Selection behaves differently in various browsers. Specifically the issue 
arises when we try to get the current selection. We primarily use selections
when typing spreadsheet formula. This happens in either the formula bar or
the overlay editor (replacement for the old in-cell editor). 

We typically check the selection in order to get the caret position. We use 
the caret position and the entered text to highlight references in formulas
and to insert references when mouse-selecting.

#### Cross-browser selection

The standard way to get the selection, in light DOM, is `Window.getSelection`.

In Firefox this still works in shadow DOM. It does not work in Chrome, but 
they add a nonstandard method to the shadow root so `ShadowRoot.getSelection` 
works instead.

Safari supports neither. We can hack our way around this in Safari using the
`beforeinput` event, which will give you the selection on a particular 
component. We wrote a helper class that would allow you to get the selection
by sending an event to the component and then blocking any component update,
but collecting the selection from the event.

That Safari fix required making our `GetSelection` method asynchronous, which
changed a lot of code paths but which was ultimately not a huge problem.

#### Potential resolution

We could live with our workaround. There is a proposal for a standar fix,

https://github.com/WICG/webcomponents/issues/79

but that proposal is already 8 years old and shows no sign of moving.

### Focus/typing

Focus and typing was the big blocker. For the most part this seems to work
correctly in Chrome. Safari was not fully investigated. Firefox is completely
broken.

Among other things, Firefox doesn't support changing selection between light
DOM and shadow DOM elements:

https://bugzilla.mozilla.org/show_bug.cgi?id=1685300
https://bugzilla.mozilla.org/show_bug.cgi?id=1496769

That results in the cursor not showing up, or the text not being editable, or
the element not being selectable at all.

This bug is 5 years old, the latest comment is ~8 months old at this point 
and there doesn't seem to be any movement on it.

Additionally some elements would randomly change to RTL when editing text. I 
couldn't find a bug tracking this and did not fully investigate, but setting
standard properties (`dir` attribute, `direction` style property) would not 
resolve this issue.

















