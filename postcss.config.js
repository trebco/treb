module.exports = {
  plugins: {

    /** for import */
    'postcss-import': {},

    /* we're using this for sass-style variables ($x: 100) */
    'precss': {},

    /** we have one file that uses calc with variables, this reduces that to constants */
    'postcss-calc': {},

    /** this is for charts only. TODO: preprocess colors */
    'postcss-color-mod-function': {},

    /** general future proofing */
    'postcss-preset-env': {},

    /** minify [FIXME: disable for dev] */
    'cssnano': {},

  }
}
