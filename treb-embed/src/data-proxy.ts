/**
 * testing a proxy for simplified cell/sheet access
 */

import { CellValue } from 'treb-base-types';
import { RangeReference, SetRangeOptions, GetRangeOptions } from './embedded-spreadsheet-base';

export interface SheetContainer {
  GetRange: (range?: RangeReference, options?: GetRangeOptions) => CellValue|CellValue[][],
  GetSheetID: (sheet: string|number) => number|undefined,
  SetRange: (range?: RangeReference, data?: CellValue|CellValue[][], options?: SetRangeOptions) => void,
}

export type ProxyOptions = SetRangeOptions & GetRangeOptions;

const IsNumber = (s: string) => {
  return !isNaN(Number(s)) && !isNaN(parseFloat(s));
};

const IsInteger = (s: string) => {
  return IsNumber(s) && !(Number(s) % 1);
};

/**
 * this proxy should have the sheet (optionally) and the row bound, so the
 * only access is the column. from here you can get/set value.
 */
export const CreateRowProxy = (instance: SheetContainer, sheet_id: number|undefined, row: number, options: ProxyOptions = {}) => {

  const clone: ProxyOptions = {...options};

  return new Proxy({}, {
    
    get: (target: object, prop: string|symbol, reeiver: any) => {
      if (prop === 'options') {
        return new Proxy(clone, {});
      }
      if (IsInteger(typeof prop === 'string' ? prop : prop.toString())) {
        return instance.GetRange({
            row, column: Number(prop), sheet_id,
          }, options);
      }
      return undefined;
    },

    set: (target: object, prop: string|symbol, value: any) => {
      if (IsInteger(typeof prop === 'string' ? prop : prop.toString())) {
        instance.SetRange({
            row, column: Number(prop), sheet_id,
          }, value, options);
          return true;
      }
      return false;
    },
  });
};

/**
 * this is the first access proxy -- if you pass a number, it's interpreted 
 * as a row. if you pass a string, it's interpreted as a sheet name.
 * 
 * in either case, we return a new proxy that is either bound to the sheet
 * or to a row; if you don't use a sheet name, the active sheet is implict.
 * 
 * FIXME: can we cache sheet IDs? would be helpful. maybe target of the
 * call could cache, since that one can know when they change.
 */
export const CreateProxy = (instance: SheetContainer, sheet_id: number|undefined = undefined, options: ProxyOptions = {}): any => {

  const clone: ProxyOptions = {...options};

  return new Proxy({}, {
    get: (target: object, prop: string|symbol) => {

      // integer index is a row; we want to return an object that can
      // return a column.

      if (IsInteger(typeof prop === 'string' ? prop : prop.toString())) {
        return CreateRowProxy(instance, sheet_id, Number(prop), clone);
      }
      
      if (typeof sheet_id === 'undefined') {
        const sheet_id = instance.GetSheetID(prop.toString());
        if (typeof sheet_id === 'number') {
          return CreateProxy(instance, sheet_id, clone);
        }
      }

      if (prop === 'options' || prop === Symbol.for('options')) {
        return new Proxy(clone, {});
      }

      return undefined;

    },
    set: (target: object, prop: string|symbol, value: any) => {
      /*
      if (prop === 'options' || prop === Symbol.for('options')) {
        clone = value;
      }
      */
      return false;
    },
  });
};


