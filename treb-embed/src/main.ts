
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { AutoEmbed } from './auto-embed';
import { CreateSheetOptions } from './options';

import * as build from '../../package.json';
import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';

// gate on existing: intended to prevent running this multiple times.

if (!(self as any).TREB?.CreateSpreadsheet) {

  // find path for worker loaders

  EmbeddedSpreadsheetBase.SniffPath();

  // create (or attach to) global TREB namespace

  (() => {
    if (!(self as any).TREB) { (self as any).TREB = {}; }
    const TREB: any = (self as any).TREB;
    TREB.CreateSpreadsheet = (options: CreateSheetOptions) => AutoEmbed.CreateSheet(options);
    if (EmbeddedSpreadsheetBase.enable_engine) {
      TREB.CreateEngine = (options = {}) => new EmbeddedSpreadsheet(options);
    }
    TREB['treb-embed'] = { version: (build as any).version };
  })();


  // FIXME: what if it's already loaded? (...)

  document.addEventListener('DOMContentLoaded', () => AutoEmbed.Run());

}

// re-export

export { EmbeddedSpreadsheet } from './embedded-spreadsheet';
