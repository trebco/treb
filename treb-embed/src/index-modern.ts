
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

  // new, tracking

  instances?: EmbeddedSpreadsheetBase[],

}

// convenience type
type DecoratedGlobal = typeof self & { TREB?: TREBNamespace };

(() => {

  if (!(self as DecoratedGlobal).TREB) {

    // find path for worker loaders
    EmbeddedSpreadsheetBase.BuildPath();

    const instances: EmbeddedSpreadsheetBase[] = [];

    const value: TREBNamespace = {
      version: process.env.BUILD_VERSION, // this is fake, it will get replaced
      instances,
      CreateSpreadsheet: (options: CreateSheetOptions) => {
        const composite = CompositeSheet.Create(EmbeddedSpreadsheetBase, options);
        instances.push(composite.sheet);
        return composite.sheet;
      },
    };

    // NOTE: dropping formatter but keeping engine/headless (for now)
    // FIXME: does RAW depend on formatter? can't remember... put it 
    // back if necessary

    if (EmbeddedSpreadsheetBase.enable_engine) {
      value.CreateEngine = (options = {}) => new EmbeddedSpreadsheetBase(options);
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
        const composite = CompositeSheet.Create(EmbeddedSpreadsheetBase, args[0]);
        instances.push(composite.sheet);
        return composite.sheet;
      });

  }

})();

// re-export

export { EmbeddedSpreadsheetBase as EmbeddedSpreadsheet } from './embedded-spreadsheet-base';
