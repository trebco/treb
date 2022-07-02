/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs');
const path = require('path');
const package = require('../package.json');
const archiver = require('archiver');

const dist_dir = 'build';
const current_dir = path.resolve(__dirname, '..', dist_dir, 'current');

let name = '';
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--name') {
    name = process.argv[++i];
  }
}

if (!name) {
  throw new Error('name is required (zip-package)');
}

const format = (length) => {
  if (length === 0) { return '0B'; }
  const label = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(length) / Math.log(1024));
  return parseFloat((length / Math.pow(1024, i)).toFixed(2)) + ' ' + label[i];
}

const BuildZip = async () => {

  await new Promise((resolve, reject) => {

    const output = fs.createWriteStream(path.resolve(__dirname, '..', dist_dir, name + '-' + package.version + '.zip'));
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', function () {
      console.log(`zipped (${format(archive.pointer())})`);
      resolve();
    });

    archive.on('error', function (err) {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(current_dir, name === 'treb' ? name.toUpperCase() : name);
    archive.finalize();

  });


};

BuildZip();
