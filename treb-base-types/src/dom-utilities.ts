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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

const SVGNS = 'http://www.w3.org/2000/svg';

type EventHandlerMap = {
  [key in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[key]) => any;
}

type StyleMap = {
  [key in keyof CSSStyleDeclaration]: string;
}

export interface CreateElementOptions {

  /** 
   * FIXME: can we lock this down a bit? 
   * 
   * actually that might not be wise since we sometimes use "scope" type 
   * attributes that are not standard (maybe we should fix that, instead?)
   */
  attrs?: Record<string, string>;

  /**
   * optionally style as a map
   */
  style?: Partial<StyleMap>;

  /** dataset or data-* attributes */
  data?: Record<string, string>;

  /** innerText */
  text?: string;

  /** innerHTML */
  html?: string;

  /** event handlers */
  events?: Partial<EventHandlerMap>;

}

export class DOMUtilities {

  /** creates a div and assigns class name/names */
  public static Div(classes?: string|string[], parent?: HTMLElement, options?: CreateElementOptions): HTMLDivElement {
    return this.Create('div', classes, parent, options);
  }

  public static ClassNames(element: HTMLElement|SVGElement, classes: string|string[]) {
    element.classList.add(...(Array.isArray(classes) ? classes : [classes]).reduce((arr: string[], entry) => [...arr, ...entry.split(/\s+/g)], []));
  }

  public static SVG<K extends keyof SVGElementTagNameMap>(
      tag: K, 
      classes?: string|string[],
      parent?: HTMLElement|SVGElement|DocumentFragment
    ): SVGElementTagNameMap[K] {

    const element = document.createElementNS(SVGNS, tag);

    if (classes) {
      this.ClassNames(element, classes);
    }

    if (parent) {
      parent.appendChild(element);
    }

    return element;
  }

  /** better typing */
  public static Create<K extends keyof HTMLElementTagNameMap>(
      tag: K, 
      classes?: string|string[], 
      parent?: HTMLElement|DocumentFragment, 
      options?: CreateElementOptions
    ): HTMLElementTagNameMap[K] {
 
    const element = document.createElement(tag);

    if (classes) {
      this.ClassNames(element, classes);
    }

    if (options) {

      if (options.attrs) {
        for (const [key, value] of Object.entries(options.attrs)) {
          element.setAttribute(key, value);
        }
      }

      if (options.data) {
        for (const [key, value] of Object.entries(options.data)) {
          element.dataset[key] = value;
        }
      }

      if (options.text) {
        element.textContent = options.text;
      }

      if (options.html) {
        element.innerHTML = options.html;
      }

      if (options.events) {
        for (const [key, value] of Object.entries(options.events)) {
          element.addEventListener(key, value as any); // typing works well up until this point
        }
      }

      if (options.style) {
        for (const [key, value] of Object.entries(options.style)) {
          (element.style as any)[key] = value; // more sloppy typing
        }
      }

    }

    if (parent) {
      parent.appendChild(element);
    }
    
    return element;
  }

}
