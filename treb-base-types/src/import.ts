
import { Style } from './style';

/**
 * this is moved from export to avoid a circular reference
 */
export interface ImportedSheetData {
  name: string|undefined;
  cells: any[];
  default_column_width: number;
  column_widths: number[];
  row_heights: number[];
  styles: Style.Properties[];
}

