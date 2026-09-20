
import type { Errors } from 'treb-base-types';

/**
 * default UI strings, in english. language files can override using 
 * the ui_strings field in language model. 
 */
export const default_ui_strings = {

  close_dialog: 'Close dialog',
  insert_function: 'Insert function...',
  delete_sheet: 'Delete current sheet',
  add_sheet: 'Add sheet',
  document_modified: 'This document has been modified from the original version.',
  recalculate: 'Recalculate',
  toggle_toolbar: 'Toggle toolbar',
  export: 'Export as XLSX',
  revert: 'Revert to original version',
  about: `What's this?`,
  toggle_sidebar: 'Toggle sidebar',
  new_sheet_name: 'Sheet{#}',

} as const;

/**
 * default (english) error messages. 
 */
export const default_error_messages = {
  array: `You can't change part of an array`,
  invalid_area_for_paste: 'Invalid area for paste',
  invalid_area_for_table: `Invalid area for table`,
  data_validation: `Invalid value (data validation)`,
  unknown: `Unknown error {code}`,
} as const;

/**
 * default (english) spreadsheet/cell errors. we have some new/custom
 * errors that are used in TREB, but not in Excel -- we can translate
 * these, as there is no reason not to (they are not exported or used
 * externally)
 */
export const default_formula_errors: Record<keyof typeof Errors, string> = {
  Argument:    '#ARG!',
  Reference:   '#REF!',
  Name:        '#NAME?',
  Expression:  '#EXPR!',
  Value:       '#VALUE!',
  Div0:        '#DIV/0!',
  NA:          '#N/A',
  Spill:       '#SPILL!',
  Num:         '#NUM!',

  /** local error: missing data */
  Data:        '#DATA!',

  /** local error: unknown */
  Unknown:     '#UNK!',

  /** local error: not implemented */
  NotImpl:     '#NOTIMPL!',

  /** local error: circular reference in graph */  
  Loop:        '#LOOP!', 
}

/**
 * default (english) symbolic names for number formats
 */
export const default_number_formats = {

    Accounting:   'Accounting',
    Number:       'Number',
    Integer:      'Integer',
    Percent:      'Percent',
    General:      'General',
    Fraction:     'Fraction',
    Currency:     'Currency',
    Exponential:  'Exponential',
    Scientific:   'Scientific', // alias for exponential
    'Short Date': 'Short Date',
    'Long Date':  'Long Date',
    Timestamp:    'Timestamp',

};
