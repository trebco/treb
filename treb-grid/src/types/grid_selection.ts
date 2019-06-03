
import { Area, CellAddress } from 'treb-base-types';

/**
 *
 */
export interface GridSelection {

  /** target or main cell in the selection */
  target: CellAddress;

  /** selection area */
  area: Area;

  /** there is nothing selected, even though this object exists */
  empty?: boolean;

}
