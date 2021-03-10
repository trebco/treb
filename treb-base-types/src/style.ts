
// why is this a namespace? module is implicit... it's because of how
// base types exports; we can't export * as Style, so we're stuck with
// the namespace (or you could add an intermediate file and import ->
// export, but that just seems like unecessary complexity and still kludgy).

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Style {

  const empty_json = JSON.stringify({});

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

  export interface Color {
    theme?: number;
    tint?: number;
    text?: string;
  }

  export interface Properties {

    horizontal_align?: HorizontalAlign;
    vertical_align?: VerticalAlign;

    nan?: string;

    number_format?: string;

    wrap?: boolean;

    // FIXME: we should use CSS font styling, parse as necessary
    // (in the alternative, maybe have a method to set from a CSS def)

    // deprecated
    // font_size?: number|string;

    // new-style
    font_size_unit?: string;
    font_size_value?: number;

    font_face?: string;
    font_bold?: boolean; // FIXME: switch to weight
    font_italic?: boolean;
    font_underline?: boolean;
    font_strike?: boolean;

    font_weight?: number;

    border_top?: number;
    border_right?: number;
    border_left?: number;
    border_bottom?: number;

    // COLORS. there's a new thing with colors where we need to
    // be able to clear them, in a merge operation. these should
    // perhaps be an object, but for the time being for colors,
    // "" in a merge means "remove this property".

    // background?: string;
    // text_color?: string;
    
    //border_top_color?: string;
    //border_left_color?: string;
    //border_right_color?: string;
    //border_bottom_color?: string;

    // changing colors to support styles... starting with text
    text?: Color;
    fill?: Color;

    border_top_fill?: Color;
    border_left_fill?: Color;
    border_right_fill?: Color;
    border_bottom_fill?: Color;

    // NEW
    // FIXME: change name to editable, default true? (...)

    // this is not properly in style -- should be in cell

    // UPDATE: whether it's appropriate or not, style is a better place
    // because it can cascade

    locked?: boolean;

  }

  export type PropertyKeys = keyof Style.Properties;


  /**
   * note that there are no default colors; those should be set
   * in grid when style is applied. that way the default colors for
   * border, text and background colors will be theme-dependent and
   * can change.
   */
  export const DefaultProperties: Properties = {
    horizontal_align: HorizontalAlign.None,
    vertical_align: VerticalAlign.None,
    number_format: '0.00###',   // use symbolic, e.g. "general"
    nan: 'NaN',
    // font_size: 10,              // should have units

    font_size_value: 10,
    font_size_unit: 'pt',

    font_face: 'calibri',       // switch to something generic "sans serif"
    font_bold: false,           // drop "font_"
    font_italic: false,         // ...
    font_underline: false,      // ...
    font_strike: false,         // 
    // background: 'none',

    // text_color: 'none',
    // text: 'theme',
    // text_theme: 0,
    text: { theme: 0 },

    // border_top_color: 'none',
    // border_left_color: 'none',
    // border_right_color: 'none',
    // border_bottom_color: 'none',
    
    border_top: 0,               // adding defaults so these prune propery
    border_left: 0,
    border_right: 0,
    border_bottom: 0,
  };

  /* *
   * this version of merge is used to support explicit deletes, via
   * "undefined" properties. we use a trick via JSON to skip iterating
   * properties (I believe this is faster, but have not tested).
   * /
  export const Merge2 = (dest: Properties, src: Properties): Properties => {
    return JSON.parse(JSON.stringify({...dest, ...src}));
  }
  */

  /**
   * merge. returns a new object, does not update dest in place.
   * NOTE: if it does not update dest in place, then what would be
   * the use case for a non-delta merge? (...)
   */
  export const Merge = (dest: Properties, src: Properties, delta = true): Properties => {
    const properties: Properties = delta ? {...dest, ...src} : {...src};
    return JSON.parse(JSON.stringify(properties));
  };

  export const Composite = (list: Properties[]): Properties => {
    return JSON.parse(JSON.stringify(list.reduce((composite, item) => ({...composite, ...item}), {})));
  };

  export const Empty = (style: Properties): boolean => {
    return JSON.stringify(style) === empty_json;
  };

  export const ValidColor = (color?: Color): boolean => {
    return !!(color && (color.text || color.theme || color.theme === 0));
  };

  export const Prune = (style: Properties): void => {

    // text default is theme 0, so we can remove that if we see it. 
    // same for borders, we can group

    if (style.text && !style.text.text && !style.text.theme) {
      style.text = undefined;
    }

    if (style.border_top_fill && !style.border_top_fill.text && !style.border_top_fill.theme) {
      style.border_top_fill = undefined;
    }

    if (style.border_left_fill && !style.border_left_fill.text && !style.border_left_fill.theme) {
      style.border_left_fill = undefined;
    }

    if (style.border_right_fill && !style.border_right_fill.text && !style.border_right_fill.theme) {
      style.border_right_fill = undefined;
    }

    if (style.border_bottom_fill && !style.border_bottom_fill.text && !style.border_bottom_fill.theme) {
      style.border_bottom_fill = undefined;
    }

    // background has no default, so check for 0
    if (style.fill && !style.fill.text && !style.fill.theme && style.fill.theme !== 0) {
      style.fill = undefined;
    }

  };

  /* *
   * overlay. will always put defaults at the bottom.
   * /
  export const Composite = (list: Properties[]) => {
    return list.reduce((composite, item) => ({...composite, ...item}),
      {...DefaultProperties});
  };

  / * *
   * modify default properties. useful for theming.
   * /
  export const UpdateDefaultProperties = (opts: Properties) => {
    DefaultProperties = {
      ...DefaultProperties, ...opts,
    };
  };
  */

  /**
   * returns a string representation suitable for canvas (or style)
   */
  export const Font = (properties: Properties, scale = 1) => {

    /*
    let font_size = properties.font_size;
    if (typeof font_size === 'number') {
      font_size = (font_size * scale) + 'pt';
    }
    else if (font_size && scale !== 1) {
      const font_parts = font_size.match(/^([\d\.]+)(\D*)$/);
      if (font_parts) {
        font_size = (Number(font_parts[1]) * scale) + font_parts[2];
      }
    }
    */

    const parts: string[] = [];

    if (properties.font_weight) {
      parts.push(properties.font_weight.toString());
    }
    else if (properties.font_bold) {
      parts.push('bold');
    }

    if (properties.font_italic) {
      parts.push('italic');
    }

    parts.push(((properties.font_size_value || 0) * scale).toFixed(2) + 
      (properties.font_size_unit || 'pt'));

    parts.push(properties.font_face || '');

    return parts.join(' ');

    /*
    // console.info("FS", font_size);

    if (properties.font_weight) {
      return (properties.font_weight + ' ')
        + (properties.font_italic ? 'italic ' : '')
        + font_size + ' ' + properties.font_face;
    }
    else {
      return (properties.font_bold ? 'bold ' : '')
        + (properties.font_italic ? 'italic ' : '')
        + font_size + ' ' + properties.font_face;
    }
    */
   
  };

}
