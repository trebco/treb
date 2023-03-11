import { SpreadsheetConstructor } from './spreadsheet-constructor';
import type { EmbeddedSpreadsheet } from '../src/embedded-spreadsheet';
import type { EmbeddedSpreadsheetOptions } from '../src/options';

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

customElements.define('treb-spreadsheet', TREBElement);

/** FIXME: switch to class (and move to its own file) */
export const TREB = {

  version: process.env.BUILD_VERSION,

  /**
   * matches the old API
   */
  CreateSpreadsheet: (options: EmbeddedSpreadsheetOptions) => {
    const container = options.container;
    const instance = new SpreadsheetConstructor(container);
    instance.AttachElement();
    return instance;
  },

};