
import { Sheet } from './sheet';
// import { Annotation } from './annotation';
import { NamedRangeCollection } from './named_range';

/**
 * transition support
 * 
 * TODO: annotations should be tied to sheet
 *       sheets need names (or IDs?)
 *       -> map of names -> sheets
 *       named ranges should be in model, not sheet, because
 *       they may point to different sheets
 */
export interface DataModel {
  document_name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_data?: any;
  active_sheet: Sheet;
  sheets: Sheet[];
  // annotations: Annotation[];
  named_ranges: NamedRangeCollection;
}
