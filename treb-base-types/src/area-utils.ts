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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import type { IArea } from './area';
import type { ICellAddress } from './area';

/**
 * area being a class is a mistake, but it will take a while
 * to undo that (if we do it at all). for now we'll start creating
 * utilities that can operate on the interface type, and maybe over
 * time the class will wither.
 */

export function* Iterate(area: IArea): Generator<ICellAddress> {

  /**
   * this doesn't serialize. perhaps we should switch to -1, 
   * which is obviously invalid. although I think we may from
   * time to time use that as a flag. which is bad, obviously.
   * if we do that we'll need to define a new interface. which
   * might be good.
   */
  if (area.start.row === Infinity || area.end.row === Infinity) {
    throw new Error(`don't iterate infinite area`);
  }

  /*
  if (area.entire_row || area.entire_column) {
    throw new Error(`don't iterate infinite area`);
  }
  */

  const sheet_id = area.start.sheet_id;

  for (let row = area.start.row; row <= area.end.row; row++) {
    for (let column = area.start.column; column <= area.end.column; column++) {
      yield { row, column, sheet_id };
    }
  }

}

