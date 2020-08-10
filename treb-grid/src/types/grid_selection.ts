
import { Area, ICellAddress } from 'treb-base-types';

/**
 * FIXME: this is broken. we treat this as a simple javascript object,
 * cloning and creating via JSON, but area is a class instance.
 * 
 * that means cloned objects won't work properly (if anyone is relying on 
 * that object).
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

export const CloneSelection = (rhs: GridSelection): GridSelection => {
  return JSON.parse(JSON.stringify(rhs));
};
