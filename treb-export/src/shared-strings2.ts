
import {XMLUtils} from './xml-utils'; 

export class SharedStrings {

  public strings: string[] = [];
  public reverse: Record<string, number> = {};

  /** read strings table from (pre-parsed) xml; removes any existing strings */
  public FromXML(xml: any) {

    // clear

    this.strings = [];
    this.reverse = {};

    let index = 0;

    for (const si of XMLUtils.FindAll(xml, 'sst/si')) {

      // simple string looks like
      //
      // <si>
      //   <t>text here!</t>
      // </si>

      if (si.t) {
        this.strings[index] = si.t;
        this.reverse[si.t] = index;
      }

      // complex string looks like
      //
      // <si>
      //   <r>
      //     <rPr>(...style data...)</rPr>
      //     <t>text part</t>
      //   </r>
      // </si>
      //
      // where there can be multiple r tags with different styling.
      // since we don't support that atm, let's drop style and just
      // collect text.

      else if (si.r) {
        const parts = XMLUtils.FindAll(si.r, 't');
        
        const composite = parts.map(part => {
          return (typeof part === 'string') ? part : (part.t$ || '');
        }).join('');
        
        this.strings[index] = composite;
        this.reverse[composite] = index;
      }
      else {
        console.warn(` ** unexpected shared string @ ${index}`);
        console.info(si);
      }

      index++;

    }
 
  }
  
  /** return a string by index */
  public Get(index: number): string|undefined {
    return this.strings[index];
  }

  /** find existing string or insert, and return index */
  public Ensure(text: string): number {

    let index = this.reverse[text];
    if (typeof index === 'number') {
      return index;
    }

    index = this.strings.length;
    this.strings.push(text);
    this.reverse[text] = index;
    return index;
    
  }


}