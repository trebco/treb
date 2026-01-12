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

import type { CellValue } from 'treb-base-types';
import type { StatsEntry } from './tab_bar';

export type StatsFunction = (data: CellValue|CellValue[][]|undefined) => StatsEntry[];


/**
 * @internalRemarks
 * 
 * why are there two levels of options? can we consolidate this with
 * the embedded spreadsheet options? they are never (AFAICT) used 
 * independently. maybe that's recent.
 */
export interface GridOptions {

  /** can expand rows/columns */
  expand?: boolean;

  /**
   * if you are running a calculator, you might not want the grid
   * to repaint any time there's a data change (which is the default
   * behavior).
   */
  repaint_on_cell_change?: boolean;

  /** support in-cell editing */
  in_cell_editor?: boolean;

  /** show the formula bar (and allow editing; TODO: read-only option) */
  formula_bar?: boolean;

  /** show the tab bar */
  tab_bar?: boolean|'auto';

  /** scale controls. implies tab bar */
  scale_control?: boolean;

  /** stats panel. implies tab bar */
  stats?: boolean|StatsFunction;

  /** save/load scale to storage, with the given key */
  persist_scale_key?: string;

  /** allow add tab */
  add_tab?: boolean;

  /* * show delete tab in the tab bar */
  // delete_tab?: boolean;

  /* * show the "insert function" button. requires formula bar. * /
  insert_function_button?: boolean;
  */

  /** button to increase/reduce size of formula editor */
  expand_formula_button?: boolean;

  /** scale (wip) */
  // scale?: number;

  /** enable scrolling (default true) */
  scrollbars?: boolean;

  /** always show grid, even if there is background color */
  grid_over_background?: boolean;

  /** initial scale for layout */
  initial_scale?: number;

  /** support MD formatting in text */
  markdown?: boolean;

  /** support MD formatting in comments */
  comment_markdown?: boolean;

  /** support font stacks */
  support_font_stacks?: boolean;

}

export const DefaultGridOptions: GridOptions = {
  scrollbars: true,
  in_cell_editor: true,
  formula_bar: true,
  add_tab: false,
  tab_bar: 'auto',
  // insert_function_button: false,
  expand_formula_button: false,
  expand: true,
  comment_markdown: true,
  repaint_on_cell_change: true,
  grid_over_background: false, // true,
};
