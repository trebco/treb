
const loader = require('./template-compressor.js');
const fs = require('fs');


let file = './treb-embed/src/progress-dialog.ts';
file = './sample.ts';

fs.readFile(file, 'utf-8', (err, data) => {
  if (err) { 
    console.err(err); 
    return;
  }

  // console.info(
    loader.call({
      options: { tags: ['tmpl'] }}, data);

});
