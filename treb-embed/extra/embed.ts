/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * this is a (new) separate script for embedding spreadsheets with a 
 * single tag. it's not part of any module, it needs to be compiled 
 * manually and written to the "distribution" folder (in parent).
 * 
 * note that this module is meant to run _immediately_, not on any event.
 * all it does is replace a script node (itself) with a div target for
 * later auto-embedding.
 * 
 * note that this requires the auto-embed to trigger on readystatechange
 * in addition to (or instead of) DOMContentLoaded. which it does, as of 
 * version 10.4.0.
 * 
 * for the time being:
 * ```
 * npx tsc
 * node_modules/.bin/terser embed.js > ../disttribution/embed.js
 * ```
 * 
 * note that we can't pipe atm, tsc won't output to stdout, see
 * https://github.com/microsoft/TypeScript/issues/1226
 * 
 * 
 * [TODO: compiler]
 */

(() => {

  // add TREB scripts (if necessary)

  // should we perhaps be a little smarter and look at the actual script
  // file name? the only time that would come up is if we had both types
  // of embedding at the same time (and even then it would probably only
  // load once)

  if (!document.head.querySelector(`[data-reference=treb]`)) {

    // find a reference to _this_ script (presumably, although there are 
    // some edge cases where this would be a different reference)

    let script = document.querySelector('script[data-treb]') as HTMLScriptElement;

    if (script) {
      
      const base = (script.src||'').replace(/[^/]+\.js[^/]*?$/i, '');

      script = document.createElement('script');
      script.setAttribute('type', 'module');
      script.setAttribute('data-reference', 'treb');
      script.setAttribute('src', base + 'treb-bundle.js');
      document.head.appendChild(script);

      /*
      script = document.createElement('script');
      script.setAttribute('type', 'text/javascript');
      script.setAttribute('data-reference', 'treb');
      script.setAttribute('src', base + 'treb-bundle-es5.js');
      script.setAttribute('nomodule', 'true');
      document.head.appendChild(script);
      */
     
    }

  }

  // just in case, do this for every matching script you find

  const scripts = document.querySelectorAll('script[data-treb]');

  if (scripts) {
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i] as HTMLScriptElement;
      if (script.parentElement) {
        const div = document.createElement('div');
        for (const key in script.dataset) {
          div.dataset[key] = script.dataset[key];
        }
        for (const key of ['class', 'style']) {
          const value = script.getAttribute(key);
          if (value) {
            div.setAttribute(key, value);
          }
        }
        script.parentElement.replaceChild(div, script);
      }
    }
  }

})();
