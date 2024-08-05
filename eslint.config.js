// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {

      // allow destructuring to use let if some vars are changed

      "prefer-const": [
        "error", { 
          "destructuring": "all",
        },
      ],


      // allow destructuring to use garbage variables. prefix name with 
      // underscore (or just use underscore).

      "@typescript-eslint/no-unused-vars": [
        "error", { 
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        }],
    },
  },
);
