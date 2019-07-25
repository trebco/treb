

type EmbeddedSpreadsheet = import('./index').EmbeddedSpreadsheet;

import { Toolbar } from './toolbar/toolbar';
import { ToolbarItem } from './toolbar/toolbar-item';
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { Style } from 'treb-base-types';

import '../style/toolbar.scss';

const SVGNS = 'http://www.w3.org/2000/svg';
const XlinkNS = 'http://www.w3.org/1999/xlink';

import { symbol_defs } from './toolbar/symbol-defs';
import { Area } from 'treb-base-types';
import { BorderConstants } from '@root/treb-grid/src';

export class FormattingToolbar {

  /** factory method */
  public static CreateInstance(sheet: EmbeddedSpreadsheet, container: HTMLElement) {
    return new FormattingToolbar(sheet, container);
  }

  public static InjectSVG() {
    if (this.svg_injected) return;

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('style', 'position: absolute; width: 0; height: 0; overflow: hidden;');
    svg.setAttribute('version', '1.1');

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

  private static svg_injected = false;

  private visible = false;
  private node: HTMLElement;
  private toolbar: Toolbar;
  private selection_style?: Style.Properties;
  private primary_selection: any;

  constructor(
      private sheet: EmbeddedSpreadsheet,
      private container: HTMLElement) {

    this.node = document.createElement('div');
    this.node.classList.add('treb-formatting-toolbar');
    container.insertBefore(this.node, container.firstChild);

    FormattingToolbar.InjectSVG();

    this.toolbar = new Toolbar(this.node);

    this.toolbar.Show('merge', true);
    this.toolbar.Show('unmerge', false);

    // this.toolbar.Show('freeze', true);
    // this.toolbar.Show('unfreeze', false);

    this.toolbar.SetSecondColor('fill-color', 'yellow');
    this.toolbar.SetSecondColor('text-color', 'red');

    this.toolbar.On(this.HandleToolbar.bind(this));

    (this.sheet as any).grid.grid_events.Subscribe((event: any) => this.HandleGridEvent(event));
    this.sheet.Subscribe((event: any) => this.HandleEvent(event));

    // we now hold a live reference to the selection. we don't need to query
    // every time. this should survive any document changes, since selection
    // is const/readonly.

    this.primary_selection = sheet.GetSelectionReference();

    // called in case there's no document. "clear" actually sets
    // root number formats (could skip colors)

    // this.toolbar.ClearDocumentColors();
    // this.toolbar.ClearDocumentFormats();

    this.UpdateDocumentStyles();
    this.UpdateFreezeState();
    this.UpdateFromSelection();

  }

  public Show(show = true) {
    this.visible = show;
    this.node.style.display = this.visible ?
      'inline-flex' : 'none';
  }

  public Hide() {
    this.Show(false);
  }

  public Toggle() {
    this.Show(!this.visible);
  }

  ///


  private UpdateDocumentStyles() {

    this.toolbar.ClearDocumentColors();
    this.toolbar.ClearDocumentFormats();

    const serialized = (this.sheet as any).grid.model.sheet.toJSON();

    for (const style of serialized.cell_style_refs) {
      if (style.background) this.toolbar.AddDocumentColor(style.background);
      if (style.text_color) this.toolbar.AddDocumentColor(style.text_color);
      if (style.number_format) this.toolbar.AddDocumentFormat(style.number_format);
    }

    for (const key of Object.keys(serialized.column_style)) {
      const style = serialized.column_style[key];
      if (style.background) this.toolbar.AddDocumentColor(style.background);
      if (style.text_color) this.toolbar.AddDocumentColor(style.text_color);
      if (style.number_format) this.toolbar.AddDocumentFormat(style.number_format);
    }

    for (const key of Object.keys(serialized.row_style)) {
      const style = serialized.row_style[key];
      if (style.background) this.toolbar.AddDocumentColor(style.background);
      if (style.text_color) this.toolbar.AddDocumentColor(style.text_color);
      if (style.number_format) this.toolbar.AddDocumentFormat(style.number_format);
    }

  }

  private HandleEvent(event: any) {
    switch (event.type) {
    case 'load':
    case 'reset':
      this.UpdateDocumentStyles();
      this.UpdateFreezeState();
      break;
    }
  }

  private Freeze() { // freeze: boolean) {

    const freeze = this.sheet.GetFreeze();
    const frozen = freeze.rows || freeze.columns;

    if (frozen) {
      this.sheet.Freeze(0, 0);
    }
    else {
      if (this.primary_selection && !this.primary_selection.empty) {
        const area = this.primary_selection.area as Area;
        if (area.entire_sheet) {
          // ?
        }
        else if (area.entire_row) {
          this.sheet.Freeze(area.end.row + 1, 0);
        }
        else if (area.entire_column) {
          this.sheet.Freeze(0, area.end.column + 1);
        }
        else {
          this.sheet.Freeze(area.end.row + 1, area.end.column + 1);
        }
      }
    }

    this.UpdateFreezeState();

  }

  private UpdateFreezeState() {

    const freeze = this.sheet.GetFreeze();

    if (freeze.rows || freeze.columns) {
      this.toolbar.Activate('freeze2');
      this.toolbar.UpdateTitle('freeze2', 'Unfreeze');
    }
    else {
      this.toolbar.Deactivate('freeze2');
      this.toolbar.UpdateTitle('freeze2', 'Freeze Panes');
    }

  }

  private HandleGridEvent(event: any) {
    if (event.type === 'selection') {
      this.UpdateFromSelection();
    }
    else if (event.type === 'data' || event.type === 'style') {
      // console.info('dirty', event);
      // if (this.current_file) {
      //   this.file_list.State(this.current_file, FileState.dirty);
      // }
    }
  }

  private UpdateFromSelection() {
    let format = '';
    let merged = false;

    this.toolbar.DeactivateAll();

    if (this.primary_selection && !this.primary_selection.empty) {
      let data = (this.sheet as any).grid.model.sheet.CellData(this.primary_selection.target);
      merged = !!data.merge_area;
      if (merged && (
          data.merge_area.start.row !== this.primary_selection.target.row ||
          data.merge_area.start.column !== this.primary_selection.target.column)) {
        data = (this.sheet as any).grid.model.sheet.CellData(data.merge_area.start);
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
      this.toolbar.current_note = data.note;

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
        switch (template.value) {
          case 'insert row':
            this.sheet.InsertRow();
            break;
          case 'insert column':
            this.sheet.InsertColumn();
            break;
          case 'delete row':
            this.sheet.DeleteRows();
            break;
          case 'delete column':
            this.sheet.DeleteColumns();
            break;
        }
        break;

      case 'run':
        this.sheet.RunSimulation(5000);
        break;

      /*
      case 'export':
        this.Export();
        break;

      case 'save':
        this.SaveFile();
        break;

      case 'save-as':
        this.SaveAs();
        break;

      case 'clear':
        this.Clear();
        break;

      case 'new':
        this.NewFile();
        break;

      case 'load':
        this.OpenFile();
        break;
      */

      case 'freeze2':
        this.Freeze();
        break;

      /*
      case 'freeze':
        this.Freeze(true);
        break;

      case 'unfreeze':
        this.Freeze(false);
        break;
      */

      case 'merge':
        this.sheet.MergeCells();
        break;

      case 'unmerge':
        this.sheet.UnmergeCells();
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
          this.sheet.ApplyBorders(BorderConstants.Bottom, 2);
        }
        else {
          this.sheet.ApplyBorders(BorderConstants.Bottom);
        }
        break;

      case 'border-all':
        this.sheet.ApplyBorders(BorderConstants.All);
        break;

      case 'border-outer':
        this.sheet.ApplyBorders(BorderConstants.Outside);
        break;

      case 'border-right':
        this.sheet.ApplyBorders(BorderConstants.Right);
        break;

      case 'border-left':
        this.sheet.ApplyBorders(BorderConstants.Left);
        break;

      case 'border-top':
        this.sheet.ApplyBorders(BorderConstants.Top);
        break;

      case 'border-none':
        this.sheet.ApplyBorders(BorderConstants.None);
        break;

      case 'flush-simulation-results':
        this.sheet.FlushSimulationResults();
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
        this.sheet.SetNote(this.toolbar.dialog_note);
        break;

      default:
        console.info('unhandled command:', template.id);
    }

    if (Object.keys(style).length) {
      this.sheet.ApplyStyle(undefined, style, true);
    }

    this.UpdateFromSelection();
    this.sheet.Focus();

  }

}

// load. FIXME: these names need to be centralized somewhere

if (!(self as any).TREB) {
  (self as any).TREB = {} as any;
}
(self as any).TREB['treb-toolbar'] = FormattingToolbar;
