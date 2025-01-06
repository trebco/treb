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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */


export const attrs = Symbol('attrs');
export const text = Symbol('text');

export interface xml_node {
  [attrs]?: Record<string, string>;
  [text]?: string;
  [index: string]: xml_node|xml_node[]|string|string[]|number|number[];
}

export const root: xml_node = {

  [attrs]: { "zim": "zam", },

  jim: {
    [text]: "fish",
  },

  fish: "fish",

  tacos: [
    {
      [text]: "al pastor",
    },
    {
      [text]: "carnitas",
    },
  ],

};

export const ParseIt = (node: xml_node) => {

  if (node[attrs]) {
    // ...
  }
  if (node.gonas) {
    if (Array.isArray(node.gonas)) {
      // 
    }
    else {
      const t = typeof node.gonas;
      console.info(t);
    }
  }

};
