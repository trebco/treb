
import { CompositeSheet } from './composite-sheet';

interface DecoratedHTMLElement extends HTMLElement {
  _spreadsheet: any;
}

export class AutoEmbedManager {
  
  /** auto-embed */
  public static Run() {

    const elements = document.querySelectorAll('div[data-treb]');

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

      const sheet = CompositeSheet.Create(options);

      // optional load callback
      const load = options.load || dataset.load;
      if (load) {
        const aself = (self as any);
        if (aself[load]) {
          aself[load](sheet, element); // callback wants sheet, not embed
        }
        else {
          console.warn(`function ${load} not found`);
        }
      }

    }

  }

}
