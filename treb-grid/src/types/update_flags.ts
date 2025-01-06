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

import type { Area } from 'treb-base-types';

/**
 * trying to split data management from the grid, we are updating the
 * command queue so that (some/most) methods return hints as to what
 * needs to update: a nonvisible grid can just ignore this, but the 
 * visible grid can use it to trigger layout/repaint/etc.
 */
export interface UpdateFlags {

  /** sheet names or order have changed, update the tab bar */
  sheets?: boolean;

  /** 
   * structure refers to rows/columns/sheets -- something has been
   * added, removed, or resized
   */
  structure?: boolean;

  /**
   * on sheet change, hide hover info -- hyperlink, note, &c
   */
  active_sheet?: boolean;

  /**
   * formula -- we might need to update the formula bar
   */
  formula?: boolean;

  /**
   * layout is changing. use this as a proxy for the old "queue layout update"
   */
  layout?: boolean;

  /** non-active sheets updated. we set flags to update layout on activate */
  pending?: number[];

  /** 
   * this is only used by the setheaders command, which needs to come 
   * out. so this should also come out.
   */
  repaint?: boolean;

  data_event?: boolean;
  style_event?: boolean;
  conditional_formatting_event?: boolean;
  structure_event?: boolean;
  structure_rebuild_required?: boolean;

  /** 
   * new, an indication to split views that we might need to update/reinflate
   * annotations.
  */
  annotation_event?: boolean;

  render_area?: Area;
  data_area?: Area;
  style_area?: Area;


}