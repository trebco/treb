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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import { Unescape } from './unescape_xml';
import { type X2jOptions, XMLBuilder, type XmlBuilderOptions } from 'fast-xml-parser';

export const XMLTagProcessor = (name: string, value: string): string => Unescape(value);

export interface DOMContent {
  [index: string]: string|DOMContent|string[]|DOMContent[]|number|number[]|undefined;
}

// --- take 2 ------------------------------------------------------------------

export interface XMLKeys {
  a$?: Record<string, string>;
  t$?: string;
}

export type DOMElementType = number|number[]|string|string[]|(BaseDOM & XMLKeys)|(BaseDOM & XMLKeys)[];

export interface BaseDOM {
  [key: string]: DOMElementType;
}

export type GenericDOMElement = BaseDOM & XMLKeys;

export const GenericDOMArray = (element: GenericDOMElement|GenericDOMElement[]): GenericDOMElement[] => element ? Array.isArray(element) ? element : [element] : [];

// -----------------------------------------------------------------------------


/**
 * not sure why we have to do this, but filter attributes that 
 * have value === undefined
 */
export const ScrubXML = (dom: DOMContent) => {
  if (dom) {
    if (Array.isArray(dom)) {
      for (const entry of dom) {
        ScrubXML(entry);
      }
    }
    else if (typeof dom === 'object') {
      for (const [key, value] of Object.entries(dom)) {
        if (key === 'a$') {
          if (typeof value === 'object') {
            const replacement: DOMContent = {};
            for (const [attr_name, attr_value] of Object.entries(value)) {
              if (attr_value !== undefined) {
                replacement[attr_name] = attr_value;
              }
            }
            dom[key] = replacement;
          }
        }
        else {
          ScrubXML(value as DOMContent);
        }
      }
    }
  }
  return dom;
};

export const PatchXMLBuilder = (options: Partial<XmlBuilderOptions>) => {

  const builder = new XMLBuilder(options);
  const build = builder.build;

  builder.build = (arg: DOMContent) => {
    return build.call(builder, ScrubXML(arg)); // get the "this" value right
  }

  return builder;

};

//////////////////

/*
export const XMLOptions: Partial<X2jOptions> = {
  ignoreAttributes: false,
  attributeNamePrefix: '__',
  trimValues: false,
  textNodeName: 'text__',
  tagValueProcessor: XMLTagProcessor,
  ignoreDeclaration: true,
};
*/

/**
 * group attributes under `a$`, and don't add attribute prefixes (should be 
 * implicit on that option, but hey).
 */
export const XMLOptions2: Partial<X2jOptions> = {
  ignoreAttributes: false,
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
  public static FindAll(root: DOMContent = {}, path: string): any[] {

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
  public static FindAllTail(root: DOMContent|DOMContent[], elements: string[]): DOMContent[] {

    if (Array.isArray(root)) {
      return root.reduce((composite, element) => {
        return composite.concat(this.FindAllTail(element, elements));
      }, [] as DOMContent[]);
    }

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // wildcard should be handled here... if element is a wildard,
      // then either continue (single element) or recurse (multiple elements).
      // we need to avoid the attribute and text children.

      // NOTE we still have some code using the old options type, which
      // maps attributes and text differently... hopefully they won't use 
      // wildcards

      if (element === '*') {

        const pairs = Object.entries(root) as Array<[string, DOMContent]>;
        root = pairs.reduce((result, [key, value]) => {
          if (key !== 'a$' && key !== 't$')  {
            result.push(value);
          }
          return result;
        }, [] as DOMContent[]);

        /*
      // two loops, really? come on

        root = Object.keys(flat).
            filter(key => (key !== 'a$' && key !== 't$')).
            map(key => flat[key]) as DOMContent[];
        */

      }
      else {
        root = root[element] as DOMContent;
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
        }, [] as DOMContent[]);

      }

    }

    // if we get here, root must be a single element so wrap it up

    return [root];

  }

}

