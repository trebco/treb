
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * seems like the only way to concurrently build (and watch) both ES5 and ES6
 * versions, using typescript, is to run two instances of webpack. this is
 * async but not threaded, so it's essentially synchronous.
 * 
 * TODO: workers
 */

const webpack = require('webpack');
const fs = require('fs-extra');
const path = require('path');
const exec = require('child_process').exec;
// const execSync = require('child_process').execSync;
const LicenseCheckerWebpackPlugin = require('license-checker-webpack-plugin');
//const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const package = require('./package.json');

//const propertiesRenameTransformer = require('ts-transformer-properties-rename').default;
//const minifyPrivatesTransformer = require('ts-transformer-minify-privates').default;

let watch = false;
let dev = false;
let clean = false;

let extract_css = false;

// optionally limit build to one module
const build = { legacy: false, modern: false, module: false, };

for (const arg of process.argv) {
  if (arg === '-d' || arg === '--dev') dev = true;
  if (arg === '-w' || arg === '--watch') watch = true;
  if (arg === '--legacy') build.legacy = true;
  if (arg === '--modern') build.modern = true;
  if (arg === '--module') build.module = true;
  if (arg === '--clean') clean = true;
  if (arg === '-e' || arg === '--extract-css') {
    extract_css = true;
    console.warn('\n** extracting CSS: you may need to clean this up later\n');
  }
}

// default is build all
if (!build.legacy && !build.modern && !build.module) {
  build.legacy = build.modern = build.module = true;
}

if (build.modern || build.module) {
  console.error(`Don't use the webpack script to build modern/module. Use esbuild.`);
  throw new Error('build error');
}

const module_entry = {
  [package['build-entry-points']['main']]: './treb-embed/src/index-module.ts',
};

const modern_entry = {
  [package['build-entry-points']['main']]: './treb-embed/src/index-modern.ts',
  [package['build-entry-points']['export-worker'] + '-' + package.version]: './treb-export/src/export-worker/index-modern.ts',
  [package['build-entry-points']['calculation-worker'] + '-' + package.version]: './treb-mc/src/calculation-worker/index-modern.ts',
};

const legacy_entry = {
  [package['build-entry-points']['main'] + '-es5']: './treb-embed/src/index-legacy.ts',
  [package['build-entry-points']['export-worker'] + '-es5-' + package.version]: './treb-export/src/export-worker/index-legacy.ts',
  [package['build-entry-points']['calculation-worker'] + '-es5-' + package.version]: './treb-mc/src/calculation-worker/index-legacy.ts',
};

const dist_dir = 'build';

const build_dir = path.resolve(__dirname, dist_dir, package.version);
const current_dir = path.resolve(__dirname, dist_dir, 'current');


const UpdateFiles = () => {

  // NOTE: making this sync, as opposed to async, to
  // prevent overlapping IO operations

  const banner = `/*! v${package.version}. Copyright 2018-${new Date().getFullYear()} Structured Data, LLC. All rights reserved. CC BY-ND: https://treb.app/license */`;

  const files = fs.readdirSync(build_dir);

  // remove those LICENSE files -- we already have the 3d party license file

  for (const filename of files) {
    if (/\.LICENSE\.txt$/.test(filename)) {
      fs.removeSync(path.join(build_dir, filename));
    }
  }

  // add banners

  console.info('adding banners');
  for (const filename of files) {
    if (/\.m{0,1}js$/.test(filename)) {
      const fully_qualified = path.join(build_dir, filename);
      let contents = fs.readFileSync(fully_qualified, 'utf-8');
      if (/^\/\*.*?\*\//.test(contents)) {
        contents = contents.replace(/^\/\*.*?\*\//, banner);
        fs.writeFileSync(fully_qualified, contents, {encoding: 'utf-8'});
      }
      else {
        contents = banner + '\n' + contents;
        fs.writeFileSync(fully_qualified, contents, {encoding: 'utf-8'});
      }
    }
  }

  // NOTE: copying distribution files moved to archive script. we don't
  // need them at this point, and if we copy them now we will copy the 
  // wrong API file (because it has not been generated yet).

  // ... moved to a different script, instead of into zip generator

  /*
  // copy distribution files. note that we're doing this _after_ adding 
  // banners, to exclude the single-file embed script (not sure if that's
  // useful or not, but it's intentional)

  execSync('cp ' + path.resolve(__dirname, 'treb-embed/distribution') + '/* ' + build_dir);
  */

  console.info('copying files');
  fs.mkdir(current_dir, () => {
    exec('cp -r ' + build_dir + '/* ' + current_dir, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    });
  });

};

// clean "current" dir. not recursive.

if (clean) {
  let files = fs.readdirSync(current_dir);
  for (const file of files) {
    fs.unlinkSync(path.join(current_dir, file));
  }

  files = fs.readdirSync(build_dir);
  for (const file of files) {
    fs.unlinkSync(path.join(build_dir, file));
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
  'treb-base-types',
];

const aliases = {};

for (const dir of directories) {
  aliases[dir] = path.resolve(__dirname, dir);
}

aliases['@grid-conditional'] = path.resolve(__dirname, 'treb-grid', 'src', 'conditional', 'legacy');

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

/*
const custom_transformer = (context) => {
  console.info("CONTEXT", context);
  return (node) => {

    const visitor = (node) => {
      
      return ts.visitEachChild(node, visitor, context);
    };

    console.info("NODE", node);
    return ts.visitNode(node, visitor);

  };
};
*/

// these are text replacements for the "build entry points" which we 
// rely on for loading workers at runtime. since we are dropping 
// package.json from the build, we need a way to identify these files.

const build_entry_replacements = [];

for (const key of Object.keys(package['build-entry-points'])) {
  const text = `process.env.BUILD_ENTRY_${key.replace(/\W/g, '_').toUpperCase()}`;
  build_entry_replacements.push({
    text, replacement: `"${package['build-entry-points'][key]}"`,
  });
}

const CreateConfig = (config, entry, options, target) => {

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

  const config_instance = {

    target,
    entry,

    mode: dev ? 'development' : 'production',
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            { 
              loader: 'ts-loader',
              options: {
                configFile: /legacy/i.test(config) ? 'treb-embed/legacy.tsconfig.json' : 'treb-embed/modern.tsconfig.json',
              },
            },
            {
              // this is our text replacement plugin. it's intended to get 
              // the JSON file out of there in favor of simple string replacements.
              //
              // the trick here is we use things that look acceptable at build
              // time, but are unique enough to find and replace. we pay no 
              // attention to context; if you are replacing something that looks
              // like a variable (e.g. process.env.X) with a string, you probably
              // need to quote the replacement.

              loader: path.resolve('./replace-plugin.js'),
              options: {
                replace: [

                  // replacements for various package.json strings

                  ...build_entry_replacements,
                  
                  { text: 'process.env.BUILD_VERSION', replacement: `"${package.version}"` },
                  { text: 'process.env.BUILD_NAME', replacement: `"${package.name}"` },

                  // new thing, the result is a boolean (although ts will think it's a
                  // string, you can check for truthy/falsy). the aim here is to get a
                  // hard boolean around blocks for dead code elimination, although I'm
                  // not sure that actually works (works great in rollup)

                  // LATER: seems to work, FWIW, but check if you use it.

                  { text: 'process.env.PRODUCTION', replacement: dev ? 'false' : 'true' },

                  // another new thing, replacement for our conditional compilation, which
                  // no longer works in ts-lib 9.x (not sure why; don't care)

                  { 
                    text: /conditional\/(?:modern|legacy)/g, 
                    replacement: `conditional/${/legacy/i.test(config) ? 'legacy' : 'modern'}`,
                  },

                ],
              }
            },
            {
              // this is our template compressor plugin. see the source file
              // (in this directory).

              loader: path.resolve('./template-compressor-2.js'),
              options: {
                // dev: true,
                tags: [
                  { tag: 'tmpl', 
                    trim_lines: true, 
                    remove_html_comments: true,
                    icons: {
                      tag: 'icon',
                      dir: path.resolve(__dirname, 'treb-embed', 'icons', '4'),
                    },
                  },
                  { tag: 'composite', trim_lines: true, remove_tag: true, },
                  { tag: 'css', remove_whitespace: true, remove_tag: true, },
                ],
              }
            }
          ],
        },
        {
          test: /\.[sp]*css$/,
          sideEffects: true,

          use: style_loaders,

        },
      ]
    },

    /*

    optimization: {
      minimize: !dev,
      minimizer: [
        new TerserPlugin({
          cache: true,
          parallel: true,
          sourceMap: true, // Must be set to true if using source-maps in production
          terserOptions: {
            // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions

            mangle: {
              properties: {
                  regex: /^_private_/,
              },
            },

          }
        }),
      ],

      // usedExports: true,
    },

    */

    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@root': path.resolve(__dirname),
        ...aliases,
      },
      fallback: {
        'buffer': require.resolve('buffer'),
        'stream': require.resolve('stream-browserify'),
        'util': require.resolve('./lib-util'),
      }
    },
    output: {
      path: path.resolve(__dirname, dist_dir, package.version),
      publicPath: './',
      chunkFilename: '[name].bundle.js',

      hashFunction: 'xxhash64',

      /*
      library: {
        // name: 'TREB',
        type: 'module',
      },
      module: true,
      */

    },

    experiments: {
      // outputModule: true,
    },

    plugins: [

      // NOTE: LC only needs to run once, why are we running it every time?
      // especially since it's only for distribution, we should just run it
      // when we're running prod/modern build

      // new LicenseCheckerWebpackPlugin({ outputFilename: '3d_party.txt' }),

      {
        apply: (compiler) => {
          compiler.hooks.beforeCompile.tap('BeforeCompilePlugin', () => {
            console.info('starting ' + config + ' build (' + package.version + ')...', new Date().toString());
          });
        }
      }
    ]
  };

  if (options.license) {
    config_instance.plugins.unshift(
      new LicenseCheckerWebpackPlugin({ outputFilename: '3d_party.txt' }),
    );
  }

  if (options.module) {
    config_instance.experiments.outputModule = true;
    config_instance.output.module = true;
    config_instance.output.library = { type: 'module' };
  }

  if (extract_css) {
    config_instance.plugins.unshift(new MiniCssExtractPlugin());
  }

  return config_instance;
};

const module_compiler = build.module ? webpack(CreateConfig('module', module_entry, { module: true, }, ['web', 'es2020'])) : undefined; 
const modern_compiler = build.modern ? webpack(CreateConfig('modern', modern_entry, { license: true, }, ['web', 'es2020'])) : undefined;
const legacy_compiler = build.legacy ? webpack(CreateConfig('legacy', legacy_entry, {}, ['web', 'es5'])) : undefined;

const postbuild_report = async (config, err, stats, toll) => {

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

}

if (watch) {
  if (build.legacy) {
    legacy_compiler.watch({}, (err, stats) => {
      postbuild_report('legacy', err, stats)
      if (!stats.hasErrors()) {
        UpdateFiles();
      }
    });
  }
  if (build.modern) {
    modern_compiler.watch({}, (err, stats) => {
      postbuild_report('modern', err, stats);
      if (!stats.hasErrors()) {
        UpdateFiles();
      }
    });
  }
  if (build.module) {
    module_compiler.watch({}, (err, stats) => {
      postbuild_report('module', err, stats);
      if (!stats.hasErrors()) {
        UpdateFiles();
      }
    });
  }
}
else {

  // only call the update method once, avoid file collisions
  // (would that ever happen? we're single threaded)

  const promises = [];

  if (build.module) {
    promises.push(new Promise((resolve) => {
      module_compiler.run((err, stats) => {
        postbuild_report('module', err, stats);
        resolve(stats);
      });
    }));
  }

  if (build.modern) {
    promises.push(new Promise((resolve) => {
      modern_compiler.run((err, stats) => {
        postbuild_report('modern', err, stats);
        resolve(stats);
      });
    }));
  }
  
  if (build.legacy) {
    promises.push(new Promise((resolve) => {
      legacy_compiler.run((err, stats) => {
        postbuild_report('modern', err, stats);
        resolve(stats);
      });
    }));
  }

  Promise.all(promises).then((values) => {
    if (values.every(stats => !stats.hasErrors())) {
      UpdateFiles();
    }
  });

}