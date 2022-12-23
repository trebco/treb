
import type { ICellAddress, CellValue, ValueType, Style } from 'treb-base-types';

export interface ClipboardCellData {
  address: ICellAddress;
  data: CellValue;
  type: ValueType;
  style?: Style.Properties;
  array?: {rows: number, columns: number};
}
