
// import { Measurement, Color } from 'treb-utils';
import { UA } from '../util/ua';
import { Style } from 'treb-base-types';

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
  grid_color?: string;

  /** color of grid lines */
  grid?: Style.Properties;

  /** color of in-cell note marker */
  note_marker_color?: string;

}

const ParseFontSize = (size: string) => {

  let value = 10;
  let unit = 'pt';

  const match = size.match(/^([\d.]+)(\D.*)$/); // pt, px, em, rem, %
  if (match) {
    value = Number(match[1]);
    unit = match[2];
  }

  return { value, unit };
};

// testing
const StyleFromCSS = (css: CSSStyleDeclaration): Style.Properties => {

  const { value, unit } = ParseFontSize(css.fontSize||'');

  const style: Style.Properties = {
    background: css.backgroundColor || 'none',
    text_color: css.color || 'none',
    font_size_unit: unit,
    font_size_value: value,
    font_face: css.fontFamily,
  };

  // not sure about this... should maybe be undefined?

  style.border_bottom_color = css.borderBottomColor || ''; // 'none';
  style.border_top_color = css.borderTopColor || ''; // 'none';
  style.border_left_color = css.borderLeftColor || ''; // 'none';
  style.border_right_color = css.borderRightColor || ''; // 'none';

  if (/italic/i.test(css.font)) {
    style.font_italic = true;
  }

  const weight = Number(css.fontWeight);
  if (!isNaN(weight) && weight) {
    style.font_weight = weight;
  }

  return style;
}

export const LoadThemeProperties = (container?: HTMLElement): Theme => {
  const theme: Theme = {};

  const Append = (parent: HTMLElement, classes: string): HTMLDivElement => {
    const node = document.createElement('div');
    node.setAttribute('class', classes);
    parent.appendChild(node);
    return node;
  }

  const ElementCSS = (parent: HTMLElement, classes: string): CSSStyleDeclaration => 
    window.getComputedStyle(Append(parent, classes));

  const parent = container || document;
  const existing_node = parent.querySelector('.treb-theme-container');

  const node = existing_node ? 
    existing_node as HTMLElement :
    Append(container || document.body, 'treb-theme-container treb-theme override');

  const CSS = ElementCSS.bind(0, node);

  // FIXME: UA override...

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

  // this is a little odd, since we have the check above for "existing element";
  // should we switch on that? or is that never used, and we can drop it? (...)

  (node.parentElement as Element)?.removeChild(node);

  return theme;
};
