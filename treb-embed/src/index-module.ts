
import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';
import { CompositeSheet } from './composite-sheet';
import type { CreateSheetOptions } from './options';

// non-mc version

//
// this is export for MJS/ESM. in this case we don't run globals. note we
// are not (atm) bothering with detecting module; this code will be in an 
// mjs file and if you load it with type=javascript it just won't do anything.
//
export const TREB = {
  version: process.env.BUILD_VERSION, // this is fake, it will get replaced
  CreateSpreadsheet: (options: CreateSheetOptions): EmbeddedSpreadsheetBase => CompositeSheet.Create(EmbeddedSpreadsheetBase, options).sheet,
  SetScriptPath: (path: string): void => { EmbeddedSpreadsheetBase.treb_base_path = path; },
};

(() => {

  // es2020 is now default; es5 is marked. 

  // EmbeddedSpreadsheetBase.treb_language = 'es6'; // load es6 modules

  EmbeddedSpreadsheetBase.BuildPath();

  // console.info('base path?', EmbeddedSpreadsheetBase.treb_base_path);

})();
