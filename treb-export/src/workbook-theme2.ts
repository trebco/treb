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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { XMLUtils } from './xml-utils';

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

  public FromXML(xml: any): void {

    const tag = Object.keys(xml)[0];

    let namespace = '';
    const match = tag.toString().match(/^(.*?):/);

    if (match) {
      namespace = match[1] + ':';
    }

    if (xml[tag] && xml[tag][`${namespace}themeElements`]) {
      const color_scheme = xml[tag][`${namespace}themeElements`][`${namespace}clrScheme`];

      for (const name of Theme.color_map) {
        const element = color_scheme[`${namespace}${name}`];

        let value: string | undefined;
        let type: 'rgb'|'system' = 'rgb';

        if (element[`${namespace}srgbClr`]) {
          type = 'rgb';
          value = element[`${namespace}srgbClr`].a$.val || '';
        }
        else if (element[`${namespace}sysClr`]) {
          type = 'system';
          value = element[`${namespace}sysClr`].a$.lastClr || '';
        }

        this.colors[name] = {name, value, type};

      }
    }

  }

}
