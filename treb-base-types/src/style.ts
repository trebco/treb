
// why is this a namespace? module is implicit... it's because of how
// base types exports; we can't export * as Style, so we're stuck with
// the namespace (or you could add an intermediate file and import ->
// export, but that just seems like unecessary complexity and still kludgy).

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
    // FIXME: change name to editable, default true? (...)

    locked?: boolean;

  }

  export type PropertyKeys = keyof Style.Properties;

  /**
   * note that there are no default colors; those should be set
   * in grid when style is applied. that way the default colors for
   * border, text and background colors will be theme-dependent and
   * can change.
   */
  export let DefaultProperties: Properties = {
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
    background: 'none',
    text_color: 'none',
    border_top_color: 'none',
    border_left_color: 'none',
    border_right_color: 'none',
    border_bottom_color: 'none',
    border_top: 0,               // adding defaults so these prune propery
    border_left: 0,
    border_right: 0,
    border_bottom: 0,
  };

  /**
   * merge. returns a new object, does not update dest in place.
   * NOTE: if it does not update dest in place, then what would be
   * the use case for a non-delta merge? (...)
   */
  export const Merge = (dest: Properties, src: Properties, delta = true) => {
    const properties: Properties = delta ? {...dest, ...src} : {...src};
    return properties;
  };

  export const CompositeNoDefaults = (list: Properties[]) => {
    return list.reduce((composite, item) => ({...composite, ...item}), {});
  };

  /**
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

    const font_size = ((properties.font_size_value || 0) * scale) +
      (properties.font_size_unit || 'pt');

    // console.info("FS", font_size);

    return (properties.font_bold ? 'bold ' : '')
      + (properties.font_italic ? 'italic ' : '')
      + font_size + ' ' + properties.font_face;

  };

}
