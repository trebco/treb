
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { CompositeSheet } from '../../treb-embed/src/composite-sheet';
import { AutoEmbedManager } from '../../treb-embed/src//auto-embed';
import { CreateSheetOptions, EmbeddedSpreadsheetOptions } from '../../treb-embed/src/options';
import { NumberFormatCache, ValueParser } from 'treb-format';
import { Complex, Localization } from 'treb-base-types';
import { EmbeddedSpreadsheetBase } from '../../treb-embed/src/embedded-spreadsheet-base';

import { Util as ChartUtils, Chart } from 'treb-charts';

interface SCNamespace {
  CreateSpreadsheet?: (options: CreateSheetOptions) => EmbeddedSpreadsheetBase,
  version?: string,
}

// convenience type
type DecoratedGlobal = typeof self & { SC?: SCNamespace };

(() => {

  if (!(self as DecoratedGlobal).SC) {

    // find path for worker loaders
    EmbeddedSpreadsheetBase.BuildPath();

    const value: SCNamespace = {
      version: process.env.BUILD_VERSION, // this is fake, it will get replaced
      CreateSpreadsheet: (options: CreateSheetOptions) => CompositeSheet.Create(EmbeddedSpreadsheet, options),
    };

    // FIXME: writable and configurable default to false, you don't
    // need to define them here. 

    Object.defineProperty(self, 'SC', {
      value,
      writable: false,
      configurable: false,
      enumerable: true,
    });

    AutoEmbedManager.Attach('data-cookie', 
      (...args: any) => CompositeSheet.Create(EmbeddedSpreadsheet, args[0]));

    /*
    document.addEventListener('DOMContentLoaded', () => AutoEmbedManager.Run());
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'complete') {
        AutoEmbedManager.Run();
      }
    });
    */

  }

})();

