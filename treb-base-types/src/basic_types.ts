/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

/**
 * utility types collected from various other files,
 * attempting to consolidate
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Position {
  row: number;
  column: number;
}

export interface Extent {
  rows: number;
  columns: number;
}
