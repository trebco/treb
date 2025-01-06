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

/*
interface StringMap {
  [index: string]: string;
}
*/

type StringMap = Map<string, string>;


/**
 * defaults are global, since we assume they never change. created on demand.
 */
let default_properties: StringMap|undefined;

/**
 * convert CSSStyleDeclaration to map
 */
const PropertyMap = (source: CSSStyleDeclaration): StringMap => {

  const map: StringMap = new Map();

  // you can iterate this thing, although apparently ts won't allow
  // it because it's not in the spec? should probably play ball

  for (let i = 0; i < source.length; i++) {
    const key = source[i];
    map.set(key, source.getPropertyValue(key));
  }

  return map;

}

/**
 * get applied style as text (for attribute)
 */
const GetAppliedStyle = (node: Element, computed: CSSStyleDeclaration, defaults: StringMap) => {

  const applied: StringMap = new Map();
  const computed_map = PropertyMap(computed);
  
  for (const [key, value] of computed_map.entries()) {
    if (value !== defaults.get(key)) {
      applied.set(key, value);
    }
  }

  const arr = Array.from(applied.entries());
  return (arr.map(([key, value]) => `${key}: ${value}`).join('; ') +
    '; ' + (node.getAttribute('style') || '')).trim().replace(/"/g, '\'');

};

/**
 * create a clone of the node with static styles applied
 */
const RenderNode = (node: Element, defaults: StringMap) => {

  const clone = node.cloneNode(false);
  const computed = getComputedStyle(node);
  const style = GetAppliedStyle(node, computed, defaults);

  (clone as HTMLElement).removeAttribute('class');
  (clone as HTMLElement).setAttribute('style', style);

  let computed_map: StringMap|undefined;

  Array.prototype.forEach.call(node.childNodes, (child: Node) => {

    switch (child.nodeType) {

      case Node.ELEMENT_NODE:

        // here we use the parent as the default style, assuming the child will inherit

        // create on demand, if necessary
        if (!computed_map) {
          computed_map = PropertyMap(computed);          
        }
        clone.appendChild(RenderNode(child as Element, computed_map));
        break;

      case Node.TEXT_NODE:
        if (node.textContent) {
          clone.appendChild(document.createTextNode(node.textContent));
        }
        break;

      case Node.COMMENT_NODE:
        // silently drop comments
        break;

      default:
        console.warn('unhandled node type in serialize', child);
    }
});

  return clone;
};

/**
 * serialize a node by creating a clone with static styling that can be
 * used stand-alone (intended for svg, but could apply generically).
 */
export const SerializeHTML = (node: Element) => {

  if (!default_properties) {

    const defaults: StringMap = new Map();

    // regarding document, in this case we're creating an iframe 
    // specifically for isolation, and adding it to "document". 
    // there's no reason to require the context document here (I think).

    const iframe = document.createElement('iframe');
    iframe.style.width = '10px';
    iframe.style.height = '10px';
    iframe.style.position = 'absolute';
    iframe.style.left = '-100px';

    document.body.appendChild(iframe);

    const frame_document = iframe.contentDocument;
    if (frame_document) {
      const div = frame_document.createElement('div');
      frame_document.body.appendChild(div);
      const computed = getComputedStyle(div);
      Array.prototype.forEach.call(computed, key => defaults.set(key, computed[key]));
    }

    document.body.removeChild(iframe);
    default_properties = defaults;

  }

  const rendered = RenderNode(node, default_properties);
  if (rendered instanceof Element && rendered.tagName === 'svg') {
    if (!rendered.hasAttribute('version')) {
      rendered.setAttribute('version', '1.1');
    }

    if (!rendered.hasAttribute('xmlns')) {
      rendered.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    if (!rendered.hasAttribute('xmlns:xlink')) {
      rendered.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }

  }

  return rendered;

};

// (self as any).SerializeHTML = SerializeHTML;

