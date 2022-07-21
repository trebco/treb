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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

export class DOMUtilities {

  /** creates a div and assigns class name/names */
  public static CreateDiv(classes = '', parent?: HTMLElement, scope?: string){
    return this.Create<HTMLDivElement>('div', classes, parent, scope);
  }

  /** generic element constructor. shame we need the tag AND the type. */
  public static Create<E extends HTMLElement>(tag = '', classes = '', parent?: HTMLElement, scope?: string, attrs?: Record<string, string>){
    const element = document.createElement(tag) as E;
    if (classes) element.setAttribute('class', classes);
    if (scope) element.setAttribute(scope, '');
    if (attrs) {
      const keys = Object.keys(attrs);
      for (const key of keys) {
        element.setAttribute(key, attrs[key]);
      }
    }
    if (parent) parent.appendChild(element);
    return element;
  }

}
