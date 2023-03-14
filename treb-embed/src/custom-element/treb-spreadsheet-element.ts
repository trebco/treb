
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
