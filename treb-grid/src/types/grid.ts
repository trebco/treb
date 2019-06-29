
import { Rectangle, ValueType, Style, Area, Cell, Extent, ICellAddress,
         IsCellAddress, Localization } from 'treb-base-types';
import { Parser, DecimalMarkType, ExpressionUnit, ArgumentSeparatorType } from 'treb-parser';
import { EventSource, Yield } from 'treb-utils';
import { NumberFormatCache, RDateScale } from 'treb-format';
import { SelectionRenderer } from '../render/selection-renderer';

import { Sheet } from './sheet';
import { TileRange, BaseLayout } from '../layout/base_layout';
import { GridLayout } from '../layout/grid_layout';
import { LegacyLayout } from '../layout/legacy_layout';

import { GridSelection } from './grid_selection';
import { Theme, ExtendedTheme, CalculateSupplementalColors, LoadThemeProperties } from './theme';
import { CellEditor } from '../editors/cell_editor';
import { ValueParser, Hints } from '../util/value_parser';

import { TileRenderer } from '../render/tile_renderer';
import { GridEvent } from './grid_events';
import { SheetEvent } from './sheet_types';
import { FormulaBar } from '../editors/formula_bar';
import { GridOptions, DefaultGridOptions } from './grid_options';
import { AutocompleteMatcher, FunctionDescriptor } from '../editors/autocomplete_matcher';
import { BorderConstants } from './border_constants';
import { SerializeOptions } from './serialize_options';
import { UA } from '../util/ua';
import { Annotation } from './annotation';
import { Autocomplete } from '../editors/autocomplete';

import { Command, CommandKey, CommandRecord,
         SetRangeCommand, FreezeCommand, UpdateBordersCommand,
         InsertRowsCommand, InsertColumnsCommand } from './grid_command';
import { DataModel } from './data_model';

interface DoubleClickData {
  timeout?: any;
  address?: ICellAddress;
}


export class Grid {

  // --- public members --------------------------------------------------------

  /** events */
  public grid_events = new EventSource<GridEvent>();

  /** for recording */
  public command_log = new EventSource<CommandRecord>();

  /**
   * this should not be public -- clients should only interact with the API.
   * so why is it public? we need to access it in the calculator (and in the
   * calculator in the worker, for simulations).
   *
   * FIXME: find a solution for this.
   */
  public get cells() {
    return this.model.sheet.cells;
  }

  /** list of annotations */
  public readonly annotations: Annotation[] = [];

  /**
   * the theme object exists so we can pass it to constructors for
   * various components, but it's no longer initialized until the
   * initialization step (when we have a node).
   */
  public readonly theme: ExtendedTheme;

  // --- private members -------------------------------------------------------

  private grid_container?: HTMLElement;

  /**
   * local sheet instance. we always have a sheet, change the data
   * (not the instance).
   *
   * UPDATE: sheet is now private. this is the first step in the long
   * process of replacing it. to support the sheet being private, we need
   * some additional methods and accessors.
   *
   * also readonly, to enforce that we keep the reference (note that you
   * can in fact reassign readonly in the constructor. I do not like that).
   *
   * FIXME: why again is this readonly? I get that we want to pass references
   * around, but why not have a container and pass references to that? sheet
   * should not be constant/readonly. it breaks the metaphor.
   *
   * IN FACT, why not pass an accessor? (...)
   * also a nice way to transition... we now have a wrapper object, and we can
   * switch the member to an accessor (DM will have to become a class)
   */
  private readonly model: DataModel = {
    sheet: Sheet.Blank(100, 26),
  };

  /** containing element, passed in */
  private container?: HTMLElement;

  /** dom structure for grid */
  private readonly layout: BaseLayout;

  /**
   * this flag is used to lazily rebuild tiles. that prevents flashing if
   * there is a lot of work between a reset/document change and the next
   * paint call.
   */
  private tile_update_pending = false;

  /**
   * spreadsheet language parser. used to pull out address
   * references from functions, for highlighting
   */
  private parser = new Parser();

  /** in-cell editor */
  private cell_editor?: CellEditor;

  /** formula bar editor (optional) */
  private formula_bar?: FormulaBar;

  private RESIZE_PIXEL_BUFFER = 5;

  /**
   * flag indicating we're resizing, or hovering over a resize.
   * we use this so we know what to do when we see a click on the headers.
   */
  private cell_resize = { row: -1, column: -1 };

  /**
   * this is the only thing that was used in the old 'render state',
   * so we dropped the container.
   */
  private render_tiles = new TileRange({ row: 0, column: 0 });

  // primary and active selections now _always_ exist. we use flags
  // to indicate that they're empty (i.e. nothing is selected). this
  // allows us to pass and test actual objects.
  //
  // like const, readonly only affects the immediate property and not
  // subproperties. so here we use it to ensure selections are never
  // reassigned or deassigned.

  /**
   * the main selection for interacting with the spreadsheet
   */
  private readonly primary_selection: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
    empty: true,
  };

  /**
   * active selection when selecting arguments (while editing)
   */
  private readonly active_selection: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
    empty: true,
  };

  /**
   * this flag is for testing if we were previously in the nub
   */
  private nub_select_flag = false;

  /**
   * current mouse move cell
   */
  private hover_cell: ICellAddress = {row: -1, column: -1};

  /**
   * flag indicating we're showing a note, so we can stop
   */
  private hover_note_visible = false;

  /**
   * additional selections that are rendered but not otherwise used.
   * this array is now readonly, so we can bind it to the selection
   * renderer (we do this with the primary selection as well)
   */
  private readonly additional_selections: GridSelection[] = [];

  /**
   * state data for handling double-clicks. because we're using
   * mousedown, we need to synthesize double-clicks with a timeout.
   */
  private double_click_data: DoubleClickData = {};

  /**
   * window timer/request animation frame token. this is used to prevent
   * excess repaints on scroll. FIXME: can this merge with the delayed
   * render token? I think originally it was separate because that other
   * method was too slow for scrolling... maybe...
   */
  private layout_token = 0;

  /** window timer/request animation frame token */
  private render_token = 0;

  /** */
  private tile_renderer: TileRenderer;

  /** */
  private selection_renderer: SelectionRenderer;

  /** */
  private options: GridOptions;

  /**
   * single instance of AC. editors (function bar, ICE) have references.
   */
  private autocomplete_matcher = new AutocompleteMatcher();

  // --- constructor -----------------------------------------------------------

  /**
   * FIXME: NO PARAMETER INITIALIZATIONS
   */
  constructor(options: GridOptions = {}, theme: Theme = {}) {

    // set properties here, we will update in initialize()
    this.theme = {...theme};

    // apply default options, meaning that you need to explicitly set/unset
    // in order to change behavior. FIXME: this is ok for flat structure, but
    // anything more complicated will need a nested merge

    this.options = { ...DefaultGridOptions, ...options };

    this.layout = UA.is_modern ?
      new GridLayout(this.model) :
      new LegacyLayout(this.model);

    this.tile_renderer = new TileRenderer(this.theme, this.layout, this.model, this.options);
    this.selection_renderer = new SelectionRenderer(this.theme, this.layout, this.model,
      this.primary_selection, this.additional_selections);

    if (Localization.decimal_separator === '.') {
      this.parser.decimal_mark = DecimalMarkType.Period;
      this.parser.argument_separator = ArgumentSeparatorType.Comma;
    }
    else {
      this.parser.decimal_mark = DecimalMarkType.Comma;
      this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
    }


  }

  // --- public methods --------------------------------------------------------

  /**
   * set note at the given address, or current selection
   * @param address optional address; if not used, note will be set/cleared
   * at current selection
   * @param note new note, or undefined to clear note
   */
  public SetNote(address?: ICellAddress, note?: string) {

    if (!address) {
      if (this.primary_selection.empty) return;
      address = this.primary_selection.target;
    }

    this.ExecCommand({
      key: CommandKey.SetNote,
      address,
      note,
    });

  }

  /** find an annotation, given a node */
  public FindAnnotation(node: HTMLElement) {
    for (const annotation of this.annotations) {
      if (annotation.node === node) {
        return annotation;
      }
    }
    return undefined;
  }

  /**
   * create an annotation, with properties, without an original object.
   * optionally (and by default) add to sheet.
   */
  public CreateAnnotation(properties: object = {}, add_to_sheet = true) {
    const annotation = new Annotation(properties);
    if (add_to_sheet) {
      this.AddAnnotation(annotation);
    }
    return annotation;
  }

  /** add an annotation. it will be returned with a usable node. */
  public AddAnnotation(annotation: Annotation) {

    // ensure we haven't already added this
    for (const test of this.annotations) {
      if (test === annotation) return;
    }

    if (!annotation.node) {
      annotation.node = document.createElement('div');
    }

    annotation.node.classList.add('annotation');
    this.layout.AddAnnotation(annotation);

    this.annotations.push(annotation);

  }

  /**
   * removes an annotation from the list, and removes the node its
   * the parent (although the node still exists in the annotation, if
   * it existed before).
   */
  public RemoveAnnotation(annotation: Annotation) {
    for (let i = 0; i < this.annotations.length; i++){
      if (annotation === this.annotations[i]) {
        this.annotations.splice(i, 1);
        if (annotation.node && annotation.node.parentElement) {
          annotation.node.parentElement.removeChild(annotation.node);
        }
        return;
      }
    }
  }

  /**
   * remove all annotations
   */
  public RemoveAllAnnotations() {
    for (const annotation of this.annotations) {
      if (annotation.node && annotation.node.parentElement) {
        annotation.node.parentElement.removeChild(annotation.node);
      }
    }
    this.annotations.splice(0, this.annotations.length);
  }

  /**
   * serialize data. this function used to (optionally) stringify
   * by typescript has a problem figuring this out, so we will simplify
   * the function.
   */
  public Serialize(options: SerializeOptions = {}) {
    const data: any = this.model.sheet.toJSON(options);

    // FIXME: if these things (selection, freeze) are "data" for purposes
    // of serialization, then they should be in the data class (sheet),
    // right? this gets sloppy if we have data in lots of different places.

    // FIXME

    // add selection to data, so we can restore it (primarily used for undo)
    // COPY SO IT'S NOT LINKED

    data.primary_selection = JSON.parse(JSON.stringify(this.primary_selection));

    // frozen, but omit if empty/no data

    /*
    if (this.layout.freeze.rows || this.layout.freeze.columns) {
      data.freeze = {...this.layout.freeze};
    }
    */

    // annotations: also copy

    data.annotations = JSON.parse(JSON.stringify(this.annotations));

    return data;
  }

  // pass through
  public RealArea(area: Area) {
    return this.model.sheet.RealArea(area);
  }

  // pass through
  public CellRenderData(address: ICellAddress) {
    return this.model.sheet.CellData(address);
  }

  /**
   * clear sheet, reset all data
   */
  public Clear() {
    this.ExecCommand({ key: CommandKey.Clear });
  }

  /**
   * reset sheet, set data from CSV
   *
   * FIXME: this is problematic, because it runs around the exec command
   * system. however it doesn't seem like a good candidate for a separate
   * command. it should maybe move to the import class? (...)
   *
   * one problem with that is that import is really, really heavy (jszip).
   * it seems wasteful to require all that just to import csv.
   */
  public FromCSV(text: string) {

    // this.UpdateSheet(Sheet.FromCSV(text).toJSON());

    // the old method said "this is just for testing". don't use this.
    // use a proper csv parser.

    const lines = text.split(/\n/);
    const arr = lines.map((line) => {
      return line.trim().split(/,/).map((x) => {
        if (/^".*"$/.test(x)) x = x.substr(1, x.length - 2);
        return ValueParser.TryParse(x).value;
      });
    });

    const end = {
      row: arr.length,
      column: arr.reduce((max, row) => Math.max(max, row.length), 0),
    };

    // console.info(arr);

    this.ExecCommand([
      { key: CommandKey.Clear },
      { key: CommandKey.SetRange,
        area: {start: {row: 0, column: 0}, end },
        value: arr,
      },

      // we took this out because the data may require a layout update
      // (rebuilding tiles); in that case, this will be duplicative. maybe
      // should use setTimeout or some sort of queue...

      // { key: CommandKey.ResizeColumns }, // auto
    ]);

  }

  /**
   * show or hide headers
   */
  public ShowHeaders(show = true) {
    this.ExecCommand({
      key: CommandKey.ShowHeaders,
      show,
    });
  }

  /**
   * why does this not take the composite object? (...)
   * A: it's used for xlsx import. still, we could wrap it.
   */
  public FromData(
      cell_data: any[],
      column_widths: number[],
      row_heights: number[],
      styles: Style.Properties[],
      render = false) {

    this.UpdateSheet(new Sheet().toJSON(), true);
    this.RemoveAllAnnotations();
    this.ClearSelection(this.primary_selection);

    this.cells.FromJSON(cell_data);

    // 0 is implicitly just a general style

    const cs = (this.model.sheet as any).cell_style;
    for (const info of cell_data) {
      if (info.style_ref) {
        if (!cs[info.column]) cs[info.column] = [];
        cs[info.column][info.row] = styles[info.style_ref];
      }
    }

    for (let i = 0; i < column_widths.length; i++ ){
      if (typeof column_widths[i] !== 'undefined') {
        this.model.sheet.SetColumnWidth(i, column_widths[i]);
      }
    }

    for (let i = 0; i < row_heights.length; i++ ){
      if (typeof row_heights[i] !== 'undefined') {
        this.model.sheet.SetRowHeight(i, row_heights[i]);
      }
    }

    this.QueueLayoutUpdate();

    this.model.sheet.ApplyTheme(this.theme);

    if (render) {
      this.Repaint(false, false); // true, true);
    }

  }

  public UpdateSheet(data: any, render = false) {

    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    Sheet.FromJSON(data, this.model.sheet);
    this.ClearSelection(this.primary_selection);

    if ((data as any).primary_selection) {
      const selection = ((data as any).primary_selection) as GridSelection;
      if (!selection.empty) {
        this.Select(this.primary_selection,
          new Area(selection.area.start, selection.area.end), selection.target);
      }
    }

    // scrub, then add any sheet annotations. note the caller will
    // still have to inflate these or do whatever step is necessary to
    // render.

    this.RemoveAllAnnotations();
    const annotations = (data as any).annotations;
    if (annotations && Array.isArray(annotations)) {
      for (const element of annotations) {
        this.AddAnnotation(new Annotation(element));
      }
    }

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    this.QueueLayoutUpdate();

    this.model.sheet.ApplyTheme(this.theme);

    if (render) {
      this.Repaint(false, false);
    }
  }

  /**
   * rebuild layout on a resize. we are not trapping resize events, clients
   * should do that (also this works for embedded elements that are not
   * directly affected by document resize).
   */
  public UpdateLayout() {
    this.layout.UpdateTiles();
    this.render_tiles = this.layout.VisibleTiles();
    this.Repaint(true);
  }

  /**
   * splitting the old UpdateTheme, since that is becoming more
   * important for post-constructor theme updates, and the name applies
   * more to that function than to what we do at startup.
   */
  public ApplyTheme() {
    this.UpdateTheme(true);
  }

  /**
   * @param initial first call, from the grid Initialize() method
   */
  public UpdateTheme(initial = false) {

    if (!initial) {
      for (const key of Object.keys(this.theme)) {
        delete (this.theme as any)[key]; // = undefined;
      }
    }

    const theme_properties = LoadThemeProperties(this.grid_container);

    // NOTE: this prevents it from rebuilding based on changes to the
    // stylesheet; putting this.theme second overrides any new values.

    // depending on whether we want to keep using object theme, we might
    // remove that. for the time being we'll use a flag...

    const composite = CalculateSupplementalColors({
      ...theme_properties,
      ...this.theme,
    });

    for (const key of Object.keys(composite)) {
      (this.theme as any)[key] = (composite as any)[key];
    }

    // set defaults from style. why are these not set in
    // the sheet style, like fonts (below)? [...FIXME]

    Style.DefaultProperties.border_bottom_color =
        Style.DefaultProperties.border_top_color =
        Style.DefaultProperties.border_left_color =
        Style.DefaultProperties.border_right_color =
      this.theme.border_color || '';

    // update style for theme

    this.model.sheet.ApplyTheme(this.theme);
    this.layout.ApplyTheme(this.theme);

    if (!initial) {
      this.selection_renderer.Flush();

      if (this.cell_editor) this.cell_editor.UpdateTheme();
      if (this.formula_bar) this.formula_bar.UpdateTheme();

      this.Repaint(true, true, true);
    }

  }

  /**
   *
   * @param container html container element
   * @param sheet_data optional sheet (serialized, as json or object)
   */
  public Initialize(grid_container: HTMLElement, sheet_data?: string | object) {

    this.grid_container = grid_container;

    this.ApplyTheme();

    const container = document.createElement('div');

    grid_container.appendChild(container);
    grid_container.classList.add('treb-main');

    let autocomplete: Autocomplete | undefined;

    if (this.options.formula_bar) {
      if (!autocomplete) {
        autocomplete = new Autocomplete({theme: this.theme, container});
      }
      this.InitFormulaBar(grid_container, autocomplete);
    }

    // set container and add class for our styles

    this.container = container;
    this.container.classList.add('treb-grid');

    // accept focus, keyboard input

    this.container.setAttribute('tabindex', '-1');

    // if there's a sheet passed in, use that (serialized)

    if (sheet_data) {
      try {
        Sheet.FromJSON(sheet_data, this.model.sheet);
      }
      catch (err) {
        console.error('creating document failed');
        console.error(err);
      }
    }

    // create dom structure

    this.layout.Initialize(container, () => this.OnScroll(), this.options.scrollbars);
    this.selection_renderer.Initialize();
    this.layout.UpdateTiles();

    // event handlers and components

    this.model.sheet.sheet_events.Subscribe(this.HandleSheetEvent.bind(this));

    this.AttachListeners();

    if (this.options.in_cell_editor) {
      if (!autocomplete) {
        autocomplete = new Autocomplete({theme: this.theme, container});
      }
      this.InitCellEditor(autocomplete);
    }

    // set local state and update

    this.render_tiles = this.layout.VisibleTiles();

    // don't delay this, it looks terrible

    this.Repaint(true);

  }

  /**
   * merges selected cells
   */
  public MergeSelection() {

    if (this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.ExecCommand({
      key: CommandKey.MergeCells,
      area: this.primary_selection.area,
    });
  }

  /**
   * unmerges selected cells
   */
  public UnmergeSelection() {

    if (this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.ExecCommand({
      key: CommandKey.UnmergeCells,
      area: this.primary_selection.area,
    });

  }

  /**
   * focus on the container. you must call this method to get copying
   * to work properly (because it creates a selection)
   */
  public Focus() {
    if (this.container) {
      this.container.focus();
    }
  }

  /**
   * get data in a given range, optionally formulas
   * API method
   */
  public GetRange(range: ICellAddress|Area, formula = false) {

    if (IsCellAddress(range)) {
      return formula
        ? this.cells.RawValue(range)
        : this.cells.GetRange(range);
    }

    return formula
      ? this.cells.RawValue(range.start, range.end)
      : this.cells.GetRange(range.start, range.end);

  }

  /**
   * set data in given range
   * API method
   *
   * @param range target range. if range is smaller than data, range controls.
   * if range is larger, behavior depends on the recycle parameter.
   * @param data single value, array (column), or 2d array
   * @param recycle recycle values. we only recycle single values or single
   * rows/columns -- we will not recycle a matrix.
   * @param transpose transpose before inserting (data is column-major)
   */
  public SetRange(range: Area, data: any, recycle = false, transpose = false) {

    // single value, easiest
    if (!Array.isArray(data) && !ArrayBuffer.isView(data)) {
      if (recycle) {
        // this.model.sheet.SetAreaValue(range, data);
        this.ExecCommand({key: CommandKey.SetRange, area: range, value: data});
      }
      else {
        // this.model.sheet.SetCellValue(range.start, data);
        this.ExecCommand({key: CommandKey.SetRange, area: range.start, value: data});
      }
      return;
    }

    // flat array -- we can recycle. recycling is R style (values, not rows)
    if (!Array.isArray((data as any)[0]) && !ArrayBuffer.isView((data as any)[0])) {

      if (recycle) {

        const rows = range.entire_column ? this.model.sheet.rows : range.rows;
        const columns = range.entire_row ? this.model.sheet.columns : range.columns;
        const count = rows * columns;

        if (count > (data as any).length) {
          let tmp = (data as any).slice(0);
          const multiple = Math.ceil(count / tmp.length);
          for (let i = 1; i < multiple; i++ ){
            tmp = tmp.concat((data as any).slice(0));
          }
          data = tmp;
        }

        // reshape
        const reshaped: any[][] = [];
        for (let c = 0, index = 0; c < columns; c++, index += rows) {
          reshaped[c] = data.slice(index, index + rows);
        }
        data = reshaped;

      }
      else {
        data = [data];
      }

    }

    // transpose. might not be square
    if (transpose) {
      const tmp: any[][] = [];
      const inner_length = (data as any)[0].length;
      for (let i = 0; i < inner_length; i++ ){
        tmp[i] = [];
        for (let j = 0; j < data.length; j++ ){
          if (typeof data[j][i] !== 'undefined') {
            tmp[i][j] = data[j][i];
          }
        }
      }
      data = tmp;
    }

    // this.model.sheet.SetAreaValues(range, data as any[][]);
    this.ExecCommand({key: CommandKey.SetRange, area: range, value: data});

  }

  /**
   * API method
   */
  public SetRowHeight(row?: number|number[], height?: number) {
    this.ExecCommand({
      key: CommandKey.ResizeRows,
      row,
      height,
    });
  }

  /**
   * API method
   *
   * @param column column, columns, or undefined means all columns
   * @param width target width, or undefined means auto-size
   */
  public SetColumnWidth(column?: number|number[], width = 0) {
    this.ExecCommand({
      key: CommandKey.ResizeColumns,
      column,
      width,
    });
  }

  /**
   * applies the given style properties to the passed array, or to the
   * current primary selection
   *
   * API method
   */
  public ApplyStyle(area?: Area, properties: Style.Properties = {}, delta = true) {

    if (!area) {
      if (this.primary_selection.empty) {
        return;
      }
      else area = this.primary_selection.area;
    }

    this.ExecCommand({
      key: CommandKey.UpdateStyle,
      area,
      style: properties,
      delta,
    });

  }

  /**
   * returns the primary selection. we use a reference to the real selection
   * sp callers can track; however, you can break things if you modify it.
   * so don't modify it. FIXME: proxy view? (...)
   *
   * API method
   */
  public GetSelection() {
    return this.primary_selection;
  }

  /** repaint after an external event (calculation) */
  public Update(force = false, area?: Area) {
    this.DelayedRender(force, area);
  }

  /**
   * API method
   *
   * @param area
   * @param borders
   * @param color
   * @param width
   */
  public ApplyBorders(area?: Area, borders: BorderConstants = BorderConstants.None, color?: string, width = 1) {

    if (!area) {
      if (this.primary_selection.empty) { return; }
      area = this.primary_selection.area;
    }

    if (borders === BorderConstants.None) {
      width = 0;
    }

    this.ExecCommand({
      key: CommandKey.UpdateBorders,
      color,
      area,
      borders,
      width,
    });

  }

  /** return freeze area */
  public GetFreeze() {
    return {...this.model.sheet.freeze};
  }

  /**
   * freeze rows or columns. set to 0 (or call with no arguments) to un-freeze.
   *
   * highglight is shown by default, but we can hide it(mostly for document load)
   */
  public Freeze(rows = 0, columns = 0, highlight_transition = true) {
    this.ExecCommand({
      key: CommandKey.Freeze,
      rows,
      columns,
      highlight_transition,
    });
  }

  /**
   * delete columns in current selection
   */
  public DeleteColumns() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    if (area.entire_row) {
      this.Clear();
    }
    else {
      const before_column = area.start.column;
      const count = -area.columns; // negative means remove
      // this.InsertColumnsInternal(before_column, -count);
      this.ExecCommand({
        key: CommandKey.InsertColumns,
        before_column,
        count,
      });
    }
  }

  /**
   * delete rows in current selection
   */
  public DeleteRows() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    if (area.entire_column) {
      this.Clear();
    }
    else {
      const before_row = area.start.row;
      const count = -area.rows; // negative means remove
      this.ExecCommand({
        key: CommandKey.InsertRows,
        before_row,
        count,
      });
    }
  }

  /**
   * insert column at cursor
   */
  public InsertColumn() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    const before_column = area.entire_row ? 0 : area.start.column;
    this.InsertColumns(before_column, 1);
  }

  /**
   * insert column(s) at some specific point
   */
  public InsertColumns(before_column = 0, count = 1) {
    this.ExecCommand({
      key: CommandKey.InsertColumns,
      before_column,
      count,
    });
  }

  /**
   * insert row at cursor
   */
  public InsertRow() {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    const before_row = area.entire_column ? 0 : area.start.row;
    this.InsertRows(before_row, 1);
  }

  /**
   * insert rows(s) at some specific point
   */
  public InsertRows(before_row = 0, count = 1) {
    this.ExecCommand({
      key: CommandKey.InsertRows,
      before_row,
      count,
    });
  }

  /**
   * set functions for AC matcher. should be called by calculator on init,
   * or when any functions are added/removed.
   */
  public SetAutocompleteFunctions(functions: FunctionDescriptor[]) {
    this.autocomplete_matcher.SetFunctions(functions);
  }

  /**
   * scrolls so that the given cell is in the top-left (assuming that is
   * possible)
   */
  public ScrollTo(address: ICellAddress) {
    this.layout.ScrollTo(address);
  }

  /**
   * scrolls the given address into view (assuming it's not in view now)
   *
   * FIXME: we need a way to do this without scrolling the containing
   * page, in the event we do a scroll-on-load. small problem.
   */
  public ScrollIntoView(address: ICellAddress) {
    if (this.options.scrollbars) {
      this.layout.ScrollIntoView(address);
    }
  }

  // --- private methods -------------------------------------------------------

  /**
   * why is this not in layout? (...)
   * how is this layout? it's an effect. make an effects class.
   */
  private HighlightFreezeArea() {

    if (this.theme.frozen_highlight_overlay) {

      for (const node of [
          this.layout.corner_selection,
          this.layout.row_header_selection,
          this.layout.column_header_selection ]) {

        node.style.transition = 'background .33s, border-bottom-color .33s, border-right-color .33s';
        node.style.background = this.theme.frozen_highlight_overlay;

        if (this.theme.frozen_highlight_border) {
          node.style.borderBottomColor = this.theme.frozen_highlight_border;
          node.style.borderRightColor = this.theme.frozen_highlight_border;
        }

        setTimeout(() => {
          node.style.background = 'transparent';
          node.style.borderBottomColor = 'transparent';
          node.style.borderRightColor = 'transparent';
        }, 400);
      }

    }

  }

  /**
   * layout has changed, and needs update. we clear the rectangle cache
   * immediately, to prevent any garbage, but we don't actually do the layout
   * until the next paint.
   *
   * FIXME: that makes no sense -- because rectangles will be calculated
   * incorrectly until the layout has been updated.
   */
  private QueueLayoutUpdate() {
    this.tile_update_pending = true;
  }

  private HandleSheetEvent(event: SheetEvent) {
    switch (event.type) {
      case 'style':
        this.DelayedRender(false, event.area);
        this.grid_events.Publish(event);
        break;

      case 'data':
        this.grid_events.Publish(event);
        break;

      default:
      // console.info('evt', event);
    }
  }

  private InitFormulaBar(grid_container: HTMLElement, autocomplete: Autocomplete) {

    this.formula_bar = new FormulaBar(grid_container, this.theme, this.options, autocomplete);
    this.formula_bar.autocomplete_matcher = this.autocomplete_matcher;

    this.formula_bar.Subscribe((event) => {

      switch (event.type) {
        case 'discard':
          if (this.container) this.Focus();
          this.ClearAdditionalSelections();
          this.ClearSelection(this.active_selection);
          this.UpdateFormulaBarFormula();
          this.DelayedRender();
          break;

        case 'commit':
          if (this.container) this.Focus();
          this.SetInferredType(this.primary_selection, event.value, event.array);
          this.ClearAdditionalSelections();
          this.ClearSelection(this.active_selection);

          if (this.options.repaint_on_cell_change) {
            this.DelayedRender(false, this.primary_selection.area);
          }

          if (event.event) {
            if (UA.trident) {
              const cloned_event = document.createEvent('KeyboardEvent');
              const modifiers = [];
              if (event.event.ctrlKey) modifiers.push('Control');
              if (event.event.altKey) modifiers.push('Alt');
              if (event.event.shiftKey) modifiers.push('Shift');
              cloned_event.initKeyboardEvent(
                event.event.type,
                false,
                false,
                event.event.view,
                event.event.key,
                event.event.location,
                modifiers.join(' '),
                event.event.repeat,
                Localization.locale);
              if (this.container) this.container.dispatchEvent(cloned_event);
            }
            else {
              const cloned_event = new KeyboardEvent(event.event.type, event.event);
              if (this.container) this.container.dispatchEvent(cloned_event);
            }
          }
          break;

        case 'update':
          if (event.dependencies) {
            this.HighlightDependencies(event.dependencies);
          }
          break;

      }
    });

  }

  private InitCellEditor(autocomplete: Autocomplete) {

    // if (!this.container) { return; }

    // why is the parent grid cover? this causes us to lose mouse move events.
    // we could check bubbles but that might be expensive...

    // for some reason it expands nicely in the cover node, but not in the
    // container node. not sure why. can probably be fixed?

    // this.cell_editor = new CellEditor2(this.layout.grid_cover, this.theme);
    this.cell_editor = new CellEditor(this.layout.scroll_reference_node, this.theme, autocomplete);
    this.cell_editor.autocomplete_matcher = this.autocomplete_matcher;

    this.cell_editor.Subscribe((event) => {

      switch (event.type) {

        case 'update':
          if (event.dependencies) {
            this.HighlightDependencies(event.dependencies);
          }
          break;

        case 'discard':
          this.DismissEditor(false);
          this.DelayedRender();
          break;

        case 'commit':
          // console.info('commit');
          if (event.selection) {
            this.SetInferredType(event.selection, event.value, event.array);
          }
          this.DismissEditor(false);

          if (this.options.repaint_on_cell_change) { // || !formula){
            this.DelayedRender(false, event.selection ? event.selection.area : undefined);
          }

          break;

        case 'end-selection':
          this.ClearSelection(this.active_selection);
          this.DelayedRender();
          break;

      }
    });
  }

  private DelayedRender(force = false, area?: Area, full_tile = false) {

    // if area is passed, set dirty before calling repaint

    // this seems to be called _without_ an area when selection changes;
    // that causes a selection repaint plus any necessary dirty tile updates.
    // so that actually works ok. we still may need to force everyone
    // to update, in somce cases, but that should be rare.

    if (!this.tile_update_pending && area) {
      this.layout.DirtyArea(area);
    }
    else if (!this.tile_update_pending && force) {
      this.layout.DirtyAll();
    }

    if (!this.render_token) {
      this.render_token = 1;
      Yield().then(() => {
        this.render_token = 0;
        this.Repaint(force, full_tile);
      });
    }

  }

  private Repaint(force = false, full_tile = false, force_headers = false) {

    if (this.tile_update_pending) {
      this.tile_update_pending = false;
      this.layout.UpdateTiles();
      this.render_tiles = this.layout.VisibleTiles();
      this.layout.UpdateAnnotation(this.annotations);
      this.grid_events.Publish({type: 'structure'});
    }

    this.layout_token = 0;
    this.selection_renderer.RenderSelections();

    this.tile_renderer.OverflowDirty(full_tile);

    if (force) {

      // set dirty in case we're not painting them

      for (const column of this.layout.grid_tiles) {
        for (const tile of column) {
          tile.dirty = true;
        }
      }
    }

    const start = this.render_tiles.start;
    const end = this.render_tiles.end;

    const row_list = [];
    for (let row = start.row; row <= end.row; row++) row_list.push(row);

    const column_list = [];
    for (let column = start.column; column <= end.column; column++) column_list.push(column);

    // FIXME: multiple tiles
    if (start.row > 0 && this.model.sheet.freeze.rows) row_list.push(0);
    if (start.column > 0 && this.model.sheet.freeze.columns) column_list.push(0);

    for (const column of column_list) {
      for (const row of row_list) {
        const tile = this.layout.grid_tiles[column][row];
        if (force || tile.dirty || tile.needs_full_repaint) {
          this.tile_renderer.Render(tile);
          tile.dirty = tile.needs_full_repaint = false;
        }
      }
    }

    this.tile_renderer.RenderHeaders(this.render_tiles, force_headers);
    this.tile_renderer.RenderCorner();

  }

  /**
   * generic method for mouse drag handling. this method will insert an
   * event mask to capture mouse events over the whole window, and call
   * optional functions on events.
   *
   * @param classes optional list of classes to attach to the mask node
   * @param move callback function on mouse move events
   * @param end callback function on end (mouse up or button up)
   */
  private MouseDrag(classes: string[] = [], move?: (event: MouseEvent) => void, end?: (event: MouseEvent) => void) {

    let cleanup: () => void;

    const handle_up = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      cleanup();
      if (end) end.call(this, event);
    };

    const handle_move = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      if (!event.buttons) {
        cleanup();
        if (end) end.call(this, event);
        return;
      }
      if (move) move.call(this, event);
    };

    cleanup = () => {
      this.layout.mask.style.display = 'none';
      this.layout.mask.removeEventListener('mousemove', handle_move);
      this.layout.mask.removeEventListener('mouseup', handle_up);
      for (const class_entry of classes) this.layout.mask.classList.remove(class_entry);
    };

    for (const class_entry of classes) this.layout.mask.classList.add(class_entry);
    this.layout.mask.style.display = 'block';

    // listeners are only added if we're going to use the callbacks.
    // still safe to call remove listener even if they're not added.

    if (move) this.layout.mask.addEventListener('mousemove', handle_move);
    if (end) this.layout.mask.addEventListener('mouseup', handle_up);
  }


  private MouseMove_RowHeader(event: MouseEvent) {

    const header = this.layout.CoordinateToRowHeader(event.offsetY);

    // this is used for the grid, but we can cheat and use it for the header
    const rect = this.layout.OffsetCellAddressToRectangle({ row: header.row, column: 0 });

    if (this.hover_cell.row !== -1 || this.hover_cell.column !== -1) {
      this.HoverCell({row: -1, column: -1});
    }

    let resize_row = -1;

    if (event.offsetY - rect.top <= this.RESIZE_PIXEL_BUFFER && header.row > 0) {
      resize_row = header.row - 1;
    }
    else if (rect.bottom - event.offsetY <= this.RESIZE_PIXEL_BUFFER) {
      resize_row = header.row;
    }

    if (resize_row >= 0) {
      this.layout.ResizeCursor('row');
    }
    else if (this.cell_resize.row) {
      this.cell_resize.row = -1;
      this.layout.ResizeCursor();
    }
    this.cell_resize.row = resize_row;

  }

  private MouseMove_ColumnHeader(event: MouseEvent) {

    const header = this.layout.CoordinateToColumnHeader(event.offsetX);

    // this is used for the grid, but we can cheat and use it for the header
    const rect = this.layout.OffsetCellAddressToRectangle({ row: 0, column: header.column });

    if (this.hover_cell.row !== -1 || this.hover_cell.column !== -1) {
      this.HoverCell({row: -1, column: -1});
    }

    let resize_column = -1;

    if (event.offsetX - rect.left <= this.RESIZE_PIXEL_BUFFER && header.column > 0) {
      resize_column = header.column - 1;
    }
    else if (rect.right - event.offsetX <= this.RESIZE_PIXEL_BUFFER) {
      resize_column = header.column;
    }

    if (resize_column >= 0) {
      this.layout.ResizeCursor('column');
    }
    else if (this.cell_resize.column) {
      this.cell_resize.column = -1;
      this.layout.ResizeCursor();
    }
    this.cell_resize.column = resize_column;

  }

  /**
   * handler for mousedown events on the row (left) header.
   * handles selection and resizing.
   *
   * FIXME: argument selection
   */
  private MouseDown_RowHeader(event: MouseEvent) {

    event.stopPropagation();
    event.preventDefault();

    let base_address = this.layout.CoordinateToRowHeader(event.offsetY);

    const bounding_rect = this.layout.row_header_cover.getBoundingClientRect();
    const offset = {
      x: bounding_rect.left,
      y: bounding_rect.top,
    };

    if (this.cell_resize.row >= 0) {
      const row = this.cell_resize.row;
      const base = offset.y + event.offsetY;

      // height of ROW
      const original_height = this.model.sheet.GetRowHeight(row);
      let height = original_height;

      const rect = this.layout.OffsetCellAddressToRectangle({ row, column: 0 });
      const tooltip_base = offset.y + rect.bottom;

      this.layout.ShowTooltip({
        left: true,
        text: `${height}px`,
        x: Math.round(bounding_rect.right + 10),
        y: tooltip_base,
      });

      this.MouseDrag(['row-resize'], (move_event: MouseEvent) => {
        const delta = Math.max(-original_height, Math.round(move_event.offsetY - base));
        if (delta + original_height !== height) {

          height = delta + original_height;
          // tile_sizes[tile_index] = tile_height + delta;
          this.model.sheet.SetRowHeight(row, height);

          this.layout.UpdateTooltip({
            text: `${height}px`,
            y: tooltip_base + delta,
          });

          requestAnimationFrame(() => {

            // FIXME: use command

            this.layout.UpdateTileHeights(true, row);
            this.Repaint(false, true); // repaint full tiles
            this.layout.UpdateAnnotation(this.annotations);
          });

        }
      }, (end_event: MouseEvent) => {

        this.layout.HideTooltip();

        requestAnimationFrame(() => {

          // this bit updates rows if more than one are selected, because
          // the resize routine only "live" resizes the first one. we can
          // pass everything into the command.

          let rows = [row];

          if (!this.primary_selection.empty &&
            this.primary_selection.area.rows > 1 &&
            this.primary_selection.area.start.column === Infinity &&
            this.primary_selection.area.ContainsRow(row)) {

            // update all selected rows. these could be in different tiles.

            const area = this.model.sheet.RealArea(this.primary_selection.area); // in case the whole sheet is selected

            rows = [];
            for (let r = area.start.row; r <= area.end.row; r++) {
              // this.model.sheet.RowHeight(r, height, true);
              rows.push(r);
            }

            // row = area.start.row; // ??

          }

          this.ExecCommand({
            key: CommandKey.ResizeRows,
            row: rows,
            height,
          });

          /*
          // need a full layout in the event we have to add tiles
          // this.layout.UpdateTileHeights(true, row);
          this.layout.UpdateTiles();

          this.Repaint(false, true); // repaint full tiles
          this.layout.UpdateAnnotation(this.annotations);
          this.grid_events.Publish({type: 'structure'}); // FIXME: no queued update?
          */
        });

      });
    }
    else {

      const selection = this.SelectingArgument() ?
        this.active_selection : this.primary_selection;

      if (event.shiftKey && !selection.empty) {
        const tmp = selection.target;
        this.Select(selection, new Area(selection.target, base_address, true), undefined, true);
        base_address = tmp;
      }
      else {
        this.Select(selection, new Area(base_address), { column: 0, row: base_address.row });
      }
      this.selection_renderer.RenderSelections();

      this.MouseDrag([], (move_event: MouseEvent) => {
        const address = this.layout.CoordinateToRowHeader(move_event.offsetY - offset.y);
        const area = new Area(address, base_address, true);

        if (selection.empty || !area.Equals(selection.area)) {
          this.Select(selection, area, undefined, true);
          this.selection_renderer.RenderSelections();
        }
      }, (end_event: MouseEvent) => {
        // console.info('end');

      });
    }
  }

  /**
   * handler for mousedown events on the column (top) header.
   * handles selection and resizing.
   *
   * FIXME: argument selection
   */
  private MouseDown_ColumnHeader(event: MouseEvent) {

    event.stopPropagation();
    event.preventDefault();

    let base_address = this.layout.CoordinateToColumnHeader(event.offsetX);

    const bounding_rect = this.layout.column_header_cover.getBoundingClientRect();
    const offset = {
      x: bounding_rect.left,
      y: bounding_rect.top,
    };

    if (this.cell_resize.column >= 0) {
      const column = this.cell_resize.column;
      const base = offset.x + event.offsetX;

      // doubleclick

      if (this.IsDoubleClick({row: -1, column})) {

        let columns = [column];

        if (!this.primary_selection.empty &&
          this.primary_selection.area.columns > 1 &&
          this.primary_selection.area.start.row === Infinity &&
          this.primary_selection.area.ContainsColumn(column)) {

          // update all selected columns. these could be in different tiles.

          const area = this.model.sheet.RealArea(this.primary_selection.area); // in case the whole sheet is selected

          columns = [];
          for (let c = area.start.column; c <= area.end.column; c++) {
            columns.push(c);
          }

        }

        // call with width = undefined, means auto-size

        this.ExecCommand({
          key: CommandKey.ResizeColumns,
          column: columns,
        });

        /*
        this.model.sheet.AutoSizeColumn(column, false);
        this.layout.UpdateTileWidths(true, column);
        this.Repaint(false, true); // repaint full tiles
        this.layout.UpdateAnnotation(this.annotations);
        this.grid_events.Publish({type: 'structure'}); // FIXME: no queued update?
        */
        return;
      }

      //

      // width of COLUMN
      const original_width = this.model.sheet.GetColumnWidth(column);
      let width = original_width;

      const rect = this.layout.OffsetCellAddressToRectangle({ row: 0, column });
      const tooltip_base = offset.x + rect.right;

      this.layout.ShowTooltip({
        up: true,
        text: `${width}px`,
        x: tooltip_base,
        y: Math.round(bounding_rect.bottom + 10),
      });

      this.MouseDrag(['column-resize'], (move_event: MouseEvent) => {
        const delta = Math.max(-original_width, Math.round(move_event.offsetX - base));

        if (delta + original_width !== width) {

          width = delta + original_width;

          this.layout.UpdateTooltip({
            text: `${width}px`,
            x: tooltip_base + delta,
          });

          // tile_sizes[tile_index] = tile_width + delta;
          this.model.sheet.SetColumnWidth(column, width);

          requestAnimationFrame(() => {
            this.layout.UpdateTileWidths(true, column);
            this.Repaint(false, true); // repaint full tiles
            this.layout.UpdateAnnotation(this.annotations);
          });

        }
      }, (end_event: MouseEvent) => {

        this.layout.HideTooltip();

        requestAnimationFrame(() => {

          // @see MouseDown_RowHeader

          const columns = [column];

          if (!this.primary_selection.empty &&
            this.primary_selection.area.columns > 1 &&
            this.primary_selection.area.start.row === Infinity &&
            this.primary_selection.area.ContainsColumn(column)) {

            // update all selected columns. these could be in different tiles.

            const area = this.model.sheet.RealArea(this.primary_selection.area); // in case the whole sheet is selected

            for (let c = area.start.column; c <= area.end.column; c++) {
              // this.model.sheet.ColumnWidth(c, width, true);
              columns.push(c);
            }

            // for next call
            // column = area.start.column; // ??

          }

          this.ExecCommand({
            key: CommandKey.ResizeColumns,
            column: columns,
            width,
          });

          /*
          // need a full layout in the event we have to add tiles
          // this.layout.UpdateTileWidths(true, column);
          this.layout.UpdateTiles();

          this.Repaint(true, true); // repaint ALL tiles
          this.layout.UpdateAnnotation(this.annotations);
          this.grid_events.Publish({type: 'structure'}); // FIXME: no queued update?
          */

        });

      });
    }
    else {

      const selection = this.SelectingArgument() ?
        this.active_selection : this.primary_selection;

      if (event.shiftKey && !selection.empty) {
        const tmp = selection.target;
        this.Select(selection, new Area(selection.target, base_address, true), undefined, true);
        base_address = tmp;
      }
      else {
        this.Select(selection, new Area(base_address), { row: 0, column: base_address.column });
      }
      this.selection_renderer.RenderSelections();

      this.MouseDrag([], (move_event: MouseEvent) => {
        const address = this.layout.CoordinateToColumnHeader(move_event.offsetX - offset.x);
        const area = new Area(address, base_address, true);
        if (selection.empty || !area.Equals(selection.area)) {
          this.Select(selection, area, undefined, true);
          this.selection_renderer.RenderSelections();
        }
      });
    }
  }

  private HoverCell(address: ICellAddress, event?: MouseEvent) {

    // does this cell have a note?

    const cell = this.cells.GetCell(address, false);
    const note = cell ? cell.note : undefined;

    if (note) {

      // move and show
      this.layout.ShowNote(note, address, event);
      this.hover_note_visible = true;
    }
    else if (this.hover_note_visible) {

      // hide
      this.layout.HideNote();
      this.hover_note_visible = false;
    }

    // set

    this.hover_cell = {...address};

  }

  /**
   * grid move handler for hit-testing various areas
   */
  private MouseMove_Grid(event: MouseEvent) {

    event.stopPropagation();
    event.preventDefault();

    // needed for legacy

    if (this.cell_resize.row >= 0 || this.cell_resize.column >= 0) {
      this.layout.ResizeCursor();
    }

    // don't show hints if we are editing

    if (!(this.cell_editor && this.cell_editor.visible)) {
      const address = this.layout.PointToAddress_Grid({ x: event.offsetX, y: event.offsetY });
      if (this.hover_cell.row !== address.row || this.hover_cell.column !== address.column) {
        this.HoverCell(address, event);
      }
    }

    if (this.primary_selection.empty || !this.selection_renderer.nub_rectangle) {
      if (this.nub_select_flag) {
        this.layout.grid_cover.classList.remove('nub-select');
        this.nub_select_flag = false;
      }
      return;
    }

    const nub = this.selection_renderer.nub_rectangle.Contains(event.offsetX, event.offsetY);
    if (nub === this.nub_select_flag) return;
    if (nub) {
      this.layout.grid_cover.classList.add('nub-select');
    }
    else {
      this.layout.grid_cover.classList.remove('nub-select');
    }
    this.nub_select_flag = nub;

  }

  /**
   * unifying double-click. pass the test address. returns true if this looks
   * like a double-click on that address. otherwise sets flags to capture the
   * next one.
   *
   * FIXME: parameterize timeout?
   */
  private IsDoubleClick(address: ICellAddress, timeout = 300){

    if (this.double_click_data.address
      && this.double_click_data.address.row === address.row
      && this.double_click_data.address.column === address.column) {

      clearTimeout(this.double_click_data.timeout);
      this.double_click_data.address = undefined;
      this.double_click_data.timeout = undefined;
      return true;

    }
    else {
      if (this.double_click_data.timeout) clearTimeout(this.double_click_data.timeout);
      this.double_click_data.address = { ...address };
      this.double_click_data.timeout = setTimeout(() => {
        this.double_click_data.address = undefined;
        this.double_click_data.timeout = undefined;
      }, timeout);
    }

  }

  /**
   * handles mouse down events on the grid area:
   * selection (click-drag) and editing (double-click)
   */
  private MouseDown_Grid(event: MouseEvent) {

    if (this.cell_editor && this.cell_editor.visible && this.cell_editor.HandleMouseEvent(event)) return;

    event.stopPropagation();
    event.preventDefault();

    const selecting_argument = this.SelectingArgument();
    if (!selecting_argument && this.additional_selections.length) {
      this.ClearAdditionalSelections();
    }

    this.Focus();

    // unless we're selecting an argument, close the ICE

    if (this.cell_editor && this.cell_editor.visible && !this.cell_editor.selecting) this.DismissEditor();

    let base_address = this.layout.PointToAddress_Grid({ x: event.offsetX, y: event.offsetY });

    const selection = selecting_argument ? this.active_selection : this.primary_selection;

    // don't handle double-click when selecting arguments

    if (!selecting_argument) {
      if (this.IsDoubleClick(base_address)) {
        this.EditCell({ target: base_address, area: new Area(base_address) }, false);
        return;
      }
    }

    // move events will be in mask (window) coordinates,
    // so we will need to offset

    let bounding_rect = this.layout.grid_cover.getBoundingClientRect();
    const offset = {
      x: bounding_rect.left,
      y: bounding_rect.top,
    };

    const overlay_classes: string[] = [];

    // on shift-click, consolidate selection. that only works if there's
    // a target in the original selection.

    // if you click the nub in the primary selection, select a rectangle
    // keeping the original top-left. this can lose the target, but that's
    // not ultimately a problem.

    if (event.shiftKey && !selection.empty) {
      const tmp = selection.target;
      this.Select(selection, new Area(base_address, selection.target, true), undefined, true);
      base_address = tmp;
    }
    else if (this.nub_select_flag) {
      base_address = selection.area.TopLeft();
      overlay_classes.push('nub-select');
    }
    else {
      this.Select(selection, new Area(base_address), base_address);
    }

    this.selection_renderer.RenderSelections();

    if (selecting_argument) this.UpdateSelectedArgument(selection);

    const grid_rect =
      this.layout.CellAddressToRectangle({ row: 0, column: 0 }).Combine(
        this.layout.CellAddressToRectangle({
          row: this.model.sheet.rows - 1,
          column: this.model.sheet.columns - 1,
        })).Expand(-1, -1);

    this.MouseDrag(overlay_classes, (move_event: MouseEvent) => {

      // check if we are oob the grid

      const point = {
        x: move_event.offsetX - offset.x,
        y: move_event.offsetY - offset.y,
      };
      const testpoint = grid_rect.Clamp(point.x, point.y);
      const address = this.layout.PointToAddress_Grid(testpoint, true);

      const scroll_node = this.layout.scroll_reference_node;

      let reset_offset = false;
      if (this.container && this.options.scrollbars) {
        if (point.x < scroll_node.scrollLeft) {
          scroll_node.scrollLeft -= 25;
          reset_offset = true;
        }
        else if (point.x > scroll_node.scrollLeft + this.container.clientWidth) {
          scroll_node.scrollLeft += 25;
          reset_offset = true;
        }
        if (point.y < scroll_node.scrollTop) {
          scroll_node.scrollTop -= 25;
          reset_offset = true;
        }
        else if (point.y > scroll_node.scrollTop + this.container.clientHeight) {
          scroll_node.scrollTop += 25;
          reset_offset = true;
        }
        if (reset_offset) {
          bounding_rect = this.layout.grid_cover.getBoundingClientRect();
          offset.x = bounding_rect.left + document.body.scrollLeft;
          offset.y = bounding_rect.top + document.body.scrollTop;
        }
      }

      const area = new Area(address, base_address, true);
      if (selection.empty || !area.Equals(selection.area)) {
        this.Select(selection, area, undefined, true);
        this.selection_renderer.RenderSelections();

        if (selecting_argument) {
          this.UpdateSelectedArgument(selection);
        }
        else if (!selection.empty && !selection.area.entire_sheet) {
          if (selection.area.entire_column) {
            this.UpdateAddressLabel(undefined, selection.area.columns + 'C');
          }
          else if (selection.area.entire_row) {
            this.UpdateAddressLabel(undefined, selection.area.rows + 'R');
          }
          else if (selection.area.count > 1) {
            this.UpdateAddressLabel(undefined, selection.area.rows + 'R x ' +
              selection.area.columns + 'C');
          }
          else {
            this.UpdateAddressLabel(selection);
          }
        }
      }
    }, (end_event: MouseEvent) => {
      // console.info('end');
      this.UpdateAddressLabel();

      if (selecting_argument) {
        if (this.cell_editor && this.cell_editor.visible) {
          // ...
        }
        else if (this.formula_bar) {
          // console.info('calling focus editor');
          this.formula_bar.FocusEditor();
        }
      }

    });
  }

  private UpdateSelectedArgument(selection: GridSelection) {

    // if this is a single merged block, we want to insert it as the
    // root cell and not the range.

    let label = selection.area.spreadsheet_label;

    const cell = this.model.sheet.CellData(selection.area.start);
    if (cell.merge_area && cell.merge_area.Equals(selection.area)) {
      label = Area.CellAddressToLabel(cell.merge_area.start);
    }

    if (this.cell_editor && this.cell_editor.visible && this.cell_editor.selecting) {
      this.cell_editor.InsertReference(label, 0);
    }
    else if (this.formula_bar && this.formula_bar.selecting) {
      this.formula_bar.InsertReference(label, 0);
    }
  }

  /**
   * unified method to check if we are selecting an argument in the formula
   * bar editor or the in-cell editor
   *
   * FIXME: why is this not an accessor?
   */
  private SelectingArgument() {
    return (this.cell_editor && this.cell_editor.visible && this.cell_editor.selecting)
      || (this.formula_bar && this.formula_bar.selecting);
  }

  /**
   * event handler for keyboard events. some we handle directly (directional
   * navigation), some we ignore (most control-key combinations), and if you
   * type text we start the in-cell editor and pass on the event.
   */
  private KeyDown(event: KeyboardEvent) {

    let editor_open = false;

    if (this.cell_editor) {
      editor_open = this.cell_editor.visible;
      if (editor_open && this.cell_editor.HandleKeyEvent(event)) return;
    }

    const selecting_argument = this.SelectingArgument();

    if (this.formula_bar && this.formula_bar.focused && !selecting_argument) {
      return;
    }

    const selection = selecting_argument ? this.active_selection : this.primary_selection;

    const delta = { rows: 0, columns: 0 };
    let within_selection = false;
    let expand_selection = false;

    // handle some specific control-key combinations

    if (event.ctrlKey || (UA.is_mac && event.metaKey)) {

      // handle ctrl+shift+arrow AND ctrl+arrow (we used to just handle
      // ctrl+shift+arrow). we don't handle any other ctrl+shift combinations.

      switch (event.key) {
        case 'ArrowDown':
        case 'Down':
          delta.rows++;
          break;

        case 'ArrowUp':
        case 'Up':
          delta.rows--;
          break;

        case 'ArrowLeft':
        case 'Left':
          delta.columns--;
          break;

        case 'ArrowRight':
        case 'Right':
          delta.columns++;
          break;

        case '/':
          event.stopPropagation();
          event.preventDefault();
          this.SelectArray();
          break;

        default:
          if (event.shiftKey) {
            return;
          }
      }

      if (delta.columns || delta.rows) {

        // NOTE: we're not using the "advance selection" method, since
        // we have particular requirements when block-selecting.

        event.stopPropagation();
        event.preventDefault();

        // FIXME: we're handling blocks OK, but we need to handle jumping
        // between blocks or jumping to the next block. call that a TODO.

        if (!selection.empty && (delta.columns || delta.rows)) {
          if (this.BlockSelection(selection, !!event.shiftKey, delta.columns, delta.rows)) {
            return;
          }
        }
        else {
          return;
        }

      }
      else {

        const applied_style: Style.Properties = {};
        const selected_style: Style.Properties =
          this.primary_selection.empty ? {} :
            this.model.sheet.CellData(this.primary_selection.target).style || {};

        // seems to be the best bet for xplatform

        switch (event.key) {

          /*
          case 'c':
            console.info("calling exec command copy")
            const x = document.execCommand('copy');
            console.info('x?', x);
            break;

          case 'x':
            console.info("calling exec command cut")
            document.execCommand('cut');
            break;

          case 'v':
            console.info("calling exec command paste")
            document.execCommand('paste');
            break;
          */

          case 'b':
            applied_style.font_bold = !selected_style.font_bold;
            break;

          case 'i':
            applied_style.font_italic = !selected_style.font_italic;
            break;

          case 'u':
            applied_style.font_underline = !selected_style.font_underline;
            break;

          case 'a':
            this.Select(this.primary_selection, new Area({ row: Infinity, column: Infinity }), undefined, true);
            this.selection_renderer.RenderSelections();
            break;

          // handle Ctrl+Alt+0 = select nothing

          case '0':
            if (!event.altKey) return;
            this.ClearSelection(this.primary_selection); // not clear the selection, clear selection
            this.selection_renderer.RenderSelections();
            break;

          default:
            if (event.key !== 'Control') {
              // console.info('unhandled control key', event.key); // dev
            }
            return;
        }

        if (Object.keys(applied_style).length) {
          this.ApplyStyle(undefined, applied_style);
        }

      }
    }
    else {
      switch (event.key) {
        case 'Tab':
          if (event.shiftKey) delta.columns--;
          else delta.columns++;
          within_selection = true;
          break;

        case 'Enter':
          if (event.shiftKey) delta.rows--;
          else delta.rows++;
          within_selection = true;
          break;

        case 'ArrowDown':
        case 'Down':
          delta.rows++;
          expand_selection = event.shiftKey;
          break;

        case 'ArrowUp':
        case 'Up':
          delta.rows--;
          expand_selection = event.shiftKey;
          break;

        case 'ArrowLeft':
        case 'Left':
          delta.columns--;
          expand_selection = event.shiftKey;
          break;

        case 'ArrowRight':
        case 'Right':
          delta.columns++;
          expand_selection = event.shiftKey;
          break;

        case 'Delete':
        case 'Del':
          if (!selection.empty) {
            this.DeleteSelection(selection);
          }
          break;

        case 'PageUp':
        case 'PageDown':
          return; // FIXME

        case 'Control':
        case 'Shift':
        case 'Alt':
          // console.info('skip', event.key);
          return;

        default:
          // console.info('ek', event.key);

          if (!selection.empty) this.EditCell(selection, true, event);
          return;
      }
    }

    event.stopPropagation();
    event.preventDefault();

    // console.info(event.key);

    if (delta.rows || delta.columns) {
      this.AdvanceSelection(delta, selection, within_selection, expand_selection, !editor_open);
    }

  }

  /**
   * select the array containing the current cell, if any. if there's no
   * array, do nothing.
   */
  private SelectArray() {
    if (this.primary_selection.empty) {
      return;
    }

    const cell = this.model.sheet.CellData(this.primary_selection.target);
    if (!cell || !cell.area) {
      return;
    }

    this.Select(this.primary_selection, cell.area, cell.area.start);
    this.selection_renderer.RenderSelections();

  }

  /**
   * select a block. returns true if we've handled it; returns false
   * if we want to revert to the standard behavior.
   *
   * (block selection refers to selecting more than one cell at once,
   * using ctrl+arrow. selection jumps across all populated cells in
   * a given direction for a given row/column).
   */
  private BlockSelection(selection: GridSelection, expand_selection: boolean,
    columns: number, rows: number, render = true): boolean {

    // select the containing block. note that we do not handle
    // the case of BOTH rows and columns.

    if (selection.empty) return false;
    const start: ICellAddress = { ...selection.target };

    // the starting cell for the purposes of a block depends on the
    // direction we're heading

    // changing behavior: always start at target... but clip the selection
    // to target (if expanding) so that it's only in one direction vis-a-vis
    // the target

    // adjusted slightly: start at the target OR the end of the selection
    // IF the end of the selection is in the right direction relative to
    // the delta...

    if (rows > 0) start.row = Math.max(start.row, selection.area.end.row);
    else if (rows < 0) start.row = Math.min(start.row, selection.area.start.row);

    if (columns > 0) start.column = Math.max(start.column, selection.area.end.column);
    else if (columns < 0) start.column = Math.min(start.column, selection.area.start.column);

    /*
    if (rows > 0) start.row = selection.area.end.row;
    else if (rows < 0) start.row = selection.area.start.row;

    else if (columns > 0) start.column = selection.area.end.column;
    else if (columns < 0) start.column = selection.area.start.column;
    */

    let cell = this.cells.GetCell(selection.target, false);
    if (!cell || cell.type === ValueType.undefined) {
      return false;
    }

    // ok, expand in the desired direction until we hit an empty cell

    let end = { ...start };
    for (; ;) {

      // FIXME: merge/array handling

      // a little more complicated: test every cell in the cross-dimension,
      // so we capture jagged blocks. for example:
      //
      // [target] [ full ]
      // [ full ] [ full ]
      // [empty ] [ full ]
      // [ full ] [ full ]
      // [ full ] [ full ]
      //
      // if you are selecting across, then down, you want to capture the
      // whole array but it still stop on the empty cell because we're
      // testing from target.
      //

      const test = { row: end.row + rows, column: end.column + columns };
      if (test.column < 0 || test.row < 0 ||
        test.column >= this.model.sheet.columns ||
        test.row >= this.model.sheet.rows) break;

      let has_value = false;
      if (rows) {
        for (let column = selection.area.start.column; !has_value && column <= selection.area.end.column; column++) {
          cell = this.cells.GetCell({ row: test.row, column }, false);
          has_value = has_value || (!!cell && cell.type !== ValueType.undefined);
          if (!has_value && cell && cell.merge_area) {
            cell = this.cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && cell.type !== ValueType.undefined);
          }
        }
      }
      else {
        for (let row = selection.area.start.row; !has_value && row <= selection.area.end.row; row++) {
          cell = this.cells.GetCell({ row, column: test.column }, false);
          has_value = has_value || (!!cell && cell.type !== ValueType.undefined);
          if (!has_value && cell && cell.merge_area) {
            cell = this.cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && cell.type !== ValueType.undefined);
          }
        }
      }

      if (!has_value) { break; }

      end = test;

    }

    if (expand_selection) {

      // new behavior: we have moved in one direction from the
      // target, now clip the other direction. keep the other
      // dimension consistent.

      if (rows) {

        // clip dimension
        start.row = selection.target.row;

        // preserve other dimension
        start.column = selection.area.start.column;
        end.column = selection.area.end.column;
      }
      else {

        // clip dimension
        start.column = selection.target.column;

        // preserve other dimension
        start.row = selection.area.start.row;
        end.row = selection.area.end.row;
      }

      const area = new Area(start, end, true);
      this.Select(selection, area, selection.target, true);
    }
    else {
      this.Select(selection, new Area(end));
    }
    this.ScrollIntoView(end);

    if (this.SelectingArgument()) this.UpdateSelectedArgument(selection);
    if (render) {
      this.DelayedRender();
    }

    return true;

  }

  /**
   * deletes (clears) the selected area.
   *
   * FIXME: should probably be an API method, or have a second method that
   * clears the primary selection
   */
  private DeleteSelection(selection: GridSelection) {
    if (selection.empty) return;
    const area = this.model.sheet.RealArea(selection.area);
    this.ExecCommand({ key: CommandKey.Clear, area });
3  }

  /**
   * sets cell value, inferring type and (possibly) inferring cell style
   * (numbers only), so that 10% and $1,000 retain styles. this should only
   * be used for direct editing -- copy and paste can copy and paste styles.
   *
   * @param address cell address
   * @param value value entered, usually this will be a string (we will try
   * to parse numbers/booleans)
   *
   * @param exec execute commands immediately; alternatively, return the list
   * of commands. the former is the default for editor commits; the latter
   * is used for paste.
   */
  private SetInferredType(selection: GridSelection, value: any, array = false, exec = true) {

    // validation: cannot change part of an array without changing the
    // whole array. so check the array. separately, if you are entering
    // an array, make sure that no affected cell is part of an existing
    // array.

    let target = selection.target || selection.area.start;
    const cell = this.model.sheet.CellData(target);

    if (cell.area) {
      if ((!array && cell.area.count > 1) || !selection.area || !selection.area.Equals(cell.area)) {
        // FIXME // this.Publish({type: 'grid-error', err: GridErrorType.ArrayChange, reference: selection.area });
        console.info('rejected: can\'t change part of an array (1)');
        return;
      }
    }
    else if (array) {
      let existing_array = false;
      let reference: Area;
      this.model.sheet.cells.IterateArea(selection.area, (element: Cell, column?: number, row?: number) => {
        if (element.area) {
          column = column || 0;
          row = row || 0;
          reference = new Area({ column, row });
          existing_array = true;
        }
      }, false);
      if (existing_array) {
        // FIXME // this.Publish({type: 'grid-error', err: GridErrorType.ArrayChange, reference });
        console.info('rejected: can\'t change part of an array (2)');
        return;
      }
    }

    if (cell.merge_area) target = cell.merge_area.start; // this probably can't happen at this point

    // first check functions

    const is_function = (typeof value === 'string' && value.trim()[0] === '=');
    const commands: Command[] = [];

    if (is_function) {
      value = this.FixFormula(value);

      // so what we are doing now is copying style from a function argument,
      // if a function argument has a number format, but only if there's no
      // explicit number format already set for this cell (either in the cell
      // directly or in the row/column).

      // it might actually be preferable to override the local cell style,
      // if there is one, if the argument has a style. (...)

      if (!this.model.sheet.HasCellStyle(target)) {
        const formula_parse_result = this.parser.Parse(value);
        if (formula_parse_result && formula_parse_result.dependencies) {
          const list = formula_parse_result.dependencies;
          for (const key of Object.keys(list.addresses)) {
            const address = list.addresses[key];
            if (this.model.sheet.HasCellStyle({...address})) {
              const test = this.model.sheet.CellData({...address});
              if (test.style && test.style.number_format) {
                const style: Style.Properties = {
                  number_format: test.style.number_format,
                };
                // if (array) this.model.sheet.UpdateAreaStyle(selection.area, style, true, true);
                // else this.model.sheet.UpdateCellStyle(target, style, true, true);
                commands.push({key: CommandKey.UpdateStyle,
                  area: array ? selection.area : target, style, delta: true});
              }
              break;
            }
          }
        }
      }
    }

    // next try to infer the number format, with hints as to format

    const parse_result = ValueParser.TryParse(value);

    if (!is_function && parse_result.type === ValueType.number) {

      const text = value.toString();
      let number_format = '';
      const hints = parse_result.hints || Hints.None;

      // tslint:disable-next-line:no-bitwise
      if (hints & Hints.Date) {
        if (!cell.style || !cell.style.number_format ||
            (NumberFormatCache.Equals(cell.style.number_format, 'general'))) {
          number_format = 'short date';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Exponential) {
        number_format = 'exponential';
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Percent) {
        number_format = 'percent';
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Currency) {
        number_format = 'currency';
      }
      // tslint:disable-next-line:no-bitwise
      else if ((hints & Hints.Grouping) || (hints & Hints.Parens)) {
        number_format = 'accounting';
      }

      if (number_format) {
        // if (array) this.model.sheet.UpdateAreaStyle(selection.area, { number_format }, true, true);
        // else this.model.sheet.UpdateCellStyle(target, { number_format }, true, true);
        commands.push({
            key: CommandKey.UpdateStyle,
            area: array ? selection.area : target,
            style: { number_format },
            delta: true,
          });
      }

      // always use // value = parse_result.value;

    }

    /*
    if (array) {
      this.model.sheet.SetArrayValue(selection.area, parse_result.value);
    }
    else {
      this.model.sheet.SetCellValue(target, parse_result.value);
    }
    */

    commands.push({
      key: CommandKey.SetRange,
      area: array ? selection.area : target,
      array,
      value: is_function ? value : parse_result.value,
    });

    if (exec) {
      this.ExecCommand(commands);
    }
    else {
      return commands;
    }
  }


  /**
   * tries to correct some basic formula errors, opening with a space,
   * not closing all parens, (...)
   */
  private FixFormula(formula: string): string {
    if (formula.trim()[0] !== '=') return formula;
    // if (!formula.trim().startsWith('=')) return formula;
    // formula = formula.trimLeft();
    formula = formula.replace(/^\s+/, '');

    let q = false;
    let a = false;
    let paren = 0;
    let escape = false;

    // for ( let i = 0; i < formula.length; i++ ){
    //  const c = formula[i];
    for (const char of formula) {
      if (!escape) {
        switch (char) {
          case '"':
            if (q) q = false;
            else if (!a) q = true;
            break;
          case '\'':
            if (a) a = false;
            else if (!q) a = true;
            break;
          case '\\':
            escape = true;
            break;
          case '(':
            if (!q && !a) paren++;
            break;
          case ')':
            if (!q && !a) paren--;
            break;
        }
      }
    }

    if (q) formula += '"';
    else if (a) formula += '\'';
    while (paren > 0) {
      formula += ')';
      paren--;
    }

    return formula;
  }

  /**
   * dismisses the in-cell editor and returns to normal behavior.
   * removes any highlighted selections (arguments).
   */
  private DismissEditor(update_selection = true) {

    if (!this.cell_editor) return;
    this.Focus();
    this.cell_editor.Hide();

    this.ClearAdditionalSelections();
    this.ClearSelection(this.active_selection);

  }

  private NormalizeCellValue(cell: Cell) {

    let cell_value = cell.value;

    if (cell.type === ValueType.number && cell.style && cell.style.number_format) {
      const format = NumberFormatCache.Get(cell.style.number_format);
      if (format.date_format) {
        const date = new Date(cell_value * RDateScale);
        const number_format = (date.getHours() || date.getMinutes() || date.getSeconds()) ?
          'timestamp' : 'short date';
        cell_value = NumberFormatCache.Get(number_format).Format(cell_value);
      }
      else if (/(?:%|percent)/.test(cell.style.number_format)) {

        let precision = 0;

        const match = cell.value.toString().match(/\.(.*?)$/);
        if (match && match[1]) {
          precision = Math.max(0, match[1].length - 2); // because we are *100
        }

        cell_value = (cell_value * 100).toFixed(precision) + '%';
        if (Localization.decimal_separator === ',') {
          // cell_value = (cell.value * 100).toString().replace(/\./, ',');
          cell_value = cell_value.replace(/\./, ',');
        }

      }
      else {
        if (cell_value && Localization.decimal_separator === ',') {
          cell_value = cell.value.toString().replace(/\./, ',');
        }
      }
    }
    else if (cell.type === ValueType.boolean) {
      return cell_value.toString().toUpperCase(); // ? 'True' : 'False';
    }
    else if (cell.type === ValueType.number) { // no style: I think this is no longer possible
      if (cell_value && Localization.decimal_separator === ',') {
        cell_value = cell.value.toString().replace(/\./, ',');
      }
    }

    return cell_value;

  }

  /**
   * starts the in-cell editor at the given sheet address. this method doesn't
   * handle scroll-into-view, do that first if necessary.
   *
   * @param address the cell address. we'll check for merge head before editing.
   * @param flush flush contents before editing -- default for typing, !default
   * for double-click
   * @param event if this is triggered by typing, we want to pass the key
   * event directly to the editor (actually we'll pass a synthetic copy)
   */
  private EditCell(selection: GridSelection, flush = true, event?: KeyboardEvent) {
    if (!this.cell_editor) return;

    let address = selection.target || selection.area.start;
    let cell = this.model.sheet.CellData(address);
    let rect: Rectangle;

    // new, hide note if visible

    if (this.hover_note_visible) {
      this.layout.HideNote();
    }

    // merged cell, make sure we get/set value from the head
    // also get full rect for the editor

    if (cell.merge_area) {
      rect = this.layout.OffsetCellAddressToRectangle(cell.merge_area.start).Combine(
        this.layout.OffsetCellAddressToRectangle(cell.merge_area.end));
      address = cell.merge_area.start;
      cell = this.model.sheet.CellData(address);
    }
    else {
      rect = this.layout.OffsetCellAddressToRectangle(address);
    }

    // locked: can't edit!

    if (cell.style && cell.style.locked) {
      console.info('cell is locked for editing');
      return;
    }


    // FIXME: scroll into view (might be 1/2 visible)

    // UPDATE: we switched the cell editor parent to the container, so that
    // we can properly trap mouse move events. however that requires that we
    // offset rectangles by the row/column headers.

    // this width/height is actually in the sheet, although that's not really
    // a good place for it. sheet should be data-specific, and header size
    // is more of an application thing (although I guess you could resize the
    // headers in a particular sheet...) FIXME?

    // UPDATE: and we can't use offsetWidth/offsetHeight in legacy renderer...

    rect = rect.Shift(this.layout.header_size.width, this.layout.header_size.height);

    let cell_value = cell.value;

    if (flush) {
      if (cell.type === ValueType.number && cell.style &&
        cell.style.number_format && /(?:%|percent)/.test(cell.style.number_format)) {
        cell_value = '%';
      }
      else {
        cell_value = undefined;
      }
    }
    else {
      cell_value = this.NormalizeCellValue(cell);
    }

    // const value: any = flush ? undefined : cell_value;

    // cell rect, offset for headers. FIXME: do we always offset for headers?
    // if so, that should go in the method.

    this.cell_editor.Edit(selection, rect.Shift(-1, -1).Expand(1, 1), cell_value, event);

  }

  private BoundAddressArea(address: ICellAddress, area: Area) {

    // order of overflow is different for vertical/horizontal movement.
    // also we don't want to double-step. so there are four separate,
    // double tests... it seems redundant.

    if (address.column > area.end.column) {
      address.row = this.StepVisibleRows(address.row, 1);
      if (address.row > area.end.row) address.row = area.start.row;
      address.column = area.start.column;
    }
    else if (address.column < area.start.column) {
      address.row = this.StepVisibleRows(address.row, -1);
      if (address.row < area.start.row) address.row = area.end.row;
      address.column = area.end.column;
    }
    else if (address.row > area.end.row) {
      address.column = this.StepVisibleColumns(address.column, 1);
      if (address.column > area.end.column) address.column = area.start.column;
      address.row = area.start.row;
    }
    else if (address.row < area.start.row) {
      address.column = this.StepVisibleColumns(address.column, -1);
      if (address.column < area.start.column) address.column = area.end.column;
      address.row = area.end.row;
    }

  }

  /**
   * step from row X to row (X+Y). Y can be negative. we add this method to
   * support stepping across hidden (0-height) rows, so if you down arrow
   * it doesn't get stuck inside the hidden row (bad UX).
   *
   * UPDATE: no longer clamping. various methods rely on tests for < 0, so
   * we can't change that behavior. [FIXME: return an underflow flag?]. just
   * treat negative rows as not hidden, return the result.
   */
  private StepVisibleRows(start: number, step: number) {
    if (step > 0) {
      for (let i = 0; i < step; i++) {
        if (!this.model.sheet.GetRowHeight(++start)) i--;
      }
    }
    else if (step < 0) {
      for (let i = 0; i > step; i--) {
        if (--start >= 0 && !this.model.sheet.GetRowHeight(start)) i++;
      }
    }
    return start;
  }

  /**
   * step columns.
   * @see StepVisibleRows
   */
  private StepVisibleColumns(start: number, step: number) {
    if (step > 0) {
      for (let i = 0; i < step; i++) {
        if (!this.model.sheet.GetColumnWidth(++start)) i--;
      }
    }
    else if (step < 0) {
      for (let i = 0; i > step; i--) {
        if (--start >= 0 && !this.model.sheet.GetColumnWidth(start)) i++;
      }
    }
    return start;
  }

  /**
   * advances selection by x rows and columns. you can also step around
   * within a selection, generally by using enter and tab when there is
   * a multi-cell selection.
   *
   * not sure why this function renders by default, but we don't want that
   * in the case of closing the ICE. since normal operation may rely on this
   * behavior, at least for now, we'll make a parameter to disable. but it
   * should probably not render.
   */
  private AdvanceSelection(
    delta: Extent,
    selection: GridSelection,
    within_selection = false,
    expand_selection = false,
    render = true) {

    const selecting_argument = this.SelectingArgument();
    let expanded = false;

    if (selection.empty) {

      // different behavior
      if (selecting_argument) {
        const target = {
          row: Math.max(0, this.StepVisibleRows(this.primary_selection.target.row, delta.rows)),
          column: Math.max(0, this.StepVisibleColumns(this.primary_selection.target.column, delta.columns)),
        };
        this.Select(selection, new Area(target));
      }
      else {
        this.Select(selection, new Area({ row: 0, column: 0 }));
      }
    }
    else {

      const target_cell = this.model.sheet.CellData(selection.target);

      // if there's a merge, behavior may be a little different. for stepping,
      // we step into the merge cell when we hit the head. otherwise we skip
      // it entirely (which is a little complicated).

      // for expanding, we need to make sure that we expand beyond (or contract
      // to exclude) the merge cell. let's do this for each section, if it's
      // possible to merge behavior we can do that later.

      // one thing we need to check early is the "within selection" flag --
      // if there's only a single merged cell selected, this is not correct.

      if (target_cell.merge_area && within_selection) {
        within_selection = !target_cell.merge_area.Equals(selection.area);
      }

      if (within_selection && selection.area.count > 1) {

        // tab or enter within a larger selection moves the
        // target, but doesn't change the selection. this one
        // does not scroll (perhaps it should, if necessary?)

        // could be a very large selection, or we have moused
        // around -- so scroll the target into view.

        const area = selection.area;
        const address = selection.target;

        // two things happen when merged. (1) if the current target is a
        // merge cell, then we need to step to the edge of the merge cell
        // (only matters if delta is positive):

        // (2) if the next cell is merged, then we either step onto the head
        // or, if we would step onto a subcell, pass over it entirely.

        while (true) {

          // step

          address.row = this.StepVisibleRows(address.row, delta.rows);
          address.column = this.StepVisibleColumns(address.column, delta.columns);

          // bound

          this.BoundAddressArea(address, area);

          // merged? if we're not on the head, keep stepping (FIXME: step over
          // for efficiency, don't waste multiple checks)

          const check_cell = this.model.sheet.CellData(address);
          if (!check_cell.merge_area ||
            (check_cell.merge_area.start.row === address.row &&
              check_cell.merge_area.start.column === address.column)) break;

        }

        this.Select(selection, area, address);

      }
      else if (expand_selection && selection && selection.target) {

        // shift-arrow expands (contracts) the selection.

        // FIXME: need to handle merges, where the step will be > 1

        const area = selection.area;
        const target = selection.target;

        const start = area.start;
        const end = area.end;

        const scroll_target = { row: Infinity, column: Infinity };

        if (delta.columns) {
          if (area.columns === 1) {
            if (delta.columns > 0) {
              end.column = this.StepVisibleColumns(end.column, 1);
              scroll_target.column = end.column;
            }
            else {
              start.column = this.StepVisibleColumns(start.column, -1);
              scroll_target.column = start.column;
            }
          }
          else if (area.end.column > target.column) {
            end.column = this.StepVisibleColumns(end.column, delta.columns);
            scroll_target.column = end.column;
          }
          else if (area.start.column < target.column) {
            start.column = this.StepVisibleColumns(start.column, delta.columns);
            scroll_target.column = start.column;
          }
          end.column = Math.max(0, end.column);
          start.column = Math.max(0, start.column);
        }

        if (delta.rows) {
          if (area.rows === 1) {
            if (delta.rows > 0) {
              end.row = this.StepVisibleRows(end.row, 1);
              scroll_target.row = end.row;
            }
            else {
              start.row = this.StepVisibleRows(start.row, -1);
              scroll_target.row = start.row;
            }
          }
          else if (area.end.row > target.row) {
            end.row = this.StepVisibleRows(end.row, delta.rows);
            scroll_target.row = end.row;
          }
          else if (area.start.row < target.row) {
            start.row = this.StepVisibleRows(start.row, delta.rows);
            scroll_target.row = start.row;
          }
          end.row = Math.max(0, end.row);
          start.row = Math.max(0, start.row);
        }

        for (const addr of [start, end, scroll_target]) {
          if (addr.row !== Infinity) {
            addr.row = Math.max(0, Math.min(addr.row, this.model.sheet.rows - 1));
          }
          if (addr.column !== Infinity) {
            addr.column = Math.max(0, Math.min(addr.column, this.model.sheet.columns - 1));
          }
        }

        this.ScrollIntoView(scroll_target);
        this.Select(selection, new Area(start, end), undefined, true);

      }
      else {

        // this section: no modifier, and either arrow keys or tab/enter
        // but not inside a larger selection. move and make a new selection,
        // so selection will be a single cell. scroll it into view.

        const address = selection.target;

        if (target_cell.merge_area) {
          if (delta.columns < 0) {
            address.column = this.StepVisibleColumns(target_cell.merge_area.start.column, -1);
          }
          else if (delta.columns > 0) {
            address.column = this.StepVisibleColumns(target_cell.merge_area.end.column, 1);
          }
          if (delta.rows < 0) {
            address.row = this.StepVisibleRows(target_cell.merge_area.start.row, -1);
          }
          else if (delta.rows > 0) {
            address.row = this.StepVisibleRows(target_cell.merge_area.end.row, 1);
          }
        }
        else {
          address.row = this.StepVisibleRows(address.row, delta.rows);
          address.column = this.StepVisibleColumns(address.column, delta.columns);
        }

        // NOTE: this is bounding.
        // FIXME: option to expand the sheet by selecting out of bounds.

        if (address.row >= this.model.sheet.rows && this.options.expand) {
          let row = this.model.sheet.rows;
          while (address.row >= row) { row += 8; }
          this.model.sheet.cells.EnsureRow(row);
          expanded = true;
        }
        if (address.column >= this.model.sheet.columns && this.options.expand) {
          let column = this.model.sheet.columns;
          while (address.column >= column) { column += 8; }
          this.model.sheet.cells.EnsureColumn(column);
          expanded = true;
        }

        if (expanded) {
          // console.info("expanded!");
          this.layout.UpdateTiles();
          this.layout.UpdateContentsSize();
          this.Repaint(true, true);

          render = true;
        }

        this.Select(selection, new Area({
          row: Math.min(
            Math.max(0, address.row),
            this.model.sheet.rows - 1),
          column: Math.min(
            Math.max(0, address.column),
            this.model.sheet.columns - 1),
        }));

        // we're calling renderselections early, to avoid jitter when
        // scrolling. FIXME: create a method to just update the given
        // selection, to minimize work here (maybe that's over-optimizing?)

        // at the least, we could flag that we've already done this so
        // it doesn't get called again on the next render

        this.selection_renderer.RenderSelections();

        // then scroll.

        this.ScrollIntoView(selection.target);

      }
    }

    if (this.SelectingArgument()) this.UpdateSelectedArgument(selection);

    if (render) {
      this.DelayedRender();
    }

  }

  /** highlight formula dependencies */
  private HighlightDependencies(dependencies: Area[], render = true) {

    // FIXME: cache, in case we parse the same string repeatedly?
    this.ClearAdditionalSelections(); // flush

    // this was causing chaos when I was typing a function, because
    // it was interpreting it as column 32 million. it started as
    // =A5/...
    // and I started typing round before A5, but that was interpreted
    // as ROUNDA5 (which is a lot of columns), and we're not limiting.
    //
    // (I feel like we used to have a sanity check on that -- was that
    // in parser?)
    //
    // nasty bug. so what we do here is limit selections to existing
    // range.

    // FIXME: we should actually limit by max of existing range or
    // displayed range, which may be larger (or is that implicit? ...)

    for (let area of dependencies) {
      if ((area.start.row === Infinity || area.start.row < this.model.sheet.rows) &&
          (area.start.column === Infinity || area.start.column < this.model.sheet.columns)) {
        area = this.model.sheet.RealArea(area);
        this.AddAdditionalSelection(area.start, area);
      }
    }

    if (render) this.selection_renderer.RenderSelections();

  }

  /**
   * add an additional selection to the list. don't add it if already
   * on the list (don't stack).
   */
  private AddAdditionalSelection(target: ICellAddress, area: Area) {
    const label = area.spreadsheet_label;
    if (this.additional_selections.some((test) => {
      return (test.area.spreadsheet_label === label);
    })) return;
    this.additional_selections.push({target, area});
  }

  /** remove all additonla (argument) selections */
  private ClearAdditionalSelections() {

    // NOTE: at the moment, additional selections are not
    // reflected in headers, so this is unecessary. it might
    // come back, though.

    // this.additional_selections = [];
    // this.additional_selections.length = 0; // legal? IE11?

    this.additional_selections.splice(0, this.additional_selections.length);

  }

  /**
   * utility method, internally calls Select with an undefined area
   */
  private ClearSelection(selection: GridSelection) {
    this.Select(selection);
  }

  /**
   * updates a selection, and handles marking headers as dirty
   * for subsequent renders (including any old selection).
   *
   * if the selection contains part of a merge area, it will be expanded
   * to include the full merge area (because you can't select part of a merge).
   *
   * @param area selection area
   * @param target optional selection target. if no target is passed and
   * the preseve_target field is not set, target will be set to the first
   * cell of the selection area
   * @param preserve_target preserve existing selection target
   */
  private Select(selection: GridSelection, area?: Area, target?: ICellAddress, preserve_target = false) {
    if (!selection.empty) {
      if (preserve_target) target = selection.target;
    }
    if (area) {

      let real_area = this.model.sheet.RealArea(area);
      if (!target) target = real_area.start;

      let recheck = true;

      // there has to be a better way to do this...

      while (recheck) {
        recheck = false;
        this.model.sheet.cells.IterateArea(real_area, (cell: Cell) => {
          if (cell.merge_area && !real_area.ContainsArea(cell.merge_area)) {
            area.ConsumeArea(cell.merge_area);
            real_area = this.model.sheet.RealArea(area);
            recheck = true;
          }
        });
      }

      selection.area = area;
      if (target) selection.target = target;
      selection.empty = false;

    }
    else {
      selection.empty = true;
    }

    // FIXME: this should clone

    if (selection === this.primary_selection) {

      this.layout.MockSelection();

      if (UA.is_edge) { this.Focus(); }

      this.grid_events.Publish({
        type: 'selection',
        selection: this.primary_selection,
      });

      this.UpdateAddressLabel();
      this.UpdateFormulaBarFormula();

    }

  }

  /**
   *
   */
  private UpdateFormulaBarFormula(formula_cell?: Cell) {

    if (!this.formula_bar) { return; }

    if (this.primary_selection.empty) {
      this.formula_bar.formula = '';
    }
    else {
      let data = this.model.sheet.CellData(this.primary_selection.target);

      // optimally we would do this check prior to this call, but
      // it's the uncommon case... not sure how important that is

      const head = data.merge_area || data.area;
      if (head) {
        if (head.start.column !== this.primary_selection.target.column
          || head.start.row !== this.primary_selection.target.row) {
          data = this.model.sheet.CellData(head.start);
        }
      }

      const locked = data.style && data.style.locked;
      this.formula_bar.editable = !locked;
      const value = this.NormalizeCellValue(data);

      // add braces for area
      if (data.area) {
        this.formula_bar.formula = '{' + (value || '') + '}';
      }
      else {
        this.formula_bar.formula = value || '';
      }
    }

  }

  private UpdateAddressLabel(selection = this.primary_selection, text?: string) {

    if (!this.formula_bar) { return; }

    if (typeof text !== 'undefined') {
      this.formula_bar.label = text;
    }
    else if (selection.empty) {
      this.formula_bar.label = '';
    }
    else {

      const data = this.model.sheet.CellData(this.primary_selection.target);
      if (data.merge_area) {
        this.formula_bar.label = Area.CellAddressToLabel(data.merge_area.start);
      }
      else {
        this.formula_bar.label = Area.CellAddressToLabel(selection.target);
      }
    }

  }

  private OnScroll() {
    const tiles = this.layout.VisibleTiles();
    if (!tiles.Equals(this.render_tiles)) {
      this.render_tiles = tiles;
      if (!this.layout_token) {

        // why raf here and not dispatcher?

        this.layout_token = requestAnimationFrame(() => this.Repaint());
      }
    }
  }

  private AttachListeners() {
    if (!this.container) throw new Error('invalid container');

    /*
    this.container.addEventListener('scroll', (event) => {
      const tiles = this.layout.VisibleTiles();
      if (!tiles.Equals(this.render_tiles)) {
        this.render_tiles = tiles;
        if (!this.layout_token) {
          this.layout_token = requestAnimationFrame(() => this.Repaint());
        }
      }
    });
    */

    this.container.addEventListener('copy', this.HandleCopy.bind(this));
    this.container.addEventListener('cut', this.HandleCut.bind(this));
    this.container.addEventListener('paste', this.HandlePaste.bind(this));

    // mouse down events for selection
    this.layout.grid_cover.addEventListener('mousedown', (event) => this.MouseDown_Grid(event));
    this.layout.column_header_cover.addEventListener('mousedown', (event) => this.MouseDown_ColumnHeader(event));
    this.layout.row_header_cover.addEventListener('mousedown', (event) => this.MouseDown_RowHeader(event));

    // move events on headers, to show column/row resize cursors where appropriate
    this.layout.column_header_cover.addEventListener('mousemove', (event) => this.MouseMove_ColumnHeader(event));
    this.layout.row_header_cover.addEventListener('mousemove', (event) => this.MouseMove_RowHeader(event));

    // this is for cursor changes
    this.layout.grid_cover.addEventListener('mousemove', (event) => this.MouseMove_Grid(event));

    // key handler
    this.container.addEventListener('keydown', (event) => this.KeyDown(event));

  }

  private RangeToTSV(range: any, address: Area) {
    const columns = address.columns;
    const rows = address.rows;

    const data: any = [];
    for (let i = 0; i < columns; i++) data[i] = [];
    const c1 = address.start.column;
    const r1 = address.start.row;
    range.forEach((cell: any) => {
      data[cell.column - c1][cell.row - r1] = cell;
    });

    const tsv = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < columns; c++) {
        let value = '';
        const ref = data[c][r];
        if (ref) {
          if (typeof ref.calculated !== 'undefined') value = ref.calculated;
          else if (typeof ref.value !== 'undefined') value = ref.value;
        }
        row.push(value.toString());
      }
      tsv.push(row.join('\t'));
    }

    return tsv.join('\n');
  }

  private HandleCopy(event: ClipboardEvent) {

    // console.info('handle copy', event);

    event.stopPropagation();
    event.preventDefault();

    if (this.primary_selection.empty) {
      if (event.clipboardData) {
        event.clipboardData.clearData();
      }
    }
    else {

      const area = this.model.sheet.RealArea(this.primary_selection.area);
      const columns = area.columns;
      const rows = area.rows;

      const cells = this.model.sheet.cells;
      const tsv_data: any[] = [];
      const treb_data: any[] = [];

      // do this in row order, for tsv. we have to transpose one of them.

      for (let row = 0; row < rows; row++) {
        const tsv_row: any[] = [];
        // const treb_row: any[] = [];

        for (let column = 0; column < columns; column++) {
          const address = { row: area.start.row + row, column: area.start.column + column };
          const cell = this.model.sheet.CellData(address);

          // NOTE: this now has to account for "text parts", which
          // are returned from the format lib. we need to render them,
          // accounting for a few differences (no expanding, for example,
          // and I guess we should drop hidden characters).

          // now that I think about it, why would we use the formatted value
          // here instead of the calculated value? should use the latter...

          // tsv_row.push(cell.formatted);
          tsv_row.push(typeof cell.calculated === 'undefined' ? cell.value : cell.calculated);
          treb_data.push(JSON.parse(JSON.stringify({ address, data: cell.value, type: cell.type, style: cell.style })));
        }
        tsv_data.push(tsv_row);
      }

      const tsv = tsv_data.map((row) => row.join('\t')).join('\n');
      if (event.clipboardData) {
        event.clipboardData.clearData();
        event.clipboardData.setData('text/plain', tsv);
        event.clipboardData.setData('text/x-treb', JSON.stringify({ source: area, data: treb_data }));
      }
    }

  }

  private HandleCut(event: ClipboardEvent) {
    event.stopPropagation();
    event.preventDefault();

    this.HandleCopy(event);
    if (!this.primary_selection.empty) {
      const area = this.model.sheet.RealArea(this.primary_selection.area);
      // this.model.sheet.ClearArea(area);
      this.ExecCommand({ key: CommandKey.Clear, area });
    }
  }

  private RecyclePasteAreas(source_area: Area, target_area: Area) {
    const paste_areas: Area[] = [];

    if (source_area.count === 1) {
      for (let row = target_area.start.row; row <= target_area.end.row; row++) {
        for (let column = target_area.start.column; column <= target_area.end.column; column++) {
          paste_areas.push(new Area({ row, column }));
        }
      }
    }
    else if (source_area.columns === target_area.columns
      && target_area.rows >= source_area.rows
      && target_area.rows % source_area.rows === 0) {

      for (let row = target_area.start.row; row <= target_area.end.row; row += source_area.rows) {
        paste_areas.push(new Area(
          { row, column: target_area.start.column },
          { row: row + source_area.rows - 1, column: target_area.end.column }));
      }
    }
    else if (source_area.rows === target_area.rows
      && target_area.columns >= source_area.columns
      && target_area.columns % source_area.columns === 0) {

      // console.info('rows match, recycle columns');

      for (let column = target_area.start.column; column <= target_area.end.column; column += source_area.columns) {
        paste_areas.push(new Area(
          { column, row: target_area.start.row },
          { column: column + source_area.columns - 1, row: target_area.end.row }));
      }

    }
    else {
      paste_areas.push(target_area.Clone().Resize(source_area.rows, source_area.columns));
    }

    return paste_areas;
  }

  private HandlePaste(event: ClipboardEvent) {

    // otherwise we capture
    if (this.cell_editor && this.cell_editor.visible) return;

    event.stopPropagation();
    event.preventDefault();

    if (this.primary_selection.empty) {
      return;
    }

    if (!event.clipboardData) return;

    const area = this.model.sheet.RealArea(this.primary_selection.area);
    const commands: Command[] = [];

    // FIXME: these iterate. that causes lots of events.

    // FIXME: some options for pasting:
    //
    // (1) recycle a single value over an area;
    // (2) recycle a shape over a shape with a similar dimension;
    // (3) expand the selection to match the source data

    const treb_data = event.clipboardData.getData('text/x-treb');
    if (treb_data) {
      try {
        const object_data = JSON.parse(treb_data);
        const source_area = new Area(object_data.source.start, object_data.source.end);

        // recycle...
        const paste_areas = this.RecyclePasteAreas(source_area, area);

        // resize if we're forcing a shape
        if (paste_areas.length === 1) {
          area.Resize(paste_areas[0].rows, paste_areas[0].columns);
        }

        // paste in, offsetting for the paste area. this part loops
        // when recycling, so that the offsets are corrected

        // UPDATE: use commands...

        // const paste_area = new Area(area.start, area.end);
        for (const paste_area of paste_areas) {

          this.model.sheet.cells.EnsureCell(paste_area.end);
          
          // FIXME: command
          // this.model.sheet.ClearArea(paste_area, true);
          commands.push({ key: CommandKey.Clear, area: paste_area });

          const offsets = {
            rows: paste_area.start.row - source_area.start.row,
            columns: paste_area.start.column - source_area.start.column,
          };

          object_data.data.forEach((cell_info: any) => {
            let data = cell_info.data;

            const target_address = {
              row: cell_info.address.row - source_area.start.row + paste_area.start.row,
              column: cell_info.address.column - source_area.start.column + paste_area.start.column,
            };

            if (cell_info.type === ValueType.formula) {
              const parse_result = this.parser.Parse(data);
              if (parse_result.expression) {
                data = '=' + this.parser.Render(parse_result.expression, offsets, '');
              }
            }

            /*
            const cell = this.model.sheet.cells.GetCell(target_address, true);
            if (cell) {
              cell.Set(data);
              this.model.sheet.UpdateCellStyle(target_address, cell_info.style, false, true);
            }
            */
            commands.push({ key: CommandKey.SetRange, value: data, area: target_address });
            commands.push({ key: CommandKey.UpdateStyle, style: cell_info.style, area: target_address });

          });

        }

      }
      catch (e) {
        console.error('invalid treb data on clipboard');
        return;
      }
    }
    else {

      const text_data = event.clipboardData.getData('text/plain');
      if (!text_data) return true;

      const lines = text_data.trim().split('\n');
      const cells = lines.map((line) => line.split('\t').map((x) => x.trim()));

      const paste_areas = this.RecyclePasteAreas(
        new Area({ row: 0, column: 0 }, { row: cells.length - 1, column: cells[0].length - 1 }), area);

      if (paste_areas.length === 1) {
        area.Resize(cells.length, cells[0].length);
        area.Resize(paste_areas[0].rows, paste_areas[0].columns);
      }

      for (const paste_area of paste_areas) {
        for (let r = 0; r < lines.length; r++) {
          for (let c = 0; c < lines[0].length; c++) {
            const target_area = new Area({ row: r + paste_area.start.row, column: c + paste_area.start.column });
            this.model.sheet.cells.EnsureCell(target_area.end);
            const tmp = this.SetInferredType({ area: target_area, target: target_area.start, empty: false },
              cells[r][c], false, true);
            if (tmp) {
              for (const command of tmp) commands.push(command);
            }
          }
        }
      }

      // this.Select(this.primary_selection, area);
    }

    this.ExecCommand(commands);
    this.Select(this.primary_selection, area);

    /*
    this.grid_events.Publish({
      type: 'data', area,
    });
    */

  }

  /**
   * utility method returns all selections (primary, active and any additional
   * selections) as an array. defaults to non-empty selections only, but
   * can optionally returns empty non-null selections.
   */
  private AllSelections(include_empty_selections = false) {
    const selections = [this.primary_selection, this.active_selection].concat(this.additional_selections);
    if (include_empty_selections) return selections;
    return selections.filter((selection) => !selection.empty);
  }

  private FreezeInternal(command: FreezeCommand) {

    // default true
    const highlight = ((typeof command.highlight_transition) === 'boolean')
      ? command.highlight_transition
      : true;

//    if (command.rows === this.layout.freeze.rows &&
//      command.columns === this.layout.freeze.columns) {
    if (command.rows === this.model.sheet.freeze.rows &&
        command.columns === this.model.sheet.freeze.columns) {
          if (highlight) {
        this.HighlightFreezeArea();
      }
      return;
    }

    // this.layout.freeze.rows = command.rows;
    // this.layout.freeze.columns = command.columns;
    this.model.sheet.freeze.rows = command.rows;
    this.model.sheet.freeze.columns = command.columns;

    // FIXME: should we do this via events? (...)

    this.QueueLayoutUpdate();
    this.Repaint();

    if (highlight) {
      this.HighlightFreezeArea();
    }

  }

  /**
   * FIXME: should be API method
   * FIXME: need to handle annotations that are address-based
   * 
   * @see InsertColumns for inline comments
   */
  private InsertRowsInternal(command: InsertRowsCommand) { // before_row = 0, count = 1) {

    this.model.sheet.InsertRows(command.before_row, command.count);

    // snip

    this.model.sheet.cells.IterateAll((cell: Cell) => {
      let modified = false;
      if (cell.type === ValueType.formula) {
        const parsed = this.parser.Parse(cell.value || '');
        if (parsed.expression) {
          this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
            if (element.type === 'address') {
              if (element.row >= command.before_row) {
                if (command.count < 0 && element.row + command.count < command.before_row) {
                  element.column = element.row = -1;
                }
                else {
                  element.row += command.count;
                }
                modified = true;
              }
            }
            return true; // continue
          });
          if (modified) {
            cell.value = '=' + this.parser.Render(parsed.expression);
          }
        }
      }
    });

    // fix selections

    if (command.count < 0) {
      for (const selection of this.AllSelections()) {
        selection.empty = true; // lazy
      }
    }
    else {
      for (const selection of this.AllSelections()) {
        if (selection.target.row >= command.before_row) {
          selection.target.row += command.count;
        }
        if (!selection.area.entire_column) {
          if (selection.area.start.row >= command.before_row) {
            selection.area.Shift(command.count, 0);
          }
          else if (selection.area.end.row >= command.before_row) {
            selection.area.ConsumeAddress({
              row: selection.area.end.row + command.count,
              column: selection.area.end.column,
            }); // expand
          }
        }
      }
    }

    // force update

    this.QueueLayoutUpdate();

    // we need to repaint (not render) because repaint adjusts the selection
    // canvas for tile layout. FIXME: move that out of repaint so we can call
    // it directly.

    this.Repaint();

    // FIXME: this should move to the _actual_ layout update, so we have
    // current data. (...)

    // this.grid_events.Publish({type: 'structure'});

  }

  /**
   * FIXME: should be API method
   * FIXME: need to handle annotations that are address-based
   */
  private InsertColumnsInternal(command: InsertColumnsCommand) { // before_column = 0, count = 1) {

    this.model.sheet.InsertColumns(command.before_column, command.count);

    // snip

    this.model.sheet.cells.IterateAll((cell: Cell) => {
      let modified = false;
      if (cell.type === ValueType.formula) {
        const parsed = this.parser.Parse(cell.value || '');
        if (parsed.expression) {
          this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
            if (element.type === 'address') {
              if (element.column >= command.before_column) {
                if (command.count < 0 && element.column + command.count < command.before_column) {
                  element.column = element.row = -1;
                }
                else {
                  element.column += command.count;
                }
                modified = true;
              }
            }
            return true; // continue
          });
          if (modified) {
            cell.value = '=' + this.parser.Render(parsed.expression);
          }
        }
      }
    });

    /*
    // fix annotations

    const update_annotations: Annotation[] = [];
    const remove_annotations: Annotation[] = [];
    for (const annotation of this.annotations) {

      // not connected to a cell
      if (!annotation.cell_address) continue; // FIXME: move?
      const area = annotation.cell_address;

      // to the left
      if (area.end.column < before_column) {
        continue;
      }

      if (count < 0) {

        // remove columns X to Y
        const start = before_column;
        const end = start - count - 1;

        if (start > area.end.column) continue; // to the right
        else if (start <= area.start.column && end >= area.end.column) { // subsumed
          remove_annotations.push(annotation);
        }
        else if (start >= area.start.column && end < area.end.column) { // clip
          annotation.cell_address = new Area({
            row: area.start.row, column: end + 1 }, area.end);
          update_annotations.push(annotation);
        }
        else { // start < area.start.column
          annotation.cell_address = new Area({

          });
        }

      }
      else if (count > 0) {

      }
      
    }
    */
   
    // fix selection(s)

    if (command.count < 0) {
      for (const selection of this.AllSelections()) {
        selection.empty = true; // lazy
      }
    }
    else {
      for (const selection of this.AllSelections()) {
        if (selection.target.column >= command.before_column) {
          selection.target.column += command.count;
        }
        if (!selection.area.entire_row) {
          if (selection.area.start.column >= command.before_column) {
            selection.area.Shift(0, command.count);
          }
          else if (selection.area.end.column >= command.before_column) {
            selection.area.ConsumeAddress({
              row: selection.area.end.row,
              column: selection.area.end.column + command.count,
            }); // expand
          }
        }
      }
    }

    this.QueueLayoutUpdate();

    // @see InsertColumnsInternal re: why repaint

    this.Repaint();

    // this.grid_events.Publish({type: 'structure'});

  }


  /**
   * these are all addative except for "none", which removes all borders.
   *
   * we no longer put borders into two cells at once (hurrah!). however
   * we still need to do some maintenance on the mirror cells -- because
   * if you apply a border to cell A1, then that should take precedence
   * over any border previously applied to cell A2.
   *
   * FIXME: is that right? perhaps we should just leave whatever the user
   * did -- with the exception of clearing, which should always mirror.
   *
   *
   * UPDATE: modifying function for use with ExecCommand. runs the style
   * updates and returns the affected area.
   * 
   */
  private ApplyBordersInternal(command: UpdateBordersCommand) {

    const borders = command.borders;
    const width = (command.borders === BorderConstants.None)
      ? 0 : command.width;

    const area = new Area(command.area.start, command.area.end);

    const top: Style.Properties = { border_top: width };
    const bottom: Style.Properties = { border_bottom: width };
    const left: Style.Properties = { border_left: width };
    const right: Style.Properties = { border_right: width };

    const clear_top: Style.Properties = { border_top: 0 };
    const clear_bottom: Style.Properties = { border_bottom: 0 };
    const clear_left: Style.Properties = { border_left: 0 };
    const clear_right: Style.Properties = { border_right: 0 };

    if (typeof command.color !== 'undefined') {
      top.border_top_color =
        bottom.border_bottom_color =
        left.border_left_color =
        right.border_right_color = command.color;
    }

    // inside all/none
    if (borders === BorderConstants.None || borders === BorderConstants.All) {
      this.model.sheet.UpdateAreaStyle(area, {
        ...top, ...bottom, ...left, ...right,
      }, true, false, true);
    }

    // top
    if (borders === BorderConstants.Top || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        this.model.sheet.UpdateAreaStyle(area.top, { ...top }, true, false, true);
      }
    }

    // mirror top (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Top) {
      if (!area.entire_column) {
        if (area.start.row) {
          this.model.sheet.UpdateAreaStyle(new Area(
            { row: area.start.row - 1, column: area.start.column },
            { row: area.start.row - 1, column: area.end.column }), { ...clear_bottom }, true, false, true);
        }
      }
    }

    // bottom
    if (borders === BorderConstants.Bottom || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        this.model.sheet.UpdateAreaStyle(area.bottom, { ...bottom }, true, false, true);
      }
    }

    // mirror bottom (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Bottom) {
      if (!area.entire_column) {
        this.model.sheet.UpdateAreaStyle(new Area(
          { row: area.end.row + 1, column: area.start.column },
          { row: area.end.row + 1, column: area.end.column }), { ...clear_top }, true, false, true);
      }
    }

    // left
    if (borders === BorderConstants.Left || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        this.model.sheet.UpdateAreaStyle(area.left, { ...left }, true, false, true);
      }
    }

    // mirror left (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Left) {
      if (!area.entire_row) {
        if (area.start.column) {
          this.model.sheet.UpdateAreaStyle(new Area(
            { row: area.start.row, column: area.start.column - 1 },
            { row: area.end.row, column: area.start.column - 1 }), { ...clear_right }, true, false, true);
        }
      }
    }

    // right
    if (borders === BorderConstants.Right || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        this.model.sheet.UpdateAreaStyle(area.right, { ...right }, true, false, true);
      }
    }

    // mirror right (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Right) {
      if (!area.entire_row) {
        this.model.sheet.UpdateAreaStyle(new Area(
          { row: area.start.row, column: area.end.column + 1 },
          { row: area.end.row, column: area.end.column + 1 }), { ...clear_left }, true, false, true);
      }
    }

    /*
    // why is there not an expand method on area? (FIXME)

    this.DelayedRender(false, new Area({
      row: Math.max(0, area.start.row - 1),
      column: Math.max(0, area.start.column - 1),
    }, {
      row: area.end.row + 1,
      column: area.end.column + 1,
    }));

    // NOTE: we don't have to route through the sheet. we are the only client
    // (we republish). we can just publish directly.

    this.grid_events.Publish({ type: 'style', area });
    */

    return new Area(
      {
        row: Math.max(0, area.start.row - 1),
        column: Math.max(0, area.start.column - 1),
      }, {
        row: area.end.row + 1,
        column: area.end.column + 1,
      },
    );

  }

  /**
   * set range, via command. returns affected area.
   */
  private SetRangeInternal(command: SetRangeCommand) {

    const area = IsCellAddress(command.area)
      ? new Area(command.area)
      : new Area(command.area.start, command.area.end);

    if ( !area.entire_row && !area.entire_column && (
        area.end.row >= this.model.sheet.rows
        || area.end.column >= this.model.sheet.columns)) {

      // we have to call this because the 'set area' method calls RealArea
      this.model.sheet.cells.EnsureCell(area.end);
      this.QueueLayoutUpdate();

    }

    // originall we called sheet methods here, but all the sheet
    // does is call methods on the cells object -- we can shortcut.

    // is that a good idea? (...)

    // at a minimum we can consolidate...

    if (IsCellAddress(command.area)) {

      // single cell

      this.model.sheet.SetCellValue(command.area, command.value);
      return area;
    }
    else {

      // there are a couple of options here, from the methods that
      // have accumulated in Sheet.

      // SetArrayValue -- set data as an array
      // SetAreaValues -- set values from data one-to-one
      // SetAreaValue -- single value repeated in range

      // FIXME: clean this up!

      if (command.array) {
        this.model.sheet.SetArrayValue(area, command.value);
      }
      else {
        this.model.sheet.SetAreaValues2(area, command.value);
      }
      /*
      else if (!Array.isArray(command.value) && !ArrayBuffer.isView(command.value)) {
        this.model.sheet.SetAreaValue(area, command.value);
      }
      else {
        this.model.sheet.SetAreaValues(area, command.value as any[][]);
      }
      */

      return area;

    }

  }

  //////////////////////////////////////////////////////////////////////////////

  /**
   * pass all data/style/structure operations through a command mechanism.
   * this method should optimally act as a dispatcher, so try to minimize
   * inline code in favor of method calls.
   *
   * [NOTE: don't go crazy with that, some simple operations can be inlined]
   *
   */
  private ExecCommand(commands: Command|Command[]) {

    // FIXME: support ephemeral commands (...)

    let render_area: Area|undefined;
    let data_area: Area|undefined;
    let style_area: Area|undefined;
    let structure_event = false;

    const events: GridEvent[] = [];

    // this seems like the dumb way to do this... maybe?
    if (!Array.isArray(commands)) commands = [commands];

    // gate on subscribers? (...)
    this.command_log.Publish({command: commands, timestamp: new Date().getTime()});

    for (const command of commands) {

      // console.log(CommandKey[command.key], JSON.stringify(command));

      switch (command.key) {
      case CommandKey.Clear:
        if (command.area) {
          const area = new Area(command.area.start, command.area.end);
          this.model.sheet.ClearArea(area, true);
          data_area = Area.Join(area, data_area);
        }
        else {
          this.UpdateSheet(new Sheet().toJSON(), true);
          this.RemoveAllAnnotations();
          this.ClearSelection(this.primary_selection);
          this.ScrollIntoView({row: 0, column: 0});
          this.QueueLayoutUpdate(); // necessary? (...)
        }
        break;

      case CommandKey.Select:
        // ...
        break;

      case CommandKey.Freeze:
        this.FreezeInternal(command);
        break;

      case CommandKey.MergeCells:
        this.model.sheet.MergeCells(
          new Area(command.area.start, command.area.end));

        render_area = Area.Join(command.area, render_area);

        // FIXME: sheet publishes a data event here, too. probably a good
        // idea because references to the secondary (non-head) merge cells
        // will break.

        structure_event = true;
        data_area = Area.Join(command.area, data_area);
        break;

      case CommandKey.UnmergeCells:
        {
          // the sheet unmerge routine requires a single, contiguous merge area.
          // we want to support multiple unmerges at the same time, though,
          // so let's check for multiple. create a list.

          const list: { [index: string]: Area } = {};
          const area = new Area(command.area.start, command.area.end);

          this.model.sheet.cells.IterateArea(area, (cell: Cell) => {
            if (cell.merge_area) {
              const label = Area.CellAddressToLabel(cell.merge_area.start) + ':'
                + Area.CellAddressToLabel(cell.merge_area.end);
              list[label] = cell.merge_area;
            }
          }, false);

          const keys = Object.keys(list);

          // suppress events until the last one

          for (let i = 0; i < keys.length; i++) {
            this.model.sheet.UnmergeCells(list[keys[i]], i !== keys.length - 1);
          }

          // see above

          render_area = Area.Join(command.area, render_area);
          data_area = Area.Join(command.area, data_area);
          structure_event = true;
        }
        break;

      case CommandKey.UpdateStyle:
        if (IsCellAddress(command.area)) {
          const area = new Area(command.area);
          this.model.sheet.UpdateCellStyle(command.area, command.style, !!command.delta, true);
          // events.push({type: 'style', area});
          style_area = Area.Join(area, style_area);
          render_area = Area.Join(area, render_area);
        }
        else {
          const area = new Area(command.area.start, command.area.end);
          this.model.sheet.UpdateAreaStyle(area, command.style, !!command.delta, false, true);
          // events.push({type: 'style', area});
          style_area = Area.Join(area, style_area);
          render_area = Area.Join(area, render_area);
        }
        break;

      case CommandKey.UpdateBorders:
        render_area = Area.Join(this.ApplyBordersInternal(command), render_area);
        break;

      case CommandKey.ResizeRows:
        {
          let row = command.row;
          if (typeof row === 'undefined') {
            row = [];
            for (let i = 0; i < this.model.sheet.rows; i++) row.push(i);
          }

          if (typeof row === 'number') row = [row];
          if (typeof command.height === 'number') {
            for (const entry of row) {
              this.model.sheet.SetRowHeight(entry, command.height);
            }
          }
          else {
            for (const entry of row) {
              this.model.sheet.AutoSizeRow(entry, true);
            }
          }

          const area = new Area(
            {column: Infinity, row: row[0]},
            {column: Infinity, row: row[row.length - 1]});

          this.layout.UpdateTileHeights(true);
          this.render_tiles = this.layout.VisibleTiles();

          this.Repaint(false, true); // repaint full tiles
          this.layout.UpdateAnnotation(this.annotations);
          structure_event = true;
        }
        break;

      case CommandKey.ResizeColumns:
        {
          let column = command.column;

          if (typeof column === 'undefined') {
            column = [];
            for (let i = 0; i < this.model.sheet.columns; i++) column.push(i);
          }

          if (typeof column === 'number') column = [column];

          if (typeof command.width === 'number') {
            for (const entry of column) {
              this.model.sheet.SetColumnWidth(entry, command.width);
            }
          }
          else {
            for (const entry of column) {
              this.model.sheet.AutoSizeColumn(entry, false, true);
            }
          }

          const area = new Area(
            {row: Infinity, column: column[0]},
            {row: Infinity, column: column[column.length - 1]});

          this.layout.UpdateTileWidths(true);
          this.render_tiles = this.layout.VisibleTiles();

          this.Repaint(false, true); // repaint full tiles
          this.layout.UpdateAnnotation(this.annotations);
          structure_event = true;

        }
        break;

      case CommandKey.ShowHeaders:

        // FIXME: now that we don't support 2-level headers (or anything
        // other than 1-level headers), headers should be managed by/move into
        // the grid class.

        this.model.sheet.SetHeaderSize(command.show ? undefined : 1, command.show ? undefined : 1);
        this.QueueLayoutUpdate();
        this.Repaint();
        break;

      case CommandKey.InsertRows:
        this.InsertRowsInternal(command);
        break;

      case CommandKey.InsertColumns:
        this.InsertColumnsInternal(command);
        break;

      case CommandKey.SetNote:
        {
          const cell = this.cells.GetCell(command.address, true);
          if (cell) {
            const area = new Area(command.address);

            cell.SetNote(command.note);
            this.DelayedRender(false, area);

            // treat this as style, because it affects painting but
            // does not require calculation.

            style_area = Area.Join(area, style_area);
            render_area = Area.Join(area, render_area);

          }
        }
        break;

      case CommandKey.SetRange:
        {
          const area = this.SetRangeInternal(command);
          data_area = Area.Join(area, data_area);

          // normally we don't paint, we wait for the calculator to resolve

          if (this.options.repaint_on_cell_change) {
            render_area = Area.Join(area, render_area);
          }

        }
        break;

      default:
        console.warn(`unhandled command: ${CommandKey[command.key]} (${command.key})`);
      }
    }

    // consolidate events and merge areas

    if (data_area) {
      events.push({ type: 'data', area: data_area });
    }

    if (style_area) {
      events.push({ type: 'style', area: style_area });
    }

    if (structure_event) {
      events.push({type: 'structure'});
    }

    this.grid_events.Publish(events);

    if (render_area) {
      this.DelayedRender(false, render_area);
    }

  }


}
