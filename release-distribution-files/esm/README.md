
# TREB

https://treb.app

TREB is a spreadsheet component you can embed in web pages, web apps, or blogs.

This is the ES module version. It's intended for quick integration with 
front-end frameworks.

## Installing

Install with npm/yarn/pnpm.

```sh
> npm install --save @trebco/treb
```

## Stylesheet

Note that the library does not automatially load the stylesheet it needs to 
render properly (we do this for sites/apps that have strict CSP settings). So
you need to load the stylesheet, either via `import` in your front-end 
framework or by just including the stylesheet in your HTML.

## Using 

Here's how to add a spreadsheet in a couple of frameworks:

### Svelte (and svelte-kit)

```html
<script lang="ts">

// import the onMount handler from svelte
import { onMount } from 'svelte';

// import TREB module
import { TREB } from 'treb';

// import stylesheet
import 'treb/treb-bundle.css';

// reference to the HTML node we will use to mount the spreadsheet
let container: HTMLElement;

onMount(() => {

  // create spreadsheet, passing a reference to the container node
  TREB.CreateSpreadsheet({
    container,
  });

});

</script>

<!-- this is the node where we will add the spreadsheet -->
<div bind:this={container}></div>

```

### React


```tsx
import React from 'react';

// import TREB module
import { TREB } from 'treb';

// import TREB stylesheets
import 'treb/treb-bundle.css';

class SpreadsheetComponent extends React.Component {

  // reference to our DOM node
  public container: React.RefObject<HTMLDivElement>;

  constructor(props) {
    super(props);

    // create ref to DOM node
    this.container = React.createRef();
  }

  public componentDidMount() {
    // create spreadsheet, passing reference to the container node
    TREB.CreateSpreadsheet({ 
      container: this.container.current,
    });
  }

  public render() {
    return (
      <div ref={this.container}></div>
    );
  }
}

export default SpreadsheetComponent;
```

### Vanilla javascript

There are other ways to embed TREB spreadsheets in vanilla javascript and 
HTML. This is an example specifically for the ES module. See the docs for 
other options.

```html
<html>
  <head>
    
    <!-- include stylesheet -->
    <link rel='stylesheet' href='/path/to/treb-bundle.css'>
    <script type='module'>

// import from esm
import { TREB } from '/path/to/treb-bundle.mjs';

// run this when the DOM is complete
document.addEventListener("DOMContentLoaded", () => {

  // get the node
  const container = document.querySelector('.embedded-spreadsheet');

  // call CreateSpreadsheet with the container node
  TREB.CreateSpreadsheet({ container });

});
      
      </script>
  </head>
  <body>

    <!-- we will use script to insert the spreadsheet in this div -->
    <div class="embedded-spreadsheet"></div>

  </body>
</html>
```

## More

For documentation on using TREB and the API see our website at https://treb.app.




