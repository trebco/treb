
/** 
 * Global instance. In the base script, this object will be created as an
 * ambient global object (bound to the window object). If you instead use the
 * ES module, import the TREB object from the module.
 */
 declare const TREB: TREBGlobal;

/**
 * global object used to create spreadsheets
 */
export declare class TREBGlobal {

  /** TREB version */
  version: string;

  /** create a spreadsheet */
  CreateSpreadsheet(options: EmbeddedSpreadsheetOptions): EmbeddedSpreadsheet;

}
