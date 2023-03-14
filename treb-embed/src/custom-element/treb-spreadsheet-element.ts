
import { SpreadsheetConstructor } from './spreadsheet-constructor';
import type { EmbeddedSpreadsheet } from '../embedded-spreadsheet';

export { TREB } from './treb-global';

declare global {   
  interface HTMLElementTagNameMap {
   'treb-spreadsheet': TREBElement;   
 } 
}

/**
 * this is the custom element. we have a two-class structure because
 * we want to support (1) custom elements, (2) the API method, and 
 * (3) headless instances. 
 * 
 */
class TREBElement extends HTMLElement {

  /** access the embedded spreadshet object via the element */
  public get sheet(): EmbeddedSpreadsheet|undefined {
    return this.instance.sheet;
  }

  /** instance of the constructor class */
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
  customElements.define('treb-spreadsheet', TREBElement);
}

