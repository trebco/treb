/**
 * 
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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import type { ICellAddress } from './area';

/**
 * offset from corner, as % of cell
 */
export interface AddressOffset {
  x: number, 
  y: number,
}

/** 
 * represents one corner of a layout rectangle
 */
export interface Corner {
  address: ICellAddress;
  offset: AddressOffset;
}  

/**
 * represents the layout of an annotation, reference to the sheet
 */
export interface AnnotationLayout {
  tl: Corner;
  br: Corner;
}

