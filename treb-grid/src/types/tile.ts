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
