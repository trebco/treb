
/**
 * global object used to create spreadsheets
 */
export declare class TREBGlobal {

  /** create a spreadsheet */
  static CreateSpreadsheet: (options: EmbeddedSpreadsheetOptions) => EmbeddedSpreadsheet;

  /** TREB version */
  static version: string;

}

/** 
 * ambient global instance
 */
declare const TREB: TREBGlobal;

