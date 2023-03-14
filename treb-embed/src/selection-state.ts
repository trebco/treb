
import type { GridSelection } from 'treb-grid';
import type { Style } from 'treb-base-types';

/**
 * state that should be reflected in toolbar buttons/selections
 */
export interface SelectionState {
  style?: Style.Properties;
  merge?: boolean;
  table?: boolean;
  frozen?: boolean;
  comment?: string;
  selection?: GridSelection;
  relative_font_size?: number;
}
