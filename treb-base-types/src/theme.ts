

import { Style } from './style';
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

/** theme options - colors and fonts */
export interface Theme {

  /** grid headers (composite) */
  headers?: Style.Properties;

  /** grid cell defaults (composite: size, font face, color, background) */
  grid_cell?: Style.Properties;

  /** gridlines color */
  grid_color: string;

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

}

export const DefaultTheme: Theme = {
  grid_color: 'red', // '#ccc',
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

// testing
const StyleFromCSS = (css: CSSStyleDeclaration): Style.Properties => {

  const { value, unit } = ParseFontSize(css.fontSize||'');

  const style: Style.Properties = {
    fill: { text: css.backgroundColor }, // || 'none',
    text: { text: css.color },
    font_size: {
      unit, value,
    },
    // font_size_unit: unit,
    // font_size_value: value,
    font_face: css.fontFamily,
  };

  // not sure about this... should maybe be undefined?

  // console.info("BC?", css.borderBottomColor);

  //style.border_bottom_color = css.borderBottomColor || ''; // 'none';
  //style.border_top_color = css.borderTopColor || ''; // 'none';
  //style.border_left_color = css.borderLeftColor || ''; // 'none';
  //style.border_right_color = css.borderRightColor || ''; // 'none';

  if (/italic/i.test(css.font)) {
    style.italic = true;
  }

  /*
  const weight = Number(css.fontWeight);
  if (!isNaN(weight) && weight) {
    style.font_weight = weight;
  }
  */

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

  // this _is_ painted, but it doesn't necessarily need to be -- we
  // could use a node. that would require moving it around, though. 
  // let's leave it for now.

  css = CSS('note-marker');
  theme.note_marker_color = css.backgroundColor;

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
  const context = canvas.getContext('2d');
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
