
import { Style } from './style';
import { ValueType } from './value-type';
import { IArea } from './area';
import { AnnotationLayout } from './layout';
import { DataValidation } from './cell';

export interface CellParseResult {
  row: number,
  column: number,
  type: ValueType,
  value: number|string|undefined|boolean,
  calculated?: number|string|undefined|boolean,
  calculated_type?: ValueType,
  style_ref?: number,
  hyperlink?: string,
  validation?: DataValidation,
  merge_area?: IArea,
  area?: IArea,
}

export interface AnchoredAnnotation {
  layout: AnnotationLayout;
  type?: string;
  formula?: string;
}

/**
 * this is moved from export to avoid a circular reference
 */
export interface ImportedSheetData {
  name: string|undefined;
  cells: CellParseResult[];
  default_column_width: number;
  column_widths: number[];
  row_heights: number[];
  styles: Style.Properties[];

  // optional, for backcompat
  sheet_style?: number;
  column_styles?: number[];

  // new
  annotations?: AnchoredAnnotation[];

  hidden?: boolean;

}

