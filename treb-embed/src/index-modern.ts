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

import { CompositeSheet } from './composite-sheet';
import { AutoEmbedManager } from './auto-embed';
import type { CreateSheetOptions, EmbeddedSpreadsheetOptions } from './options';
import type { NumberFormatCache, ValueParser } from 'treb-format';
import type { Complex, Localization } from 'treb-base-types';
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import type { Util as ChartUtils, Chart } from 'treb-charts';

interface TREBNamespace {

  CreateEngine?: (options: EmbeddedSpreadsheetOptions) => EmbeddedSpreadsheet,
  CreateSpreadsheet?: (options: CreateSheetOptions) => EmbeddedSpreadsheet,
  version?: string,
  Format?: {
    format: (value: number, format: string) => string,
    parse: (value: string) => string|number|boolean|undefined|Complex,
  },

  // new utils stuff

  Localization?: Localization,
  NumberFormatCache?: NumberFormatCache,
  ValueParser?: typeof ValueParser,
  ChartUtils?: ChartUtils,
  CreateChart?: () => Chart,

  // new, tracking

  instances?: EmbeddedSpreadsheet[],

}

// convenience type
type DecoratedGlobal = typeof self & { TREB?: TREBNamespace };

(() => {

  if (!(self as DecoratedGlobal).TREB) {

    // find path for worker loaders
    EmbeddedSpreadsheet.BuildPath();

    const instances: EmbeddedSpreadsheet[] = [];

    const value: TREBNamespace = {
      version: process.env.BUILD_VERSION, // this is fake, it will get replaced
      instances,
      CreateSpreadsheet: (options: CreateSheetOptions) => {
        const composite = CompositeSheet.Create(EmbeddedSpreadsheet, options);
        instances.push(composite.sheet);
        return composite.sheet;
      },
    };

    // NOTE: dropping formatter but keeping engine/headless (for now)
    // FIXME: does RAW depend on formatter? can't remember... put it 
    // back if necessary

    if (EmbeddedSpreadsheet.enable_engine) {
      value.CreateEngine = (options = {}) => new EmbeddedSpreadsheet(options);
    }
  
    // FIXME: writable and configurable default to false, you don't
    // need to define them here. 

    Object.defineProperty(self, 'TREB', {
      value,
      writable: false,
      configurable: false,
      enumerable: true,
    });

    AutoEmbedManager.Attach('data-treb', 
      (...args: any) => {
        const composite = CompositeSheet.Create(EmbeddedSpreadsheet, args[0]);
        instances.push(composite.sheet);
        return composite.sheet;
      });

  }

})();

// re-export

export { EmbeddedSpreadsheet as EmbeddedSpreadsheet } from './embedded-spreadsheet';
