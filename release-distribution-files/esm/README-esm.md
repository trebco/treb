
# ES module

This directory is provided to make it easier to consume TREB as an 
es module, particularly if you are using a front-end framework.


## Why is the ES module larger than the JS module?

Traditionally, we split import/export functions (functions that operate
on XLSX files) into a separate worker module which is loaded on demand.
If you are using the JS module as a web resource, we locate the worker 
script using the path to the base script.

That doesn't necessarily work if you are using a bundler, which
is commmon with front-end frameworks. It's possible to manually place the 
worker script in a public asset directory, and set the path, but that makes
it much more difficult to import the library.

So as of version 21.2, we're including the import/export worker in the 
MJS file as a blob, and loading the worker from that blob as necessary.


## The ES module does not embed CSS

The JS module embeds CSS -- styles are attached to the document when
the JS module is loaded. 

The ES module does not embed CSS, to better support strict CSP settings. So if you use the ES module, you must separately include the stylesheet, either in your HTML or using your front-end framework.


# How to use the ES module

You can consume the `esm/` directory from the download as a module. It 
includes typings so you can get type hints in your editor.


## Example: svelte

Here's an example using the ES module in a svelte or svelte-kit app:

1. Add the ES module using npm/yarn/pnpm. Point directly to the `esm/` directory:

```sh
> npm add -D file:path/to/treb/esm
```

2. Import the TREB global instance and the stylesheet; then call
   `CreateSpreadsheet`.

```html

<script lang="ts">

import { onMount } from 'svelte';

// import TREB module
import { TREB } from 'treb';

// import styles
import 'treb/treb-bundle.css';

let container: HTMLElement;

onMount(() => {

  sheet = TREB.CreateSpreadsheet({
    container,
    // ...other options...
  });

});

</script>

<div bind:this={container}></div>


```

## Example: plain HTML/javascript

If you are writing straight HTML, you can use the ES module and stylesheet as standard resources:

```html
<!DOCTYPE html>
<html>
  <head>
    
    <link rel='stylesheet' href='/path/to/treb/esm/treb-bundle.css'>
    <script type='module'>

// import module
import { TREB } from '/path/to/treb/esm/treb-bundle.mjs';

// run this when the DOM is complete
document.addEventListener("DOMContentLoaded", () => {

  // get the node
  const container = document.querySelector('.spreadsheet');

  // call CreateSpreadsheet with the container node and
  // any other options (see docs for options)
  TREB.CreateSpreadsheet({ container });

});
      
      </script>
  </head>
  <body>

    <div class="spreadsheet"></div>

  </body>
</html>
```



