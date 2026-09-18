
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
} as const;

export const default_error_messages = {
  array: `You can't change part of an array`,
  invalid_area_for_paste: 'Invalid area for paste',
  invalid_area_for_table: `Invalid area for table`,
  data_validation: `Invalid value (data validation)`,
  unknown: `Unknown error {code}`,
} as const;

