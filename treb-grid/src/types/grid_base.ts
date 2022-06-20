
import { EventSource } from 'treb-utils';
import { DataModel, MacroFunction, SerializedModel, SerializedNamedExpression, ViewModel } from './data_model';
import { Parser, type ExpressionUnit, UnitAddress } from 'treb-parser';
import { Area, Style, Localization, DefaultTheme, IsCellAddress } from 'treb-base-types';
import type { ICellAddress, IArea, Cell, CellValue, Theme } from 'treb-base-types';
import { Sheet } from './sheet';
import { AutocompleteMatcher, FunctionDescriptor, DescriptorType } from '../editors/autocomplete_matcher';

import type { GridEvent } from './grid_events';
import type { CommandRecord } from './grid_command';
import { DefaultGridOptions, type GridOptions } from './grid_options';
import { SerializeOptions } from './serialize_options';

import { BorderConstants } from './border_constants';

import { CommandKey } from './grid_command';
import type { Command, DeleteSheetCommand, UpdateBordersCommand } from './grid_command';

export class GridBase {

  // --- public members --------------------------------------------------------

  /** events */
  public grid_events = new EventSource<GridEvent>();

  /** for recording */
  public command_log = new EventSource<CommandRecord>();

  public readonly model: DataModel;

  public readonly view: ViewModel;

  /**
   * the theme object exists so we can pass it to constructors for
   * various components, but it's no longer initialized until the
   * initialization step (when we have a node).
   */
  public readonly theme: Theme; // ExtendedTheme;

  // --- public accessors ------------------------------------------------------

  public get active_sheet(): Sheet {
    return this.view.active_sheet;
  }

  public set active_sheet(sheet: Sheet) {
    this.view.active_sheet = sheet;
  }

  /** access the view index, if needed */
  public get view_index() {
    return this.view.view_index;
  }

  // --- protected members -----------------------------------------------------

  /**
   * single instance of AC. editors (function bar, ICE) have references.
   * this is in base, instead of subclass, because we use it to check
   * for valid names.
   */
  protected autocomplete_matcher = new AutocompleteMatcher();

  protected flags: Record<string, boolean> = {};

  /** */
  protected options: GridOptions;

  /** 
   * maps common language (english) -> local language. this should 
   * be passed in (actually set via a function).
   */
  protected language_map?: Record<string, string>;

  /**
   * maps local language -> common (english). this should be constructed
   * when the forward function is passed in, so there's a 1-1 correspondence.
   */
  protected reverse_language_map?: Record<string, string>;

  /**
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
   */
  protected parser: Parser;

  /** this is used when testing if a typed character is numeric */
  protected decimal_separator_code = 0x2e; // "."

  // --- constructor -----------------------------------------------------------

  constructor(
    options: GridOptions = {},
    parser: Parser,
    model: DataModel,
    theme: Theme = DefaultTheme) {

    this.model = model;

    this.view = {
      active_sheet: this.model.sheets.list[0],
      view_index: this.model.view_count++,
    };

    // shared parser

    this.parser = parser;
    this.decimal_separator_code = Localization.decimal_separator.charCodeAt(0);

    // set properties here, we will update in initialize()

    this.theme = JSON.parse(JSON.stringify(theme));

    // apply default options, meaning that you need to explicitly set/unset
    // in order to change behavior. FIXME: this is ok for flat structure, but
    // anything more complicated will need a nested merge

    this.options = { ...DefaultGridOptions, ...options };

  }

  // --- API methods -----------------------------------------------------------

  public ResetMetadata(): void {
    this.model.document_name = undefined;
    this.model.user_data = undefined;
  }

  /**
   * serialize data. this function used to (optionally) stringify
   * by typescript has a problem figuring this out, so we will simplify
   * the function.
   */
  public Serialize(options: SerializeOptions = {}): SerializedModel {

    // (removed UI stuff, that goes in subclass)

    // selection moved to sheet, but it's not "live"; so we need to
    // capture the primary selection in the current active sheet before
    // we serialize it

    // this.active_sheet.selection = JSON.parse(JSON.stringify(this.primary_selection));

    // same for scroll offset

    // this.active_sheet.scroll_offset = this.layout.scroll_offset;

    // NOTE: annotations moved to sheets, they will be serialized in the sheets

    const sheet_data = this.model.sheets.list.map((sheet) => sheet.toJSON(options));

    // NOTE: moving into a structured object (the sheet data is also structured,
    // of course) but we are moving things out of sheet (just  named ranges atm))

    let macro_functions: MacroFunction[] | undefined;

    if (this.model.macro_functions.size) {
      macro_functions = [];
      for (const macro of this.model.macro_functions.values()) {
        macro_functions.push({
          ...macro,
          expression: undefined,
        });
      }
    }

    const named_expressions: SerializedNamedExpression[] = [];
    if (this.model.named_expressions) {

      for (const [name, expr] of this.model.named_expressions) {
        const rendered = this.parser.Render(expr, undefined, '');
        named_expressions.push({
          name, expression: rendered
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
      named_expressions: named_expressions.length ? named_expressions : undefined,
    };

  }

  // --- protected methods -----------------------------------------------------


  /**
   * find sheet matching sheet_id in area.start, or active sheet
   * 
   * FIXME: should return undefined on !match
   * FIXME: should be in model, which should be a class
   */
  protected FindSheet(identifier: number|IArea|ICellAddress|undefined): Sheet {

    if (identifier === undefined) {
      return this.active_sheet;
    }

    const id = typeof identifier === 'number' ? identifier : IsCellAddress(identifier) ? identifier.sheet_id : identifier.start.sheet_id;

    if (!id || id === this.active_sheet.id) {
      return this.active_sheet;
    }

    const sheet = this.model.sheets.Find(id);
    if (sheet) { 
      return sheet;
    }

    /*
    for (const test of this.model.sheets) {
      if (test.id === id) {
        return test;
      }
    }
    */

    // FIXME: should return undefined here
    return this.active_sheet;

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
  protected PatchFormulasInternal(source: string,
      before_row: number,
      row_count: number,
      before_column: number,
      column_count: number,
      target_sheet_name: string,
      is_target: boolean) {

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


            if ((element.start.sheet && element.start.sheet.toLowerCase() === target_sheet_name) || (!element.start.sheet && is_target)) {
              addresses.push(element.start, element.end);
            }

          }
          else if (element.type === 'address') {
            if ((element.sheet && element.sheet.toLowerCase() === target_sheet_name) || (!element.sheet && is_target)) {
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
   * splitting this logic into a new function so we can reuse it 
   * for invalidating broken references. generally we'll call this
   * on all sheets, but I wanted to leave the option open.
   * 
   * @returns count of changes made. it's useful for the delete routine, 
   * so we can force a recalc.
   */
   protected RenameSheetReferences(sheets: Sheet[], old_name: string, name: string): number {

    let changes = 0;

    old_name = old_name.toLowerCase();

    for (const sheet of sheets) {

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
              changes++;
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
              changes++;
            }
          }
        }
      }
    }

    return changes;

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
   protected ApplyBordersInternal(command: UpdateBordersCommand) {

    const borders = command.borders;
    const width = (command.borders === BorderConstants.None)
      ? 0 : command.width;

    const area = new Area(command.area.start, command.area.end);
    const sheet = this.FindSheet(area);

    area.start.sheet_id = sheet.id; // ensure

    /*
    let sheet = this.active_sheet;
    if (command.area.start.sheet_id && command.area.start.sheet_id !== this.active_sheet.id) {
      for (const compare of this.model.sheets) {
        if (compare.id === command.area.start.sheet_id) {
          sheet = compare;
          break;
        }
      }
    }
    */

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

  protected TranslateR1C1(address: ICellAddress, value: CellValue): CellValue {

    let transformed = false;

    const cached = this.parser.flags.r1c1;
    this.parser.flags.r1c1 = true; // set
     
    if (typeof value === 'string' && value[0] === '=') {
      const result = this.parser.Parse(value);
      if (result.expression) {
        this.parser.Walk(result.expression, unit => {
          if (unit.type === 'address' && unit.r1c1) {
            transformed = true;

            // translate...
            if (unit.offset_column) {
              unit.column = unit.column + address.column;
            }
            if (unit.offset_row) {
              unit.row = unit.row + address.row;
            }

          }
          return true;
        });
        if (transformed) {

          if (!this.flags.warned_r1c1) {

            // 1-time warning

            this.flags.warned_r1c1 = true;
            console.warn('NOTE: R1C1 support is experimental. the semantics may change in the future.');
          }

          value = '=' + this.parser.Render(result.expression);
        }
      }
    }

    this.parser.flags.r1c1 = cached; // reset
    return value;

  }

  protected ClearAreaInternal(area: Area) {

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

  /**
   * send an error message. subscriber can figure out how to communicate it
   * to users. FIXME: use error constants?
   * 
   * @param message 
   */
  protected Error(message: string) {
    console.info('Error', message);
    this.grid_events.Publish({
      type: 'error',
      message,
    });
  }

}