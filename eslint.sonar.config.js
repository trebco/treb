// @ts-check

// standalone config for running sonar rules (eslint-plugin-sonarjs).
// this is separate from the main config, and is only used by the
// "lint:sonar" script. it reports sonar findings only.

import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },

    // source has disable directives for rules in the main config,
    // which would show as unused here

    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  sonarjs.configs.recommended,
);
