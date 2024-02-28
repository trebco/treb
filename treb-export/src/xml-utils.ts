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

import { Unescape } from './unescape_xml';
import type { X2jOptions } from 'fast-xml-parser';

export const XMLTagProcessor = (name: string, value: string): string => Unescape(value);

export interface DOMContent {
  [index: string]: string|DOMContent|string[]|DOMContent[]|number|number[];
}

export const XMLOptions: Partial<X2jOptions> = {
  ignoreAttributes: false,
  attributeNamePrefix: '__',
  trimValues: false,
  textNodeName: 'text__',
  tagValueProcessor: XMLTagProcessor,
  ignoreDeclaration: true,
};

/**
 * group attributes under `a$`, and don't add attribute prefixes (should be 
 * implicit on that option, but hey).
 */
export const XMLOptions2: Partial<X2jOptions> = {
  ignoreAttributes: false,
  // attrNodeName: 'a$', // FXP v4
  attributesGroupName: 'a$',
  attributeNamePrefix: '',
  textNodeName: 't$',
  trimValues: false,
  ignoreDeclaration: true,

  // arrayMode: false, // this was removed in FXP, but false is default anyway

  isArray: (tagName: string) => {
    return /Relationship$/.test(tagName);
  },

  tagValueProcessor: XMLTagProcessor,
};

/**
 * some utility functions for working with the xml/json
 * objects we get from fast-xml-parser.
 */
export class XMLUtils {

  /**
   * @deprecated
   * 
   * use the array version. it will run in approximately the same
   * amount of time for non-array structures, and it's safer in the
   * event you have an array somewhere in the node hierarchy.
   */
  public static FindChild(root: any = {}, path: string) {
    const elements = path.split('/');
    for (const element of elements) {
      root = root[element];
      if (!root) { return undefined; }
    }
    return root;
  }

  /** 
   * the aim of this function is to handle the case where we don't
   * know where the arrays are -- any element in the path could be
   * multiple. for example, the path
   * 
   * a/b/c
   * 
   * could be reflected in xml as 
   * 
   * <a>
   *  <b>
   *   <c/>
   *   <c/>
   *  </b>
   * </a>
   * 
   * or it could be
   * 
   * <a>
   *  <b>
   *   <c/>
   *  </b>
   *  <b>
   *   <c/>
   *  </b>
   * </a>
   * 
   * in either case we want both "c" elements.
   */
  public static FindAll(root: any = {}, path: string): any[] {

    const components = path.split('/');

    // allow proper paths starting with ./
    if (components[0] === '.') {
      components.shift();
    }

    // don't allow going up the stack (we don't have it)
    if (components[0] === '..') {
      throw new Error(`invalid path (no access to parent)`);
    }

    // root path would be written like /x/a (I think)
    if (components[0] === '') {
      throw new Error(`invalid path (no access to root)`);
    }

    // TODO
    if (components[0] === '**') {
      throw new Error('ENOTIMPL');
    }

    return this.FindAllTail(root, components);
  }

  /**
   * how hard would it be to support wildcards? ...
   * basically if you see a wildcard, just treat every element as a 
   * match -- right?
   */
  public static FindAllTail(root: any, elements: string[]): any[] {

    if (Array.isArray(root)) {
      return root.reduce((composite, element) => {
        return composite.concat(this.FindAllTail(element, elements));
      }, []);
    }

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // wildcard should be handled here... if element is a wildard,
      // then either continue (single element) or recurse (multiple elements).
      // we need to avoid the attribute and text children.

      // NOTE we still have some code using the old options type, which
      // maps attributes and text differently... hopefully they won't use 
      // wildcards

      // two loops, really? come on

      if (element === '*') {
        root = Object.keys(root).
            filter(key => (key !== 'a$' && key !== 't$')).
            map(key => root[key]);
      }
      else {
        root = root[element];
      }

      if (!root) {
        return []; // no matching element
      }

      if (Array.isArray(root)) {

        // if this is the target node, then return the array;
        // otherwise, we need to recurse. also we can check for
        // zero-length array.

        if (i === elements.length - 1 || root.length === 0) {
          return root;
        }

        const step = elements.slice(1);
        return root.reduce((composite, element) => {
          return composite.concat(this.FindAllTail(element, step));
        }, []);

      }

    }

    // if we get here, root must be a single element so wrap it up

    return [root];

  }

}

