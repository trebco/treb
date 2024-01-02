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
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

const empty_json = JSON.stringify({}); // we could probably hard-code this

/** horizontal align constants for cell style */
export type HorizontalAlign = '' | 'left' | 'center' | 'right';

/** vertical align constants for cell style */
export type VerticalAlign = '' | 'top' | 'bottom' | 'middle';

/** 
 * font size for cell style. we generally prefer relative sizes
 * (percent or em) because they are relative to the default theme
 * size, which might be different on different platforms.
 */
export interface FontSize {
  unit: 'pt'|'px'|'em'|'%';
  value: number;
}

/** 
 * color for cell style. color is used for foreground, background and 
 * borders in the cell style. can be either a theme color (theme index 
 * plus tint), or CSS text.
 * 
 * @privateRemarks
 * FIXME: this should be a union type. we do a lot of if switching anyway.
 */
export interface Color {

  theme?: number;
  tint?: number;
  text?: string;

  /** @internal */
  offset?: Color;

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
 * style properties applied to a single cell, row, column, or sheet.
 * when rendering a cell, we composite all styles that might apply.
 */
export interface CellStyle {

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
  
  /** border weight */
  border_top?: number;

  /** border weight */
  border_right?: number;

  /** border weight */
  border_left?: number;

  /** border weight */
  border_bottom?: number;

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

  /**
   * cell is locked for editing
   * 
   * @privateRemarks
   * 
   * this should properly be in cell, not style -- but we keep 
   * it here so it can cascade like other styles.
   * 
   */
  locked?: boolean;

}

/** @internal */
export type PropertyKeys = keyof CellStyle;

/** 
 * (finally) removing the old namespace. we keep this object around for
 * some internal methods, but all the types have moved to the top-level
 * of this module and need to be imported separately. 
 * 
 * we could theoretically build a backcompat module that re-exports all
 * the types, but it's probably not necessary -- most updates will just
 * require a find-and-replace (plus adding some imports).
 * 
 * @internal 
 */
export const Style = {

  /**
   * note that there are no default colors; those should be set
   * in grid when style is applied. that way the default colors for
   * border, text and background colors will be theme-dependent and
   * can change.
   * 
   * @internal
   */
  DefaultProperties: {

    horizontal_align: '',
    vertical_align: '',
    number_format: 'General', // '0.######',   // use symbolic, e.g. "general"
    nan: 'NaN',

    font_size: { unit: 'pt', value: 10.5 },
    font_face: 'sans-serif',

    bold: false,           // drop "font_"
    italic: false,         // ...
    underline: false,      // ...
    strike: false,         // 

    text: { theme: 1 },
    
    border_top: 0,               // adding defaults so these prune propery
    border_left: 0,
    border_right: 0,
    border_bottom: 0,

  } as CellStyle,

  /**
   * this is a utility function for callers that use borders, to
   * reduce testing and facilitate reusable methods
   * 
   * @internal
   */
  CompositeBorders: (style: CellStyle): CompositeBorder => {
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
  },

  /**
   * merge. returns a new object, does not update dest in place.
   * NOTE: if it does not update dest in place, then what would be
   * the use case for a non-delta merge? (...)
   * 
   * @internal
   */
  Merge: (dest: CellStyle, src: CellStyle, delta = true): CellStyle => {
    const properties: CellStyle = delta ? {...dest, ...src} : {...src};
    return JSON.parse(JSON.stringify(properties));
  },

  /** @internal */
  Composite: (list: CellStyle[]): CellStyle => {
    return JSON.parse(JSON.stringify(list.reduce((composite, item) => ({...composite, ...item}), {})));
  },

  /** @internal */
  Empty: (style: CellStyle): boolean => {
    return JSON.stringify(style) === empty_json;
  },

  /** 
   * this looks like a type guard, we should switch to a union
   * type and then add real type guards
   * 
   * @internal 
   */
  ValidColor: (color?: Color): boolean => {
    return !!(color && (!color.none) && (color.text || color.theme || color.theme === 0));
  },

  /** @internal */
   ParseFontSize: (text = '', default_unit = 'em'): CellStyle => {
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
  },

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
  RelativeFontSize: (properties: CellStyle, base: CellStyle): number => {

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
    
  },

  /** @internal */
  FontSize: (properties: CellStyle, prefer_points = true): string => {

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
  },

  /**
   * returns a string representation suitable for canvas (or style)
   */
  Font: (properties: CellStyle, scale = 1) => {

    const parts: string[] = [];

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
   
  },

};
