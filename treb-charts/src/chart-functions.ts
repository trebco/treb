
import { UnionValue, ValueType } from 'treb-base-types';

// TYPE ONLY
type FunctionMap = import('../../treb-calculator/src/descriptors').FunctionMap;

/** 
 * we might as well do this properly, since we're in the 
 * middle of an overhaul anyway 
 */

/* * function returns its arguments * /
// const Identity = (...args: any[]) => (args as any) as UnionValue; // it's not
*/

/** box this properly as "extended" type */
const Identity = (...args: any[]): UnionValue => {
  return {
    type: ValueType.object,
    value: args,
    key: 'arguments',
  };
};

// export interface DecoratedArray<T> extends Array<T> {
//  _type: string;
// }

/**
 * chart functions for registration
 */
export const ChartFunctions: FunctionMap = {

  /* new: also helper */
  'Group': {
    arguments: [
      { name: 'Array...', metadata: true, },
    ],
    fn: (...args: any) => {
      // (args as DecoratedArray<unknown>)._type = 'group';
      // return args;

      return {
        type: ValueType.object,
        value: args,
        key: 'group',
      };

    }
  },

  /**
   * UPDATE: adding explicit names to Series, for convention. Use the 
   * more general "group" if you just want to group things.
   * 
   * boxing properly as "extended" type
   */
  'Series': {
    arguments: [
      { name: 'Label' }, // , metadata: true, },
      { name: 'X', metadata: true, },
      { name: 'Y', metadata: true, },
      { name: 'index', },
    ],
    fn: (...args: any) => {
      // (args as DecoratedArray<unknown>)._type = 'series';
      // return args;

      return {
        type: ValueType.object,
        value: args,
        key: 'series',
      };

    }

  },

  'Bar.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Categories', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Line.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Area.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Pie.Chart': {
    arguments: [
      { name: 'Values', metadata: true, },
      { name: 'Labels' },
      { name: 'Title' },
      { name: 'Sort' },
      { name: 'Label' },
    ],
    fn: Identity,
  },

  'Donut.Chart': {
    arguments: [
      { name: 'Values', metadata: true, },
      { name: 'Labels', metadata: true },
      { name: 'Title' },
      { name: 'Sort' },
      { name: 'Label' },
    ],
    fn: Identity,
  },

  'MC.Histogram': {
    arguments: [
      { name: 'Reference Cell', metadata: true },
      { name: 'Title' },
    ],
    fn: Identity,
  },

  'MC.Correlation': {
    arguments: [
      { name: 'Reference Cell 1', metadata: true },
      { name: 'Reference Cell 2', metadata: true },
      { name: 'Title' },
    ],
    fn: Identity,
  },

 'Scatter.Line': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Scatter.Plot': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

 'Column.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Categories', metadata: true, },
      { name: 'Chart Title' },
    ],
    fn: Identity,
  },

};
