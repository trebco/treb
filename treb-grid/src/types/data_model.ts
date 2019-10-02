
import { Sheet } from './sheet';
import { Annotation } from './annotation';

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
  user_data?: any;
  sheet: Sheet;
  annotations: Annotation[];
}
