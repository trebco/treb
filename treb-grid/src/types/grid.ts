/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import type { 
  Cell, 
  Theme, 
  IArea, 
  Extent,
  CellValue, 
  ICellAddress,
  ImportedSheetData,
  Complex,
  Color,
  CellStyle,
  IRectangle } from 'treb-base-types';
  
import {
  Area, 
  Is2DArray, 
  Rectangle, 
  ValueType, 
  Localization, 
  IsCellAddress, 
  LoadThemeProperties,
  DefaultTheme,
  ComplexToString,
  IsComplex,
  TextPartFlag,
  IsArea,
  Style,
} from 'treb-base-types';

import type { ExpressionUnit, RenderOptions, UnitAddress } from 'treb-parser';
import { 
  DecimalMarkType, 
  ArgumentSeparatorType, 
  QuotedSheetNameRegex, 
  MDParser,
} from 'treb-parser';

import { SerializeHTML } from 'treb-utils';
import type { ParseResult as ParseResult2 } from 'treb-format';
import { NumberFormatCache, LotusDate, ValueParser, type Hints, NumberFormat } from 'treb-format';
import { SelectionRenderer } from '../render/selection-renderer';

import { TabBar } from './tab_bar';
import type { StatsEntry } from './tab_bar';

import { MockLayout } from '../layout/mock-layout';
import type { BaseLayout } from '../layout/base_layout';
import { TileRange } from '../layout/base_layout';

// this was conditional compilation. we're dropping as we no longer support IE11.
// import { CreateLayout } from '@grid-conditional/layout_manager';
// import { CreateLayout } from '../conditional/modern/layout_manager';

// now we can drop the conditional compilation as well...

import { GridLayout } from '../layout/grid_layout';

import { OverlayEditor } from '../editors/overlay_editor';

import { TileRenderer } from '../render/tile_renderer';
import type { GridEvent } from './grid_events';
import { ErrorCode } from './grid_events';

import type { 
  SerializedNamed,
  DataModel, 
  GridSelection,
  LegacySerializedSheet, 
} from 'treb-data-model';
import { Annotation, type AnnotationData, Sheet } from 'treb-data-model';

import { FormulaBar } from '../editors/formula_bar';
import type { GridOptions } from './grid_options';
import { BorderConstants } from './border_constants';
import { UA } from '../util/ua';
import { Autocomplete } from '../editors/autocomplete';

import { MouseDrag } from './drag_mask';

import type {
  Command,
  SetRangeCommand, FreezeCommand,
  InsertRowsCommand, InsertColumnsCommand, SetNameCommand,
  ActivateSheetCommand, DataValidationCommand, 
  ResizeRowsCommand, ResizeColumnsCommand, 
  SelectCommand,
  CreateAnnotationCommand
} from './grid_command';
import { CommandKey
} from './grid_command';

import { DOMContext } from 'treb-base-types';
import { GridBase } from './grid_base';
import type { SetRangeOptions } from './set_range_options';
import type { ClipboardCellData } from './clipboard_data';

import type { ExternalEditorConfig } from './external_editor_config';
import { ExternalEditor } from '../editors/external_editor';
import type { ClipboardData, PasteOptions } from './clipboard_data2';

interface DoubleClickData {
  timeout?: number;
  address?: ICellAddress;
}

enum EditingState {
  NotEditing = 0,
  CellEditor = 1,
  FormulaBar = 2,
}


export class Grid extends GridBase {

  // --- public members --------------------------------------------------------

  public hide_selection = false;

  // new...
  public headless = false;

  /**
   * we're tracking the current selected style so we can use it for new
   * cells. conceptually, if you are typing in a font (stack) like handwritten,
   * and you enter a new cell, you probably want to type in the same font
   * there. so we want to make that happen. TODO: size
   */
  public readonly edit_state: CellStyle = {};

  public get scale(): number {
    return this.layout.scale;
  }

  public set scale(value: number) {

      this.layout.scale = value;
      this.UpdateLayout();
      this.UpdateAnnotationLayout();
      this.layout.UpdateAnnotation(this.active_sheet.annotations, this.theme);
      this.layout.ApplyTheme(this.theme);
      this.overlay_editor?.UpdateScale(value);
      this.tab_bar?.UpdateScale(value);
  
      this.grid_events.Publish({
        type: 'scale', 
        scale: value,
      });
  
      for (const sheet of this.model.sheets.list) {
        for (const annotation of sheet.annotations) {
          annotation.dirty = true;
        }
      }

  }

  /**
   * the theme object exists so we can pass it to constructors for
   * various components, but it's no longer initialized until the
   * initialization step (when we have a node).
   */
  public readonly theme: Theme; // ExtendedTheme;

  /**  
   * this was private, which made sense, but there's a case where the 
   * client (embedded sheet) wants to check if an annotation is selected.
   * we need to allow that somehow, ideally without any reacharounds.
   * 
   * I guess the concern is a client could modify it, but at this point
   * we really only have one client and we trust it. making this public.
   * we could maybe switch to an accessor or have a "is this selected?" method.
   */
  public selected_annotation?: Annotation;


  // --- private members -------------------------------------------------------

  // testing
  private hover_data: {
    note?: boolean;
    link?: boolean;
    table_header?: boolean;
    cell?: Cell;
    point?: {x: number, y: number};
    handler?: number;
    pointer?: boolean;
    address?: ICellAddress; // = { row: -1, column: -1 };
  } = {};

  /** are we editing? */
  private editing_state: EditingState = EditingState.NotEditing;

  /** if we are editing, what is the cell? */
  private editing_cell: ICellAddress = { row: -1, column: -1, sheet_id: 0 };

  /**  */
  private editing_selection: GridSelection|undefined;

  /** */
  private editing_annotation?: Annotation;

  /** */
  private pending_reset_selection = false;

  /** */
  private view_node?: HTMLElement;

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

  private scroll_offset_pending?: {x: number, y: number};

  /**
   * for coediting/remotes, we may make a structural change that requires
   * a full repaint of another sheet -- we won't be able to do that until
   * the sheet is displayed. so let's keep track of these. 
   * 
   * these are numbers so we can use a sparse array. (or we could use a set...)
   */
  private pending_layout_update: Set<number> = new Set();

  /* *
   * spreadsheet language parser. used to pull out address
   * references from functions, for highlighting
   * 
   * ...
   * 
   * it's used for lots of stuff now, in addition to highlighting.
   * copy/paste with translation; csv; defines; and some other stuff.
   * still would like to share w/ parent though, if possible.
   * 
   * 
   * FIXME: need a way to share/pass parser flags
   * UPDATE: sharing parser w/ owner (embedded sheet)
   * /
  private parser;
    */

  /** this is used when testing if a typed character is numeric */
  private decimal_separator_code = 0x2e; // "."

  /** new key capture overlay/ICE */
  private overlay_editor?: OverlayEditor;

  /** moving autocomplete to a class field */
  private autocomplete?: Autocomplete;

  /** formula bar editor (optional) */
  private formula_bar?: FormulaBar;

  private RESIZE_PIXEL_BUFFER = 5;

  /**
   * formalizing the concept of external selection to support outside tooling.
   * 
   * FIXME: stop testing on this field. we need a better way to figure out
   * if the external editor is active.
   */
  private external_editor_config?: Partial<ExternalEditorConfig>;

  /**
   * support for external editor. created on demand.
   */
  private external_editor?: ExternalEditor;

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

  /** reusing type. FIXME? we don't need a target */
  private readonly spill_selection: GridSelection = {
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
  private tile_renderer?: TileRenderer;

  /** */
  private selection_renderer?: SelectionRenderer;

  // FIXME: move [why?]

  private tab_bar?: TabBar;

  private DOM = DOMContext.GetInstance();

  // --- constructor -----------------------------------------------------------

  /**
   * FIXME: NO PARAMETER INITIALIZATIONS
   */
  constructor(
    options: GridOptions = {}, 
    model: DataModel,
    theme: Theme = DefaultTheme,
    initialze_dom = true,
    DOM: DOMContext ) {

    super(options, model);  

    this.decimal_separator_code = Localization.decimal_separator.charCodeAt(0);

    // set properties here, we will update in initialize()

    this.theme = JSON.parse(JSON.stringify(theme));

    if (!initialze_dom) {
      this.headless = true;
      this.layout = new MockLayout(this.model, this.view);
      return;
    }

    this.DOM = DOM;
    this.layout = new GridLayout(this.model, this.view, DOM);

    if (options.initial_scale) {
      if (typeof options.initial_scale === 'string') {
        options.initial_scale = Number(options.initial_scale);
      }
      this.layout.scale = options.initial_scale;

      // not created yet
      // this.tab_bar?.UpdateScale(options.initial_scale);
    }

    this.tile_renderer = new TileRenderer(
        this.theme, 
        this.layout, 
        this.model, 
        this.view, 
        this.options);

    this.selection_renderer = new SelectionRenderer(
        this.theme,
        this.layout,
        this.model,
        this.view,
        this.primary_selection,
        this.additional_selections);
        
  }


  // --- Copy/paste API methods ------------------------------------------------
  //
  // moving here with a view towards (eventually) merging with the UI/browser
  // copy/paste routines (in grid)
  //


  /**
   * internal composite for cut/copy. mostly identical except we 
   * read data as A1 for cut, so it will retain references. also
   * cut clears the data.
   * 
   * FIXME: merge with grid cut/copy/paste routines. we already
   * handle recycling and relative addressing, the only thing missing
   * is alternate formats.
   */
  public CopyArea(resolved: Area, semantics: 'cut'|'copy' = 'copy'): ClipboardData {

    // resolve range so we can use it later -> Area
    const sheet = (resolved.start.sheet_id ? this.model.sheets.Find(resolved.start.sheet_id) : this.active_sheet) || this.active_sheet;

    // get style data, !apply theme but do apply r/c styles
    const style_data = sheet.GetCellStyle(resolved, false);

    // flag we want R1C1 (copy)
    const r1c1 = (semantics !== 'cut');

    // NOTE: we're losing arrays here. need to fix. also think
    // about merges? we'll reimplement what grid does (only in part)

    const data: ClipboardData = [];

    for (const { cell, row, column } of sheet.cells.IterateRC(resolved)) {

      // raw value
      let value = cell.value;

      // seems like we're using a loop function unecessarily
      if (r1c1 && value && cell.type === ValueType.formula) {
        value = this.FormatR1C1(value, { row, column })[0][0];
      }

      const r = row - resolved.start.row;
      const c = column - resolved.start.column;

      if (!data[r]) { 
        data[r] = [];
      }

      let array_head: IArea|undefined;
      if (cell.area) {

        // scrubbing to just area (and unlinking)
        array_head = {
          start: {
            row: cell.area.start.row - resolved.start.row,
            column: cell.area.start.column - resolved.start.column,
          },
          end: {
            row: cell.area.end.row - resolved.start.row,
            column: cell.area.end.column - resolved.start.column,
          },
        };

      }

      data[r][c] = {
        value,
        calculated: cell.calculated,
        style: style_data[r][c],
        area: array_head,
      };
      
    }     

    // EmbeddedSpreadsheet.clipboard = structuredClone(data);

    if (semantics === 'cut') {
      this.SetRange(resolved, undefined, { recycle: true }); // clear
    }

    return data;
        
  }  
  
  /**
   * paste clipboard data into a target range. this method does not use
   * the system clipboard; pass in clipboard data returned from the Cut or
   * Copy method.
   * 
   * @param target - the target to paste data into. this can be larger 
   * than the clipboard data, in which case values will be recycled in 
   * blocks. if the target is smaller than the source data, we will expand
   * it to fit the data.
   * 
   * @param data - clipboard data to paste.
   * 
   * @privateRemarks LLM API
   * 
   * @privateRemarks this was async when we were thinking of using the 
   * system clipboard, but that's pretty broken so we're not going to
   * bother atm.
   */
  public PasteArea(resolved: Area, data: ClipboardData, options: PasteOptions = {}): void {

    if (!data) {
      throw new Error('no clipboad data');
    }

    // paste has some special semantics. if the target smaller than the
    // source data, we write the full data irrespective of size (similar 
    // to "spill"). otherwise, we recycle in blocks. 

    // the setrange method will recycle, but we also need to recycle styles.

    // start with data length

    const rows = data.length;
    const columns = data[0]?.length || 0;

    // target -> block size

    resolved.Resize(
      Math.max(1, Math.floor(resolved.rows / rows)) * rows, 
      Math.max(1, Math.floor(resolved.columns / columns)) * columns );

    const sheet = (resolved.start.sheet_id ? this.model.sheets.Find(resolved.start.sheet_id) : this.active_sheet) || this.active_sheet;
      
    const values: CellValue[][] = [];

    // optionally collect calculated values, instead of raw values

    if (options.values) {
      for (const [index, row] of data.entries()) {
        values[index] = [];
        for (const cell of row) {
          values[index].push(typeof cell.calculated === 'undefined' ? cell.value : cell.calculated);
        }
      }
    }

    // this is to resolve the reference in the callback,
    // but we should copy -- there's a possibility that
    // this points to the static member, which could get
    // overwritten. FIXME
    
    const local = data; 

    // batch to limit events, sync up undo

    const events = this.Batch(() => {

      // this needs to change to support arrays (and potentially merges...)

      // actually we could leave as is for just calculated values

      if (options.values) {
        this.SetRange(resolved, values, {
          r1c1: true, recycle: true,
        });
      }
      else {

        // so this is for formulas only now

        // start by clearing... (but leave styles as-is for now)

        // probably a better way to do this
        this.SetRange(resolved, undefined, { recycle: true });

        for (const address of resolved) {
          const r = (address.row - resolved.start.row) % rows;
          const c = (address.column - resolved.start.column) % columns;
          
          const cell_data = local[r][c];

          if (cell_data.area) {
            // only the head
            if (cell_data.area.start.row === r && cell_data.area.start.column === c) {
              const array_target = new Area(cell_data.area.start, cell_data.area.end);
              array_target.Shift(resolved.start.row, resolved.start.column);
              this.SetRange(array_target, cell_data.value, { r1c1: true, array: true });
            }
          }
          else if (cell_data.value) {
            this.SetRange(new Area(address), cell_data.value, { r1c1: true });
          }

        }

      }

      if (options.formatting === 'number-formats') {

        // number format only, and apply delta

        for (const address of resolved) {
          const r = (address.row - resolved.start.row) % rows;
          const c = (address.column - resolved.start.column) % columns;
          const number_format = (local[r][c].style || {}).number_format;
          sheet.UpdateCellStyle(address, { number_format }, true);
        }
      }
      else if (options.formatting !== 'target') {

        // use source formatting (default)
        for (const address of resolved) {
          const r = (address.row - resolved.start.row) % rows;
          const c = (address.column - resolved.start.column) % columns;
          sheet.UpdateCellStyle(address, local[r][c].style || {}, false);
        }

      }

    }, true);

    this.grid_events.Publish(events);

  }

  // --- public methods --------------------------------------------------------

  /**
   * re-select the current selection, for side effects. used when switching
   * languages to update the function view (if any)
   */
  public Reselect() {

    // we might need to update the current displayed selection. depends
    // on when we expect languages to be set.

    if (!this.primary_selection.empty) {
      this.Select(this.primary_selection, this.primary_selection.area, this.primary_selection.target);
    }

  }

  /**
   * set note at the given address, or current selection
   * @param address optional address; if not used, note will be set/cleared
   * at current selection
   * @param note new note, or undefined to clear note
   */
  public SetNote(address?: ICellAddress, note?: string): void {

    if (!address) {
      if (this.primary_selection.empty) return;
      address = this.primary_selection.target;
    }

    this.ExecCommand({
      key: CommandKey.SetNote,
      area: address,
      note,
    });

  }

  /** find an annotation, given a node */
  public FindAnnotation(node: HTMLElement): Annotation|undefined {
    for (const annotation of this.active_sheet.annotations) {
      const view = annotation.view[this.view_index] || {};
      if (view.node === node) {
        return annotation;
      }
    }
    return undefined;
  }
  
  public CreateAnnotation(
        properties: Partial<AnnotationData> = {}, 
        sheet: Sheet = this.active_sheet,
        add_to_sheet = true, 
        offset = false, 
        target?: IArea|IRectangle,
        focus?: boolean ) {

    this.ExecCommand({
      key: CommandKey.CreateAnnotation,
      properties,
      add_to_sheet,
      offset,
      target,
      focus,
      sheet,
    });

  }

  /**
   * create an annotation, with properties, without an original object.
   * optionally (and by default) add to sheet.
   *
   * @param offset check for a matching position (top-left) and if found,
   * shift by (X) pixels. intended for copy-paste, where we don't want to
   * paste immediately on top of the original.
   * 
   * @param target new parameter allows setting annotation as rect or as
   * cell range
   */
  protected CreateAnnotationInternal(command: CreateAnnotationCommand) {

    const annotation = new Annotation(command.properties);

    if (command.offset) {

      // to offset, we have to have layout (or at least scaled rect)
      if (!annotation.data.layout && annotation.scaled_rect) {
        annotation.data.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
      }

      if (!annotation.data.layout) {
        console.warn(`can't offset annotation without layout`);
      }
      else {
        let target_rect = this.layout.AnnotationLayoutToRect(annotation.data.layout).Shift(20, 20);
        let recheck = true;
        while (recheck) {
          recheck = false;
          for (const test of command.sheet.annotations) {
            if (test === annotation) { continue; }
            if (test.scaled_rect && test.scaled_rect.top === target_rect.top && test.scaled_rect.left === target_rect.left) {
              target_rect = target_rect.Shift(20, 20);
              recheck = true;
              break;
            }
          }
        }
        annotation.data.layout = this.layout.RectToAnnotationLayout(target_rect);
      }
    }

    if (command.target) {
      if (Rectangle.IsRectangle(command.target)) {
        // console.info('creating from rectangle,', target);
        annotation.data.layout = undefined;
        annotation.rect = Rectangle.Create(command.target);
      }
      else if (command.target.start) {
        annotation.rect = undefined;
        annotation.data.layout = this.layout.AddressToAnnotationLayout(command.target.start, command.target.end||command.target.start);
      }
    }
    
    if (command.add_to_sheet) {

      // ensure we haven't already added this
      if (!command.sheet.annotations.some((test) => test === annotation)) {
        command.sheet.annotations.push(annotation);
      }

      this.AddAnnotation(annotation);
    }

    if (command.focus) {

      // pending... we need to know which view it was pasted in. maybe this
      // should be the index?

      const view = annotation.view[this.view_index];
      if (view && view.node) {
        const node = view.node;
        setTimeout(() => {
          node.focus();
        }, 1);
      }

    }

    // return annotation;
  }

  /** placeholder */
  public UpdateAnnotationLayout(): void {
    // ...
  }

  /** add an annotation. it will be returned with a usable node. */
  public AddAnnotation(annotation: Annotation, toll_events = false, add_to_layout = true): void {

    let view = annotation.view[this.view_index];

    if (!view) {
      view = {};
      annotation.view[this.view_index] = view;
    }

    if (!view.node) {

      // FIXME: why is this not in layout? it is layout.

      const node = this.DOM.Div('annotation', undefined, {
        data: { scale: this.layout.scale.toString() },
        style: { fontSize: `${10 * this.layout.scale}pt` },
        attrs: { tabindex: '-1', },
        events: {

          mousedown: (event) => {

            if (event.button !== 0) {
              return;
            }
  
            this.layout.AnnotationMouseDown(annotation, node, event, move_target, resize_target).then(event => {
              // console.info('resolved', event);
              if (event) {
                this.grid_events.Publish(event);
              }
              else {

                // probably a click on the annotation. if it is not already
                // selected, send an event.

                if (this.selected_annotation !== annotation) {
                  this.grid_events.Publish({
                    type: 'annotation',
                    annotation,
                    event: 'select',
                  })
                }

              }

              if (annotation.data.layout) {
                this.EnsureAddress(annotation.data.layout.br.address, 1);
              }
  
            });

          },

          focusin: () => {
  
            // console.info("AFI");

            for (const element of this.layout.GetFrozenAnnotations(annotation)) {
              element.classList.add('clone-focus');
            }
  
            this.selected_annotation = annotation;
            this.primary_selection.empty = true; // FIXME: not using method? (...)
  
            // this is done for the side-effect when we start editing, we
            // capture the sheet of the primary selection. if you switch
            // sheets while editing, the selection won't be set so it persists.
            // we need that to switch back to the correct sheet when an edit ends.
  
            this.primary_selection.target = { row: -1, column: -1, sheet_id: this.active_sheet.id };
            this.HideGridSelection();

          },

          focusout: (event) => {

            // console.info("AFO");

            // console.info('annotation focusout', annotation, event);
  
            for (const element of this.layout.GetFrozenAnnotations(annotation)) {
              element.classList.remove('clone-focus');
            }
            
            if (this.formula_bar && this.formula_bar.IsElement((event as FocusEvent).relatedTarget as HTMLElement)) {
              // console.info('editing...');
              this.primary_selection.empty = true;
              this.RenderSelections();
              this.editing_annotation = annotation;
              this.layout.ShowSelections(true);
            }
            else if (this.formula_bar?.IsExpandButton(event.relatedTarget as HTMLElement)) {

              // for this particular case, do nothing. basically you are 
              // expanding/contracting the formula bar. we want to preserve
              // the selected annotation, if any. after the operation we'll
              // restore focus.

            }
            else {

              // here's where we need to make a change. if the new focus 
              // (the related target) is outside of the sheet hierarchy, we 
              // want to persist the selection, or at least remember it.

              // the next time we focus in on the grid we want to have the 
              // opportunity to restore this focus. I think persisting the 
              // focus may be a problem? not sure...

              const focus_in_layout = this.layout.FocusInLayout(event.relatedTarget||undefined);

              if (focus_in_layout) {
                if (this.selected_annotation === annotation) {
                  this.selected_annotation = undefined;
                }
                this.ShowGridSelection();
              }

            }
          },

        }
      });

      view.node = node;

      view.content_node = this.DOM.Div('annotation-content', node);
      const move_target = this.DOM.Div('annotation-move-target', node);
      const resize_target = this.DOM.Div('annotation-resize-target', node);

      node.addEventListener('keydown', (event) => {
    
          const rect = annotation.scaled_rect;
          if (!rect) {
            console.info('missing scaled rect!');
            return;
          }

          const elements = [node, ...this.layout.GetFrozenAnnotations(annotation)];

          const target = { x: rect.left, y: rect.top };
          switch (event.key) {
            case 'ArrowUp':
            case 'Up':
              if (event.ctrlKey) {
                if (this.layout.AnnotationLayoutOrder(annotation, 1)) {
                  this.grid_events.Publish({ type: 'annotation', event: 'move', annotation });
                }
                node.focus();
              }
              else {
                target.y--;
              }
              break;

            case 'ArrowLeft':
            case 'Left':
              if (event.ctrlKey) {
                return;
              }
              else {
                target.x--;
              }
              break;

            case 'ArrowRight':
            case 'Right':
              if (event.ctrlKey) {
                return;
              }
              else {
                target.x++;
              }
              break;

            case 'ArrowDown':
            case 'Down':
              if (event.ctrlKey) {
                if (this.layout.AnnotationLayoutOrder(annotation, -1)) {
                  this.grid_events.Publish({ type: 'annotation', event: 'move', annotation });
                }
                node.focus();
              }
              else {
                target.y++;
              }
              break;

            case 'Escape':
            case 'Esc':
              this.Focus();
              break;

            case 'Backspace':
              if (event.metaKey && UA.is_mac) {
                this.Focus();
                this.RemoveAnnotation(annotation);  
              }
              break;

            case 'Delete':
            case 'Del':
              this.Focus();
              this.RemoveAnnotation(annotation);
              break;

            default:
              return;
          }

          event.stopPropagation();
          event.preventDefault();

          target.x = Math.max(target.x, 0);
          target.y = Math.max(target.y, 0);

          if (rect.left !== target.x || rect.top !== target.y) {
            rect.left = Math.round(target.x);
            rect.top = Math.round(target.y);

            // node.style.top = (rect.top) + 'px';
            // node.style.left = (rect.left) + 'px';

            for (const element of elements) {
              element.style.top = (rect.top) + 'px';
              element.style.left = (rect.left) + 'px';
            }

            annotation.data.extent = undefined; // reset
            this.grid_events.Publish({ type: 'annotation', event: 'move', annotation });

            // annotation.rect = rect.Scale(1/this.layout.scale);
            annotation.data.layout = this.layout.RectToAnnotationLayout(rect);

          }

        });

    }

    if (add_to_layout) {
      this.layout.AddAnnotation(annotation, this.theme);
      if (annotation.data.layout) {
        this.EnsureAddress(annotation.data.layout.br.address, 1, toll_events);
      }
    }
    else {
      // console.info('not adding annotation node to layout...');
    }

    /*
    // ensure we haven't already added this
    if (!this.active_sheet.annotations.some((test) => test === annotation)){
      this.active_sheet.annotations.push(annotation);
    }
    */

    if (!toll_events) {
      this.grid_events.Publish({
        type: 'annotation',
        annotation,
        event: 'create',
      });
    }

  }

  /**
   * call this method if an annotation is updated externally -- we're not 
   * watching for mutation, so if they change and we need to update, we
   * won't know about it unless you tell us. sometimes this will be 
   * superfluous but (assuming it's one at a time) should not be too expensive
   */
  public AnnotationUpdated(annotation: Annotation): void {
    // console.info('call trhog', annotation);
    this.layout.CloneFrozenAnnotation(annotation);    
  }

  /**
   * removes an annotation from the list, and removes the node its
   * the parent (although the node still exists in the annotation, if
   * it existed before).
   */
  public RemoveAnnotation(annotation: Annotation): void {
    for (let i = 0; i < this.active_sheet.annotations.length; i++) {
      if (annotation === this.active_sheet.annotations[i]) {
        this.active_sheet.annotations.splice(i, 1);

        this.layout.RemoveAnnotation(annotation);

        this.grid_events.Publish({
          type: 'annotation',
          annotation,
          event: 'delete',
        });
        return;
      }
    }
  }

  /**
   * this method removes annotation nodes from the grid/layout, but doesn't
   * affect the underlying data. this should be used to remove annotations
   * when switching sheets.
   *
   * you can also use it when cleaning up, if the underlying data will also
   * be wiped from the model.
   */
  public RemoveAnnotationNodes(): void {
    if (!this.headless) {
      this.layout.RemoveAnnotationNodes();
    }
  }

  /* *
   * specialization: update selection, scroll offset
   * /
  public Serialize(options: SerializeOptions = {}): SerializedModel {

    // selection moved to sheet, but it's not "live"; so we need to
    // capture the primary selection in the current active sheet before
    // we serialize it

    this.active_sheet.selection = JSON.parse(JSON.stringify(this.primary_selection));

    // same for scroll offset

    this.active_sheet.scroll_offset = this.layout.scroll_offset;

    // now call the base class serialization method

    return super.Serialize(options);

  }
  */

  /**
   * show or hide headers
   * 
   * FIXME: this shouldn't be sent if the current value === the desired value
   * 
   * FIXME: this is a display option. I'm not sure it should go through the 
   * command queue, because it's a local choice. leaving for now, but FIXME
   */
  public ShowHeaders(show = true): void {
    this.ExecCommand({
      key: CommandKey.ShowHeaders,
      show,
    });
  }

  /** 
   * this method is called after an XLSX import.
   * 
   * FIXME: should this not be in base? (...)
   * 
   * I suppose it's specific to an environment that _could_ import XLSX, 
   * so it's not strictly speaking generic.
   */
  public FromImportData(
    import_data: {
      sheets: ImportedSheetData[],
      // names?: Record<string, string|number>,
      named?: SerializedNamed[],
      active_tab?: number,
    },
    render = false,
  ): void {

    this.RemoveAnnotationNodes();

    const sheet_data = import_data.sheets;

    const base_sheets = sheet_data.map(() => {
      return Sheet.Blank(this.model.theme_style_properties).toJSON();
    });

    // it's possible that the first sheet is hidden, in which case we 
    // want to activate a different sheet. we'll do this by peeking at
    // the import data here to find the first non-hidden sheet; if there
    // aren't any, default to zero.

    // FIXME: use whatever sheet the import has active, no reason to reset

    let visible_sheet: number|undefined;
    if (typeof import_data.active_tab === 'number') {
      visible_sheet = base_sheets[import_data.active_tab]?.id;
    }
    else {
      for (let i = 0; i < import_data.sheets.length; i++) {
        if (!import_data.sheets[i].hidden) {
          visible_sheet = base_sheets[i].id;
          break;
        }
      }
    }

    // why do we call this? it seems like we do all the work over again
    // below. we should either import first, then call update, or not 
    // call update and just do the work here. although the better approach
    // would be to unify and reduce any duplication.

    this.UpdateSheets(base_sheets, true, visible_sheet);

    // build a name map for fixing named ranges

    const name_map: Record<string, number> = {};
    
    // FIXME: are there macro functions in the data? (...)

    // this.model.macro_functions = {};
    this.model.macro_functions.clear();

    this.ClearSelection(this.primary_selection);

    this.model.tables.clear();

    // moved data import into sheet

    for (let i = 0; i < sheet_data.length; i++) {
      const sheet = this.model.sheets.list[i];
      sheet.ImportData(sheet_data[i]);
      name_map[sheet.name] = sheet.id;

      // FIXME: list tables separately in import data so we don't have 
      // to look at every cell
      
      for (const cell of sheet_data[i].cells) {
        if (cell.table) {
          cell.table.area.start.sheet_id = sheet.id;
          this.model.tables.set(cell.table.name.toLowerCase(), cell.table);
        }
      }

      for (const table of this.model.tables.values()) {
        this.UpdateTableColumns(table);
      }

    }

    this.model.sheets.UpdateIndexes();

    this.model.named.Reset();

    if (import_data.named) {
      this.model.UnserializeNames(import_data.named, this.active_sheet);
    }

    // FIXME: do we need to rebuild autocomplete here (A: yes)
    // ...

    // should already be added, right?

    for (const element of this.active_sheet.annotations) {
      this.AddAnnotation(element, true);
    }

    // handle any necessary activation tasks

    this.ActivateSheetTasks();

    // no longer sending explicit layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    if (render) {
      this.Repaint(false, false); // true, true);
    }

    if (this.tab_bar) {
      this.tab_bar.Update();
    }

  }

  /**
   * This function is called via Shift+PageUp/PageDown. We need
   * to update to account for hidden sheets, which can't be activated.
   */
  public NextSheet(step = 1): void {

    if (this.model.sheets.length === 1) {
      return;
    }

    // we could build a list of allowable sheets, or we could walk...

    // building a list would help identify cases where 
    // there's only one sheet visible, and we could leave early

    // (walking would be simpler, in the end, there are three loops here)

    // list of tuples: visible sheet, index
    const visible = this.model.sheets.list.map((sheet, index) => ({ sheet, index })).filter(test => test.sheet.visible);

    if (visible.length === 1) {
      return; 
    }

    for (let i = 0; i < visible.length; i++) {
      if (visible[i].sheet === this.active_sheet) {
        let index = (i + step) % visible.length;
        while (index < 0) { index += visible.length; }
        this.ActivateSheet(visible[index].index);
        return;
      }
    }
    
  }

  /** 
   * UpdateSheets means "set these as the sheets, drop any old stuff".
   * there's an implicit reset (in fact we may do that twice in some
   * cases).
   * 
   */
  public UpdateSheets(data: LegacySerializedSheet[], render = false, activate_sheet?: number | string): void {

    super.UpdateSheets(data, render, activate_sheet);

    // remove existing annotations from layout

    this.RemoveAnnotationNodes();

    // selection

    this.ClearSelection(this.primary_selection);

    // FIXME: copying from updatesheet AND activatesheet... still need to unify

    // support old style files

    if (data[0] && data[0].primary_selection) {
      const selection = (data[0].primary_selection) as GridSelection;
      if (!selection.empty) {
        this.Select(this.primary_selection,
          new Area(selection.area.start, selection.area.end), selection.target);
      }
    }

    // the new version, as fallback

    else if (!this.active_sheet.selection.empty) {
      const template = this.active_sheet.selection;
      this.Select(this.primary_selection,
        new Area(template.area.start, template.area.end), template.target);
    }


    // for this version, we want to add all annotations at once; we only
    // add annotations on the active sheet to the layout, but the rest are
    // also created. the intent here is to ensure that any dependent cells
    // (like MC results) are marked even before we open a particular sheet.

    // otherwise layout of annotations won't work properly
    this.layout.ClearLayoutCaches();
    
    for (const sheet of this.model.sheets.list) {
      for (const annotation of sheet.annotations) {
        this.AddAnnotation(annotation, true, (sheet === this.active_sheet));
      }
    }

    // handle any necessary activation tasks

    this.ActivateSheetTasks();

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    // we may need to update scroll after expanding the grid (especially
    // if this is the first load), so temporarily cache the scroll target.
    // use a clone, so we don't accidentally modify it.

    this.QueueLayoutUpdate(JSON.parse(JSON.stringify(this.active_sheet.scroll_offset)));

    this.StyleDefaultFromTheme();

    // TODO: reset scroll

    if (render) {
      this.Repaint(false, false);
    }

    if (this.tab_bar) {
      this.tab_bar.Update();
    }

  }


  /**
   * rebuild layout on a resize. we are not trapping resize events, clients
   * should do that (also this works for embedded elements that are not
   * directly affected by document resize).
   */
  public UpdateLayout(): void {
    this.layout.UpdateTiles();
    this.layout.UpdateContentsSize();
    this.render_tiles = this.layout.VisibleTiles();
    this.Repaint(true);
  }

  /**
   * we need this method for split views
   */
  public UpdateTabBar(): void {
    if (this.tab_bar) {
      this.tab_bar.Update();
    }
  }

  /**
   * @param initial first call, from the grid Initialize() method
   */
  public UpdateTheme(initial = false, additional_properties?: Partial<Theme /*ExtendedTheme*/ >): void {

    if (!initial) {
      for (const key of Object.keys(this.theme) as Array<keyof Theme>) {
        delete this.theme[key];
      }
    }

    let composite: Theme = JSON.parse(JSON.stringify(DefaultTheme));

    if (this.view_node) {
      const theme_properties = LoadThemeProperties(this.view_node, this.options.support_font_stacks);
      composite = {...theme_properties};
    }

    // all this is super confusing, probably the result of theme going
    // back and forth from css to object. needs a scrub.

    // I think theme is permanent, so we wind up doing a lot of stuff
    // to manage properties -- make it ephemeral with a getter or a wrapper?

    

    // NOTE: this prevents it from rebuilding based on changes to the
    // stylesheet; putting this.theme second overrides any new values.

    // depending on whether we want to keep using object theme, we might
    // remove that. for the time being we'll use a flag...

    /*
    const composite = CalculateSupplementalColors({
      ...theme_properties,
      ...this.theme,
      ...additional_properties,
    });
    */
    composite = {
      // ...theme_properties,
      ...this.theme,
      ...composite,
      ...additional_properties,
    };

    Object.assign(this.theme, composite);
    //for (const key of Object.keys(composite) as Array<keyof Theme>) {
    //  this.theme[key] = composite[key] as any; // solve this problem in typescript
    //}

    // update style for theme
    this.StyleDefaultFromTheme();

    this.active_sheet.UpdateDefaultRowHeight(this.theme);
    this.active_sheet.FlushCellStyles();

    this.layout.ApplyTheme(this.theme);

    // this.tile_renderer.UpdateTheme(); // has reference

    if (this.tab_bar) {
      this.tab_bar.UpdateTheme();
    }

    if (!initial) {

      this.UpdateLayout(); // in case we have changed font size
      // this.selection_renderer.Flush();

      this.overlay_editor?.UpdateScale(this.layout.scale);

      // if (this.formula_bar) this.formula_bar.UpdateTheme();

      this.Repaint(true, true, true);
    }

  }

  /** set scale directly */
  public SetScale(scale: number) {
    scale = Math.round(scale * 1000) / 1000;
    scale = Math.min(2, Math.max(scale, .5));

    if (this.options.persist_scale_key) {
      localStorage.setItem(this.options.persist_scale_key, JSON.stringify({scale}));
    }

    this.scale = scale;
  }

  /**
   * @param container html container element
   */
  public Initialize(view_node: HTMLElement, toll_initial_render = false): void {

    if (!this.tile_renderer || !this.selection_renderer) {
      return;
    }

    // grid no longer has access to the outer container, it just has 
    // the "view" container. so we need to move things like UA classes
    // outside of this class. we should move theme parsing as well, so
    // we don't do that twice if we have two views.

    // going to rename to clarify.

    this.view_node = view_node;

    // MOVE

    // this.ApplyTheme();
    this.UpdateTheme(true);

    const higher_level_container = view_node.querySelector('.treb-spreadsheet-body') as HTMLElement;
    const container = higher_level_container.querySelector('div') as HTMLElement;

    // let autocomplete: Autocomplete | undefined;

    if (this.options.formula_bar) {
      if (!this.autocomplete) {
        this.autocomplete = new Autocomplete({ theme: this.theme, container });
      }
      this.InitFormulaBar(view_node, this.autocomplete);
    }

    if (this.options.tab_bar) {

      this.tab_bar = new TabBar(this.layout, this.model, this.view, this.options, this.theme, view_node);
      this.tab_bar.Subscribe((event) => {
        switch (event.type) {
          case 'cancel':
            break;

          case 'scale':
            {
              let scale = this.layout.scale;

              scale = Math.round(event.value * 1000) / 1000;
              scale = Math.min(2, Math.max(scale, .5));

              if (this.options.persist_scale_key) {
                localStorage.setItem(this.options.persist_scale_key, JSON.stringify({scale}));
              }

              this.scale = scale;

              if (event.keep_focus) { 
                return; // prevent focus stealing (for now)
              }

            }
            break;

          case 'reorder-sheet':
            this.ReorderSheet(event.index, event.move_before);
            break;

          case 'delete-sheet':
            this.DeleteSheet();
            break;

          case 'add-sheet':
            this.AddSheet();
            break;

          case 'rename-sheet':
            this.RenameSheet(event.sheet, event.name);
            break;

          case 'activate-sheet':
            this.ActivateSheetID(event.sheet.id);
            break;
        }

        if (!this.SelectingArgument()) {
          this.Focus();
        }

      });

    }

    // set container and add class for our styles

    this.container = container;
    this.container.classList.add('treb-grid');

    // we can force scrollbars, but it breaks sticky (apparently)
    //
    // ...doesn't break sticky, at least AFAICT; also necessary for
    // horizontal scrolling.

    if (UA.is_mac && UA.is_safari) {
      this.container.classList.add('safari');
    }

    // accept focus, keyboard input

    this.container.setAttribute('tabindex', '-1');

    /* see method comment

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

    */

    // create dom structure

    this.layout.Initialize(container, {

          // scroll callback
          scroll: () => this.OnScroll(), 

          // dropdown callback
          dropdown: (value: CellValue) => this.OnDropdownSelect(value),

          // sort (table) callback
          sort: (name: string, column: number, asc: boolean) => {
            const table = this.model.tables.get(name.toLowerCase());
            if (table) {
              this.SortTable(table, {
                column,
                asc,
              });
            }
          },

          // focus callback
          focus: () => this.Focus(),
        },
        this.options.scrollbars);
        
    this.selection_renderer.Initialize();
    this.layout.UpdateTiles();

    // event handlers and components

    // Sheet.sheet_events.Subscribe(this.HandleSheetEvent.bind(this));

    if (!this.autocomplete) {
      this.autocomplete = new Autocomplete({ theme: this.theme, container });
    }
    this.InitOverlayEditor(this.autocomplete);

    this.AttachListeners();

    // set local state and update

    this.render_tiles = this.layout.VisibleTiles();

    // don't delay this, it looks terrible

    if (!toll_initial_render) {

      // tab bar was disappearing on initial load without a document; that's
      // because it was only getting called on load/update. if we're not tolling,
      // then we need to update here.

      // if (this.tab_bar) {
      //  this.tab_bar.Update(); 
      //}

      this.tab_bar?.Update();

      this.Repaint(true);
    }

  }

  /**
   * merge target area or selection
   */
  public MergeCells(area?: Area): void {

    if (!area && this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.layout.HideDropdownCaret();

    this.ExecCommand({
      key: CommandKey.MergeCells,
      area: area || this.primary_selection.area,
    });
  }

  /**
   * unmerge cells
   */
  public UnmergeCells(area?: Area): void {

    if (!area && this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.layout.HideDropdownCaret();

    this.ExecCommand({
      key: CommandKey.UnmergeCells,
      area: area || this.primary_selection.area,
    });

  }

  /** 
   *
   */
  public GetAnnotationStyle(): CellStyle|undefined {
    if (this.selected_annotation) {
      if (this.selected_annotation.data?.style) {
        return JSON.parse(JSON.stringify(this.selected_annotation.data.style));
      }
      return {};
    }
    return undefined;
  }

  /**
   * 
   */
  public ApplyAnnotationStyle(style: CellStyle = {}, delta = true) {

    // get the logic from committing a formula, I guess? it should run
    // through the command queue to update any related views. 
    // 
    // actually, FIXME? I think updating annotations generally is not
    // running through the command queue, that's a larger issue we need
    // to look at.

    if (this.selected_annotation) {

      const annotation = this.selected_annotation;
      annotation.data.style = JSON.parse(JSON.stringify( 
        delta ? Style.Composite([annotation.data.style || {}, style]) : style
      ));
      const node = annotation.view[this.view_index]?.node;

      this.layout.UpdateAnnotation(annotation, this.theme);

      if (node) {
        node.focus();
      }
      this.grid_events.Publish({ type: 'annotation', event: 'update', annotation });
      this.DelayedRender();
    }

  }

  /**
   * 
   */
  public AnnotationSelected() {
    return !!this.selected_annotation;
  }

  /**
   * focus on the container. not sure what that text parameter was,
   * legacy? TODO: remove
   */
  public Focus(text = '', click = false): void {

    if (this.selected_annotation) {

      if (click) {

        if (this.editing_annotation === this.selected_annotation) {
          this.pending_reset_selection = true;
        }
        else {
          this.selected_annotation = undefined;
          this.ShowGridSelection();
        }

      }
      else {
        // console.info("reselect annotation...", this.selected_annotation);
        // console.info("check", this.view_index, this.selected_annotation.view[this.view_index].node);
        this.selected_annotation.view[this.view_index].node?.focus();
        return;
      }
    }

    // FIXME: cache a pointer
    if (UA.is_mobile) {
      this.container?.focus();
    }
    else {
      this.overlay_editor?.Focus(text);
    }

    // this.container?.focus();
  }

  /**
   * set "data validation", which (atm) only supports a list of options
   * and will render as a dropdown; the list can be a list of values or
   * a range reference.
   */
  public SetValidation(target?: IArea, data?: CellValue[]|IArea, error?: boolean): void {

    if (!target) {
      if (this.primary_selection.empty) {
        throw new Error('invalid target in set validation');
      }
      target = this.primary_selection.area;
    }

    const area = new Area(target.start, target.end);

    // console.info({target, data});

    const command: DataValidationCommand = {
      key: CommandKey.DataValidation,
      area: { start: area.start, end: area.end },
      error,
    };
    
    if (data) {
      if (Array.isArray(data)) { 
        command.list = data;
      }
      else if (typeof data === 'object'){
        if (data.start && data.end && IsCellAddress(data.start) && IsCellAddress(data.end)) {
          command.range = data as IArea;
        }
      }
    }

    this.ExecCommand(command);

    //
    // we should repaint or reselect the currect active cell if that cell
    // is the target; otherwise the dropdown caret does not appear/ stays
    // around.
    //

    if (!this.primary_selection.empty &&
        (!target.start.sheet_id || target.start.sheet_id === this.active_sheet.id) && 
        area.Contains(this.primary_selection.target)) {

        // (this.primary_selection.target.row === target.start.row) && 
        // (this.primary_selection.target.column === target.start.column)) {

      // console.info('repaint selection');

      requestAnimationFrame(() => this.Select(
        this.primary_selection, 
        this.primary_selection.area,
        this.primary_selection.target));
    }
    
  }

  /**
   * set or clear name. optionally overwrite existing name. note that
   * you cannot overwrite function names, only existing named ranges/expressions.
   * 
   * set name to refer to a range (named range) or expression/value (named 
   * expression). range has priority if you set both (FIXME: make that impossible)
   * 
   * note that expression here must be a valid expression in SL. if you want 
   * to set a literal string, enclose it in double quotes (as you would when 
   * using a string as an argument to a function).
   */
  public SetName(name: string, range?: ICellAddress | Area, expression?: string, scope?: number, overwrite = false): void {

    // console.info('setname', { name, range, expression, scope, overwrite });

    // validate/translate name first

    const validated = this.model.named.ValidateNamed(name);

    if (!validated) {
      throw new Error('invalid name');
    }

    name = validated;

    // check against functions. also an error if the name exists
    // but the overwrite flag is not set.

    if (this.autocomplete_matcher) {

      const ac_entry = this.autocomplete_matcher.Get(name);
      if (ac_entry) {
        if (!ac_entry.named || !overwrite) {
          if (range || expression) {
            throw new Error('name already defined');
          }
        }
      }

    }
        
    const command: SetNameCommand = {
      key: CommandKey.SetName,
      name,
      scope,
    };
   
    if (range) {

      if (IsCellAddress(range)) {
        range = new Area(range);
      }

      // make sure that this has a sheet ID, use active if not otherwise
      // set. FIXME: move to area? (...)

      if (!range.start.sheet_id) {
        range = new Area(
          { ...range.start, sheet_id: this.active_sheet.id }, range.end);
      }

      command.area = new Area(range.start, range.end);

    }
    else if (expression) {

      const parse_result = this.parser.Parse(expression);
      
      // there's a case we're missing here: if you pass a literal
      // string, not as a function, that should be interpreted as 
      // a string. we still want to use the parser on functions 
      // and literal types... how to distinguish?

      // actually, check that: let's require strings to be quoted,
      // so they get interpreted as literals. if you want to do fancy
      // switching do that at a higher level.

      // ...

      // resolve sheet. otherwise we wind up with dangling
      // references. NOTE: need to do this on import as well

      // FIXME: hmmm... I think I like the dangling reference?
      // so if you define something as `=A1*2`, then it should
      // resolve to the sheet you enter it into? 

      if (parse_result.valid && parse_result.expression) {

        this.parser.Walk(parse_result.expression, unit => {
          if (unit.type === 'address' || unit.type === 'range') {
            if (unit.type === 'range') {
              unit = unit.start;
            }
            if (!unit.sheet_id) {
              if (unit.sheet) {
                const sheet = this.model.sheets.Find(unit.sheet);
                if (sheet) {
                  unit.sheet_id = sheet.id;
                }
              }
            }
            if (!unit.sheet_id) {
              unit.sheet_id = this.active_sheet.id;
            }
            return false;
          }
          return true;
        });

        command.expression = parse_result.expression;
      }
      else {
        throw new Error('invalid expression');
      }
    }

    this.ExecCommand(command);
  }

  public SelectAll(): void {
    this.Select(this.primary_selection, new Area({ row: Infinity, column: Infinity }), undefined, true);
    this.RenderSelections();
  }

  /**
   * set or remove external editor. this is not an accessor because I don't
   * want to have to use a duplicate internal field, it's clumsy and this
   * class isn't public-facing so it's not super important.
   */
  public ExternalEditor(config: Partial<ExternalEditorConfig>|undefined) {

    this.external_editor_config = config;

    if (config) {

      const areas: Area[] = (config.dependencies || []).filter(
        <T>(test: T|undefined): test is T => !!test).map(reference => 
          IsCellAddress(reference) ? new Area(reference) : new Area(reference.start, reference.end));

      if (config.nodes?.length) {

        if (!this.external_editor) {
          const editor = new ExternalEditor(this.model, this.view);
          this.external_editor = editor;

          // should this persist, or should we only subscribe when we're active? (...)
          // in theory, at least, it won't send any events unless something changes

          editor.Subscribe(() => this.HighlightDependencies(editor.dependencies));
        }

        this.external_editor.AttachNodes(config.nodes, config.assume_formula ?? true);
 
      }
      else {
        if (this.external_editor) {
          this.external_editor.Reset();
        }
      }

      if (config.dependencies) {
        this.HighlightDependencies(areas);
      }

    }
    else {

      if (this.external_editor) {
        this.external_editor.Reset();
      }

      this.ClearAdditionalSelections();
      this.RenderSelections(true);
    }

  } 


  /** API method */
  public SelectRange(range?: Area): void {
    this.Select(this.primary_selection, range);
    this.RenderSelections();
  }

  /* *
   * FIXME: who uses this? anyone?
   * /
  public GetNumberFormat(address: ICellAddress): string|undefined {
    const style = this.active_sheet.CellStyleData(address);
    if (style && style.number_format) {
      return NumberFormatCache.Get(style.number_format).toString();
    }
  }
  */

  /**
   * I can't figure out a way in typescript to overload the GetRange function 
   * but call it with a variable to determine the overload (the aim is to have
   * different return types).
   * 
   * it seems to work fine if we use static values for the parameter (type, 
   * below) but not a variable which is (theoretically) type-restricted to the
   * same values. One to work on, maybe.
   * 
   * @param range 
   * @returns 
   */
  public GetRangeStyle(range: ICellAddress|IArea, apply_theme = false): CellStyle|CellStyle[][]|undefined {

    let sheet_id = 0;

    if (IsCellAddress(range)) {
      sheet_id = range.sheet_id || this.active_sheet.id;
    }
    else {
      sheet_id = range.start.sheet_id || this.active_sheet.id;
    }

    if (sheet_id) {
      const sheet = this.model.sheets.Find(sheet_id);
      return sheet?.GetCellStyle(range, apply_theme) || undefined;
    }

    return undefined;

  }

  /**
   * render the given data as R1C1. the source address is a base for 
   * rendering relative addresses (is there a case for this method
   * handling absolute offsets as well? ...)
   * 
   * NOTE: this method modifies the input data (at least it does if
   * it's an array). so this method should only be called with scratchpad
   * data.
   * 
   */
  public FormatR1C1(data: CellValue|CellValue[][], source: ICellAddress|IArea) {

    // normalize

    if (IsArea(source)) {
      source = source.start;
    }

    if (!Array.isArray(data)) {
      data = [[data]];
    }

    const base: UnitAddress = {
      type: 'address',
      label: '',
      row: source.row,
      column: source.column, 
      sheet: source.sheet_id ? this.model.sheets.Name(source.sheet_id) : this.active_sheet.name,
      position: 0,
      id: 0,
    };

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (typeof cell === 'string' && cell[0] === '=') {

          const parse_result = this.parser.Parse(cell);
          if (parse_result.expression) {
            row[c] = '=' + this.parser.Render(parse_result.expression, {
              missing: '',
              r1c1: true,
              r1c1_base: {
                ...base,
                row: source.row + r,
                column: source.column + c,
              },
            });
          }
        }
      }
    }

    return data;
    
  }

  /**
   * get data in a given range, optionally formulas
   * API method
   */
   public GetRange(range: ICellAddress | IArea, type?: 'formatted'|'A1'|'R1C1'): CellValue|CellValue[][]|undefined {

    if (IsCellAddress(range)) {
      const sheet = this.model.sheets.Find(range.sheet_id || this.active_sheet.id);
      if (sheet) {
        if (type === 'A1' || type === 'R1C1') { 
          const data = sheet.cells.RawValue(range); 
          if (type === 'R1C1') {
            return this.FormatR1C1(data, range);
          }
          return data;
        }
        if (type === 'formatted') { return sheet.GetFormattedRange(range); }
        return sheet.cells.GetRange(range);
      }
      return undefined;
    }

    const sheet = this.model.sheets.Find(range.start.sheet_id || this.active_sheet.id);
    if (sheet) {
      if (type === 'A1' || type === 'R1C1') { 
        const data = sheet.cells.RawValue(range.start, range.end); 
        if (type === 'R1C1') {
          return this.FormatR1C1(data, range);
        }
        return data;
      }
      if (type === 'formatted') { return sheet.GetFormattedRange(range.start, range.end); }
      return sheet.cells.GetRange(range.start, range.end);
    }

    return undefined;

  }

  /**
   * set data in given range
   * API method
   *
   * not sure why we have support for ArrayBufferView in here. this is an API
   * method, called by the embed sheet's API method, so there are no particular
   * requirements. we should lock down the allowable types.
   * 
   * @param range target range. if range is smaller than data, range controls.
   * if range is larger, behavior depends on the recycle parameter.
   * @param data single value, array (column), or 2d array
   * @param recycle recycle values. we only recycle single values or single
   * rows/columns -- we will not recycle a matrix.
   * @param transpose transpose before inserting (data is column-major)
   * @param r1c1 - support R1C1 notation. this does not mean the data _is_ in
   * R1C1, just that we need to check for it and handle it. R1C1 is useful for
   * relative offsets.
   */
  public SetRange(
      range: Area, 
      data: CellValue|CellValue[]|CellValue[][], 
      options: SetRangeOptions = {}) { // recycle = false, transpose = false, array = false, r1c1 = false): void {

    const { recycle, transpose, array, r1c1 } = options;

    // do a batch conversion if we have an explicit separator set

    if (options.argument_separator) {

      const current = {
        argument_separator: this.parser.argument_separator,
        decimal_mark: this.parser.decimal_mark,
      }

      this.parser.Save();

      let convert = false;

      if (options.argument_separator === ',' && this.parser.argument_separator !== ArgumentSeparatorType.Comma) {
        this.parser.SetLocaleSettings(DecimalMarkType.Period);
        convert = true;
      }
       
      if (options.argument_separator === ';' && this.parser.argument_separator !== ArgumentSeparatorType.Semicolon) {
        this.parser.SetLocaleSettings(DecimalMarkType.Comma);
        convert = true;
      }

      if (convert) {

        this.parser.flags.r1c1 = r1c1;

        const Convert = (value: CellValue): CellValue => {
          if (typeof value === 'string' && value[0] === '=') {
            const result = this.parser.Parse(value);
            if (result.expression) {
              value = '=' + this.parser.Render(result.expression, {
                missing: '', 
                convert_decimal: current.decimal_mark, 
                convert_argument_separator: current.argument_separator,
                pass_through_addresses: true,
              });
            }
            // console.info("CVT", this.parser.flags, result.expression, value);
          }
          return value;
        };

        if (Array.isArray(data)) {
          data = data.map(entry => {
            if (Array.isArray(entry)) {
              return entry.map(cell => {
                return Convert(cell);
              });
            }
            else {
              return Convert(entry);
            }
          }) as CellValue|CellValue[]|CellValue[][];
        }
        else {
          data = Convert(data);
        }

      }

      // reset

      // this.parser.argument_separator = current.argument_separator;
      // this.parser.decimal_mark = current.decimal_mark;

      this.parser.Restore();

    }
      

    // this is public so we need to (un)translate.
    data = this.model.UntranslateData(data);
    
     // single value, easiest
    if (!Array.isArray(data)) {

      if (recycle || array) {
        this.ExecCommand({ key: CommandKey.SetRange, area: range, value: data, array, r1c1 });
      }
      else {
        this.ExecCommand({ key: CommandKey.SetRange, area: range.start, value: data, array, r1c1 });
      }

    }
    else {

      if (!Is2DArray(data)) {

        // we don't allow this anymore (at least we say we don't)


        // flat array -- we can recycle. recycling is R style (values, not rows).
        // in any event convert to [][]

        if (recycle) {

          const rows = range.entire_column ? this.active_sheet.rows : range.rows;
          const columns = range.entire_row ? this.active_sheet.columns : range.columns;
          const count = rows * columns;

          if (count > data.length) {
            let tmp = data.slice(0);
            const multiple = Math.ceil(count / tmp.length);
            for (let i = 1; i < multiple; i++) {
              tmp = tmp.concat(data.slice(0));
            }
            data = tmp;
          }

          // reshape
          const reshaped: CellValue[][] = [];
          for (let c = 0, index = 0; c < columns; c++, index += rows) {
            reshaped[c] = data.slice(index, index + rows);
          }
          data = reshaped;

        }
        else {
          data = [data];
        }

      }
      else {
        if (recycle) {

          // recycle 2D array. we'll do this if the target range is a multiple
          // (or larger) of the source array. in blocks.

          if (range.rows > data.length) {
            const recycle_rows = Math.floor(range.rows / data.length);
            if (recycle_rows > 1) {
              const source = [...data];
              for (let i = 0; i < recycle_rows; i++) {
                const clone = JSON.parse(JSON.stringify(source));
                data.push(...clone);
              }  
            }
          }

          let cols = 0;
          for (const row of data) {
            cols = Math.max(cols, row.length);
          }

          if (range.columns > cols) {
            const recycle_columns = Math.floor(range.columns / cols);
            if (recycle_columns > 1) {

              for (const row of data) {

                // pad out all rows first, jic
                while (row.length < cols) {
                  row.push(undefined);
                }

                // now recycle
                const source = [...row];
                for (let i = 0; i < recycle_columns; i++) {
                  const clone = JSON.parse(JSON.stringify(source));
                  row.push(...clone);
                }

              }

              // ...

              // console.info({recycle_columns});
            }
          }

        }
      }

      if (transpose) { data = this.Transpose(data); }

      this.ExecCommand({ key: CommandKey.SetRange, area: range, value: data, array, r1c1 });

    }

    // how does this make sense here, if the command is executed asynchronously? (...)

    if (!this.primary_selection.empty && range.Contains(this.primary_selection.target)) {
      this.UpdateFormulaBarFormula();
    }


  }

  /**
   * applies the given style properties to the passed array, or to the
   * current primary selection
   *
   * API method
   */
  public ApplyStyle(area?: Area, properties: CellStyle = {}, delta = true): void {

    if (!area) {
      if (this.primary_selection.empty) {
        return;
      }
      else area = this.primary_selection.area;
    }

    // patch for old versions
    Sheet.UpdateStyle(properties);

    this.ExecCommand({
      key: CommandKey.UpdateStyle,
      area,
      style: properties,
      delta,
    });

    this.UpdateFormulaBarFormula();

  }

  /**
   * returns the primary selection. we use a reference to the real selection
   * sp callers can track; however, you can break things if you modify it.
   * so don't modify it. FIXME: proxy view? (...)
   *
   * API method
   */
  public GetSelection(): GridSelection {
    return this.primary_selection;
  }

  /** repaint after an external event (calculation) */
  public Update(force = false, area?: IArea|IArea[]): void {
    this.DelayedRender(force, area);
  }

  public UpdateAnnotations() {
    if (this.active_sheet.annotations.length) {
      this.layout.UpdateAnnotation(this.active_sheet.annotations, this.theme);
    }
  }

  /* *
   * API method
   *
   * @param area
   * @param borders
   * @param color
   * @param width
   * /
  public ApplyBorders(area?: Area, borders: BorderConstants = BorderConstants.None, color?: string, width = 1): void {

    if (!area) {
      if (this.primary_selection.empty) { return; }
      area = this.primary_selection.area;
    }

    if (borders === BorderConstants.None) {
      width = 0;
    }

    this.ExecCommand({
      key: CommandKey.UpdateBorders,
      color: { text: color },
      area,
      borders,
      width,
    });

  }
  */

  public Indent(area?: Area, delta = 0): void {

    if (!area) {
      if (this.primary_selection.empty) { return; }
      area = this.active_sheet.RealArea(this.primary_selection.area);
    }

    this.ExecCommand({
      key: CommandKey.Indent,
      area, 
      delta,
    });

  }

  /** updated API method, probably change the name */
  public ApplyBorders2(area?: Area, borders: BorderConstants = BorderConstants.None, color?: Color, width = 1): void {

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


  /**
   * batch updates. returns all the events that _would_ have been sent.
   * also does a paint (can disable).
   * 
   * update for nesting/stacking. we won't return events until the last
   * batch is complete. paint will similarly toll until the last batch
   * is complete, and we'll carry forward any paint requirement from 
   * inner batch funcs.
   * 
   * @param func 
   */
  public Batch(func: () => void, paint = true): GridEvent[] {
    
    if (this.batch === 0) {
      this.batch_paint = paint; // clear any old setting
    }
    else {
      this.batch_paint = this.batch_paint || paint; // ensure we honor it at the end
    }

    this.batch++;
    func();
    this.batch--;

    if (this.batch === 0) {
      const events = this.batch_events.slice(0);
      this.batch_events = [];

      if (this.batch_paint) {
        this.DelayedRender(false);
      }

      return events;
    }

    return []; // either nothing happened or we're not done

  }



  /**
   * scrolls so that the given cell is in the top-left (assuming that is
   * possible)
   */
  public ScrollTo(address: ICellAddress, x = true, y = true, smooth = false): void {
    this.layout.ScrollTo(address, x, y, smooth);
  }

  /**
   * scrolls the given address into view (assuming it's not in view now)
   *
   * FIXME: we need a way to do this without scrolling the containing
   * page, in the event we do a scroll-on-load. small problem.
   */
  public ScrollIntoView(address: ICellAddress, smooth = false): void {
    if (this.options.scrollbars) {
      this.layout.ScrollIntoView(address, smooth);
    }
  }

  public GetScrollOffset(): {x: number, y: number} {
    return this.layout.GetScrollOffset();
  }

  /**
   * get/set the raw scroll offset (ignoring headers). support for API method.
   * @param offset 
   */
  public ScrollOffset(offset?: {x: number, y: number}): {x: number, y: number}|undefined {
    if (offset) {
      this.layout.scroll_offset = offset;
    }
    else {
      return this.layout.scroll_offset;
    }
  }

  // --- private methods -------------------------------------------------------

  protected RenameSheetInternal(target: Sheet, name: string) {
    super.RenameSheetInternal(target, name);
    this.tab_bar?.Update();

  }

  private StyleDefaultFromTheme() {
    this.model.theme_style_properties.font_face = this.theme.grid_cell?.font_face || '';
    this.model.theme_style_properties.font_size = 
      this.theme.grid_cell?.font_size || { unit: 'pt', value: 10 };
  }

  private AutoSizeRow(sheet: Sheet, row: number, allow_shrink = true): void {
    
    if (!this.tile_renderer) {
      return;
    }

    const current_height = sheet.GetRowHeight(row);
    let max_height = 0;
    const padding = 6; // 4 * 2; // FIXME: parameterize

    for (let column = 0; column < sheet.cells.columns; column++) {
      const cell = sheet.CellData({ row, column });
      const { height } = this.tile_renderer.MeasureText(cell, sheet.GetColumnWidth(column), 1);
      max_height = Math.max(max_height, height + padding);
    }

    if (!allow_shrink) {
      max_height = Math.max(current_height, max_height);
    }

    if (max_height > padding + 2) {
      sheet.SetRowHeight(row, max_height);
    }


  }

  private AutoSizeColumn(sheet: Sheet, column: number, allow_shrink = true): void {

    if (!this.tile_renderer) {
      return;
    }

    const current_width = sheet.GetColumnWidth(column);
    let max_width = 0;
    const padding = 14; // 4 * 2; // FIXME: parameterize

    for (let row = 0; row < sheet.cells.rows; row++) {
      const cell = sheet.CellData({ row, column });
      const { width } = this.tile_renderer.MeasureText(cell, current_width, 1);
      max_width = Math.max(max_width, width + padding);
    }

    if (!allow_shrink) {
      max_width = Math.max(current_width, max_width);
    }

    if (max_width > padding + 2) {
      sheet.SetColumnWidth(column, max_width);
    }

  }

  /**
   * we have to handle the case where we have a split view and the model
   * changes in some way -- remove a sheet, for example -- that invalidates
   * our active sheet. if that happens, we need to switch to a different
   * sheet.
   * 
   * we don't get events about this (should we?) so someone will have to 
   * call it. FIXME: we should get events about that.
   */
  public EnsureActiveSheet(force = false) {

    for (const sheet of this.model.sheets.list) {
      if (sheet === this.active_sheet) {
        if (force) {
          this.ActivateSheetInternal({
            key: CommandKey.ActivateSheet,
            id: sheet.id,
            force: true,
          });
        }
        return;
      }
    }    

    // invalid -- jump to 0

    this.ActivateSheetInternal({
      key: CommandKey.ActivateSheet,
      index: 0,
    });
    
  }


  /**
   * specialization for grid. note that we don't call superclass,
   * so we need to do everything that method does as well.
   */
  protected ActivateSheetInternal(command: ActivateSheetCommand) {

    const selecting_argument = this.SelectingArgument();

    // console.info('activate sheet', command, 'sa?', selecting_argument);

    const candidate = this.ResolveSheet(command) || this.model.sheets.list[0];

    // ok, activate...

    if (this.active_sheet === candidate && !command.force) {
      return;
    }

    if (!candidate.visible) {
      throw new Error('cannot activate hidden sheet');
    }

    // hide note, title 

    // FIXME: I don't like that we're maintaining these local flags. those
    // should be encapsulated somewhere, along with the show/hide methods.

    this.HideHoverInfo();


    // cache primary selection in the sheet we are deactivating
    // FIXME: cache scroll position, too!

    this.active_sheet.selection = JSON.parse(JSON.stringify(this.primary_selection));

    this.active_sheet.scroll_offset = this.layout.scroll_offset;

    // hold this for the event (later)

    const deactivate = this.active_sheet;

    this.RemoveAnnotationNodes();

    // select target

    this.active_sheet = candidate;

    // ---

    // don't update selection if selecting argument... actually we _do_
    // want to clear the primary selection, we just don't want the side
    // effects of clearing the formula bar and so on

    if (!selecting_argument) {
      this.ClearSelection(this.primary_selection);

      if (candidate.selection && !candidate.selection.empty) {
        this.Select(this.primary_selection,
          new Area(candidate.selection.area.start, candidate.selection.area.end),
          candidate.selection.target);
      }

    }
    else {
      this.RenderSelections();
    }

    // scrub, then add any sheet annotations. note the caller will
    // still have to inflate these or do whatever step is necessary to
    // render.

    const annotations = this.active_sheet.annotations;
    for (const element of annotations) {
      this.AddAnnotation(element, true);
    }

    // handle any necessary activation tasks

    this.ActivateSheetTasks();
    
    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    this.QueueLayoutUpdate();

    // this.StyleDefaultFromTheme(); // ?

    // if (render) {

    // our scheme for co-editing causes some cases where we will need to
    // flush rendered data in background sheets. in that case we're using
    // this set to list sheets as pending, so we can refresh when we activate
    // the sheet.

    if (this.pending_layout_update.has(this.active_sheet.id)) {
      this.Repaint(true, true);
      this.pending_layout_update.delete(this.active_sheet.id);
    }
    else {
      this.Repaint(false, false);
    }

    // }

    // FIXME: structure event

    this.grid_events.Publish({
      type: 'sheet-change',
      deactivate,
      activate: this.active_sheet,
    });

    if (this.tab_bar) { this.tab_bar.Update(); }

    this.layout.scroll_offset = this.active_sheet.scroll_offset;

    if (this.formula_bar?.selecting) {
      requestAnimationFrame(() => this.formula_bar?.FocusEditor());
    }

  }

  /**
   * handle any tasks the sheet needs to do on activation
   */
  private ActivateSheetTasks() {

    this.active_sheet.Activate(this.DOM);
    
    if (this.active_sheet.image && !this.active_sheet.image.complete) {

      // the image may not have loaded immediately -- in fact it usually 
      // won't, unless it's already in memory for some reason. schedule
      // a repaint.

      const image = this.active_sheet.image;

      // limit so we don't do this forever
      // can we do animationFrame or even promise.resolve?

      let counter = 0;
      const RepaintLayout = () => {
        if (!image.complete) {
          if (counter++ < 5) {
            setTimeout(() => RepaintLayout(), 10);
          }
        }
        else {
          this.UpdateLayout();
        }
      };

      RepaintLayout();

    }
  }


  /**
   * why is this not in layout? (...)
   * how is this layout? it's an effect. make an effects class.
   */
  private HighlightFreezeArea() {

    for (const node of [
        this.layout.corner_selection,
        this.layout.row_header_selection,
        this.layout.column_header_selection]) {

      node.classList.add('highlight-area');
      setTimeout(() => {
        node.classList.remove('highlight-area');
      }, 400);
      
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
  private QueueLayoutUpdate(scroll?: {x: number, y: number}) {
    this.tile_update_pending = true;

    // don't step on existing pending scroll. we will explicitly
    // clear after we use it.

    if (scroll) {
      this.scroll_offset_pending = scroll;
    }

  }

  private HandleAddressLabelEvent(text?: string) {

    if (text) {

      // can be one of:
      // 
      // - it's an address (possibly including sheet): jump to that address
      // - it's a range, same thing
      // - it's a name, which exists: jump to that name
      // - it's a name, which doesn't exist: create name for current selection

      // we definitely do this a lot, need to consolidate

      const resolve_sheet_name = (name = ''): number => {
        const lc = name.toLowerCase();
        for (const sheet of this.model.sheets.list) {
          if (sheet.name.toLowerCase() === lc) { return sheet.id; }
        }
        return this.active_sheet.id; // default to active sheet on short-hand names like "A2"
      }

      const get_sheet = (id?: number) => {
        for (const sheet of this.model.sheets.list) {
          if (sheet.id === id) { return sheet; }
        }
        return this.active_sheet;
      };

      let target_area: Area|undefined;
      const parse_result = this.parser.Parse(text);

      if (parse_result.expression) {
        switch (parse_result.expression.type) {
          case 'address':
            parse_result.expression.sheet_id = resolve_sheet_name(parse_result.expression.sheet);
            target_area = new Area(parse_result.expression);
            break;

          case 'range':
            parse_result.expression.start.sheet_id = resolve_sheet_name(parse_result.expression.start.sheet);
            target_area = new Area(parse_result.expression.start, parse_result.expression.end);
            break;

          case 'identifier':
            {
              const named = this.model.GetName(parse_result.expression.name, this.active_sheet.id); // assuming it's in the active sheet? what if it's qualified?
              if (named?.type === 'range') {
                target_area = named.area;
              }
              if (!target_area) {
                if (!this.primary_selection.empty) {
                  this.SetName(parse_result.expression.name.toUpperCase(), this.primary_selection.area);
                }
              }
            }
            break;
        
          default:
            // console.info('UNK', parse_result.expression.type);
            break;
        }
      }

      if (target_area) {
        
        // check that range exists
        const sheet = get_sheet(target_area.start.sheet_id);
        if (sheet.columns >= target_area.end.column && sheet.rows >= target_area.end.row) {
          this.ExecCommand({
            key: CommandKey.Select,
            area: target_area,
          });
          return;
        }
        else {
          console.warn('address out of range');
        }
      }

    }

    this.UpdateAddressLabel();
    this.Focus();

  }

  private InitFormulaBar(grid_container: HTMLElement, autocomplete: Autocomplete) {

    this.formula_bar = new FormulaBar(
      grid_container,
      // this.parser,
      // this.theme,
      this.model,
      this.view,
      this.options, autocomplete);

    this.formula_bar.autocomplete_matcher = this.autocomplete_matcher;

    this.formula_bar.Subscribe((event) => {

      switch (event.type) {

        case 'address-label-event':
          this.HandleAddressLabelEvent(event.text)
          break;

        case 'stop-editing':

          if (this.pending_reset_selection) {
            this.ShowGridSelection();
          }
          this.pending_reset_selection = false;
          this.editing_state = EditingState.NotEditing;
          break;

        case 'start-editing':

          // NOTE: because this event (and stop-editing) are based on
          // focus, they don't behave correctly when switching sheets,
          // which (at least temporarily) steals focus. so we actually
          // get extra start and stop events. it works, sort of, because
          // we don't clear the primary selection when changing sheets
          // when editing, so the sheet ID is correct. but that's an
          // accident. see note below on 'commit'.

          // FIXME: could this be resolved by using the "selecting argument"
          // flag? that's sort of what that was originally created for,
          // although it predates multi-sheet. TODO

          this.editing_state = EditingState.FormulaBar;
          this.editing_cell = { ...this.primary_selection.target };
          this.editing_selection = { ...this.primary_selection };
          break;

        case 'toll':

          // this is basically "stop editing", with some special
          // semantics to capture the editing state. it's intended
          // for external clients, specifically for an "insert function"
          // dialog.

          this.editing_state = EditingState.NotEditing;
          this.ClearAdditionalSelections();
          this.ClearSelection(this.active_selection);
          this.DelayedRender();
          break;

        case 'discard':

          this.editing_state = EditingState.NotEditing;

          if (this.editing_annotation) {
            this.ClearAdditionalSelections();
            this.ClearSelection(this.active_selection);
            const node = this.editing_annotation.view[this.view_index]?.node;
            if (node) {
              node.focus();
            }
            this.editing_annotation = undefined;
            this.UpdateFormulaBarFormula();
            this.DelayedRender();
            return;
          }

          if (this.container) this.Focus();
          this.ClearAdditionalSelections();
          this.ClearSelection(this.active_selection);
          this.UpdateFormulaBarFormula();
          this.DelayedRender();
          break;

        case 'commit':

          // FIXME: unify this (to the extent possible) w/ the other editor

          // NOTE: this only works because (1) on activate sheet, if you are
          // editing, we don't update the primary selection; and (2) for
          // annotations, we set a fake primary selection target with the
          // correct sheet ID.

          // all that needs to be rewritten to be more sane.

          if (this.active_sheet.id !== this.editing_cell.sheet_id) {
            if (this.editing_cell.sheet_id) {
              this.ActivateSheetID(this.editing_cell.sheet_id);
            }
          }

          this.editing_state = EditingState.NotEditing;

          // we added annotations to the formula bar, so there's some
          // logic here that's not in the ICE commit handler

          if (this.editing_annotation) {
            const annotation = this.editing_annotation;
            this.ClearAdditionalSelections();
            this.ClearSelection(this.active_selection);
            annotation.data.formula = event.value ? this.FixFormula(event.value) : '';

            if (!this.pending_reset_selection) {
              const node = this.editing_annotation.view[this.view_index]?.node;
              if (node) {
                node.focus();
              }
            }

            this.grid_events.Publish({ type: 'annotation', event: 'update', annotation });
            this.editing_annotation = undefined;
            this.DelayedRender();
            return;
          }

          if (this.container) this.Focus();

          if (event.event) {
            this.SetInferredType(this.primary_selection, event.value, event.array);
          }
          else {
            if (this.editing_selection) {
              this.SetInferredType(this.editing_selection, event.value, event.array);
            }
          }

          this.ClearAdditionalSelections();
          this.ClearSelection(this.active_selection);

          if (this.options.repaint_on_cell_change) {
            this.DelayedRender(false, this.primary_selection.area);
          }

          // unifying
          if (event.event) {

            // this was broken out because we used it in multiple places
            // (here are in the ICE) but we don't do that anymore, it could
            // come back inline.

            // or we could probably even just drop it, since for the formula
            // bar we only have to handle some basic keys

            // and now that I think about it, why are we cloning and 
            // dispatching instead of just calling the method? 

            // this.RedispatchEvent(event.event);

            this.OverlayKeyDown(event.event);

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

  private InitOverlayEditor(autocomplete: Autocomplete) {
    if (!this.container) {
      return;
    }

    this.overlay_editor = new OverlayEditor(
        this.container,
        this.theme,
        this.model,
        this.view,
        autocomplete);

    this.overlay_editor.UpdateScale(this.layout.scale);
    this.overlay_editor.autocomplete_matcher = this.autocomplete_matcher;

    this.overlay_editor.Subscribe(event => {
      switch (event.type) {
        
        // see notes in formula editor event handler re: start editing,
        // stop editing  and commit.

        // UPDATE: discard and commit are now moved inline in the key
        // handler, since the nodes are unified

        case 'stop-editing':
          this.editing_state = EditingState.NotEditing;
          break;

        case 'start-editing':
          this.editing_state = EditingState.CellEditor;
          this.editing_cell = { ...this.primary_selection.target };
          break;

        case 'update':
          if (event.dependencies) {
            this.HighlightDependencies(event.dependencies);
          }
          break;

        case 'end-selection':
        case 'reset-selection':
          this.ClearSelection(this.active_selection);
          if (this.overlay_editor?.target_address?.sheet_id && this.active_sheet.id !== this.overlay_editor.target_address.sheet_id) {
            this.ActivateSheetID(this.overlay_editor.target_address.sheet_id);
          }
          this.DelayedRender();
          break;

      }

    });


  }

  private DelayedRender(force = false, area?: IArea|IArea[], full_tile = false) {

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
      Promise.resolve().then(() => {
        this.render_token = 0;
        this.Repaint(force, full_tile);
      });
    }

  }

  private Repaint(force = false, full_tile = false, force_headers = false) {

    if (this.headless || !this.tile_renderer) { return; }

    if (this.tile_update_pending) {
      this.tile_update_pending = false;
      this.layout.UpdateTiles();

      if (this.scroll_offset_pending) {
        this.layout.scroll_offset = this.scroll_offset_pending;
        this.scroll_offset_pending = undefined; // clear
      }

      this.render_tiles = this.layout.VisibleTiles();
      this.layout.UpdateAnnotation(this.active_sheet.annotations, this.theme);

      // FIXME: why is this here, as opposed to coming from the command
      // exec method? are we doubling up? (...)

      // I think we are correctly handing all cases. not 100% sure, though.
      // add/remove rows/columns is handled correctly. loading and resetting
      // documents should not need this event, because there is implicit
      // rebuild required.

      // we should trace back every call that sets tile_update_pending (which
      // is in queue layout update) and make sure the event is either sent
      // or unecessary.


      /*
      this.grid_events.Publish({
        type: 'structure',
        rebuild_required: true,
      });
      */

    }

    this.layout_token = 0;

    // move this to the end. on first load, sheet will be smaller than
    // viewport, so full-row/full-column selections will be truncated.
    // by moving the selection render to the end, we get the result of 
    // any implicit sheet expansion.

    // this.RenderSelections();

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

    const row_list: number[] = [];
    for (let row = start.row; row <= end.row; row++) row_list.push(row);

    const column_list: number[] = [];
    for (let column = start.column; column <= end.column; column++) column_list.push(column);

    // FIXME: multiple tiles
    if (start.row > 0 && this.active_sheet.freeze.rows) row_list.push(0);
    if (start.column > 0 && this.active_sheet.freeze.columns) column_list.push(0);

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

    this.RenderSelections();

  }

  private MouseMove_RowHeader(event: MouseEvent) {

    const header = this.layout.CoordinateToRowHeader(event.offsetY);

    // this is used for the grid, but we can cheat and use it for the header
    const rect = this.layout.OffsetCellAddressToRectangle({ row: header.row, column: 0 });

    if (this.hover_data.address && (this.hover_data.address.row !== -1 || this.hover_data.address.column !== -1)) {
      this.HoverCell({ row: -1, column: -1 });
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

    if (this.hover_data.address && (this.hover_data.address.row !== -1 || this.hover_data.address.column !== -1)) {
      this.HoverCell({ row: -1, column: -1 });
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

    if (event.button !== 0) {
      return;
    }

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

      this.layout.HideDropdownCaret();

      if (this.IsDoubleClick({ row, column: -1 })) {

        let rows = [row];

        if (!this.primary_selection.empty &&
          this.primary_selection.area.rows > 1 &&
          this.primary_selection.area.start.column === Infinity &&
          this.primary_selection.area.ContainsRow(row)) {

          // update all selected columns. these could be in different tiles.

          // in case the whole sheet is selected
          const area = this.active_sheet.RealArea(this.primary_selection.area);

          rows = [];
          for (let r = area.start.row; r <= area.end.row; r++) {
            rows.push(r);
          }

        }

        // call with height = undefined, means auto-size

        this.ExecCommand({
          key: CommandKey.ResizeRows,
          row: rows,
        });

        return;
      }
      
      // height of ROW
      const original_height = this.layout.RowHeight(row);
      let height = original_height;

      const rect = this.layout.OffsetCellAddressToRectangle({ row, column: 0 });
      const tooltip_base = offset.y + rect.bottom;

      this.layout.ShowTooltip({
        left: true,
        text: `${height}px`,
        x: Math.round(bounding_rect.right + 10),
        y: tooltip_base,
      });

      const move_annotation_list: Array<{ annotation: Annotation; y: number, nodes: HTMLElement[] }> = [];
      const size_annotation_list: Array<{ annotation: Annotation; height: number, nodes: HTMLElement[] }> = [];

      for (const annotation of this.active_sheet.annotations) {
        const y = rect.bottom - 1; // -1? border or something?

        if (!annotation.scaled_rect || annotation.scaled_rect.bottom < y) { continue; }

        const nodes: HTMLElement[] = [...this.layout.GetFrozenAnnotations(annotation)];
        const node = annotation.view[this.view_index]?.node;
        if (node) { nodes.push(node); }

        if (y <= annotation.scaled_rect.top && annotation.data.move_with_cells) {
          move_annotation_list.push({ annotation, y: annotation.scaled_rect.top, nodes });
        }

        else if (y > annotation.scaled_rect.top && annotation.data.resize_with_cells) {
          size_annotation_list.push({ annotation, height: annotation.scaled_rect.height, nodes });
        }

      }

      MouseDrag(this.layout.mask, 'row-resize', (move_event: MouseEvent) => {
        const delta = Math.max(-original_height, Math.round(move_event.offsetY - base));
        if (delta + original_height !== height) {

          height = delta + original_height;
          // tile_sizes[tile_index] = tile_height + delta;
          this.layout.SetRowHeight(row, height);

          this.layout.UpdateTooltip({
            text: `${height}px`,
            y: tooltip_base + delta,
          });

          for (const { annotation, y } of move_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.scaled_rect.top = y + delta;
            }
          }
          for (const { annotation, height } of size_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.scaled_rect.height = height + delta;
            }
          }

          requestAnimationFrame(() => {

            // don't call the standard layout functions here. just move
            // the rects with the given deltas. we will sort it out later.

            for (const {annotation, nodes} of size_annotation_list) {
              if (annotation.scaled_rect) {
                for (const node of nodes) {
                  annotation.scaled_rect.ApplyStyle(node);
                }
              }
            }
            for (const {annotation, nodes} of move_annotation_list) {
              if (annotation.scaled_rect) {
                for (const node of nodes) {
                  annotation.scaled_rect.ApplyStyle(node);
                }
              }
            }

            /*
            for (const {annotation} of size_annotation_list) {
              if (annotation.scaled_rect && annotation.node) {
                annotation.scaled_rect.ApplyStyle(annotation.node);
              }
            }
            for (const {annotation} of move_annotation_list) {
              if (annotation.scaled_rect && annotation.node) {
                annotation.scaled_rect.ApplyStyle(annotation.node);
              }
            }
            */

            // FIXME: use command

            this.layout.UpdateTileHeights(true, row);
            this.Repaint(false, true); // repaint full tiles
            this.layout.UpdateAnnotation(this.active_sheet.annotations, this.theme);

          });

        }
      }, () => {

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

            // in case the whole sheet is selected
            const area = this.active_sheet.RealArea(this.primary_selection.area);

            rows = [];
            for (let r = area.start.row; r <= area.end.row; r++) {
              // this.model.sheet.RowHeight(r, height, true);
              rows.push(r);
            }

            // row = area.start.row; // ??

          }

          // TEMPORARILY undo what we just did... this is so the standard
          // resize handling can trigger an event, otherwise it would disappear
          // maybe it would be preferable to do that via a flag in the event?

          this.layout.SetRowHeight(row, original_height);

          this.ExecCommand({
            key: CommandKey.ResizeRows,
            row: rows,
            height: height / this.scale,
          });

          for (const { annotation } of move_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.data.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
          }

          for (const { annotation } of size_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.data.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
            const view = annotation.view[this.view_index];
            if (view && view.resize_callback) {
              view.resize_callback.call(undefined);
            }
          }

        });

      });
    }
    else {

      const selection = this.SelectingArgument() ?
        this.active_selection : this.primary_selection;

      // why would you _not_ want to focus? (...)

      /*
      if (!this.SelectingArgument() && this.selected_annotation) {
        this.Focus();
      }
      */
      if (!this.SelectingArgument()) {
        this.Focus(undefined, true);
      }


      if (event.shiftKey && !selection.empty) {
        const tmp = selection.target;
        this.Select(selection, new Area(selection.target, base_address, true), undefined, true);
        base_address = tmp;
      }
      else {
        this.Select(selection, new Area(base_address), { column: 0, row: base_address.row });
      }
      this.RenderSelections();

      MouseDrag(this.layout.mask, [], (move_event: MouseEvent) => {
        const address = this.layout.CoordinateToRowHeader(move_event.offsetY - offset.y);
        const area = new Area(address, base_address, true);

        if (selection.empty || !area.Equals(selection.area)) {
          this.Select(selection, area, undefined, true);
          this.RenderSelections();
        }
      }, () => {
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

    if (event.button !== 0) {
      return;
    }

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

      this.layout.HideDropdownCaret();

      // doubleclick

      if (this.IsDoubleClick({ row: -1, column })) {

        let columns = [column];

        if (!this.primary_selection.empty &&
          this.primary_selection.area.columns > 1 &&
          this.primary_selection.area.start.row === Infinity &&
          this.primary_selection.area.ContainsColumn(column)) {

          // update all selected columns. these could be in different tiles.

          // in case the whole sheet is selected
          const area = this.active_sheet.RealArea(this.primary_selection.area);

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

        return;
      }

      //

      // width of COLUMN
      const original_width = this.layout.ColumnWidth(column);
      let width = original_width;

      const rect = this.layout.OffsetCellAddressToRectangle({ row: 0, column });
      const tooltip_base = offset.x + rect.right;

      this.layout.ShowTooltip({
        up: true,
        text: `${width}px`,
        x: tooltip_base,
        y: Math.round(bounding_rect.bottom + 10),
      });

      // list of annotations that may be affected by this operation. 
      // this operation will either affect position or size, but not both.

      const move_annotation_list: Array<{ annotation: Annotation; x: number, nodes: HTMLElement[] }> = [];
      const size_annotation_list: Array<{ annotation: Annotation; width: number, nodes: HTMLElement[] }> = [];

      for (const annotation of this.active_sheet.annotations) {
        const x = rect.right - 1; // -1? border or something?
        if (!annotation.scaled_rect || annotation.scaled_rect.right < x) { continue; }

        const nodes: HTMLElement[] = [...this.layout.GetFrozenAnnotations(annotation)];
        const node = annotation.view[this.view_index]?.node;
        if (node) { nodes.push(node); }

        if (x <= annotation.scaled_rect.left && annotation.data.move_with_cells) {
          move_annotation_list.push({ annotation, x: annotation.scaled_rect.left, nodes });
        }
        else if (x > annotation.scaled_rect.left && annotation.data.resize_with_cells) {
          size_annotation_list.push({ annotation, width: annotation.scaled_rect.width, nodes });
        }
      }

      MouseDrag(this.layout.mask, 'column-resize', (move_event: MouseEvent) => {
        const delta = Math.max(-original_width, Math.round(move_event.offsetX - base));

        if (delta + original_width !== width) {

          width = delta + original_width;

          this.layout.UpdateTooltip({
            text: `${width}px`,
            x: tooltip_base + delta,
          });

          // I don't get how this works. it's not scaling?

          this.layout.SetColumnWidth(column, width);

          for (const { annotation, x } of move_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.scaled_rect.left = x + delta;
            }
          }
          for (const { annotation, width } of size_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.scaled_rect.width = width + delta;
            }
          }

          requestAnimationFrame(() => {

            // don't call the standard layout functions here. just move
            // the rects with the given deltas. we will sort it out later.

            /*
            for (const {annotation} of size_annotation_list) {
              if (annotation.scaled_rect && annotation.node) {
                annotation.scaled_rect.ApplyStyle(annotation.node);
              }
            }
            for (const {annotation} of move_annotation_list) {
              if (annotation.scaled_rect && annotation.node) {
                annotation.scaled_rect.ApplyStyle(annotation.node);
              }
            }
            */
            for (const {annotation, nodes} of size_annotation_list) {
              if (annotation.scaled_rect) {
                for (const node of nodes) {
                  annotation.scaled_rect.ApplyStyle(node);
                }
              }
            }
            for (const {annotation, nodes} of move_annotation_list) {
              if (annotation.scaled_rect) {
                for (const node of nodes) {
                  annotation.scaled_rect.ApplyStyle(node);
                }
              }
            }

            this.layout.UpdateTileWidths(true, column);
            this.Repaint(false, true); // repaint full tiles
            
            // this.layout.UpdateAnnotation(this.active_sheet.annotations);

          });

        }
      }, () => {

        this.layout.HideTooltip();

        requestAnimationFrame(() => {

          // @see MouseDown_RowHeader

          const columns = [column];

          if (!this.primary_selection.empty &&
            this.primary_selection.area.columns > 1 &&
            this.primary_selection.area.start.row === Infinity &&
            this.primary_selection.area.ContainsColumn(column)) {

            // update all selected columns. these could be in different tiles.

            // in case the whole sheet is selected
            const area = this.active_sheet.RealArea(this.primary_selection.area);

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
            width: width, //  / this.scale,
          });

          for (const { annotation } of move_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.data.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
          }

          for (const { annotation } of size_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.data.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
            const view = annotation.view[this.view_index];
            if (view && view.resize_callback) {
              view.resize_callback.call(undefined);
            }
          }

        });

      });
    }
    else {

      const selection = this.SelectingArgument() ?
        this.active_selection : this.primary_selection;

      // @see Mousedown_RowHeader

      if (!this.SelectingArgument()) {
        this.Focus(undefined, true);
      }

      /*
      if (!this.SelectingArgument() && this.selected_annotation) {
        this.Focus();
      }
      */

      if (event.shiftKey && !selection.empty) {
        const tmp = selection.target;
        this.Select(selection, new Area(selection.target, base_address, true), undefined, true);
        base_address = tmp;
      }
      else {
        this.Select(selection, new Area(base_address), { row: 0, column: base_address.column });
      }
      this.RenderSelections();

      MouseDrag(this.layout.mask, [], (move_event: MouseEvent) => {
        const address = this.layout.CoordinateToColumnHeader(move_event.offsetX - offset.x);
        const area = new Area(address, base_address, true);
        if (selection.empty || !area.Equals(selection.area)) {
          this.Select(selection, area, undefined, true);
          this.RenderSelections();
        }
      });
    }
  }

  private HoverCell(address: ICellAddress, event?: MouseEvent) {

    let cell = this.active_sheet.cells.GetCell(address, false);

    // check table. sortable can now be explicitly set (to false)

    if (cell?.table && cell.table.area.start.row === address.row && cell.table.sortable !== false) {
      this.hover_data.table_header = true;
      this.layout.ShowTableSortButton(cell.table, address.column - cell.table.area.start.column, address);
    }
    else {
      if (this.hover_data.table_header) {
        this.layout.HideTableSortButton();
      }
      this.hover_data.table_header = false;
    }

    if (cell?.merge_area) {
      const area = cell.merge_area;
      address = area.start;
      cell = this.active_sheet.cells.GetCell(address, false);
      address = { row: area.start.row, column: area.end.column };
    }

    // does this cell have a note?

    // just FYI we have separate note/tooltip because if not you could
    // "mask" the one by using the other (whichever one was dominant).

    if (cell?.note) {

      // optional MD formatting

      // UPDATE: we should allow MD in notes irrespective of the cell 
      // markdown setting. or maybe split the two settings? it makes
      // a lot of sense in comments, even if you don't want it in cells.

      const parsed = MDParser.instance.Parse(cell.note);

      const md = this.options.comment_markdown ? MDParser.instance.HTML(parsed, { br: false }) : undefined;
      this.layout.ShowNote(cell.note, address, event, md);

      this.hover_data.note = true;
    }
    else if (this.hover_data.note) {
      this.layout.HideNote();
      this.hover_data.note = false;
    }

    // FIXME: hide hover_title on sheet change

    // it shouldn't be necessary to check calculated here, but 
    // for some reason there was a lingering title if I deleted the 
    // cell function via an editor (cleaned correctly if I deleted the cell
    // using the delete key outside of an editor).

    if (cell?.hyperlink) {
      this.layout.ShowTitle('Link: ' + cell.hyperlink, address); //, event);
      this.hover_data.link = true;
      this.hover_data.cell = cell;
    }
    else if (this.hover_data.link) {
      this.layout.HideTitle();
      this.hover_data.cell = undefined;
    }

    // set

    this.hover_data.address = { ...address };

  }

  private HideHoverInfo() {

    this.layout.HideTitle();
    this.layout.HideTooltip();

    this.hover_data.note = this.hover_data.link = false;
    this.hover_data.cell = undefined;

    // clean up cursor, if modified

    if (this.hover_data.pointer) {
      this.layout.grid_cover.classList.remove('link-pointer');
    }
    this.hover_data.pointer = false;

  }

  /**
   * grid move handler for hit-testing various areas
   */
  private MouseMove_Grid(event: MouseEvent) {

    event.stopPropagation();
    event.preventDefault();

    if (!this.selection_renderer) {
      return;
    }

    // needed for legacy

    if (this.cell_resize.row >= 0 || this.cell_resize.column >= 0) {
      this.layout.ResizeCursor();
    }

    const offset_point = {
      x: event.offsetX,
      y: event.offsetY,
    };

    /*
    if (this.model.annotations.length) {
      this.PointToAnnotation(offset_point);
    }
    */

    // don't show hints if we are editing

    let address: ICellAddress|undefined;

    if (!this.overlay_editor?.editing) {
      address = this.layout.PointToAddress_Grid(offset_point);
      if (!this.hover_data.address 
          || this.hover_data.address.row !== address.row 
          || this.hover_data.address.column !== address.column) {
        this.HoverCell(address, event);
      }
    }

    if (this.hover_data.link && address) {
      this.hover_data.point = offset_point;

      if (!this.hover_data.handler) {
        this.hover_data.handler = requestAnimationFrame(() => {
          const link_active = 
            (this.hover_data.address 
              && this.hover_data.point
              && this.hover_data.cell
              && this.PointInTextPart(this.hover_data.address, this.hover_data.point, this.hover_data.cell));
          if (link_active !== !!this.hover_data.pointer) {
            this.hover_data.pointer = link_active;
            if (link_active) {
              this.layout.grid_cover.classList.add('link-pointer');
            }
            else {
              this.layout.grid_cover.classList.remove('link-pointer');
            }
          }
          this.hover_data.handler = undefined;
        });
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
   * special case: we don't want the previous click to be treated
   * as part of a double-click.
   */
  private ClearDoubleClick() {
    this.double_click_data.address = undefined;
  }

  /**
   * unifying double-click. pass the test address. returns true if this looks
   * like a double-click on that address. otherwise sets flags to capture the
   * next one.
   *
   * FIXME: parameterize timeout?
   */
  private IsDoubleClick(address: ICellAddress, timeout = 300) {

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
      this.double_click_data.timeout = window.setTimeout(() => {
        this.double_click_data.address = undefined;
        this.double_click_data.timeout = undefined;
      }, timeout);
    }

  }

  private PointInTextPart(address: ICellAddress, offset_point: {x: number, y: number}, cell: Cell) {

    let rectangle = this.layout.CellAddressToRectangle(address);

    if (cell.merge_area) {
      rectangle = rectangle.Combine(
        this.layout.CellAddressToRectangle(cell.merge_area.end));
    }

    const x = offset_point.x - rectangle.left;
    const y = offset_point.y - rectangle.top;

    const parts = cell.renderer_data?.text_data?.strings || [];

    for (const line of parts) {
      for (const part of line) {
        // validate?
        if (typeof part.left === 'number' 
            && typeof part.top === 'number' 
            && typeof part.width === 'number' 
            && typeof part.height === 'number' ) {

          if (x >= part.left 
              && y >= part.top
              && x <= (part.left + part.width)
              && y <= (part.top + part.height)) {
            
            return true;
          }
        }
      }
    }

    return false;

  }

  /**
   * handles mouse down events on the grid area:
   * selection (click-drag) and editing (double-click)
   */
  private MouseDown_Grid(event: MouseEvent) {

    if (event.button !== 0) {
      return;
    }

    /* removed, overlay editor does not use
    if (this.overlay_editor?.HandleMouseEvent(event)) {
      return;
    }
    */

    event.stopPropagation();
    event.preventDefault();

    const selecting_argument = this.SelectingArgument();
    
    /*
    let blocking_tooltip = false;
    if (selecting_argument) {
      if (this.autocomplete?.tooltip_visible) {
        this.autocomplete.SetBlock();
        this.autocomplete.Hide();
        blocking_tooltip = true;
      }
    }
    */

    if (!selecting_argument && this.additional_selections.length) {
      this.ClearAdditionalSelections();
    }

    if (!selecting_argument || (!this.formula_bar?.selecting && !this.external_editor?.selecting)) {

      // not sure why this breaks the formula bar handler

      this.Focus(undefined, true);
        
    }

    // unless we're selecting an argument, close the ICE

    if (this.overlay_editor?.editing && !this.overlay_editor?.selecting) {

      // commit 

      if (this.overlay_editor?.selection) {
        const value = this.overlay_editor?.edit_node.textContent || undefined;
        this.SetInferredType(this.overlay_editor.selection, value, false);
      }

      this.DismissEditor(); 
    }

    const offset_point = {
      x: event.offsetX,
      y: event.offsetY,
    };

    /*
    // FIXME: trident

    if (!selecting_argument) {
      const annotation = this.PointToAnnotation(offset_point);
      if (annotation && annotation.node) {
        this.selected_annotation = annotation;
        const cloned_event = new MouseEvent(event.type, event);
        annotation.node.dispatchEvent(cloned_event);
        return;
      }
    }
    */

    let base_address = this.layout.PointToAddress_Grid(offset_point);

    const selection = selecting_argument ? this.active_selection : this.primary_selection;

    // don't handle double-click when selecting arguments

    if (!selecting_argument) {
      if (this.IsDoubleClick(base_address)) {
        if (UA.is_mobile) {
          this.overlay_editor?.edit_node?.focus(); // FIXME: use method
        }
        this.OverlayEditCell({ target: base_address, area: new Area(base_address) }, false);
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

    // UPDATING nub let's do drag-and-insert. start with selection rules:
    // one dimension must be preserved.

    let nub_area: Area | undefined;

    if (event.shiftKey && !selection.empty) {
      const tmp = selection.target;
      this.Select(selection, new Area(base_address, selection.target, true), undefined, true);
      base_address = tmp;
    }
    else if (this.nub_select_flag) {
      base_address = selection.area.TopLeft();
      overlay_classes.push('nub-select');
      nub_area = this.active_sheet.RealArea(selection.area);
    }
    else {

      let address = base_address;
      let cell = this.active_sheet.CellData(address);
      if (cell.merge_area) {
        address = cell.merge_area.start;
        cell = this.active_sheet.CellData(cell.merge_area.start);
      }

      if (cell.hyperlink) {
        if (this.PointInTextPart(address, offset_point, cell)) {
          const link = cell.hyperlink;
           Promise.resolve().then(() => {
            this.grid_events.Publish({
              type: 'cell-event',
              data: {
                type: 'hyperlink',
                reference: link,
              }
            });
          });
          this.ClearDoubleClick();
          return;
        }
      }

      if (cell.click_function) {

        let rectangle = this.layout.CellAddressToRectangle(address);
        if (cell.merge_area) {
          rectangle = rectangle.Combine(
            this.layout.CellAddressToRectangle(cell.merge_area.end));
        }

        const result = cell.click_function.call(this, {
          cell,
          x: offset_point.x - rectangle.left,
          y: offset_point.y - rectangle.top,
          width: rectangle.width,
          height: rectangle.height,
          scale: this.layout.scale,
        });

        if (result.value) {

          // do we need to (un)translate this? I think we don't,
          // because this is the result of a click_function
          // (only checkbox, afaik) -- let's make a rule that 
          // click functions must use canonical (english) names.

          this.ExecCommand({
            key: CommandKey.SetRange,
            value: result.value,
            area: address,
          });
        }

        if (result.block_selection) {
          this.ClearDoubleClick();

          // special case
          if (!this.primary_selection.empty && 
              this.primary_selection.target.row === address.row &&
              this.primary_selection.target.column === address.column) {

            // update formula bar formula
            this.UpdateFormulaBarFormula();

          }

          return;
        }
      }

      this.Select(selection, new Area(base_address), base_address);
    }

    this.RenderSelections();

    if (selecting_argument) this.UpdateSelectedArgument(selection);

    const grid_rect =
      this.layout.CellAddressToRectangle({ row: 0, column: 0 }).Combine(
        this.layout.CellAddressToRectangle({
          row: this.active_sheet.rows - 1,
          column: this.active_sheet.columns - 1,
        })).Expand(-1, -1);

    MouseDrag(this.layout.mask, overlay_classes, (move_event: MouseEvent) => {

      // check if we are oob the grid

      const point = {
        x: move_event.offsetX - offset.x,
        y: move_event.offsetY - offset.y,
      };
      const testpoint = grid_rect.Clamp(point.x, point.y);
      const address = this.layout.PointToAddress_Grid(testpoint);

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

      let area = new Area(address, base_address, true);

      if (nub_area) {

        area = nub_area.Clone();
        area.ConsumeAddress(address);

        // if you are moving from the nub you can only move one dimension,
        // the other must be preserved. also the complete original selection
        // is preserved.

        if (area.rows !== nub_area.rows && area.columns !== nub_area.columns) {

          // we're basing this on larger cell count, which is maybe wrong --
          // should be based on larger pixel count

          const delta = {
            rows: address.row > nub_area.end.row ?
              address.row - nub_area.end.row : nub_area.start.row - address.row,
            columns: address.column > nub_area.end.column ?
              address.column - nub_area.end.column : nub_area.start.column - address.column
          };

          if (delta.rows >= delta.columns) {
            area = new Area(
              { row: area.start.row, column: nub_area.start.column },
              { row: area.end.row, column: nub_area.end.column });
          }
          else {
            area = new Area(
              { row: nub_area.start.row, column: area.start.column },
              { row: nub_area.end.row, column: area.end.column });
          }

        }

      }

      if (selection.empty || !area.Equals(selection.area)) {

        this.Select(selection, area, undefined, true);
        this.RenderSelections();

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
    }, () => {
      // console.info('end');
      this.UpdateAddressLabel();

      /*
      if (blocking_tooltip) {
        this.autocomplete?.ResetBlock();
      }
      */

      if (selecting_argument) {
        if (this.overlay_editor?.editing) {
          // ...
        }
        else if (this.external_editor_config) {

          // there are two possible cases: either an update function
          // or a full-on editor. we should probably test for both?

          if (this.external_editor?.active) {
            this.external_editor.FocusEditor();
          }
          if (this.external_editor_config.update) {
            // not necessary?
            // console.info('call update?');
          }

        }
        else if (this.formula_bar) {
          this.formula_bar.FocusEditor();
        }
      }
      else if (nub_area) {
        this.RecycleNubArea(selection.area, nub_area);
      }

    });
  }

  /**
   * FIXME: -> util library
   * @param arr 
   */
  private Transpose<T>(arr: T[][]) {
    
    const tmp: T[][] = [];
    const cols = arr.length;
    const rows = arr[0].length;

    for (let r = 0; r < rows; r++) {
      tmp[r] = [];
      for (let c = 0; c < cols; c++) {
        tmp[r][c] = arr[c][r];
      }
    }
    
    return tmp;

  }

  /**
   * when you drag from the nub, we copy the contents of the original
   * selection into the new selection, but there are some special recycling
   * rules.
   * 
   * FIXME: expand tables
   */
  private RecycleNubArea(target_area: Area, source_area: Area) {

    // nothing to do
    if (target_area.Equals(source_area)) { return; }

    // get original area cell data
    let cells: Cell[][] = [];

    for (let row = 0; row < source_area.rows; row++) {
      cells[row] = [];
      for (let column = 0; column < source_area.columns; column++) {
        const address = {
          row: source_area.start.row + row,
          column: source_area.start.column + column
        };
        cells[row][column] = this.active_sheet.CellData(address);
      }
    }

    // we don't need to (un)translate this because it's getting the value
    // from the cell, which will hold the canonical version.

    // special case: top-left is array and source_area is the whole, exact array
    if (cells[0][0].area && cells[0][0].area.Equals(source_area)) {
        this.ExecCommand({
          key: CommandKey.SetRange,
          value: cells[0][0].value,
          array: true,
          area: target_area,
        });
        return;
    }

    // special case: table. expand table. we MIGHT want to shift the 
    // totals row, if there's a totals row. not sure atm.

    if (cells[0][0].table && source_area.Equals(new Area(cells[0][0].table.area.start, cells[0][0].table.area.end))) {

      const table = cells[0][0].table;
      const sortable = table.sortable;
      const totals = table.totals_row;
      const theme = table.theme;

      // remove the table, then re-insert, preserving flags

      this.ExecCommand([{
          key: CommandKey.RemoveTable,
          table,
        },
        {
          key: CommandKey.InsertTable,
          area: target_area,
          sortable,
          totals,
          theme,
        },
      ]);

      return;
    }

    const data: CellValue[][] = [];
    let style: CellStyle[][] = [];

    let source_columns = source_area.columns;
    let target_rows = target_area.rows;
    let inverted = false;

    // rather than write this twice, for rows/columns, we will just write
    // once and for the other direction we will transpose (twice). 

    let transposed = false;

    // only one of columns or rows can be different
    if (target_area.columns === source_area.columns) {

      // check if we are going backwards
      inverted = (target_area.start.row < source_area.start.row);

    }
    else {

      source_columns = source_area.rows;
      target_rows = target_area.columns;
      inverted = (target_area.start.column < source_area.start.column);
      cells = this.Transpose(cells);
      transposed = true;

    }

    for (let row = 0; row < target_rows; row++) {
      data[row] = [];
      style[row] = [];
    }

    // do this on a column basis, so we only parse formula once

    for (let column = 0; column < source_columns; column++) {

      // check for a pattern... only if there are more than one value
      let pattern_step = 0;

      if (cells.length > 1) {

        pattern_step = 1;
        const pattern: number[] = [];
        const indices: number[] = [];

        for (let source_row = 0; source_row < cells.length; source_row++) {
          const cell = cells[source_row][column];
          if (cell.ValueIsNumber()) {
            indices.push(source_row);
            pattern.push(cell.value);
          }
        }

        if (pattern.length > 1) {
          const deltas = pattern.slice(1).map((value, index) => value - pattern[index]);
          if (deltas.every((delta) => delta === deltas[0])) {
            pattern_step = deltas[0];
          }
        }
        if (pattern.length) {
          pattern_step += (pattern[pattern.length - 1] - pattern[0]);
        }

      }

      for (let source_row = 0; source_row < cells.length; source_row++) {

        let translate: ExpressionUnit | undefined;
        const cell = cells[source_row][column];

        if (cell.ValueIsFormula()) {
          const parsed = this.parser.Parse(cell.value);
          if (parsed.expression
            && parsed.full_reference_list?.length) {
            translate = parsed.expression;
          }
        }

        let offset = 0;
        let start = source_row;
        let step = cells.length;
        let pattern_increment = 0;
        let pattern = pattern_step;

        if (inverted) {
          start = target_rows - cells.length + source_row;
          step = -cells.length;
          pattern = -pattern_step;
        }

        for (let row = start; row >= 0 && row < target_rows; row += step, offset += step, pattern_increment += pattern) {

          const render_options: Partial<RenderOptions> = {
            offset: transposed ? {
              rows: 0, columns: offset,
            } : {
              rows: offset, columns: 0,
            }
          };

          if (translate) {
            data[row][column] = '=' + this.parser.Render(translate, render_options);
          }
          else {
            const cell = cells[source_row][column];
            if (cell.ValueIsNumber()) {
              data[row][column] = cell.value + pattern_increment;
            }
            else {
              data[row][column] = cell.value; 
            }
          }
          style[row][column] = cells[source_row][column].style || {};
        }

      }

    }

    // as above, we don't need to (un)translate this because it comes
    // from existing cell data, which should be in canonical form.

    const commands: Command[] = [{
      key: CommandKey.SetRange,
      value: transposed ? this.Transpose(data) : data,
      array: false,
      area: target_area,
    }];

    if (transposed) { style = this.Transpose(style); }

    for (let row = 0; row < style.length; row++) {
      for (let column = 0; column < style[row].length; column++) {
        commands.push({
          key: CommandKey.UpdateStyle,
          area: {
            row: row + target_area.start.row, 
            column: column + target_area.start.column },
          style: style[row][column],
          delta: false,
        });
      }
    }

    this.ExecCommand(commands);

    
  }

  private UpdateSelectedArgument(selection: GridSelection) {

    // console.info("USA", selection);

    // if this is a single merged block, we want to insert it as the
    // root cell and not the range.

    const data = this.active_sheet.CellData(selection.area.start);
    const target = new Area(data.merge_area ? data.merge_area.start : selection.target);

    let label = this.model.named.MatchSelection(selection.area, target);

    if (!label) {

      label = selection.area.spreadsheet_label;
      if (data.merge_area && data.merge_area.Equals(selection.area)) {
        label = Area.CellAddressToLabel(data.merge_area.start);
      }

      if (this.external_editor_config || this.active_sheet.id !== this.editing_cell.sheet_id) {
        const name = this.active_sheet.name;

        if (QuotedSheetNameRegex.test(name)) {
          label = `'${name}'!${label}`;
        }
        else {
          label = `${name}!${label}`;
        }
      }

    }

    // the external editor should just handle normal select events
    // for now, we might update that in the future.

    if (this.overlay_editor?.editing && this.overlay_editor.selecting) {
      this.overlay_editor.InsertReference(label);
    }
    else if (this.formula_bar && this.formula_bar.selecting) {
      this.formula_bar.InsertReference(label);
    }
    else if (this.external_editor_config) {

      if (this.external_editor?.active) {
        this.external_editor.FocusEditor();
        this.external_editor.InsertReference(label);
      }

      if (this.external_editor_config.update) {
        const result = this.external_editor_config.update.call(0, label);
        if (result && Array.isArray(result)) {
          this.HighlightDependencies(
            result.filter(<T>(entry: T|undefined): entry is T => !!entry).map(reference => 
             IsCellAddress(reference) ? new Area(reference) : new Area(reference.start, reference.end)));
        }
      }
    }
    /*
    else if (this.select_argument) {
      this.grid_events.Publish({
        type: 'alternate-selection',
        selection: this.active_selection,
      });
    }
    */
  }

  /**
   * unified method to check if we are selecting an argument in the formula
   * bar editor or the in-cell editor
   *
   * FIXME: why is this not an accessor?
   */
  private SelectingArgument(): boolean {
    return (this.overlay_editor?.editing && this.overlay_editor?.selecting)
      || (this.formula_bar && this.formula_bar.selecting)
      || (!!this.external_editor_config);
      // || (this.select_argument);
  }

  /**
   * for external clients. the expected pattern is 
   *  - start overlay editor
   *  - click on "insert function"
   *  - do something
   *  - release editor (this function)
   */
  public ReleaseOverlayEditor() {
    this.editing_state = EditingState.NotEditing;
    this.DismissEditor();
    this.DelayedRender();
  }

  public RestoreOverlayEditor() {

    // ?
    this.overlay_editor?.FocusEditor();
  
  }

  /**
   * consolidated event handler for overlay, which both handles grid keys
   * and acts as the ICE, depending on state. going to be a little tricky
   * to keep track of code paths.
   * 
   * old comment:
   * 
   *   event handler for keyboard events. some we handle directly (directional
   *   navigation), some we ignore (most control-key combinations), and if you
   *   type text we start the in-cell editor and pass on the event.
   * 
   * which is largely still true, except that we can handle the ICE more 
   * directly.
   * 
   */
  private OverlayKeyDown(event: KeyboardEvent) {

    // handle ICE here... (if ICE is already open; starting ICE is later)

    // this can only be true if overlay editor is not undef, but typescript
    // doesn't seem to get that, so we will reduce to a single test with
    // somewhat clumsier code

    let editor_open = false;

    if (this.overlay_editor && this.overlay_editor.editing) {
      editor_open = true;
      const result = this.overlay_editor.HandleKeyDown(event);
      switch (result) {
        case 'handled':
          return;

        case 'discard':
          this.editing_state = EditingState.NotEditing;
          this.DismissEditor();
          this.DelayedRender();
          return;

        case 'commit':

          // FIXME: unify this (to the extent possible) w/ the other editor

          if (this.active_sheet.id !== this.editing_cell.sheet_id) {
            if (this.editing_cell.sheet_id) {
              this.ActivateSheetID(this.editing_cell.sheet_id);
            }
          }
          this.editing_state = EditingState.NotEditing;

          if (this.overlay_editor?.selection) {
            const value = this.overlay_editor?.edit_node.textContent || undefined;

            // let's support command+shift+enter on mac
            const array = (event.key === 'Enter' && (event.ctrlKey || (UA.is_mac && event.metaKey)) && event.shiftKey);

            this.SetInferredType(this.overlay_editor.selection, value, array, undefined, this.overlay_editor.edit_style);
          }
          
          this.DismissEditor();

          if (this.options.repaint_on_cell_change) {
            this.DelayedRender(false, this.overlay_editor?.selection.area || undefined);
          }

        ////

          break;
      }
    }

    // ---

    const selecting_argument = this.SelectingArgument();

    if (this.formula_bar && this.formula_bar.focused && !selecting_argument) {
      return;
    }

    if (this.selected_annotation && !selecting_argument) {
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

        case 'Backspace':
          if (event.metaKey && UA.is_mac) {
            if (!selection.empty) {
              this.DeleteSelection(selection);
            }  
          }
          break;

        case 'Delete':
        case 'Del':
          // if (event.shiftKey) // ctrl+shift+delete seems to be "delete history" in all browsers...
          {
            event.stopPropagation();
            event.preventDefault();
            for (let i = 0; i < this.model.sheets.length; i++) {
              if (this.model.sheets.list[i] === this.active_sheet) {
                this.DeleteSheet(i);
                break;
              }
            }
            return;
          }
          break;

        case '/':
          event.stopPropagation();
          event.preventDefault();
          this.SelectArrayOrTable();
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

        const applied_style: CellStyle = {};
        const selected_style: CellStyle =
          this.primary_selection.empty ? {} :
            this.active_sheet.CellData(this.primary_selection.target).style || {};

        // seems to be the best bet for xplatform

        switch (event.key.toLowerCase()) {

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
            applied_style.bold = !selected_style.bold;
            break;

          case 'i':
            applied_style.italic = !selected_style.italic;
            break;

          case 'u':
            applied_style.underline = !selected_style.underline;
            break;

          case 'a':
            // this.Select(this.primary_selection, new Area({ row: Infinity, column: Infinity }), undefined, true);
            // this.RenderSelections();
            this.SelectAll();
            break;

          // handle Ctrl+Alt+0 = select nothing

          case '0':
            if (!event.altKey) return;
            this.ClearSelection(this.primary_selection); // not clear the selection, clear selection
            this.RenderSelections();
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

      // ignore function keys 
      
      if (/^F\d+$/.test(event.key)) {
        return;
      }

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
          if (event.shiftKey) {
            this.NextSheet(event.key === 'PageUp' ? -1 : 1);
            break;
          }

          return; // FIXME

        case 'Control':
        case 'Shift':
        case 'Alt':
          // console.info('skip', event.key);
          return;

        default:

          // FIXME: we're handling F9 (optionally) in the embedded
          // component. this handler should ignore all function keys.
          // not sure there's a good global for that, though. regex?

          if (!selection.empty) {
            if (event.key !== 'Escape') {
              this.OverlayEditCell(selection, true, event);
            }
          }

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
   * array, do nothing. updated to support selecting tables as well as arrays.
   */
  private SelectArrayOrTable() {

    if (this.primary_selection.empty) {
      return;
    }

    const cell = this.active_sheet.CellData(this.primary_selection.target);

    if (!cell || (!cell.area && !cell.table && !cell.spill)) {
      return;
    }

    if (cell.area) {
      this.Select(this.primary_selection, cell.area, cell.area.start);
    }
    if (cell.spill) {
      this.Select(this.primary_selection, cell.spill, cell.spill.start);
    }
    if (cell.table) {
      const area = new Area(cell.table.area.start, cell.table.area.end);
      this.Select(this.primary_selection, area, area.start);
    }

    this.RenderSelections();

  }

  /**
   * render selections. we are wrapping this up in a method so we can
   * hide the primary selection in some cases (one case).
   */
  private RenderSelections(rerender = true) {

    const show_primary_selection = this.hide_selection ? false :
      (!this.editing_state) || (this.editing_cell.sheet_id === this.active_sheet.id);

    const data = this.primary_selection.empty ? undefined :
      this.active_sheet.CellData(this.primary_selection.target);
 
    this.layout.ShowSpillBorder(data?.spill);

    this.selection_renderer?.RenderSelections(show_primary_selection, rerender);
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

    const cells = this.active_sheet.cells;

    let cell = cells.GetCell(selection.target, false);
    if (!cell || (cell.type === ValueType.undefined && !cell.area && !cell.spill)) {
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
        test.column >= this.active_sheet.columns ||
        test.row >= this.active_sheet.rows) break;

      let has_value = false;
      if (rows) {
        for (let column = selection.area.start.column; !has_value && column <= selection.area.end.column; column++) {
          cell = cells.GetCell({ row: test.row, column }, false);
          has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area || !!cell.spill));
          if (!has_value && cell && cell.merge_area) {
            cell = cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area || !!cell.spill));
          }
        }
      }
      else {
        for (let row = selection.area.start.row; !has_value && row <= selection.area.end.row; row++) {
          cell = cells.GetCell({ row, column: test.column }, false);
          has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area || !!cell.spill));
          if (!has_value && cell && cell.merge_area) {
            cell = cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area || !!cell.spill));
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
    const area = this.active_sheet.RealArea(selection.area);
    this.ExecCommand({ key: CommandKey.Clear, area });
  }



  /**
   * sets cell value, inferring type and (possibly) inferring cell style
   * (numbers only), so that 10% and $1,000 retain styles. this should only
   * be used for direct editing -- copy and paste can copy and paste styles.
   *
   * @param address cell address
   * 
   * @param value value entered, usually this will be a string (we will try
   * to parse numbers/booleans)
   * 
   * in what case would these not be strings? (...) not sure that's a thing.
   * 
   *
   * @param exec execute commands immediately; alternatively, return the list
   * of commands. the former is the default for editor commits; the latter
   * is used for paste.
   */
  private SetInferredType(selection: GridSelection, value: string|undefined, array = false, exec = true, apply_style?: CellStyle) {

    // console.info("SIT", {apply_style});

    // validation: cannot change part of an array without changing the
    // whole array. so check the array. separately, if you are entering
    // an array, make sure that no affected cell is part of an existing
    // array.

    let target = selection.target || selection.area.start;
    const cell = this.active_sheet.CellData(target);

    if (cell.area) {
      if ((!array && cell.area.count > 1) || !selection.area || !selection.area.Equals(cell.area)) {
        this.Error(ErrorCode.array);
        return;
      }
    }
    else if (array) {

      for (const cell of this.active_sheet.cells.Iterate(selection.area, false)) {
        if (cell.area) {
          this.Error(ErrorCode.array);
          return;
        }
      }

      /*
      let existing_array = false;
      this.active_sheet.cells.Apply(selection.area, (element: Cell) => {
        if (element.area) {
          existing_array = true;
        }
      }, false);
      if (existing_array) {
        this.Error(ErrorCode.array);
        return;
      }
      */

    }

    const validation = this.active_sheet.GetValidation(target)[0];

    // only consider the first result

    if (validation && validation.error) {
      
      let list: CellValue[]|undefined;
      
      if (validation.type === 'list') {
        list = validation.list;
      }
      else if (validation.type === 'range') {
        list = this.GetValidationRange(validation.area);
      }

      if (list && list.length) {
        let match = false;
        if (value) {
          const uc = value.toUpperCase();
          for (const entry of list) {
            if (entry && entry.toString().toUpperCase() === uc) {
              value = entry.toString();
              match = true;
              break;
            }
          }
        }
        if (!match) {
          // removed in favor of error //this.layout.HighlightError(selection.target);
          // this.Error(`Invalid value (data validation)`);
          this.Error(ErrorCode.data_validation);
          return; 
        }
      }
    }

    if (cell.merge_area) target = cell.merge_area.start; // this probably can't happen at this point

    const commands: Command[] = [];

    /* 

    this was here to use the currently selected font stack, but it's broken - it 
    clears backgrounds. temp removed in advance of proper fix.

    ...because it was missing the `delta` parameter. I guess that defaults to false?

    we never specified, and it's a boolean in an interface, so it defaults to false

    */

    if (apply_style) {
      commands.push({
        key: CommandKey.UpdateStyle,
        style: apply_style,
        delta: true,
        area: array ? selection.area : selection.target,
      })
    }

    // first check functions

    const is_function = (typeof value === 'string' && value.trim()[0] === '=');

    if (is_function) {

      value = this.FixFormula(value || '');

      // so what we are doing now is copying style from a function argument,
      // if a function argument has a number format, but only if there's no
      // explicit number format already set for this cell (either in the cell
      // directly or in the row/column).

      // it might actually be preferable to override the local cell style,
      // if there is one, if the argument has a style. (...)

      // we can be a little clever here with date functions (if we want),
      // forcing a date format. this is a bit fragile though. it would be 
      // nice to coordinate this w/ calculator, but (atm) that would be
      // very circular -- we need some dependency management

      if (!this.active_sheet.HasCellStyle(target)) {
        const formula_parse_result = this.parser.Parse(value);
        if (formula_parse_result) {
          if (formula_parse_result.expression?.type === 'call') { // we know this but ts doesn't
            if (!cell.style || !cell.style.number_format || NumberFormatCache.Equals(cell.style.number_format, 'General')) {
              const func = formula_parse_result.expression.name.toLowerCase();
              let number_format: string|undefined;

              // FIXME: these should be defined on the functions themselves,
              // so we don't have to maintain a list. that also implies we
              // need the list of functions, which we don't have atm? maybe
              // through the AC instance? (...)

              switch (func) {
                case 'today':
                  number_format = 'Short Date';
                  break;
                case 'now':
                  number_format = 'Timestamp';
                  break;
              }
              if (number_format) {
                commands.push({
                  key: CommandKey.UpdateStyle,
                  area: array ? selection.area : target, style: { number_format }, delta: true
                });
              }
            }
          }
          if (formula_parse_result.dependencies) {

            // this was set up to just use the first format we found. 
            // updating to change priority -- if the first one is a 
            // percentage formula, look for another one before using
            // the percentage. this is almost always what you want.

            let found_number_format: string|undefined = undefined;

            const list = formula_parse_result.dependencies;
            for (const key of Object.keys(list.addresses)) {
              const address = list.addresses[key];
              if (this.active_sheet.HasCellStyle({ ...address })) {

                // FIXME: this should not be active_sheet

                const test = this.active_sheet.CellData({ ...address });
                if (test.style && test.style.number_format) {
                  if (!found_number_format || /%/.test(found_number_format)) {

                    // convert to a string format if it's symbolic. that
                    // is purely so we can check for a %. FIXME: I don't 
                    // like the name of this method (Translate)

                    found_number_format = NumberFormatCache.Translate(test.style.number_format);
                    if (!/%/.test(found_number_format)) {
                      break;
                    }

                  }
                }
              }
            }

            if (found_number_format) {

              const style: CellStyle = {
                number_format: NumberFormatCache.SymbolicName(found_number_format) || found_number_format,
              };

              commands.push({
                key: CommandKey.UpdateStyle,
                area: array ? selection.area : target, style, delta: true
              });
            }

          }
        }
      }
    }

    // next try to infer the number format, with hints as to format

    let expression = this.parser.Parse(value || '').expression;

    if (expression?.type === 'group' && expression.elements.length === 1
        && expression.elements[0].type === 'complex') {
      
      // invert, following spreadsheet convention?. I don't like this 
      // and we should not do it, but I'm not sure what the alternative
      // would be -- remove the parens? 

      /*
      expression = expression.elements[0] as UnitComplex;
      expression.real = -expression.real;
      expression.imaginary = -expression.imaginary;
      */

      expression = expression.elements[0];

    }

    let parse_result: ParseResult2|undefined;

    if (expression?.type === 'complex') {
      parse_result = {
        type: ValueType.complex,
        value: { 
          real: expression.real, 
          imaginary: expression.imaginary 
        },
      };
    }
    else if (expression?.type === 'literal' && typeof expression.value === 'boolean') {
      parse_result = {
        type: ValueType.boolean,
        value: expression.value,
      };
    }
    else {
      parse_result = ValueParser.TryParse(value);
    }

    if (!is_function && parse_result.type === ValueType.number) {

      // const text = value.toString();

      let number_format = '';
      const hints: Hints = parse_result.hints || {};

      // be stricter about number format. don't implicitly /change/
      // the number format (you can /set/, but don't /change/). 

      // FIXME: in this case, if we're setting a number format from
      // nothing, we could be a little smarter about setting the 
      // decimal places.

      if (!cell.style || !cell.style.number_format || NumberFormatCache.Equals(cell.style.number_format, 'General')) {

        if (hints.Date) {
          number_format = 'Short Date';
        }
        else if (hints.Exponential) {
          number_format = 'Exponential';
        }
        else if (hints.Percent) {
          number_format = 'Percent';
        }
        else if (hints.Currency) {
          number_format = 'Currency';
        }
        else if (hints.Grouping || hints.Parens) {
          number_format = 'Accounting';
        }

      }

      if (number_format) {
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

    // this is user-entered data, so we _do_ need to (un)translate it
    // before calling SetRange.

    commands.push({
      key: CommandKey.SetRange,
      area: array ? selection.area : target,
      array,
      value: is_function ? this.model.UntranslateFunction(value || '') : parse_result.value,
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

    // const original = formula;

    formula = formula.replace(/^\s+/, '');

    let q = false; // double-quote
    let a = false; // single-quote (apostrophe)
    let paren = 0;
    let escape = false;

    // this breaks on escaped quotes in strings
    // also there's an escape character, but never unset? (...)

    const len = formula.length;
    for (let i = 0; i < len; i++) {
      const char = formula[i];
      if (!escape) {
        switch (char) {
          case '"':
            if (q) {
              if (formula[i+1] === '"') {
                i++; 
              }
              else {
                q = false;
              }
            }
            else if (!a) {
              q = true;
            }
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

    formula = this.NormalizeFormula(formula);

    return formula;
  }

  /**
   * normalize addresses (UC), function names (-> canonical) and
   * defined names (UC, for now)
   */
  private NormalizeFormula(formula: string) {
    const parse_result = this.parser.Parse(formula);
    
    if (parse_result.error) {
      console.warn(parse_result.error);
    }

    if (parse_result && parse_result.expression) {
      this.parser.Walk(parse_result.expression, (unit) => {
        switch (unit.type) {

          case 'call':
            unit.name = this.autocomplete_matcher.NormalizeIdentifier(unit.name) || unit.name;
            break;

          case 'identifier':
            {
              const named_range = this.model.GetName(unit.name, this.active_sheet.id); // FIXME: is this the correct sheet ref?
              if (named_range?.type === 'range') {
                unit.name = unit.name.toUpperCase();
              }
            }
            break;

        }
        return true;
      });
      formula = '=' + this.parser.Render(parse_result.expression, { missing: '' });
    }
    return formula;
  }

  /**
   * dismisses the in-cell editor and returns to normal behavior.
   * removes any highlighted selections (arguments).
   */
  private DismissEditor() {

    // console.info("dismiss editor", this.overlay_editor?.active_cell, this.overlay_editor?.selection);

    if (this.overlay_editor?.active_cell) {
      this.overlay_editor.active_cell.editing = false;
      this.overlay_editor.active_cell.render_clean = [];
      this.DelayedRender(undefined, this.overlay_editor.selection.area);
    }

    this.editing_state = EditingState.NotEditing;

    this.Focus(); // not necessary [NECESSARY FOR MOBILE]

    this.overlay_editor?.CloseEditor();

    this.ClearAdditionalSelections();
    this.ClearSelection(this.active_selection);

  }

  /**
   * this prepares the cell value for _editing_ -- it's not the displayed
   * value, it's how we want the value to be displayed in the editor and 
   * formula bar. 
   * 
   * NOTE: is this the spot to do translation -> local language? (...)
   * 
   */
  private NormalizeCellValue(cell: Cell) {

    let cell_value = cell.value;

    if (cell.ValueIsNumber() && cell.style && cell.style.number_format) {

      const format = NumberFormatCache.Get(cell.style.number_format);

      if (format.date_format) {
        const date = LotusDate(cell.value);
        const number_format = (date.getUTCHours() || date.getUTCMinutes() || date.getUTCSeconds()) ?
          'Timestamp' : 'Short Date';

        cell_value = NumberFormatCache.Get(number_format).Format(cell_value);
      }
      else if (/(?:%|percent)/i.test(cell.style.number_format)) {

        let precision = 0;

        const match = cell.value.toString().match(/\.(.*?)$/);
        if (match && match[1]) {
          precision = Math.max(0, match[1].length - 2); // because we are *100
        }

        cell_value = (cell.value * 100).toFixed(precision) + '%';
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
    else if (cell.ValueIsBoolean()) {

      // TRANSLATION: FIXME/CENTRALIZE
      return cell.value ? (this.model.language_model?.boolean_true || 'TRUE') : (this.model.language_model?.boolean_false || 'FALSE');

    }
    else if (cell.ValueIsNumber()) { // no style: I think this is no longer possible
      if (cell_value && Localization.decimal_separator === ',') {
        cell_value = cell.value.toString().replace(/\./, ',');
      }
    }
    else if (cell.ValueIsComplex()) {

      if (cell.value.imaginary) {
        if (cell.value.real) {
          // both parts: render with spacing
          cell_value = `${cell.value.real.toString()}${cell.value.imaginary < 0 ? ' - ' : ' + '}${
            (cell.value.imaginary === 1 || cell.value.imaginary === -1) ? '' : Math.abs(cell.value.imaginary).toString()}i`;
        }
        else {
          // imaginary only, leave sign
          if (cell.value.imaginary === 1) {
            cell_value = 'i';
          }
          else if (cell.value.imaginary === -1) {
            cell_value = '-i';
          }
          else {
            cell_value = cell.value.imaginary.toString() + 'i';
          }
        }
      }
      else {
        // real only (or 0)
        cell_value = cell.value.real.toString();
      }

      if (Localization.decimal_separator === ',') {
        cell_value = cell_value.replace(/\./, ',');
      }

    }
    else if (cell.ValueIsFormula()){ 

      // this is where we _render_ translation. so names in function
      // calls shoule be translated before returning.

      cell_value = this.model.TranslateFunction(cell.value);

    }

    return cell_value;

  }

  /**
   * this is used to handle a trailing % sign when entering a new value.
   * we need to decide if the user is typing a number, in which case we
   * retain the %; or something else, like a formula or a string, in which
   * case we want to drop the %.
   * 
   * FIXME: move to utils lib
   */
  private IsNumeric(c: number) {

    // anything else?

    return (c >= 0x30 && c <= 0x39) // 0-9
      || (c === this.decimal_separator_code) // cached
      || (c === 0x2d) // -
      || (c === 0x2b) // + // this one is kind of a stretch...
      ;

  }

  /**
   * start the ICE, using the new overlay editor 
   * 
   * old comment:
   * 
   * starts the in-cell editor at the given sheet address. this method doesn't
   * handle scroll-into-view, do that first if necessary.
   *
   * @param address the cell address. we'll check for merge head before editing.
   * @param flush flush contents before editing -- default for typing, !default
   * for double-click
   * @param event if this is triggered by typing, we want to pass the key
   * event directly to the editor (actually we'll pass a synthetic copy)
   * 
   * @param selection 
   * @param flush 
   * @param event 
   */
  private OverlayEditCell(selection: GridSelection, flush = true, event?: KeyboardEvent) {

    if (!this.options.in_cell_editor) {
      return; // no ICE
    }
    
    let address = selection.target || selection.area.start;
    let cell = this.active_sheet.CellData(address);
    let rect: Rectangle;

    // hide note if visible
    this.HideHoverInfo();

    // merged cell, make sure we get/set value from the head
    // also get full rect for the editor

    if (cell.merge_area) {
      rect = this.layout.OffsetCellAddressToRectangle(cell.merge_area.start).Combine(
        this.layout.OffsetCellAddressToRectangle(cell.merge_area.end));
      address = cell.merge_area.start;
      cell = this.active_sheet.CellData(address);
    }
    else {
      rect = this.layout.OffsetCellAddressToRectangle(address);
    }

    // locked: can't edit! note we have to do the merge check first

    if (cell.style?.locked) { 
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

    let edit_state: CellStyle|undefined;

    if (typeof cell_value === 'undefined' && !cell.style?.font_face) {
      edit_state = this.edit_state;
    }

    // if called from a keypress, we will overwrite whatever is in there so we
    // can just leave text as is -- except for handling %, which needs to get 
    // injected.

    if (flush) {

      if ((cell.type === ValueType.number || cell.rendered_type === ValueType.number) && cell.style &&
        cell.style.number_format && /(?:%|percent)/i.test(cell.style.number_format) &&
        (!event || this.IsNumeric(event.key.charCodeAt(0)))) {

        // UPDATE: don't do this if the user types '=', because they're typing a function.
        // actually we could probably extend that to anything that doesn't look like a number...

        cell_value = '%';
      }
      else {
        cell_value = undefined;
      }
    }
    else {
      cell_value = this.NormalizeCellValue(cell);
    }

    // cell rect, offset for headers. FIXME: do we always offset for headers?
    // if so, that should go in the method.

    // this.overlay_editor?.Edit(selection, rect.Shift(-1, -1).Expand(1, 1), cell, cell_value, event);
    this.overlay_editor?.Edit(selection, rect.Expand(-1, -1), cell, cell_value, event, edit_state);

    cell.editing = true;
    cell.render_clean = [];

    this.DelayedRender(false, selection.area);

  }

  private BoundAddressArea(address: ICellAddress, area: Area) {

    // order of overflow is different for vertical/horizontal movement.
    // also we don't want to double-step. so there are four separate,
    // double tests... it seems redundant.

    // not possible to do modulo arithmetic? (need carry/underflow?)

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
        if (!this.layout.RowHeight(++start)) i--;
      }
    }
    else if (step < 0) {
      for (let i = 0; i > step; i--) {
        if (--start >= 0 && !this.layout.RowHeight(start)) i++;
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
        if (!this.layout.ColumnWidth(++start)) i--;
      }
    }
    else if (step < 0) {
      for (let i = 0; i > step; i--) {
        if (--start >= 0 && !this.layout.ColumnWidth(start)) i++;
      }
    }
    return start;
  }

  /** 
   * if the address is outside of current extent, expand 
   */
  private EnsureAddress(address: ICellAddress, step = 8, toll_layout = false): boolean {

    let expanded = false;

    if (this.options.expand) {

      // what's the optimal order of doing this, given we are expanding 
      // a 2-dimensional array? (...)

      if (address.row !== Infinity && address.row >= this.active_sheet.rows) {
        let row = this.active_sheet.rows;
        while (address.row >= row) { row += step; }
        this.active_sheet.cells.EnsureRow(row);
        expanded = true;
      }

      if (address.column !== Infinity && address.column >= this.active_sheet.columns) {
        let column = this.active_sheet.columns;
        while (address.column >= column) { column += step; }
        this.active_sheet.cells.EnsureColumn(column);
        expanded = true;
      }

      if (expanded && !toll_layout) {
        this.layout.UpdateTiles();
        this.layout.UpdateContentsSize();
        this.Repaint(true, true);
      }

    }

    return expanded;

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
    // let expanded = false;

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

      const target_cell = this.active_sheet.CellData(selection.target);

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

        const area = this.active_sheet.RealArea(selection.area);
        const address = selection.target;

        // two things happen when merged. (1) if the current target is a
        // merge cell, then we need to step to the edge of the merge cell
        // (only matters if delta is positive):

        // (2) if the next cell is merged, then we either step onto the head
        // or, if we would step onto a subcell, pass over it entirely.

        //while (true) {
        for (; ;) {

          // step

          address.row = this.StepVisibleRows(address.row, delta.rows);
          address.column = this.StepVisibleColumns(address.column, delta.columns);

          // bound

          this.BoundAddressArea(address, area);

          // merged? if we're not on the head, keep stepping (FIXME: step over
          // for efficiency, don't waste multiple checks)

          const check_cell = this.active_sheet.CellData(address);
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

        if (!this.options.expand) {
          for (const addr of [start, end, scroll_target]) {
            if (addr.row !== Infinity) {
              addr.row = Math.max(0, Math.min(addr.row, this.active_sheet.rows - 1));
            }
            if (addr.column !== Infinity) {
              addr.column = Math.max(0, Math.min(addr.column, this.active_sheet.columns - 1));
            }
          }

          this.ScrollIntoView(scroll_target);
          this.Select(selection, new Area(start, end), undefined, true);


        }
        else {

          for (const addr of [start, end, scroll_target]) {
            if (addr.row !== Infinity) {
              addr.row = Math.max(0, addr.row);
            }
            if (addr.column !== Infinity) {
              addr.column = Math.max(0, addr.column);
            }
          }

          /*
          if (end.row !== Infinity && end.row >= this.active_sheet.rows && this.options.expand) {
            let row = this.active_sheet.rows;
            while (end.row >= row) { row += 8; }
            this.active_sheet.cells.EnsureRow(row);
            expanded = true;
          }
          if (end.column !== Infinity && end.column >= this.active_sheet.columns && this.options.expand) {
            let column = this.active_sheet.columns;
            while (end.column >= column) { column += 8; }
            this.active_sheet.cells.EnsureColumn(column);
            expanded = true;
          }

          if (expanded) {
            this.layout.UpdateTiles();
            this.layout.UpdateContentsSize();
            this.Repaint(true, true);
            render = true;
          }
          */

          if (this.EnsureAddress(end)) { render = true; }

          this.ScrollIntoView(scroll_target);
          this.Select(selection, new Area(start, end), undefined, true);

        }


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

        if (this.EnsureAddress(address)) { render = true; }


        this.Select(selection, new Area({
          row: Math.min(
            Math.max(0, address.row),
            this.active_sheet.rows - 1),
          column: Math.min(
            Math.max(0, address.column),
            this.active_sheet.columns - 1),
        }));

        // we're calling renderselections early, to avoid jitter when
        // scrolling. FIXME: create a method to just update the given
        // selection, to minimize work here (maybe that's over-optimizing?)

        // at the least, we could flag that we've already done this so
        // it doesn't get called again on the next render

        this.RenderSelections();

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

    // it's slow to make big selections, probably because they are 
    // giant SVGs; so we should cache. as a first try we can cache the
    // depenendency list... the dumbest way possible...

    //const json = JSON.stringify(dependencies);
    //if (json === this.selection_renderer.cached_additional_selections) {
    //  return;
    //}
    //this.selection_renderer.cached_additional_selections = json;

    // FIXME: cache, in case we parse the same string repeatedly?
    // this.ClearAdditionalSelections(); // flush

    // ok, we're no longer clearing, so we need to do some management...
    // start by dropping any excess [actually we need to do this at the
    // end to account for dupes]

    // this.additional_selections.splice(dependencies.length);

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

    let index = 0;
    step: for (let area of dependencies) {
      if ((area.start.row === Infinity || area.start.row < this.active_sheet.rows) &&
        (area.start.column === Infinity || area.start.column < this.active_sheet.columns)) {

          if (area.start.spill && area.end.row === area.start.row && area.end.column === area.start.column) {
            const sheet = this.model.sheets.Find(area.start.sheet_id || -1);
            const cell = sheet?.CellData(area.start);
            if (cell?.spill && cell.spill.start.row === area.start.row && cell.spill.start.column === area.start.column) {
              area.ConsumeArea(cell.spill);
            }
          }

          area = this.active_sheet.RealArea(area);
          const label = area.spreadsheet_label;

          if (this.additional_selections[index] 
              && this.additional_selections[index].area.spreadsheet_label === label) {
            // console.info('leaving selection @', index);
            index++;
          }
          else {
            // this.AddAdditionalSelection(area.start, area);

            // check if there is a _prior_ add'l selection that matches
            for (let i = 0; i < index; i++) {
              if (this.additional_selections[i].area.spreadsheet_label === label
                  && this.additional_selections[i].area.start.sheet_id === area.start.sheet_id) {
                // console.info('skipping dupe');
                continue step;
              }
            }

            // ok, add
            this.additional_selections[index++] = { target: area.start, area };

          }

      } 
    }

    this.additional_selections.splice(index); // excess

    if (render) this.RenderSelections(false); // allow cache!

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

  private HideGridSelection() {
    this.UpdateAddressLabel(undefined, '');

    const formula = (this.selected_annotation && this.selected_annotation.data.formula) ?
      this.selected_annotation.data.formula : '';

    this.UpdateFormulaBarFormula(formula);
    this.layout.ShowSelections(false);

  }

  private ShowGridSelection() {
    this.UpdateAddressLabel();
    this.UpdateFormulaBarFormula();
    this.layout.ShowSelections(true);
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

      let real_area = this.active_sheet.RealArea(area);
      if (!target) target = real_area.start;

      // there has to be a better way to do this... 

      // the operation here is composing the selection by adding all merge
      // areas. the issue is that when you do that, you might be adding other
      // cells that are not in the merge area (because the selection has to
      // be a rectangle) and one of those new cells might itself be merged.
      // so we need to iterate. there's a lot of duplication here, though.

      // eslint-disable-next-line no-constant-condition
      recheck_loop: while (true) {
        for (const cell of this.active_sheet.cells.Iterate(real_area, false)) {
          if (cell.merge_area && !real_area.ContainsArea(cell.merge_area)) {
            area.ConsumeArea(cell.merge_area);
            real_area = this.active_sheet.RealArea(area);
            continue recheck_loop;
          }
        }
        break;
      }

      /*

      let recheck = true;

      while (recheck) {
        recheck = false;
        this.active_sheet.cells.Apply(real_area, (cell: Cell) => {
          if (cell.merge_area && !real_area.ContainsArea(cell.merge_area)) {
            area.ConsumeArea(cell.merge_area);
            real_area = this.active_sheet.RealArea(area);
            recheck = true;
          }
        });
      }
      */

      selection.area = new Area({ ...area.start, sheet_id: this.active_sheet.id }, area.end);
      if (target) {
        selection.target = { ...target, sheet_id: this.active_sheet.id };
      }
      selection.empty = false;

      const cell_data= this.active_sheet.CellData(selection.target);
      let text = '';

      if (cell_data.formatted) {
        if (typeof cell_data.formatted === 'string') {
          text = cell_data.formatted;
        }
        else {
          text = cell_data.formatted.map(value =>
            (value.flag === TextPartFlag.hidden || value.flag === TextPartFlag.formatting) ? '' : value.text).join('');
        }
      }

      this.overlay_editor?.UpdateCaption(text);
      
    }
    else {
      selection.empty = true;
    }

    // FIXME: this should clone

    if (selection === this.primary_selection) {

      // removed for overlay; return for IE?
      // actually no, not for IE, because the mock function skips IE anyway;
      // we left it in for safari (??)

      // this.layout.MockSelection(); 

      // FIXME: drop support for old edge
      if (UA.is_edge) { this.Focus(); }

      this.grid_events.Publish({
        type: 'selection',
        selection: this.primary_selection,
      });

      this.UpdateAddressLabel();
      this.UpdateFormulaBarFormula();

      if (this.formula_bar) {
        this.formula_bar.target_address = {...this.primary_selection.target};
      }

      if (this.options.stats) {
        this.UpdateStats();
      }

    }

  }

  /**
   *
   */
  private UpdateFormulaBarFormula(override?: string) {

    this.layout.HideDropdownCaret();

    // NOTE: this means we won't set validation carets... that needs
    // to be handled separately (FIXME)

    // if (!this.formula_bar) { return; }

    if (override) {
      if (this.formula_bar) {
        this.formula_bar.shadow = false;
        this.formula_bar.formula = override;
      }
      return;
    }

    if (this.primary_selection.empty) {
      if (this.formula_bar) {
        this.formula_bar.shadow = false;
        this.formula_bar.formula = '';
      }
    }
    else {
      let data = this.active_sheet.CellData(this.primary_selection.target);

      // optimally we would do this check prior to this call, but
      // it's the uncommon case... not sure how important that is

      const head = data.merge_area || data.area || data.spill;
      let shadow = false;
      
      if (head) {
        if (head.start.column !== this.primary_selection.target.column
          || head.start.row !== this.primary_selection.target.row) {
          data = this.active_sheet.CellData(head.start);
          if (data.spill) { shadow = true; }
        }
      }

      if (this.formula_bar) {
        this.formula_bar.editable = !data.style?.locked;
      }

      const value = this.NormalizeCellValue(data);

      // this isn't necessarily the best place for this, except that
      // (1) we already have cell data; (2) the calls would generally
      // sync up, so it would be a separate function but called at the
      // same time.

      // less true now that they're maintained separately
      
      const validation = this.active_sheet.GetValidation(this.primary_selection.target)[0];

      if (validation && !data.style?.locked) {
        
        let list: CellValue[] | undefined;
        
        if (validation.type === 'list') {
          list = validation.list;
        }
        else if (validation.type === 'range') {
          list = this.GetValidationRange(validation.area);
        }

        if (list && list.length) {
          this.layout.ShowDropdownCaret(
            (data.merge_area || new Area(this.primary_selection.target)), 
            list, data.value);
        }

      }

      if (this.formula_bar) {

        this.formula_bar.shadow = shadow;

        if (data.area) {
          this.formula_bar.formula = '{' + (value || '') + '}';
        }
        else {
          this.formula_bar.formula = (value ?? '').toString();
        }

      }

    }

  }

  /**
   * splitting the stats update call and the rendering method, 
   * if we want to make a pluggable stats method.
   * 
   * default will show count/sum/average of numbers, either real 
   * or complex.
   */
  private RenderStats(values: CellValue|CellValue[][]): StatsEntry[] {

    // we don't handle single values

    if (!Array.isArray(values)) {
      return [];
    }

    // we count numbers, in addition to accumulating, because
    // it's possible for numbers to sum up to 0. therefore you
    // can't switch on !sum to check if you have any numbers.
    // also, "count" counts things that are non-empty but not
    // numbers, so you need to count numbers for averages.

    // we could possibly accept a function here to display different
    // kind of stats (looking at you, 🧠🧠🍪). call that a TODO.

    // ...complex...

    let count = 0;
    let numbers = 0;

    const sum: Complex = { real: 0, imaginary: 0 };

    for (const row of values) {
      for (const cell of row) {
        
        if (typeof cell === 'number') {
          sum.real += cell;
          numbers++;
        }
        else if (IsComplex(cell)) {
          sum.real += cell.real;
          sum.imaginary += cell.imaginary;
          numbers++;
        }

        // count, not else if

        if (typeof cell !== 'undefined') {
          count++;
        }

      }
    }

    const SelectFormat = (value: number) => {
      const log = Math.floor(Math.log10(value));
      if (log < -6 || log > 10) {
        return NumberFormatCache.Get('Exponential');
      }
      if (log <= -1) {
        return NumberFormatCache.Get('General');
      }
      return NumberFormatCache.Get('Number');
    };

    if (count > 1) {
      if (numbers > 0) {
        const general = NumberFormatCache.Get('General')
        if (sum.imaginary) {
          const average: Complex = { real: sum.real / numbers, imaginary: sum.imaginary / numbers };

          return [
            { label: 'Count', value: count.toString() }, 
            { label: 'Sum', value: NumberFormat.FormatPartsAsText(general.FormatComplex(sum)) },
            { label: 'Average', value: NumberFormat.FormatPartsAsText(general.FormatComplex(average)) },
          ];

        }
        else {
          return [
            { label: 'Count', value: count.toString() }, 
            { label: 'Sum', value: (SelectFormat(sum.real)).Format(sum.real) },
            { label: 'Average', value: (SelectFormat(sum.real/numbers)).Format(sum.real/numbers) },
          ];
        }
      }
      else {
        return [{ label: 'Count', value: count.toString() }] // `Count: ${count}`;
      }
    }

    return [];
  }

  public UpdateStats() {

    if (this.tab_bar) {
      let data: StatsEntry[] = [];

      // why does this get tested on every call? just set the function

      if (typeof this.options.stats === 'function') {
        if (!this.primary_selection.empty) {
          data = this.options.stats.call(undefined, this.GetRange(this.primary_selection.area));
        }
      }
      else {
        if (!this.primary_selection.empty && this.primary_selection.area.count > 1) {
          data = this.RenderStats(this.GetRange(this.primary_selection.area));
        }
      }
      
      this.tab_bar.stats_data = data;
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

      const data = this.active_sheet.CellData(this.primary_selection.target);
      const target = new Area(data.merge_area ? data.merge_area.start : selection.target);

      this.formula_bar.label = 
        this.model.named.MatchSelection(selection.area, target)
          || Area.CellAddressToLabel(target.start);

    }

  }

  private OnDropdownSelect(value: CellValue) {

    if (typeof value !== 'undefined') {

      // FIXME: complex? (...)

      const result = ValueParser.TryParse(value.toString());
      if (result.type === ValueType.number) {
        value = result.value;
      }
    }

    const data = this.active_sheet.CellData(this.primary_selection.target);
    const area = data.merge_area ? data.merge_area.start : this.primary_selection.target;

    // I don't think we need to translate this -- you can't set a function
    // using a dropdown (can you? ...)

    this.ExecCommand({
      key: CommandKey.SetRange,
      area,
      value,
    });
    this.UpdateFormulaBarFormula();
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
    // this.container.addEventListener('keydown', (event) => this.KeyDown(event));
    this.overlay_editor?.edit_node.addEventListener('keydown', (event) => this.OverlayKeyDown(event));

    // select all?
    this.layout.corner.addEventListener('dblclick', () => {
      this.SelectAll();
    });

    // this is for resize: we want to repaint on scale events. we should
    // probably not do this synchronously, because scale changes are usually
    // repeated.

    window.addEventListener('resize', () => {
      const update = this.layout.UpdateDPR();
      if (update) {
        this.QueueLayoutUpdate();
        this.Repaint(true, true, true);
      }
    });

  }

  private HandleCopy(event: ClipboardEvent) {

    // console.info('handle copy', event, this.primary_selection);

    event.stopPropagation();
    event.preventDefault();

    if (this.primary_selection.empty) {
      if (event.clipboardData) {
        event.clipboardData.clearData();
      }
      if (this.selected_annotation) {
        if (event.clipboardData) {

          const composite = JSON.stringify({
            data: this.selected_annotation,
            source: this.active_sheet.id,
          });
          event.clipboardData.setData('text/x-treb-annotation', composite);

          const view = this.selected_annotation.view[this.view_index];

          if (view && view.node) {
            // this.selected_annotation.node.innerHTML;
            const node = view.node.firstChild?.firstChild;

            if (node) {

              // trying to put svg on the clipboard here, which works, but
              // is basically useless. the underlying method is good, though,
              // clients could use it for better UX in saving images

              const html = (SerializeHTML(node as Element) as HTMLElement).outerHTML;

              event.clipboardData.setData('text/uri-list', `data:image/svg+xml;base64,` + btoa(html)); // <-- does this work? seems no
              event.clipboardData.setData('text/html', html); // <-- does this work? (also no)
              event.clipboardData.setData('text/plain', html);
              
            }
          }
        }
      }
    }
    else {

      const area = this.active_sheet.RealArea(this.primary_selection.area);

      const column_width: number[] = [];
      const row_height: number[] = [];

      if (this.primary_selection.area.entire_column) {
        for (let c = area.start.column; c <= area.end.column; c++) {
          const width = this.active_sheet.GetColumnWidth(c);
          if (width !== this.active_sheet.default_column_width) {
            column_width[c - area.start.column] = width;
          }
        }
      }
      if (this.primary_selection.area.entire_row) {
        for (let r = area.start.row; r <= area.end.row; r++) {
          const height = this.active_sheet.GetRowHeight(r);
          if (height !== this.active_sheet.default_row_height) {
            row_height[r - area.start.row] = height;
          }
        }
      }

      const columns = area.columns;
      const rows = area.rows;

      // const cells = this.active_sheet.cells;
      const tsv_data: CellValue[][] = [];
      const treb_data: ClipboardCellData[] = [];

      // NOTE: we don't want to preserve table information when 
      // copying/cutting. that should happen naturally here, just
      // wanted to note it.

      // do this in row order, for tsv. we have to transpose one of them.

      for (let row = 0; row < rows; row++) {

        // FIXME: we don't want function errors in the tsv output...
        const tsv_row: CellValue[] = [];

        for (let column = 0; column < columns; column++) {
          const address = { row: area.start.row + row, column: area.start.column + column };
          const cell = this.active_sheet.CellData(address);

          // NOTE: this now has to account for "text parts", which
          // are returned from the format lib. we need to render them,
          // accounting for a few differences (no expanding, for example,
          // and I guess we should drop hidden characters).

          // now that I think about it, why would we use the formatted value
          // here instead of the calculated value? should use the latter...

          // tsv_row.push(cell.formatted);

          let text_value = '';
          if (cell.calculated !== undefined) {
            if (cell.calculated_type === ValueType.complex) {
              text_value = ComplexToString(cell.calculated as Complex);
            }
            else {
              text_value = cell.calculated.toString();
            }
          }
          else {
            if (cell.type === ValueType.complex) {
              text_value = ComplexToString(cell.value as Complex);
            }
            else {
              text_value = cell.value?.toString() || '';
            }
          }

          // tsv_row.push(typeof cell.calculated === 'undefined' ? cell.value : cell.calculated);
          tsv_row.push(text_value);

          const data_entry: ClipboardCellData = {
            address,
            data: cell.value,
            type: cell.type,
            style: this.active_sheet.GetCopyStyle(address), // excludes row pattern
          };

          if (cell.area &&
            cell.area.start.row === address.row &&
            cell.area.start.column === address.column) {
            data_entry.array = {
              rows: cell.area.rows, columns: cell.area.columns
            };
          }
          treb_data.push(JSON.parse(JSON.stringify(data_entry)));
        }
        tsv_data.push(tsv_row);
      }

      const tsv = tsv_data.map((row) => row.join('\t')).join('\n');
      if (event.clipboardData) {
        event.clipboardData.clearData();
        event.clipboardData.setData('text/plain', tsv);
        event.clipboardData.setData('text/x-treb', JSON.stringify({ 
          source: area, 
          data: treb_data,
          column_width, 
          row_height,
        }));
      }
    }

  }

  private HandleCut(event: ClipboardEvent) {
    event.stopPropagation();
    event.preventDefault();

    this.HandleCopy(event);

    if (!this.primary_selection.empty) {
      const area = this.active_sheet.RealArea(this.primary_selection.area);
      // this.model.sheet.ClearArea(area);
      this.ExecCommand({ key: CommandKey.Clear, area });
    }
    else if (this.selected_annotation) {
      this.RemoveAnnotation(this.selected_annotation);
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
    if (this.overlay_editor?.editing) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    if (!event.clipboardData) return;

    const annotation_data = event.clipboardData.getData('text/x-treb-annotation');
    if (annotation_data) {
      try {
        const composite = JSON.parse(annotation_data);
        if (composite.source && composite.source !== this.active_sheet.id) {
          if (composite.data && composite.data.formula) {
            let name = '';
            const sheet = this.model.sheets.Find(composite.source as number);
            if (sheet) {
              name = sheet.name;
            }

            /*
            for (const sheet of this.model.sheets.list) {
              if (sheet.id === composite.source) {
                name = sheet.name;
                break;
              }
            }
            */

            if (name) {
              const parse_result = this.parser.Parse(composite.data.formula);
              if (parse_result.expression) {
                this.parser.Walk(parse_result.expression, (unit) => {
                  if (unit.type === 'range') {
                    if (!unit.start.sheet_id && !unit.start.sheet) {
                      unit.start.sheet = name;
                    }
                    return false; // don't recurse to individual addresses
                  }
                  else if (unit.type === 'address') {
                    if (!unit.sheet_id && !unit.sheet) {
                      unit.sheet = name;
                    }
                  }
                  return true;
                });
                composite.data.formula = '=' + this.parser.Render(parse_result.expression, { missing: '' });
              }
            }
          }
        }

        this.CreateAnnotation(composite.data, undefined, true, true, undefined, true);
        /*
        const annotation = this.CreateAnnotation(composite.data, true, true);
        const view = annotation.view[this.view_index];
        if (view && view.node) {
          const node = view.node;
          setTimeout(() => {
            node.focus();
          }, 1);
        }
        */
      }
      catch (e) {
        console.error(e);
      }
      return;
    }

    if (this.primary_selection.empty) {
      return;
    }

    const area = this.active_sheet.RealArea(this.primary_selection.area);
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

        const object_data: {
          source: Area, 
          data: ClipboardCellData[],
          column_width?: number[], 
          row_height?: number[],
        } = JSON.parse(treb_data);

        const source_area = new Area(object_data.source.start, object_data.source.end);

        // recycle...
        const paste_areas = this.RecyclePasteAreas(source_area, area);

        // resize if we're forcing a shape
        if (paste_areas.length === 1) {
          area.Resize(paste_areas[0].rows, paste_areas[0].columns);
        }

        if (!this.ValidatePasteAreas(paste_areas)) {
          this.Error(ErrorCode.invalid_area_for_paste);
          return;
        }

        // paste in, offsetting for the paste area. this part loops
        // when recycling, so that the offsets are corrected

        // UPDATE: use commands...

        // keep track of arrays we paste; we don't want to set value
        // on cells that are within those arrays.

        const arrays: Area[] = [];

        // const paste_area = new Area(area.start, area.end);
        for (const paste_area of paste_areas) {

          this.active_sheet.cells.EnsureCell(paste_area.end);

          // FIXME: command
          // this.model.sheet.ClearArea(paste_area, true);
          commands.push({ key: CommandKey.Clear, area: paste_area });

          const offsets = {
            rows: paste_area.start.row - source_area.start.row,
            columns: paste_area.start.column - source_area.start.column,
          };

          object_data.data.forEach((cell_info: ClipboardCellData) => {
            let data = cell_info.data;

            const target_address = {
              row: cell_info.address.row - source_area.start.row + paste_area.start.row,
              column: cell_info.address.column - source_area.start.column + paste_area.start.column,
            };

            if (cell_info.type === ValueType.formula) {
              const parse_result = this.parser.Parse(data as string);
              if (parse_result.expression) {
                data = '=' + this.parser.Render(parse_result.expression, {
                  offset: offsets, missing: '' });
              }
            }

            if (cell_info.array) {

              const target_array = {
                start: {
                  ...target_address,
                }, end: {
                  row: target_address.row + cell_info.array.rows - 1,
                  column: target_address.column + cell_info.array.columns - 1,
                },
              };

              // we do not need to translate here. the data should be 
              // in canonical form on the clipboard.

              const command: SetRangeCommand = {
                key: CommandKey.SetRange,
                value: data,
                array: true,
                area: target_array,
              };

              arrays.push(new Area(target_array.start, target_array.end));

              commands.push(command);

            }
            else {

              let skip = false;
              for (const array of arrays) {
                if (array.Contains(target_address)) {
                  skip = true;
                  break;
                }
              }

              if (!skip) {

                // we do not need to translate here -- the data should be 
                // in canonical form on the clipboard.

                commands.push({ key: CommandKey.SetRange, value: data, area: target_address });
              }

            }

            commands.push({ key: CommandKey.UpdateStyle, style: cell_info.style || {}, area: target_address });

          });

          if (object_data.column_width?.length) {
            for (const [index, width] of object_data.column_width.entries()) {
              if (typeof width === 'number') {
                const column = index + paste_area.start.column;
                commands.push({
                  key: CommandKey.ResizeColumns, 
                  column, 
                  width,
                });
              }
            }
          }

          if (object_data.row_height?.length) {
            for (const [index, height] of object_data.row_height.entries()) {
              if (typeof height === 'number') {
                const row = index + paste_area.start.row;
                commands.push({
                  key: CommandKey.ResizeRows,
                  row,
                  height,
                });
              }
            }
          }
          
        }

      }
      catch (e) {
        console.error('invalid treb data on clipboard');
        console.info(e);
        return;
      }
    }
    else {

      // excel tsv is not very clean wrt newlines and quotes. it's easy
      // to construct tsv that makes no sense. as a result parsing is not
      // really helpful.

      // there is html which uses tables, that might work better (TODO)

      const text_data = event.clipboardData.getData('text/plain');
      if (!text_data) return true;

      // still, you could do better than this.

      const lines = text_data.trim().split('\n');
      const source = lines.map((line) => line.split('\t').map((x) => x.trim()));

      const paste_areas = this.RecyclePasteAreas(
        new Area({ row: 0, column: 0 }, { row: source.length - 1, column: source[0].length - 1 }), area);

      if (paste_areas.length === 1) {
        area.Resize(source.length, source[0].length);
        area.Resize(paste_areas[0].rows, paste_areas[0].columns);
      }

      if (!this.ValidatePasteAreas(paste_areas)) {
        this.Error(ErrorCode.invalid_area_for_paste);
        return;
      }
      
      for (const paste_area of paste_areas) {
        //for (let r = 0; r < lines.length; r++) {
        for (let r = 0; r < source.length; r++) {
          //for (let c = 0; c < lines[0].length; c++) {
          for (let c = 0; c < source[0].length; c++) {
            const target_area = new Area({ row: r + paste_area.start.row, column: c + paste_area.start.column });
            this.active_sheet.cells.EnsureCell(target_area.end);
            if (source[r][c]) {
              const tmp = this.SetInferredType(
                { area: target_area, target: target_area.start, empty: false },
                source[r][c], false, false); // true); // <- shouldn't that be false? ???
              if (tmp) {
                for (const command of tmp) { commands.push(command); }
              }
            }
            else {
              const current = this.active_sheet.cells.GetCell(target_area.start, false);
              if (current && current.type !== ValueType.undefined) {
                commands.push({ key: CommandKey.Clear, area: target_area.Clone() });
              }
            }
          }
        }
      }

      // console.info(commands);
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



  /**
   * UI method for inserting rows; updates layout
   */
  protected InsertRowsInternal(command: InsertRowsCommand) { 

    const result = super.InsertRowsInternal(command);

    if (result.error) {
      return result;
    }

    const target_sheet = this.FindSheet(command.sheet_id);

    if (target_sheet === this.active_sheet) {

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

      for (const annotation of result.delete_annotations_list || []) {
        this.layout.RemoveAnnotation(annotation);
      }

      // note event is sent in exec command, not implicit here

      this.QueueLayoutUpdate();

      // we need to repaint (not render) because repaint adjusts the selection
      // canvas for tile layout. FIXME: move that out of repaint so we can call
      // it directly.

      this.Repaint();

      if (result.update_annotations_list?.length) {
        this.layout.UpdateAnnotation(result.update_annotations_list, this.theme);
        for (const annotation of result.resize_annotations_list || []) {
          const view = annotation.view[this.view_index];
          if (view?.resize_callback) {
            view.resize_callback.call(undefined);
          }
        }
      }

    }
    else {
      this.pending_layout_update.add(target_sheet.id);
    }

    return result;

  }

  /**
   * UI method for inserting columns; updates layout
   */
  protected InsertColumnsInternal(command: InsertColumnsCommand) {

    const result = super.InsertColumnsInternal(command);

    if (result.error) {
      return result;
    }

    const target_sheet = this.FindSheet(command.sheet_id);

    // ---

    if (target_sheet === this.active_sheet) {

      // fix selection(s)

      // FIXME: sheet? (...) no, because the only way you have "active"
      // selections on non-active sheet is if you are editing, and editing
      // and insert/delete row/column can't happen at the same time.

      // sheet selections are persisted in the sheets so they won't be affected

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

      for (const annotation of result.delete_annotations_list || []) {
        this.layout.RemoveAnnotation(annotation);
      }

      // overflows break or get orphaned if we muck up the list of 
      // columns. we should be able to fix this, or we can just flush
      // all overflows and force them to get recreated.

      this.tile_renderer?.FlushOverflows();

      // note event is sent in exec command, not implicit here

      this.QueueLayoutUpdate();

      this.DelayedRender(true, undefined, true);

      if (result.update_annotations_list?.length) {
        this.layout.UpdateAnnotation(result.update_annotations_list, this.theme);
        for (const annotation of result.resize_annotations_list || []) {
          const view = annotation.view[this.view_index];
          if (view?.resize_callback) {
            view.resize_callback.call(undefined);
          }
        }
      }

    }
    else {
      this.pending_layout_update.add(target_sheet.id); 
    }

    return result;

  }

  /**
   * specialization
   */
  protected ResetInternal() {

    // inherit non-UI reset stuff
    super.ResetInternal();

    // now do the UI bits
    this.RemoveAnnotationNodes();
    this.ClearSelection(this.primary_selection);
    this.ScrollIntoView({ row: 0, column: 0 });
    this.QueueLayoutUpdate(); // necessary? (...)
    this.layout.HideNote();

  }

  /**
   * overload: see ResizeRowsInternal
   */
  protected ResizeColumnsInternal(command: ResizeColumnsCommand) {

    const sheet = command.sheet_id ? this.FindSheet(command.sheet_id) : this.active_sheet;

    // normalize

    let column = command.column;
    if (typeof column === 'undefined') {
      column = [];
      for (let i = 0; i < sheet.columns; i++) column.push(i);
    }
    if (typeof column === 'number') column = [column];

    const auto = typeof command.width !== 'number';
    const width = Math.round((command.width || 0) / this.scale);

    if (auto) {
      for (const entry of column) {
        this.AutoSizeColumn(sheet, entry, true);
      }
    }
    else {
      for (const entry of column) {
        sheet.SetColumnWidth(entry, width);
      }
    }

    if (sheet === this.active_sheet) {

      this.layout.UpdateTotalSize();

      if (this.layout.container
        && this.layout.container.offsetWidth
        && this.layout.container.offsetWidth > this.layout.total_width) {
        this.UpdateLayout();
      }
      else {
        this.layout.UpdateTileWidths(true);
        this.render_tiles = this.layout.VisibleTiles();
        this.Repaint(false, true); // repaint full tiles
      }

      this.layout.UpdateAnnotation(this.active_sheet.annotations, this.theme);
      this.RenderSelections();

    }
    else {
      this.pending_layout_update.add(sheet.id);
    }
  }

  /**
   * UI grid supports scale and auto-size, so we're overloading.
   * @param command 
   */
  protected ResizeRowsInternal(command: ResizeRowsCommand): IArea|undefined {

    let updated: Area|undefined;

    // this method is inconsistent for active sheet vs other sheets.
    // for the active sheet, it uses the layout routine which incorporates
    // scale. for other sheets, it calls sheet directly, which ignores scale.

    // all the layout routine does is call the sheet routine (after adjusting
    // for scale), so we could do that from here and simplify everything.
    // scale is constant for all sheets (at least atm).

    // NOTE: why do we scale the number? because we scale it the other way,
    // if that makes sense. when we render we multiply height * scale.

    // we're guaranteed this now, we should have a way to represent that...

    const sheet = command.sheet_id ? this.FindSheet(command.sheet_id) : this.active_sheet;

    // normalize rows -> array. undefined means all rows.

    let row = command.row;
    if (typeof row === 'undefined') {
      row = [];
      for (let i = 0; i < sheet.rows; i++) row.push(i);
    }
    if (typeof row === 'number') row = [row];

    // allow shrink: this is default true, but optional

    const shrink = (typeof command.shrink === 'boolean' ? command.shrink : true);

    // scale height if provided

    const auto = typeof command.height !== 'number';
    const height = Math.round(command.height || 0 / this.scale);

    // apply

    if (auto) {
      for (const entry of row) {
        const current = sheet.GetRowHeight(entry);
        if (!current) {
          // console.info('zero -> something via auto');

          if (!updated) {
            updated = new Area({row: entry, column: Infinity, sheet_id: sheet.id});
          }
          else {
            updated.ConsumeAddress({row: entry, column: 1});
          }
        }

        // sheet.AutoSizeRow(entry, this.theme, shrink, this.scale);
        this.AutoSizeRow(sheet, entry, shrink);
      }
    }
    else {
      for (const entry of row) {
        const current = sheet.GetRowHeight(entry);
        if ((!current && height) || (current && !height)) {
          // console.info('update,', current, height);

          if (!updated) {
            updated = new Area({row: entry, column: Infinity, sheet_id: sheet.id});
          }
          else {
            updated.ConsumeAddress({row: entry, column: 1});
          }
        }
        sheet.SetRowHeight(entry, height);
      }
    }

    if (sheet === this.active_sheet) {

      this.layout.UpdateTotalSize();

      if (this.layout.container
        && this.layout.container.offsetHeight
        && this.layout.container.offsetHeight > this.layout.total_height) {
        this.UpdateLayout();
      }
      else {
        this.layout.UpdateTileHeights(true);
        this.render_tiles = this.layout.VisibleTiles();
        this.Repaint(false, true); // repaint full tiles
      }

      this.layout.UpdateAnnotation(this.active_sheet.annotations, this.theme);
      this.RenderSelections();

    }
    else {
      
      // see below
      this.pending_layout_update.add(sheet.id);

    }

    return updated ? { start: updated.start, end: updated.end } : undefined;

  }

  /**
   * specialization
   */
  protected SelectInternal(command: SelectCommand) {

    // case: empty selection
    if (!command.area) {
      this.ClearSelection(this.primary_selection);
    }
    else {
      // activate sheet, if necessary
      if (command.area.start.sheet_id && command.area.start.sheet_id !== this.active_sheet.id) {
        this.ActivateSheetInternal({
          key: CommandKey.ActivateSheet,
          id: command.area.start.sheet_id,
        });
      }
      this.Select(this.primary_selection, new Area(command.area.start, command.area.end));
      this.RenderSelections();
    }
    
  }

  /**
   * specialization. all the base class method does is set the sheet 
   * fields, so we don't need to call it, we can do that.
   * 
   */
  protected FreezeInternal(command: FreezeCommand) {

    const sheet = this.FindSheet(command.sheet_id || this.active_sheet.id);

    // default true, if we're on the active sheet
    const highlight = (((typeof command.highlight_transition) === 'boolean')
                        ? command.highlight_transition
                        : true) && (sheet === this.active_sheet);

    if (command.rows === sheet.freeze.rows &&
      command.columns === sheet.freeze.columns) {
      if (highlight) {
        this.HighlightFreezeArea();
      }
      return;
    }

    sheet.freeze.rows = command.rows;
    sheet.freeze.columns = command.columns;

    // FIXME: should we do this via events? (...)

    // we are sending an event via the exec command method that calls
    // this method, so we are not relying on the side-effect event anymore

    if (sheet === this.active_sheet) {

      this.QueueLayoutUpdate();
      this.Repaint();

      if (highlight) {
        this.HighlightFreezeArea();
      }

      if (command.rows || command.columns) {
        this.layout.CloneFrozenAnnotations();
      }
      else {
        this.layout.ClearFrozenAnnotations();
      }

    }
    else {
      this.pending_layout_update.add(sheet.id);
    }

  }

  //////////////////////////////////////////////////////////////////////////////

  public ExecCommand(commands: Command | Command[], queue = true) {

    const flags = super.ExecCommand(commands, queue);

    if (!this.batch) {
      if (flags.render_area) {
        this.DelayedRender(false, flags.render_area);
      }
    }

    if (flags.repaint) {
      this.Repaint();
    }

    for (const id of flags.pending || []) {
      this.pending_layout_update.add(id);
    }

    if (flags.layout) {
      this.QueueLayoutUpdate();
    }

    if (flags.sheets && this.tab_bar) {
      this.tab_bar.Update();
    }

    if (flags.formula) {
      this.UpdateFormulaBarFormula();
    }

    return flags;

  }


}
