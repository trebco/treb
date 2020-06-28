module.exports = {
  'roots': [
    './test'
  ],
  'testMatch': [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  'transform': {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      tsConfig: 'treb-format/modern.tsconfig.json' // relative to ?
    }
  },
  moduleNameMapper: {
    'treb-base-types': '../../treb-base-types',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',

}
