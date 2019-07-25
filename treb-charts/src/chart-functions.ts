
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
    fn: (...args: any[]) => {
      return args;
    },
  },

  'Donut.Chart': {
    arguments: [
      { name: 'Values' },
      { name: 'Labels' },
      { name: 'Title' },
      { name: 'Sort' },
    ],
    fn: (...args: any[]) => {
      return args;
    },
  },

  'MC.Histogram': {
    address: [0],
    arguments: [
      { name: 'Reference Cell' },
      { name: 'Title' },
    ],
    fn: (...args: any[]) => {
      return args;
    },
  },

  'MC.Correlation': {
    address: [0, 1],
    arguments: [
      { name: 'Reference Cell 1' },
      { name: 'Reference Cell 2' },
      { name: 'Title' },
    ],
    fn: (...args: any[]) => {
      return args;
    },
  },

};
