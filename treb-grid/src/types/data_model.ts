
import { Sheet } from './sheet';
import { NamedRangeCollection } from './named_range';

/**
 * 
 */
export interface DataModel {

  /** document metadata */
  document_name?: string;

  /** document metadata */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_data?: any;

  /** reference */
  active_sheet: Sheet;

  /** 
   * list of sheets. we _should_ index these by ID, so we 
   * don't have to look up. FIXME/TODO
   */
  sheets: Sheet[];

  /** named ranges are document-scope, we don't support sheet-scope names */
  named_ranges: NamedRangeCollection;

}
