
/**
 * add our tag to the map
 */
declare global {
  interface HTMLElementTagNameMap {
    'treb-spreadsheet': HTMLElement & {
      sheet: EmbeddedSpreadsheet|undefined;
    };
  }
}
