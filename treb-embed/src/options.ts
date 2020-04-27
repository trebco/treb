
import { ICellAddress } from 'treb-base-types';

/** base options excludes node, so we can create a default */
export interface BaseOptions {

  /** */
  dnd?: boolean;

  /** */
  // await_fonts?: string|string[];

  /** key in localStorage for persisting document */
  storage_key?: string;

  /** don't load immediately (?) */
  toll_initial_load?: boolean;

  /** show formula bar */
  formula_bar?: boolean;

  /** expand formula bar */
  expand_formula_button?: boolean;

  /** scroll to cell on load */
  scroll?: string | ICellAddress;

  /** sheet to show on load, overrides anything in the model */
  sheet?: string;

  /** add resizable wrapper */
  resizable?: boolean;

  /** fill container */
  auto_size?: boolean;

  /** popout icon */
  popout?: boolean;

  /** fetch network document (URI) */
  network_document?: string;

  /** load this document if the storage document isn't found (fallback) */
  alternate_document?: string;

  /** freeze rows */
  freeze_rows?: number;

  /** freeze columns */
  freeze_columns?: number;

  /** row/column headers */
  show_headers?: boolean;

  /** recalculate on load */
  recalculate?: boolean;

  /** show scrollbars */
  scrollbars?: boolean;

  /** show tab bar (multi sheet) */
  tab_bar?: boolean|'auto';

  /** allow add tab */
  add_tab?: boolean;

  /** set a reference in global (self) */
  global_name?: string;

  /** support undo */
  undo?: boolean;

  /** support in-cell editor */
  in_cell_editor?: boolean;

  /**
   * toolbar
   * FIXME: fix options
   */
  toolbar?: boolean | 'show' | 'compressed' | 'show-compressed';

  /** new option, better support for headless operations */
  headless?: boolean;

}

/**
 * default options. some of these are unecessary but we're being
 * explicit here just to be clear that these are intentional.
 */
export const DefaultOptions: BaseOptions = {
  formula_bar: true,
  in_cell_editor: true,
  undo: true,
  scrollbars: true,
  dnd: false,
  tab_bar: 'auto',
  add_tab: false,
};

/**
 * actual options requires the container node
 */
export interface EmbeddedSpreadsheetOptions extends BaseOptions {
  container: string|HTMLElement;
}

/**
 * embed creation adds option for icons
 */
export interface CreateSheetOptions extends EmbeddedSpreadsheetOptions {

  /** icons */
  decorated?: boolean;

  /** collapsed: start sidebar closed */
  collapsed?: boolean;

  /** mc icon is now optional */
  mc?: boolean;

  /** formatting is optional, may change */
  /** moved to sheet options */
  // toolbar?: boolean | 'show' | 'compressed' | 'show-compressed';

}
