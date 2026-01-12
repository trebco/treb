/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import { Area, type IArea, type ICellAddress } from 'treb-base-types';

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

  /** for cacheing addtional selections. optimally don't serialize */
  rendered?: boolean;

}

/**
 * temporarily splitting into a serialized version that uses IArea instead
 * of Area. we should do this for the actual selection type, but it breaks
 * too many things atm to do that immediately. TODO/FIXME.
 */
export interface SerializedGridSelection {

  /** target or main cell in the selection */
  target: ICellAddress;

  /** selection area */
  area: IArea;

  /** there is nothing selected, even though this object exists */
  empty?: boolean;

  /** for cacheing addtional selections. optimally don't serialize */
  rendered?: boolean;

}

/**
 * create an empty selection
 * @internal
 */
export const CreateSelection = (): GridSelection => {
  return {
    target: {row: 0, column: 0},
    area: new Area({row: 0, column: 0}),
    empty: true,
  };
};

/**
 * @internal
 */
export const CloneSelection = (rhs: GridSelection): GridSelection => {
  return JSON.parse(JSON.stringify(rhs));
};
