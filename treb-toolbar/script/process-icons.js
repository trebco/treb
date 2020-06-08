
/**
 * new icon processor
 */

const fs = require('fs');
const path = require('path');

let source_dir = '';

for (let i = 0; i < process.argv.length; i++) {
  if( process.argv[i] === '--source' && i < process.argv.length - 1) {
    source_dir = process.argv[++i];
  }
}

const ReadFile = (file_path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(file_path, 'utf8', (err, data) => {
      if (err) { return reject(err); }
      resolve(data);
    });
  });
};

const ReadDir = (dir_path) => {
  return new Promise((resolve, reject) => {
    fs.readdir(dir_path, (err, files) => {
      if (err) { return reject(err); }
      resolve(files);
    });
  });
};

const Stat = (file_path) => {
  return new Promise((resolve, reject) => {
    fs.stat(file_path, (err, stats) => {
      if (err) { return reject(err); }
      resolve(stats);
    });
  });
}

const ListDir = async (dir_path) => {

  let svg = [];
  const files = await ReadDir(dir_path);

  for (const file of files) {
    const composite = path.join(dir_path, file);
    const stats = await Stat(composite);
    if (stats.isDirectory()) {
      svg = svg.concat(await ListDir(composite));
    }
    else if (/svg$/i.test(composite)) {
      svg.push(composite);
    }
  }

  return svg;
};

const Attr = (src, name) => {
  const rex = new RegExp(name + `=['"](.*?)['"]`);
  const match = src.match(rex);
  if (match) return match[1];
  return undefined;
}

const ParseSVG = (svg, class_name) => {

  const icon = {
    viewbox: '',
    paths: [],
  }

  let match = svg.match(/viewbox=['"](.*?)['"]/i);
  if (match) {
    icon.viewbox = match[1];
  }

  match = svg.match(/<polyline[\s\S]*?(?:\/>|<\/polyline>)/g);
  if (match) {
    for (const item of match) {
      
      const classes = [];
      if (class_name) { 
        classes.push(class_name);
      }

      const item_class = Attr(item, 'class');
      if (item_class) {
        classes.push(item_class);
      }

      /*
      const fill = Attr(item, 'fill');
      if (fill === 'none') {
        classes.push('fill-none');
      }
      */

      const points = Attr(item, 'points');
      if (points) {
        const list = points.split(/[^\d.-]+/g);
        const d = [];
        if (list.length) {
          for (let i = 0; i < list.length; i += 2) {
            if (!i) d.push('M');
            else d.push('L');
            d.push(list[i] + ',' + list[i+1]);
          }
          icon.paths.push({
            d: d.join(' '), // Attr(item, 'd'),
            classes: classes.length ? classes : undefined, // : Attr(item, 'class'),
          });
        }
      }
    }
  }

  match = svg.match(/<line[\s\S]*?(?:\/>|<\/line>)/g);
  if (match) {
    for (const item of match) {
      
      const classes = [];
      if (class_name) { 
        classes.push(class_name);
      }

      const item_class = Attr(item, 'class');
      if (item_class) {
        classes.push(item_class);
      }

      icon.paths.push({
        d: `M${Attr(item, 'x1')},${Attr(item, 'y1')} L${Attr(item, 'x2')},${Attr(item, 'y2')}`, // Attr(item, 'd'),
        classes: classes.length ? classes : undefined, // : Attr(item, 'class'),
      });

    }
  }

  match = svg.match(/<path[\s\S]*?(?:\/>|<\/path>)/g);
  if (match) {
    for (const item of match) {
      
      const classes = [];
      if (class_name) { 
        classes.push(class_name);
      }

      const item_class = Attr(item, 'class');
      if (item_class) {
        classes.push(item_class);
      }

      const fill = Attr(item, 'fill');
      if (fill === 'none') {
        classes.push('fill-none');
      }

      icon.paths.push({
        d: Attr(item, 'd'),
        classes: classes.length ? classes : undefined, // : Attr(item, 'class'),
      });
    }
  }

  return icon;

};

const Convert = async () => {

  const files = await ListDir(source_dir);
  const lib = {};

  for (const file of files) {
    const svg = await ReadFile(file);
    const name = path.relative(source_dir, file).toLowerCase().replace(/.svg$/i, '').replace(/[^\w\/]+/g, '-');
    // console.info(name, ParseSVG(svg));
    const class_name = path.dirname(path.relative(source_dir, file)).toLowerCase().replace(/.svg$/i, '').replace(/\W+/g, '-');

    lib[name] = ParseSVG(svg, class_name);
  }

  const json = JSON.stringify(lib, undefined, 2).replace(/"/g, '\'');

  const output = `

/**
 * source directory: ${path.resolve(source_dir)}
 * generated ${new Date()}
 */  

export interface PathDef2 {
  d: string;
  style?: string;
  classes?: string|string[];
}

export interface SymbolDef2 {
  viewbox?: string;
  paths?: PathDef2[];
}

export const icons: {[index: string]: SymbolDef2} = ${json};

  `;

  console.info(output);

};

if (!source_dir) { throw new Error('missing source directory'); }

Convert();


