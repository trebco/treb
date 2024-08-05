// @ts-check

/* global process */

import * as esbuild from 'esbuild';

import { SassPlugin, WorkerPlugin, NotifyPlugin, HTMLPlugin, RewriteIgnoredImports } from './esbuild-utils.mjs';
import { promises as fs } from 'fs';

import pkg from './package.json' with { type: 'json' }; 


/**
 * @typedef {Object} Options
 * @property {'dev'|'production'} version
 * @property {boolean} watch
 * @property {boolean} verbose - log all plugin inputs. helpful for dev/debug.
 * @property {boolean} minify - separate from dev/production, in case we need to test
 * @property {boolean} xlsx_support - import/export xlsx files
 * @property {string} output_filename - generated filename. we enforce the directory.
 */

/** 
 * @type {Options}
 * 
 * defaults to production, we will update from any options 
 * passed at command line. 
 */
const options = {
  version: 'production',
  watch: false,
  minify: true, 
  verbose: false,
  xlsx_support: true,
  output_filename: 'treb-spreadsheet.mjs',
};

//------------------------------------------------------------------------------
//
// runtime
//
//------------------------------------------------------------------------------

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--dev') {
    options.version = 'dev';
    options.minify = false;
  }
  if (process.argv[i] === '--watch') {
    options.watch = true;
  }
  if (process.argv[i] === '--verbose') {
    options.verbose = true;
  }
  if (process.argv[i] === '--no-xlsx') {
    options.xlsx_support = false;
  }
  if (process.argv[i] === '--output-filename') {
    options.output_filename = process.argv[++i];
  }
}


/** @type esbuild.BuildOptions */
const build_options = {
  entryPoints: [
    'treb-embed/src/index.ts',
  ],
  banner: { 
    js: `/*! TREB v${pkg.version}. Copyright 2018-${new Date().getFullYear()} trebco, llc. All rights reserved. LGPL: https://treb.app/license */`
  },
  bundle: true,
  outfile: 'dist/' + options.output_filename,
  outExtension: { '.js': '.mjs' },
  minify: options.minify,
  metafile: true,
  format: 'esm',
  define: {
    'process.env.XLSX_SUPPORT': `${options.xlsx_support}`,
    'process.env.NODE_ENV': `"${options.version}"`,
    'process.env.BUILD_VERSION': `"${pkg.version}"`,
    'process.env.BUILD_NAME': `"${pkg.name}"`,
  },
  write: false,
  plugins: [
    RewriteIgnoredImports(),
    NotifyPlugin(),
    WorkerPlugin(options),
    HTMLPlugin(options),
    SassPlugin(options),
  ],
};

if (options.watch) {
  const context = await esbuild.context(build_options);
  await context.watch();
}
else {
  const result = await esbuild.build(build_options);
  await fs.writeFile('esbuild-metafile.json', JSON.stringify(result.metafile), { encoding: 'utf-8' });
}
