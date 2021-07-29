
import { ICellAddress } from 'treb-base-types/src';

import type { EmbeddedSpreadsheetBase } from '../embedded-spreadsheet-base';
import type { Grid } from 'treb-grid';
import type { Parser } from 'treb-parser';
import type { Calculator } from 'treb-calculator';
import { QuotedSheetNameRegex } from 'treb-parser';

export class APIUtils {

  /**
   * 
   * @param sheet 
   * @param id 
   * @param quote add quotes if necessary
   * @returns 
   */
  public static ResolveSheetName(sheet: EmbeddedSpreadsheetBase, id: number, quote = false) {
    const sheets = ((sheet as any).grid as Grid).model.sheets;
    for (const sheet of sheets) {
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
