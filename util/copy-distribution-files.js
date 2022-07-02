/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path');
const execSync = require('child_process').execSync;
const package = require('../package.json');

// this has moved around, from zip to compiler and now to a standalone
// script. we need to run in sequence: compile (and generate typings), 
// build API file, copy distribution files, then zip.

const distribution_dir = path.resolve(__dirname, '..', 'release-distribution-files');
const current_dir = path.resolve(__dirname, '..', 'build', 'current');
const build_dir = path.resolve(__dirname, '..', 'build', package.version);

execSync('cp ' + distribution_dir + '/* ' + build_dir);
execSync('cp ' + distribution_dir + '/* ' + current_dir);
