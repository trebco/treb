
// eslint-disable-next-line @typescript-eslint/no-var-requires
const utils = require('loader-utils');

module.exports = function(source) {
  const options = utils.getOptions(this);

  for (const pair of options.replace || []) {
    source = source.replaceAll(pair.text, pair.replacement);
  }

  return source;
};

