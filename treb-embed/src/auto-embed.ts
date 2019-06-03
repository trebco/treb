
import { symbols } from './symbol-defs';
import { CreateSheetOptions } from './options';
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';

const SVGNS = 'http://www.w3.org/2000/svg';
const XLINKNS = 'http://www.w3.org/1999/xlink';

/** exported as single instance (below) */
class AutoEmbedManager {

  /** these operations are done only once, but only if necessary */
  private injected_symbols = false;

  /** these operations are done only once, but only if necessary */
  private injected_styles = false;

  /**
   * look for div[data-treb] tags and insert sheets
   *
   * FIXME: if we want to support running again, we need to flag any
   * elements we have already attached.
   */
  public Run() {

    const elements = document.querySelectorAll('div[data-treb]');

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if ((element as any)._spreadsheet) continue; // already attached

      // old style
      const options: {[index: string]: any} = {
        container: element as HTMLElement,
        network_document: element.getAttribute('data-treb') || undefined,
        scroll: element.getAttribute('data-scroll') || undefined,
        scrollbars: true,
        formula_bar: true,
        freeze_rows: 0,
        freeze_columns: 0,
        recalculate: false,
        mc: false,
      };

      // new style
      const options_attr = element.getAttribute('data-options');
      if (options_attr) {
        const options_list = options_attr.split(',');
        for (const item of options_list) {
          const key_value: any[] = item.split('=');
          if (key_value.length === 2) {
            if (/^(?:true|false)/i.test(key_value[1])) key_value[1] = (key_value[1].toLowerCase() !== 'false');
            else if (!isNaN(key_value[1])) key_value[1] = Number(key_value[1]);
            options[key_value[0]] = key_value[1];
          }
          else if (key_value.length === 1) {
            options[key_value[0]] = true;
          }
        }
      }

      const sheet = this.CreateSheet(options as CreateSheetOptions);
      const load = options.load || element.getAttribute('data-load');
      if (load) {
        if ((self as any)[load]) {
          (self as any)[load](sheet, element);
        }
        else console.warn(`function ${load} not found`);
      }
    }
  }

  /**
   * create a spreadsheet. this is the exposed method for callers,
   * and is also used in the auto-embed routine
   */
  public CreateSheet(options: CreateSheetOptions) {

    if (typeof options.container === 'string') {
      options.container = document.getElementById(options.container) as HTMLElement;
    }
    if (!options.container) return;
    const container = options.container; // as HTMLElement, for closures

    if (typeof options.decorated !== 'undefined' && !options.decorated) {
      return new EmbeddedSpreadsheet(options);
    }

    const bounding_rect = container.getBoundingClientRect();
    const { width, height } = bounding_rect;

    // why do this? breaks popout... for now we will just remove it

    if (options.auto_size) {
      container.style.width = '100%';
      container.style.height = '100%';
    }
    else {
      container.style.width = 'auto';
      container.style.height = 'auto';
    }

    const composite = document.createElement('div');
    composite.classList.add('treb-composite-container');
    container.appendChild(composite);

    if (options.auto_size) {
      composite.style.width = '100%';
      composite.style.height = '100%';
    }

    composite.classList.add('treb-embedded-spreadsheet');

    if (!this.injected_styles) this.InjectStyles();

    const sheet_container = document.createElement('div');
    sheet_container.classList.add('sheet-container');

    // if there's an explicit size on this node, try to use it (offset for
    // controls). if not, there's a default set in the stylesheet.

    // let's try to justify this: (...)
    // 32 + 14 + 14 = 60
    // 24 + 14 + 14 = 52

    // FIXME: OR, calculate from actual layout?

    // const offset = 60;
    const offset = 52; // smaller icons

    if (options.auto_size) {
      sheet_container.style.width = `calc(100% - ${offset}px)`;
      sheet_container.style.height = `100%`;
    }
    else {
      if (width > 0 && height > 0) {
        sheet_container.style.width = `${width - offset}px`;
        sheet_container.style.height = `${height}px`;
      }
    }

    composite.appendChild(sheet_container);

    const sheet = new EmbeddedSpreadsheet({
      ...options,
      resizable: typeof options.resizable === 'boolean' ? options.resizable : true,
      container: sheet_container,
    });

    // this is circular, but it's not the end of the world
    // (container as any)._sheet = sheet;

    const control_icons = document.createElement('div');
    control_icons.className = 'sheet-control-icons';

    // container.appendChild(control_icons);
    composite.appendChild(control_icons);

    if (options.mc) {
      this.AddIcon(control_icons, 'treb-simulation-icon', 'Run Simulation', () => sheet.RunSimulation(5000));
    }

    this.AddIcon(control_icons, 'treb-reset-icon', 'Recalculate', () => {
      sheet.Recalculate();
    });

    if (options.toolbar) {
      this.AddIcon(control_icons, 'treb-toolbar-icon', 'Formatting', () => {
        sheet.FormattingToolbar(container);
      });
    }

    this.AddIcon(control_icons, 'treb-export-icon', 'Download as XLSX', () => sheet.Export());

    // can we switch this with an env var, cookie, or something?

    const host = /^http:\/\/192\.168\./.test(document.location.origin || '') ?
      document.location.origin : 'https://treb.app';

    this.AddIcon(control_icons, 'treb-fork-icon', 'Fork and Edit', () => {
      const new_window = window.open(host + '/edit?fork');
      if (new_window) { sheet.PostDocument(new_window); }
    });

    // Regarding pop-out: the issue is that if we create an empty window
    // with window.open, it has the address 'about:blank' and then using
    // postMessage fails (we use this a lot, and want to use it to send the
    // sheet data as well). the only way for pop-out to work would be to
    // push to a particular URL, which is fine, unless the sheet is embedded
    // on another page and they don't want that.

    if (options.popout) {

      this.AddIcon(control_icons, 'treb-popout-icon', 'Pop Out', () => {
        const random = `window_${Math.random()}`;

        const window_options: {[index: string]: string} = {
          width: width.toString() || '600',
          height: height.toString() || '400',
          location: 'false',
        };

        const new_window = window.open(host + '/popout', random,
          Object.keys(window_options).map((key) => `${key}=${window_options[key]}`).join(','));

        if (new_window) {
          sheet.PostDocument(new_window);
        }

      });

    }

    this.AddIcon(control_icons, 'treb-about-icon', 'What\'s This?', () => {
      if (/about-treb/.test(document.location.href.toString()) || /^about treb$/i.test(document.title)) {
        alert('This is the about page.');
      }
      else {
        window.open('https://treb.app', 'about-treb'); // <- FIXME: absolute, to canonical host
      }
    });

    (options.container as any)._spreadsheet = sheet;
    return sheet;

  }

  /** inject css (on demand) */
  private InjectStyles() {
    this.injected_styles = true;
    require('../style/inject.scss');
  }

  /** inject svg symbol defs. do this only once, and on demand. */
  private InjectSymbols() {
    this.injected_symbols = true;

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

  /** add an icon to our (side) toolbar */
  private AddIcon(container: HTMLElement, icon: string, title = '', callback?: (event: MouseEvent) => void) {

    if (!this.injected_symbols) {
      this.InjectSymbols();
    }

    const icon_container = document.createElement('div');
    icon_container.className = 'svg-icon-container svg-' + icon;

    if (title) icon_container.setAttribute('title', title);
    if (callback) {
      icon_container.addEventListener('click', (event) => callback(event));
      icon_container.addEventListener('mouseup', (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
      icon_container.addEventListener('mousedown', (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
    }

    const svg = document.createElementNS(SVGNS, 'svg');
    icon_container.appendChild(svg);

    const use = document.createElementNS(SVGNS, 'use');
    use.setAttributeNS(XLINKNS, 'href', '#' + icon);
    svg.appendChild(use);

    container.appendChild(icon_container);

  }

}

// single instance, exported
export const AutoEmbed = new AutoEmbedManager();
