/**
 * postprocess the generated build/ dir and clean up imports. this 
 * makes local package imports (e.g. import from 'treb-base-types') 
 * relative, and adds index to package names (from '../../treb-base-types/src/index').
 * 
 * this tool modifies build artifacts in place, which means it's destructive.
 * but those are all build artifacts so they can be recreated if necessary.
 * 
 * we're making some assumptions here that are specific to this project,
 * so this is fragile, but it works and it's simple.
 * 
 * TODO: look up the proper index file and use that for naked lib imports
 * TODO: create a list of package names, so we stop ignoring ooxml-types
 * TODO: parameterize all this with a config file
 * 
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = './build';

async function ProcessFile(file: string, depth: number) {

  const offset: string[] = [];
  for (let i = 0; i < depth; i++) {
    offset.push('..');
  }
  const prepend = offset.join('/') + '/';

  let contents = await fs.readFile(file, { encoding: 'utf8' });
  const matches = Array.from(contents.matchAll(/(?:import|export).*?from\s+?['"](treb-.*?)['"]/g));

  if (matches.length) {
    // console.info(file);
    for (const match of matches) {

      let replacement = match[0];
      let import_text = match[1];

      // watch out for magic esbuild imports

      if (/(html|scss|css)$/i.test(import_text)) {
        continue;
      }

      if (/\//.test(import_text)) {
        replacement = replacement.replace(/from (['"'])treb-/, `from $1${prepend}treb-`);
      }
      else {
        replacement = replacement.replace(new RegExp(import_text), prepend + import_text + '/src/index');
      }
     
      contents = contents.replace(match[0], replacement);
    }
    await fs.writeFile(file, contents, { encoding: 'utf-8'});
  }
  

}

async function Walk (dir: string, depth = 0) {

  // console.info("WALK", dir);

  const entries = await fs.readdir(dir);
  for (const entry of entries) {
    if (/(\.js|\.d\.ts)$/.test(entry)) {
      // console.info("M", path.join(dir, entry), `[${depth}]`);
      await ProcessFile(path.join(dir, entry), depth);
    }
    else {
      const stat = await fs.stat(path.join(dir, entry));
      if (stat.isDirectory()) {
        await Walk(path.join(dir, entry), depth + 1);
      }
    }
  }

}

await Walk(root);
