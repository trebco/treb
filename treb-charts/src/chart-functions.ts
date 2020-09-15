import { ReturnType } from 'treb-calculator/src/descriptors';

// TYPE ONLY
type FunctionMap = import('../../treb-calculator/src/descriptors').FunctionMap;

/** function returns its arguments */
const Identity = (...args: any[]) => args;

export interface DecoratedArray<T> extends Array<T> {
  _type: string;
}

/**
 * chart functions for registration
 */
export const ChartFunctions: FunctionMap = {

  /* new: also helper */
  'Group': {
    arguments: [
      { name: 'Array...', metadata: true, },
    ],
    fn: (...args: DecoratedArray<unknown>): DecoratedArray<unknown> => {
      args._type = 'group';
      return args;
    },
  },

  /* new: helper */
  'Series': {
    arguments: [
      { name: 'Array...', metadata: true, },
    ],
    fn: (...args: DecoratedArray<unknown>): DecoratedArray<unknown> => {
      args._type = 'series';
      return args;
    },
  },

  /*
  'Scatter.Plot': {
    arguments: [
      { name: 'data', metadata: true, },
      { name: 'Title' },
    ],
    fn: Identity,
  },
  */

  'Scatter.Line': {
    arguments: [
      { name: 'data', metadata: true, },
      { name: 'Title' },
    ],
    fn: Identity,
  },

  'Column.Chart': {
    arguments: [
      { name: 'y', metadata: true, },
      { name: 'labels', metadata: true, },
      { name: 'Title' },
    ],
    fn: Identity,
  },

  'Bar.Chart': {
    arguments: [
      { name: 'x', metadata: true, },
      { name: 'labels', metadata: true, },
      { name: 'Title' },
    ],
    fn: Identity,
  },

  'Line.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'Title' },
    ],
    fn: Identity,
  },

  'Area.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'Title' },
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

};
