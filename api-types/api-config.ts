
export const config = {

  package: '../package.json',
  output: 'generated.d.ts',
  base: '../declaration/treb-embed/src/embedded-spreadsheet-base.d.ts',

  cat: [
    'manual-types.d.ts',
  ],

  /** omit these types if they show up in parameters or interfaces */
  drop_types: [
    'LoadSource',
    'GridEvent',
  ],

  /** convert to "any" */
  convert_to_any: [
    'TREBDocument',
  ],

  /** rename classes */
  rename_classes: {
    'EmbeddedSpreadsheetBase': 'EmbeddedSpreadsheet',
  },

};
