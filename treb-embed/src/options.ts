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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

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

  /** 
   * expandable grid. if this option is false, the grid will always
   * stay the same size -- if you keep pressing down arrow, it won't
   * grow. defaults to true.
   */
  expand?: boolean;

  /** 
   * key in localStorage for persisting document. 
   * 
   * it's possible to set this to boolean `true`, in which case we will 
   * generate a storage key based on the page URI. 
   * 
   * that can be convenient for quickly setting up a document, but don't 
   * use it if the page URI might change (the storage will get lost)
   * or if there are multiple spreadsheets on the same page (they will
   * overwrite each other).
   */
  storage_key?: string|boolean;

  /** don't load immediately (?) */
  toll_initial_load?: boolean;

  /** show formula bar. default true. */
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

  /** 
   * fetch network document. this is a replacement for the old
   * (deprecated) option `network_document`.
   */
  document?: string;

  /** 
   * fetch network document (URI) 
   * @deprecated - use `document`
   */
  network_document?: string;

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
   * toolbar display option. true or false means include/don't include
   * the toolbar (and the toolbar button). setting to "narrow" means
   * include the toolbar, but use a narrow version (it compresses the 
   * align/justify groups).
   * 
   * the toolbar usually starts hidden. if you set this option to "show",
   * it will start visible. same for "show-narrow".
   */
  toolbar?: boolean | 'show' | 'narrow' | 'show-narrow';

  /** include the file menu in the toolbar */
  file_menu?: boolean;

  /** include the font scale control in the toolbar */
  font_scale?: boolean;

  /** include the insert/remove table button in the toolbar */
  table_button?: boolean;

  /** include the freeze button in the toolbar */
  freeze_button?: boolean;

  /** include the chart menu in the toolbar */
  chart_menu?: boolean;

  /** include a recalculate button in the toolbar */
  toolbar_recalculate_button?: boolean;

  /** better support for headless operations (default false) */
  headless?: boolean;

  /** max size for image, in bytes */
  max_file_size?: number;

  /** initial scale */
  scale?: number;

  /** 
   * show scale control (slider) under the spreadsheet. 
   */
  scale_control?: boolean;

  /** 
   * show the stats panel under the spreadsheet.
   */
  stats?: boolean;

  /** 
   * save/load scale. this can optionally have a string key to disambiguate 
   */
  persist_scale?: boolean|string;

  /** 
   * target window for hyperlinks (default _blank); set false to disable hyperlinks altogether 
   */
  hyperlinks?: string|false;

  /**
   * enable handling complex numbers in function calculation. turning this
   * off doesn't actually disable complex numbers. it means that functions 
   * will not return complex numbers unless one of the arguments is complex.
   * 
   * for example, if complex numbers are off, `=SQRT(-1)` will return `#VALUE`.
   * if complex numbers are on, `=SQRT(-1)` will return `i`.
   * 
   * even if complex numbers are off, however, `=SQRT(-1 + 0i)` will return 
   * `i` because the argument is complex.
   * 
   * currently this behavior applies to `SQRT`, `POWER` and the exponentiation 
   * operator `^`.
   * 
   * in version 22, this defaults to `off`.
   */
  complex?: 'on'|'off';

  /** 
   * for rendering the imaginary number. this is intended to support 
   * switching to a different character for rendering, or adding a leading
   * space/half-space/hair-space.
   * 
   * this _does_not_ change how you enter imaginary numbers, you still have
   * to use `i` (lower-case ascii i).
   */
  imaginary_value?: string;

  /** 
   * support markdown formatting for text in cells and comments. at the 
   * moment we only support bold, italic, and strike text.
   */
  markdown?: boolean;

  /** 
   * show tinted colors in toolbar color dropdowns. as of version 25
   * this defaults to true (used to be false).
   */
  tint_theme_colors?: boolean;

  /** 
   * show a spinner for long-running operations 
   */
  spinner?: boolean;

  /** 
   * start with sidebar closed. defaults to false.
   */
  collapsed?: boolean;
  
  /**
   * show the revert button in the sidebar. see the `Revert` method. this 
   * was renamed from `revert` to avoid any ambiguity.
   */
  revert_button?: boolean;

}

/**
 * default options. some of these are unecessary but we're being
 * explicit here just to be clear that these are intentional.
 * 
 * @internal
 */
export const DefaultOptions: EmbeddedSpreadsheetOptions = {
  formula_bar: true,
  in_cell_editor: true,
  undo: true,
  scrollbars: true,
  headers: true,
  export: true,
  tab_bar: 'auto',
  resizable: true,
  hyperlinks: '_blank',
  max_file_size: 1024 * 92,

  // popout: false,
  // imaginary_value: 'i',

  tint_theme_colors: true,

  // I don't think false options need to be in default?
  // although it's nice to have a clear reference about defaults...
  
  dnd: false,
  add_tab: false,
  expand_formula_button: false,
  delete_tab: false,

  // changing default value for expand -> false, it might be
  // useful to disable it but the common expectation is that 
  // spreadsheets can grow.

  expand: true,
  markdown: false,
  spinner: false,
  complex: 'off',

};
