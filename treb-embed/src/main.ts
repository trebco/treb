
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
// import { AutoEmbed } from './auto-embed';
import { CompositeSheet } from './composite-sheet';
import { AutoEmbedManager } from './auto-embed';
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

    // TREB.CreateSpreadsheet = (options: CreateSheetOptions) => AutoEmbed.CreateSheet(options);

    // support headless
    if (EmbeddedSpreadsheetBase.enable_engine) {
      TREB.CreateEngine = (options = {}) => new EmbeddedSpreadsheet(options);
    }

    // ...why the indirection? 
    // [A: at one point, at least, we also had the charts library in there;
    //  this serves to identify that it's the version of the embedded sheet]

    // TREB['treb-embed'] = { version: (build as any).version };

    // removing

    TREB.version = build.version;

    TREB.CreateSpreadsheet = (options: CreateSheetOptions) => {
      return CompositeSheet.Create(options);
    }
  })();


  // FIXME: what if it's already loaded? (...)

  // document.addEventListener('DOMContentLoaded', () => AutoEmbed.Run());
  document.addEventListener('DOMContentLoaded', () => AutoEmbedManager.Run());

}

// re-export

export { EmbeddedSpreadsheet } from './embedded-spreadsheet';
