/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { CompositeSheet } from './composite-sheet';
import type { CreateSheetOptions } from './options';

// support injecting worker as text (for blob). this will help with module 
// import, although it will make the module quite a bit larger.

const worker_text = process.env.WORKER_TEXT || '';
if (worker_text) {
  EmbeddedSpreadsheet.export_worker_text = worker_text;
}

//
// this is export for MJS/ESM. in this case we don't run globals. note we
// are not (atm) bothering with detecting module; this code will be in an 
// mjs file and if you load it with type=javascript it just won't do anything.
//
export const TREB = {
  version: process.env.BUILD_VERSION, // this is fake, it will get replaced
  CreateSpreadsheet: (options: CreateSheetOptions): EmbeddedSpreadsheet => CompositeSheet.Create(EmbeddedSpreadsheet, options).sheet,
  SetScriptPath: (path: string): void => { EmbeddedSpreadsheet.treb_base_path = path; },
};

(() => {

  // es2020 is now default; es5 is marked. 

  // EmbeddedSpreadsheetBase.treb_language = 'es6'; // load es6 modules

  EmbeddedSpreadsheet.BuildPath();

  // console.info('base path?', EmbeddedSpreadsheetBase.treb_base_path);

})();
