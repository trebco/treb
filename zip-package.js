/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs');
const path = require('path');
const package = require('./package.json');
const archiver = require('archiver');

const dist_dir = 'build';
const current_dir = path.resolve(__dirname, dist_dir, 'current');

let name = 'treb';
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--name') {
    name = process.argv[++i];
  }
}

const BuildZip = async () => {

  await new Promise((resolve, reject) => {

    const output = fs.createWriteStream(path.resolve(__dirname, dist_dir, name + '-' + package.version + '.zip'));
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', function () {
      console.log('zipped (' + archive.pointer() + ' bytes)');
      resolve();
    });

    archive.on('error', function (err) {
      reject(err);
    });

    archive.pipe(output);
    // archive.directory(build_dir, 'TREB');
    archive.directory(current_dir, 'TREB');
    archive.finalize();

  });


};

BuildZip();
