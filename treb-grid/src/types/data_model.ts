
import { Sheet } from './sheet';

/**
 * transition support
 */
export interface DataModel {
  document_name?: string;
  user_data?: any;
  sheet: Sheet;
}
