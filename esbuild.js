/* eslint-disable @typescript-eslint/no-var-requires */

const esbuild = require('esbuild');
const path = require('path');
const sass_plugin = require('esbuild-sass-plugin');
const package = require('./package.json');
const template_compressor = require('./util/template-compressor-esbuild'); 
const fs = require('fs');
const child_process = require('child_process');
const postcss = require('postcss');
const cssnano = require('cssnano');
const license_plugin = require('./util/license-plugin-esbuild');


// ---- command line -----------------------------------------------------------

/**
 * versions. note that the module version (mjs) still needs worker files,
 * but those should be compiled normally -- so we use the modern version,
 * but we don't rebuild them. that means if you want to build and use the 
 * module version you will need to build the modern version to get the workers.
 */
const version = {
  modern: false,
  module: false,
};


/** clean outdir, jic */
let clean = false;

/** prod: minify, generate license file (now default) */
let production = true;

/** watch and rebuild */
let watch = false;

/** write license file (usually only necessary for prod) */
let license = false;

/** write metafile (for dev) */
let metafile = false;

/** embed worker (for esm) */
let embed_worker = false;

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--dev') {
    production = false;
    // license = true; // implied
  }
  else if (process.argv[i] === '--license') {
    license = true;
  }
  else if (process.argv[i] === '--watch') {
    watch = true;
  }
  else if (process.argv[i] === '--clean') {
    clean = true;
  }
  else if (process.argv[i] === '--embed-worker') {
    embed_worker = true;
  }
  else if (process.argv[i] === '--modern') {
    version.modern = true;
  }
  else if (process.argv[i] === '--module') {
    version.module = true;
  }
  else if (process.argv[i] === '--metafile') {
    metafile = true;
  }
  else if (/^-/.test(process.argv[i])){
    console.warn('Unrecognized option: ' + process.argv[i]);
  }
}

if (production) {
  license = true; // implied
}

const version_str = production ? 'production' : 'dev';

// default to modern if nothing else is set
if (!version.modern && !version.module) {
  version.modern = true;
}

// can only watch one at a time (why?)
if (watch) {
  let count = 0;
  if (version.modern) { count++; } 
  if (version.module) { count++; }  
  if (count > 1) {
    throw new Error('can only watch one at a time');
  }
}

// ---- setup/data -------------------------------------------------------------

/**
 * banner will be prepended to any and all output files
 */
const banner = 
  `/*! TREB v${package.version}. Copyright 2018-${new Date().getFullYear()} trebco, llc. All rights reserved. LGPL: https://treb.app/license */` ;

/**
 * entry points for module build, keyed by output file name
 */
 const module_entry = {
  [package['build-entry-points']['main']]: './treb-embed/src/index-module.ts',
};

/**
 * entry points for regular build, keyed by output file name
 */
const modern_entry = {
  [package['build-entry-points']['main']]: './treb-embed/src/index-modern.ts',
  [package['build-entry-points']['export-worker'] + '-' + package.version]: './treb-export/src/export-worker/index-modern.ts',
};

/**
 * list of replacements, will be set via DEFINE (very handy)
 */
const build_entry_replacements = {};

for (const key of Object.keys(package['build-entry-points'])) {
  const text = `process.env.BUILD_ENTRY_${key.replace(/\W/g, '_').toUpperCase()}`;
  build_entry_replacements[text] = `"${package['build-entry-points'][key]}"`;
}

/**
 * configure the sass plugin. because minifying post-plugin does not work for 
 * some reason, we can use cssnano to do the same. only do that for prod.
 */
const sass_style = sass_plugin.sassPlugin(production ? {
  type: 'style',
  async transform(source) {
    const {css} = await postcss([cssnano]).process(source, { from: undefined });
    return css;
  }
} : {
  type: 'style',
});

const sass_default = sass_plugin.sassPlugin();

/** outdir */
const outdir_parent = 'build';
let outdir = '';

// ---- 

const LoadPlugin = (options) => {

  return {
    name: 'load-plugin',
    setup(build) {
      build.onLoad({ filter: /\.ts$/ }, async (args) => {

        let text = await fs.promises.readFile(args.path, 'utf8')
        let contents = template_compressor.transform(options, text);

        return {
          contents,
          loader: 'ts',
        };

      })
    },
  };

};

// ---- 

const GenerateConfig = (version) => {

  let worker_text = '';
  if (version === 'module' && embed_worker) {
    try {
      worker_text = fs.readFileSync(`build/current/treb-export-worker-${package.version}.js`, {encoding: 'utf-8'});
    }
    catch (err) {
      console.error('\n** embedding worker failed. make sure the worker for this version exists before building module.\n');
      throw err;
    }
  }

  const config = {

    metafile: metafile||license, // only if necessary
    watch: watch ? {
      onRebuild(error, result) {
        if (error) console.error('watch build failed:', error)
        else console.log('watch build succeeded:', result)
      },
    } : undefined,
    minify: !!production,
    banner: {
      js: banner, 
      css: banner,
    },  
    define: {
      'process.env.WORKER_TEXT': worker_text ? JSON.stringify(worker_text) :`""`,
      'process.env.NODE_ENV': `"${version_str}"`,
      'process.env.BUILD_VERSION': `"${package.version}"`,
      'process.env.BUILD_NAME': `"${package.name}"`,
      ...build_entry_replacements,
    },
    bundle: true,
    tsconfig: './treb-embed/modern.tsconfig.json',
    plugins: [
      LoadPlugin({
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
        version,
      }),
    ],
    outdir : version === 'module' ? path.join(outdir, 'esm') : outdir,
  };

  switch (version) {
    case 'modern':
      config.entryPoints = modern_entry;
      config.plugins.push(sass_style);
      break;

    case 'module':
      config.entryPoints = module_entry;
      config.format = 'esm';
      config.outExtension = { '.js': '.mjs' };
      config.plugins.push(sass_default);
      break;

  }
  

  return config;

};

// ---- run builder ------------------------------------------------------------

const Run = async () => {

  // writing to "current", and we will copy to versioned dir.
  
  outdir = path.join(outdir_parent, 'current');
  await fs.promises.mkdir(outdir, { recursive: true });

  // FIXME: clean should -r ?

  if (clean) {
    await new Promise((resolve) => {
      child_process.exec(`rm -r ${path.join(outdir, '*')}`, () => resolve());
    });
  }

  // modern version includes all support files

  if (version.modern) {
    console.info(`building modern (${version_str})...`);
    const result = await esbuild.build(GenerateConfig('modern'));
    if (result.metafile) {
      if (metafile) {
        await fs.promises.writeFile(
          path.join(outdir, 'metafile.json'), 
          JSON.stringify(result.metafile, undefined, 2), { encoding: 'utf8' }); 
      }
      if (license) {
        const licenses = await license_plugin.GenerateLicenseFile(result.metafile);
        await fs.promises.writeFile(path.join(outdir, '3d_party.txt'), licenses, { encoding: 'utf8' });
      }
    }
  }

  // module must be after modern, if we are embedding worker

  if (version.module) {
    console.info(`building module (${version_str})...`);
    await esbuild.build(GenerateConfig('module'));
  }

  const versioned_dir = path.join(outdir_parent, package.version);
  await fs.promises.mkdir(versioned_dir, { recursive: true });

  await new Promise((resolve) => {
    child_process.exec(`cp -r ${path.join(outdir, '*')} ${versioned_dir}`, () => resolve());
  });

};

Run();

