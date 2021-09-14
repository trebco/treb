
Use of TREB is subject to license: see

https://treb.app/license

As of version 4.0.0, we are distributing both ES5 and ES6 versions (both
in the zip file). The simplest thing to do is just use the ES5 version:

```html

<script src="/path/to/embedded-treb-bundle.js" type="text/javascript"></script>

```

That will work in IE11 and all modern browsers. If you prefer to use the ES6
version, you can use `module` and `nomodule` tags to load the appropriate build
for any given browser:

```html

<script src="/path/to/embedded-treb-bundle-es6.js" type="module"></script>
<script src="/path/to/embedded-treb-bundle.js" nomodule type="text/javascript"></script>

```

This tells browsers that know about JS modules to load the ES6 version and
ignore the legacy version.  The benefit of the ES6 version is the files are a
little smaller, and should start faster in the browser.

Other than that everything is the same. Note that IE11 apparently requests both,
which is kind of wasteful, but only runs the ES5 version.

You only have to link to the main script. It will load the other scripts 
(workers and toolbar) when necessary, and it will use the matching version
(ES5/ES6).

---

Structured Data, LLC  
info@riskamp.com



