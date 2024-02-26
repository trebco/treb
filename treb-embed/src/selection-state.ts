
import type { GridSelection } from 'treb-data-model';
import type { CellStyle } from 'treb-base-types';

/**
 * state that should be reflected in toolbar buttons/selections
 */
export interface SelectionState {
  style?: CellStyle;
  merge?: boolean;
  table?: boolean;
  frozen?: boolean;
  comment?: string;
  selection?: GridSelection;
  relative_font_size?: number;
}
