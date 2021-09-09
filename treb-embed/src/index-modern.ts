
import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';
import { EmbeddedSpreadsheet } from './embedded-spreadsheet';
import { CompositeSheet } from './composite-sheet';
import { CreateSheetOptions } from './options';
import { AutoEmbedManager } from './auto-embed';

interface TREBNamespace {
  CreateSpreadsheet?: (options: CreateSheetOptions) => EmbeddedSpreadsheetBase,
  version?: string,
}

//
// convenience type
//
type DecoratedGlobal = typeof global & { TREB?: TREBNamespace, document?: Document };

//
// we're switching to using webpack's default library behavior. this 
// will create a containing variable, so we don't need to name that.
// we just need to export the things that will be visible in that module.
//
// in theory, at least, this will be transparent to the original. we just
// need to find a way to run the autoembed ONLY IF we're in a global. ?
//
export const version = process.env.BUILD_VERSION; // this is fake, it will get replaced
export const CreateSpreadsheet = (options: CreateSheetOptions): EmbeddedSpreadsheet => CompositeSheet.Create(options);

(() => {

  EmbeddedSpreadsheetBase.treb_language = 'es6'; // load es6 modules
  EmbeddedSpreadsheetBase.BuildPath();

  const g = (global as DecoratedGlobal);

  if (g.document) {
    console.info(`there's a document...`);
    console.info('1| is there a global?', !!g.TREB);
    Promise.resolve().then(() => {
      console.info('2| is there a global?', !!g.TREB);

      if (g.TREB) {
        document.addEventListener('DOMContentLoaded', () => AutoEmbedManager.Run());
        document.addEventListener('readystatechange', () => {
          if (document.readyState === 'complete') {
            AutoEmbedManager.Run();
          }
        });
      }

    });
  }
  else {
    console.info('no document detected');
  }

})();
