
const Identity = (...args: any[]) => args;

/**
 * chart functions for registration
 */
export const ChartFunctions = {

  'Pie.Chart': {
    arguments: [
      { name: 'Values' },
      { name: 'Labels' },
      { name: 'Title' },
      { name: 'Sort' },
    ],
    fn: Identity,
  },

  'Donut.Chart': {
    arguments: [
      { name: 'Values' },
      { name: 'Labels' },
      { name: 'Title' },
      { name: 'Sort' },
    ],
    fn: Identity,
  },

  'MC.Histogram': {
    metadata: [0],
    arguments: [
      { name: 'Reference Cell' },
      { name: 'Title' },
    ],
    fn: Identity,
  },

  'MC.Correlation': {
    metadata: [0, 1],
    arguments: [
      { name: 'Reference Cell 1' },
      { name: 'Reference Cell 2' },
      { name: 'Title' },
    ],
    fn: Identity,
  },

};
