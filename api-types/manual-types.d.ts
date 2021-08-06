
/** 
 * Ambient global object. Use the TREB global to create 
 * spreadsheets in documents.
 */
declare const TREB: {
  CreateSpreadsheet: (options: EmbeddedSpreadsheetOptions) => EmbeddedSpreadsheet;

  /** TREB version */
  version: string;
} 

export interface ExportOptions {
  delimiter?: ',' | '\t';
  sheet?: string|number;

  /** export formulas not values */
  formulas?: boolean;

  /** use number formats */
  formatted?: boolean;
}

export interface FreezePane {
  rows: number;
  columns: number;
}

export interface Rectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SerializeOptions {

  /** include rendered/calculated values in export */
  rendered_values?: boolean;

  /** prune unused rows/columns */
  shrink?: boolean;

}

export enum BorderConstants {
  None = 'none',
  All = 'all',
  Outside = 'outside',
  Top = 'top',
  Bottom = 'bottom',
  Left = 'left',
  Right = 'right',
  DoubleTop = 'double-top',
  DoubleBottom = 'double-bottom',
}

export declare namespace Style {
  /** horizontal align constants */
  enum HorizontalAlign {
      None = 0,
      Left = 1,
      Center = 2,
      Right = 3
  }
  /** vertical align constants */
  enum VerticalAlign {
      None = 0,
      Top = 1,
      Bottom = 2,
      Middle = 3
  }
  interface FontSize {
      unit: 'pt' | 'px' | 'em' | '%';
      value: number;
  }
  interface Color {
      theme?: number;
      tint?: number;
      text?: string;
      none?: boolean;
  }
  interface Properties {
      horizontal_align?: HorizontalAlign;
      vertical_align?: VerticalAlign;
      nan?: string;
      number_format?: string;
      wrap?: boolean;
      font_size?: FontSize;
      font_face?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strike?: boolean;
      font_weight?: number;
      border_top?: number;
      border_right?: number;
      border_left?: number;
      border_bottom?: number;
      text?: Color;
      fill?: Color;
      border_top_fill?: Color;
      border_left_fill?: Color;
      border_right_fill?: Color;
      border_bottom_fill?: Color;
      locked?: boolean;
  }
}

export interface Complex {
  real: number;
  imaginary: number;
}

export declare type CellValue = undefined | string | number | boolean | Complex;

export interface ICellAddress {
  row: number;
  column: number;
  absolute_row?: boolean;
  absolute_column?: boolean;
  sheet_id?: number;
}

export interface IArea {
  start: ICellAddress;
  end: ICellAddress;
}

/** construction options */
export declare interface EmbeddedSpreadsheetOptions {

  /** containing element */
  container?: string | HTMLElement;

  /** allow drag and drop */
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
  scroll?: string;

  /** sheet to show on load, overrides anything in the model */
  sheet?: string;

  /** add resizable wrapper */
  resizable?: boolean;

  /** export to xlsx, now optional */
  export?: boolean;

  /** popout icon */
  popout?: boolean;

  /** fetch network document (URI) */
  network_document?: string;

  /** load this document if the storage document isn't found (fallback) */
  alternate_document?: string;
  
  /** row/column headers */
  headers?: boolean;
  
  /** recalculate on load */
  recalculate?: boolean;
  
  /** show scrollbars */
  scrollbars?: boolean;
  
  /** show tab bar (multi sheet) */
  tab_bar?: boolean | 'auto';
  
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
  
  /** toolbar visibility/size */
  toolbar?: boolean | 'show' | 'narrow' | 'show-narrow';

  /** file options in the toolbar */
  file_menu?: boolean;

  /** font size in the toolbar */
  font_scale?: boolean;

  /** chart menu in the toolbar */
  chart_menu?: boolean;

  /** recalculate button in the toolbar */
  toolbar_recalculate_button?: boolean;

  /** headless operation*/
  headless?: boolean;

  /** max size for image, in bytes */
  max_file_size?: number;

  /** initial scale */
  scale?: number;

  /** show scale buttons */
  scale_control?: boolean;

  /** save/load scale. this can optionally have a string key to disambiguate */
  persist_scale?: boolean | string;

  /** target window for hyperlinks (default _blank); set false to disable hyperlinks altogether */
  hyperlinks?: string | false;
  
  /** support MD formatting for text */
  markdown?: boolean;

  /** show tinted colors in toolbar color dropdowns */
  tint_theme_colors?: boolean;

  /** collapsed: start sidebar closed */
  collapsed?: boolean;
 
}

