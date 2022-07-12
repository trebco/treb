/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import type { Point, Size, Position } from 'treb-base-types';

/**
 * tile adds some metadata to canvas
 *
 * FIXME: there might be some performance cost with this, versus a wrapper
 * or container class/interface that just holds the canvas.
 */
export interface Tile extends HTMLCanvasElement {

  /** contents have changed, needs repainting */
  dirty: boolean;

  /** never painted or layout has changed: repaint everything */
  needs_full_repaint: boolean;

  /** position in the grid, in grid rows/columns */
  tile_position: Position;

  /** first cell in the tile */
  first_cell: Position;

  /** last cell in the tile, more useful than extent */
  last_cell: Position;

  /** position in the grid, in pixels */
  pixel_start: Point;

  /** position in the grid, in pixels */
  pixel_end: Point;

  /**
   * tile size in pixels, matching css height/width. this is
   * different than the _canvas_ height/width, which is scaled
   * to dpr for high-dpi displays.
   */
  logical_size: Size;
}
