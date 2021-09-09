
import { EmbeddedSpreadsheetBase } from './embedded-spreadsheet-base';

// polyfills for legacy support

// tslint:disable-next-line:no-var-requires
require('core-js/es/promise');

// tslint:disable-next-line:no-var-requires
require('core-js/es/object/assign');

// tslint:disable-next-line:no-var-requires
require('core-js/es/array/from');

// tslint:disable-next-line:no-var-requires
require('core-js/es/typed-array');

// tslint:disable-next-line:no-var-requires
// require('core-js/es/symbol');

EmbeddedSpreadsheetBase.treb_language = 'es5'; // load legacy modules


// old index
import './main';

// why are we exporting this? (...)
export { EmbeddedSpreadsheet } from './embedded-spreadsheet';
