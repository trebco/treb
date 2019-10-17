
import * as ElementTree from 'elementtree';

export interface ColorSchemeElement {
  name?: string;
  value?: string;
  type?: 'rgb'|'system';
}

export class Theme {

  // where is this defined?
  public static color_map = [
    'lt1', // bg 1
    'dk1', // text 1
    'lt2', // bg 2
    'dk2', // text 2
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ];

  public colors: {[index: string]: ColorSchemeElement} = {};

  private dom?: ElementTree.ElementTree;

  public Init(data: string){
    this.dom = ElementTree.parse(data);
    const tag = this.dom.getroot().tag;

    let namespace = '';
    const match = tag.toString().match(/^(.*?)\:/);
    if (match) namespace = match[1] + ':';

    const color_scheme = this.dom.find(`./${namespace}themeElements/${namespace}clrScheme`);
    if (color_scheme) {

      for (const color of color_scheme.getchildren()) {
        if (color.tag) {
          const name = color.tag.toString().substr(namespace.length);
          let value: string | undefined;
          let type: 'rgb'|'system' = 'rgb';

          for (const child of color.getchildren()) {
            if (child.tag === `${namespace}srgbClr`) {
              value = child.attrib.val;
              type = 'rgb';
            }
            else if (child.tag === `${namespace}sysClr`) {
              value = child.attrib.lastClr;
              type = 'system';
            }
          }

          if (typeof value === 'string') {
            this.colors[name] = { name, value, type };
          }

        }
      }
    }
  }

}
