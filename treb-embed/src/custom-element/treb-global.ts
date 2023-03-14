
import { SpreadsheetConstructor } from './spreadsheet-constructor';
import type { EmbeddedSpreadsheetOptions } from '../options';
import type { EmbeddedSpreadsheet } from '../embedded-spreadsheet';
import { TREBElement } from './treb-spreadsheet-element';

// re-export for generated types
export { TREBElement } from './treb-spreadsheet-element';

/**
 * API class for creating spreadsheets. this is intended as a singleton,
 * we will export an instance of the class.
 */
export class TREBGlobal {

  /** 
   * build version 
   * 
   * @privateRemarks
   * 
   * we know this string won't be undefined at run time, but ts doesn't know
   * because we're using process.env as a placeholder. so we add the default
   * empty string to force type generation as a string, otherwise it would 
   * be string|undefined.
   * 
   * esbuild (or any other compiler) should remove the default value after 
   * building so it won't cost us anything.
   */
  public version = process.env.BUILD_VERSION || '';

  /** 
   * create a spreadsheet instance
   */
  public CreateSpreadsheet(options: EmbeddedSpreadsheetOptions): EmbeddedSpreadsheet {
    const container = options.container;
    const instance = new SpreadsheetConstructor(container);
    instance.AttachElement();
    if (!instance.sheet) {
      throw new Error('construction failed');
    }
    return instance.sheet;
  }

}

/** single instance of factory class */
export const TREB = new TREBGlobal();

