
// TYPE ONLY
type FunctionMap = import('../../treb-calculator/src/descriptors').FunctionMap;

/** function returns its arguments */
const Identity = (...args: any[]) => args;

/**
 * chart functions for registration
 */
export const ChartFunctions: FunctionMap = {

  /* new: helper */
  'Series': {
    arguments: [
      { name: 'Array...', metadata: true, },
    ],
    fn: (...args: any[]) => {
      (args as any)._type = 'series';
      return args;
    },
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
      { name: 'Values' },
      { name: 'Labels' },
      { name: 'Title' },
      { name: 'Sort' },
      { name: 'Label' },
    ],
    fn: Identity,
  },

  'Donut.Chart': {
    arguments: [
      { name: 'Values' },
      { name: 'Labels' },
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
