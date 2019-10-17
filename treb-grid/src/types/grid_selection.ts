
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

/**
 * create an empty selection
 */
export const CreateSelection = (): GridSelection => {
  return {
    target: {row: 0, column: 0},
    area: new Area({row: 0, column: 0}),
    empty: true,
  };
};
