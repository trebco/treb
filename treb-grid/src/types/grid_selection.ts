
import { Area, ICellAddress } from 'treb-base-types';

/**
 *
 */
export interface GridSelection {

  /** target or main cell in the selection */
  target: ICellAddress;

  /** selection area */
  area: Area;

  /** there is nothing selected, even though this object exists */
  empty?: boolean;

}
