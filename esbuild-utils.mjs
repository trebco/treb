
// @ts-check

import * as esbuild from 'esbuild';
import { promises as fs } from 'fs';
import { minify } from 'html-minifier';
import path from 'path';
import * as sass from 'sass';
import cssnano from 'cssnano';
import postcss from 'postcss';

/** @type {import('html-minifier').Options} */
const html_minifier_options = {
  removeComments: true,
  collapseWhitespace: true,
};

/**
 * @function
 * @param {string} [label] - optional label for build messages
 * @returns {esbuild.Plugin}
 * 
 * add notifications on build start/end. we also want to use this
 * to notify worker sub-builds, so we can be sure they're working
 * properly.
 */
export const NotifyPlugin = (label) => {
  return {
    name: 'notify', 
    setup(build) {
      build.onStart(() => {
        console.info(`${label ? `${label} ` : ''}build started @ ${new Date().toLocaleTimeString()}`);
      });
      build.onEnd(result => {
        if (!result.errors.length) {
          
          const keys = Object.keys(result.metafile?.outputs||{});
          const bytes = keys.length ? result.metafile?.outputs[keys[0]]?.bytes : 0;
          const size = bytes ? `; build size: ${FormatSize(bytes, 2)}` : '';

          console.info(`${label ? `${label} ` : ''}build complete @ ${new Date().toLocaleTimeString()}${size}`);
          // console.info(result.metafile);
        }
        if (!label) {
          console.info('');
        }
      });
    },
  };
};

/**
 * @function
 * @param {number} size - size in bytes
 * @returns {string} - size as a human readable string
 */
export const FormatSize = (size, precision = 1) => {

  const units = ['B', 'KB', 'MB'];
  let index = 0;

  for (let i = 0; i < units.length; i++) {
    if (size > 1024) {
      size = size / 1024;
      index++;
    }
  }

  return `${size.toFixed(precision)} ${units[index]}`;

};

/** 
 * @function
 * @param {{verbose?: boolean, minify?: boolean}} [options]
 * @returns {esbuild.Plugin}
 * 
 * inlining the worker build. this works out well with one limitation:
 * at the moment, we're not caching the build for watching. OTOH esbuild 
 * is so fast it doesn't really matter at the moment.
 * 
 * if you import a worker script like this 
 * ```
 * import * as worker_script from 'worker:path/to/worker';
 * ```
 * the plugin will compile the target (with esbuild) and then return the 
 * compiled script as a string. the child build inherits minify settings 
 * from the parent build.
 * 
 * note the `import *` syntax; we can't just import the script, because
 * tsc will complain about a missing default export (and you can't have 
 * a default export, or it will break when it runs).
 * 
 * you can then use it in the containing script by creating a worker:
 * ```
 * const worker = new Worker(URL.createObjectURL(new Blob([(worker_script as any).default], { type: 'application/javascript' })));
 * ```
 * 
 * here we have to use `any`, for the time being, because when tsc reads
 * this it will note (correctly) that there's no default. but for our 
 * esbuild import, we will have a default string.
 * 
 * this might cause problems with CSP. if so, we'll sort that out separately.
 * 
 */
export const WorkerPlugin = (options) => ({
  name: 'worker',
  setup(build) {

    build.onResolve({ filter: /^worker:/}, async (args) => {
      args.path = args.path.substring(7);
      const result = await build.resolve(args.path, {
        kind: args.kind,
        resolveDir: args.resolveDir,
      });
      return { path: result.path, namespace: 'worker', };
    }),

    // for some reason I can't get the filter to work here, but using
    // namespace works. as long as we don't collide with anybody else.
    //
    // with the assumption that esbuild will eventually have a solution
    // for inlining workers, we might want to use a more distinctive 
    // namespace that has less possibility of collision in the future.
    // of course if that happens we will probably use the native version,
    // so maybe it doesn't matter.

    build.onLoad({ filter: /./, namespace: 'worker' }, async(args) => {

      if (options?.verbose) {
        console.info('worker:', args.path);
      }

      try {

        const result = await esbuild.build({

          entryPoints: [ args.path ],

          // we can use this as a key later
          outfile: 'worker',

          // inherit options
          minify: options?.minify,
          bundle: true,
          format: 'esm',

          // don't write to filesystem
          write: false,

          // use the metafile to get deps
          metafile: true,

          // write to stdout
          plugins: [
            NotifyPlugin('- worker'),
          ],

        });

        if (options?.verbose) {
          console.info('  worker build size: ' + FormatSize(result.outputFiles[0].text.length));
        }

        // here's where we use that name as a key

        const inputs = result.metafile.outputs['worker'].inputs;
        const watchFiles = Object.keys(inputs).map(relative => path.resolve(relative));
  
        return {
          errors: result.errors,
          warnings: result.warnings,
          loader: 'text',
          contents: result.outputFiles[0].text,
          watchFiles,
        }
  
      }
      catch (err) {

        // on error, we pass the file that threw as a dependency so we can
        // watch updates and trigger a rebuild (nice that this works, btw)

        const watchFiles = [];
        for (const error of err.errors) {
          if (error.location?.file) {
            watchFiles.push(path.resolve(error.location.file));
          }
        }
        return {
          errors: err.errors,
          watchFiles,
        };

      }

    });
  }
});


/** 
 * @function
 * @param {{verbose?: boolean, minify?: boolean}} [options]
 * @returns {esbuild.Plugin}
 * 
 * plugin loads html as string, optionally minified 
 * 
 */
export const HTMLPlugin = (options) => ({
  name: 'html',
  setup(build) {
    build.onLoad({ filter: /\.html$/ }, async (args) => {

      if (options?.verbose) {
        console.info('html:', args.path);
      }

      const text = await fs.readFile(args.path, 'utf8');
      return {
        contents: options?.minify ? minify(text, html_minifier_options) : text,
        loader: 'text',
      };
    });
  },
});

/** 
 * @function
 * @param {{verbose?: boolean, minify?: boolean}} [options]
 * @returns {esbuild.Plugin}
 * 
 * plugin compiles sass and returns generated css as string, optionally minified 
 */
export const SassPlugin = (options) => ({
  name: 'sass',
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, async (args) => {

      if (options?.verbose) {
        console.info('sass:', args.path);
      }

      try {

        const result = await sass.compile(args.path, {
          loadPaths: ['.'],
          // charset: false,
          // style: 'compressed',
        });
        const files = (result.loadedUrls || []).map(url => url.pathname);
        
        let contents = result.css;
        if (options?.minify) {
          const minified = await postcss([cssnano]).process(result.css, { from: undefined });
          contents = minified.css;
        }

        return {
          contents,
          loader: 'text',
          watchFiles: files,
        };

      }
      catch (err) {
        const watchFiles = [];
        if (err.span?.file?.url?.path) {
          watchFiles.push(path.resolve(err.span.file.url.path));
        }
        return {
          errors: [{ 
            text: err.message,
            // ...location...
          }],
          watchFiles,
        }
      }

    });
  },
});
