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
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */


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

}

/** single instance of factory class */
export const TREB = new TREBGlobal();

