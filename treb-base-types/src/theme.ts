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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import type { Style } from './style';
import { Color } from './color';

/*
 * so this is a little strange. we use CSS to populate a theme object,
 * then we create HTML nodes and assign styles to them from the theme
 * object. we should cut out the middleman and use CSS to style nodes.
 * 
 * how did we get here? because we paint, we originally used a theme object.
 * it made sense to put non-painted theme info in there so it was all in one
 * place.
 * 
 * then subsequently we figured out we could use css, apply it, and read out
 * values to populate the theme. so the theme object became internal-only, 
 * but still held all the HTML theme data.
 * 
 * I guess it didn't occur to me at the time that you could use CSS for 
 * everything except painting, and then pull out only those values you
 * actually need for painting.
 * 
 * It has since occurred to me, and this should be a focus of future
 * development (thinking v9). not sure what the overall benefits will be,
 * but it should reduce complexity at least a little.
 * 
 * As part of that I want to generally switch to percentage font sizes for
 * spreadsheet cells.
 */

/**
 * table styles. table has four elements: headers (the first row in
 * the table), odd and event rows, and the last row. we apply as delta
 * to the current style. the first row after the header is row 1, hence
 * odd. footer is usually just a bottom border.
 */
export interface TableStyles {
  header?: Style.Properties;
  odd?: Style.Properties;
  even?: Style.Properties;
  footer?: Style.Properties;
}

/** theme options - colors and fonts */
export interface Theme {

  /** grid headers (composite) */
  headers?: Style.Properties;

  /** grid cell defaults (composite: size, font face, color, background) */
  grid_cell?: Style.Properties;

  /** gridlines color */
  grid_color: string;

  /** 
   * new: gridlines color for headers. should default to the regular grid
   * color unless it's explicitly set.
   */
  headers_grid_color?: string;

  /** color of grid lines */
  // grid?: Style.Properties;

  /** color of in-cell note marker */
  note_marker_color: string;

  /** theme colors */
  theme_colors?: string[];

  /** as RGB, so we can adjust them */
  theme_colors_rgb?: number[][];

  /**
   * cache tinted colors. the way this works is we index by the 
   * theme color first, then by the tint value. 
   * 
   * TODO: we could reduce the tint space... the values look like
   * they are fairly regular (todo)
   * 
   * what we are doing now is rounding to 2 decimal places on import, that 
   * cleans up the super precise values we get from excel to more reasonable
   * values for keys, and I don't think most people can tell the difference
   * between tinting 25% vs 24.99999872%
   */
  tint_cache?: Record<number, string>[];

  table?: TableStyles;

}

export const DefaultTheme: Theme = {
  grid_color: '#ccc',
  note_marker_color: '#d2c500',
};

/**
 * now just a wrapper, we should remove
 * @deprecated
 */
export const ThemeColor = (theme: Theme, color?: Style.Color): string => {
  return ThemeColor2(theme, color, 0);
};

/**
 * we cache values in the theme object so that we can dump it when we 
 * reload or update the theme.
 */
const TintedColor = (theme: Theme, index: number, tint: number) => {

  if (!theme.tint_cache) {
    theme.tint_cache = [];
  }

  if (!theme.tint_cache[index]) {
    theme.tint_cache[index] = {};
  }

  let color = theme.tint_cache[index][tint];
  if (!color) {

    const rgb = (theme.theme_colors_rgb ? theme.theme_colors_rgb[index] : [0, 0, 0]) || [0, 0, 0];
    let tinted: {r: number, g: number, b: number};
    if (tint > 0) {
      tinted = Color.Lighten(rgb[0], rgb[1], rgb[2], tint * 100, true);
    }
    else {
      tinted = Color.Darken(rgb[0], rgb[1], rgb[2], -tint * 100, true);
    }
    color = `rgb(${tinted.r},${tinted.g},${tinted.b})`;
    // console.info(index, tint, color);
    theme.tint_cache[index][tint] = color;

  }

  return color;

};

/** 
 * this includes an implicit check for valid color, if a color 
 * can't be resolved it returns ''
 */
export const ThemeColor2 = (theme: Theme, color?: Style.Color, default_index?: number): string => {

  // explicit color, or none

  if (color?.text) {
    return color.text === 'none' ? '' : color.text;
  }

  // theme color. we need a way to cache these lookups, especially for tinting

  if (color?.theme || color?.theme === 0) {
    if (color.tint) {
      return TintedColor(theme, color.theme, color.tint);
    }
    return theme.theme_colors ? theme.theme_colors[color.theme] : '';
  }

  // default from argument

  if (default_index || default_index === 0) {
    return theme.theme_colors ? theme.theme_colors[default_index] : '';
  }

  // actual default, which is nothing

  return '';

};

const ParseFontSize = (size: string): { value: number, unit: 'pt'|'px'|'em'|'%' } => {

  let value = 10;
  let unit:'pt'|'px'|'em'|'%' = 'pt';

  const match = size.match(/^([\d.]+)(\D.*)$/); // pt, px, em, rem, %
  if (match) {
    value = Number(match[1]);
    unit = match[2] as 'pt'|'px'|'em'|'%';
  }

  return { value, unit };
};

/**
 * pull out styles we apply to tables, if they differ from the base.
 * setting "initial" or "inherit" doesn't work to clear them (at least atm); 
 * use "transparent" to unset.
 */
const TableStyleFromCSS = (base: CSSStyleDeclaration, style: CSSStyleDeclaration): Style.Properties => {

  const props: Style.Properties = {};

  if (style.borderTopColor !== base.borderTopColor) {
    props.border_top = 1;
    props.border_top_fill = { text: style.borderTopColor };
  }

  if (style.borderBottomColor !== base.borderBottomColor) {
    props.border_bottom = 1;
    props.border_bottom_fill = { text: style.borderBottomColor };
  }

  if (style.backgroundColor !== base.backgroundColor) {
    props.fill = { text: style.backgroundColor };
  }

  if (style.fontWeight !== base.fontWeight) {
    props.bold = /(?:700|bold)/.test(style.fontWeight);
  }

  if (style.fontStyle !== base.fontStyle) {
    props.italic = /italic/.test(style.fontStyle);
  }

  if (style.textDecoration !== base.textDecoration) {
    const style_underline = /underline/.test(style.textDecoration);
    const base_underline = /underline/.test(base.textDecoration);

    if (base_underline !== style_underline) {
      props.underline = style_underline;
    }

    const style_strike = /line-through/.test(style.textDecoration);
    const base_strike = /line-through/.test(base.textDecoration);

    if (base_strike !== style_strike) {
      props.strike = style_strike;
    }

  }
  
  return props;

};

// testing
const StyleFromCSS = (css: CSSStyleDeclaration): Style.Properties => {

  const { value, unit } = ParseFontSize(css.fontSize||'');

  const style: Style.Properties = {
    fill: { text: css.backgroundColor }, // || 'none',
    text: { text: css.color },
    font_size: {
      unit, value,
    },
    font_face: css.fontFamily,
  };

  // the default border comes from the "theme colors", not from 
  // the CSS property (it used to come from the CSS property, which
  // is why we have the CSS property set). 
  //
  // default border is theme color 1.
  //

  if (/italic/i.test(css.font)) {
    style.italic = true;
  }

  // for painting we only support regular (400) and bold (700), those 
  // are the only values allowed by canvas (I think)

  if (css.fontWeight === '700') {
    style.bold = true;
  }

  return style;
}

export const LoadThemeProperties = (container: HTMLElement): Theme => {

  const theme: Theme = JSON.parse(JSON.stringify(DefaultTheme));

  const Append = (parent: HTMLElement, classes: string): HTMLDivElement => {
    const node = document.createElement('div');
    node.setAttribute('class', classes);
    parent.appendChild(node);
    return node;
  }

  const ElementCSS = (parent: HTMLElement, classes: string): CSSStyleDeclaration => {
    return window.getComputedStyle(Append(parent, classes));
  }

  const node = Append(container, '');
  const CSS = ElementCSS.bind(0, node);

  let css = CSS('grid-cells');
  theme.grid_cell = StyleFromCSS(css);
  theme.grid_color = css.stroke || '';

  css = CSS('grid-headers');
  theme.headers = StyleFromCSS(css);
  theme.headers_grid_color = css.stroke;
  if (!theme.headers_grid_color || theme.headers_grid_color === 'none') {
    theme.headers_grid_color = theme.grid_color;
  }

  // this _is_ painted, but it doesn't necessarily need to be -- we
  // could use a node. that would require moving it around, though. 
  // let's leave it for now.

  css = CSS('note-marker');
  theme.note_marker_color = css.backgroundColor;

  // table. we need (maybe) a more generic method for pulling out some
  // of these styles. for the time being we'll just pull out border colors, 
  // background color, text color and font styles.

  // comparing against root. perhaps we should be comparing against
  // grid-cell? (...)

  const root_css = CSS('');

  theme.table = {
    header: TableStyleFromCSS(root_css, CSS('treb-table header')),
    odd: TableStyleFromCSS(root_css, CSS('treb-table row-odd')),
    even: TableStyleFromCSS(root_css, CSS('treb-table row-even')),
    footer: TableStyleFromCSS(root_css, CSS('treb-table footer')),
  }
 
  // theme colors
  
  node.style.color='rgba(1,2,3,.4)'; // this is an attempt at a unique identifier
  css = CSS('');
  const compare = css.color;

  theme.theme_colors = [
    theme.grid_cell.fill?.text || 'rgb(255, 255, 255)',
    theme.grid_cell.text?.text || 'rgb(51, 51, 51)',
  ];

  for (let i = 1; i < 32; i++) {
    css = CSS(`theme-color-${i}`);
    if (!css.color || css.color === compare) {
      break;
    }
    theme.theme_colors.push(css.color);
  }

  // we could just parse, we know the returned css format is going
  // to be an rgb triple (I think?)

  const canvas = document.createElement('canvas');

  canvas.width = 3;
  canvas.height = 3;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  
  if (context) {
    theme.theme_colors_rgb= theme.theme_colors.map((color) => {
      context.fillStyle = color;
      context.fillRect(0, 0, 3, 3);
      const imagedata = context.getImageData(1, 1, 1, 1);
      return Array.from(imagedata.data);
    });
  }
  
  // this is a little odd, since we have the check above for "existing element";
  // should we switch on that? or is that never used, and we can drop it? (...)

  (node.parentElement as Element)?.removeChild(node);

  return theme;
};
