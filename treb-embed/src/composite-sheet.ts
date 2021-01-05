

import { symbols } from './symbol-defs';
import { CreateSheetOptions, DefaultOptions } from './options';
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { composite, Resizable } from 'treb-utils';
// import { ToolbarOptions, CompositeToolbar as FormattingToolbar } from './toolbar/';
import { css } from 'treb-utils';
import { Toolbar } from './toolbar';

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

export interface DecoratedHTMLElement extends HTMLElement {
  _spreadsheet: any;
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

  /** reference to the button so we can update the title on state */
  public toolbar_button?: HTMLElement;

  /** sheet instance */
  public sheet: EmbeddedSpreadsheet;

  /** options will get passed down to sheet */
  public options: CreateSheetOptions;

  /** toolbar instance, moved from embedded sheet */
  // public toolbar?: FormattingToolbar;
  public toolbar?: Toolbar;

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

    // UPDATE: only force if it's position:static, which we don't support.
    // optimally we should not do this, just warn, but it's going to break
    // too many things. [...]

    const container_style = window.getComputedStyle(container);
    if (container_style.position === 'static') {
      container.style.position = 'relative';
    }
    
    // set a default size if there's no width or height (fixme: one or the other?)
    const rect = this.outer_container.getBoundingClientRect();
    if (!this.options.headless && (!rect.width || !rect.height)) {
      this.outer_container.classList.add('default-spreadsheet-size');
    }

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

     this.toolbar_button = this.AddSidebarButton({
        icon: 'treb-toolbar-icon',
        title: 'Show Toolbar',
        click: () => this.ToggleToolbar(),
      });

      this.outer_container.appendChild(this.toolbar_container);

      this.sheet.toolbar_ctl = { Show: (show: boolean) => this.ShowToolbar(show) };

    }

    if (this.options.export) {
      this.AddSidebarButton({
        icon: 'treb-export-icon',
        title: 'Download as XLSX',
        click: () => this.sheet.Export(),
      });
    }

    if (this.options.popout) {
      this.AddSidebarButton({
        icon: 'treb-popout-icon',
        title: 'Open in New Tab',
        click: () => this.Popout(),
      });
    }

    if (this.options.fork) {
      this.AddSidebarButton({
        icon: 'treb-fork-icon',
        title: 'Fork and Edit',
        click: () => {
          const host = 'https://treb.app';
          const new_window = window.open(host + '/edit?fork');
          if (new_window) { this.sheet.PostDocument(new_window, host); }
        }
      });
    }

    this.AddSidebarButton({
      icon: 'treb-about-icon',
      title: `What's This?`,
      click: () => // this.About(),
        this.sheet.About(),
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

    (options.container as DecoratedHTMLElement)._spreadsheet = this.sheet; // ?

  }

  /**
   * popout, or "open in new tab". WIP.
   */
  public Popout(): void {

    const new_window = window.open('', '_blank');
    if (!new_window) { return; }

    new_window.document.head.innerHTML = composite`
      <title>${
        this.sheet.document_name ?
        `TREB: ${this.sheet.document_name}` : 
        'TREB: Untitled Document'}</title>
      <meta charset='utf-8'>
      <meta http-equiv='X-UA-Compatible' content='IE=edge'>
      <meta name='viewport' content='width=device-width,initial-scale=1'>  
      <link rel='icon' type='image/svg+xml' href='https://treb.app/leaf.svg'>
    `;

    /*
    new_window.document.title = this.sheet.document_name ?
      `TREB: ${this.sheet.document_name}` : 'TREB: Untitled Document';

    // this is synchronous, right? we determined that when we
    // were testing yield() implementations.

    // <link rel="icon" type="image/svg+xml" href="/leaf.svg">

    let meta = new_window.document.createElement('meta') as HTMLMetaElement;
    meta.setAttribute('charset', 'utf-8');
    new_window.document.head.appendChild(meta);

    meta = new_window.document.createElement('meta') as HTMLMetaElement;
    meta.httpEquiv = 'X-UA-Compatible';
    meta.content = 'IE=edge';
    new_window.document.head.appendChild(meta);

    meta = new_window.document.createElement('meta') as HTMLMetaElement;
    meta.name = 'viewport';
    meta.content = 'width=device-width,initial-scale=1';
    new_window.document.head.appendChild(meta);

    const link = new_window.document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('type', 'image/svg+xml');

    // either one of these works in firefox, but neither works in chrome.
    // haven't checked safari/edge.

    // link.setAttribute('href', `data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1 Basic//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11-basic.dtd'%3E%3Csvg version='1.1' baseProfile='basic' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='64px' height='64px' viewBox='0 0 64 64' xml:space='preserve'%3E%3Cpath fill='%238CC63F' d='M37.913,14.323c-2.042,0-7.067,2.558-8.72,3.481c-0.959-1.012-1.065-2.522-1.243-4.475 c-0.959,0.994-0.337,4.014,0,5.115c-4.19,3.125-7.707,6.357-11.295,10.016c-1.225-1.936-2.06-3.517-2.344-7.033 c-1.243,2.664,0.355,6.163,1.278,8.098c-3.96,4.99-7.885,10.354-11.064,15.486C-10.001,14.323,34.344-3.916,63.327,8.641 c-17.955,11.952-22.59,49.672-54.13,39.639c-2.22,3.197-3.712,7.37-5.541,11.082c-1.527,0.107-2.593-0.675-2.983-1.278 c3.072-7.441,7.033-13.995,11.082-20.459c4.387,0.125,8.737,0.195,12.36-0.426c-3.144-0.834-6.908-0.319-10.655-1.278 c2.291-4.387,5.63-7.726,8.95-11.082c3.605,0.32,7.264,1.314,11.082,0.426c-3.32-0.586-6.535-0.799-9.377-1.705 C27.223,20.131,33.438,16.401,37.913,14.323z'/%3E%3C/svg%3E%0A`);
    link.setAttribute('href', 'https://treb.app/leaf.svg');

    new_window.document.head.appendChild(link);
    */

    const treb_script = new_window.document.createElement('script');
    treb_script.src = this.sheet.script_path;
    treb_script.setAttribute('type', 'text/javascript');
    new_window.document.body.appendChild(treb_script);

    /*

    // charts are now integrated, no extra tag

    // check if charts are loaded, and if so, do that

    const scripts = document.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      if (/embedded-treb-charts/i.test(scripts[i].src)) {
        const chart_script = new_window.document.createElement('script');
        chart_script.src = scripts[i].src;
        chart_script.setAttribute('type', 'text/javascript');
        new_window.document.body.appendChild(chart_script);
        break;
      }
    }
    */

    const document_data = JSON.stringify(this.sheet.SerializeDocument(true, true));

    const style = new_window.document.createElement('style');
    style.setAttribute('type', 'text/css');

    // we have a special loader that can transform tagged templates -- this
    // one (css) is just pass-through, but the loader will remove all whitespace.
    // it will remove the tag, too (but leave the template -- ts can remove it
    // if there are no interpolations).

    style.textContent = css`

      * { 
        box-sizing: border-box;
        padding: 0;
        margin: 0;
      }
      
      body, html {
        height: 100%;
        width: 100%;
        position: relative;
      }
      
      .treb {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        position: absolute;
        background: #fff;
      }
      
    `;

    new_window.document.head.appendChild(style);

    const div = new_window.document.createElement('div');

    // IE11. I'm guessing the polyfill doesn't work here because we're
    // talking to the new window

    // div.classList.add('treb', 'treb-fullscreen-padding');
    div.setAttribute('class', 'treb treb-fullscreen-padding');

    new_window.document.body.appendChild(div);

    // use our options, but drop container or we'll be stringifying the 
    // whole DOM. also we have some other defaults...

    // ~ not really testing for desktop/mobile, just available space.
    //   what's the ipad width in landscape?

    const desktop = window.screen.availWidth >= 1200;

    const script = new_window.document.createElement('script');
    const target_options: CreateSheetOptions = {
      ...this.options,
      container: undefined,
      network_document: undefined,
      storage_key: undefined,
      resizable: false,
      export: true,
      scroll: undefined,
      toolbar: desktop ? 'show' : true,
      file_menu: true,
      prompt_save: true,
      expand_formula_button: desktop,
      popout: false,    // ?
      add_tab: true,
      tab_bar: 'auto',
      headless: false,  // !
      dnd: true,        // we have an "open" button anyway
      collapsed: !desktop, // false, // true,  // ? what about mobile?
    };

    // this works great -- ts will convert to es6 or es5, as appropriate,
    // so that when we call toString we get the appropriate level code.
    // the only thing we can't do is inline the data, but we can do that
    // in the call (below).

    const func = (options: any, data: string) => {

      let attempts = 0;
      const load = () => {
        options.container = document.querySelector('.treb') as HTMLElement;

        // these are sloppy from ts perspective but this will get 
        // transpiled away, so it will ultimately be cleaner

        if (options.container && (window as any).TREB) {
          (window as any).sheet = (window as any).TREB.CreateSpreadsheet(options);
          (window as any).sheet.LoadDocument(data);
        }
        else{
          if (++attempts < 32) {
            setTimeout(() => load(), 100);
          }
        }
      };
      load();

    };

    script.textContent = `(${func.toString()})(${JSON.stringify(target_options)},${document_data})`;

    new_window.document.body.appendChild(script);
    new_window.document.close();

  }

  /* * show about page * /
  public About(): void {
    if (/about-treb/.test(document.location.href.toString()) || /^about treb$/i.test(document.title)) {
      alert('This is the about page.');
    }
    else {
      window.open('https://treb.app', 'about-treb'); // <- FIXME: absolute, to canonical host
    }
  }
  */

  /** add sidebar button */
  public AddSidebarButton(options: SidebarButtonOptions = {}, container = this.sidebar): HTMLDivElement {

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

    if (options.click) {
      const callback = options.click;
      button.addEventListener('click', () => callback());
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
  public ToggleSidebar(): void {
    this.outer_container.classList.toggle(sidebar_open_class);
  }

  /** show or hide sidebar */
  public ShowSidebar(show = true): void {
    if (show) {
      this.outer_container.classList.add(sidebar_open_class);

    }
    else {
      this.outer_container.classList.remove(sidebar_open_class);
    }
  }

  /** alias */
  public HideSidebar(): void { this.ShowSidebar(false); }

  /** toggle toolbar */
  public ToggleToolbar(): void {

    // we're doing this manually so we can control the actual toolbar
    // const has_class = new RegExp('(?:^|\\s)' + toolbar_open_class + '(?:$|\\s)').test(this.outer_container.getAttribute('class') || '');
    
    this.ShowToolbar(!this.outer_container.classList.contains(toolbar_open_class));

    // this.outer_container.classList.toggle(toolbar_open_class);
  }

  /** show or hide toolbar */
  public ShowToolbar(show = true): void {

    let toolbar_button_title = 'Hide Toolbar';

    if (show) {

      /*
      // if (!this.toolbar && this.toolbar_container) {
      if (!this.sheet.toolbar && this.toolbar_container) {

        / *

        const options: ToolbarOptions = {
          add_delete_sheet: !!this.options.add_tab,
          file_toolbar: !!this.options.file_menu,
          chart_menu: !!this.options.chart_menu,
          compressed_align_menus: (
            this.options.toolbar === 'compressed' ||
            this.options.toolbar === 'show-compressed'),
          // file_menu: this.options.toolbar_file_menu,
        };

        this.toolbar = new FormattingToolbar(
          this.sheet, 
          this.toolbar_container, 
          options);
  
          * /

        this.sheet.CreateToolbar(this.toolbar_container);

        // this is a patch for old behavior, which should be removed

        const toolbar_node = this.toolbar_container.querySelector('.treb-formatting-toolbar');
        if (toolbar_node) {
          (toolbar_node as HTMLElement).style.marginBottom = '0';
        }
        */

        if (this.toolbar_container && !this.toolbar) {
          this.toolbar = this.sheet.CreateToolbar(this.toolbar_container);
        }

      this.outer_container.classList.add(toolbar_open_class);
    }
    else {
      this.outer_container.classList.remove(toolbar_open_class);
      toolbar_button_title = 'Show Toolbar';
    }

    if (this.toolbar_button) {
      this.toolbar_button.setAttribute('title', toolbar_button_title);
    }

  }

  /** alias */
  public HideToolbar(): void { this.ShowToolbar(false); }

}

