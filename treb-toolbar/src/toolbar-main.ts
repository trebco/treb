

// type EmbeddedSpreadsheet = import('treb-embed/src/index').EmbeddedSpreadsheet;

import { Toolbar } from './toolbar';
import { ToolbarOptions } from './toolbar-options';
import { ToolbarItem } from './toolbar-item';
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { Style } from 'treb-base-types';
import { EventSource } from 'treb-utils';

import '../style/toolbar.scss';

const SVGNS = 'http://www.w3.org/2000/svg';

import { symbol_defs } from './symbol-defs';
import { Area } from 'treb-base-types';
import { BorderConstants, Grid, GridSelection } from 'treb-grid';

/**
 * FIXME: why do we have the two-class structure? (...) the event passing
 * seems unecessary...
 *
 * legacy? this originally came from an older codebase
 *
 * OTOH it adds some compartmentalization, which is useful, and the cost is
 * not super high
 */
export class FormattingToolbar {

  /**
   * factory method
   * FIXME: why?
   */
  public static CreateInstance(
      sheet: EventSource<any>,
      grid: Grid,
      container: HTMLElement,
      options: ToolbarOptions = {}) {

    return new FormattingToolbar(sheet, grid, container, options);
  }

  /** inject SVG, once, and lazily */
  public static InjectSVG() {
    if (this.svg_injected) return;

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('style', 'position: absolute; width: 0; height: 0; overflow: hidden;');
    svg.setAttribute('version', '1.1');

    const pattern = document.createElementNS(SVGNS, 'pattern');
    pattern.setAttribute('id', 'hatch-pattern');
    pattern.setAttribute('width', '3');
    pattern.setAttribute('height', '3');
    pattern.setAttribute('patternTransform', 'rotate(45 0 0)');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');

    const line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', '1');
    line.setAttribute('y1', '0');
    line.setAttribute('x2', '1');
    line.setAttribute('y2', '10');
    line.style.strokeWidth = '2';
    line.style.stroke = '#999';
    pattern.appendChild(line);

    /*
    line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', '0');
    line.setAttribute('x2', '10');
    line.setAttribute('y2', '0');
    line.style.strokeWidth = '1';
    line.style.stroke = '#000';
    pattern.appendChild(line);
    */

    svg.appendChild(pattern);

    /*
    <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="10" style="stroke:black; stroke-width:1" />
    </pattern>
    */

    for (const key of Object.keys(symbol_defs)) {
      const def = symbol_defs[key];
      const symbol = document.createElementNS(SVGNS, 'symbol');
      symbol.setAttribute('id', key);
      symbol.setAttribute('viewBox', def.viewbox);
      for (const path_def of def.paths || []) {
        const path = document.createElementNS(SVGNS, 'path');
        path.setAttribute('d', path_def.d);
        if (path_def.style) path.setAttribute('style', path_def.style);
        symbol.appendChild(path);
      }
      svg.appendChild(symbol);
    }

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
  private toolbar: Toolbar;

  /** cache (a copy of) the current active style */
  private selection_style?: Style.Properties;

  /**
   * live reference to selection, so we don't have to constantly retrieve
   * it (this is less important now that we have a reference to the grid)
   */
  private primary_selection: GridSelection;

  constructor(
      private sheet: EventSource<any>, // FIXME: lock down this type? (...)
      private grid: Grid, // reference
      private container: HTMLElement,
      private options: ToolbarOptions = {}) {

    // prep

    FormattingToolbar.InjectSVG();

    // dom layout

    this.outer = document.createElement('div');
    this.outer.classList.add('treb-formatting-toolbar');

    this.node = document.createElement('div');
    this.node.classList.add('treb-formatting-toolbar-inner');

    container.insertBefore(this.outer, container.firstChild);
    this.outer.appendChild(this.node);

    // internal objects, initial state

    this.toolbar = new Toolbar(this.node, options);

    this.toolbar.Show('merge', true);
    this.toolbar.Show('unmerge', false);
    this.toolbar.SetSecondColor('fill-color', 'yellow');
    this.toolbar.SetSecondColor('text-color', 'red');

    // events

    this.toolbar.On(this.HandleToolbar.bind(this));
    this.grid.grid_events.Subscribe((event: any) => this.HandleGridEvent(event));
    this.sheet.Subscribe((event: any) => this.HandleEvent(event));

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
   * show or hide toolbar. this can also be called on resize to update layout.
   */
  public Show(show = true) {

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

  /** explicit hide method */
  public Hide() {
    this.Show(false);
  }

  /** toggle visibility (useful if you do not store state) */
  public Toggle() {
    this.Show(!this.visible_);
  }

  /** get colors and number formats that are in the document */
  private UpdateDocumentStyles() {

    this.toolbar.ClearDocumentColors();
    this.toolbar.ClearDocumentFormats();

    for (const sheet of this.grid.model.sheets) {

      const serialized = sheet.toJSON();

      for (const style of serialized.cell_style_refs) {
        if (style.background) this.toolbar.AddDocumentColor(style.background);
        if (style.text_color) this.toolbar.AddDocumentColor(style.text_color);
        if (style.number_format) this.toolbar.AddDocumentFormat(style.number_format);
      }

      for (const key of Object.keys(serialized.column_style)) {
        const style = serialized.column_style[Number(key)];
        if (style.background) this.toolbar.AddDocumentColor(style.background);
        if (style.text_color) this.toolbar.AddDocumentColor(style.text_color);
        if (style.number_format) this.toolbar.AddDocumentFormat(style.number_format);
      }

      for (const key of Object.keys(serialized.row_style)) {
        const style = serialized.row_style[Number(key)];
        if (style.background) this.toolbar.AddDocumentColor(style.background);
        if (style.text_color) this.toolbar.AddDocumentColor(style.text_color);
        if (style.number_format) this.toolbar.AddDocumentFormat(style.number_format);
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
  private HandleEvent(event: any) {
    switch (event.type) {
    case 'load':
    case 'reset':
      this.UpdateDocumentStyles();
      this.UpdateFreezeState();
      break;

    case 'resize':
      if (this.visible) {
        this.Show(true);
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

    if (freeze.rows || freeze.columns) {
      this.toolbar.Activate('freeze2');
      this.toolbar.UpdateTitle('freeze2', 'Unfreeze');
    }
    else {
      this.toolbar.Deactivate('freeze2');
      this.toolbar.UpdateTitle('freeze2', 'Freeze Panes');
    }

  }

  /**
   * handle grid events. we are only concerned about selection changes,
   * so we can update the toolbar button states
   */
  private HandleGridEvent(event: any) {
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

    this.toolbar.DeactivateAll();

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

        if (style.horizontal_align === 1) this.toolbar.Activate('align-left');
        else if (style.horizontal_align === 2) this.toolbar.Activate('align-center');
        else if (style.horizontal_align === 3) this.toolbar.Activate('align-right');

        if (style.vertical_align === 1) this.toolbar.Activate('align-top');
        else if (style.vertical_align === 2) this.toolbar.Activate('align-bottom');
        else if (style.vertical_align === 3) this.toolbar.Activate('align-middle');

        if (style.wrap) this.toolbar.Activate('wrap');

      }
      if (format) {
        format = NumberFormatCache.SymbolicName(format) || format;
      }

      if (data.note) {
        this.toolbar.UpdateTitle('note', 'Edit Note');
      }
      else {
        this.toolbar.UpdateTitle('note', 'Add Note');
      }

      this.toolbar.current_cell = {...this.primary_selection.target};
      this.toolbar.current_note = data.note || '';

    }
    this.toolbar.Update('number-format', format);
    this.toolbar.Show('merge', !merged);
    this.toolbar.Show('unmerge', merged);
    this.UpdateFreezeState();

  }

  private HandleToolbar(id: string, template: ToolbarItem) {

    const style: any = {};

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
        if (style.number_format) this.toolbar.AddDocumentFormat(style.number_format);
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
        style.text_color = this.toolbar.GetSecondColor(id);
        if (style.text_color) this.toolbar.AddDocumentColor(style.text_color);
        else style.text_color = 'none';
        break;

      case 'fill-color':
        style.background = this.toolbar.GetSecondColor(id);
        if (style.background) this.toolbar.AddDocumentColor(style.background);
        else style.background = 'none';
        break;

      case 'increase-decimal':
      case 'decrease-decimal':
        if (!this.selection_style) break; // nothing selected

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

        break;

      case 'note':
        this.grid.SetNote(undefined, this.toolbar.dialog_note);
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

}

/*
// load. FIXME: these names need to be centralized somewhere

if (!(self as any).TREB) {
  (self as any).TREB = {} as any;
}
(self as any).TREB['treb-toolbar'] = FormattingToolbar;
*/
