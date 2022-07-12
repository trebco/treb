/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import type { DecoratedHTMLElement } from './composite-sheet';

export class AutoEmbedManager {
  
  /** attach to DOM events */
  public static Attach(attr: string, factory: (...args: any[]) => any): void {

    document.addEventListener('DOMContentLoaded', () => this.Run(attr, factory));

    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'complete') {
        this.Run(attr, factory);
      }
    });

  }

  /** auto-embed */
  public static Run(attr: string, factory: (...args: any[]) => any): void {

    // const elements = document.querySelectorAll('div[data-treb]');
    const elements = document.querySelectorAll(`div[${attr}]`);

    for (let i = 0; i < elements.length; i++) {

      const element = elements[i] as DecoratedHTMLElement;
      if (element._spreadsheet) { 
        continue; // already attached
      }

      const dataset = element.dataset || {};

      const options: any = {
        container: element,
        network_document: dataset.treb || undefined,
      };

      // dropping old-style options, they've been deprecated for a while

      const options_list = dataset.options;
      if (options_list) {
        const pairs = options_list.split(/,/g);
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key) {
            if (typeof value === 'undefined') {
              options[key] = true;
            }
            else if (/^(?:true|false)/i.test(value)) {
              options[key] = (value.toLowerCase() !== 'false');
            }
            else if (!isNaN(value as any)) {
              options[key] = Number(value);
            }
            else {
              options[key] = value;
            }
          }
        }
      }

      //const sheet = CompositeSheet.Create(type, options);
      const sheet = factory(options);

      // optional load callback
      const load = options.load || dataset.load;
      if (load) {
        const func = (self as any)[load] as (sheet: any, element: HTMLElement) => void;
        if (func) {
          func(sheet, element); // callback wants sheet, not embed
        }
        else {
          console.warn(`function ${load} not found`);
        }
      }

    }

  }

}
