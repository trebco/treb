
import {
  Area, 
  Cell, 
  Theme, 
  Style, 
  IArea, 
  Extent, 
  Is2DArray,
  CellValue, 
  Rectangle, 
  ValueType, 
  Localization, 
  ICellAddress, 
  IsCellAddress, 
  ValidationType,
  ImportedSheetData, 
  LoadThemeProperties,
  DefaultTheme,
} from 'treb-base-types';

import {
  Parser, DecimalMarkType, ExpressionUnit, ArgumentSeparatorType, ParseCSV,
  QuotedSheetNameRegex, IllegalSheetNameRegex, UnitAddress
} from 'treb-parser';

import { EventSource, Yield, SerializeHTML } from 'treb-utils';
import { NumberFormatCache, LotusDate, ValueParser, Hints, NumberFormat } from 'treb-format';
import { SelectionRenderer } from '../render/selection-renderer';

import { TabBar } from './tab_bar';
import { Sheet } from './sheet';
import { TileRange, BaseLayout } from '../layout/base_layout';

//import { CreateLayout } from 'grid-conditional/layout_manager';

// this will get changed at compile time to modern/legacy
import { CreateLayout } from '../conditional/modern/layout_manager';

import { GridSelection } from './grid_selection';
import { OverlayEditor, OverlayEditorResult } from '../editors/overlay_editor';

import { TileRenderer } from '../render/tile_renderer';
import { GridEvent } from './grid_events';
import { FreezePane, LegacySerializedSheet } from './sheet_types';
import { FormulaBar } from '../editors/formula_bar';
import { GridOptions, DefaultGridOptions } from './grid_options';
import { AutocompleteMatcher, FunctionDescriptor, DescriptorType } from '../editors/autocomplete_matcher';
import { BorderConstants } from './border_constants';
import { SerializeOptions } from './serialize_options';
import { UA } from '../util/ua';
import { Annotation } from './annotation';
import { Autocomplete } from '../editors/autocomplete';

import { MouseDrag } from './drag_mask';

import {
  Command, CommandKey, CommandRecord,
  SetRangeCommand, FreezeCommand, UpdateBordersCommand,
  InsertRowsCommand, InsertColumnsCommand, SetNameCommand,
  ActivateSheetCommand, ShowSheetCommand, SheetSelection, DeleteSheetCommand, DataValidationCommand, DuplicateSheetCommand
} from './grid_command';

import { DataModel, MacroFunction, SerializedModel } from './data_model';
import { NamedRangeCollection } from './named_range';

import '../../style/grid.scss';
import { DOMUtilities } from '../util/dom_utilities';

interface ClipboardCellData {
  address: ICellAddress;
  data: CellValue;
  type: ValueType;
  style?: Style.Properties;
  array?: {rows: number, columns: number};
}

interface DoubleClickData {
  timeout?: number;
  address?: ICellAddress;
}

enum EditingState {
  NotEditing = 0,
  CellEditor = 1,
  FormulaBar = 2,
}

export class Grid {

  // --- public members --------------------------------------------------------

  /** events */
  public grid_events = new EventSource<GridEvent>();

  /** for recording */
  public command_log = new EventSource<CommandRecord>();

  /**
   * the theme object exists so we can pass it to constructors for
   * various components, but it's no longer initialized until the
   * initialization step (when we have a node).
   */
  public readonly theme: Theme; // ExtendedTheme;

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
  public readonly model: DataModel;

  public get active_sheet(): Sheet { 
    return this.model.active_sheet; 
  }

  public set active_sheet(sheet: Sheet) { 
    this.model.active_sheet = sheet; 
  }

  // new...
  public headless = false;

  // --- private members -------------------------------------------------------

  // testing
  private hover_data: {
    note?: boolean;
    link?: boolean;
    cell?: Cell;
    point?: {x: number, y: number};
    handler?: number;
    pointer?: boolean;
    address?: ICellAddress; // = { row: -1, column: -1 };
  } = {};

  private batch = false;

  private batch_events: GridEvent[] = [];

  /** are we editing? */
  private editing_state: EditingState = EditingState.NotEditing;

  /** if we are editing, what is the cell? */
  private editing_cell: ICellAddress = { row: -1, column: -1, sheet_id: 0 };

  /**  */
  private selected_annotation?: Annotation;

  /** */
  private editing_annotation?: Annotation;

  /**
   * this should not be public -- clients should only interact with the API.
   * so why is it public? we need to access it in the calculator (and in the
   * calculator in the worker, for simulations).
   *
   * FIXME: find a solution for this.
   */
  //private get cells() {
  //  return this.active_sheet.cells;
  //}

  private grid_container?: HTMLElement;

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

  /** this is used when testing if a typed character is numeric */
  private decimal_separator_code = 0x2e; // "."

  /** new key capture overlay/ICE */
  private overlay_editor?: OverlayEditor;

  /** formula bar editor (optional) */
  private formula_bar?: FormulaBar;

  private RESIZE_PIXEL_BUFFER = 5;

  private select_argument = false; // temp, WIP

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

  /* *
   * this selection is for highlighting only
   * /
  private readonly highlight_selection: GridSelection = {
    target: { row: 0, column: 0 },
    area: new Area({ row: 0, column: 0 }),
    empty: true,
  };
  */

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
  // private hover_cell: ICellAddress = { row: -1, column: -1 };

  /**
   * flag indicating we're showing a note, so we can stop
   */
  // private hover_note_visible = false;

  /** same for title/link info */
  // private hover_tracking_link = false;

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

  // FIXME: move

  // private tab_bar?: HTMLElement;
  private tab_bar?: TabBar;

  /**
   * replacement for global style default properties.
   * FIXME: move (model?)
   *
   * SEE comment in sheet class
   */
  private readonly theme_style_properties: Style.Properties =
    Style.Composite([Style.DefaultProperties]);

  // --- constructor -----------------------------------------------------------

  /**
   * FIXME: NO PARAMETER INITIALIZATIONS
   */
  constructor(options: GridOptions = {}, theme: Theme = DefaultTheme) {

    // construct model. it's a little convoluted because the
    // "active sheet" reference points to one of the array members

    const sheets = [
      Sheet.Blank(this.theme_style_properties),
    ];

    this.model = {
      sheets,
      active_sheet: sheets[0],
      // annotations: [],
      named_ranges: new NamedRangeCollection(),
      macro_functions: {},
    };

    // set properties here, we will update in initialize()

    this.theme = JSON.parse(JSON.stringify(theme));

    // apply default options, meaning that you need to explicitly set/unset
    // in order to change behavior. FIXME: this is ok for flat structure, but
    // anything more complicated will need a nested merge

    this.options = { ...DefaultGridOptions, ...options };

    /*
    this.layout = UA.is_modern ?
      new GridLayout(this.model) :
      new LegacyLayout(this.model);
    */
    this.layout = CreateLayout(this.model);
    if (options.initial_scale) {
      if (typeof options.initial_scale === 'string') {
        options.initial_scale = Number(options.initial_scale);
      }
      this.layout.scale = options.initial_scale;

      // not created yet
      // this.tab_bar?.UpdateScale(options.initial_scale);
    }

    this.tile_renderer = new TileRenderer(this.theme, this.layout, this.model, this.options);
    this.selection_renderer = new SelectionRenderer(
      this.theme,
      this.layout,
      this.model,
      this.primary_selection,
      this.additional_selections);

    if (Localization.decimal_separator === '.') {
      this.parser.decimal_mark = DecimalMarkType.Period;
      this.parser.argument_separator = ArgumentSeparatorType.Comma;
    }
    else {
      this.parser.decimal_mark = DecimalMarkType.Comma;
      this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
    }

    this.decimal_separator_code = Localization.decimal_separator.charCodeAt(0);

  }

  // --- public methods --------------------------------------------------------

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
      address,
      note,
    });

  }

  /**
   * set hyperlink, like set note
   */
  public SetLink(address?: ICellAddress, reference?: string): void {

    if (!address) {
      if (this.primary_selection.empty) return;
      address = this.primary_selection.target;
    }

    this.ExecCommand({
      key: CommandKey.SetLink,
      address,
      reference,
    });

  }

  /** find an annotation, given a node */
  public FindAnnotation(node: HTMLElement): Annotation|undefined {
    for (const annotation of this.active_sheet.annotations) {
      if (annotation.node === node) {
        return annotation;
      }
    }
    return undefined;
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
  public CreateAnnotation(properties: unknown = {}, add_to_sheet = true, offset = false, target?: Partial<Area>|Partial<Rectangle>): Annotation {
    const annotation = new Annotation(properties as Partial<Annotation>);

    if (offset) {

      // to offset, we have to have layout (or at least scaled rect)
      if (!annotation.layout && annotation.scaled_rect) {
        annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
      }

      if (!annotation.layout) {
        console.warn(`can't offset annotation without layout`);
      }
      else {
        let target_rect = this.layout.AnnotationLayoutToRect(annotation.layout).Shift(20, 20);
        let recheck = true;
        while (recheck) {
          recheck = false;
          for (const test of this.active_sheet.annotations) {
            if (test === annotation) { continue; }
            if (test.scaled_rect && test.scaled_rect.top === target_rect.top && test.scaled_rect.left === target_rect.left) {
              target_rect = target_rect.Shift(20, 20);
              recheck = true;
              break;
            }
          }
        }
        annotation.layout = this.layout.RectToAnnotationLayout(target_rect);
      }
    }

    if (target) {
      if (Rectangle.IsRectangle(target)) {
        // console.info('creating from rectangle,', target);
        annotation.layout = undefined;
        annotation.rect = Rectangle.Create(target);
      }
      else if (target.start) {
        annotation.rect = undefined;
        annotation.layout = this.layout.AddressToAnnotationLayout(target.start, target.end||target.start);
      }
    }
    
    if (add_to_sheet) {

      // ensure we haven't already added this
      if (!this.active_sheet.annotations.some((test) => test === annotation)) {
        this.active_sheet.annotations.push(annotation);
      }

      this.AddAnnotation(annotation);
    }
    return annotation;
  }

  public UpdateScale(scale = 1): void {
    
    this.layout.scale = scale;
    this.UpdateLayout();
    this.UpdateAnnotationLayout();
    this.layout.UpdateAnnotation(this.active_sheet.annotations);
    this.layout.ApplyTheme(this.theme);
    this.overlay_editor?.UpdateTheme(scale);
    this.tab_bar?.UpdateScale(scale);

    this.grid_events.Publish({
      type: 'scale', 
      scale,
    });

    for (const sheet of this.model.sheets) {
      for (const annotation of sheet.annotations) {
        annotation.dirty = true;
      }
    }

  }

  /** placeholder */
  public UpdateAnnotationLayout(): void {
    // ...
  }

  /*
  public AnnotationMouseDown(annotation: Annotation, event: MouseEvent, move_target: HTMLElement, resize_target: HTMLElement) {

    const node = annotation.node;
    if (!node) {
      return;
    }
          
    console.info('annotation mousedown', annotation);

    const rect = annotation.scaled_rect;
    if (!rect) {
      console.info('missing scaled rect!');
      return;
    }

    const origin = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };

    const bounding_rect = node.getBoundingClientRect();

    if (event.target === move_target) {

      event.stopPropagation();
      event.preventDefault();
      node.focus();

      const offset = {
        x: bounding_rect.left + event.offsetX - rect.left,
        y: bounding_rect.top + event.offsetY - rect.top,
      };

      MouseDrag(this.layout.mask, 'move', (move_event) => {

        const elements = [node, ...this.layout.GetFrozenAnnotations(annotation)];

        rect.top = move_event.offsetY - offset.y;
        rect.left = move_event.offsetX - offset.x;

        if (move_event.shiftKey) {

          // move in one direction at a time
          const dx = Math.abs(rect.left - origin.left);
          const dy = Math.abs(rect.top - origin.top);

          if (dx <= dy) { rect.left = origin.left; }
          else { rect.top = origin.top; }

        }

        if (move_event.ctrlKey) {
          const point = this.layout.ClampToGrid({
            x: rect.left, y: rect.top,
          });
          rect.left = point.x;
          rect.top = point.y;
        }

        // node.style.top = (rect.top) + 'px';
        // node.style.left = (rect.left) + 'px';

        for (const element of elements) {
          element.style.top = (rect.top) + 'px';
          element.style.left = (rect.left) + 'px';
        }

      }, () => {
        annotation.extent = undefined; // reset
        // annotation.rect = rect.Scale(1/this.layout.scale);
        annotation.layout = this.layout.RectToAnnotationLayout(rect);
        this.grid_events.Publish({ type: 'annotation', annotation, event: 'move' });
      });

      return;

    }
    else if (event.target === resize_target) {

    //if ((bounding_rect.width - event.offsetX <= 13) &&
    //  (bounding_rect.height - event.offsetY <= 13)) {

      event.stopPropagation();
      event.preventDefault();
      node.focus();

      let aspect = 0;
      if (annotation.data?.original_size
            && annotation.data.original_size.width
            && annotation.data.original_size.height){
        aspect = annotation.data.original_size.width / 
                 annotation.data.original_size.height;
      }

      const bounds = node.getBoundingClientRect();
      const offset = {
        x: bounds.left + event.offsetX - rect.width + resize_target.offsetLeft,
        y: bounds.top + event.offsetY - rect.height + resize_target.offsetTop,
      };

      MouseDrag(this.layout.mask, 'nw-resize', (move_event) => {

        const elements = [node, ...this.layout.GetFrozenAnnotations(annotation)];

        rect.height = move_event.offsetY - offset.y;
        rect.width = move_event.offsetX - offset.x;

        if (move_event.shiftKey && move_event.ctrlKey) {
          if (aspect) {

            const dx = Math.abs(rect.width - origin.width);
            const dy = Math.abs(rect.height - origin.height);

            if (dx < dy) {
              rect.width = aspect * rect.height;
            }
            else {
              rect.height = rect.width / aspect;
            }

          }
        }
        else if (move_event.shiftKey) {
          // move in one direction at a time [is this backwards? ...]
          const dx = Math.abs(rect.height - origin.height);
          const dy = Math.abs(rect.width - origin.width);

          if (dx > dy) { rect.width = origin.width; }
          else { rect.height = origin.height; }
        }
        else if (move_event.ctrlKey) {
          const point = this.layout.ClampToGrid({
            x: rect.right, y: rect.bottom,
          });
          rect.width = point.x - rect.left + 1;
          rect.height = point.y - rect.top + 1;
        }

        // node.style.height = (rect.height) + 'px';
        // node.style.width = (rect.width) + 'px';

        for (const element of elements) {
          element.style.height = (rect.height) + 'px';
          element.style.width = (rect.width) + 'px';
        }

      }, () => {
        annotation.extent = undefined; // reset
        // annotation.rect = rect.Scale(1/this.layout.scale);
        annotation.layout = this.layout.RectToAnnotationLayout(rect);

        this.grid_events.Publish({ type: 'annotation', annotation, event: 'resize' });
      });

      return;
    }

  
  }
  */

  /** add an annotation. it will be returned with a usable node. */
  public AddAnnotation(annotation: Annotation, toll_events = false, add_to_layout = true): void {

    if (!annotation.node) {

      // FIXME: why is this not in layout? it is layout.

      annotation.node = document.createElement('div');
      annotation.node.dataset.scale = this.layout.scale.toString();
      annotation.node.style.fontSize = `${10 * this.layout.scale}pt`;

      annotation.content_node = DOMUtilities.CreateDiv('annotation-content', annotation.node);
      const move_target = DOMUtilities.CreateDiv('annotation-move-target', annotation.node);
      const resize_target = DOMUtilities.CreateDiv('annotation-resize-target', annotation.node);

      if (annotation.node) {
        const node = annotation.node;

        // support focus
        node.setAttribute('tabindex', '-1');

        node.addEventListener('mousedown', (event) => {

          // this.AnnotationMouseDown(annotation, event, move_target, resize_target);
          this.layout.AnnotationMouseDown(annotation, node, event, move_target, resize_target).then(event => {
            // console.info('resolved', event);
            if (event) {
              this.grid_events.Publish(event);
            }
          });
        });

        annotation.node.addEventListener('focusin', () => {

          // console.info('annotation focusin', annotation);

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
        });

        annotation.node.addEventListener('focusout', (event) => {

          // console.info('annotation focusout', annotation);

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
          else {
            if (this.selected_annotation === annotation) {
              this.selected_annotation = undefined;
            }
            this.ShowGridSelection();
          }
        });

        annotation.node.addEventListener('keydown', (event) => {
      
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

            annotation.extent = undefined; // reset
            this.grid_events.Publish({ type: 'annotation', event: 'move', annotation });

            // annotation.rect = rect.Scale(1/this.layout.scale);
            annotation.layout = this.layout.RectToAnnotationLayout(rect);

          }

        });
      }
    }

    annotation.node.classList.add('annotation');

    if (add_to_layout) {
      this.layout.AddAnnotation(annotation);
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

        /*
        if (annotation.node && annotation.node.parentElement) {
          annotation.node.parentElement.removeChild(annotation.node);
        }
        */
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
    this.layout.RemoveAnnotationNodes();
  }

  /**
   * serialize data. this function used to (optionally) stringify
   * by typescript has a problem figuring this out, so we will simplify
   * the function.
   */
  public Serialize(options: SerializeOptions = {}): SerializedModel {

    // selection moved to sheet, but it's not "live"; so we need to
    // capture the primary selection in the current active sheet before
    // we serialize it

    this.active_sheet.selection = JSON.parse(JSON.stringify(this.primary_selection));

    // same for scroll offset

    this.active_sheet.scroll_offset = this.layout.scroll_offset;

    // NOTE: annotations moved to sheets, they will be serialized in the sheets

    const sheet_data = this.model.sheets.map((sheet) => sheet.toJSON(options));

    // NOTE: moving into a structured object (the sheet data is also structured,
    // of course) but we are moving things out of sheet (just  named ranges atm))

    let macro_functions: MacroFunction[] | undefined;

    const macro_function_keys = Object.keys(this.model.macro_functions);
    if (macro_function_keys.length) {
      macro_functions = [];
      for (const key of macro_function_keys) {
        macro_functions.push({
          ...this.model.macro_functions[key],
          expression: undefined,
        });
      }
    }

    return {
      sheet_data,
      active_sheet: this.active_sheet.id,
      named_ranges: this.model.named_ranges.Count() ?
        this.model.named_ranges.Serialize() :
        undefined,
      macro_functions,
    };

  }

  /** pass through */
  public RealArea(area: Area): Area {
    return this.active_sheet.RealArea(area);
  }

  /** pass through */
  public CellRenderData(address: ICellAddress): Cell {
    return this.active_sheet.CellData(address);
  }

  /**
   * clear sheet, reset all data
   */
  public Clear(): void {
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
  public FromCSV(text: string): void {

    const records = ParseCSV(text);
    const arr = records.map((record) =>
      record.map((field) => ValueParser.TryParse(field).value));

    const end = {
      row: Math.max(0, arr.length - 1),
      column: arr.reduce((max, row) => Math.max(max, Math.max(0, row.length - 1)), 0),
    };

    // console.info(arr, end);

    this.ExecCommand([
      { key: CommandKey.Clear },
      {
        key: CommandKey.SetRange,
        area: { start: { row: 0, column: 0 }, end },
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
  public ShowHeaders(show = true): void {
    this.ExecCommand({
      key: CommandKey.ShowHeaders,
      show,
    });
  }

  /** 
   * this method is called after an XLSX import.
   */
  public FromImportData(
    import_data: {
      sheets: ImportedSheetData[],
      names?: Record<string, string>,
      active_tab?: number,
    },
    render = false,
  ): void {

    this.RemoveAnnotationNodes();

    const sheet_data = import_data.sheets;

    const base_sheets = sheet_data.map(() => {
      return Sheet.Blank(this.theme_style_properties).toJSON();
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

    this.model.macro_functions = {};

    this.ClearSelection(this.primary_selection);

    // moved data import into sheet

    for (let i = 0; i < sheet_data.length; i++) {
      const sheet = this.model.sheets[i];
      sheet.ImportData(sheet_data[i]);
      name_map[sheet.name] = sheet.id;
    }

    this.model.named_ranges.Reset();

    if (import_data.names) {
      for (const name of Object.keys(import_data.names)) {
        const label = import_data.names[name];
        const parse_result = this.parser.Parse(label);
        if (parse_result.expression) {
          if (parse_result.expression.type === 'range') {
            const sheet_id = name_map[parse_result.expression.start.sheet || ''];
            if (sheet_id) {
              parse_result.expression.start.sheet_id = sheet_id;
              this.model.named_ranges.SetName(name, new Area(parse_result.expression.start, parse_result.expression.end), false);
            }
          }
          if (parse_result.expression.type === 'address') {
            const sheet_id = name_map[parse_result.expression.sheet || ''];
            if (sheet_id) {
              parse_result.expression.sheet_id = sheet_id;
              this.model.named_ranges.SetName(name, new Area(parse_result.expression), false);
            }
          }
        }

      }
      this.model.named_ranges.RebuildList();
    }

    // should already be added, right?

    for (const element of this.active_sheet.annotations) {
      this.AddAnnotation(element, true);
    }

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

  /* *
   * why does this not take the composite object? (...)
   * A: it's used for xlsx import. still, we could wrap it.
   * /
  public FromData(
    cell_data: any[],
    column_widths: number[],
    row_heights: number[],
    styles: Style.Properties[],
    render = false): void {

    this.RemoveAnnotationNodes();

    this.UpdateSheets([Sheet.Blank(this.theme_style_properties).toJSON()], true);

    // FIXME: are there named ranges in the data? (...)

    this.model.named_ranges.Reset();
    this.model.macro_functions = {};

    this.ClearSelection(this.primary_selection);

    this.cells.FromJSON(cell_data);

    // 0 is implicitly just a general style

    const cs = (this.active_sheet as any).cell_style;
    for (const info of cell_data) {
      if (info.style_ref) {
        if (!cs[info.column]) cs[info.column] = [];
        cs[info.column][info.row] = styles[info.style_ref];
      }
    }

    for (let i = 0; i < column_widths.length; i++) {
      if (typeof column_widths[i] !== 'undefined') {
        this.active_sheet.SetColumnWidth(i, column_widths[i]);
      }
    }

    for (let i = 0; i < row_heights.length; i++) {
      if (typeof row_heights[i] !== 'undefined') {
        this.active_sheet.SetRowHeight(i, row_heights[i]);
      }
    }

    // no longer sending explicit layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    if (render) {
      this.Repaint(false, false); // true, true);
    }

  }
  */

  public ResetMetadata(): void {
    this.model.document_name = undefined;
    this.model.user_data = undefined;
  }

  public NextSheet(step = 1): void {
    if (this.model.sheets.length === 1) return;
    for (let i = 0; i < this.model.sheets.length; i++) {
      if (this.model.sheets[i] === this.active_sheet) {
        let index = (i + step) % this.model.sheets.length;
        while (index < 0) { index += this.model.sheets.length; }
        this.ActivateSheet(index);
        return;
      }
    }
  }

  /** insert sheet at the given index (or current index) */
  public InsertSheet(index?: number, name?: string): void {

    if (typeof index === 'undefined') {
      if (!this.model.sheets.some((sheet, i) => {
        if (sheet === this.active_sheet) {
          index = i + 1;
          return true;
        }
        return false;
      })) {
        throw new Error('invalid index');
      }
    }

    this.ExecCommand({
      key: CommandKey.AddSheet,
      insert_index: index,
      name,
    });

  }

  /**
   * delete sheet, by index or (omitting index) the current active sheet
   */
  public DeleteSheet(index?: number): void {

    if (typeof index === 'undefined') {
      if (!this.model.sheets.some((sheet, i) => {
        if (sheet === this.active_sheet) {
          index = i;
          return true;
        }
        return false;
      })) {
        throw new Error('invalid index');
      }
    }

    this.ExecCommand({
      key: CommandKey.DeleteSheet,
      index,
    });

  }

  /**
   * duplicate sheet by index or (omitting index) the current active sheet
   */
  public DuplicateSheet(index?: number, name?: string, insert_before?: number|string): void {

    const command: DuplicateSheetCommand = {
      key: CommandKey.DuplicateSheet,
      new_name: name,
      insert_before,
    };

    if (typeof index === 'undefined') {
      command.id = this.active_sheet.id;
    }
    else {
      command.index = index;
    }

    this.ExecCommand(command);

  }

  public AddSheet(name?: string): void {
    this.ExecCommand({
      key: CommandKey.AddSheet,
      name,
    });
  }

  /**
   * activate sheet, by name or index number
   * @param sheet number (index into the array) or string (name)
   */
  public ActivateSheet(sheet: number | string): void {

    const index = (typeof sheet === 'number') ? sheet : undefined;
    const name = (typeof sheet === 'string') ? sheet : undefined;

    this.ExecCommand({
      key: CommandKey.ActivateSheet,
      index,
      name,
    });

  }

  /**
   * activate sheet, by ID
   */
  public ActivateSheetID(id: number): void {
    this.ExecCommand({
      key: CommandKey.ActivateSheet,
      id,
    });
  }

  public ShowAll(): void {

    // obviously there are better ways to do this, but this
    // will use the execcommand system and _should_ only fire
    // a single event (FIXME: check)

    const commands: ShowSheetCommand[] = [];
    for (let index = 0; index < this.model.sheets.length; index++) {
      commands.push({
        key: CommandKey.ShowSheet,
        index,
        show: true,
      });
    }
    this.ExecCommand(commands);
  }

  public ShowSheet(index: number|string = 0, show = true): void {

    const command: ShowSheetCommand = {
      key: CommandKey.ShowSheet,
      show,
    };

    if (typeof index === 'string') { command.name = index; }
    else { command.index = index; }

    this.ExecCommand(command);
    
  }

  /** new version for multiple sheets */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public UpdateSheets(data: LegacySerializedSheet[], render = false, activate_sheet?: number | string): void {

    // remove existing annotations from layout

    this.RemoveAnnotationNodes();

    Sheet.Reset(); // reset ID generation

    const sheets = data.map((sheet) => Sheet.FromJSON(sheet, this.theme_style_properties));

    // ensure we have a sheets[0] so we can set active

    if (sheets.length === 0) {
      sheets.push(Sheet.Blank(this.theme_style_properties));
    }

    // now assign sheets

    this.model.sheets = sheets;
    this.active_sheet = sheets[0];

    // possibly set an active sheet on load (shortcut)

    if (activate_sheet) {

      if (typeof activate_sheet === 'number') {
        for (const sheet of this.model.sheets) {
          if (activate_sheet === sheet.id) {
            this.active_sheet = sheet;
            break;
          }
        }
      }
      else if (typeof activate_sheet === 'string') {
        for (const sheet of this.model.sheets) {
          if (activate_sheet === sheet.name) {
            this.active_sheet = sheet;
            break;
          }
        }
      }
    }

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

    this.ResetMetadata(); // FIXME: ?

    // for this version, we want to add all annotations at once; we only
    // add annotations on the active sheet to the layout, but the rest are
    // also created. the intent here is to ensure that any dependent cells
    // (like MC results) are marked even before we open a particular sheet.

    /*
    const annotations = this.active_sheet.annotations;
    for (const element of annotations) {
      this.AddAnnotation(element, true);
    }
    */

    // otherwise layout of annotations won't work properly
    this.layout.ClearLayoutCaches();
    
    for (const sheet of this.model.sheets) {
      for (const annotation of sheet.annotations) {
        this.AddAnnotation(annotation, true, (sheet === this.active_sheet));
      }
    }

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    // TODO: reset scroll

    if (render) {
      this.Repaint(false, false);
    }

    if (this.tab_bar) {
      this.tab_bar.Update();
    }

  }

  /* * DEPRECATED * /
  public UpdateSheet__(data: any, render = false): void {

    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    Sheet.FromJSON(data, this.theme_style_properties, this.active_sheet);
    this.ClearSelection(this.primary_selection);

    // this is the old version -- we still want to support it, but
    // only for reading. it should have precedence? (...)

    if ((data as any).primary_selection) {
      const selection = ((data as any).primary_selection) as GridSelection;
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


    this.ResetMetadata();

    // scrub, then add any sheet annotations. note the caller will
    // still have to inflate these or do whatever step is necessary to
    // render.

    this.RemoveAnnotationNodes();

    const annotations = (data as any).annotations;
    if (annotations && Array.isArray(annotations)) {
      for (const element of annotations) {
        this.AddAnnotation(new Annotation(element), true);
      }
    }

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    this.QueueLayoutUpdate();

    this.StyleDefaultFromTheme();

    if (render) {
      this.Repaint(false, false);
    }
  }
  */

  /**
   * rebuild layout on a resize. we are not trapping resize events, clients
   * should do that (also this works for embedded elements that are not
   * directly affected by document resize).
   */
  public UpdateLayout(): void {
    this.layout.UpdateTiles();
    this.render_tiles = this.layout.VisibleTiles();
    this.Repaint(true);
  }

  /**
   * splitting the old UpdateTheme, since that is becoming more
   * important for post-constructor theme updates, and the name applies
   * more to that function than to what we do at startup.
   */
  public ApplyTheme(): void {
    this.UpdateTheme(true);
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

    if (this.grid_container) {
      const theme_properties = LoadThemeProperties(this.grid_container);
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

    this.active_sheet.UpdateDefaultRowHeight();
    this.active_sheet.FlushCellStyles();

    this.layout.ApplyTheme(this.theme);

    if (!initial) {

      this.UpdateLayout(); // in case we have changed font size
      // this.selection_renderer.Flush();

      this.overlay_editor?.UpdateTheme(this.layout.scale);

      // if (this.formula_bar) this.formula_bar.UpdateTheme();

      this.Repaint(true, true, true);
    }

  }

  /**
   *
   * @param container html container element
   * @param sheet_data optional sheet (serialized, as json or object)
   *
   * no one is using the sheet_data parameter atm, so we are removing
   * it; it might come back, but if it does use a load method (don't inline)
   *
   */
  public Initialize(grid_container: HTMLElement, toll_initial_render = false): void {

    this.grid_container = grid_container;

    // so here we want the class list to read
    //
    // ... treb-main [treb-ua-windows] treb-theme ...
    //
    // our internal styles will be scoped to `.treb-main` and optionally
    // `.treb-main.treb-ua-windows`; then you should be able to override
    // using `.treb-main.treb-theme`. we have some extra classes we still 
    // need to clean up, though.

    grid_container.classList.add('treb-main');

    if (UA.is_windows) {
      grid_container.classList.add('treb-ua-windows');
    }

    grid_container.classList.add('treb-theme');

    this.ApplyTheme();

    const container = document.createElement('div');

    const higher_level_container = document.createElement('div');
    higher_level_container.classList.add('treb-layout-master');
    higher_level_container.appendChild(container);
    grid_container.appendChild(higher_level_container);

    // grid_container.appendChild(container);

    let autocomplete: Autocomplete | undefined;

    if (this.options.formula_bar) {
      if (!autocomplete) {
        autocomplete = new Autocomplete({ theme: this.theme, container });
      }
      this.InitFormulaBar(grid_container, autocomplete);
    }

    if (this.options.tab_bar) {

      this.tab_bar = new TabBar(this.layout, this.model, this.options, this.theme, grid_container);
      this.tab_bar.Subscribe((event) => {
        switch (event.type) {
          case 'cancel':
            break;

          case 'scale':
            {
              let scale = this.layout.scale;

              // RiskAMP web used 5% increments above 100% and 2.5% below...
              // that worked well, but it does require the decimal point 
              // which (IMO) looks messy

              switch (event.action) {
                case 'increase':
                  scale += 0.05;
                  break;
                case 'decrease':
                  scale -= 0.05;
                  break;
                default:
                  scale = event.action;
              }

              scale = Math.round(scale * 100) / 100;
              scale = Math.min(2, Math.max(scale, .5));

              if (this.options.persist_scale_key) {
                localStorage.setItem(this.options.persist_scale_key, JSON.stringify({scale}));
              }

              this.UpdateScale(scale);
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
        this.Focus();
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

    this.layout.Initialize(container, 
        () => this.OnScroll(), 
        (value: CellValue) => this.OnDropdownSelect(value),
        this.options.scrollbars);
    this.selection_renderer.Initialize();
    this.layout.UpdateTiles();

    // event handlers and components

    // Sheet.sheet_events.Subscribe(this.HandleSheetEvent.bind(this));

    if (!autocomplete) {
      autocomplete = new Autocomplete({ theme: this.theme, container });
    }
    this.InitOverlayEditor(autocomplete);

    this.AttachListeners();

    // set local state and update

    this.render_tiles = this.layout.VisibleTiles();

    // don't delay this, it looks terrible

    if (!toll_initial_render) {
      this.Repaint(true);
    }

  }

  /**
   * merges selected cells
   */
  public MergeSelection(): void {

    if (this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.layout.HideDropdownCaret();

    this.ExecCommand({
      key: CommandKey.MergeCells,
      area: this.primary_selection.area,
    });
  }

  /**
   * unmerges selected cells
   */
  public UnmergeSelection(): void {

    if (this.primary_selection.empty) {
      return; // FIXME: warn?
    }

    this.layout.HideDropdownCaret();

    this.ExecCommand({
      key: CommandKey.UnmergeCells,
      area: this.primary_selection.area,
    });

  }

  /**
   * focus on the container. you must call this method to get copying
   * to work properly (because it creates a selection)
   */
  public Focus(): void {

    // FIXME: cache a pointer
    if (UA.is_mobile) {
      this.container?.focus();
    }
    else {
      this.overlay_editor?.Focus();
    }

    // this.container?.focus();
  }

  /**
   * set "data validation", which (atm) only supports a list of options
   * and will render as a dropdown; the list can be a list of values or
   * a range reference.
   */
  public SetValidation(target?: ICellAddress, data?: CellValue[]|IArea): void {

    if (!target) {
      if (this.primary_selection.empty) {
        throw new Error('invalid target in set validation');
      }
      target = this.primary_selection.target;
    }

    console.info('target', target);

    const command: DataValidationCommand = {
      key: CommandKey.DataValidation,
      target,
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

  }

  /**
   * set or clear name
   */
  public SetName(name: string, range?: ICellAddress | Area): void {

    const command: SetNameCommand = {
      key: CommandKey.SetName,
      name,
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

    this.ExecCommand(command);
  }

  public GetNumberFormat(address: ICellAddress): string|undefined {
    const style = this.active_sheet.CellStyleData(address);
    if (style && style.number_format) {
      return NumberFormatCache.Get(style.number_format).toString();
    }
  }

  public SelectAll(): void {
    this.Select(this.primary_selection, new Area({ row: Infinity, column: Infinity }), undefined, true);
    this.RenderSelections();
  }

  /** API method */
  public SelectRange(range?: Area): void {
    this.Select(this.primary_selection, range);
    this.RenderSelections();
  }

  /**
   * get data in a given range, optionally formulas
   * API method
   */
  public GetRange(range: ICellAddress | Area, formula = false, formatted = false): CellValue|CellValue[][]|undefined {

    let sheet_id = 0;

    if (IsCellAddress(range)) {

      sheet_id = range.sheet_id || this.active_sheet.id;
      for (const sheet of this.model.sheets) {
        if (sheet.id === sheet_id) {
          if (formula) { return sheet.cells.RawValue(range); }
          if (formatted) { return sheet.GetFormattedRange(range); }
          return sheet.cells.GetRange(range);
        }
      }
      return undefined;

    }

    sheet_id = range.start.sheet_id || this.active_sheet.id;
    for (const sheet of this.model.sheets) {
      if (sheet.id === sheet_id) {
        if (formula) { return sheet.cells.RawValue(range.start, range.end); }
        if (formatted) { return sheet.GetFormattedRange(range.start, range.end); }
        return sheet.cells.GetRange(range.start, range.end);
      }
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
   */
  public SetRange(range: Area, data: CellValue|CellValue[]|CellValue[][], recycle = false, transpose = false, array = false): void {

     // single value, easiest
    if (!Array.isArray(data)) {

      if (recycle || array) {
        this.ExecCommand({ key: CommandKey.SetRange, area: range, value: data, array });
      }
      else {
        this.ExecCommand({ key: CommandKey.SetRange, area: range.start, value: data, array });
      }

    }
    else {

      if (!Is2DArray(data)) {

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

      if (transpose) { data = this.Transpose(data); }

      this.ExecCommand({ key: CommandKey.SetRange, area: range, value: data, array });

    }

    if (!this.primary_selection.empty && range.Contains(this.primary_selection.target)) {
      this.UpdateFormulaBarFormula();
    }


  }

  /**
   * API method
   */
  public SetRowHeight(row?: number | number[], height?: number): void {
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
  public SetColumnWidth(column?: number | number[], width = 0): void {
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
  public ApplyStyle(area?: Area, properties: Style.Properties = {}, delta = true): void {

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
  public Update(force = false, area?: Area): void {
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

  /** updated API method, probably change the name */
  public ApplyBorders2(area?: Area, borders: BorderConstants = BorderConstants.None, color?: Style.Color, width = 1): void {

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
  public GetFreeze(): FreezePane {
    return { ...this.active_sheet.freeze };
  }

  /**
   * freeze rows or columns. set to 0 (or call with no arguments) to un-freeze.
   *
   * highglight is shown by default, but we can hide it(mostly for document load)
   */
  public Freeze(rows = 0, columns = 0, highlight_transition = true): void {
    this.ExecCommand({
      key: CommandKey.Freeze,
      rows,
      columns,
      highlight_transition,
    });
  }

  /**
   * batch updates. returns all the events that _would_ have been sent.
   * also does a paint (can disable).
   * @param func 
   */
  public Batch(func: () => void, paint = true): GridEvent[] {
    
    this.batch = true;
    func();
    this.batch = false;
    const events = this.batch_events.slice(0);
    this.batch_events = [];

    if (paint) {
      this.DelayedRender(false);
    }

    return events;
  }

  /**
   * delete columns in current selection
   */
  public DeleteColumns(): void {
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
  public DeleteRows(): void {
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
  public InsertColumn(): void {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    const before_column = area.entire_row ? 0 : area.start.column;
    this.InsertColumns(before_column, 1);
  }

  /**
   * insert column(s) at some specific point
   */
  public InsertColumns(before_column = 0, count = 1): void {
    this.ExecCommand({
      key: CommandKey.InsertColumns,
      before_column,
      count,
    });
  }

  /** move sheet (X) before sheet (Y) */
  public ReorderSheet(index: number, move_before: number): void {
    this.ExecCommand({
      key: CommandKey.ReorderSheet,
      index,
      move_before,
    });
  }

  /**
   * rename active sheet
   */
  public RenameSheet(sheet = this.active_sheet, name: string): void {
    this.ExecCommand({
      key: CommandKey.RenameSheet,
      new_name: name,
      id: sheet.id,
    });
  }

  /**
   * insert row at cursor
   */
  public InsertRow(): void {
    if (this.primary_selection.empty) { return; }
    const area = this.primary_selection.area;
    const before_row = area.entire_column ? 0 : area.start.row;
    this.InsertRows(before_row, 1);
  }

  /**
   * insert rows(s) at some specific point
   */
  public InsertRows(before_row = 0, count = 1): void {
    this.ExecCommand({
      key: CommandKey.InsertRows,
      before_row,
      count,
    });
  }

  /**
   * set functions for AC matcher. should be called by calculator on init,
   * or when any functions are added/removed.
   *
   * FIXME: we should use this to normalize function names, on insert and
   * on paste (if we're doing that).
   */
  public SetAutocompleteFunctions(functions: FunctionDescriptor[]): void {
    const consolidated = functions.slice(0).concat(
      this.model.named_ranges.List().map((named_range) => {
        return { name: named_range.name, type: DescriptorType.Token };
      }));
    //this.autocomplete_matcher.SetFunctions(functions);
    this.autocomplete_matcher.SetFunctions(consolidated);
  }

  /**
   * scrolls so that the given cell is in the top-left (assuming that is
   * possible)
   */
  public ScrollTo(address: ICellAddress, x = true, y = true): void {
    this.layout.ScrollTo(address, x, y);
  }

  /**
   * scrolls the given address into view (assuming it's not in view now)
   *
   * FIXME: we need a way to do this without scrolling the containing
   * page, in the event we do a scroll-on-load. small problem.
   */
  public ScrollIntoView(address: ICellAddress): void {
    if (this.options.scrollbars) {
      this.layout.ScrollIntoView(address);
    }
  }

  public GetScrollOffset(): {x: number, y: number} {
    return this.layout.GetScrollOffset();
  }

  // --- private methods -------------------------------------------------------

  private DeleteSheetInternal(command: DeleteSheetCommand) {

    let is_active = false;
    let index = -1;

    // remove from array. check if this is the active sheet

    const named_sheet = command.name ? command.name.toLowerCase() : '';
    const sheets = this.model.sheets.filter((sheet, i) => {
      if (i === command.index || sheet.id === command.id || sheet.name.toLowerCase() === named_sheet) {
        is_active = (sheet === this.active_sheet);
        index = i;
        return false;
      }
      return true;
    });

    // empty? create new, activate
    // UPDATE: we also need to create if all remaining sheets are hidden

    if (!sheets.length) {
      sheets.push(Sheet.Blank(this.theme_style_properties));
      index = 0;
    }
    else if (sheets.every(test => !test.visible)) {
      // console.info('all remaining sheets are hidden!');
      sheets.unshift(Sheet.Blank(this.theme_style_properties));
      index = 0;
    }
    else {
      if (index >= sheets.length) {
        index = 0;
      }
      while (!sheets[index].visible) {
        index++;
      }
    }

    this.model.sheets = sheets;

    // need to activate a new sheet? use the next one (now in the slot
    // we just removed). this will roll over properly if we're at the end.

    // UPDATE: we need to make sure that the target is not hidden, or we 
    // can't activate it

    if (is_active) {
      // console.info('activate @', index);
      this.ActivateSheetInternal({ key: CommandKey.ActivateSheet, index });
    }

    // FIXME: this is not necessary if we just called activate, right? (...)

    if (this.tab_bar) { this.tab_bar.Update(); }

  }

  private AddSheetInternal(name = Sheet.default_sheet_name, insert_index = -1) {

    if (!this.options.add_tab) {
      console.warn('add tab option not set or false');
      return;
    }

    // validate name...

    while (this.model.sheets.some((test) => test.name === name)) {

      const match = name.match(/^(.*?)(\d+)$/);
      if (match) {
        name = match[1] + (Number(match[2]) + 1);
      }
      else {
        name = name + '2';
      }

    }

    // FIXME: structure event

    const sheet = Sheet.Blank(this.theme_style_properties, name);

    if (insert_index >= 0) {
      this.model.sheets.splice(insert_index, 0, sheet);
    }
    else {
      this.model.sheets.push(sheet);
    }

    // if (activate) {
    //   this.ActivateSheetInternal({ key: CommandKey.ActivateSheet, id: sheet.id });
    // }

    if (this.tab_bar) { this.tab_bar.Update(); }

    return sheet.id;

  }

  private DuplicateSheetInternal(command: DuplicateSheetCommand) {

    if (!this.options.add_tab) {
      console.warn('add tab option not set or false');
      return;
    }

    const source = this.ResolveSheet(command);
    const next_id = this.model.sheets.reduce((id, sheet) => Math.max(id, sheet.id), 0) + 1;

    let insert_index = -1;
    for (let i = 0; i < this.model.sheets.length; i++) {
      if (this.model.sheets[i] === source) {
        insert_index = i + 1;
      }
    }
    
    if (!source || insert_index < 0) {
      throw new Error('source sheet not found');
    }

    // explicit insert index

    if (typeof command.insert_before === 'number') {
      insert_index = command.insert_before;
    }
    else if (typeof command.insert_before === 'string') {
      const lc = command.insert_before.toLowerCase();
      for (let i = 0; i < this.model.sheets.length; i++) {
        if (this.model.sheets[i].name.toLowerCase() === lc) {
          insert_index = i;
          break;
        }
      }        
    }

    const options: SerializeOptions = {
      rendered_values: true,
    };

    const clone = Sheet.FromJSON(source.toJSON(options), this.theme_style_properties);
    
    let name = command.new_name || source.name;
    while (this.model.sheets.some((test) => test.name === name)) {
      const match = name.match(/^(.*?)(\d+)$/);
      if (match) {
        name = match[1] + (Number(match[2]) + 1);
      }
      else {
        name = name + '2';
      }
    }

    clone.name = name;
    clone.id = next_id;

    // console.info('CLONE', clone.id, clone);

    this.model.sheets.splice(insert_index, 0, clone);

    if (this.tab_bar) { this.tab_bar.Update(); }

    return clone.id;

  }

  /**
   *
   */
  private ActivateSheetInternal(command: ActivateSheetCommand) {

    const selecting_argument = this.SelectingArgument();

    // console.info('activate sheet', command);

    const candidate = this.ResolveSheet(command) || this.model.sheets[0];

    // ok, activate...

    if (this.active_sheet === candidate) {
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

    // we do the tile rebuild just before the next paint, to prevent
    // flashing. seems to be stable but needs more testing. note that
    // if you call this with render = true, that will happen immediately,
    // synchronously.

    // no longer sending layout event here

    this.QueueLayoutUpdate();

    // this.StyleDefaultFromTheme(); // ?

    // if (render)
    {
      this.Repaint(false, false);
    }

    // FIXME: structure event

    this.grid_events.Publish({
      type: 'sheet-change',
      deactivate,
      activate: this.active_sheet,
    });

    if (this.tab_bar) { this.tab_bar.Update(); }

    this.layout.scroll_offset = this.active_sheet.scroll_offset;

  }

  private ResolveSheet(command: SheetSelection) {
    if (typeof command.index !== 'undefined') {
      return this.model.sheets[command.index];
    }
    if (typeof command.name !== 'undefined') {
      const compare = command.name.toLowerCase();
      for (const sheet of this.model.sheets) {
        if (sheet.name.toLowerCase() === compare) { return sheet; }
      }
    }
    if (command.id) {
      for (const sheet of this.model.sheets) {
        if (sheet.id === command.id) { return sheet; }
      }
    }
    return undefined;
  }

  private ShowSheetInternal(command: ShowSheetCommand) {

    const sheet = this.ResolveSheet(command);

    // invalid
    if (!sheet) { return; }

    // not changed
    if (sheet.visible === command.show) { return; }

    // make sure at least one will be visible after the operation
    if (!command.show) {

      let count = 0;
      for (const test of this.model.sheets) {
        if (!sheet.visible || test === sheet) { count++; }
      }
      if (count >= this.model.sheets.length) {
        throw new Error('can\'t hide all sheets');
      }

    }

    // ok, set
    sheet.visible = command.show;

    // is this current?
    if (sheet === this.active_sheet) {
      for (let i = 0; i < this.model.sheets.length; i++) {
        if (this.model.sheets[i] === this.active_sheet) {
          this.ActivateSheetInternal({
            key: CommandKey.ActivateSheet,
            index: i + 1,
          });
          return;
        }
      }
    }

    // otherwise, just update tabs
    if (this.tab_bar) { this.tab_bar.Update(); }

  }

  private StyleDefaultFromTheme() {

    this.theme_style_properties.font_face = this.theme.grid_cell?.font_face || '';
    this.theme_style_properties.font_size_unit = this.theme.grid_cell?.font_size_unit || 'pt';
    this.theme_style_properties.font_size_value = this.theme.grid_cell?.font_size_value || 10;

    // this.theme_style_properties.text = this.theme.grid_cell?.text || 'none';
    // this.theme_style_properties.text_theme = this.theme.grid_cell?.text_theme || 0;

    // this.theme_style_properties.text = this.theme.grid_cell?.text ?
    //  { ...this.theme.grid_cell?.text } : {};

      /*
    this.theme_style_properties.border_top_color = this.theme.grid_cell?.border_top_color || 'none';
    this.theme_style_properties.border_left_color = this.theme.grid_cell?.border_left_color || 'none';
    this.theme_style_properties.border_right_color = this.theme.grid_cell?.border_right_color || 'none';
    this.theme_style_properties.border_bottom_color = this.theme.grid_cell?.border_bottom_color || 'none';
    */

    /*
    this.theme_style_properties.border_top_fill = {theme: 0};
    this.theme_style_properties.border_left_fill = {theme: 0};
    this.theme_style_properties.border_right_fill = {theme: 0};
    this.theme_style_properties.border_bottom_fill = {theme: 0};
    */

  }

  /* *
   *
   * /
  private PointToAnnotation(point: Point) {

    / *
    if (this.active_annotation &&
        this.active_annotation.rect &&
        this.active_annotation.rect.Contains(point.x, point.y)) {
      return;
    }

    this.active_annotation = undefined;
    * /

    // console.info(point);
    for (const annotation of this.model.annotations) {
      if (annotation.rect && annotation.rect.Contains(point.x, point.y)) {

        // FIXME: z-ordering (or make that implicit in the stack? ...)

        // this.active_annotation = annotation;
        return annotation;
      }
    }

  }
  */

  /**
   * why is this not in layout? (...)
   * how is this layout? it's an effect. make an effects class.
   */
  private HighlightFreezeArea() {

      for (const node of [
        this.layout.corner_selection,
        this.layout.row_header_selection,
        this.layout.column_header_selection]) {

        // in IE11 SVG nodes don't have classList

        const base_class = node.getAttribute('class') || '';

        if (UA.trident) {
          node.setAttribute('class', base_class + ' highlight-area');
        }
        else {
          node.classList.add('highlight-area');
        }

        /*
        node.style.transition = 'background .33s, border-bottom-color .33s, border-right-color .33s';
        node.style.background = this.theme.frozen_highlight_overlay;

        if (this.theme.frozen_highlight_border) {
          node.style.borderBottomColor = this.theme.frozen_highlight_border;
          node.style.borderRightColor = this.theme.frozen_highlight_border;
        }
        */

        setTimeout(() => {
          if (UA.trident) {
            node.setAttribute('class', base_class);
          }
          else {
            node.classList.remove('highlight-area');
          }
          // node.style.background = 'transparent';
          // node.style.borderBottomColor = 'transparent';
          // node.style.borderRightColor = 'transparent';
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
  private QueueLayoutUpdate() {
    this.tile_update_pending = true;
  }

  /*
  private RedispatchEvent(event: KeyboardEvent) {

    let cloned_event: KeyboardEvent;

    if (UA.trident) {
      cloned_event = document.createEvent('KeyboardEvent');
      const modifiers = [];
      if (event.ctrlKey) modifiers.push('Control');
      if (event.altKey) modifiers.push('Alt');
      if (event.shiftKey) modifiers.push('Shift');

      // have to mask type for trident
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cloned_event as any).initKeyboardEvent(
        event.type,
        false,
        false,
        event.view,
        event.key,
        event.location,
        modifiers.join(' '),
        event.repeat,
        Localization.locale);
    }
    else {
      cloned_event = new KeyboardEvent(event.type, event);
    }

    //if (cloned_event && this.container) {
    //  this.container.dispatchEvent(cloned_event);
    //}

    if (cloned_event && this.overlay_editor) {
      this.overlay_editor.edit_node.dispatchEvent(cloned_event);
    }

  }
  */

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
        for (const sheet of this.model.sheets) {
          if (sheet.name.toLowerCase() === lc) { return sheet.id; }
        }
        return this.active_sheet.id; // default to active sheet on short-hand names like "A2"
      }

      const get_sheet = (id?: number) => {
        for (const sheet of this.model.sheets) {
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
              target_area = this.model.named_ranges.Get(parse_result.expression.name);
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
      this.parser,
      this.theme,
      this.model,
      this.options, autocomplete);

    this.formula_bar.autocomplete_matcher = this.autocomplete_matcher;

    this.formula_bar.Subscribe((event) => {

      switch (event.type) {

        case 'address-label-event':
          this.HandleAddressLabelEvent(event.text)
          break;

        case 'stop-editing':

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
          break;

        case 'discard':

          this.editing_state = EditingState.NotEditing;

          if (this.editing_annotation) {
            this.ClearAdditionalSelections();
            this.ClearSelection(this.active_selection);
            if (this.editing_annotation.node) {
              this.editing_annotation.node.focus();
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
            annotation.formula = event.value ? this.FixFormula(event.value) : '';
            if (annotation.node) {
              annotation.node.focus();
            }
            this.grid_events.Publish({ type: 'annotation', event: 'update', annotation });
            this.editing_annotation = undefined;
            this.DelayedRender();
            return;
          }

          if (this.container) this.Focus();

          this.SetInferredType(this.primary_selection, event.value, event.array);
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

            /*
            let cloned_event: KeyboardEvent;
            if (UA.trident) {
              cloned_event = document.createEvent('KeyboardEvent');
              const modifiers = [];
              if (event.event.ctrlKey) modifiers.push('Control');
              if (event.event.altKey) modifiers.push('Alt');
              if (event.event.shiftKey) modifiers.push('Shift');

              // have to mask type for trident
              (cloned_event as any).initKeyboardEvent(
                event.event.type,
                false,
                false,
                event.event.view,
                event.event.key,
                event.event.location,
                modifiers.join(' '),
                event.event.repeat,
                Localization.locale);
            }
            else {
              cloned_event = new KeyboardEvent(event.event.type, event.event);
            }

            if (cloned_event && this.container) {
              this.container.dispatchEvent(cloned_event);
            }
            */
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
        this.parser,
        this.theme,
        this.model,
        autocomplete);

    this.overlay_editor.UpdateTheme(this.layout.scale);
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

    if (this.headless) { return; }

    if (this.tile_update_pending) {
      this.tile_update_pending = false;
      this.layout.UpdateTiles();
      this.render_tiles = this.layout.VisibleTiles();
      this.layout.UpdateAnnotation(this.active_sheet.annotations);

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

    const row_list = [];
    for (let row = start.row; row <= end.row; row++) row_list.push(row);

    const column_list = [];
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
        if (annotation.node) { nodes.push(annotation.node); }

        if (y <= annotation.scaled_rect.top && annotation.move_with_cells) {
          move_annotation_list.push({ annotation, y: annotation.scaled_rect.top, nodes });
        }

        else if (y > annotation.scaled_rect.top && annotation.resize_with_cells) {
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
            this.layout.UpdateAnnotation(this.active_sheet.annotations);

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

          this.ExecCommand({
            key: CommandKey.ResizeRows,
            row: rows,
            height,
          });

          for (const { annotation } of move_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
          }

          for (const { annotation } of size_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
            if (annotation.resize_callback) {
              annotation.resize_callback.call(undefined);
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
        this.Focus();
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
        if (annotation.node) { nodes.push(annotation.node); }

        if (x <= annotation.scaled_rect.left && annotation.move_with_cells) {
          move_annotation_list.push({ annotation, x: annotation.scaled_rect.left, nodes });
        }
        else if (x > annotation.scaled_rect.left && annotation.resize_with_cells) {
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

          // tile_sizes[tile_index] = tile_width + delta;
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
            width,
          });

          for (const { annotation } of move_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
          }

          for (const { annotation } of size_annotation_list) {
            if (annotation.scaled_rect) {
              annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);
            }
            if (annotation.resize_callback) {
              annotation.resize_callback.call(undefined);
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
        this.Focus();
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

    // does this cell have a note?

    let cell = this.active_sheet.cells.GetCell(address, false);

    if (cell?.merge_area) {
      const area = cell.merge_area;
      address = area.start;
      cell = this.active_sheet.cells.GetCell(address, false);
      address = { row: area.start.row, column: area.end.column };
    }

    // just FYI we have separate note/tooltip because if not you could
    // "mask" the one by using the other (whichever one was dominant).

    if (cell?.note) {
      this.layout.ShowNote(cell.note, address, event);
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
      this.layout.ShowTitle('Link: ' + cell.hyperlink, address, event);
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
    for (const part of parts) {
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

    return false;

  }

  /**
   * handles mouse down events on the grid area:
   * selection (click-drag) and editing (double-click)
   */
  private MouseDown_Grid(event: MouseEvent) {

    /* removed, overlay editor does not use
    if (this.overlay_editor?.HandleMouseEvent(event)) {
      return;
    }
    */

    event.stopPropagation();
    event.preventDefault();

    const selecting_argument = this.SelectingArgument();
    
    if (!selecting_argument && this.additional_selections.length) {
      this.ClearAdditionalSelections();
    }

    if (!selecting_argument || !this.formula_bar?.selecting) {

      // not sure why this breaks the formula bar handler

      this.Focus();
        
    }

    // unless we're selecting an argument, close the ICE

    if (this.overlay_editor?.editing && !this.overlay_editor?.selecting) {
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
           Yield().then(() => {
            this.grid_events.Publish({
              type: 'cell-event',
              data: {
                type: 'hyperlink',
                data: link,
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
        });

        if (result.value) {
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

          /*
          if (result.event) {
            Yield().then(() => {
              this.grid_events.Publish({
                type: 'cell-event',
                data: result.event,
              });
            });
          }
          */

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

      if (selecting_argument) {
        if (this.overlay_editor?.editing) {
          // ...
        }
        else if (this.select_argument) {
          // ...
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

    const data: CellValue[][] = [];
    let style: Style.Properties[][] = [];

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
          if (translate) {
            data[row][column] = '=' + this.parser.Render(translate, { rows: offset, columns: 0 })
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

    // if this is a single merged block, we want to insert it as the
    // root cell and not the range.

    // let label = selection.area.spreadsheet_label;

    const data = this.active_sheet.CellData(selection.area.start);
    const target = new Area(data.merge_area ? data.merge_area.start : selection.target);

    let label = this.model.named_ranges.MatchSelection(selection.area, target);

    if (!label) {

      // label = Area.CellAddressToLabel(target.start);
      label = selection.area.spreadsheet_label;
      if (data.merge_area && data.merge_area.Equals(selection.area)) {
        label = Area.CellAddressToLabel(data.merge_area.start);
      }

      if (this.active_sheet.id !== this.editing_cell.sheet_id) {
        const name = this.active_sheet.name;

        if (QuotedSheetNameRegex.test(name)) {
          label = `'${name}'!${label}`;
        }
        else {
          label = `${name}!${label}`;
        }
      }

    }

    if (this.overlay_editor?.editing && this.overlay_editor.selecting) {
      this.overlay_editor.InsertReference(label, 0);
    }
    else if (this.formula_bar && this.formula_bar.selecting) {
      this.formula_bar.InsertReference(label, 0);
    }
    else if (this.select_argument) {
      this.grid_events.Publish({
        type: 'alternate-selection',
        selection: this.active_selection,
      });
    }
  }

  /**
   * unified method to check if we are selecting an argument in the formula
   * bar editor or the in-cell editor
   *
   * FIXME: why is this not an accessor?
   */
  private SelectingArgument() {
    return (this.overlay_editor?.editing && this.overlay_editor?.selecting)
      || (this.formula_bar && this.formula_bar.selecting)
      || (this.select_argument);
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
        case OverlayEditorResult.handled:
          return;

        case OverlayEditorResult.discard:
          this.editing_state = EditingState.NotEditing;
          this.DismissEditor();
          this.DelayedRender();
          return;

        case OverlayEditorResult.commit:

          // FIXME: unify this (to the extent possible) w/ the other editor

          if (this.active_sheet.id !== this.editing_cell.sheet_id) {
            if (this.editing_cell.sheet_id) {
              this.ActivateSheetID(this.editing_cell.sheet_id);
            }
          }
          this.editing_state = EditingState.NotEditing;

          if (this.overlay_editor?.selection) {
            const value = this.overlay_editor?.edit_node.textContent || undefined;
            const array = (event.key === 'Enter' && event.ctrlKey && event.shiftKey);
            this.SetInferredType(this.overlay_editor.selection, value, array);
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

        case 'Delete':
        case 'Del':
          // if (event.shiftKey) // ctrl+shift+delete seems to be "delete history" in all browsers...
          {
            event.stopPropagation();
            event.preventDefault();
            for (let i = 0; i < this.model.sheets.length; i++) {
              if (this.model.sheets[i] === this.active_sheet) {
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
            applied_style.font_bold = !selected_style.font_bold;
            break;

          case 'i':
            applied_style.font_italic = !selected_style.font_italic;
            break;

          case 'u':
            applied_style.font_underline = !selected_style.font_underline;
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
          // console.info('ek', event.key);

          if (!selection.empty) {
            this.OverlayEditCell(selection, true, event);
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
   * array, do nothing.
   */
  private SelectArray() {
    if (this.primary_selection.empty) {
      return;
    }

    const cell = this.active_sheet.CellData(this.primary_selection.target);
    if (!cell || !cell.area) {
      return;
    }

    this.Select(this.primary_selection, cell.area, cell.area.start);
    this.RenderSelections();

  }

  /**
   * render selections. we are wrapping this up in a method so we can
   * hide the primary selection in some cases (one case).
   */
  private RenderSelections(rerender = true) {

    const show_primary_selection = (!this.editing_state) ||
      (this.editing_cell.sheet_id === this.active_sheet.id);

    this.selection_renderer.RenderSelections(show_primary_selection, rerender);
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
    if (!cell || (cell.type === ValueType.undefined && !cell.area)) {
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
          has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
          if (!has_value && cell && cell.merge_area) {
            cell = cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
          }
        }
      }
      else {
        for (let row = selection.area.start.row; !has_value && row <= selection.area.end.row; row++) {
          cell = cells.GetCell({ row, column: test.column }, false);
          has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
          if (!has_value && cell && cell.merge_area) {
            cell = cells.GetCell(cell.merge_area.start, false);
            has_value = has_value || (!!cell && (cell.type !== ValueType.undefined || !!cell.area));
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

  private Error(message: string) {
    console.info('Error', message);
    this.grid_events.Publish({
      type: 'error',
      message,
    });
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
  private SetInferredType(selection: GridSelection, value: string|undefined, array = false, exec = true) {

    // validation: cannot change part of an array without changing the
    // whole array. so check the array. separately, if you are entering
    // an array, make sure that no affected cell is part of an existing
    // array.

    let target = selection.target || selection.area.start;
    const cell = this.active_sheet.CellData(target);

    if (cell.area) {
      if ((!array && cell.area.count > 1) || !selection.area || !selection.area.Equals(cell.area)) {
        // FIXME // this.Publish({type: 'grid-error', err: GridErrorType.ArrayChange, reference: selection.area });
        this.Error(`You can't change part of an array.`);
        return;
      }
    }
    else if (array) {
      let existing_array = false;
      // let reference: Area;
      this.active_sheet.cells.Apply(selection.area, (element: Cell) => {
        if (element.area) {
          // column = column || 0;
          // row = row || 0;
          // reference = new Area({ column, row });
          existing_array = true;
        }
      }, false);
      if (existing_array) {
        // FIXME // this.Publish({type: 'grid-error', err: GridErrorType.ArrayChange, reference });
        this.Error(`You can't change part of an array.`);
        return;
      }
    }

    if (cell.validation) {
      
      let list: CellValue[]|undefined;
      
      if (cell.validation.type === ValidationType.List) {
        list = cell.validation.list;
      }
      else if (cell.validation.type === ValidationType.Range) {
        list = this.GetValidationRange(cell.validation.area);
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
          this.Error(`Invalid value (data validation).`);
          return; 
        }
      }
    }

    if (cell.merge_area) target = cell.merge_area.start; // this probably can't happen at this point

    // first check functions

    const is_function = (typeof value === 'string' && value.trim()[0] === '=');
    const commands: Command[] = [];

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
            const list = formula_parse_result.dependencies;
            for (const key of Object.keys(list.addresses)) {
              const address = list.addresses[key];
              if (this.active_sheet.HasCellStyle({ ...address })) {
                const test = this.active_sheet.CellData({ ...address });
                if (test.style && test.style.number_format) {
                  const style: Style.Properties = {
                    number_format: test.style.number_format,
                  };
                  // if (array) this.model.sheet.UpdateAreaStyle(selection.area, style, true, true);
                  // else this.model.sheet.UpdateCellStyle(target, style, true, true);
                  commands.push({
                    key: CommandKey.UpdateStyle,
                    area: array ? selection.area : target, style, delta: true
                  });
                }
                break;
              }
            }
          }
        }
      }
    }

    // next try to infer the number format, with hints as to format

    const parse_result = ValueParser.TryParse(value);

    if (!is_function && parse_result.type === ValueType.number) {

      // const text = value.toString();

      let number_format = '';
      const hints = parse_result.hints || Hints.None;

      // be stricter about number format. don't implicitly /change/
      // the number format (you can /set/, but don't /change/). 

      // FIXME: in this case, if we're setting a number format from
      // nothing, we could be a little smarter about setting the 
      // decimal places.

      if (!cell.style || !cell.style.number_format || NumberFormatCache.Equals(cell.style.number_format, 'General')) {

        // tslint:disable-next-line:no-bitwise
        if (hints & Hints.Date) {
          number_format = 'Short Date';
        }
        // tslint:disable-next-line:no-bitwise
        else if (hints & Hints.Exponential) {
          number_format = 'Exponential';
        }
        // tslint:disable-next-line:no-bitwise
        else if (hints & Hints.Percent) {
          number_format = 'Percent';
        }
        // tslint:disable-next-line:no-bitwise
        else if (hints & Hints.Currency) {
          number_format = 'Currency';
        }
        // tslint:disable-next-line:no-bitwise
        else if ((hints & Hints.Grouping) || (hints & Hints.Parens)) {
          number_format = 'Accounting';
        }

      }

      /*

      // tslint:disable-next-line:no-bitwise
      if (hints & Hints.Date) {
        if (!cell.style || !cell.style.number_format ||
          (NumberFormatCache.Equals(cell.style.number_format, 'General'))) {
          number_format = 'Short Date';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Exponential) {
        if (!cell.style || !cell.style.number_format || !/e/.test(cell.style.number_format)) {
          number_format = 'Exponential';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Percent) {
        if (!cell.style || !cell.style.number_format || !/%/.test(cell.style.number_format)) {
          number_format = 'Percent';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Currency) {
        if (!cell.style || !cell.style.number_format || !/,/.test(cell.style.number_format)) {
          number_format = 'Currency';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Grouping) {
        if (!cell.style || !cell.style.number_format || !new RegExp(Localization.grouping_separator).test(cell.style.number_format)) {
          number_format = 'Accounting';
        }
      }
      // tslint:disable-next-line:no-bitwise
      else if (hints & Hints.Parens) {
        if (!cell.style || !cell.style.number_format || !/,/.test(cell.style.number_format)) {
          number_format = 'Accounting';
        }
      }

      */

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
    if (parse_result && parse_result.expression) {
      this.parser.Walk(parse_result.expression, (unit) => {
        switch (unit.type) {

          case 'call':
            unit.name = this.autocomplete_matcher.NormalizeIdentifier(unit.name) || unit.name;
            break;

          case 'identifier':
            if (this.model.named_ranges.Get(unit.name)) {
              unit.name = unit.name.toUpperCase();
            }
            break;

        }
        return true;
      });
      formula = '=' + this.parser.Render(parse_result.expression, undefined, '');
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
      this.overlay_editor.active_cell.render_dirty = true;
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
      return cell.value.toString().toUpperCase(); // ? 'True' : 'False';
    }
    else if (cell.ValueIsNumber()) { // no style: I think this is no longer possible
      if (cell_value && Localization.decimal_separator === ',') {
        cell_value = cell.value.toString().replace(/\./, ',');
      }
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

    if (cell.style?.locked) { // if (cell.locked) {
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
    this.overlay_editor?.Edit(selection, rect.Expand(-1, -1), cell, cell_value, event);

    cell.editing = true;
    cell.render_dirty = true;

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

        const area = this.RealArea(selection.area);
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

        // NOTE: this is bounding.
        // FIXME: option to expand the sheet by selecting out of bounds.

        if (address.row >= this.active_sheet.rows && this.options.expand) {
          let row = this.active_sheet.rows;
          while (address.row >= row) { row += 8; }
          this.active_sheet.cells.EnsureRow(row);
          expanded = true;
        }
        if (address.column >= this.active_sheet.columns && this.options.expand) {
          let column = this.active_sheet.columns;
          while (address.column >= column) { column += 8; }
          this.active_sheet.cells.EnsureColumn(column);
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

  /**
   * add an additional selection to the list. don't add it if already
   * on the list (don't stack).
   *
   * we now support empty selections (hiding) in the case of references
   * to other sheets. if we don't do that, the colors get out of sync.
   */
  private AddAdditionalSelection(target: ICellAddress, area: Area): boolean {
    const label = area.spreadsheet_label;
    if (this.additional_selections.some((test) => {
      return (test.area.spreadsheet_label === label);
    })) return false;
    this.additional_selections.push({ target, area });
    return true;
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

    const formula = (this.selected_annotation && this.selected_annotation.formula) ?
      this.selected_annotation.formula : '';

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

      let recheck = true;

      // there has to be a better way to do this...

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

      selection.area = new Area({ ...area.start, sheet_id: this.active_sheet.id }, area.end);
      if (target) {
        selection.target = { ...target, sheet_id: this.active_sheet.id };
      }
      selection.empty = false;

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

    }

  }

  private SetValidationInternal(command: DataValidationCommand): void {

    // find target

    let sheet: Sheet|undefined;
    let cell: Cell|undefined;

    if (!command.target.sheet_id || command.target.sheet_id === this.model.active_sheet.id) {
      sheet = this.model.active_sheet;
    }
    else {
      for (const test of this.model.sheets) {
        if (test.id === command.target.sheet_id) {
          sheet = test;
          break;
        }
      }
    }
    if (sheet) {
      cell = sheet.cells.GetCell(command.target, true);
    }

    if (!cell) {
      throw new Error('invalid cell in set validation');
    }

    if (command.range) {
      cell.validation = {
        type: ValidationType.Range,
        area: command.range,
      };
    }
    else if (command.list) {
      cell.validation = {
        type: ValidationType.List,
        list: JSON.parse(JSON.stringify(command.list)),
      }
    }
    else {
      cell.validation = undefined;
    }

  }

  /**
   * get values from a range of data
   * @param area 
   */
  private GetValidationRange(area: IArea): CellValue[]|undefined {

    let sheet: Sheet|undefined;
    let list: CellValue[]|undefined;

    if (!area.start.sheet_id || area.start.sheet_id === this.model.active_sheet.id) {
      sheet = this.model.active_sheet;
    }
    else {
      for (const test of this.model.sheets) {
        if (test.id === area.start.sheet_id) {
          sheet = test;
          break;
        }
      }
    }
    if (sheet) {
      list = [];

      // clamp to actual area to avoid screwing up sheet
      // FIXME: what does that cause [problem with selections], why, and fix it

      area = sheet.RealArea(new Area(area.start, area.end), true);

      for (let row = area.start.row; row <= area.end.row; row++) {
        for (let column = area.start.column; column <= area.end.column; column++) {
          const cell = sheet.CellData({row, column});
          if (cell && cell.formatted) {
            if (typeof cell.formatted === 'string') {
              list.push(cell.formatted);
            }
            else {
              list.push(NumberFormat.FormatPartsAsText(cell.formatted));
            }
          }
        }
      }
    }

    return list;

  }

  /**
   *
   */
  private UpdateFormulaBarFormula(override?: string) {

    if (!this.formula_bar) { return; }

    if (override) {
      this.formula_bar.formula = override;
      return;
    }

    if (this.primary_selection.empty) {
      this.formula_bar.formula = '';
    }
    else {
      let data = this.active_sheet.CellData(this.primary_selection.target);

      // optimally we would do this check prior to this call, but
      // it's the uncommon case... not sure how important that is

      const head = data.merge_area || data.area;
      if (head) {
        if (head.start.column !== this.primary_selection.target.column
          || head.start.row !== this.primary_selection.target.row) {
          data = this.active_sheet.CellData(head.start);
        }
      }

      // const locked = data.style && data.style.locked;
      this.formula_bar.editable = !data.style?.locked;
      const value = this.NormalizeCellValue(data);

      // this isn't necessarily the best place for this, except that
      // (1) we already have cell data; (2) the calls would generally
      // sync up, so it would be a separate function but called at the
      // same time.

      if (data.validation && !data.style?.locked) {
        
        let list: CellValue[] | undefined;
        
        if (data.validation.type === ValidationType.List) {
          list = data.validation.list;
        }
        else if (data.validation.type === ValidationType.Range) {
          list = this.GetValidationRange(data.validation.area);
        }

        if (list && list.length) {
          this.layout.ShowDropdownCaret(
            (data.merge_area || new Area(this.primary_selection.target)), 
            list, data.value);
        }

      }
      else {
        this.layout.HideDropdownCaret();
      }

      // add braces for area
      if (data.area) {
        this.formula_bar.formula = '{' + (value || '') + '}';
      }
      else {
        this.formula_bar.formula = (typeof value !== 'undefined') ? value.toString() : ''; // value || ''; // what about zero?
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

      const data = this.active_sheet.CellData(this.primary_selection.target);
      const target = new Area(data.merge_area ? data.merge_area.start : selection.target);

      this.formula_bar.label = 
      this.model.named_ranges.MatchSelection(selection.area, target)
        || Area.CellAddressToLabel(target.start);

    }

  }

  private OnDropdownSelect(value: CellValue) {

    if (typeof value !== 'undefined') {
      const result = ValueParser.TryParse(value.toString());
      if (result.type === ValueType.number) {
        value = result.value;
      }
    }

    const data = this.active_sheet.CellData(this.primary_selection.target);
    const area = data.merge_area ? data.merge_area.start : this.primary_selection.target;

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
    //this.layout.grid_cover.addEventListener('mouseup', () => {
    // // console.info('cfu', this.capture);
    //  this.Focus();
    //})

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

    /*
    this.container.addEventListener('compositionstart', (event) => {
      console.info('composition start!');
    });
    */

    // select all?
    this.layout.corner.addEventListener('dblclick', () => {
      this.SelectAll();
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

          if (this.selected_annotation.node) {
            // this.selected_annotation.node.innerHTML;
            const node = this.selected_annotation.node.firstChild;
            if (node) {
              const html = (SerializeHTML(node as Element) as HTMLElement).outerHTML;

              // no other format supported? (...)
              const type = 'text/plain';
              event.clipboardData.setData(type, html);
              // console.info(html);
            }
          }
        }
      }
    }
    else {

      const area = this.active_sheet.RealArea(this.primary_selection.area);
      const columns = area.columns;
      const rows = area.rows;

      // const cells = this.active_sheet.cells;
      const tsv_data: CellValue[][] = [];
      const treb_data: ClipboardCellData[] = [];

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
          tsv_row.push(typeof cell.calculated === 'undefined' ? cell.value : cell.calculated);
          
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
        event.clipboardData.setData('text/x-treb', JSON.stringify({ source: area, data: treb_data }));
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
            for (const sheet of this.model.sheets) {
              if (sheet.id === composite.source) {
                name = sheet.name;
                break;
              }
            }
            if (name) {
              const parse_result = this.parser.Parse(composite.data.formula);
              if (parse_result.expression) {
                this.parser.Walk(parse_result.expression, (unit) => {
                  if (unit.type === 'address') {
                    if (!unit.sheet_id && !unit.sheet) {
                      unit.sheet = name;
                    }
                  }
                  return true;
                });
                composite.data.formula = '=' + this.parser.Render(parse_result.expression, undefined, '');
              }
            }
          }
        }
        const annotation = this.CreateAnnotation(composite.data, true, true);
        if (annotation.node) {
          const node = annotation.node;
          setTimeout(() => {
            node.focus();
          }, 1);
        }
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

            if (cell_info.array) {

              const target_array = {
                start: {
                  ...target_address,
                }, end: {
                  row: target_address.row + cell_info.array.rows - 1,
                  column: target_address.column + cell_info.array.columns - 1,
                },
              };

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
                commands.push({ key: CommandKey.SetRange, value: data, area: target_address });
              }

            }

            commands.push({ key: CommandKey.UpdateStyle, style: cell_info.style || {}, area: target_address });

          });

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

  private FreezeInternal(command: FreezeCommand) {

    // default true
    const highlight = ((typeof command.highlight_transition) === 'boolean')
      ? command.highlight_transition
      : true;

    //    if (command.rows === this.layout.freeze.rows &&
    //      command.columns === this.layout.freeze.columns) {
    if (command.rows === this.active_sheet.freeze.rows &&
      command.columns === this.active_sheet.freeze.columns) {
      if (highlight) {
        this.HighlightFreezeArea();
      }
      return;
    }

    // this.layout.freeze.rows = command.rows;
    // this.layout.freeze.columns = command.columns;
    this.active_sheet.freeze.rows = command.rows;
    this.active_sheet.freeze.columns = command.columns;

    // FIXME: should we do this via events? (...)

    // we are sending an event via the exec command method that calls
    // this method, so we are not relying on the side-effect event anymore

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

  /**
   * rename a sheet. this requires changing any formulae that refer to the
   * old name to refer to the new name. if there are any references by ID
   * those don't have to change.
   *
   * FIXME: can we do this using the dependency graph? (...)
   */
  private RenameSheetInternal(target: Sheet, name: string) {

    // validate name... ?

    if (!name || IllegalSheetNameRegex.test(name)) {
      throw new Error('invalid sheet name');
    }

    // also can't have two sheets with the same name

    const compare = name.toLowerCase();
    for (const sheet of this.model.sheets) {
      if (sheet !== target && sheet.name.toLowerCase() === compare) {
        throw new Error('sheet name already exists');
      }
    }

    const old_name = target.name.toLowerCase();
    target.name = name;
    for (const sheet of this.model.sheets) {

      // cells
      sheet.cells.IterateAll((cell: Cell) => {
        if (cell.ValueIsFormula()) {
          let modified = false;
          const parsed = this.parser.Parse(cell.value || '');
          if (parsed.expression) {
            this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
              if (element.type === 'address') {
                if (element.sheet && element.sheet.toLowerCase() === old_name) {
                  element.sheet = name;
                  modified = true;
                }
              }
              return true; // continue walk
            });
            if (modified) {
              cell.value = '=' + this.parser.Render(parsed.expression, undefined, '');
            }
          }
        }
      });

      // annotations
      for (const annotation of sheet.annotations) {
        if (annotation.formula) {
          let modified = false;
          const parsed = this.parser.Parse(annotation.formula || '');
          if (parsed.expression) {
            this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {
              if (element.type === 'address') {
                if (element.sheet && element.sheet.toLowerCase() === old_name) {
                  element.sheet = name;
                  modified = true;
                }
              }
              return true; // continue walk
            });
            if (modified) {
              annotation.formula = '=' + this.parser.Render(parsed.expression, undefined, '');
            }
          }
        }
      }
    }

  }

  /** 
   * this function now works for both rows and columns, and can handle
   * sheets other than the active sheet. it does assume that you only ever
   * add rows/columns on the active sheet, but since that's all parameterized
   * you could get it to work either way.
   * 
   * in fact we should change the names of those parameters so it's a little
   * more generic.
   */
  private PatchFormulasInternal(source: string,
    before_row: number,
    row_count: number,
    before_column: number,
    column_count: number,
    active_sheet_name: string,
    active_sheet: boolean) {

    const parsed = this.parser.Parse(source || '');
    let modified = false;

    // the sheet test is different for active sheet/non-active sheet.

    // on the active sheet, check for no name OR name === active sheet name.
    // on other sheets, check for name AND name === active sheet name.

    if (parsed.expression) {
      this.parser.Walk(parsed.expression, (element: ExpressionUnit) => {

        if (element.type === 'range' || element.type === 'address') {

          // we can test if we need to modify a range or an address, but the 
          // second address in a range can't be tested properly. so the solution
          // here is to just capture the addresses that need to be modified
          // from the range, and then not recurse (we should never get here
          // as an address in a range).

          const addresses: UnitAddress[] = [];

          if (element.type === 'range') {

            // there's a problem: this breaks because the inner test fails when
            // this is TRUE... we may need to modify

            // recurse if (1) explicit name match; or (2) no name AND we are on the active sheet

            // return ((element.start.sheet && element.start.sheet.toLowerCase() === active_sheet_name) || (!element.start.sheet && active_sheet));


            if ((element.start.sheet && element.start.sheet.toLowerCase() === active_sheet_name) || (!element.start.sheet && active_sheet)) {
              addresses.push(element.start, element.end);
            }

          }
          else if (element.type === 'address') {
            if ((element.sheet && element.sheet.toLowerCase() === active_sheet_name) || (!element.sheet && active_sheet)) {
              addresses.push(element);
            }

          }

          // could switch the tests around? (referring to the count
          // tests, which switch on operation)

          for (const address of addresses) {

            if (row_count && address.row >= before_row) {
              if (row_count < 0 && address.row + row_count < before_row) {
                address.column = address.row = -1;
              }
              else {
                address.row += row_count;
              }
              modified = true;
            }
            if (column_count && address.column >= before_column) {
              if (column_count < 0 && address.column + column_count < before_column) {
                address.column = address.row = -1; // set as invalid (-1)
              }
              else {
                address.column += column_count;
              }
              modified = true;
            }

          }

          return false; // always explicit

        }

        return true; // recurse for everything else

      });

      if (modified) {
        return '=' + this.parser.Render(parsed.expression, undefined, '');
      }
    }

    return undefined;

  }

  /**
   * FIXME: should be API method
   * FIXME: need to handle annotations that are address-based
   *
   * @see InsertColumns for inline comments
   */
  private InsertRowsInternal(command: InsertRowsCommand) { // before_row = 0, count = 1) {

    if (!this.active_sheet.InsertRows(command.before_row, command.count)){
      this.Error(`You can't change part of an array.`);
      return;
    }

    this.model.named_ranges.PatchNamedRanges(0, 0, command.before_row, command.count);

    const active_sheet_name = this.active_sheet.name.toLowerCase();

    for (const sheet of this.model.sheets) {
      const active_sheet = sheet === this.active_sheet;

      sheet.cells.IterateAll((cell: Cell) => {
        if (cell.ValueIsFormula()) {
          const modified = this.PatchFormulasInternal(cell.value || '',
            command.before_row, command.count, 0, 0,
            active_sheet_name, active_sheet);
          if (modified) {
            cell.value = modified;
          }
        }
      });

      for (const annotation of sheet.annotations) {
        if (annotation.formula) {
          const modified = this.PatchFormulasInternal(annotation.formula || '',
            command.before_row, command.count, 0, 0,
            active_sheet_name, active_sheet);
          if (modified) {
            annotation.formula = modified;
          }
        }
      }

    }

    // annotations

    const update_annotations_list: Annotation[] = [];
    const resize_annotations_list: Annotation[] = [];

    if (command.count > 0) {

      const start = this.layout.CellAddressToRectangle({
        row: command.before_row,
        column: 0,
      });

      const height = this.layout.default_row_height * command.count + 1; // ?

      for (const annotation of this.active_sheet.annotations) {
        if (annotation.scaled_rect) {

          if (start.top >= annotation.scaled_rect.bottom) {
            continue;
          }
          else if (start.top <= annotation.scaled_rect.top) {
            annotation.scaled_rect.top += (height - 1); // grid
          }
          else {
            annotation.scaled_rect.height += height;
            resize_annotations_list.push(annotation);
          }
          
          // annotation.rect = annotation.scaled_rect.Scale(1/this.layout.scale);
          annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);

          update_annotations_list.push(annotation);
        }
      }

    }
    else if (command.count < 0) { // delete

      let rect = this.layout.CellAddressToRectangle({
        row: command.before_row,
        column: 0,
      });

      if (command.count < -1) {
        rect = rect.Combine(this.layout.CellAddressToRectangle({
          row: command.before_row - command.count - 1,
          column: 0,
        }));
      }

      for (const annotation of this.active_sheet.annotations) {
        if (annotation.scaled_rect) {

          if (annotation.scaled_rect.bottom <= rect.top) {
            continue; // unaffected
          }

          // affected are is entirely above of annotation: move only
          if (annotation.scaled_rect.top >= rect.bottom - 1) { // grid
            annotation.scaled_rect.top -= (rect.height);
          }

          // affected area is entirely underneath the annotation: size only
          else if (annotation.scaled_rect.top <= rect.top && annotation.scaled_rect.bottom >= rect.bottom) {
            annotation.scaled_rect.height = Math.max(annotation.scaled_rect.height - rect.height, 10);
            resize_annotations_list.push(annotation);
          }

          // affected area completely contains the annotation: do nothing, or delete? (...)
          else if (annotation.scaled_rect.top >= rect.top && annotation.scaled_rect.bottom <= rect.bottom) {
            // ...
            continue; // do nothing, for now
          }

          // top edge: shift AND clip?
          else if (annotation.scaled_rect.top >= rect.top && annotation.scaled_rect.bottom > rect.bottom) {
            const shift = annotation.scaled_rect.top - rect.top + 1; // grid
            const clip = rect.height - shift;
            annotation.scaled_rect.top -= shift;
            annotation.scaled_rect.height = Math.max(annotation.scaled_rect.height - clip, 10);
            resize_annotations_list.push(annotation);
          }

          // bottom edge: clip, I guess
          else if (annotation.scaled_rect.top < rect.top && annotation.scaled_rect.bottom <= rect.bottom) {
            const clip = annotation.scaled_rect.bottom - rect.top;
            annotation.scaled_rect.height = Math.max(annotation.scaled_rect.height - clip, 10);
            resize_annotations_list.push(annotation);
          }

          else {
            console.info('unhandled case');
            // console.info("AR", annotation.rect, "R", rect);
          }

          // annotation.rect = annotation.scaled_rect.Scale(1/this.layout.scale);
          annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);

          update_annotations_list.push(annotation);

        }

      }


    }

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

    // note event is sent in exec command, not implicit here

    this.QueueLayoutUpdate();

    // we need to repaint (not render) because repaint adjusts the selection
    // canvas for tile layout. FIXME: move that out of repaint so we can call
    // it directly.

    this.Repaint();

    if (update_annotations_list.length) {
      this.layout.UpdateAnnotation(update_annotations_list);
      for (const annotation of resize_annotations_list) {
        if (annotation.resize_callback) {
          annotation.resize_callback.call(undefined);
        }
      }
    }

  }

  /**
   * FIXME: should be API method
   * FIXME: need to handle annotations that are address-based
   */
  private InsertColumnsInternal(command: InsertColumnsCommand) { // before_column = 0, count = 1) {

    if (!this.active_sheet.InsertColumns(command.before_column, command.count)) {
      this.Error(`You can't change part of an array.`);
      return;
    }
    
    this.model.named_ranges.PatchNamedRanges(command.before_column, command.count, 0, 0);

    // FIXME: we need an event here? 

    // A: caller sends a "structure" event after this call. that doesn't include
    //    affected areas, though. need to think about whether structure event
    //    triggers a recalc (probably should). we could track whether we've made
    //    any modifications (and maybe also whether we now have any invalid 
    //    references)

    // patch all sheets

    // you know we have a calculator that has backward-and-forward references.
    // we could theoretically ask the calculator what needs to be changed.
    //
    // for the most part, we try to maintain separation between the display
    // (this) and the calculator. we could ask, but this isn't terrible and 
    // helps maintain that separation.

    const active_sheet_name = this.active_sheet.name.toLowerCase();

    for (const sheet of this.model.sheets) {
      const active_sheet = sheet === this.active_sheet;

      sheet.cells.IterateAll((cell: Cell) => {
        if (cell.ValueIsFormula()) {
          const modified = this.PatchFormulasInternal(cell.value || '', 0, 0,
            command.before_column, command.count,
            active_sheet_name, active_sheet);
          if (modified) {
            cell.value = modified;
          }
        }
      });

      for (const annotation of sheet.annotations) {
        if (annotation.formula) {
          const modified = this.PatchFormulasInternal(annotation.formula,
            0, 0, command.before_column, command.count,
            active_sheet_name, active_sheet);
          if (modified) {
            annotation.formula = modified;
          }
        }
      }

    }

    // annotations

    const update_annotations_list: Annotation[] = [];
    const resize_annotations_list: Annotation[] = [];

    if (command.count > 0) {

      const start = this.layout.CellAddressToRectangle({
        row: 0,
        column: command.before_column,
      });

      const width = this.layout.default_column_width * command.count + 1; // ?

      for (const annotation of this.active_sheet.annotations) {
        if (annotation.scaled_rect) {

          if (start.left >= annotation.scaled_rect.right) {
            continue;
          }
          else if (start.left <= annotation.scaled_rect.left) {
            annotation.scaled_rect.left += (width - 1); // grid
          }
          else {
            annotation.scaled_rect.width += width;
            resize_annotations_list.push(annotation);
          }

          // annotation.rect = annotation.scaled_rect.Scale(1/this.layout.scale);
          annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);

          update_annotations_list.push(annotation);
        }
      }

    }
    else if (command.count < 0) { // delete

      let rect = this.layout.CellAddressToRectangle({
        row: 0,
        column: command.before_column,
      });

      if (command.count < -1) {
        rect = rect.Combine(this.layout.CellAddressToRectangle({
          row: 0,
          column: command.before_column - command.count - 1,
        }));
      }

      for (const annotation of this.active_sheet.annotations) {
        if (annotation.scaled_rect) {

          if (annotation.scaled_rect.right <= rect.left) {
            continue; // unaffected
          }

          // affected are is entirely to the left of annotation: move only
          if (annotation.scaled_rect.left >= rect.right - 1) { // grid
            annotation.scaled_rect.left -= (rect.width);
          }

          // affected area is entirely underneath the annotation: size only
          else if (annotation.scaled_rect.left <= rect.left && annotation.scaled_rect.right >= rect.right) {
            annotation.scaled_rect.width = Math.max(annotation.scaled_rect.width - rect.width, 10);
            resize_annotations_list.push(annotation);
          }

          // affected area completely contains the annotation: do nothing, or delete? (...)
          else if (annotation.scaled_rect.left >= rect.left && annotation.scaled_rect.right <= rect.right) {
            // ...
            continue; // do nothing, for now
          }

          // left edge: shift AND clip?
          else if (annotation.scaled_rect.left >= rect.left && annotation.scaled_rect.right > rect.right) {
            const shift = annotation.scaled_rect.left - rect.left + 1; // grid
            const clip = rect.width - shift;
            annotation.scaled_rect.left -= shift;
            annotation.scaled_rect.width = Math.max(annotation.scaled_rect.width - clip, 10);
            resize_annotations_list.push(annotation);
          }

          // right edge: clip, I guess
          else if (annotation.scaled_rect.left < rect.left && annotation.scaled_rect.right <= rect.right) {
            const clip = annotation.scaled_rect.right - rect.left;
            annotation.scaled_rect.width = Math.max(annotation.scaled_rect.width - clip, 10);
            resize_annotations_list.push(annotation);
          }

          else {
            console.info('unhandled case');
            // console.info("AR", annotation.rect, "R", rect);
          }

          // annotation.rect = annotation.scaled_rect.Scale(1/this.layout.scale);
          annotation.layout = this.layout.RectToAnnotationLayout(annotation.scaled_rect);

          update_annotations_list.push(annotation);

        }

      }


    }

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

    // note event is sent in exec command, not implicit here

    this.QueueLayoutUpdate();

    // @see InsertColumnsInternal re: why repaint

    this.Repaint();

    if (update_annotations_list.length) {
      this.layout.UpdateAnnotation(update_annotations_list);
      for (const annotation of resize_annotations_list) {
        if (annotation.resize_callback) {
          annotation.resize_callback.call(undefined);
        }
      }
    }

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

    let sheet = this.active_sheet;
    if (command.area.start.sheet_id && command.area.start.sheet_id !== this.active_sheet.id) {
      for (const compare of this.model.sheets) {
        if (compare.id === command.area.start.sheet_id) {
          sheet = compare;
          break;
        }
      }
    }

    const top: Style.Properties = { border_top: width };
    const bottom: Style.Properties = { border_bottom: width };
    const left: Style.Properties = { border_left: width };
    const right: Style.Properties = { border_right: width };

    const clear_top: Style.Properties = { border_top: 0 };
    const clear_bottom: Style.Properties = { border_bottom: 0 };
    const clear_left: Style.Properties = { border_left: 0 };
    const clear_right: Style.Properties = { border_right: 0 };

    // default to "none", which means "default"

    //if (!command.color) {
    //  command.color = 'none';
    //}

    //if (typeof command.color !== 'undefined') {
    if (command.color) {

      // this is now an object so we need to clone it (might be faster to JSON->JSON)

      top.border_top_fill = {...command.color};
      bottom.border_bottom_fill = {...command.color};
      left.border_left_fill = {...command.color};
      right.border_right_fill = {...command.color};

    }

    // inside all/none
    if (borders === BorderConstants.None || borders === BorderConstants.All) {
      sheet.UpdateAreaStyle(area, {
        ...top, ...bottom, ...left, ...right,
      }, true);
    }

    // top
    if (borders === BorderConstants.Top || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        sheet.UpdateAreaStyle(area.top, { ...top }, true);
      }
    }

    // mirror top (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Top) {
      if (!area.entire_column) {
        if (area.start.row) {
          sheet.UpdateAreaStyle(new Area(
            { row: area.start.row - 1, column: area.start.column },
            { row: area.start.row - 1, column: area.end.column }), { ...clear_bottom }, true);
        }
      }
    }

    // bottom
    if (borders === BorderConstants.Bottom || borders === BorderConstants.Outside) {
      if (!area.entire_column) {
        sheet.UpdateAreaStyle(area.bottom, { ...bottom }, true);
      }
    }

    // mirror bottom (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Bottom) {
      if (!area.entire_column) {
        sheet.UpdateAreaStyle(new Area(
          { row: area.end.row + 1, column: area.start.column },
          { row: area.end.row + 1, column: area.end.column }), { ...clear_top }, true);
      }
    }

    // left
    if (borders === BorderConstants.Left || borders === BorderConstants.Outside) {
      if (!area.entire_row) {
        sheet.UpdateAreaStyle(area.left, { ...left }, true);
      }
    }

    // mirror left (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Left) {
      if (!area.entire_row) {
        if (area.start.column) {
          sheet.UpdateAreaStyle(new Area(
            { row: area.start.row, column: area.start.column - 1 },
            { row: area.end.row, column: area.start.column - 1 }), { ...clear_right }, true);
        }
      }
    }

    // right
    if (borders === BorderConstants.Right || borders === BorderConstants.Outside) {
      if (!area.entire_row) {
        sheet.UpdateAreaStyle(area.right, { ...right }, true);
      }
    }

    // mirror right (CLEAR)
    if (borders === BorderConstants.None || borders === BorderConstants.All ||
      borders === BorderConstants.Outside || borders === BorderConstants.Right) {
      if (!area.entire_row) {
        sheet.UpdateAreaStyle(new Area(
          { row: area.start.row, column: area.end.column + 1 },
          { row: area.end.row, column: area.end.column + 1 }), { ...clear_left }, true);
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

    return Area.Bleed(area);

    /*
    return new Area(
      {
        row: Math.max(0, area.start.row - 1),
        column: Math.max(0, area.start.column - 1),
      }, {
      row: area.end.row + 1,
      column: area.end.column + 1,
    },
    );
    */

  }

  /**
   * set range, via command. returns affected area.
   */
  private SetRangeInternal(command: SetRangeCommand) {

    const area = IsCellAddress(command.area)
      ? new Area(command.area)
      : new Area(command.area.start, command.area.end);

    let sheet = this.active_sheet;
    if (area.start.sheet_id && area.start.sheet_id !== this.active_sheet.id) {
      for (const compare of this.model.sheets) {
        if (compare.id === area.start.sheet_id) {
          sheet = compare;
          break;
        }
      }
    }

    if (!area.entire_row && !area.entire_column && (
      area.end.row >= sheet.rows
      || area.end.column >= sheet.columns)) {

      // we have to call this because the 'set area' method calls RealArea
      sheet.cells.EnsureCell(area.end);

      // should we send a structure event here? we may be increasing the
      // size, in which case we should send the event. even though no addresses
      // change, there are new cells.

      this.QueueLayoutUpdate();

    }

    // originally we called sheet methods here, but all the sheet
    // does is call methods on the cells object -- we can shortcut.

    // is that a good idea? (...)

    // at a minimum we can consolidate...

    if (IsCellAddress(command.area)) {

      // FIXME: should throw if we try to set part of an array

      const cell = sheet.CellData(command.area);
      if (cell.area && (cell.area.rows > 1 || cell.area.columns > 1)) {
        // throw new Error('can\'t change part of an array');
        this.Error(`You can't change part of an array.`);
        return;
      }

      // single cell
      // UPDATE: could be array

      // type is value|value[][], pull out first value. at some point 
      // we may have supported value[], or maybe they were passed in 
      // accidentally, but check regardless.

      const value = Array.isArray(command.value) ?
        Array.isArray(command.value[0]) ? command.value[0][0] : command.value[0] : command.value;

      if (command.array) {
        sheet.SetArrayValue(area, value);
      }
      else {
        sheet.SetCellValue(command.area, value);
      }

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

        const value = Array.isArray(command.value) ?
          Array.isArray(command.value[0]) ? command.value[0][0] : command.value[0] : command.value;
        
        sheet.SetArrayValue(area, value);
      }
      else {
        sheet.SetAreaValues2(area, command.value);
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

  private ClearAreaInternal(area: Area) {

    let error = false;
    area = this.active_sheet.RealArea(area); // collapse

    this.active_sheet.cells.Apply(area, (cell) => {
      if (cell.area && !area.ContainsArea(cell.area)) {
        // throw new Error('can\'t change part of an array');
        error = true;
      }
    });

    if (error) {
      this.Error(`You can't change part of an array.`);
    }
    else {
      this.active_sheet.ClearArea(area);
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
  private ExecCommand(commands: Command | Command[]) {

    // FIXME: support ephemeral commands (...)

    let render_area: Area | undefined;
    let data_area: Area | undefined;
    let style_area: Area | undefined;
    let structure_event = false;
    let structure_rebuild_required = false;

    const events: GridEvent[] = [];

    // this seems like the dumb way to do this... maybe?
    if (!Array.isArray(commands)) commands = [commands];

    // gate on subscribers? (...)
    this.command_log.Publish({ command: commands, timestamp: new Date().getTime() });

    for (const command of commands) {

      // console.log(CommandKey[command.key], JSON.stringify(command));

      switch (command.key) {
        case CommandKey.Clear:
          if (command.area) {
            const area = new Area(command.area.start, command.area.end);
            // this.active_sheet.ClearArea(area, true);
            this.ClearAreaInternal(area);
            data_area = Area.Join(area, data_area);
            this.UpdateFormulaBarFormula();
          }
          else {
            Sheet.Reset();
            this.RemoveAnnotationNodes();
            this.UpdateSheets([], true);
            this.model.named_ranges.Reset();
            this.model.macro_functions = {};
            this.ClearSelection(this.primary_selection);
            this.ScrollIntoView({ row: 0, column: 0 });
            this.QueueLayoutUpdate(); // necessary? (...)
            this.layout.HideNote();
          }
          break;

        case CommandKey.Select:

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

          break;

        case CommandKey.Freeze:
          this.FreezeInternal(command);

          // is the event necessary here? not sure. we were sending it as a
          // side effect, so it was added here in case there was some reason
          // it was necessary. at a minimum, it should not require a rebuild
          // because no addresses change. (although we leave it in case someone
          // else sets it).)

          structure_event = true;
          // structure_rebuild_required = true;

          break;

        case CommandKey.MergeCells:
          this.active_sheet.MergeCells(
            new Area(command.area.start, command.area.end));

          render_area = Area.Join(command.area, render_area);

          // FIXME: sheet publishes a data event here, too. probably a good
          // idea because references to the secondary (non-head) merge cells
          // will break.

          structure_event = true;
          structure_rebuild_required = true;
          data_area = Area.Join(command.area, data_area);
          break;

        case CommandKey.UnmergeCells:
          {
            // the sheet unmerge routine requires a single, contiguous merge area.
            // we want to support multiple unmerges at the same time, though,
            // so let's check for multiple. create a list.

            const list: Record<string, Area> = {};
            const area = new Area(command.area.start, command.area.end);

            this.active_sheet.cells.Apply(area, (cell: Cell) => {
              if (cell.merge_area) {
                const label = Area.CellAddressToLabel(cell.merge_area.start) + ':'
                  + Area.CellAddressToLabel(cell.merge_area.end);
                list[label] = cell.merge_area;
              }
            }, false);

            const keys = Object.keys(list);

            for (let i = 0; i < keys.length; i++) {
              this.active_sheet.UnmergeCells(list[keys[i]]);
            }

            // see above

            render_area = Area.Join(command.area, render_area);
            data_area = Area.Join(command.area, data_area);
            structure_event = true;
            structure_rebuild_required = true;
          }
          break;

        case CommandKey.UpdateStyle:
          {
            // to account for our background bleeding up/left, when applying
            // style changes we may need to render one additional row/column.

            let area: Area|undefined;
            let sheet = this.active_sheet;

            if (IsCellAddress(command.area)) {
              area = new Area(command.area);
              if (area.start.sheet_id && area.start.sheet_id !== this.active_sheet.id) {
                for (const test of this.model.sheets) {
                  if (test.id === area.start.sheet_id) {
                    sheet = test;
                    break;
                  }
                }
              }
              sheet.UpdateCellStyle(command.area, command.style, !!command.delta);
            }
            else {
              area = new Area(command.area.start, command.area.end);
              if (area.start.sheet_id && area.start.sheet_id !== this.active_sheet.id) {
                for (const test of this.model.sheets) {
                  if (test.id === area.start.sheet_id) {
                    sheet = test;
                    break;
                  }
                }
              }
              sheet.UpdateAreaStyle(area, command.style, !!command.delta);
            }

            if (sheet === this.active_sheet) {
              style_area = Area.Join(area, style_area);
            
              // we can limit bleed handling to cases where it's necessary...
              // if we really wanted to optimize we could call invalidate on .left, .top, &c

              if (!command.delta 
                  || command.style.fill
                  || command.style.border_top
                  || command.style.border_left
                  || command.style.border_right
                  || command.style.border_bottom) {

                area = Area.Bleed(area); // bleed by 1 to account for borders/background 
                this.active_sheet.Invalidate(area);

              }

              render_area = Area.Join(area, render_area);
              
            }
          }

          break;

        case CommandKey.DataValidation:
          this.SetValidationInternal(command);
          render_area = Area.Join(new Area(command.target), render_area);
          break;

        case CommandKey.SetName:
          if (command.area) {
            this.model.named_ranges.SetName(command.name,
              new Area(command.area.start, command.area.end));
            this.autocomplete_matcher.AddFunctions({
              type: DescriptorType.Token,
              name: command.name,
            });
          }
          else {
            this.model.named_ranges.ClearName(command.name);
            this.autocomplete_matcher.RemoveFunctions({
              type: DescriptorType.Token,
              name: command.name,
            });
          }
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.UpdateBorders:
          {
            const area = this.ApplyBordersInternal(command);
            render_area = Area.Join(area, render_area);
            style_area = Area.Join(area, style_area);
          }
          break;

        case CommandKey.ShowSheet:
          this.ShowSheetInternal(command);
          structure_event = true;
          break;

        case CommandKey.ReorderSheet:
          {
            const sheets: Sheet[] = [];
            const target = this.model.sheets[command.index];

            for (let i = 0; i < this.model.sheets.length; i++) {
              if (i !== command.index) {
                if (i === command.move_before) {
                  sheets.push(target);
                }
                sheets.push(this.model.sheets[i]);
              }
            }

            if (command.move_before >= this.model.sheets.length) {
              sheets.push(target);
            }

            this.model.sheets = sheets;
            if (this.tab_bar) { this.tab_bar.Update(); }
            structure_event = true;

          }
          break;

        case CommandKey.RenameSheet:
          {
            const sheet = this.ResolveSheet(command);
            if (sheet) {
              this.RenameSheetInternal(sheet, command.new_name);
              if (this.tab_bar) { this.tab_bar.Update(); }
              structure_event = true;
            }
          }
          break;

        case CommandKey.ResizeRows:
          {
            let row = command.row;
            if (typeof row === 'undefined') {
              row = [];
              for (let i = 0; i < this.active_sheet.rows; i++) row.push(i);
            }

            if (typeof row === 'number') row = [row];
            if (typeof command.height === 'number') {
              for (const entry of row) {
                this.layout.SetRowHeight(entry, command.height);
              }
            }
            else {
              for (const entry of row) {
                this.active_sheet.AutoSizeRow(entry, this.theme.grid_cell);
              }
            }

            /*
            const area = new Area(
              { column: Infinity, row: row[0] },
              { column: Infinity, row: row[row.length - 1] });
            */

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

            this.layout.UpdateAnnotation(this.active_sheet.annotations);
            structure_event = true;
            this.RenderSelections();

          }
          break;

        case CommandKey.ResizeColumns:
          {
            let column = command.column;

            if (typeof column === 'undefined') {
              column = [];
              for (let i = 0; i < this.active_sheet.columns; i++) column.push(i);
            }

            if (typeof column === 'number') column = [column];

            if (typeof command.width === 'number') {
              for (const entry of column) {
                this.layout.SetColumnWidth(entry, command.width);
              }
            }
            else {
              for (const entry of column) {
                this.active_sheet.AutoSizeColumn(entry, false);
              }
            }

            /*
             why are we not tracking this? is it because one of the subsequent
             calls fires its own event? (...) if so, why are we setting the
             structure_event flag? (...)
  
            const area = new Area(
              {row: Infinity, column: column[0]},
              {row: Infinity, column: column[column.length - 1]});
  
            */

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

            this.layout.UpdateAnnotation(this.active_sheet.annotations);
            structure_event = true;
            this.RenderSelections();

          }
          break;

        case CommandKey.ShowHeaders:

          // FIXME: now that we don't support 2-level headers (or anything
          // other than 1-level headers), headers should be managed by/move into
          // the grid class.

          this.active_sheet.SetHeaderSize(command.show ? undefined : 1, command.show ? undefined : 1);
          this.QueueLayoutUpdate();
          this.Repaint();
          break;

        case CommandKey.InsertRows:
          this.InsertRowsInternal(command);
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.InsertColumns:
          this.InsertColumnsInternal(command);
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.SetLink:
        case CommandKey.SetNote:
          {
            // note and link are basically the same, although there's a 
            // method for setting note (not sure why)

            let sheet = this.active_sheet;
            if (command.address.sheet_id) {
              for (const test of this.model.sheets) {
                if (test.id === command.address.sheet_id) {
                  sheet = test;
                  break;
                }
              }
            }

            let cell = sheet.cells.GetCell(command.address, true);
            if (cell) {

              let area: Area;
              if (cell.merge_area) {
                area = new Area(cell.merge_area.start);
                cell = sheet.cells.GetCell(cell.merge_area.start, true);
              }
              else {
                area = new Area(command.address);
              }

              if (command.key === CommandKey.SetNote) {
                cell.SetNote(command.note);
              }
              else {
                cell.hyperlink = command.reference || undefined;
                cell.render_dirty = true;
              }

              if (sheet === this.active_sheet) {
                this.DelayedRender(false, area);
              }

              // treat this as style, because it affects painting but
              // does not require calculation.

              style_area = Area.Join(area, style_area);
              render_area = Area.Join(area, render_area);

            }
          }
          break;

        case CommandKey.SetRange:
          {
            // area could be undefined if there's an error
            // (try to change part of an array)

            const area = this.SetRangeInternal(command);
            if (area) {
              
              data_area = Area.Join(area, data_area);

              // normally we don't paint, we wait for the calculator to resolve

              if (this.options.repaint_on_cell_change) {
                render_area = Area.Join(area, render_area);
              }

            }

          }
          break;

        case CommandKey.DeleteSheet:
          this.DeleteSheetInternal(command);
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.DuplicateSheet:
          this.DuplicateSheetInternal(command);
          structure_event = true;
          structure_rebuild_required = true;
          break;

        case CommandKey.AddSheet:
          // const sheet_id = this.AddSheetInternal(undefined, command.insert_index); // default name
          this.ActivateSheetInternal({
            key: CommandKey.ActivateSheet,
            id: this.AddSheetInternal(command.name, command.insert_index), // default name
          });
          structure_event = true;
          break;

        case CommandKey.ActivateSheet:
          this.ActivateSheetInternal(command);
          break;

        default:
          console.warn(`unhandled command: ${CommandKey[command.key]} (${command.key})`);
      }
    }

    // consolidate events and merge areas

    if (data_area) {
      if (!data_area.start.sheet_id) {
        data_area.SetSheetID(this.active_sheet.id);
      }
      events.push({ type: 'data', area: data_area });
    }

    if (style_area) {
      if (!style_area.start.sheet_id) {
        style_area.SetSheetID(this.active_sheet.id);
      }
      events.push({ type: 'style', area: style_area });
    }

    if (structure_event) {
      events.push({
        type: 'structure',
        rebuild_required: structure_rebuild_required,
      });
    }

    if (this.batch) {
      this.batch_events.push(...events);
    }
    else {
      this.grid_events.Publish(events);

      if (render_area) {
        this.DelayedRender(false, render_area);
      }
    }

  }


}
