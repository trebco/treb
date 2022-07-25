/* eslint-disable @typescript-eslint/no-var-requires */

const path = require('path');
const execSync = require('child_process').execSync;
const package = require('../package.json');
const fs = require('fs');

// this has moved around, from zip to compiler and now to a standalone
// script. we need to run in sequence: compile (and generate typings), 
// build API file, copy distribution files, then zip.

const distribution_dir = path.resolve(__dirname, '..', 'release-distribution-files');
const current_dir = path.resolve(__dirname, '..', 'build', 'current');
const build_dir = path.resolve(__dirname, '..', 'build', package.version);

execSync('cp -r ' + distribution_dir + '/* ' + build_dir);
execSync('cp -r ' + distribution_dir + '/* ' + current_dir);

// we need to update the package version in the esm/package.json file,
// to match the build version.

let text = fs.readFileSync(path.join(build_dir, 'esm', 'package.json'), {encoding: 'utf-8'});
text = text.replace(/"version":\s*?".*?"/, `"version": "${package.version}"`);
fs.writeFileSync(path.join(build_dir, 'esm', 'package.json'), text, {encoding: 'utf-8'});
fs.writeFileSync(path.join(current_dir, 'esm', 'package.json'), text, {encoding: 'utf-8'});
