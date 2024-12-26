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

import { XMLUtils, attrs, text, type XMLNode } from './xml-utils';

export interface ColorSchemeElement {
  name?: string;
  value?: string;
  type?: 'rgb'|'system';
}

export class Theme {

  // where is this defined?
  public static color_map = [
    'lt1', // bg 1
    'dk1', // text 1
    'lt2', // bg 2
    'dk2', // text 2
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ];

  public colors: {[index: string]: ColorSchemeElement} = {};

  // private dom?: ElementTree.ElementTree;

  public FromXML(xml: XMLNode): void {

    const tag = Object.keys(xml)[0];

    let namespace = '';
    const match = tag.toString().match(/^(.*?):/);

    if (match) {
      namespace = match[1] + ':';
    }

    const scheme = XMLUtils.FindAll2(xml, `${tag}/${namespace}themeElements/${namespace}clrScheme`)[0];
    if (scheme) {
      for (const name of Theme.color_map) {
        const srgbClr = XMLUtils.FindAll2(scheme, '${namespace}srgbClr')[0];
        const sysClr = XMLUtils.FindAll2(scheme, '${namespace}sysClr')[0];

        let value: string | undefined;
        let type: 'rgb'|'system' = 'rgb';

        if (srgbClr) {
          type = 'rgb';
          value = (srgbClr[attrs]?.val || '') as string;
        }
        else if (sysClr) {
          type = 'system';
          value = (sysClr[attrs]?.lastClr || '') as string;
        }

        this.colors[name] = {name, value, type};


      }
    }
    
  }

}
