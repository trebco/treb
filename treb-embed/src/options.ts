
import { ICellAddress } from 'treb-base-types';

export interface ExportOptions {
  delimiter?: ',' | '\t';
  sheet?: string|number;
  // filename?: string;
  formulas?: boolean;   // export formulas not values
  formatted?: boolean;  // use number formats
}

export const DefaultExportOptions: ExportOptions = {
  delimiter: ',',
};

/** base options excludes node, so we can create a default */
export interface BaseOptions {

  /** */
  dnd?: boolean;

  /** expandable grid */
  expand?: boolean;

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

  /** export to xlsx, now optional */
  export?: boolean;

  /** fill container */
  auto_size?: boolean;

  /** popout icon */
  popout?: boolean;

  /** the old "fork and edit" button */
  fork?: boolean;

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

  /** prompt "you have unsaved changes" */
  prompt_save?: boolean;

  /**
   * toolbar
   * FIXME: fix options
   */
  toolbar?: boolean | 'show' | 'compressed' | 'show-compressed';

  /** file options in the toolbar */
  file_menu?: boolean;

  /** chart menu in the toolbar */
  chart_menu?: boolean;

  /** new option, better support for headless operations (default false) */
  headless?: boolean;

  /** max workers. workers is bounded by available cores, but you can request max < cores */
  max_workers?: number;

  /** default trials if you call RunSimulation without an explicit parameter */
  default_trials?: number;

  /** defualt screen updates, if you call RunSimulation without an explicit parameter */
  screen_updates?: boolean;

  /** max size for image, in bytes */
  max_file_size?: number;

  /** initial scale */
  scale?: number;

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
  export: true,
  fork: false,
  popout: true,
  tab_bar: 'auto',
  add_tab: false,
  max_workers: 1,
  resizable: true,
  default_trials: 5000,
  screen_updates: false,
  max_file_size: 1024 * 64,
};

/**
 * actual options requires the container node
 */
export interface EmbeddedSpreadsheetOptions extends BaseOptions {
  container?: string|HTMLElement;
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

  load?: string;

}
