
/* eslint-disable @typescript-eslint/no-var-requires */


const webpack = require('webpack');
const path = require('path');
const fs = require('fs').promises;
const package = require('./package.json');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

let mode = 'production';
let extract_css = false;
let watch = false;

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '-d' || process.argv[i] === '--dev') {
    mode = 'development';
  }
  else if (process.argv[i] === '-w' || process.argv[i] === '--watch') {
    watch = true;
  }
  else if (process.argv[i] === '-x' || process.argv[i] === '--extract-css') {
    extract_css = true;
  }
}

const style_loaders = extract_css ?

// if the flag is set, extract css to an external file. if not, 
// inline it. for use with CSP. not sure atm how to best integrate 
// this.

[
  MiniCssExtractPlugin.loader,
  {
    loader: 'css-loader',
    options: {

      // we don't actually need to disable this for this version, 
      // since it's generally targeting modern browsers/electron
      // anyway. 

      url: false, 
    },
  },
  'sass-loader',
] : [
  { 
    loader: 'style-loader', 
    options: { 
      injectType: 'singletonStyleTag' 
    } 
  },
  {
    loader: 'css-loader',
    options: {
      url: false,
    }
  },
  'sass-loader',
];

const config = {

    entry: `./treb-charts/src/index-standalone.ts`,
    // entry: `./treb-format/src/index-standalone.ts`,
    mode,
    experiments: {
      outputModule: true,
    },
    output: {
        path: path.resolve(__dirname, 'standalone/treb-charts-lib'),
        filename: `treb-charts-lib.mjs`,
        libraryTarget: 'module',
        globalObject: 'this',
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        // 'treb-base-types': path.resolve(__dirname, 'treb-base-types/src/index-standalone.ts'),
        'treb-format': path.resolve(__dirname, 'treb-format/src/'),
        'treb-utils': path.resolve(__dirname, 'treb-utils/src/'),
        'treb-base-types': path.resolve(__dirname, 'treb-base-types/src/'),
      }
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            { 
              loader: 'ts-loader',
              options: {
                configFile: 'treb-charts-lib.tsconfig.json',
              },
            },
          ],
        },
        {
          test: /\.[sp]*css$/,
          sideEffects: true,

          use: style_loaders,

        },
      ]
    },

    plugins: extract_css ? [new MiniCssExtractPlugin()] : [],

    /*
    plugins: [
      new webpack.BannerPlugin({
        banner: `v${package.version}. Copyright ${new Date().getFullYear()} Structured Data, LLC. All rights reserved.`,
      }),
    ],
    */

};

// console.info(JSON.stringify(config, undefined, 2));

const run = async() => {

  if (watch) {

    webpack(config).watch({}, (err, stats) => {

      if (err) {
        console.info('error building');
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

    });

  }
  else {

    const {err, stats} = await new Promise((resolve) => {
      webpack(config).run((err, stats) => resolve({err, stats}));
    });

    if (err) {
      console.error(err);
      return;
    }

    const banner = `/*! v${package.version}. Copyright 2018-${new Date().getFullYear()} Structured Data, LLC. All rights reserved. CC BY-ND: https://treb.app/license */`;
    const file = path.join(config.output.path, config.output.filename);
    const contents = await fs.readFile(file, {encoding: 'utf8'});
    await fs.writeFile(file, banner + '\n' + contents, {encoding: 'utf-8'});

    console.info(stats.toString());

  }

}

run();

