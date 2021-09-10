
/* eslint-disable @typescript-eslint/no-var-requires */


const webpack = require('webpack');
const path = require('path');
const fs = require('fs').promises;
const package = require('./package.json');

let mode = 'production';

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '-d' || process.argv[i] === '--dev') {
    mode = 'development';
  }
}

const config = {

    entry: `./treb-format/src/index-standalone.ts`,
    mode,
    output: {
        path: path.resolve(__dirname, 'dist2'),
        filename: `treb-format-lib.js`,
        library: `treb-format-lib`,
        libraryTarget: 'umd',
        globalObject: 'this',
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        // 'treb-base-types': path.resolve(__dirname, 'treb-base-types/src/index-standalone.ts'),
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
                configFile: 'treb-format-lib.tsconfig.json',
              },
            },
          ],
        }
      ]
    },

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

run();

