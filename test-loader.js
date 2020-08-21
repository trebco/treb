
const loader = require('./template-compressor.js');
const fs = require('fs');


let file = './treb-embed/src/progress-dialog.ts';
file = './sample.ts';
file = './treb-toolbar/src/toolbar.ts';

fs.readFile(file, 'utf-8', (err, data) => {
  if (err) { 
    console.err(err); 
    return;
  }

  // console.info(
    loader.call({

      query: { 
        tags: [
          { tag: 'tmpl', trim_lines: true, },
          { tag: 'css', remove_whitespace: true, remove_tag: true, },
        ],
        dev: true,
      }}, data);

});
