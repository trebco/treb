
import { EmbeddedSpreadsheetBase } from '../../treb-embed/src/embedded-spreadsheet-base';
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { CompositeSheet } from '../../treb-embed/src/composite-sheet';
import { CreateSheetOptions } from '../../treb-embed/src/options';

//
// this is export for MJS/ESM. in this case we don't run globals. note we
// are not (atm) bothering with detecting module; this code will be in an 
// mjs file and if you load it with type=javascript it just won't do anything.
//
export const TREB = {
  version: process.env.BUILD_VERSION, // this is fake, it will get replaced
  CreateSpreadsheet: (options: CreateSheetOptions): EmbeddedSpreadsheet => {
    
    // default to MC on, but it's possible to disable it for some reason

    options = { mc: true, ...options };

    return CompositeSheet.Create(EmbeddedSpreadsheet, options).sheet
  },
  SetScriptPath: (path: string): void => { EmbeddedSpreadsheetBase.treb_base_path = path; },
};

(() => {

  // es2020 is now default; es5 is marked. 

  // EmbeddedSpreadsheetBase.treb_language = 'es6'; // load es6 modules

  EmbeddedSpreadsheetBase.BuildPath();

  // console.info('base path?', EmbeddedSpreadsheetBase.treb_base_path);

})();
