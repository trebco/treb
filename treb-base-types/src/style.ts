/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

// why is this a namespace? module is implicit... it's because of how
// base types exports; we can't export * as Style, so we're stuck with
// the namespace (or you could add an intermediate file and import ->
// export, but that just seems like unecessary complexity and still kludgy).

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Style {

  const empty_json = JSON.stringify({}); // we could probably hard-code this

  /** 
   * horizontal align constants
   */
  export enum HorizontalAlign {
    None = '',
    Left = 'left', 
    Center = 'center',
    Right = 'right',
  }

  /** 
   * vertical align constants
   * 
   * @privateRemarks
   * 
   * horizontal alignment was (none), left, center, right.
   * vertical aligment was (none), top, bottom, middle.
   * 
   * not sure why these were not symmetrical, but having strings makes it 
   * easier to manage.
   */
  export enum VerticalAlign {
    None = '',
    Top = 'top',
    Bottom = 'bottom',
    Middle = 'middle',
  }

  /** composite font size */
  export interface FontSize {
    unit: 'pt'|'px'|'em'|'%';
    value: number;
  }

  /** 
   * color is either a theme color (theme index plus tint), or CSS text 
   * 
   * @privateRemarks
   * 
   * FIXME: this should be a union type
   */
  export interface Color {

    theme?: number;
    tint?: number;
    text?: string;

    /** @deprecated */
    none?: boolean;
  }

  /** @internal */
  export interface CompositeBorderEdge {
    width: number;
    color: Color;
  }

  /** @internal */
  export interface CompositeBorder {
    top: CompositeBorderEdge,
    left: CompositeBorderEdge,
    right: CompositeBorderEdge,
    bottom: CompositeBorderEdge,
  }

  /**
   * style properties applied to a cell.
   */
  export interface Properties {

    /** horizontal align defaults to left */
    horizontal_align?: HorizontalAlign;

    /** vertical align defaults to bottom */
    vertical_align?: VerticalAlign;

    /** representation for NaN */
    nan?: string;

    /** number format, either a symbolic name like "General" or a format string */
    number_format?: string;

    /** wrap text */
    wrap?: boolean;

    /** 
     * font size. we recommend using relative font sizes (either % or em)
     * which will be relative to the theme font size.
     */
    font_size?: FontSize;

    /** font face. this can be a comma-delimited list, like CSS */
    font_face?: string;

    /** flag */
    bold?: boolean; // FIXME: switch to weight

    /** flag */
    italic?: boolean;

    /** flag */
    underline?: boolean;

    /** flag */
    strike?: boolean;

    // font_weight?: number;
    
    /** border weight */
    border_top?: number;

    /** border weight */
    border_right?: number;

    /** border weight */
    border_left?: number;

    /** border weight */
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

    /** text color */
    text?: Color;

    /** background color */
    fill?: Color;

    /** border color */
    border_top_fill?: Color;

    /** border color */
    border_left_fill?: Color;

    /** border color */
    border_right_fill?: Color;

    /** border color */
    border_bottom_fill?: Color;

    // NEW
    // FIXME: change name to editable, default true? (...)

    // this is not properly in style -- should be in cell

    // UPDATE: whether it's appropriate or not, style is a better place
    // because it can cascade

    /**
     * cell is locked for editing
     */
    locked?: boolean;

  }

  /** @internal */
  export type PropertyKeys = keyof Style.Properties;

  /**
   * note that there are no default colors; those should be set
   * in grid when style is applied. that way the default colors for
   * border, text and background colors will be theme-dependent and
   * can change.
   * 
   * @internal
   */
  export const DefaultProperties: Properties = {
    horizontal_align: HorizontalAlign.None,
    vertical_align: VerticalAlign.None,
    number_format: 'General', // '0.######',   // use symbolic, e.g. "general"
    nan: 'NaN',
    // font_size: 10,              // should have units

    font_size: { unit: 'pt', value: 10.5 },
    font_face: 'sans-serif',

    /*
    // font_size_value: 10,
    // font_size_unit: 'pt',
    font_size: {
      unit: 'em', value: 1,
    },

    font_face: 'times new roman',       // switch to something generic "sans serif"
    */

    bold: false,           // drop "font_"
    italic: false,         // ...
    underline: false,      // ...
    strike: false,         // 
    // background: 'none',

    // text_color: 'none',
    // text: 'theme',
    // text_theme: 0,
    text: { theme: 1 },

    // border_top_color: 'none',
    // border_left_color: 'none',
    // border_right_color: 'none',
    // border_bottom_color: 'none',
    
    border_top: 0,               // adding defaults so these prune propery
    border_left: 0,
    border_right: 0,
    border_bottom: 0,
  };

  /**
   * this is a utility function for callers that use borders, to
   * reduce testing and facilitate reusable methods
   * 
   * @internal
   */
  export const CompositeBorders = (style: Properties): CompositeBorder => {
    return {
      top: {
        width: style.border_top || 0,
        color: style.border_top_fill || {},
      },
      left: {
        width: style.border_left || 0,
        color: style.border_left_fill || {},
      },
      right: {
        width: style.border_right || 0,
        color: style.border_right_fill || {},
      },
      bottom: {
        width: style.border_bottom || 0,
        color: style.border_bottom_fill || {},
      },
    };
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
   * 
   * @internal
   */
  export const Merge = (dest: Properties, src: Properties, delta = true): Properties => {
    const properties: Properties = delta ? {...dest, ...src} : {...src};
    return JSON.parse(JSON.stringify(properties));
  };

  /** @internal */
  export const Composite = (list: Properties[]): Properties => {
    return JSON.parse(JSON.stringify(list.reduce((composite, item) => ({...composite, ...item}), {})));
  };

  /** @internal */
  export const Empty = (style: Properties): boolean => {
    return JSON.stringify(style) === empty_json;
  };

  /** @internal */
  export const ValidColor = (color?: Color): boolean => {
    return !!(color && (!color.none) && (color.text || color.theme || color.theme === 0));
  };

  /*
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
  */
 
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

  /** @internal */
  export const ParseFontSize = (text = '', default_unit = 'em'): Properties => {
    const match = text.match(/(-*[\d.]+)\s*(\S*)/);

    if (match) {
      const value = Number(match[1]);
      if (!value || isNaN(value) || value < 0) {
        return {}; // invalid
      }
      const unit = match[2].toLowerCase() || default_unit;
      if (unit === 'pt' || unit === 'em' || unit === '%' || unit === 'px') {
        // return { font_size_unit: unit, font_size_value: value };
        return {
          font_size: { unit, value },
        };
      }
    }

    return {};
  };

  /**
   * returns the font size of the properties argument as a ratio of the 
   * base argument. this is intended to show the relative font size of 
   * a spreadsheet cell; so anything with no value should be "1", and
   * everything else is relative to that.
   * 
   * we prefer relative sizes (em, essentially) to fixed sizes because
   * we may have different base font sizes on different platforms (we do,
   * in fact, on windows because calibri is too small).
   * 
   * using relative sizes helps ensure that it looks similar, if not 
   * identical, on different platforms.
   * 
   * @internal
   */
  export const RelativeFontSize = (properties: Properties, base: Properties): number => {

    // we can assume (I think) that base will be either points or px; 
    // there's no case where it should be relative. in fact, let's treat
    // that as an error and return 1.

    // note that if properties is relative (em or %) we don't have to 
    // calculate, it's implicit

    let base_pt = 12;
    let props_pt = 12;

    switch (properties.font_size?.unit) {
      case 'pt':
        if (!properties.font_size.value) { return 1; } // also error
        props_pt = properties.font_size.value;
        break;

      case 'px':
        if (!properties.font_size.value) { return 1; } // also error
        props_pt = Math.round(properties.font_size.value * 300 / 4) / 100;
        break;

      case 'em':
        return (properties.font_size.value || 1); // short circuit

      case '%':
        return (properties.font_size.value || 100) / 100; // short circuit
        
      default:
        return 1; // error
    }

    switch (base.font_size?.unit) {
      case 'pt':
        if (!base.font_size.value) { return 1; } // also error
        base_pt = base.font_size.value;
        break;

      case 'px':
        if (!base.font_size.value) { return 1; } // also error
        base_pt = Math.round(base.font_size.value * 300 / 4) / 100;
        break;

      default:
        return 1; // error
    }

    return props_pt / base_pt;
    
  };

  /** @internal */
  export const FontSize = (properties: Properties, prefer_points = true): string => {

    const value = properties.font_size?.value;

    switch (properties.font_size?.unit) {
      case 'pt':
        return (value||12) + 'pt';

      case 'px':
        if (prefer_points) {
          const points = Math.round((value||16) * 300 / 4) / 100;
          return (points) + 'pt';
        }
        return (value||16) + 'px';

      case 'em':
        return (value||1) + 'em';

      case '%':
        return (value||100) + '%';

    }

    return '';
  };

  /**
   * returns a string representation suitable for canvas (or style)
   * 
   * @internal
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

    //if (properties.font_weight) {
    //  parts.push(properties.font_weight.toString());
    //}
    //else 
    if (properties.bold) {
      parts.push('bold');
    }

    if (properties.italic) {
      parts.push('italic');
    }

    parts.push(((properties.font_size?.value || 0) * scale).toFixed(2) + 
      (properties.font_size?.unit || 'pt'));

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
