/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * this is a replacement (more or less) for `license-checker-webpack-plugin`
 * for use with esbuild. we can get the metafile from an esbuild run, and 
 * use that to find deps and list licenses. 
 * 
 * TODO: rewrite this in ts
 */

const fs = require('fs');
const path = require('path');

/**
 * find the license, if any, for the given module. returns a string for
 * inclusion into the license file, structured as
 * 
 * name (repo name if no name in package)
 * repo url (if available)
 * license text...
 * 
 */
const FindLicense = async (dir) => {

  try {
    const text = await fs.promises.readFile(path.join(dir, 'package.json'), { encoding: 'utf8'});
    const json = JSON.parse(text || '{}');
    const files = (await fs.promises.readdir(dir)).filter(test => /license/i.test(test));

    let name = json.name || '';

    if (!name) {
      const split = dir.split(path.sep);
      name = split[1];
    }

    let strings = [name];

    if (typeof json.repository === 'object' && json.repository.url) {
      strings.push(json.repository.url);
    }
    else if (typeof json.repository === 'string') {
      strings.push(json.repository);
    }

    if (files.length > 0) {
      const license_text = await fs.promises.readFile(path.join(dir, files[0]), { encoding: 'utf8' });
      strings.push('\n');
      strings.push(license_text);
      return strings.join('\n');
    }

  }
  catch (err) {
    console.error(err);
  }

  return undefined;

};

const GenerateLicenseFile = async (metafile) => {

  let processed = new Map();
  const licenses = [];

  for (const key of Object.keys(metafile.inputs || {})) {
    if (/^node_modules/.test(key)) {
      const parts = key.split(path.sep);
      if (!processed.has(parts[1])) {
        const license = await FindLicense(path.join(parts[0], parts[1]));
        if (license) {
          licenses.push(license);
        }
        processed.set(parts[1], true);
      }
    }
  }

  return licenses.join('\n---\n\n');

};

module.exports = { GenerateLicenseFile };


