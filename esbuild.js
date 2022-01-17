/* eslint-disable @typescript-eslint/no-var-requires */

const esbuild = require('esbuild');
const path = require('path');
const sass_plugin = require('esbuild-sass-plugin');
const package = require('./package.json');
const template_compressor = require('./template-compressor-esbuild'); 
const fs = require('fs');
const postcss = require('postcss');
const cssnano = require('cssnano');
const license_plugin = require('./license-plugin-esbuild');

// ---- command line -----------------------------------------------------------

/** prod: minify, generate license file */
let production = false;

/** watch and rebuild */
let watch = false;

/** write license file (usually only necessary for prod) */
let license = false;

/** write metafile (for dev) */
let metafile = false;

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--production') {
    production = true;
    license = true; // implied
  }
  else if (process.argv[i] === '--license') {
    license = true;
  }
  else if (process.argv[i] === '--watch') {
    watch = true;
  }
  else if (process.argv[i] === '--metafile') {
    metafile = true;
  }
}

// ---- setup/data -------------------------------------------------------------

/**
 * banner will be prepended to any and all output files
 */
const banner = `/*! v${package.version}. Copyright 2018-${new Date().getFullYear()} Structured Data, LLC. All rights reserved. CC BY-ND: https://treb.app/license */`;

/**
 * entry points for current build, keyed by output file name
 */
const modern_entry = {
  [package['build-entry-points']['main']]: './treb-embed/src/index-modern.ts',
  [package['build-entry-points']['export-worker'] + '-' + package.version]: './treb-export/src/export-worker/index-modern.ts',
  [package['build-entry-points']['calculation-worker'] + '-' + package.version]: './treb-mc/src/calculation-worker/index-modern.ts',
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
const sass = sass_plugin.sassPlugin(production ? {
  type: 'style',
  async transform(source) {
    const {css} = await postcss([cssnano]).process(source, { from: undefined });
    return css;
  }
} : {
  type: 'style',
});

/** outdir */
const outdir = 'esbuild-output';

// ---- run builder ------------------------------------------------------------

esbuild.build({
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
    'process.env.BUILD_VERSION': `"${package.version}"`,
    'process.env.BUILD_NAME': `"${package.name}"`,
    ...build_entry_replacements,
  },
  /*
  entryPoints: {
    'treb-bundle': './treb-embed/src/index-modern.ts',
  },
  */
  entryPoints: modern_entry,
  bundle: true,
  tsconfig: './treb-embed/modern.tsconfig.json',
  plugins: [
    template_compressor({
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
    }),
    sass,
  ],
  // outfile: path.join(outdir, 'treb-bundle.js'),
  outdir,
}).then(result => {

  if (result.metafile) {

    if (metafile) {
      fs.promises.writeFile(
        path.join(outdir, 'metafile.json'), 
        JSON.stringify(result.metafile, undefined, 2), { encoding: 'utf8' }); 
    }

    if (license) {
      license_plugin.GenerateLicenseFile(result.metafile).then(licenses => {
        fs.promises.writeFile(path.join(outdir, '3d_party.txt'), licenses, { encoding: 'utf8' });
      });
    }

  }
  
}).catch(err => {

  console.error(err);
  process.exit(1);

});

