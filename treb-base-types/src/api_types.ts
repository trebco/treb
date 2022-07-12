/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
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
