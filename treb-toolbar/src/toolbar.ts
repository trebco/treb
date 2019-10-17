
import { Yield } from 'treb-utils';
import { toolbar_template, sheet_structure_menu } from './toolbar-template';
import { ToolbarItem } from './toolbar-item';
import { NumberFormatCache, NumberFormat } from 'treb-format';
import { Measurement } from 'treb-utils';
import { ICellAddress, Area } from 'treb-base-types';

import { ToolbarOptions } from './toolbar-options';

export type EventHandler = (id: string, data?: any) => void;

const default_colors = [
  '#000', '#333', '#666', '#999', '#ccc', '#fff',
];

const SVGNS = 'http://www.w3.org/2000/svg';
const XlinkNS = 'http://www.w3.org/1999/xlink';

interface ToolbarItemImpl extends ToolbarItem {
  node: HTMLElement;
  input?: HTMLInputElement;
}

export class Toolbar {

  public current_note = '';
  public current_cell: ICellAddress = {row: -1, column: -1};

  // we use different fields for the dialog to cover the (maybe rare)
  // case where the selection switches after the dialog closes but before
  // we handle the event

  public dialog_cell: ICellAddress = {row: -1, column: -1};
  public dialog_note = '';

  private handlers: EventHandler[] = [];
  private items: {[index: string]: ToolbarItemImpl} = {};
  private colors: string[] = [];
  private formats: Array<string|ToolbarItem> = [];
  private popup!: HTMLElement;
  private popup_item?: ToolbarItemImpl;

  /** using a list instead of querying every time (over-optimization) */
  private active_items: HTMLElement[] = [];

  constructor(private container: HTMLElement, options: ToolbarOptions = {}) {

    let template: ToolbarItem[] = JSON.parse(JSON.stringify(toolbar_template));

    if (options.add_delete_sheet) {
      const structure_item = JSON.parse(JSON.stringify(sheet_structure_menu));
      template = template.map((item) => {
        if (item.id === 'structure') {
          return structure_item;
        }
        return item;
      });
    }

    for (const item of template) this.PopulateItems(item, container);

    this.popup = document.createElement('div');
    this.popup.classList.add('treb-toolbar-menu');
    this.popup.setAttribute('tabIndex', '-1');

    this.popup.addEventListener('focusout', (event) => {
      let node = (event as FocusEvent).relatedTarget as HTMLElement;
      while (node) {
        if (node === this.popup) return;
        node = node.parentElement as HTMLElement;
      }
      this.HidePopup();
    });
    document.body.appendChild(this.popup);

    this.popup.addEventListener('click', (event) => this.HandlePopupEvent(event));
    this.popup.addEventListener('change', (event) => this.HandlePopupEvent(event));

    document.addEventListener('keydown', (event) => {
      if (this.popup_item && (event.key === 'Escape' || event.key === 'Esc')) {
        event.stopPropagation();
        event.preventDefault();
        this.HidePopup();
      }
    });

    /*
    setTimeout(() => {
      this.ShowPopup(this.items['number-format'].node, this.items['number-format']);
    }, 200);
    */

    // we need both keydown and change. change in the event you tab out
    // after changing the value. keydown to support forcing updates if you
    // update multiple cells. not sure how to prevent the dupe. focusout?

    // let's do this the hard way. test target to make sure we're not
    // debouncing a different (future) element

    let debounce: any;
    let debounce_target: any;

    container.addEventListener('keydown', (event) => {

      if (event.key !== 'Enter') return;

      let node = event.target as HTMLElement;
      while (node) {
        const id = node.getAttribute('id');
        if (id) {
          const match = id.match(/toolbar-item-(.*)$/);
          if (match) {
            const item = this.items[match[1]];
            if (item) item.value = event.target ? (event.target as HTMLInputElement).value : '';
            event.stopPropagation();
            event.preventDefault();
            debounce_target = match[1];
            debounce = setTimeout(() => { debounce = undefined; }, 250);
            this.Publish(match[1], item);
            return;
          }
        }
        node = node.parentElement as HTMLElement;
        if (!node || node === this.container) return;
      }

    });

    // change events on input (really just number format, atm)
    container.addEventListener('change', (event) => {

      event.stopPropagation();
      event.preventDefault();

      let node = event.target as HTMLElement;
      while (node) {
        const id = node.getAttribute('id');
        if (id) {
          const match = id.match(/toolbar-item-(.*)$/);
          if (match) {

            if (debounce && debounce_target === match[1]) {
              return;
            }

            const item = this.items[match[1]];
            if (item) item.value = event.target ? (event.target as HTMLInputElement).value : '';
            this.Publish(match[1], item);
            return;
          }
        }
        node = node.parentElement as HTMLElement;
        if (!node || node === this.container) return;
      }

    });

    container.addEventListener('mousedown', (event) => {
      let node = event.target as HTMLElement;

      if (!node || node.tagName === 'INPUT') return;

      while (node) {
        const id = node.getAttribute('id');
        if (id) {
          const match = id.match(/toolbar-item-(.*)$/);
          if (match) {
            let item = this.items[match[1]];
            if (item.type === 'drop-down') {
              // console.info('dropdown (md)', item);
              if (item['related-id']){
                item = this.items[item['related-id']];
                if (item) {
                  this.ShowPopup(item.node, item);
                  event.stopPropagation();
                  event.preventDefault();
                }
              }
            }
            else if (item.submenu) {
              this.ShowPopup(item.node, item);
              event.stopPropagation();
              event.preventDefault();
            }
            else {
              return;
            }
          }
          return;
        }
        node = node.parentElement as HTMLElement;
        if (!node || node === this.container) return;
      }
    });

    container.addEventListener('click', (event) => {
      let node = event.target as HTMLElement;

      if (!node || node.tagName === 'INPUT') return;

      while (node) {
        const id = node.getAttribute('id');
        if (id) {
          const match = id.match(/toolbar-item-(.*)$/);
          if (match) {
            let item = this.items[match[1]];
            if (item.type === 'drop-down') {
              // console.info('dropdown (click)', item);
              if (item['related-id']){
                item = this.items[item['related-id']];
                if (item) {
                  this.ShowPopup(item.node, item);
                }
              }
            }
            else if (item.submenu) {
              this.ShowPopup(item.node, item);
            }
            else if (item.id === 'note') {
              this.ShowPopup(item.node, item);
            }
            else {
              // console.info(item);
              this.Publish(match[1], item);
            }
          }
          return;
        }
        node = node.parentElement as HTMLElement;
        if (!node || node === this.container) return;
      }
    });

  }

  public Activate(id: string) {
    const item = this.items[id];
    if (item) {
      item.node.classList.add('active');
      this.active_items.push(item.node);
    }
  }

  public Deactivate(id: string){
    const item = this.items[id];
    if (item) {
      this.active_items = this.active_items.filter((test) => {
        if (test === item.node) {
          test.classList.remove('active');
          return false;
        }
        return true;
      });
    }
  }

  public DeactivateAll() {
    for (const item of this.active_items) {
      item.classList.remove('active');
    }
    this.active_items = [];
  }

  public ClearDocumentFormats() {
    this.formats = [
      'General', 'Number', 'Integer', 'Percent', 'Accounting', 'Currency', 'Scientific',
      { type: 'separator' },
      'Timestamp', 'Long Date', 'Short Date',
    ];
    const item = this.items['number-format'];
    if (item) item.submenu = this.formats;
  }

  public AddDocumentFormat(format: string) {

    if (NumberFormatCache.SymbolicName(format)) return;

    const check = NumberFormatCache.Get(format);
    let splitter_index = 0;

    for (let index = 0; index < this.formats.length; index++) {
      const test = this.formats[index];
      if (typeof test === 'string'){
        if (check === NumberFormatCache.Get(test)) return; // already have it
      }
      else {
        splitter_index = index;
      }
    }

    // insert number formats before separator, date formats after

    if (check.date_format) {
      this.formats.push(format);
    }
    else {
      this.formats.splice(splitter_index, 0, format);
    }

    const item = this.items['number-format'];
    if (item) item.submenu = this.formats;
  }

  public ClearDocumentColors() {
    this.colors = default_colors.slice(0);
  }

  public AddDocumentColor(color: string) {
    const argb = Measurement.MeasureColorARGB(color);
    if (this.colors.some((test) =>
        (color === test || argb === Measurement.MeasureColorARGB(test)))) {
      return;
    }
    this.colors.push(color);
  }

  public On(handler: EventHandler) {
    this.handlers.push(handler);
  }

  public Off(handler: EventHandler) {
    this.handlers = this.handlers.filter((test) => test !== handler);
  }

  /**
   * this is a bit of a hack, for setting the second color in the color
   * buttons. we can't use the variable scheme we use in electron (because
   * IE, natch) so we have to dig a bit deeper. this works, but is not very
   * flexible.
   */
  public SetSecondColor(id: string, color: string) {
    const item = this.items[id];
    if (item && item.icon) {
      const paths = document.querySelectorAll(`symbol#${item.icon} path`);
      if (paths.length > 1) {
        (paths[1] as HTMLElement).style.fill = color;
      }
      item['second-color'] = color;
    }
    else console.warn(`can't set color for id ${id}`);
  }

  public GetSecondColor(id: string) {
    const item = this.items[id];
    if (item) return item['second-color'];
    return null;
  }

  public GetItem(id: string) {
    return this.items[id];
  }

  public Show(id: string, show = true){
    if (this.items[id]){
      this.items[id].node.style.display = show ? 'inline-block' : 'none';
    }
    else console.warn(`can't show id ${id}`);
  }

  public UpdateIcon(id: string, icon: string) {

    const item = this.items[id];
    const element = item.node.querySelector('use');
    if (element) {
      element.setAttributeNS(XlinkNS, 'href', '#' + icon);
    }
  }

  public UpdateTitle(id: string, title: string) {
    const item = this.items[id];
    if (item) {
      item.node.setAttribute('title', title);
    }
  }

  public UpdateAlternateID(id: string, alternate_id: string) {
    const item = this.items[id];
    if (item) {
      item.alternate_id = alternate_id;
    }
  }

  public Update(id: string, value: string) {
    if (this.items[id]) {
      const item = this.items[id];
      if (item.type === 'input') {
        if (item.input) item.input.value = value;
      }
    }
    else console.warn(`can't update id ${id}`);
  }

  private AddSeparator(container: HTMLElement) {
    const div = document.createElement('div');
    div.classList.add('separator');
    container.appendChild(div);
  }

  private HidePopup(){
    this.popup.style.display = 'none';
    this.popup_item = undefined;
  }

  private TranslateColor(color: string) {

    // check for 3 or 6 hex digits but missing #
    if (/^[a-f0-9]{3}$/i.test(color) || /^[a-f0-9]{6}$/i.test(color)) {
      return '#' + color;
    }

    // FIXME: test for junk? how can you distinguish?
    return color;

  }

  private HandlePopupEvent(event: Event) {
    const node = event.target as HTMLElement;

    if (!node) return;

    if (node.tagName === 'INPUT') {
      if (event.type === 'change' &&
          this.popup_item && this.popup_item.color && this.popup_item.id) {
        const color = this.TranslateColor((node as HTMLInputElement).value || '');
        this.SetSecondColor(this.popup_item.id, color);
        this.Publish(this.popup_item.id, this.popup_item);
        this.HidePopup(); // actually not necessary, because grid will steal focus
      }
      return;
    }

    if (this.popup_item && this.popup_item.id && node.tagName === 'A') {
      if (this.popup_item.color) {
        const color = node.style.backgroundColor || '';
        this.SetSecondColor(this.popup_item.id, color);
      }
      else if (this.popup_item.id === 'note') {
        if (node.id === 'ok-button') {
          const textarea = this.popup.querySelector('textarea');
          if (!textarea) throw new Error('missing node');
          this.dialog_note = textarea.value || '';
        }
        else if (node.id === 'clear-button') {
          this.dialog_note = '';
        }
      }
      else {
        this.popup_item.value = node.textContent || '';
      }

      this.Publish(this.popup_item.id, this.popup_item);
      this.HidePopup(); // actually not necessary, because grid will steal focus
    }
    else if (this.popup_item && this.popup_item.border ) {

      let button: HTMLElement = node;
      while (button.tagName !== 'BUTTON' && button !== this.popup) {
        button = button.parentNode as HTMLElement;
        if (!button) break;
      }

      if (button && button.tagName === 'BUTTON') {

        const id = button.getAttribute('data-id') || '';
        const item = this.popup_item;

        this.HidePopup();
        this.UpdateTitle('border-option', button.getAttribute('title') || '');
        this.UpdateIcon('border-option', button.getAttribute('data-icon') || '');
        this.UpdateAlternateID('border-option', id);

        this.Publish(id, item);

      }
    }

  }

  private ColorPopup(item: ToolbarItemImpl) {

    const chooser = document.createElement('div');
    chooser.classList.add('color-chooser');

    const colors = document.createElement('div');
    colors.classList.add('color-chooser-items');

    let link = document.createElement('a');
    link.classList.add('color-chooser-item', 'no-color');
    link.setAttribute('title', item['default-string'] || 'No color');
    colors.appendChild(link);

    for (const color of this.colors) {
      link = document.createElement('a');
      link.classList.add('color-chooser-item');
      link.setAttribute('title', color);
      link.style.background = color;
      colors.appendChild(link);
    }

    chooser.appendChild(colors);

    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'New color');
    chooser.appendChild(input);

    this.popup.appendChild(chooser);

  }

  private NotePopup(item: ToolbarItemImpl) {

    const container = document.createElement('div');
    this.popup.appendChild(container);

    const header = document.createElement('div');
    header.textContent = Area.CellAddressToLabel(this.current_cell);

    // early, so we can click it
    const ok = document.createElement('a');

    // cache
    this.dialog_cell = {...this.current_cell};
    container.appendChild(header);

    const textarea = document.createElement('textarea');
    textarea.textContent = this.current_note;
    textarea.addEventListener('keydown', (event: KeyboardEvent) => {
      if ((event.keyCode === 13 || event.which === 13) && event.ctrlKey) {
        event.stopPropagation();
        event.preventDefault();
        ok.click();
      }
    });
    container.appendChild(textarea);

    const buttons = document.createElement('div');
    container.appendChild(buttons);

    ok.textContent = 'OK';
    ok.setAttribute('id', 'ok-button');
    buttons.appendChild(ok);

    const clear = document.createElement('a');
    clear.textContent = 'Clear Note';
    clear.setAttribute('id', 'clear-button');
    buttons.appendChild(clear);

  }

  private BorderPopup(item: ToolbarItemImpl) {

    const holder = document.createElement('div');
    holder.classList.add('border-list-holder');

    const list = document.createElement('div');
    list.classList.add('list');

    const options = [
      { icon: 'icon-border_clear', id: 'border-none', title: 'Clear Borders' },
      { icon: 'icon-border_outer', id: 'border-outer', title: 'Outer Border' },
      { icon: 'icon-border_top', id: 'border-top', title: 'Top Border' },
      { icon: 'icon-border_bottom', id: 'border-bottom', title: 'Bottom Border' },
      { icon: 'icon-border_left', id: 'border-left', title: 'Left Border' },
      { icon: 'icon-border_right', id: 'border-right', title: 'Right Border' },
      { icon: 'icon-border_all', id: 'border-all', title: 'All Borders' },
    ];

    for (const option of options) {
      const button = document.createElement('button');
      button.setAttribute('title', option.title);
      button.setAttribute('data-id', option.id);
      button.setAttribute('data-icon', option.icon);

      const svg = document.createElementNS(SVGNS, 'svg');
      const element = document.createElementNS(SVGNS, 'use');
      svg.appendChild(element);
      element.setAttributeNS(XlinkNS, 'href', '#' + option.icon);
      button.appendChild(svg);

      list.appendChild(button);
    }

    holder.appendChild(list);
    this.popup.appendChild(holder);

  }

  private SubmenuPopup(item: ToolbarItemImpl){

    const holder = document.createElement('div');
    holder.classList.add('list-holder');

    const list = document.createElement('div');
    list.classList.add('list');

    if (item.submenu) {
      for (const subitem of item.submenu) {
        if (typeof subitem === 'string') {
          const link = document.createElement('a');
          link.textContent = subitem;
          list.appendChild(link);
        }
        else {
          if (subitem.type === 'separator') {
            const separator = document.createElement('div');
            separator.classList.add('separator');
            list.appendChild(separator);
          }
          else {
            const link = document.createElement('a');
            link.textContent = subitem.text || '';
            list.appendChild(link);
          }
        }
      }
    }

    holder.appendChild(list);
    this.popup.appendChild(holder);

  }

  private ShowPopup(reference: HTMLElement, item: ToolbarItemImpl){

    // we get called twice on mousedown and click, so ignore the
    // second one. we leave the click handler to handle keyboard
    // "clicks" (tab to button, enter)

    if (this.popup_item === item) {
      return;
    }

    this.popup_item = item;

    const br = reference.getBoundingClientRect();
    this.popup.style.top = `${br.bottom + 6}px`;
    this.popup.style.left = `${br.left}px`;

    this.popup.textContent = '';
    this.popup.classList.remove('popup-color');
    this.popup.classList.remove('popup-border');
    this.popup.classList.remove('popup-submenu');
    this.popup.classList.remove('popup-note');

    if (item.color) {
      this.ColorPopup(item);
      this.popup.classList.add('popup-color');
    }
    else if (item.border) {
      this.BorderPopup(item);
      this.popup.classList.add('popup-border');
    }
    else if (item.id === 'note') {
      this.NotePopup(item);
      this.popup.classList.add('popup-note');
    }
    else {
      this.SubmenuPopup(item);
      this.popup.classList.add('popup-submenu');
    }

    this.popup.style.display = 'block';

    let focus_node: HTMLElement|null = this.popup.querySelector('input');
    if (!focus_node) focus_node = this.popup.querySelector('textarea');

    if (focus_node) focus_node.focus();
    else this.popup.focus();

  }

  private PopulateItems(template: ToolbarItem|ToolbarItem[], container: HTMLElement) {

    if (Array.isArray(template)) {
      const group = document.createElement('div');
      group.classList.add('toolbar-group');
      container.appendChild(group);
      for (const item of template) this.PopulateItems(item, group);
    }
    else {
      switch (template.type) {
      case 'drop-down':
        this.AddDropDown(template, container);
        break;
      case 'input':
        this.AddInput(template, container);
        break;
      case 'split':
        this.AddSplit(template, container);
        break;
      case 'separator':
        this.AddSeparator(container);
        break;
      case 'button':
      default:
        this.AddButton(template, container);
        break;
      }
    }

  }

  private AddDropDown(template: ToolbarItem, container: HTMLElement){
    const button = document.createElement('button');
    button.classList.add('drop-down');

    if (template.id) {
      button.setAttribute('id', 'toolbar-item-' + template.id);
      this.items[template.id] = {
        ...template,
        node: button,
      };
    }

    container.appendChild(button);
  }

  private AddInput(template: ToolbarItem, container: HTMLElement) {

    const group = document.createElement('div');
    group.classList.add('input');

    const input = document.createElement('input');
    input.setAttribute('type', 'text');

    if (template.text) {
      const header = document.createElement('button');
      header.classList.add('input-header');

      const span = document.createElement('span');
      span.textContent = template.text;

      // header.innerText = template.text;
      header.appendChild(span);

      if (template.title) {
        header.setAttribute('title', template.title);
      }
      group.appendChild(header);
    }

    group.appendChild(input);

    if (template.id) {
      group.setAttribute('id', 'toolbar-item-' + template.id);
      this.items[template.id] = {
        ...template,
        node: group,
        input,
      };
    }

    container.appendChild(group);

  }

  private AddSplit(template: ToolbarItem, container: HTMLElement) {
    const div = document.createElement('div');
    div.classList.add('split-button');

    for (const subitem of template.submenu || []) {
      const button = document.createElement('button');
      if (template.submenu && template.submenu[0]) {
        if (typeof subitem === 'string') {
          const span = document.createElement('span');
          span.textContent = subitem;
          button.appendChild(span);
        }
        else {
          const span = document.createElement('span');
          span.textContent = subitem.text || '';
          button.appendChild(span);
          if (subitem.id) {
            button.setAttribute('id', 'toolbar-item-' + subitem.id);
            this.items[subitem.id] = {
              ...subitem, node: button,
            };
          }
          if (subitem.title) {
            button.setAttribute('title', subitem.title);
          }
        }
      }
      div.appendChild(button);
    }

    container.appendChild(div);
  }

  private AddButton(template: ToolbarItem, container: HTMLElement) {
    const button = document.createElement('button');

    if (template.class) {
      button.classList.add(template.class);
    }
    if (template.title) {
      button.setAttribute('title', template.title);
    }
    if (template.text) {
      button.textContent = template.text;
    }
    if (template.icon) {
      const svg = document.createElementNS(SVGNS, 'svg');
      const element = document.createElementNS(SVGNS, 'use');
      svg.appendChild(element);
      element.setAttributeNS(XlinkNS, 'href', '#' + template.icon);
      button.appendChild(svg);
    }

    if (template.id) {
      button.setAttribute('id', 'toolbar-item-' + template.id);
      this.items[template.id] = {
        ...template,
        node: button,
      };
    }

    container.appendChild(button);
  }

  private Publish(id: string, data?: any) {
    Yield().then(() => {
      for (const handler of this.handlers) {
        handler(id, data);
      }
    });
  }

}
