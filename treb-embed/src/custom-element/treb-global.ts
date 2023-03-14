
import { SpreadsheetConstructor } from './spreadsheet-constructor'; 
import type { EmbeddedSpreadsheetOptions } from '../options';

/**
 * API class for creating spreadsheets. this is intended as a singleton,
 * we will export an instance of the class.
 */
export class TREBGlobal {

  /** build version */
  public version = process.env.BUILD_VERSION;

  public CreateSpreadsheet(options: EmbeddedSpreadsheetOptions) {
    const container = options.container;
    const instance = new SpreadsheetConstructor(container);
    instance.AttachElement();
    return instance;
  }

}

/** single instance of factory class */
export const TREB = new TREBGlobal();
