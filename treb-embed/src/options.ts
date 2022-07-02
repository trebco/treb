
import type { ICellAddress } from 'treb-base-types';

/**
 * options for exporting CSV/TSV
 */
export interface ExportOptions {

  /** comma or tab */
  delimiter?: ',' | '\t';

  /** optionally choose a sheet to export (defaults to active sheet) */
  sheet?: string|number;

  /** export formulas not values */
  formulas?: boolean;
  
  /** use number formats when exporting numbers */
  formatted?: boolean;
}

/** 
 * options for creating spreadsheet 
 */
export interface EmbeddedSpreadsheetOptions {

  /** containing HTML element */
  container?: string|HTMLElement;

  /** allow drag-and-drop files */
  dnd?: boolean;

  /** expandable grid */
  expand?: boolean;

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

  /* * the old "fork and edit" button */
  // fork?: boolean;

  /** fetch network document (URI) */
  network_document?: string;

  /** load this document if the storage document isn't found (fallback) */
  alternate_document?: string;

  /** freeze rows */
  freeze_rows?: number;

  /** freeze columns */
  freeze_columns?: number;

  /** row/column headers */
  headers?: boolean;

  /** recalculate on load */
  recalculate?: boolean;

  /** show scrollbars */
  scrollbars?: boolean;

  /** show tab bar (multi sheet) */
  tab_bar?: boolean|'auto';

  /** allow add tab */
  add_tab?: boolean;

  /** show delete tab */
  delete_tab?: boolean;

  /** set a reference in global (self) */
  global_name?: string;

  /** support undo */
  undo?: boolean;

  /** support in-cell editor */
  in_cell_editor?: boolean;

  /** prompt "you have unsaved changes" */
  prompt_save?: boolean;

  /**
   * toolbar display option
   */
  toolbar?: boolean | 'show' | 'narrow' | 'show-narrow';

  /** file options in the toolbar */
  file_menu?: boolean;

  /** font size in the toolbar */
  font_scale?: boolean;

  /** chart menu in the toolbar */
  chart_menu?: boolean;

  /** recalculate button in the toolbar */
  toolbar_recalculate_button?: boolean;

  /** new option, better support for headless operations (default false) */
  headless?: boolean;

  /** max size for image, in bytes */
  max_file_size?: number;

  /** initial scale */
  scale?: number;

  /** show scale buttons */
  scale_control?: boolean;

  /** show stats panel */
  stats?: boolean;

  /** save/load scale. this can optionally have a string key to disambiguate */
  persist_scale?: boolean|string;

  /** target window for hyperlinks (default _blank); set false to disable hyperlinks altogether */
  hyperlinks?: string|false;

  /* * 
   * support complex numbers. the meaning of this flag is changing -- the 
   * parser is going to always support complex numbers, but we might load 
   * a different set of functions if they're not expected to be used.
   * ...
   * no, we're not doing that. atm complex support is always baked in.
   * @deprecated
   * @internal
   */
  // complex?: boolean;

  /** 
   * for rendering the imaginary number. this is intended to support 
   * switching to a different character for rendering, or adding a leading
   * space/half-space/hair-space.
   */
  imaginary_value?: string;

  /** support MD formatting for text */
  markdown?: boolean;

  /** show tinted colors in toolbar color dropdowns */
  tint_theme_colors?: boolean;

  /** show a spinner for long-running operations */
  spinner?: boolean;

}

/**
 * default options. some of these are unecessary but we're being
 * explicit here just to be clear that these are intentional.
 */
export const DefaultOptions: EmbeddedSpreadsheetOptions = {
  formula_bar: true,
  in_cell_editor: true,
  undo: true,
  scrollbars: true,
  headers: true,
  export: true,
  popout: true,
  tab_bar: 'auto',
  resizable: true,
  hyperlinks: '_blank',
  max_file_size: 1024 * 92,
  // imaginary_value: 'i',

  // I don't think false options need to be in default?
  // although it's nice to have a clear reference about defaults...
  
  dnd: false,
  add_tab: false,
  expand_formula_button: false,
  delete_tab: false,
  expand: false,
  markdown: false,
  spinner: false,

};

/* *
 * actual options requires the container node
 * /
export interface EmbeddedSpreadsheetOptions extends BaseOptions {
  container?: string|HTMLElement;
}
*/

/**
 * embed creation adds option for icons
 */
export interface CreateSheetOptions extends EmbeddedSpreadsheetOptions {

  /** icons */
  decorated?: boolean;

  /** collapsed: start sidebar closed */
  collapsed?: boolean;

  /** 
   * optional callback function on create. we're not using this anymore, but
   * leaving it in for backwards compatibility.
   * 
   * @internal
   */
  load?: string;

}
