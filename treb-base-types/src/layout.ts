/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
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

