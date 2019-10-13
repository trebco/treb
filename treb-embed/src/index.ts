

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

// old index
import './main';

// why are we exporting this? (...)
export { EmbeddedSpreadsheet } from './embedded-spreadsheet';
