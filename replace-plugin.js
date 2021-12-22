/**
 * this is a webpack plugin that does simple search-and-replace
 * on text. atm we only support exact text matches.
 * 
 * we have two primary use cases. the first is for "environment
 * variable" replacement; at compile time we can replace some
 * variables with constant values, e.g.
 * 
 * process.env.BUILD_VERSION
 * 
 * the trick here is that when doing static analysis on the code
 * the above looks legit. since it won't exist at runtime, we 
 * replace it with the fixed value.
 * 
 * the second use case is for conditional code compilation in 
 * legacy and modern builds. we can point to different source
 * trees or files using different directory paths. that's a bit
 * dicier but simpler than the old way we were doing conditional
 * compilation.
 */


// eslint-disable-next-line @typescript-eslint/no-var-requires
const utils = require('loader-utils');

module.exports = function(source) {
  // const options = utils.getOptions(this);
  const options = this.getOptions();

  for (const pair of options.replace || []) {
    source = source.replaceAll(pair.text, pair.replacement);
  }

  return source;
};

