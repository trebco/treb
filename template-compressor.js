
// eslint-disable-next-line @typescript-eslint/no-var-requires
const utils = require('loader-utils');

module.exports = function(source) {
  const options = utils.getOptions(this);

  let tags = options ? options.tags || [] : [];

  // test
  if (this.options && this.options.tags) { 
    tags = this.options.tags; 
  }

  // let's start with the dangerous assumption that 
  // there are no nested templates. 

  // [ok, works, moving on... this will be trouble]

  // NOTE: we could optionally remove the tags, if there are no expressions
  // (...)

  // or better yet we could remove them in favor of regular backticks, and
  // let ts handle the conversion

  const pairs = [];

  for (const tag of tags) {

    const rex = new RegExp(tag.tag + '`[\\s\\S]*?`', 'g');
    for (;;) {
      const match = rex.exec(source);
      if (!match) { break; }

      const raw = match[0];
      
      if (options.dev) {
        console.info(raw);
      }

      let cooked = raw;

      if (tag.trim_lines) {
        cooked = cooked.split('\n').map(line => line.trim()).join('');
      }

      // this is too aggressive for CSS because it removes spaces in
      // composite rule selectors. it works for simple rules, but we
      // need to adjust... I think the rule should be keep space 
      // characters (not newlines, although there should be a single space)
      // outside of braces 

      if (tag.remove_whitespace) {
        cooked = cooked.replace(/[\s\r\n]+/g, '');
      }

      if (tag.remove_tag) {
        cooked = cooked.substr(tag.tag.length);
      }

      if (options.dev) {
        console.info(cooked);
        console.info('---');
      }
      
      pairs.push([raw, cooked]);
    }
  }

  for (const pair of pairs) {
    source = source.replace(pair[0], pair[1]);
  }

  return source;

}