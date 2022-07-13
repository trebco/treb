/**
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
 * Copyright 2022 trebco, llc. + info@treb.app
 */

export interface NodeModel {[index: string]: HTMLElement}

const ParseTail = (node: HTMLElement, scope: string, model: NodeModel): void => {
  [].forEach.call(node.children, (child: HTMLElement) => {
    if (child.id) {
      model[child.id] = child;
      child.id = `${scope}-${child.id}`;
    }
    if (child.children && child.children.length) {
      ParseTail(child, scope, model);
    }
});
}

const ParseTemplate = (template: string, container?: HTMLElement|string) => {

  const scope = Math.random().toString(36).substring(2, 15);
  const temp = document.createElement('div');
  temp.innerHTML = template;

  const model: NodeModel = {};
  ParseTail(temp, scope, model);

  if (typeof container === 'string') {
    container = document.querySelector(container) as HTMLElement;
  }
  if (container) {
    const nodes = [].map.call(temp.childNodes, child => child);
    for (const child of nodes) { container.appendChild(child as Node); }
  }
 
  return model;

}

export const composite = (strings: TemplateStringsArray, ...args: any[]): string => {
  const output: string[] = [];
  for (let i = 0; i < strings.length; i++) {
    output.push(strings[i]);
    if (args[i]) { output.push(args[i].toString()); }
  }
  return output.join('');
}

export const tmpl = (strings: TemplateStringsArray, ...args: any[]): NodeModel => {
  return ParseTemplate(composite(strings, ...args));
}

export const css = composite;
