
/** dead-simple, slightly broken tree builder */
export class XML {

  public children: XML[] = [];

  constructor(
    public tag: string,
    public attributes: {[index: string]: string} = {}) {
  }

  /** fluent */
  public Append(tag: string, attributes: {[index: string]: string} = {}) {
    const child = new XML(tag, attributes);
    this.children.push(child);
    return child;
  }

  /** return DOM node */
  public toDOM(ns: string[] = []) {
    if (this.attributes.xmlns) ns.unshift(this.attributes.xmlns);

    const node = ns.length ?
      document.createElementNS(ns[0], this.tag) :
      document.createElement(this.tag);

    for (const key of Object.keys(this.attributes)) {
      if (key !== 'xmlns') {
        node.setAttribute(key, this.attributes[key]);
      }
    }

    for (const child of this.children) {
      const element = child.toDOM(ns);
      node.appendChild(element);
    }

    if (this.attributes.xmlns) ns.shift();
    return node;
  }

  /** return XML text */
  public toString(indent = 0) {

    let text = '';
    let spaces = '';

    for (let i = 0; i < indent; i++) spaces += '  ';
    text += spaces;
    text += `<${this.tag}`;

    for (const key of Object.keys(this.attributes)) {
      text += ` ${key}='${this.attributes[key].replace(/"/g, '\\"')}'`;
    }

    if (this.children.length) {
      text += '>\n';
      for (const child of this.children) {
        text += child.toString(indent + 1);
      }
      text += spaces;
      text += `</${this.tag}>\n`;
    }
    else {
      text += `/>\n`;
    }

    return text;
  }

}
