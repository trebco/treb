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
      tsConfig: 'treb-base-types/modern.tsconfig.json' // relative to ?
    }
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',

}
