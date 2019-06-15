
const fs = require('fs');

/**
 * this is a utility to convert an svg symbol table to javascript we 
 * can import, and then convert back. wait, why are we doing all this
 * back-and-forth? (...)
 * 
 * generates ts or json
 */

let input = '';
let output = '';

for (let i = 0; i < process.argv.length; i++ ){
  switch(process.argv[i]) {
  case '-i':
    input = process.argv[++i];
    break;
  case '-o':
    output = process.argv[++i];
    break;
  }
}

const Run = async () => {
  const contents = await new Promise((resolve, reject) => {
    fs.readFile(input, 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });

  const symbols = {};

  // FIXME use a parser

  const symbol_rex = /<symbol id="(.*?)" viewBox="(.*?)">([\s\S]*?)<\/symbol>/g;
  const path_rex = /<path(.*)?>/g;
  const d_rex = /d="(.*?)"/;
  const style_rex = /style=['"](.*?)['"]/;

  while (match = symbol_rex.exec(contents)) {
    const id = match[1];
    const viewbox = match[2];
    const elements = match[3];
    
    // console.info(id);
    const paths = [];

    while(path = path_rex.exec(elements)) {

      const entry = {};

      // console.info("P1", path[1]);

      const d = d_rex.exec(path[1]);
      if (d) entry.d = d[1];

      const style = style_rex.exec(path[1]);
      if (style) entry.style = style[1];

      if (entry.d) paths.push(entry);
    }

    // console.info('');

    symbols[id] = {
      viewbox, paths,
    };

  }

  if (output) {

    let file_contents = '';
    const json = JSON.stringify(symbols, undefined, 2);

    if ( /\.ts/i.test(output)) {
      file_contents = `

/**
 * generated file, do not edit (or don't expect your edits to survive)
 *
 * ${new Date().toString()}
 * ${process.argv.join(' ')}
 */

// tslint:disable: quotemark object-literal-key-quotes max-line-length trailing-comma

/** tslint may not like this file! */

export interface PathDef {
  d: string;
  style?: string;
}

export interface SymbolDef {
  viewbox: string;
  paths?: PathDef[];
}

export const symbol_defs: {[index: string]: SymbolDef} = ${json};

      `
    }
    else { // if (/json$/i.test(output)) {
      file_contents = json;
    }

    await new Promise((resolve, reject) => {
      fs.writeFile(output, file_contents, {encoding: 'utf8'}, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

  }
  else {
    console.info(symbols);
  }

};

Run();

