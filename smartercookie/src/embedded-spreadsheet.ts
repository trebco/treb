
import { Calculator } from 'treb-calculator';
import { EmbeddedSpreadsheetBase } from '../../treb-embed/src/embedded-spreadsheet-base';
import { EmbeddedSpreadsheetOptions } from '../../treb-embed/src/options';

import { Init as USVInit } from '../../lib/test/us-volume-init';
USVInit();

export class EmbeddedSpreadsheet extends EmbeddedSpreadsheetBase<Calculator> {

  constructor(options: EmbeddedSpreadsheetOptions) {
    super(options, Calculator);
  }  

}
