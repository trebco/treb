
import { Sheet } from './sheet';
import { Annotation } from './annotation';

/**
 * transition support
 */
export interface DataModel {
  document_name?: string;
  user_data?: any;
  sheet: Sheet;
  annotations: Annotation[];
}
