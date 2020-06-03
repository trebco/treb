
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * seems like the only way to concurrently build (and watch) both ES5 and ES6
 * versions, using typescript, is to run two instances of webpack. this is
 * async but not threaded, so it's essentially synchronous.
 * 
 * TODO: workers
 */

const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
// const archiver = require('archiver');
const LicenseCheckerWebpackPlugin = require('license-checker-webpack-plugin');

const package = require('./package.json');

let watch = false;
let dev = false;
let clean = false;

// optionally limit build to one module
const build = { legacy: false, modern: false };

// dev, limit to charts module
// let only_charts = false;

for (const arg of process.argv) {
  if (arg === '-d') dev = true;
  if (arg === '-w' || arg === '--watch') watch = true;
  if (arg === '--legacy') build.legacy = true;
  if (arg === '--modern') build.modern = true;
//  if (arg === '--only-charts') only_charts = true;
  if (arg === '--clean') clean = true;
}

// default is build both
if (!build.legacy && !build.modern) {
  build.legacy = build.modern = true;
}

const modern_entry = {
  [package['build-entry-points']['main'] + '-es6']: './treb-embed/src/index-modern.ts',
  [package['build-entry-points']['export-worker'] + '-es6' + '-' + package.version]: './treb-export/src/export-worker/index-modern.ts',
  [package['build-entry-points']['calculation-worker'] + '-es6' + '-' + package.version]: './treb-mc/src/calculation-worker/index-modern.ts',
  // [package['build-entry-points']['toolbar'] + '-es6' + '-' + package.version]: './treb-toolbar/src/toolbar-main.ts',
};

const legacy_entry = {
  [package['build-entry-points']['main']]: './treb-embed/src/index-legacy.ts',
  [package['build-entry-points']['export-worker'] + '-' + package.version]: './treb-export/src/export-worker/index-legacy.ts',
  [package['build-entry-points']['calculation-worker'] + '-' + package.version]: './treb-mc/src/calculation-worker/index-legacy.ts',
  // p[ackage['build-entry-points']['toolbar'] + '-' + package.version]: './treb-toolbar/src/toolbar-main.ts',
};

/*
if (only_charts) {
  legacy_entry = {};
  build.modern = false;
  build.legacy = true;
}
*/

/*
// unified (for now), so only do this once
if (build.legacy) {
  legacy_entry[package['build-entry-points']['charts']] = './treb-charts/src/main.ts';
}
else {
  modern_entry[package['build-entry-points']['charts']] = './treb-charts/src/main.ts';
}
*/

const dist_dir = 'build';

const build_dir = path.resolve(__dirname, dist_dir, package.version);
const current_dir = path.resolve(__dirname, dist_dir, 'current');

// clean "current" dir. not recursive.

if (clean) {
  const files = fs.readdirSync(current_dir);
  for (const file of files) {
    fs.unlinkSync(path.join(current_dir, file));
  }
}

const directories = [
  'treb-mc',
  'treb-grid',
  'treb-utils',
  'treb-charts',
  'treb-export',
  'treb-format',
  'treb-parser',
  'treb-engine',
  'treb-toolbar',
  'treb-calculator',
  'treb-sparkline',
  'treb-base-types',
];

const aliases = {};

for (const dir of directories) {
  aliases[dir] = path.resolve(__dirname, dir);
}

/*
if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.paths) {
  const paths = tsconfig.compilerOptions.paths;
  for (const key of Object.keys(paths)) {
    let value = paths[key];
    if (Array.isArray(value)) value = value[0];
    aliases[key] = path.resolve(__dirname, value);
  }
}
*/

const CreateConfig = (config, entry) => {
  const config_instance = {

    entry,

    mode: dev ? 'development' : 'production',
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: {

            /** 
             * experimented with transpileOnly; does not seem significantly
             * faster, and adds a good deal of complexity (requires separate
             * type checking). so removed.
             */

            // transpileOnly: true,
            configFile: /modern/i.test(config) ? 'modern.tsconfig.json' : 'tsconfig.json'
          }
        },
        {
          test: /\.s*css$/,
          sideEffects: true,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  outputStyle: 'compressed',
                },
              }
            },
          ],
        },
      ]
    },
    /*
    optimization: {
      // usedExports: true,
    },
    */
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@root': path.resolve(__dirname),
        ...aliases
      }
    },
    output: {
      path: path.resolve(__dirname, dist_dir, package.version),
      publicPath: './',
      chunkFilename: '[name].bundle.js'
    },
    plugins: [
      new LicenseCheckerWebpackPlugin({ outputFilename: '3d_party.txt' }),
      new webpack.BannerPlugin({
        banner: `v${package.version}. Copyright 2018-${new Date().getFullYear()} Structured Data, LLC. All rights reserved. CC-ND: https://treb.app/license`,
      }),
      {
        apply: (compiler) => {
          compiler.hooks.beforeCompile.tap('BeforeCompilePlugin', () => {
            console.info('starting ' + config + ' build (' + package.version + ')...', new Date().toString());
          });
          /*
          compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
            PostBuild();
          });
          */
        }
      }
    ]
  };

  return config_instance;
};

const modern_compiler = build.modern ? webpack(CreateConfig('modern', modern_entry)) : undefined;
const legacy_compiler = build.legacy ? webpack(CreateConfig('legacy', legacy_entry)) : undefined;

const postbuild = async (config, err, stats) => {

  // console.info(config, err, stats);

  if (err) {
    console.info('error building', config);
    console.error(err.stack || err);
    if (err.details) {
      console.error(err.details);
    }
    return;
  }

    console.info('\n' + stats.toString({
      all: false,
      builtAt: true,
      colors: true,
      errors: true,
    }));

  if (!stats.hasErrors()) {

    fs.mkdir(current_dir, () => {
      exec('cp -r ' + build_dir + '/* ' + current_dir, (err, stdout, stderr) => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
      });
    });

  }

}

if (watch) {
  if (build.legacy) {
    legacy_compiler.watch({}, (err, stats) => postbuild('legacy', err, stats));
  }
  if (build.modern) {
    modern_compiler.watch({}, (err, stats) => postbuild('modern', err, stats));
  }
}
else {
  if (build.modern) {
    modern_compiler.run((err, stats) => postbuild('legacy', err, stats));
  }
  if (build.legacy) {
    legacy_compiler.run((err, stats) => postbuild('modern', err, stats));
  }
}
