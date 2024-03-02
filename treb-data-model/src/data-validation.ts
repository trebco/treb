
import type { IArea, CellValue } from 'treb-base-types';

/** @internal */
export interface DataValidationRange {
  type: 'range'; 
  area: IArea;
}

/** @internal */
export interface DataValidationList {
  type: 'list'; 
  list: CellValue[];
}

/** @internal */
export interface DataValidationDate {
  type: 'date'; 
}

/** @internal */
export interface DataValidationNumber {
  type: 'number'; 
}

/** @internal */
export interface DataValidationBoolean {
  type: 'boolean'; 
}

/** @internal */
export type DataValidation 
  = (DataValidationList
  | DataValidationRange
  | DataValidationNumber
  | DataValidationDate
  | DataValidationBoolean) & {

  error?: boolean;
  // target: Area[];  // can be multple so we'll default to array
  target: IArea[];

}

