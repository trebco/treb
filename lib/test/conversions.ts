
/**
 * mass/volume conversions for some standard items (WIP)
 */
export const MassVolumeConversions = {
  'butter': 113.398 / 118.2944, // g/ml
  'egg': 1.1724629442604009, // g/ml (average, US)
  'water': 1, // definition of gram
};

/**
 * nonstandard units, by type
 */
export const NonStandardUnits = {
  egg: {
    medium: {
      measure: 'volume',
      ml: 43,
    },
    large: {
      measure: 'volume',
      ml: 46,
    }, 
    'extra-large': {
      measure: 'volume',
      ml: 56,
    },
  },
  butter: {
    stick: {
      measure: 'volume',
      ml: 14.7868,
    }
  }
};

