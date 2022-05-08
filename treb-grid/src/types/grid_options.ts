
import { CellValue } from 'treb-base-types';
import { StatsEntry } from './tab_bar';

export type StatsFunction = (data: CellValue|CellValue[][]|undefined) => StatsEntry[];

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

  /** show delete tab in the tab bar */
  delete_tab?: boolean;

  /** show the "insert function" button. requires formula bar. */
  insert_function_button?: boolean;

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

}

export const DefaultGridOptions: GridOptions = {
  scrollbars: true,
  in_cell_editor: true,
  formula_bar: true,
  add_tab: false,
  tab_bar: 'auto',
  insert_function_button: false,
  expand_formula_button: false,
  expand: true,
  repaint_on_cell_change: true,
  grid_over_background: false, // true,
};
