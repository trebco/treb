
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const package = require('./package.json');
const tsconfig = require('./tsconfig.json');
const webpack = require('webpack');
const LicenseCheckerWebpackPlugin = require("license-checker-webpack-plugin");

let watching = false;
let dev = false;
let modern = false;

for (const arg of process.argv) {
  if (arg === '-w') {
    watching = true;
    console.info('** note: watching will not build the release/zip package');
    console.info('** be sure to run `npm run build` before pushing web updates\n');
  }
  else if (arg === '-d') {
    dev = true;
  }
  else if (arg === '--modern') {
    modern = true;
  }
}

const dist_dir = 'build';

const entry = {};

// new -- dropping polyfills!

if (modern) {
  entry[package['build-entry-points']['main'] + '-es6'] = './treb-embed/src/index-modern.ts';
  entry[package['build-entry-points']['export-worker'] + '-es6' + '-' + package.version] = './treb-embed/src/export-worker/index-modern.ts';
  entry[package['build-entry-points']['calculation-worker'] + '-es6' + '-' + package.version] = './treb-embed/src/calculation-worker/index-modern.ts';
  entry[package['build-entry-points']['toolbar'] + '-es6' + '-' + package.version] = './treb-embed/src/toolbar-main.ts';
}
else {
  entry[package['build-entry-points']['main']] = './treb-embed/src/index.ts';
  entry[package['build-entry-points']['export-worker'] + '-' + package.version] = './treb-embed/src/export-worker/index.ts';
  entry[package['build-entry-points']['calculation-worker'] + '-' + package.version] = './treb-embed/src/calculation-worker/index.ts';
  entry[package['build-entry-points']['toolbar'] + '-' + package.version] = './treb-embed/src/toolbar-main.ts';
}

const build_dir = path.resolve(__dirname, dist_dir, package.version);
const current_dir = path.resolve(__dirname, dist_dir, 'current');

// borrow from tsconfig; flatten arrays (take first), resolve

const aliases = {};
if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.paths) {
  const paths = tsconfig.compilerOptions.paths;
  for (const key of Object.keys(paths)) {
    let value = paths[key];
    if (Array.isArray(value)) value = value[0];
    aliases[key] = path.resolve(__dirname, value);
  }
}

const PostBuild = async () => {
  fs.mkdir(current_dir, () => {
    exec('cp -r ' + build_dir + '/* ' + current_dir, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    });
  });
};

module.exports = {
  stats: {
    all: false,
    builtAt: true,
    errors: true,
  },

  entry,
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          configFile: modern ? 'modern.tsconfig.json' : 'tsconfig.json'
        }
      },
      {
        test: /\.s*css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              outputStyle: 'compressed',
            }
          },
        ],
      },
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
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
    new LicenseCheckerWebpackPlugin({ outputFilename: "3d_party.txt" }),
    new webpack.BannerPlugin({
      banner: `v${package.version}. Copyright 2018-2019 Structured Data, LLC. All rights reserved. CC-ND: https://treb.app/license`,
    }),
    {
      apply: (compiler) => {
        compiler.hooks.beforeCompile.tap('BeforeCompilePlugin', () => {
          console.info('\nstarting build...')
        });
        compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
          PostBuild();
        });
      }
    }
  ]
};

