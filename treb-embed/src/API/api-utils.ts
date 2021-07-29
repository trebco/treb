
// import { ICellAddress } from 'treb-base-types/src';

import type { EmbeddedSpreadsheetBase } from '../embedded-spreadsheet-base';
import { QuotedSheetNameRegex } from 'treb-parser';

export class APIUtils {

  /**
   * 
   * @param sheet 
   * @param id 
   * @param quote add quotes if necessary
   * @returns 
   */
  public static ResolveSheetName(base: EmbeddedSpreadsheetBase, id: number, quote = false): string|undefined {
    for (const sheet of base.grid.model.sheets) {
      if (sheet.id === id) { 
        if (QuotedSheetNameRegex.test(sheet.name)) {
          return `'${sheet.name}'`;
        }
        return sheet.name; 
      }
    }
    return undefined;
  }

}
