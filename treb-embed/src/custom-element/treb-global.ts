
import { SpreadsheetConstructor } from './spreadsheet-constructor';
import type { EmbeddedSpreadsheetOptions } from '../options';
import type { EmbeddedSpreadsheet } from '../embedded-spreadsheet';

/**
 * API class for creating spreadsheets. this is intended as a singleton,
 * we will export an instance of the class.
 */
export class TREBGlobal {

  /** 
   * Package version 
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
   * Create a spreadsheet. The `USER_DATA_TYPE` template parameter is the type 
   * assigned to the `user_data` field of the spreadsheet instance -- it can
   * help simplify typing if you are storing extra data in spreadsheet
   * files. 
   * 
   * Just ignore this parameter if you don't need it.
   * 
   * @typeParam USER_DATA_TYPE - type for the `user_data` field in the 
   * spreadsheet instance
   */
  public CreateSpreadsheet<USER_DATA_TYPE = unknown>(options: EmbeddedSpreadsheetOptions): EmbeddedSpreadsheet<USER_DATA_TYPE> {
    const container = options.container;
    const instance = new SpreadsheetConstructor<USER_DATA_TYPE>(container);
    instance.AttachElement(options);
    if (!instance.sheet) {
      throw new Error('construction failed');
    }
    return instance.sheet;
  }

  /**
   * this function is not intended to be called. it's for static analyzers
   * (vite) that try to figure out what modules we are going to load. having
   * this function here (for now, at least) ensures we can dynamically load
   * the listed modules at runtime, if they are available.
   * 
   * this is fragile. also we have to manually update when new languages 
   * are available (FIXME: we could script that, at least).
   * 
   */
  private async PreloadLanguages() {

    if (Math.random() === 1) { // I guess that could happen? at least in theory

      try {

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-es.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-nl.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-it.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-pt.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-fr.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-de.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-da.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-sv.mjs');

        // @ts-expect-error: module not found error
        await import('./languages/treb-i18n-no.mjs');
        
      }
      catch (err) {
        console.error(err);
      }

    }
  }

}

/** single instance of factory class */
export const TREB = new TREBGlobal();

