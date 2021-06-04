
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
    fn: (...args: any) => {
      (args as DecoratedArray<unknown>)._type = 'group';
      return args;
    }
  },

  /**
   * UPDATE: adding explicit names to Series, for convention. Use the 
   * more general "group" if you just want to group things.
   */
  'Series': {
    arguments: [
      { name: 'Label' }, // , metadata: true, },
      { name: 'X', metadata: true, },
      { name: 'Y', metadata: true, },
    ],
    fn: (...args: any) => {
      (args as DecoratedArray<unknown>)._type = 'series';
      return args;
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
