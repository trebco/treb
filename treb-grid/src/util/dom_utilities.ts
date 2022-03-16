
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
