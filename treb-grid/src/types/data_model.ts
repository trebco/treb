
import { Sheet } from './sheet';

/**
 * transition support
 */
export interface DataModel {
  name?: string;
  user_data?: any;
  sheet: Sheet;
}
