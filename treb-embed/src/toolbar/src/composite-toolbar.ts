
/**
 * unifying the old two-class toolbar structure, and cleaning up. WIP.
 */

import { ToolbarOptions, ToolbarItem } from './toolbar-types';

import { NumberFormat, NumberFormatCache } from 'treb-format';
import { BorderConstants, Grid, GridSelection, GridEvent } from 'treb-grid';

import { BuildToolbarTemplate } from './toolbar-template';
import { Measurement } from 'treb-utils';
import { ICellAddress, Area, Style } from 'treb-base-types';

import { symbol_defs } from './symbol-defs';
import { icons as new_icons } from './icons';

import { UA } from 'treb-grid';

import { EmbeddedSpreadsheetBase } from '../../embedded-spreadsheet-base';
import { EmbeddedSheetEvent } from 'treb-embed/src/types';

import '../style/toolbar.scss';

const default_colors = [
  '#000', '#333', '#666', '#999', '#ccc', '#fff',
];

const CreateSVGElement = document.createElementNS.bind(document, 'http://www.w3.org/2000/svg') as (tag: string) => SVGElement;

interface ToolbarItemImpl extends ToolbarItem {
  node: HTMLElement;
  input?: HTMLInputElement;
}

export class CompositeToolbar {

  public current_note = '';
  public current_cell: ICellAddress = {row: -1, column: -1};

  // we use different fields for the dialog to cover the (maybe rare)
  // case where the selection switches after the dialog closes but before
  // we handle the event

  public dialog_cell: ICellAddress = {row: -1, column: -1};
  public dialog_note = '';

  // private handlers: EventHandler[] = [];
  private items: {[index: string]: ToolbarItemImpl} = {};
  private colors: string[] = [];
  private formats: Array<string|ToolbarItem> = [];
  private popup!: HTMLElement;
  private popup_item?: ToolbarItemImpl;

  /** using a list instead of querying every time (over-optimization) */
  private active_items: HTMLElement[] = [];

  ////////////////////////////////////////

  /** inject SVG, once, and lazily */
  public static InjectSVG() {
    if (this.svg_injected) return;

    // const svg = document.createElementNS(SVGNS, 'svg');
    const svg = CreateSVGElement('svg');
    svg.setAttribute('style', 'position: absolute; width: 0; height: 0; overflow: hidden;');
    svg.setAttribute('version', '1.1');
    svg.setAttribute('toolbar-icons', '1');

    // const pattern = document.createElementNS(SVGNS, 'pattern');
    const pattern = CreateSVGElement('pattern');
    pattern.setAttribute('id', 'hatch-pattern');
    pattern.setAttribute('width', '3');
    pattern.setAttribute('height', '3');
    pattern.setAttribute('patternTransform', 'rotate(45 0 0)');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');

    // const line = document.createElementNS(SVGNS, 'line');
    const line = CreateSVGElement('line') as SVGLineElement;
    line.setAttribute('x1', '1');
    line.setAttribute('y1', '0');
    line.setAttribute('x2', '1');
    line.setAttribute('y2', '10');
    line.style.strokeWidth = '2';
    line.style.stroke = '#999';
    pattern.appendChild(line);

    svg.appendChild(pattern);

    document.body.appendChild(svg);
    this.svg_injected = true;
  }

  /** flag indicating we've done this */
  private static svg_injected = false;

  /** accessor */
  public get visible() { return this.visible_; }

  // tslint:disable-next-line: variable-name
  private visible_ = false;

  /** node for the actual toolbar */
  private node: HTMLElement;

  /** containing node */
  private outer: HTMLElement;

  /** instance of the toolbar class */
  // private toolbar: Toolbar;

  /** cache (a copy of) the current active style */
  private selection_style?: Style.Properties;

  /**
   * live reference to selection, so we don't have to constantly retrieve
   * it (this is less important now that we have a reference to the grid)
   */
  private primary_selection: GridSelection;

  private grid: Grid;

  /**
   * both classes used to have "container" as a property. the inner class'
   * container is what the outer class (in this constructor) calls "node".
   * 
   * but I think there's only one reference in the second class, and it's a
   * selector, so it works even if it adds some useless work
   * 
   */
  constructor(
      private sheet: EmbeddedSpreadsheetBase,
      private container: HTMLElement,
      private options: ToolbarOptions = {}) {

    this.grid = (sheet as any).grid; // private

    // prep

    CompositeToolbar.InjectSVG();

    // dom layout

    this.outer = document.createElement('div');
    this.outer.classList.add('treb-formatting-toolbar');

    this.node = document.createElement('div');
    this.node.classList.add('treb-formatting-toolbar-inner');

    container.insertBefore(this.outer, container.firstChild);
    this.outer.appendChild(this.node);

    // internal objects, initial state

    this.InitToolbar(this.node, options);
      
    this.Show('merge', true);
    this.Show('unmerge', false);
    this.SetSecondColor('fill-color', 'yellow');
    this.SetSecondColor('text-color', 'red');

    // events
   
    this.grid.grid_events.Subscribe((event) => this.HandleGridEvent(event));
    this.sheet.Subscribe((event) => this.HandleEvent(event));

    // we now hold a live reference to the selection. we don't need to query
    // every time. this should survive any document changes, since selection
    // is const/readonly.

    this.primary_selection = this.grid.GetSelection(); // live reference

    // update state

    this.UpdateDocumentStyles();
    this.UpdateFreezeState();
    this.UpdateFromSelection();

  }

  /**
   * this is the old inner-class constructor
   */
  public InitToolbar(container: HTMLElement, options: ToolbarOptions = {}) {

    const template = BuildToolbarTemplate(options);
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

    // fucking IE11
    if (UA.trident) {
      this.popup.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
          event.stopPropagation();
          event.preventDefault();
          if (event.target) {
            (event.target as HTMLElement).blur();
          }
        }
      });
    }


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

    let debounce: number|NodeJS.Timeout|undefined;
    let debounce_target: string; // any;

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
            // this.Publish(match[1], item);
            this.HandleToolbar(match[1], item); // yield?
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
            this.HandleToolbar(match[1], item);
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
              this.HandleToolbar(match[1], item);
            }
          }
          return;
        }
        node = node.parentElement as HTMLElement;
        if (!node || node === this.container) return;
      }
    });

  }

  /**
   * show or hide toolbar. this can also be called on resize to update layout.
   * 
   * we don't use this anymore except as a side-effect of resize events, trim
   * down...
   * 
   */
  public ShowToolbar(show = true) {

    this.visible_ = show;
    this.outer.style.display = this.visible_ ? '' : 'none';

    if (show) {

      const toolbar_rect = this.node.getBoundingClientRect();
      const container_rect = this.container.getBoundingClientRect();

      //
      // don't want to use an actual width in here, sloppy
      //
      // actually we can probably assume there's overflow if the widths
      // are ==, that most likely means it's clipping.
      //
      // the original problem was we were not centering properly when
      // the box was too small -- IE11 was reporting the clipped size).
      //

      if (toolbar_rect.width >= container_rect.width) {
        this.outer.classList.add('centered');
      }
      else {
        this.outer.classList.remove('centered');
      }

    }

  }

  /* * explicit hide method * /
  public HideToolbar() {
    this.ShowToolbar(false);
  }

  / ** toggle visibility (useful if you do not store state) * /
  public Toggle() {
    this.ShowToolbar(!this.visible_);
  }
  */

  /** get colors and number formats that are in the document */
  private UpdateDocumentStyles() {

    this.ClearDocumentColors();
    this.ClearDocumentFormats();

    for (const sheet of this.grid.model.sheets) {

      const serialized = sheet.toJSON();

      for (const style of serialized.cell_style_refs) {
        if (style.background) this.AddDocumentColor(style.background);
        if (style.text_color) this.AddDocumentColor(style.text_color);
        if (style.number_format) this.AddDocumentFormat(style.number_format);
      }

      for (const key of Object.keys(serialized.column_style)) {
        const style = serialized.column_style[Number(key)];
        if (style.background) this.AddDocumentColor(style.background);
        if (style.text_color) this.AddDocumentColor(style.text_color);
        if (style.number_format) this.AddDocumentFormat(style.number_format);
      }

      for (const key of Object.keys(serialized.row_style)) {
        const style = serialized.row_style[Number(key)];
        if (style.background) this.AddDocumentColor(style.background);
        if (style.text_color) this.AddDocumentColor(style.text_color);
        if (style.number_format) this.AddDocumentFormat(style.number_format);
      }

    }

  }

  /**
   * handle sheet events. we are really only concerned with new documents,
   * so we can update state
   *
   * UPDATE: also handling resize events
   * FIXME: lock down type
   */
  private HandleEvent(event: EmbeddedSheetEvent) {
    switch (event.type) {
    case 'load':
    case 'reset':
      this.UpdateDocumentStyles();
      this.UpdateFreezeState();
      break;

    case 'resize':
      if (this.visible) {
        this.ShowToolbar(true);
      }
      break;
    }
  }

  /**
   * toggle freeze, depending on current state. uses selection.
   */
  private Freeze() {

    const freeze = this.grid.GetFreeze();
    const frozen = freeze.rows || freeze.columns;

    if (frozen) {
      this.grid.Freeze(0, 0);
    }
    else {
      if (this.primary_selection && !this.primary_selection.empty) {
        const area = this.primary_selection.area as Area;
        if (area.entire_sheet) {
          // ?
        }
        else if (area.entire_row) {
          this.grid.Freeze(area.end.row + 1, 0);
        }
        else if (area.entire_column) {
          this.grid.Freeze(0, area.end.column + 1);
        }
        else {
          this.grid.Freeze(area.end.row + 1, area.end.column + 1);
        }
      }
    }

    this.UpdateFreezeState();

  }

  private UpdateFreezeState() {

    const freeze = this.grid.GetFreeze();
    const frozen = (freeze.rows || freeze.columns);
    
    this.Show('unfreeze3', !!frozen);
    this.Show('freeze3', !frozen);

  }

  /**
   * handle grid events. we are only concerned about selection changes,
   * so we can update the toolbar button states
   */
  private HandleGridEvent(event: GridEvent) {
    if (event.type === 'selection') {
      this.UpdateFromSelection();
    }
    /*
    else if (event.type === 'data' || event.type === 'style') {
      // console.info('dirty', event);
      // if (this.current_file) {
      //   this.file_list.State(this.current_file, FileState.dirty);
      // }
    }
    */
  }

  /**
   * update toolbar buttons -- essentially set toggle buttons for various
   * styles (alignment, merge, number format, &c).
   */
  private UpdateFromSelection() {

    let format = '';
    let merged = false;

    this.DeactivateAll();

    if (this.primary_selection && !this.primary_selection.empty) {
      let data = this.grid.model.active_sheet.CellData(this.primary_selection.target);
      merged = !!data.merge_area;
      if (merged && data.merge_area && (
          data.merge_area.start.row !== this.primary_selection.target.row ||
          data.merge_area.start.column !== this.primary_selection.target.column)) {
        data = this.grid.model.active_sheet.CellData(data.merge_area.start);
      }

      const style = data.style;
      this.selection_style = style;
      if (style) {
        format = style.number_format || '';

        if (style.horizontal_align === 1) this.ActivateItem('align-left');
        else if (style.horizontal_align === 2) this.ActivateItem('align-center');
        else if (style.horizontal_align === 3) this.ActivateItem('align-right');

        if (style.vertical_align === 1) this.ActivateItem('align-top');
        else if (style.vertical_align === 2) this.ActivateItem('align-bottom');
        else if (style.vertical_align === 3) this.ActivateItem('align-middle');

        if (style.wrap) this.ActivateItem('wrap');

      }
      if (format) {
        format = NumberFormatCache.SymbolicName(format) || format;
      }

      this.UpdateItem({
        id: 'note', 
        title: data.note ? 'Edit Note' : 'Add Note'
      });

      this.current_cell = {...this.primary_selection.target};
      this.current_note = data.note || '';

    }

    this.UpdateItem({
      id: 'number-format', 
      value: format,
    });

    this.Show('merge', !merged);
    this.Show('unmerge', merged);
    this.UpdateFreezeState();

  }

  /**
   * this used to be called via an event dispatch, so it was async.
   * we're now calling it directly. should we add a Yield() in front?
   * 
   * (...)
   * 
   */
  private HandleToolbar(id: string, template: ToolbarItem) {

    const style: Style.Properties = {};

    const template_id = template.alternate_id || template.id;

    switch (template_id) {

      case 'structure':
        switch (template.value?.toLowerCase()) {
          case 'insert-sheet':
            this.grid.InsertSheet();
            break;

          case 'delete-sheet':
            this.grid.DeleteSheet();
            break;

          case 'insert-row':
            this.grid.InsertRow();
            break;

          case 'insert-column':
            this.grid.InsertColumn();
            break;

          case 'delete-row':
            this.grid.DeleteRows();
            break;

          case 'delete-column':
            this.grid.DeleteColumns();
            break;

        }
        break;

      case 'save':
        this.sheet.SaveLocalFile();
        break;
      
      case 'load':
        this.sheet.LoadLocalFile();
        break;
      
      case 'new':
        this.sheet.Reset(); // FIXME: prompt?
        break;

      case 'freeze3':
      case 'unfreeze3':
      case 'freeze2':
        this.Freeze();
        break;

      case 'merge':
        this.grid.MergeSelection();
        break;

      case 'unmerge':
        this.grid.UnmergeSelection();
        break;

      case 'number-format':
        style.number_format = template.value || '';
        if (style.number_format) this.AddDocumentFormat(style.number_format);
        break;

      case 'align-top':
        style.vertical_align = 1;
        break;

      case 'align-middle':
        style.vertical_align = 3;
        break;

      case 'align-bottom':
        style.vertical_align = 2;
        break;

      case 'align-left':
        style.horizontal_align = 1;
        break;

      case 'align-center':
        style.horizontal_align = 2;
        break;

      case 'align-right':
        style.horizontal_align = 3;
        break;

      case 'wrap':
        if (this.selection_style && this.selection_style.wrap) {
          style.wrap = false;
        }
        else style.wrap = true;
        break;

      case 'border-bottom':
        if (this.selection_style && this.selection_style.border_bottom === 1) {
          this.grid.ApplyBorders(undefined, BorderConstants.Bottom, undefined, 2);
        }
        else {
          this.grid.ApplyBorders(undefined, BorderConstants.Bottom);
        }
        break;

      case 'border-all':
        this.grid.ApplyBorders(undefined, BorderConstants.All);
        break;

      case 'border-outer':
        this.grid.ApplyBorders(undefined, BorderConstants.Outside);
        break;

      case 'border-right':
        this.grid.ApplyBorders(undefined, BorderConstants.Right);
        break;

      case 'border-left':
        this.grid.ApplyBorders(undefined, BorderConstants.Left);
        break;

      case 'border-top':
        this.grid.ApplyBorders(undefined, BorderConstants.Top);
        break;

      case 'border-none':
        this.grid.ApplyBorders(undefined, BorderConstants.None);
        break;

      case 'text-color':
        style.text_color = this.GetSecondColor(id) || undefined;
        if (style.text_color) this.AddDocumentColor(style.text_color);
        else style.text_color = 'none';
        break;

      case 'fill-color':
        style.background = this.GetSecondColor(id) || undefined;
        if (style.background) this.AddDocumentColor(style.background);
        else style.background = 'none';
        break;

      case 'increase-decimal':
      case 'decrease-decimal':
        if (!this.selection_style) break; // nothing selected
        {
          // style, or generic
          const number_format = this.selection_style.number_format || 'generic'; // shouldn't that be 'general'?
          const format_base = NumberFormatCache.Get(number_format);
          const format_instance = new NumberFormat(format_base.pattern); // clone, basically

          // do nothing to date formats
          if (format_instance.date_format) break;

          // use the format mutation method (make sure this is a clone)
          if (template.id === 'increase-decimal') format_instance.IncreaseDecimal();
          else format_instance.DecreaseDecimal();

          // get pattern returns the unmutated pattern, for some reason. use toString to
          // get the mutated pattern. also: FIXME (in format)
          style.number_format = format_instance.toString();
        }
        break;

      case 'note':
        this.grid.SetNote(undefined, this.dialog_note);
        break;

      default:
        console.info('unhandled command:', template.id);
    }

    if (Object.keys(style).length) {
      this.grid.ApplyStyle(undefined, style, true);
    }

    this.UpdateFromSelection();
    this.grid.Focus();

  }

  ////////////////////////////////////////////////////////////////////////////

  /**
   * set "active" state. this is the semi-highlight showing that
   * a style is applied to the current selection.
   */
  public ActivateItem(id: string) {
    const item = this.items[id];
    if (item) {
      item.node.classList.add('active');
      this.active_items.push(item.node);
    }
  }

  /** remove "active" state */
  public DeactivateItem(id: string){
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

  /** remove "active" state */
  public DeactivateAll() {
    for (const item of this.active_items) {
      item.classList.remove('active');
    }
    this.active_items = [];
  }

  /**
   * FIXME: move strings out (can we interrogate the NF cache?)
   */
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

  /**
   * this is a bit of a hack, for setting the second color in the color
   * buttons. we can't use the variable scheme we use in electron (because
   * IE, natch) so we have to dig a bit deeper. this works, but is not very
   * flexible.
   */
  public SetSecondColor(id: string, color: string) {

    const item = this.items[id];
    if (item && item.icon) {
      const paths = this.container.querySelectorAll(`.treb-toolbar-icon-${item.icon} path`);
      for (let i = 0; i < paths.length; i++) {

        // classList doesn't work in IE11 -- because SVG? not sure.

        let class_name = paths[i].getAttribute('class') || '';

        // update for new (old) icons
        if (/fa-secondary/.test(class_name)) {
          class_name = class_name.replace('fa-secondary', 'target');
          paths[i].setAttribute('class', class_name);
        }

        if (/target/.test(class_name)) {
          const element = paths[i] as HTMLElement;
          if (!color) {
            element.style.fill = 'url(#hatch-pattern)';
            element.style.stroke = 'none';
          }
          else {
            element.style.fill = color;
            element.style.stroke = 'none'; // color;
          }
        }
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

  public UpdateItem(update: ToolbarItem) {
    const item = this.items[update.id||0];
    if (item) {
      if (typeof update.title !== 'undefined') {
        item.node.setAttribute('title', update.title);
      }
      if (typeof update.icon !== 'undefined') {
        const element = item.node.querySelector('svg');
        if (element) {
          this.CreateSVG(update.icon, element as SVGElement);
        }
      }
      if (typeof update.alternate_id !== 'undefined') {
        item.alternate_id = update.alternate_id;
      }
      if (typeof update.value !== 'undefined') {
        if (item.type === 'input' && item.input) {
          item.input.value = update.value;
        }
      }
    }    
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
        this.HandleToolbar(this.popup_item.id, this.popup_item);
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
        const command = node.getAttribute('data-command');
        this.popup_item.value = command || node.textContent || '';
      }

      this.HandleToolbar(this.popup_item.id, this.popup_item);
      this.HidePopup(); // actually not necessary, because grid will steal focus
    }
    else if (this.popup_item && this.popup_item.options ) {

      let button: HTMLElement = node;
      while (button.tagName !== 'BUTTON' && button !== this.popup) {
        button = button.parentNode as HTMLElement;
        if (!button) break;
      }

      if (button && button.tagName === 'BUTTON') {

        const id = button.getAttribute('data-id') || '';
        const item = this.popup_item;
        const item_id = item.id || '';

        this.HidePopup();
        this.UpdateItem({
          id: item_id,
          title: button.getAttribute('title') || '',
          icon: button.getAttribute('data-icon') || '',
          alternate_id: id,
        });

        this.HandleToolbar(id, item);

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

  private NotePopup() {

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

  private OptionsPopup(item: ToolbarItemImpl) {

    const holder = document.createElement('div');
    holder.classList.add('options-list-holder');

    const list = document.createElement('div');
    list.classList.add('list');

    for (const option of item.options || []) {

      if (typeof option === 'string') { continue; }

      const button = document.createElement('button');
      button.setAttribute('title', option.title || '');
      button.setAttribute('data-id', option.id || '');
      button.setAttribute('data-icon', option.icon || '');

      // const svg = document.createElementNS(SVGNS, 'svg');
      // const element = document.createElementNS(SVGNS, 'use');
      // svg.appendChild(element);
      // element.setAttributeNS(XlinkNS, 'href', '#treb-toolbar-icon-' + option.icon);
      if (option.icon) {
        const svg = this.CreateSVG(option.icon);
        button.appendChild(svg);
      }

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
            if (subitem.id) {
              link.setAttribute('data-command', subitem.id);
            }
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
    this.popup.classList.remove('popup-options');
    this.popup.classList.remove('popup-submenu');
    this.popup.classList.remove('popup-note');

    if (item.color) {
      this.ColorPopup(item);
      this.popup.classList.add('popup-color');
    }
    else if (item.options) {
      this.OptionsPopup(item);
      this.popup.classList.add('popup-options');
    }
    else if (item.id === 'note') {
      this.NotePopup();
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

    if (template.icon) {
      const header = document.createElement('button');
      header.classList.add('input-header');

      if (template.icon) {
        const svg = this.CreateSVG(template.icon);
        header.appendChild(svg);
      }

      if (template.title) {
        header.setAttribute('title', template.title);
      }
      group.appendChild(header);

    }

    else if (template.text) {
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

  private CreateSVG(icon: string, target?: SVGElement) {

    const use_new_icon = !!new_icons[icon];
    const old_size = '24';
    const new_size = '24';
    const size = use_new_icon ? new_size : old_size;

    if (!target) {
      target = CreateSVGElement('svg');
      target.setAttribute('width', size);
      target.setAttribute('height', size);
    }
    else {
      target.innerHTML = '';
    }

      const def = symbol_defs[icon] || new_icons[icon];
      if (!def) {
        console.info('no def for', icon);
        return target;
      }


      const symbol = CreateSVGElement('g');
      target.setAttribute('viewBox', def.viewbox || `0 0 ${size} ${size}`);

      let classes_list = 'treb-toolbar-icon-' + icon;
      if (use_new_icon) { classes_list += ' treb-new-icon'; }
      target.setAttribute('class', classes_list);

      for (const path_def of def.paths || []) {
        const path = CreateSVGElement('path');
        path.setAttribute('d', path_def.d);
        if (path_def.style) path.setAttribute('style', path_def.style);
        if (path_def.classes) {
          const classes = Array.isArray(path_def.classes) ? path_def.classes : [path_def.classes];
          path.setAttribute('class', classes.join(' ')); // IE11
        }
        symbol.appendChild(path);
      }
      target.appendChild(symbol);
      return target;
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
      const svg = this.CreateSVG(template.icon);
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

}

