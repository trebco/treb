
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
// import { AutoEmbed } from './auto-embed';
import { CompositeSheet } from './composite-sheet';
import { AutoEmbedManager } from './auto-embed';
import { CreateSheetOptions, EmbeddedSpreadsheetOptions } from './options';
import { NumberFormatCache, ValueParser } from 'treb-format';

import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';

interface TREBNamespace {
  CreateEngine?: (options: EmbeddedSpreadsheetOptions) => EmbeddedSpreadsheetBase,
  CreateSpreadsheet?: (options: CreateSheetOptions) => EmbeddedSpreadsheetBase,
  version?: string,
  Format?: {
    format: (value: number, format: string) => string,
    parse: (value: string) => string|number|boolean|undefined,
  },
}

(() => {

  const TREB: TREBNamespace = ((self as any).TREB) || {};

  // gate on existing: intended to prevent running this multiple times.

  if (!TREB.CreateSpreadsheet) {

    // find path for worker loaders

    EmbeddedSpreadsheetBase.SniffPath();

    TREB.version = process.env.BUILD_VERSION; // this is fake, it will get replaced

    // support headless
    if (EmbeddedSpreadsheetBase.enable_engine) {
      TREB.CreateEngine = (options = {}) => new EmbeddedSpreadsheet(options);
    }

    TREB.CreateSpreadsheet = (options: CreateSheetOptions) => {
      return CompositeSheet.Create(options);
    }

    if (EmbeddedSpreadsheetBase.enable_formatter) {
      TREB.Format = {
        format: (value: number, format: string) => NumberFormatCache.Get(format).Format(value),
        parse: (value: string) => ValueParser.TryParse(value).value,
      };
    }

    (self as any).TREB = TREB;

    // FIXME: what if it's already loaded? (...)

    // document.addEventListener('DOMContentLoaded', () => AutoEmbed.Run());
    document.addEventListener('DOMContentLoaded', () => AutoEmbedManager.Run());

  }

})();

// re-export

export { EmbeddedSpreadsheet } from './embedded-spreadsheet';
