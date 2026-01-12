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
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */


import { SpreadsheetConstructor } from './spreadsheet-constructor';
import type { EmbeddedSpreadsheet } from '../embedded-spreadsheet';

// this is conditional so we can use it in front-end bundlers
// that build server-side. on the server side, HTMLElement and 
// customElements may not be defined. we could shim them... but
// that doesn't seem like a good idea.
//
// the primary drawback of this approach is that we can't export
// the type, although we could do that manually.

if (typeof HTMLElement !== 'undefined') {

  /**
   * this is the custom element. we have a two-class structure because
   * we want to support (1) custom elements, (2) the API method, and 
   * (3) headless instances. 
   */
  class TREBElement extends HTMLElement {

    /** access the embedded spreadshet object via the element */
    public get sheet(): EmbeddedSpreadsheet|undefined {
      return this.instance.sheet;
    }

    /** 
     * instance of the constructor class 
     */
    protected instance: SpreadsheetConstructor;

    constructor() {
      super();
      this.instance = new SpreadsheetConstructor(this);
    }

    public connectedCallback() {
      this.instance.AttachElement();
    }

  }

  if (typeof customElements !== 'undefined') {
    if (customElements.get('treb-spreadsheet')) {
      console.info(`custom element treb-spreadsheet is already defined.`);
    }
    else {
      customElements.define('treb-spreadsheet', TREBElement);
    }
  }

}
