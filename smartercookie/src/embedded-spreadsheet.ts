
// import { Calculator } from 'treb-calculator';
import { OverloadCalculator as Calculator } from './overload-calculator';
import { EmbeddedSpreadsheetBase } from '../../treb-embed/src/embedded-spreadsheet-base';
import { EmbeddedSpreadsheetOptions } from '../../treb-embed/src/options';

import { Init as USVInit } from '../../lib/test/us-volume-init';
USVInit();

export class EmbeddedSpreadsheet extends EmbeddedSpreadsheetBase<Calculator> {

  constructor(options: EmbeddedSpreadsheetOptions) {
    super(options, Calculator);
    this.parser.flags.dimensioned_quantities = true;
  }  

  protected UpdateDocumentStyles(update = true): void {

    super.UpdateDocumentStyles(update);

    if (!this.toolbar) {
      return;
    }

    this.toolbar.number_formats = [
      'US/Imperial',
      'US/g',
      'Metric',
      'General',
      'Number',
      'Percent',
    ];

    this.toolbar.date_formats = [];

    // console.info(number_format_map, color_map);

  }

}
