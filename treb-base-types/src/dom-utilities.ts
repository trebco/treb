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

/**
 * NOTE: I did this wrong. this is not correct. if you use a static 
 * instance and then call create for instances in two contexts, the second 
 * will overwrite the first.
 * 
 * we need a local or cached instance per sheet instance, plus we need 
 * somewhere to put that.
 * 
 * hmmm how about a lookup, instead of passing it around? or we could 
 * just have multiple instances. do we need a null instance? (...)
 */

export class DOMContext {

  protected static instances: DOMContext[] = [];
  
  /** 
   * FIXME: how about we default to document, so it won't break? 
   * that will make it harder to debug though. 
   */
  public static GetInstance(doc?: Document) {
    
    for (const instance of this.instances) {
      if (instance.doc === doc) {
        return instance;
      }
    }

    // not found, create
    const instance = new DOMContext(doc);
    this.instances.push(instance);
    return instance;

  }

  /** ugh sloppy */
  public doc?: Document; // placeholder temp

  /** ugh sloppy */
  public view?: (Window & typeof globalThis) | null;

  /*
  public get document(): Document {
    return this.doc;
  }

  public get window(): (Window & typeof globalThis) {
    return this.view;
  }
  */

  /** class for `instanceof` comparison */
  public get HTMLElement() {
    return this.view?.HTMLElement;
  }

  protected constructor(doc?: Document) {
    if (doc) {
      this.doc = doc;
      this.view = doc?.defaultView;
    }
  }

  /** wrapper for window.getSelection */
  public GetSelection() {
    return this.view?.getSelection();
  }

  /** creates a div and assigns class name/names */
  public Div(classes?: string|string[], parent?: HTMLElement, options?: CreateElementOptions): HTMLDivElement {
    return this.Create('div', classes, parent, options);
  }

  public ClassNames(element: HTMLElement|SVGElement, classes: string|string[]) {
    element.classList.add(...(Array.isArray(classes) ? classes : [classes]).reduce((arr: string[], entry) => [...arr, ...entry.split(/\s+/g)], []));
  }

  public SVG<K extends keyof SVGElementTagNameMap>(
      tag: K, 
      classes?: string|string[],
      parent?: HTMLElement|SVGElement|DocumentFragment
    ): SVGElementTagNameMap[K] {

    const element = (this.doc as Document).createElementNS(SVGNS, tag);

    if (classes) {
      this.ClassNames(element, classes);
    }

    if (parent) {
      parent.appendChild(element);
    }

    return element;
  }

  /**
   * this is a wrapper for createTextNode. but if we want to expose 
   * the element/node classes (@see HTMLElement, above) then this 
   * should properly be the Text class and not a method. So we should
   * rename it. 
   * 
   * @param data 
   * @returns 
   */
  public Text(data: string) {
    return (this.doc as Document).createTextNode(data);
  }

  public Fragment() {
    return (this.doc as Document).createDocumentFragment();
  }

  /** better typing */
  public Create<K extends keyof HTMLElementTagNameMap>(
      tag: K, 
      classes?: string|string[], 
      parent?: HTMLElement|DocumentFragment, 
      options?: CreateElementOptions
    ): HTMLElementTagNameMap[K] {
 
    const element = (this.doc as Document).createElement(tag);

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
