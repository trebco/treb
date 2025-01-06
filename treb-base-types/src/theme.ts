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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import { type Color, type CellStyle, IsHTMLColor, IsThemeColor, ThemeColorIndex, type ThemeColor, type FontSize } from './style';
import { ColorFunctions } from './color';
// import * as LCHColorFunctions from './color2';

import { DOMContext } from './dom-utilities';
import { Measurement } from 'treb-utils';
import { font_stack_names, type FontStack, GenerateFontStack } from './font-stack';

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
 * composite styling for tables.
 * 
 * @privateRemarks
 * 
 * we used to have a "footer", now removed. use borders on rows.
 */
export interface TableTheme {

  /** the first row in a table, showing column titles. */
  header?: CellStyle;

  /** 
   * odd rows in the table. we count the title row as zero, so
   * the first row in the table containing data is 1, hence odd.
   */
  odd?: CellStyle;

  /**
   * even rows in the table.
   */
  even?: CellStyle;

  /**
   * styling for the totals row, if included. this will be the last 
   * row in the table. 
   */
  total?: CellStyle;
}

/** theme options - colors and fonts */
export interface Theme {

  /** grid headers (composite) */
  headers?: CellStyle;

  /** grid cell defaults (composite: size, font face, color, background) */
  grid_cell?: CellStyle;

  /** 
   * base font size for grid cell. we try to specify things in ems, but
   * we do need to know this in order to measure
   */
  grid_cell_font_size: FontSize;

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
  theme_colors_rgb?: [number, number, number][];

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

  /**
   * cache for offset colors
   */
  offset_cache?: Record<string, string>;

  /**
   * this is now default, but you can set explicitly per-table
   */
  table?: TableTheme;

  /**
   * this is for tinting. we're experimenting with tinting towards black
   * or white, as opposed to lightening/darkening colors. this should improve
   * swapping themed colors.
   * 
   * how to derive this value? @see DeriveColorScheme
   */
  mode: 'light'|'dark';

  /** light color for offset (against dark background) */
  offset_light: string;

  /** dark color for offset (against light background) */
  offset_dark: string;

  /** precalculated font stacks */
  font_stacks: Record<string, FontStack>;

}

/**
 * @internal
 */
export const DefaultTheme: Theme = {
  grid_color: '#ccc',
  note_marker_color: '#d2c500',
  mode: 'light',
  offset_cache: {},
  offset_light: '#fff',
  offset_dark: '#000',
  font_stacks: {},
  grid_cell_font_size: { value: 10, unit: 'pt' },
};

/* *
 * now just a wrapper, we should remove
 * 
 * the only difference between this and the other function (ThemeColor2)
 * is that this has a default for "defaultindex" => 0; calls can just 
 * call the second method with the extra argument.
 * 
 * @deprecated
 * @internal
 * /
export const ThemeColor = (theme: Theme, color?: Color): string => {
  return ThemeColor2(theme, color, 0);
};
*/

/**
 * we cache values in the theme object so that we can dump it when we 
 * reload or update the theme.
 * 
 * we're now inverting tint for dark themes. the idea is that if you
 * are using a dark theme, it's more natural to go in that direction, and
 * you can use the same foreground color.
 * 
 * because this is ephemeral it won't impact export.
 */
const TintedColor = (theme: Theme, source: ThemeColor) => {

  const index = ThemeColorIndex(source);
  let tint = (source.tint || 0);

  if (theme.mode === 'dark') {
    tint = -tint; // invert;
  }

  if (!theme.tint_cache) {
    theme.tint_cache = [];
  }

  if (!theme.tint_cache[index]) {
    theme.tint_cache[index] = {};
  }

  let color = theme.tint_cache[index][tint];
  if (!color) {

    const rgb: [number, number, number] = (theme.theme_colors_rgb ? theme.theme_colors_rgb[index] : [0, 0, 0]) || [0, 0, 0];

    let tinted: {r: number, g: number, b: number};
    if (tint > 0) {
      tinted = ColorFunctions.Lighten(rgb[0], rgb[1], rgb[2], tint * 100, true);
    }
    else {
      tinted = ColorFunctions.Darken(rgb[0], rgb[1], rgb[2], -tint * 100, true);
    }
    color = `rgb(${tinted.r},${tinted.g},${tinted.b})`;

    /*
    // L is in [0, 100] and the passed tint value is between (-1 and 1). but
    // is the tint value the desired value, or the adjustment? (...)
    // looks like it's the adjustment. makes sense I guess if you pick the 
    // original colors.

    // if the tint value was not originally in perceptual space we might need
    // to curve it a bit? (...)

    const lch = LCHColorFunctions.RGBToLCH(...rgb);
    const tinted = LCHColorFunctions.LCHToRGB(lch.l + 50 * tint, lch.c, lch.h);
    color = `rgb(${tinted.r},${tinted.g},${tinted.b})`;
    */

    theme.tint_cache[index][tint] = color;

  }

  return color;

};

/** 
 * this includes an implicit check for valid color, if a color 
 * can't be resolved it returns ''. now supports offset colors. 
 * offset returns a light color against a dark background, and
 * vice versa. what constitutes a dark background is not entirely
 * clear; atm using lightness = .65. 
 * 
 * @internal
 */
export const ResolveThemeColor = (theme: Theme, color?: Color, default_index?: number): string => {

  if (color && color.offset) {

    // don't do this
    if (color.offset.offset) {
      console.warn('invalid offset color'); 
      return ''; 
    }

    let resolved = '';

    if (IsHTMLColor(color.offset)) {
      const clamped = Measurement.MeasureColor(color.offset.text);
      resolved = `rgb(${clamped[0]}, ${clamped[1]}, ${clamped[2]})`;
    }
    else {
      resolved = ResolveThemeColor(theme, color.offset, undefined);
    }

    // check cache
    if (theme.offset_cache && theme.offset_cache[resolved]) {
      return theme.offset_cache[resolved];
    }

    let offset = theme.offset_light;

    if (resolved) {
      // ok figure it out?
      const match = resolved.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {

        type ColorTuple = [number, number, number];

        const background: ColorTuple = [Number(match[1]), Number(match[2]), Number(match[3])];


        // const hsl = ColorFunctions.RGBToHSL(r, g, b);
        // const check = ColorFunctions.GetLuminance(r, g, b);

        const a = Array.from(Measurement.MeasureColor(theme.offset_dark)) as ColorTuple;
        const b = Array.from(Measurement.MeasureColor(theme.offset_light)) as ColorTuple;

        const tc = ColorFunctions.GetTextColor(background, a, b);

        offset = `rgb(${tc[0]}, ${tc[1]}, ${tc[2]})`;

        /*
         if (hsl.l >.65)) {
          offset = theme.offset_dark;
        }
        */


      }
      else {
        // ...
        console.warn(`can't offset against color`, resolved, '(1)');
      }

      if (!theme.offset_cache) {
        theme.offset_cache = {};
      }
      theme.offset_cache[resolved] = offset;
    }
    else {
      console.warn(`can't resolve offset color`, color.offset, '(2)');
    }

    return offset;
  }

  // explicit color, or none

  if (IsHTMLColor(color)) {
    return color.text === 'none' ? '' : color.text;
  }

  // theme color. we need a way to cache these lookups, especially for tinting

  if (IsThemeColor(color)) {
    if (color.tint) {
      return TintedColor(theme, color);
    }
    return theme.theme_colors ? theme.theme_colors[ThemeColorIndex(color)] : '';
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

/* *
 * pull out styles we apply to tables, if they differ from the base.
 * setting "initial" or "inherit" doesn't work to clear them (at least atm); 
 * use "transparent" to unset.
 * /
const TableStyleFromCSS = (base: CSSStyleDeclaration, style: CSSStyleDeclaration): Style.Properties => {

  const props: Style.Properties = {};

  if (style.borderTopColor !== base.borderTopColor) {
    props.border_top = 1;
    props.border_top_fill = { text: style.borderTopColor };
    if (style.borderTopStyle === 'double') {
      props.border_top = 2;
    }
  }

  if (style.borderBottomColor !== base.borderBottomColor) {
    props.border_bottom = 1;
    props.border_bottom_fill = { text: style.borderBottomColor };
    if (style.borderBottomStyle === 'double') {
      props.border_bottom = 2;
    }
  }

  if (style.backgroundColor !== base.backgroundColor) {
    props.fill = { text: style.backgroundColor };
  }

  if (style.color !== base.color) {
    props.text = { text: style.color };
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
*/

// testing
const StyleFromCSS = (css: CSSStyleDeclaration, include_font_face = false): CellStyle => {

  // const { value, unit } = ParseFontSize(css.fontSize||'');

  const style: CellStyle = {
    fill: { text: css.backgroundColor }, // || 'none',
    text: { text: css.color },
    
    /*
    font_size: {
      unit, value,
    },
    */

    // use container size unless we scale. the reason we do this is 
    // because if we set scale, we always wind up with em units.

    font_size: { unit: 'em', value: 1 },

    // font_face: css.fontFamily,
  };

  if (include_font_face) {
    style.font_face = css.fontFamily;
  }

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

/**
 * how to derive the light/dark theme? it's complicated, as it turns out.
 * there's almost nothing we can do to reliably determine what theme
 * is set. the best thing would be color-scheme, which affects (among other
 * things) scrollbars, but that might be set to something like 'light dark'
 * which is indeterminate.
 * 
 * so what we are going to do is check the grid foreground and background;
 * if the foreground is lighter than the background, we're in dark mode.
 * and vice-versa. 
 * 
 */
const DeriveColorScheme = (theme: Theme, context: CanvasRenderingContext2D): 'light' | 'dark' => {

  const foreground_color = theme.grid_cell?.text;
  const background_color = theme.grid_cell?.fill;

  // because these are rendered to a canvas, we know that A is 255

  context.fillStyle = IsHTMLColor(foreground_color) ? foreground_color.text : '';
  context.fillRect(0, 0, 3, 3);
  const fg = ColorFunctions.RGBToHSL(...(Array.from(context.getImageData(1, 1, 1, 1).data) as [number, number, number]));

  context.fillStyle = IsHTMLColor(background_color) ? background_color.text : '';
  context.fillRect(0, 0, 3, 3);
  const bg = ColorFunctions.RGBToHSL(...(Array.from(context.getImageData(1, 1, 1, 1).data) as [number, number, number]));

  // console.info({fg, bg});
  
  return fg.l > bg.l ? 'dark' : 'light';

}

/**
 * this is a shortcut for creating table formats based on theme colors.
 * TODO: we might want to swap styles based on light/dark mode?
 * 
 * @internal
 */
export const ThemeColorTable = (theme_color: number, tint = .7): TableTheme => {

  const borders: CellStyle = {
    border_top: 1,
    border_top_fill: { theme: theme_color },
    border_bottom: 1,
    border_bottom_fill: { theme: theme_color },
  };

  return {
    header: {
      // text: { theme: theme.mode === 'dark' ? 1 : 0, },
      // text: { text: '#fff' },
      text: { offset: {theme: theme_color} },
      fill: {theme: theme_color},
      bold: true,
      ...borders,
    },
    odd: {
      fill: { theme: theme_color, tint },
      ...borders,
    },
    even: {
      ...borders,
    },
    total: {
      ...borders,
      border_top: 2,
    },
  }

}

/**
 * for stuff that's painted, we wamt to get the corresponding CSS value.
 * we now set everything via CSS variables, but using the node structure
 * allows us to read calculated values, especially when there are cascades.
 * 
 * I keep trying to change this to just read CSS variables, but that does
 * not do the same thing.
 * 
 * @internal
 */
export const LoadThemeProperties = (container: HTMLElement, use_font_stacks = false): Theme => {
    
  const theme: Theme = JSON.parse(JSON.stringify(DefaultTheme));
  const DOM = DOMContext.GetInstance(container.ownerDocument);

  const Append = (parent: HTMLElement, classes: string): HTMLDivElement => {
    return DOM.Div(classes, parent);
  }

  const ElementCSS = (parent: HTMLElement, classes: string): CSSStyleDeclaration => {
    return DOM.view?.getComputedStyle(Append(parent, classes)) as CSSStyleDeclaration;
  }

  const node = Append(container, '');
  const CSS: (classes: string) => CSSStyleDeclaration = ElementCSS.bind(0, node);

  let css = CSS('grid-cells');
  theme.grid_cell = StyleFromCSS(css, false);
  theme.grid_color = css.stroke || '';
  theme.grid_cell_font_size = ParseFontSize(css.fontSize||'');

  // console.info({theme});

  if (use_font_stacks) {
    for (const key of font_stack_names) {
      css = CSS(`treb-font-stack-${key}`);
      theme.font_stacks[key] = GenerateFontStack(key, css);
    }
  }
  else {

    // default only

    css = CSS(`treb-font-stack-default`);
    theme.font_stacks.default = GenerateFontStack('default', css);
    
  }
  // console.info(theme.font_stacks);
  
  
  css = CSS('grid-headers');
  theme.headers = StyleFromCSS(css, true);
  theme.headers_grid_color = css.stroke;
  if (!theme.headers_grid_color || theme.headers_grid_color === 'none') {
    theme.headers_grid_color = theme.grid_color;
  }

  css = CSS('treb-offset-dark');
  if (css.color) {
    theme.offset_dark = css.color;
  }

  css = CSS('treb-offset-light');
  if (css.color) {
    theme.offset_light = css.color;
  }

  // this _is_ painted, but it doesn't necessarily need to be -- we
  // could use a node. that would require moving it around, though. 
  // let's leave it for now.

  css = CSS('note-marker');
  theme.note_marker_color = css.backgroundColor;

  // updating tables. we're now defining tables as Style.Properties
  // directly. the aim is to use theme colors so we can have multiple
  // table styles without too much fuss.

  /*
  const root_css = CSS('');
  theme.table = {
    header: TableStyleFromCSS(root_css, CSS('treb-table header')),
    odd: TableStyleFromCSS(root_css, CSS('treb-table row-odd')),
    even: TableStyleFromCSS(root_css, CSS('treb-table row-even')),
    // footer: TableStyleFromCSS(root_css, CSS('treb-table footer')),
    total: TableStyleFromCSS(root_css, CSS('treb-table total')),
  }
  */
 
  // console.info(theme.table);

  // theme colors
  
  node.style.color='rgba(1,2,3,.4)'; // this is an attempt at a unique identifier
  css = CSS('');
  const compare = css.color;

  theme.theme_colors = [
    IsHTMLColor(theme.grid_cell.fill) ? theme.grid_cell.fill.text : 'rgb(255, 255, 255)',
    IsHTMLColor(theme.grid_cell.text) ? theme.grid_cell.text.text : 'rgb(51, 51, 51)',
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

  const canvas = DOM.Create('canvas');

  canvas.width = 3;
  canvas.height = 3;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (context) {
    theme.mode = DeriveColorScheme(theme, context);
  }
    
  if (context) {
    theme.theme_colors_rgb = theme.theme_colors.map((color) => {
      context.fillStyle = color;
      context.fillRect(0, 0, 3, 3);
      const imagedata = context.getImageData(1, 1, 1, 1);
      return Array.from(imagedata.data) as [number, number, number];
    });
  }
  
  theme.table = ThemeColorTable(4);

  // this is a little odd, since we have the check above for "existing element";
  // should we switch on that? or is that never used, and we can drop it? (...)

  // console.info(node);
  // console.info(theme);

  (node.parentElement as Element)?.removeChild(node);

  return theme;
};
