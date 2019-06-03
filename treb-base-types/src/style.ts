
// why is this a namespace? module is implicit...

// tslint:disable-next-line:no-namespace
export namespace Style {

  /** horizontal align constants */
  export enum HorizontalAlign {
    None = 0,
    Left = 1,
    Center = 2,
    Right = 3,
  }

  /** vertical align constants */
  export enum VerticalAlign {
    None = 0,
    Top = 1,
    Bottom = 2,
    Middle = 3,
  }

  export interface Properties {

    horizontal_align?: HorizontalAlign;
    vertical_align?: VerticalAlign;

    nan?: string;
    nan_color?: string;
    negative_color?: string;

    number_format?: string;

    wrap?: boolean;
    font_size?: number|string;
    font_face?: string;
    font_bold?: boolean;
    font_italic?: boolean;
    font_underline?: boolean;
    border_top?: number;
    border_right?: number;
    border_left?: number;
    border_bottom?: number;

    // COLORS. there's a new thing with colors where we need to
    // be able to clear them, in a merge operation. these should
    // perhaps be an object, but for the time being for colors,
    // "" in a merge means "remove this property".

    background?: string;
    text_color?: string;
    border_top_color?: string;
    border_left_color?: string;
    border_right_color?: string;
    border_bottom_color?: string;

    // NEW

    locked?: boolean;

    [index: string]: any;
  }

  const ColorKeys = [
    'background',
    'text_color',
    'nan_color',
    'negative_color',
    'border_top_color',
    'border_left_color',
    'border_right_color',
    'border_bottom_color',
  ];

  /**
   * note that there are no default colors; those should be set
   * in grid when style is applied. that way the default colors for
   * border, text and background colors will be theme-dependent and
   * can change.
   */
  export let DefaultProperties: Properties = {
    horizontal_align: HorizontalAlign.None,
    vertical_align: VerticalAlign.None,
    number_format: '0.00###',
    nan: 'NaN',
    font_size: 10,
    font_face: 'calibri',
    font_bold: false,
    font_italic: false,
    font_underline: false,
  };

  /**
   * merge. returns a new object, does not update dest in place.
   */
  export const Merge = (dest: Properties, src: Properties, delta= true) => {
    const properties: Properties = {};
    if (delta) Object.keys(dest).forEach((key) => properties[key] = dest[key]);
    Object.keys(src).forEach((key) => properties[key] = src[key]);
    ColorKeys.forEach((key) => {
      if (properties[key] === '') {
        delete properties[key]; // rather not delete...
      }
    });
    return properties;
  };

  /**
   * overlay. will always put defaults at the bottom.
   */
  export const Composite = (list: Properties[]) => {

    const properties: Properties = {};
    Object.keys(DefaultProperties).forEach((key) => properties[key] = DefaultProperties[key]);

    list.forEach((item) => {
      Object.keys(item).forEach((key) => properties[key] = item[key]);
    });

    return properties;

  };

  export const UpdateDefaultProperties = (opts: Properties) => {
    Object.keys(opts).forEach((key) => {
      DefaultProperties[key] = opts[key];
    });
  };

  export const Font = (properties: Properties) => {

    let font_size = properties.font_size;
    if (typeof font_size === 'number') {
      font_size = font_size + 'pt';
    }

    return (properties.font_bold ? 'bold ' : '')
      + (properties.font_italic ? 'italic ' : '')
      + font_size + ' ' + properties.font_face;

  };

}
