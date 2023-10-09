
/**
 * add our tag to the map
 */
declare global {
  interface HTMLElementTagNameMap {
    'treb-spreadsheet': HTMLElement & {
      instance: {
        sheet: EmbeddedSpreadsheet | undefined;
      } | undefined;
    };
  }
}
