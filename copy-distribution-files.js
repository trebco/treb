/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path');
const execSync = require('child_process').execSync;
const package = require('./package.json');

// this has moved around, from zip to compiler and now to a standalone
// script. we need to run in sequence: compile (and generate typings), 
// build API file, copy distribution files, then zip.

const distribution_dir = path.resolve(__dirname, 'release-distribution-files');
const current_dir = path.resolve(__dirname, 'build', 'current');
const build_dir = path.resolve(__dirname, 'build', package.version);

execSync('cp ' + distribution_dir + '/* ' + build_dir);
execSync('cp ' + distribution_dir + '/* ' + current_dir);

  /*
  // copy distribution files. note that we're doing this _after_ adding 
  // banners, to exclude the single-file embed script (not sure if that's
  // useful or not, but it's intentional)

  execSync('cp ' + path.resolve(__dirname, 'treb-embed/distribution') + '/* ' + build_dir);

  console.info('copying files');
  fs.mkdir(current_dir, () => {
    exec('cp -r ' + build_dir + '/* ' + current_dir, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    });
  });
  */
