
// eslint-disable-next-line @typescript-eslint/no-var-requires
const utils = require('loader-utils');

const Parser = (match, tag) => {

  const start = match.index + tag.length;
  const src = match.input;
  const len = src.length;
  let index = start;

  let master = src.substr(match.index, tag.length);

  /**
   * consume a single or double quoted string.
   * FIXME: check for illegal characters (newlines)
   */
  const consume_string = () => {

    const open = src[index];

    if (open !== '\'' && open !== '"') {
      throw new Error('invalid source (string)');
    }

    let escaped = false;
    let str = src[index++];

    for (; index < len; ) {

      const char = src[index++];
      str += char;

      if (!escaped && char === open) { 
        return str;
      }

      escaped = (!escaped && char === '\\');

    }

    throw new Error('invalid input (string)');

  };

  /**
   * character at pointer is '{' (open brace). parse until the 
   * closing brace. watch out for nested braces and strings. we
   * will consume the closing brace, so both braces will be part
   * of the returned string (and pointer will be at the next character).
   */
  const consume_brace_expression = () => {

    if (src[index] !== '{') {
      throw new Error('invalid source (brace)');
    }

    let str = src[index++];

    for (; index < len; ) {

      const char = src[index];

      switch (char) {
        case '{':
          str += consume_brace_expression();
          break;

        case '}': // matching closing brace
          str += char;
          index++;
          return str;

        case '\'':
        case '"':
          str += consume_string();
          break;

        case '`': // backtick string
          str += consume_backtick_string();
          break;

        default:
          str += char;
          index++;
      }

    }

    throw new Error('invalid input (brace)');

  };

  const consume_backtick_string = () => {

    let escaped = false;
    let str = src[index++];

    for (; index < len;) {

      const char = src[index];
      str += char;
      index++;

      if (escaped) { 
        escaped = false; 
      }
      else {
        switch (char) {
          case '\\':
            escaped = true; 
            break;

          case '`':
            return str;

          case '$':
            if (src[index] === '{') { // test NEXT index
              str += consume_brace_expression();
            }
            break;


        }
      }
    }

    throw new Error('invalid input (backtick)');

  };

  switch (src[index]) {
    case '`':
      return master + consume_backtick_string();

    case '\'':
    case '"':
      return master + consume_string();

    case '{':
      return master + consume_brace_expression();
    
  }

  throw new Error('invalid input (main)');

  // console.info(match.index);
  // console.info(match.input.substr(match.index, 100));

};

module.exports = function(source) {
  
  // const options = utils.getOptions(this);
  const options = this.getOptions();

  let tags = options ? options.tags || [] : [];

  // test
  if (this.options && this.options.tags) { 
    tags = this.options.tags; 
  }

  // let's start with the dangerous assumption that 
  // there are no nested templates. 

  // [ok, works, moving on... this will be trouble]

  // UPDATE: proper parser now (more or less)

  // NOTE: we could optionally remove the tags, if there are no expressions
  // (...)

  // or better yet we could remove them in favor of regular backticks, and
  // let ts handle the conversion

  const pairs = [];

  for (const tag of tags) {

    // const rex = new RegExp(tag.tag + '`[\\s\\S]*?`', 'g');
    const rex = new RegExp(tag.tag + '`', 'g');
    for (;;) {
      const match = rex.exec(source);
      if (!match) { break; }

      // includes tag and open & closing backticks
      const raw = Parser(match, tag.tag);
     
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