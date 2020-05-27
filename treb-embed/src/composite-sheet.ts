

import { symbols } from './symbol-defs';
import { CreateSheetOptions, DefaultOptions } from './options';
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { Resizable } from 'treb-utils';
import { ToolbarOptions, FormattingToolbar } from 'treb-toolbar';

import '../style/composite-sheet.scss';
import 'treb-base-types/style/resizable.css';

const sidebar_open_class = 'sidebar-open';
const toolbar_open_class = 'toolbar-open';

const SVGNS = 'http://www.w3.org/2000/svg';
const XLINKNS = 'http://www.w3.org/1999/xlink';

interface SidebarButtonOptions {
  command?: string;
  text?: string;
  icon?: string;
  title?: string;
  classes?: string|string[];
  click?: () => void;
}

/**
 * sheet plus toolbar and sidebar (replacement for the old autoembed)
 */
export class CompositeSheet {

  /** flag for svg injection */
  public static symbols_injected = false;

  /** the caller container */
  public outer_container: HTMLElement;

  /** the container for the actual grid (+ tab bar) */
  public inner_container: HTMLElement;

  /** sidebar we attach */
  public sidebar: HTMLElement;

  /** and toolbar */
  public toolbar_container?: HTMLElement;

  /** sheet instance */
  public sheet: EmbeddedSpreadsheet;

  /** options will get passed down to sheet */
  public options: CreateSheetOptions;

  /** toolbar instance, moved from embedded sheet */
  public toolbar?: FormattingToolbar;

  /** auto-embed */
  public static AutoEmbed() {

    const elements = document.querySelectorAll('div[data-treb]');

    for (let i = 0; i < elements.length; i++) {

      const element = elements[i];
      if ((element as any)._spreadsheet) continue; // already attached

      const options: any = {
        container: element,
        network_document: element.getAttribute('data-treb') || undefined,
      };

      // dropping old-style options, they've been deprecated for a while

      const options_list = element.getAttribute('data-options');
      if (options_list) {
        const pairs = options_list.split(/,/g);
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key) {
            if (typeof value === 'undefined') {
              options[key] = true;
            }
            else if (/^(?:true|false)/i.test(value)) {
              options[key] = (value.toLowerCase() !== 'false');
            }
            else if (!isNaN(value as any)) {
              options[key] = Number(value);
            }
            else {
              options[key] = value;
            }
          }
        }
      }

      const sheet = CompositeSheet.Create(options);

      // optional load callback
      const load = options.load || element.getAttribute('data-load');
      if (load) {
        const aself = (self as any);
        if (aself[load]) {
          aself[load](sheet, element); // callback wants sheet, not embed
        }
        else {
          console.warn(`function ${load} not found`);
        }
      }

    }

  }

  /** 
   * inject svg symbol defs (once)
   *
   * NOTE: we stopped using <use/> for the toolbar, because it (apparently)
   * only supports single-color rendering. should we stop using it for the 
   * sidebar as well? something to think about.
   */
  public static EnsureSymbols() {

    if (this.symbols_injected) { return; }
    this.symbols_injected = true;

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.overflow = 'hidden';

    const defs = document.createElementNS(SVGNS, 'defs');
    svg.appendChild(defs);

    for (const id of Object.keys(symbols)) {
      const symbol = symbols[id];
      const node = document.createElementNS(SVGNS, 'symbol');
      node.setAttribute('id', id);
      if (symbol.viewbox) {
        node.setAttribute('viewBox', symbol.viewbox);
      }
      for (const path of symbol.paths || []) {
        const path_node = document.createElementNS(SVGNS, 'path');
        path_node.setAttribute('d', path);
        node.appendChild(path_node);
      }
      defs.appendChild(node);
    }

    document.body.insertBefore(svg, document.body.firstChild || null);

  }

  /**
   * factory method. we don't necessarily need the class instance, although
   * (in this version) the class has some properties; use the factory method
   * to just get back the embedded sheet.
   */
  public static Create(options: CreateSheetOptions) {
    return new CompositeSheet(options).sheet;
  }

  constructor(options: CreateSheetOptions) { // container: HTMLElement) {

    const container = (typeof options.container === 'string')
      ? document.querySelector(options.container) as HTMLElement
      : options.container;

    if (!container) {
      throw new Error('missing container');
    }
  
    this.options = {
      ...DefaultOptions,
      ...options
    };

    this.outer_container = container;

    // set a default size if there's no width or height (fixme: one or the other?)
    const rect = this.outer_container.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      this.outer_container.classList.add('default-spreadsheet-size');
    }
    this.outer_container.style.position = 'relative'; // force

    this.inner_container = document.createElement('div');
    this.inner_container.classList.add('embedded-spreadsheet-container');

    // initial styles so we don't get animation on load

    if (!this.options.collapsed) {
      this.outer_container.classList.add('sidebar-open');
    }
    if (this.options.toolbar === 'show' || this.options.toolbar === 'show-compressed') {
      this.outer_container.classList.add('toolbar-open');
    }

    this.outer_container.appendChild(this.inner_container);

    this.sheet = new EmbeddedSpreadsheet({
      ...this.options,
      container: this.inner_container,
      resizable: false, // we handle now
    });

    this.sidebar = document.createElement('div');
    this.sidebar.classList.add('embedded-spreadsheet-sidebar');

    CompositeSheet.EnsureSymbols();

    if (this.options.mc) {
      this.AddSidebarButton({
        icon: 'treb-simulation-icon',
        title: 'Run Simulation',
        click: () => this.sheet.RunSimulation(),
      });
    }

    this.AddSidebarButton({
      icon: 'treb-reset-icon',
      title: 'Recalculate',
      click: () => this.sheet.Recalculate(),
    });

    if (this.options.toolbar) {

      this.toolbar_container = document.createElement('div');
      this.toolbar_container.classList.add('toolbar-container');

      this.AddSidebarButton({
        icon: 'treb-toolbar-icon',
        title: 'Show Toolbar',
        click: () => this.ToggleToolbar(),
      });

      this.outer_container.appendChild(this.toolbar_container);

    }

    this.AddSidebarButton({
      icon: 'treb-export-icon',
      title: 'Download as XLSX',
      click: () => this.sheet.Export(),
    });

    this.AddSidebarButton({
      icon: 'treb-fork-icon',
      title: 'Fork and Edit',
      click: () => {
        const host = 'https://treb.app';
        const new_window = window.open(host + '/edit?fork');
        if (new_window) { this.sheet.PostDocument(new_window, host); }
      }
    });

    this.AddSidebarButton({
      icon: 'treb-about-icon',
      title: `What's This?`,
      click: () => this.About(),
    });

    const spacer = document.createElement('div');
    spacer.classList.add('sidebar-spacer');
    this.sidebar.appendChild(spacer);

    this.AddSidebarButton({
      icon: 'treb-chevron-right-icon',
      classes: 'smaller',
      title: 'Hide Sidebar',
      click: () => this.HideSidebar(),
    });

    this.outer_container.appendChild(this.sidebar);

    const show_sidebar_button = this.AddSidebarButton({
      icon: 'treb-chevron-left-icon',
      classes: ['smaller', 'show-sidebar-button'],
      title: 'Show Sidebar',
      click: () => this.ShowSidebar(),
    }, undefined);

    this.outer_container.appendChild(show_sidebar_button);

    if (this.options.resizable) {
      const node = container.querySelector('.treb-grid');
      const master = container.querySelector('.treb-layout-master');
      if (node) {
        Resizable.Create({
          container: this.outer_container, 
          node: node as HTMLElement, 
          resize_callback: () => this.sheet.Resize(), 
          layout_reference: master as HTMLElement || undefined, // this.inner_container,
        });
      }
    }

    if (this.options.toolbar === 'show' || this.options.toolbar === 'show-compressed') {
      this.ShowToolbar(true);
    }

    (options.container as any)._spreadsheet = this.sheet; // ?

  }

  /** show about page */
  public About() {
    if (/about-treb/.test(document.location.href.toString()) || /^about treb$/i.test(document.title)) {
      alert('This is the about page.');
    }
    else {
      window.open('https://treb.app', 'about-treb'); // <- FIXME: absolute, to canonical host
    }
  }

  /** add sidebar button */
  public AddSidebarButton(options: SidebarButtonOptions = {}, container = this.sidebar) {

    const button = document.createElement('div');
    button.classList.add('sidebar-button');

    if (options.classes) {
      const classes = (typeof options.classes === 'string') ? [options.classes] : options.classes;
      for (const class_name of classes) {
        button.classList.add(class_name);
      }
    }

    if (options.title) {
      button.setAttribute('title', options.title);
    }

    if (options.text) {
      button.textContent = options.text;
    }

    /*
    if (options.command) {
      button.setAttribute('data-command', options.command);
    }
    */

    if (options.click) {
      const callback = options.click;
      button.addEventListener('click', callback);
    }

    if (options.icon) {

      const svg = document.createElementNS(SVGNS, 'svg');
      button.appendChild(svg);

      const use = document.createElementNS(SVGNS, 'use');
      use.setAttributeNS(XLINKNS, 'href', '#' + options.icon);
      svg.appendChild(use);
    
    }

    if (container) {
      container.appendChild(button);
    }

    return button;
  }

  /** toggle sidebar */
  public ToggleSidebar() {
    this.outer_container.classList.toggle(sidebar_open_class);
  }

  /** show or hide sidebar */
  public ShowSidebar(show = true) {
    if (show) {
      this.outer_container.classList.add(sidebar_open_class);
    }
    else {
      this.outer_container.classList.remove(sidebar_open_class);
    }
  }

  /** alias */
  public HideSidebar() { this.ShowSidebar(false); }

  /** toggle toolbar */
  public ToggleToolbar() {

    // we're doing this manually so we can control the actual toolbar
    // const has_class = new RegExp('(?:^|\\s)' + toolbar_open_class + '(?:$|\\s)').test(this.outer_container.getAttribute('class') || '');
    
    this.ShowToolbar(!this.outer_container.classList.contains(toolbar_open_class));

    // this.outer_container.classList.toggle(toolbar_open_class);
  }

  /** show or hide toolbar */
  public ShowToolbar(show = true) {
    if (show) {

      if (!this.toolbar && this.toolbar_container) {

        const options: ToolbarOptions = {
          add_delete_sheet: !!this.options.add_tab,
          compressed_align_menus: (
            this.options.toolbar === 'compressed' ||
            this.options.toolbar === 'show-compressed'),
          // file_menu: this.options.toolbar_file_menu,
        };

        this.toolbar = FormattingToolbar.CreateInstance(
          this.sheet, 
          (this.sheet as any).grid, 
          this.toolbar_container, 
          options);
  
        // this is a patch for old behavior, which should be removed

        const toolbar_node = this.toolbar_container.querySelector('.treb-formatting-toolbar');
        if (toolbar_node) {
          (toolbar_node as HTMLElement).style.marginBottom = '0';
        }

      }

      this.outer_container.classList.add(toolbar_open_class);
    }
    else {
      this.outer_container.classList.remove(toolbar_open_class);
    }
  }

  /** alias */
  public HidToolbar() { this.ShowToolbar(false); }

}

