
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

  /** show the "insert function" button. requires formula bar. */
  insert_function_button?: boolean;

  /** scale (wip) */
  // scale?: number;

  /** enable scrolling (default true) */
  scrollbars?: boolean;

  /** always show grid, even if there is background color */
  grid_over_background?: boolean;

}

export const DefaultGridOptions: GridOptions = {
  scrollbars: true,
  in_cell_editor: true,
  formula_bar: true,
  insert_function_button: false,
  expand: true,
  repaint_on_cell_change: true,
  grid_over_background: false, // true,
};
