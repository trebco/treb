
// @ts-check

/* global console */

import * as esbuild from 'esbuild';
import { promises as fs } from 'fs';
import { minify } from 'html-minifier-terser';
import path from 'path';
import cssnano from 'cssnano';
import postcss, { Result } from 'postcss';

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
 * @param {{verbose?: boolean, minify?: boolean, define?: Record<string, string>}} [options]
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
    });

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

          define: options?.define,
          external: ['*.wasm'],

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
        contents: options?.minify ? await minify(text, html_minifier_options) : text,
        loader: 'text',
      };



    });
  },
});

/** 
 * @function
 * @param {{verbose?: boolean, minify?: boolean, renderedCss?: boolean, writeBundleCss?: boolean}} [options]
 * @returns {esbuild.Plugin}
 * 
 * compile CSS according to normal rules, save to a file, but return as a 
 * string so we can directly import it in script
 */
export const CSSTextPlugin = (options) => ({
  name: 'css-text-pipeline',
  setup(build) {

    const collectedCss = new Map();

    build.onLoad({ filter: /\.css$/ }, async (args) => {

      // Run a targeted sub-build on the entry CSS file
      const result = await esbuild.build({
        entryPoints: [args.path],
        bundle: true,                            // Inlines @import files and handles url()
        minify: build.initialOptions.minify ?? false,
        metafile: true,                          // Enables tracking of input dependency files
        write: false,                            // Keep output in memory buffer
        outdir: 'out',                           // Required for bundle output calculation
        loader: build.initialOptions.loader,     // Inherit custom asset loaders (e.g. svg, png)
      });

      const output_file = result.outputFiles.find((file) => file.path.endsWith('.css'));
      const css_text = output_file?.text || '';
      const watchFiles = Object.keys(result.metafile.inputs) || [];

      collectedCss.set(args.path, css_text);

      return {
        contents: css_text,
        loader: 'text',
        watchFiles,
      };
    });

    build.onEnd(async (result) => {

      if (options?.writeBundleCss === false || collectedCss.size === 0) {
        return;
      }

      const { outfile, outdir, entryPoints } = build.initialOptions;
      let cssOutputPath;

      // Case A: Main build defines an explicit `outfile` (e.g. `outfile: 'dist/my-app.js'`)
      if (outfile) {
        const parsed = path.parse(outfile);
        cssOutputPath = path.join(parsed.dir, `${parsed.name}.css`);
      } 
      // Case B: Main build uses `outdir` with named entry points (e.g. `entryPoints: { 'my-bundle': 'src/index.js' }`)
      else {
        const targetDir = outdir || 'dist';
        let bundleName = 'bundle';

        if (Array.isArray(entryPoints) && entryPoints.length > 0) {
          const first = entryPoints[0];
          if (typeof first === 'object' && first !== null && first.out) {
            bundleName = first.out; // Named entry: { in: 'src/index.js', out: 'my-custom-name' }
          } else if (typeof first === 'string') {
            bundleName = path.basename(first, path.extname(first));
          }
        } else if (typeof entryPoints === 'object' && entryPoints !== null) {
          // Key-value entry points object: { 'custom-name': 'src/index.js' }
          bundleName = Object.keys(entryPoints)[0];
        }

        cssOutputPath = path.join(targetDir, `${bundleName}.css`);
      }
      
      const fullCssContent = Array.from(collectedCss.values()).join('\n\n');

      // Ensure target directory exists and write the file
      await fs.mkdir(path.dirname(cssOutputPath), { recursive: true });
      await fs.writeFile(cssOutputPath, fullCssContent, 'utf8');

    });

  },
});

/** 
 * @function
 * @param {{verbose?: boolean, minify?: boolean, renderedCss?: boolean}} [options]
 * @returns {esbuild.Plugin}
 * 
 * plugin compiles sass and returns generated css as string, optionally minified 
 * /
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
          loader: options?.renderedCss ? 'css' : 'text',
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
*/

/**
 * @returns {esbuild.Plugin}
 * 
 * thanks to
 * https://github.com/evanw/esbuild/issues/3337#issuecomment-2085394950
 */
export const RewriteIgnoredImports = () => {
  return {
    name: 'RewriteIgnoredImports',
    setup(build) {
      build.onEnd(async (result) => {
        if (result.outputFiles) {
          for (const file of result.outputFiles) {

            // need to ensure directory has been created already. we 
            // should check, rather than always create, but... also this
            // plugin is going to go away soon so nbd
            
            const dir = path.dirname(file.path);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(file.path, file.text.replace(/esbuild-ignore-import:/g, ''));
          }
        }
      });
    },
  };
};

/**
 * @returns {esbuild.Plugin}
 * @param {*} options 
 */
export const CopyFilesPlugin = (options) => {
  return {
    name: 'CopyFiles',
    setup(build){

      build.onLoad({ filter: new RegExp(options.trigger) }, async (args) => {
        const source = await fs.readFile(args.path, 'utf8');
      
        return {
          contents: source,
          loader: args.path.endsWith('ts') ? 'ts' : 'js',
          watchFiles: options.files,
        };
      });

      build.onEnd(async (result) => {
        const outdir = options.outdir;
        const promises = (options.files || []).map(file => {
          const filename = path.basename(file);
          const target = path.join(outdir, filename);

          if (options.verbose) {
            console.info('static copy', file, '->', target);
          }

          return fs.cp(file, target, {
            recursive: true,
            preserveTimestamps: true,
          });
        });
        await Promise.all(promises);

        result.watchFiles = result.watchFiles || [];
        result.watchFiles.push(...options.files);

        /*
        return {
          watchFiles: options.files,
        };
        */
        
      });
    }
  }
};
