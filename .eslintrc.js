module.exports = {
  env: {
    'browser': true,
    'node': true,
  },
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],

  rules: {
    'no-irregular-whitespace': [
      'error',
      {
        skipComments: true,
      }
    ],
    'camelcase': 'off',
    '@typescript-eslint/camelcase': 'off',     
    // '@typescript-eslint/explicit-function-return-type': 'off',     
    '@typescript-eslint/quotes': [
      'error',
      'single',
      { 'allowTemplateLiterals': true },
    ],
    'brace-style': 'off',
    '@typescript-eslint/brace-style': [
      'error',
      'stroustrup',
      { 'allowSingleLine': true },
    ],
    '@typescript-eslint/interface-name-prefix': 'off',

    /*

    FIXME: needs configuration. I'm ok with it generally but why split 
    accessors for the same field?

    UPDATE: see also https://eslint.org/docs/rules/grouped-accessor-pairs

    not sure how these work together

    '@typescript-eslint/member-ordering': [
      'error',
    ],
    */

    'grouped-accessor-pairs': ['error', 'getBeforeSet'],
    
  }

  /*
  "rules": {
    "@typescript-eslint/adjacent-overload-signatures": "error",
    "@typescript-eslint/array-type": "error",
    "@typescript-eslint/ban-types": "error",
    "@typescript-eslint/class-name-casing": "error",
    "@typescript-eslint/consistent-type-assertions": "error",
    "@typescript-eslint/indent": [
        2
    ],
    "@typescript-eslint/no-empty-function": "error",
    "@typescript-eslint/no-empty-interface": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-misused-new": "error",
    "@typescript-eslint/no-namespace": "error",
    "@typescript-eslint/no-parameter-properties": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-var-requires": "error",
    "@typescript-eslint/prefer-for-of": "error",
    "@typescript-eslint/prefer-function-type": "error",
    "@typescript-eslint/prefer-namespace-keyword": "error",
    "@typescript-eslint/quotes": [
        "error",
        "single"
    ],
    "@typescript-eslint/triple-slash-reference": "error",
    "@typescript-eslint/unified-signatures": "error",
    "camelcase": "off",
    "complexity": "off",
    "constructor-super": "error",
    "curly": [
        "error",
        "multi-line"
    ],
    "dot-notation": "error",
    "eqeqeq": [
        "error",
        "smart"
    ],
    "guard-for-in": "error",
    "id-blacklist": "error",
    "id-match": "error",
    "import/order": "off",
    "max-classes-per-file": [
        "error",
        1
    ],
    "new-parens": "error",
    "no-bitwise": "error",
    "no-caller": "error",
    "no-cond-assign": "error",
    "no-console": "off",
    "no-debugger": "error",
    "no-empty": "error",
    "no-eval": "error",
    "no-fallthrough": "off",
    "no-invalid-this": "off",
    "no-multiple-empty-lines": "off",
    "no-new-wrappers": "error",
    "no-shadow": [
        "error",
        {
            "hoist": "all"
        }
    ],
    "no-throw-literal": "error",
    "no-trailing-spaces": "error",
    "no-undef-init": "error",
    "no-underscore-dangle": "error",
    "no-unsafe-finally": "error",
    "no-unused-expressions": "error",
    "no-unused-labels": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "one-var": [
        "error",
        "never"
    ],
    "prefer-arrow/prefer-arrow-functions": "error",
    "prefer-const": "error",
    "quote-props": [
        "error",
        "as-needed"
    ],
    "radix": "error",
    "spaced-comment": "error",
    "use-isnan": "error",
    "valid-typeof": "off",

    / *
    "@typescript-eslint/tslint/config": [
        "error",
        {
            "rules": {
                "jsdoc-format": true,
                "no-reference-import": true,
                "one-line": [
                    true,
                    "check-open-brace"
                ]
            }
        }
    ]
    * /
  }
  */
};
