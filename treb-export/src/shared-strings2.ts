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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import { XMLUtils, type XMLNode, text, IsXMLNode } from './xml-utils'; 

export class SharedStrings {

  public strings: string[] = [];
  public reverse: Record<string, number> = {};

  /** read strings table from (pre-parsed) xml; removes any existing strings */
  public FromXML(xml: XMLNode) {

    // clear

    this.strings = [];
    this.reverse = {};

    let index = 0;

    for (const si of XMLUtils.FindAll2(xml, 'sst/si')) {

      // simple string looks like
      //
      // <si>
      //   <t>text here!</t>
      // </si>

      if (IsXMLNode(si.t)) {

        // seen recently in the wild, text with leading (or trailing) spaces
        // has an attribute xml:space=preserve (which makes sense, but was not
        // expecting it)
        //
        // <si>
        //   <t xml:space="preserve">    (Target portfolio lease rate based on internal estimate of average Canadian farmland rates)</t>
        // </si>
        //

        /*
        let base = '';
        if (typeof si.t === 'string') { base = si.t; }
        else if (si.t.t$) {
          base = si.t.t$;
        }
        */

        const base = si.t[text] as string || '';

        this.strings[index] = base;
        this.reverse[base] = index;

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

      else if (IsXMLNode(si.r)) {
        const parts = XMLUtils.FindAll2(si.r, 't');
        
        const composite = parts.map(part => {

          return part[text] as string || '';

          // return (typeof part === 'string') ? part : (part.t$ || '');
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

    if (text[0] === '\'') {
      text = text.substring(1);
    }
    
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