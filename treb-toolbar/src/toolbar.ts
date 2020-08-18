
import { ToolbarElement, ToolbarButton, 
         ToolbarSplitButton, ToolbarInputField, ToolbarTextField, ToolbarEvent, ToolbarElementBase, ToolbarIconDefinition } from './toolbar-types';
import { tmpl, NodeModel, EventSource } from 'treb-utils';

import '../style/toolbar.css';

interface IDMap {[index: string]: HTMLElement}

/**
 * trying to make the toolbar as simple as possible. we will let
 * the caller handle things like mutating state; we just show it
 * and pass on events.
 * 
 * so if you want to change a button, you update your spec and we
 * diff it against ours (more or less).
 * 
 * colors are handled a little differently, we will handle the UI
 * for the color chooser. but to change the color on a button, you
 * need to change your state.
 */
export class Toolbar extends EventSource<ToolbarEvent> {

  private node: HTMLElement;
  private toolbar: HTMLElement;
  private color_menu: NodeModel;
  private map: {[index: string]: ToolbarElement} = {};

  private elements: ToolbarElement[] = [];

  private colors = [
    'rgb(0, 0, 0)',
    'rgb(64, 64, 64)',
    'rgb(128, 128, 128)',
    'rgb(192, 192, 192)',
    'rgb(212, 212, 212)',
    'rgb(256, 256, 256)',
    'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet',
  ];

  constructor(private container: HTMLElement) {
    super();

    this.node = document.createElement('div');
    this.node.className = 'treb-toolbar2';
    container.appendChild(this.node);

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'toolbar-items';
    this.node.appendChild(this.toolbar);

    // FIXME: checkmark in accept button

    this.color_menu = tmpl`
      <div id='root' class='color-chooser'>
        <div id='colors' class='colors'></div>
        <div class='new-color'>
          <input id='input' class='input-color' placeholder='New color'>
          <button class='accept-color'>OK</button>
        </div>
      </div>
    `;

    /**
     * on button click, a couple of things happen: we open dropdown
     * menus, we publish events, we choose colors. depends on the button.
     */
    this.toolbar.addEventListener('click', (event) => {

      const element = this.ContainingElement(event.target as HTMLElement);
      if ((element as HTMLButtonElement)?.disabled) { return; }

      if (element) {
        if (element.classList.contains('dropdown-link')) {

          const dropdown = this.ContainingDropdown(event.target as HTMLElement);

          if (element.dataset.target_id) {
            const mapped = this.map[element.dataset.target_id];
            if (mapped.dropdown === 'color') {
              const list = dropdown?.querySelector('.dropdown-list');
              if (list) { list.appendChild(this.color_menu.root); }
            }
          }

          if (dropdown) {
            dropdown.classList.toggle('focused');
          }
        }
        else if (element.dataset.id) {

          this.Publish({
            id: element.dataset.id,
            element: element.dataset.id ? this.map[element.dataset.id] : undefined,
          } as ToolbarEvent);

          const dropdown = this.ContainingDropdown(element);
          if (dropdown) {
            dropdown.classList.remove('focused');
          }

        }
        else if (/accept-color/.test(element.className)) {

          // this is the "OK" button in the color chooser (which should be
          // a checkmark). apply the color (as long as it's not empty) and 
          // close the color chooser

          const dropdown = this.ContainingDropdown(element);
          if (dropdown) {
            const input = this.color_menu.input as HTMLInputElement;
            const button = dropdown.querySelector('.toolbar-button') as HTMLElement;

            if (button?.dataset.id && input?.value.trim()) {
              this.Publish({
                related_id: button.dataset.id,
                color: input.value.trim(),
              });
            }

            // clear the input field, we'll add the color as a swatch

            input.value = '';
            dropdown.classList.remove('focused');
            button.click();
          }

        }
        else if (typeof element.dataset.color !== 'undefined') {

          // this is a color swatch button -- apply the color and close
          // the color chooser.

          const dropdown = this.ContainingDropdown(element);
          if (dropdown) {
            const button = dropdown.querySelector('.toolbar-button') as HTMLElement;
            if (button?.dataset.id) {
              this.Publish({
                related_id: button.dataset.id,
                color: element.dataset.color,
              });
            }
            dropdown.classList.remove('focused');
            button.click();
          }

        }
      }

    });

    /** 
     * we handle two keys: enter in input fields, and escape when
     * a dropdown menu is open (to close it).
     */
    this.toolbar.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement;

      switch (event.key) {
        case 'Enter':
          if (target === this.color_menu.input) {
            const dropdown = this.ContainingDropdown(event.target as HTMLElement);
            const button = dropdown?.querySelector('.toolbar-button') as HTMLElement;
            const input = this.color_menu.input as HTMLInputElement;
            if (button?.dataset.id) {

              // only publish non-empty value
              // FIXME: prevalidate color? (...)

              if (input.value.trim()) {
                this.Publish({
                  related_id: button.dataset.id,
                  color: input.value,
                });
              }
              input.value = '';
              button.click();
            }
            break;
          }
          else {
            if (target?.dataset.id && target?.tagName === 'INPUT') {
              const input = target as HTMLInputElement;
              if (input.value.trim()) {
                this.Publish({
                  type: 'input',
                  id: input.dataset.id,
                  value: input.value,
                })
              }
            }
          }
          return;

        case 'Escape':
        case 'Esc':
          if (typeof target.dataset.original_value !== 'undefined') {
            (target as HTMLInputElement).value = target.dataset.original_value;
          }
          break;

        default:
          return;
      }
      event.stopPropagation();
      const dropdown = this.ContainingDropdown(event.target as HTMLElement);

      if (dropdown) {
        dropdown.classList.remove('focused');
      }

      this.Publish({ type: 'focusout' });

    });

    /**
     * close a dropdown menu if it loses focus, accounting for child elements
     */
    this.toolbar.addEventListener('focusout', (event) => {

      const old_target = this.ContainingDropdown(event.target as HTMLElement);
      const new_target = this.ContainingDropdown(event.relatedTarget as HTMLElement);

      if (old_target && old_target !== new_target) {
        old_target.classList.remove('focused');
      }
      
    });

  }

  private CreateSVGFragment(def: ToolbarIconDefinition, viewbox='0 0 24 24', default_class='line-icon' ) {
    return tmpl`
      <svg id="icon" viewbox="${def.viewbox || viewbox}">
        ${
          (def.paths || []).map(path => {
            let classes = path.classes || default_class;
            if (!Array.isArray(classes)) classes = [classes];
            return `<path d="${path.d}" class="${classes.join(' ')}" style="${path.style || ''}"/>`;
          }).join('')
        }
      </svg>
    `;
  }

  public ContainingDropdown(element: HTMLElement): HTMLElement|undefined {
    if (!element) { return undefined; }
    if (element.classList.contains('dropdown-container')) { return element; }
    for (;;) {
      element = element.parentElement as HTMLElement;
      if (!element) return undefined;
      if (element.classList.contains('dropdown-container')) { return element; }
      if (element === this.node || element === this.toolbar) { return undefined; } // cap
    }
    return undefined;
  }

  public ContainingElement(element: HTMLElement, tag = 'BUTTON'): HTMLElement|undefined {
    if (!element) { return undefined; }
    if (element.tagName === tag) { return element; }
    for (;;) {
      element = element.parentElement as HTMLElement;
      if (!element) return undefined;
      if (element.tagName === tag) { return element; }
    }
    return undefined;
  }

  /** create separator element */
  public Separator(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'separator';
    return div;
  }

  /**
   * wrap control with a dropdown container; add dropdown button, list
   */
  public Dropdown(root: HTMLElement, element: ToolbarElement): HTMLElement {

    // create outer container
    const container = document.createElement('div');
    container.className = 'dropdown-container';

    // add root node
    container.appendChild(root);

    // add dropdown button
    const dropdown = document.createElement('button');
    dropdown.className = 'dropdown-link';
    dropdown.dataset.target_id = element.id;
    container.appendChild(dropdown);
    
    // add dropdown menu
    const list = document.createElement('div');
    list.className = element.dropdown === 'color' ? 'dropdown-list choose-color' : 'dropdown-list';
    list.tabIndex = -1;
    container.appendChild(list);
  
    if (element.dropdown === 'list' && element.list) {
      const ul = document.createElement('ul');
      for (const entry of element.list) {
        const child = this.CreateElement(entry);
        if (child) {
          const li = document.createElement('li');
          li.appendChild(child);
          ul.appendChild(li);
          if (entry.id) {
            this.map[entry.id] = entry;
          }
        }
      }
      list.appendChild(ul);
    }

    return container;

  }

  /** create button element */
  public Button(element: ToolbarButton): HTMLElement {
    const button = document.createElement('button');
    button.className = 
      'toolbar-button' + (element.active ? ' active' : '');

    if (element.disabled) {
      button.disabled = true;
    }

    if (element.title) {
      button.title = element.title;
    }
    if (element.id) {
      button.dataset.id = element.id;
    }
    if (element.related_id) {
      button.dataset.related_id = element.related_id;
    }
    if (element.icon) {
      button.appendChild(this.CreateSVGFragment(element.icon).icon);
    }
    if (element.dropdown) { 
      return this.Dropdown(button, element); 
    }

    return button;
  }

  /** create split button (top/bottom) */
  public SplitButton(element: ToolbarSplitButton): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'split-button';
    for (const subelement of [element.top, element.bottom]) {
      const node = document.createElement('button');
      node.textContent = subelement.text || '';
      if (subelement.title) { node.title = subelement.title; }
      if (subelement.id) {
        node.dataset.id = subelement.id;
      }
      div.appendChild(node);
    }
    return div;
  }

  /** create text input element */
  public Input(element: ToolbarInputField): HTMLElement {
    const input = document.createElement('input');
    input.className = 'toolbar-input';
    if (element.id) {
      input.dataset.id = element.id;
    }
    if (element.text) { 
      input.value = element.text; 
      input.dataset.original_value = element.text || '';
    }
    if (element.placeholder) { input.placeholder = element.placeholder; }
    if (element.dropdown) {
      return this.Dropdown(input, element);
    }
    return input;
  }

  public Text(element: ToolbarTextField): HTMLElement {
    const button = document.createElement('button');
    button.textContent = element.text || '';
    button.className = 'text-button';
    if (element.id) {
      button.dataset.id = element.id;
    }
    return button;
  }

  public UpdateColors(document_colors: string[] = []) {
   
    for (const color of document_colors) {
      if (this.colors.every(test => test !== color)) {
        this.colors.push(color);
      }
    }

    this.color_menu.colors.textContent = '';

    const button = document.createElement('button');
    button.className = 'default-color';
    button.title = 'Default color';
    button.dataset.color = 'none';

    const nodes: HTMLElement[] = [button];

    for (const color of this.colors) {
      const button = document.createElement('button');
      button.style.background = color;
      button.title = color;
      button.dataset.color = color;
      nodes.push(button);
    }
    this.color_menu.colors.append(...nodes);

  }

  public CreateElement(element: ToolbarElement): HTMLElement|undefined {

    switch (element.type) {
      case 'split':
        return this.SplitButton(element);

      case 'input':
        return this.Input(element);

      case 'button':
        return this.Button(element);

      case 'separator':
        return this.Separator();

      case 'text':
        return this.Text(element);
    }
  
    return undefined;

  }

  /**
   * check if we need to update this element. returns true if 
   * elements are logically equivalent, otherwise false.
   * 
   * @param a new element
   * @param b existing element (if any)
   */
  public CompareElement(a?: ToolbarElement, b?: ToolbarElement): HTMLElement|undefined {

    // both missing, do nothing (we should never get here)

    if (!a && !b) { return undefined; }

    // new one missing, do nothing

    if (!a) { return undefined; }

    // no existing one, or node missing, needs full build

    if (!b || !b.node) { 
      return this.CreateElement(a);
    }

    // comparisons need full rebuild

    if (a.type !== b.type || a.dropdown !== b.dropdown) { 
      return this.CreateElement(a);
    }

    // these can be reconstructed in place (...) the difficulty is that they
    // might be inside a dropdown, we would have the containing node. ATM we
    // know it's the first child...

    let target = b.node as HTMLElement;
    if (a.dropdown) {
      target = target.firstChild as HTMLElement;
    }

    // is this type-specific? (...)

    if (a.text !== b.text) { 

      // FIXME: button?

      if (a.type === 'input') {
        (target as HTMLInputElement).value = a.text || '';
        (target as HTMLInputElement).dataset.original_value = a.text || '';
      }
      else {
        target.textContent = a.text || '';
      }
    }

    if (a.active !== b.active) { 

      // could toggle, since we know it's wrong...

      if (a.active) { target.classList.add('active'); }
      else { target.classList.remove('active'); }
    }

    if (a.title !== b.title) { 
      target.title = a.title || '';
    }

    // this feels wasteful... is there another way? perhaps we could cache
    // icon defs and then use symbolic identifiers

    if (a.type === 'button' && b.type === 'button' && JSON.stringify(a.icon) !== JSON.stringify(b.icon)) { 
      target.textContent = '';
      if (a.icon) {
        target.appendChild(this.CreateSVGFragment(a.icon).icon);
      }
    }

    // this should recurse...

    if (JSON.stringify(a.list) !== JSON.stringify(b.list)) { 
      // console.info('cowardly recreating list');
      return this.CreateElement(a);
    }

    return b.node;

  }

  public Update(elements: ToolbarElement[]): void {

    // FIXME: better diffing, comp methods

    let index = 0;
    for (; index < elements.length; index++ ){
      const element = elements[index];
      const local = this.elements[index];

      const current_node = local?.node;
      const new_node = this.CompareElement(element, local);

      if (new_node !== current_node) {
        if (new_node && current_node) {
          current_node.parentElement?.replaceChild(new_node, current_node);
        }
        else if (new_node) {
          this.toolbar.appendChild(new_node);
        }
        else if (current_node) {
          current_node.parentElement?.removeChild(current_node);
        }
      }

      // UPDATE: we should always set local, even if there are 
      // no layout/UI changes, in the event that there are user
      // data changes.

      // set local
      this.elements[index] = JSON.parse(JSON.stringify(element));
      this.elements[index].node = new_node;

      if (element.id) {
        this.map[element.id] = element;
      }

    }

    // remove any trailers
    // ...TODO...
    
  }

  /** init, based on template list */
  public Init(elements: ToolbarElement[], colors?: string[]): void {

    const ids: {[index: string]: HTMLElement} = {};
    const nodes: HTMLElement[] = [];

    for (const element of elements) {

      if (element.id && ids[element.id]) {
        throw new Error('duplicate ID');
      }

      const node = this.CreateElement(element);

      if (node) {
        element.node = node;
        if (element.id) {
          ids[element.id] = node;
        }
        nodes.push(node);
        /*
        if (element.dropdown) {
          nodes.push(this.Dropdown(element, ids));
        }
        */
      }
    }

    //if (colors) {
    // this.UpdateColors(colors);
    //}
    this.UpdateColors();
    this.toolbar.textContent = '';
    this.toolbar.append(...nodes);

  }

}