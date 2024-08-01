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

import type { ICellAddress } from 'treb-base-types';
import type { TREBDocument } from './types';
import type { ChartRenderer } from 'treb-charts';
// import type { TREBPlugin } from './plugin';

/**
 * factory type for chart renderer, if you want instances (pass a constructor)
 */
export type ChartRendererFactory = () => ChartRenderer;

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
   * @deprecated - this was renamed to local_storage for clarity. if both
   * storage_key and local_storage are set we will use the value in local_storage.
   */
  storage_key?: string|boolean;

  /**
   * persist user changes to document in browser localStorage.
   * 
   * if set to a string, the value is used as the storage key.
   * 
   * if set to `true`, we will generate a storage key based on the page URI. 
   * don't do that if you have multiple spreadsheets on a single page, or 
   * they will overwrite each other.
   */
  local_storage?: string|boolean;

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

  /** even if we allow resizing, constrain width. this is to support fixed width columns. */
  constrain_width?: boolean;

  /** export to xlsx, now optional */
  export?: boolean;

  /** 
   * fetch network document. this is a replacement for the old
   * (deprecated) option `network_document`.
   */
  document?: string;

  /**
   * @internal - testing
   * 
   * load document directly from data. obeys the same rules as `document` 
   * regarding local storage and revert. if you provide both document and
   * inline_document we will show a warning, but inline_document will take
   * precedence.
   */
  inline_document?: TREBDocument;

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

  /** 
   * allow add/delete tab 
   */
  add_tab?: boolean;

  /** 
   * show delete tab 
   * @deprecated - implied by add_tab 
   */
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
   * @see https://docs.treb.app/en/complex-numbers
   * 
   * in version 25, complex defaults to `off`.
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

  /**
   * show the revert indicator. this is an indicator that shows on the 
   * top-left of the spreadsheet when a network document has local changes.
   */
  revert_indicator?: boolean;

  /**
   * @internal
   * overload the chart renderer with your own type (or a type factory method).
   * use a factory if you are going to persist state in the renderer, otherwise
   * you can just use a single instance.
   */
  chart_renderer?: ChartRenderer|ChartRendererFactory;

  /**
   * @internal
   * 
   * optional function to run before loading data. this is useful for example
   * if you want to load some custom functions before a document is loaded
   * from local storage. otherwise you'll get #NAME errors when an unknown
   * function is loaded (I suppose you could recalc, but this is better).
   * 
   * @privateRemarks
   * I'd prefer to pass the instance as a parameter, but I don't want a 
   * circular reference here. maybe that's not an issue? for the time being
   * we'll treat it as opaque.
   */
  preload?: (instance: unknown) => void;

  /**
   * handle the F9 key and recalculate the spreadsheet. for compatibility.
   * we're leaving this option to default `false` for now, but that may 
   * change in the future. key modifiers have no effect.
   */
  recalculate_on_f9?: boolean;

  /**
   * @internal
   */
  insert_function_button?: boolean;

  /**
   * indent/outdent buttons; default false
   */
  indent_buttons?: boolean;

  /**
   * enable spill arrays and spill references. this is on by default 
   * starting in 30.1.0. set to false to disable.
   */
  spill?: boolean;

  /**
   * language. at the moment this controls spreadsheet function names
   * only; the plan is to expand to the rest of the interface over time.
   * should be an ISO 639-1 language code, like "en", "fr" or "sv" (case
   * insensitive). we only support a limited subset of languages at the 
   * moment.
   * 
   * leave blank or set to "locale" to use the current locale.
   */
  language?: string;

  /* * 
   * @internal 
   * testing plugins
   */
  // plugins?: TREBPlugin[];

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
  // delete_tab: false,

  // changing default value for expand -> false, it might be
  // useful to disable it but the common expectation is that 
  // spreadsheets can grow.

  expand: true,
  markdown: false,
  spinner: false,
  complex: 'off',

  spill: true,

};
