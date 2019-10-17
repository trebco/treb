
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const package = require('./package.json');
const archiver = require('archiver');

const dist_dir = 'build';
const build_dir = path.resolve(__dirname, dist_dir, package.version);
const current_dir = path.resolve(__dirname, dist_dir, 'current');

const BuildZip = async () => {

  await new Promise((resolve, reject) => {
    exec('cp ' + path.resolve(__dirname, 'treb-embed/distribution') + '/* ' + build_dir, (err, stdout, stderr) => {
      if (err) return reject(err);
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      resolve();
    });
  });

  await new Promise((resolve, reject) => {

    const output = fs.createWriteStream(path.resolve(__dirname, dist_dir, 'treb-' + package.version + '.zip'));
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
    archive.directory(build_dir, 'TREB');
    archive.finalize();

  });


};

BuildZip();
