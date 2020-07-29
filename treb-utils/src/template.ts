
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

const composite = (strings: TemplateStringsArray, ...args: any[]): string => {
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
export const js = composite;