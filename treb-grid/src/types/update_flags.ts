
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
  structure_event?: boolean;
  structure_rebuild_required?: boolean;

  render_area?: Area;
  data_area?: Area;
  style_area?: Area;


}