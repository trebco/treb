
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { CompositeSheet } from './composite-sheet';
import { AutoEmbedManager } from './auto-embed';
import { CreateSheetOptions, EmbeddedSpreadsheetOptions } from './options';
import { NumberFormatCache, ValueParser } from 'treb-format';
import { Complex, Localization } from 'treb-base-types';
import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';

import { Util as ChartUtils, Chart } from 'treb-charts';

interface TREBNamespace {
  CreateEngine?: (options: EmbeddedSpreadsheetOptions) => EmbeddedSpreadsheetBase,
  CreateSpreadsheet?: (options: CreateSheetOptions) => EmbeddedSpreadsheetBase,
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

}

// convenience type
type DecoratedGlobal = typeof self & { TREB?: TREBNamespace };

(() => {

  if (!(self as DecoratedGlobal).TREB) {

    // find path for worker loaders
    EmbeddedSpreadsheetBase.BuildPath();

    const value: TREBNamespace = {
      version: process.env.BUILD_VERSION, // this is fake, it will get replaced
      CreateSpreadsheet: (options: CreateSheetOptions) => CompositeSheet.Create(EmbeddedSpreadsheet, options),
    };

    // NOTE: dropping formatter but keeping engine/headless (for now)
    // FIXME: does RAW depend on formatter? can't remember... put it 
    // back if necessary

    if (EmbeddedSpreadsheetBase.enable_engine) {
      value.CreateEngine = (options = {}) => new EmbeddedSpreadsheet(options);
    }

    // testing

    /*
    if (EmbeddedSpreadsheetBase.enable_utils) {
      value.Localization = Localization;
      value.NumberFormatCache = NumberFormatCache;
      value.ValueParser = ValueParser;
      value.ChartUtils = ChartUtils;
      value.CreateChart = () => new Chart();
    }
    */

    // FIXME: writable and configurable default to false, you don't
    // need to define them here. 

    Object.defineProperty(self, 'TREB', {
      value,
      writable: false,
      configurable: false,
      enumerable: true,
    });

    AutoEmbedManager.Attach('data-treb', 
      (...args: any) => CompositeSheet.Create(EmbeddedSpreadsheet, args[0]));

  }

  /*

  const TREB: TREBNamespace = (self as DecoratedGlobal).TREB || {};

  // gate on existing: intended to prevent running this multiple times.

  if (!TREB.CreateSpreadsheet) {

    // find path for worker loaders

    EmbeddedSpreadsheetBase.BuildPath();

    TREB.version = process.env.BUILD_VERSION; // this is fake, it will get replaced

    // support headless
    if (EmbeddedSpreadsheetBase.enable_engine) {
      TREB.CreateEngine = (options = {}) => new EmbeddedSpreadsheet(options);
    }

    TREB.CreateSpreadsheet = (options: CreateSheetOptions) => {
      return CompositeSheet.Create(options);
    }

    // does anyone use this anymore? we have methods on the sheet 
    // instances, although I suppose this is helpful in that it doesn't 
    // require an instance

    if (EmbeddedSpreadsheetBase.enable_formatter) {
      TREB.Format = {
        format: (value: number, format: string) => NumberFormatCache.Get(format).Format(value),
        parse: (value: string) => ValueParser.TryParse(value).value,
      };
    }

    (self as DecoratedGlobal).TREB = TREB;

    // FIXME: what if it's already loaded? (...)

    // document.addEventListener('DOMContentLoaded', () => AutoEmbed.Run());
    document.addEventListener('DOMContentLoaded', () => AutoEmbedManager.Run());
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'complete') {
        AutoEmbedManager.Run();
      }
    });

  }

  */

})();

// re-export

export { EmbeddedSpreadsheet } from './embedded-spreadsheet';
