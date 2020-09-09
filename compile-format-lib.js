
/* eslint-disable @typescript-eslint/no-var-requires */


const webpack = require('webpack');
const path = require('path');
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
        'treb-base-types': path.resolve(__dirname, 'treb-base-types/src/index-format.ts'),
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

    plugins: [
      new webpack.BannerPlugin({
        banner: `v${package.version}. Copyright ${new Date().getFullYear()} Structured Data, LLC. All rights reserved.`,
      }),
    ],
    
};

webpack(config).run((err, stats) => {
  if (err) {
    console.error(err);
    return;
  }
  console.info(stats.toString());
});
