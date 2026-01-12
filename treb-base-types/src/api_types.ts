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

import type { ICellAddress, IArea } from './area';

// for updated API functions

/**
 * type represents a reference passed in to API functions. it can be an
 * address object, or a string. 
 */
 export type AddressReference = string | ICellAddress;

 /**
  * type represents a reference passed in to API functions. it can be an
  * address object, an area (range) object, or a string. 
  */
 export type RangeReference = string | ICellAddress | IArea;
