
import { Measurement, Color } from 'treb-utils';
import { UA } from '../util/ua';

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

  /** ui font */
  interface_font_face?: string;

  /** ui font size */
  // interface_font_size?: number|string;
  interface_font_size_unit?: string;
  interface_font_size_value?: number;

  /**
   * interface dialog -- not used by grid, but here for reference
   * dialog background color.
   */
  interface_dialog_background?: string;

  /**
   * interface dialog -- not used by grid, but here for reference
   * dialog border color.
   */
  interface_dialog_border?: string;

  /**
   * interface dialog -- not used by grid, but here for reference
   * dialog text color.
   */
  interface_dialog_color?: string;

  /**
   * interface dialog -- not used by grid, but here for reference
   * color of mask over spreadsheet. should have some alpha.
   */
  interface_dialog_mask?: string;

  interface_dialog_font_face?: string;
  interface_dialog_font_size?: number|string;

  // --------------------------------------------------------------------------

  tab_bar_font_size?: number|string;
  tab_bar_font_face?: string;
  tab_bar_background?: string;
  tab_bar_color?: string;
  tab_bar_active_background?: string;
  tab_bar_active_color?: string;

  // --------------------------------------------------------------------------

  formula_bar_font_face?: string;
  formula_bar_font_size?: number|string;
  formula_bar_background_color?: string;
  formula_bar_locked_background_color?: string;
  formula_bar_color?: string;

  // --------------------------------------------------------------------------

  /** list background */
  autocomplete_background?: string;

  /** text color */
  autocomplete_color?: string;

  /** highlighted/selected item background */
  autocomplete_highlight_background?: string;

  /** highlighted/selected item text color */
  autocomplete_highlight_color?: string;

  // --------------------------------------------------------------------------

  // these styles apply to the column/row resize tooltip. we can
  // either share these with the function tooltip, or create new
  // properties

  /** tooltip font */
  tooltip_font_face?: string;

  /** tooltip font */
  tooltip_font_size?: number|string;

  /** tooltip background */
  tooltip_background?: string;

  /** tooltip foreground */
  tooltip_color?: string;

  // --------------------------------------------------------------------------

  header_background_color?: string;
  // selected_header_highlight_color?: string;
  header_text_color?: string;
  // header_active_background_color?: string;

  primary_selection_color?: string;

  /** not used atm */
  primary_selection_unfocused_color?: string;

  /** optional line dashes for selection */
  primary_selection_line_dash_array?: string; // number[];

  /** multiple colors for additional selections, recycled */ 
  additional_selection_color?: string[];

  /** not used atm */
  additional_selection_unfocused_color?: string[];

  /** optional line dashes for selection */
  additional_selection_line_dash_array?: string; // number[];

  /** flashing color (overlay) to highlight frozen rows/columns */
  frozen_highlight_overlay?: string;

  /** flashing color (border) to highlight frozen rows/columns */
  frozen_highlight_border?: string;

  /** color(s) for argument highlight selections. will recycle */
  // argument_selection_colors?: string[];

  /** color of grid lines */
  grid_color?: string;

  /** borders of UI elements */
  // interface_border_color?: string;

  /** default border color */
  border_color?: string;

  /** cell background color if there is no actual background set */
  cell_background_color?: string;

  /** default cell font */
  cell_font?: string;

  /** default cell font size */
  // cell_font_size?: number|string;
  cell_font_size_unit?: string;
  cell_font_size_value?: number;

  /** default cell text color */
  cell_color?: string;

  /** color of in-cell note marker */
  note_marker_color?: string;

}

export interface ExtendedTheme extends Theme {
  primary_selection_overlay_color?: string;
  additional_selection_overlay_color?: string[];
  additional_selection_text_color?: string[];
}

/**
 * calculate colors for selection overlay (alpha) and selection-highlight
 * colors. the alphas are slightly more complicated than you think, because
 * we might have symbolic color (e.g. pink) so we need to turn that into a
 * color before we can apply alpha.
 *
 * NOTE: that's no longer strictly true, because now that we are using SVG
 * selections we could just set opacity on the fill (it's a path).
 *
 * @param theme
 * @param threshold max lightness for selection highlight colors
 */
export const CalculateSupplementalColors = (theme: Theme, threshold = .5): ExtendedTheme => {
  const extended_theme: ExtendedTheme = {...theme};

  if (theme.primary_selection_color) {
    const rgb = Measurement.MeasureColor(theme.primary_selection_color);
    extended_theme.primary_selection_overlay_color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, .1)`;
  }

  if (extended_theme.additional_selection_color) {
    // ensure array
    if (!Array.isArray(extended_theme.additional_selection_color)) {
      extended_theme.additional_selection_color = [extended_theme.additional_selection_color];
    }

    extended_theme.additional_selection_overlay_color = [];
    extended_theme.additional_selection_text_color = [];

    for (const color of extended_theme.additional_selection_color) {
      const rgb = Measurement.MeasureColor(color);
      const {h, s, l} = Color.RGBToHSL(rgb[0], rgb[1], rgb[2]);

      // overlay color is just color with alpha of 0.1
      extended_theme.additional_selection_overlay_color.push(
        `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, .1)`);

      // text color may need to be darker, use threshold
      if (l > threshold) {
        const {r, g, b} = Color.HSLToRGB(h, s, threshold);
        extended_theme.additional_selection_text_color.push(
          `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`);
      }
      else {
        extended_theme.additional_selection_text_color.push(
          `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
      }
    }
  }

  return extended_theme;
};

const ParseFontSize = (size: string) => {

  let value = 10;
  let unit = 'pt';

  const match = size.match(/^([\d.]+)(\D.*)$/);
  if (match) {
    value = Number(match[1]);
    unit = match[2];
  }

  return { value, unit };
};

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

  let css = CSS('primary-selection');
  theme.primary_selection_color = css.stroke;
  theme.primary_selection_line_dash_array = css.strokeDasharray;

  css = CSS('additional-selections');
  theme.additional_selection_line_dash_array = css.strokeDasharray;

  const color_array = [];
  for (let i = 0; i < 32; i++ ){
    css = CSS('additional-selection-' + (i + 1));
    const stroke = css.stroke;
    if (stroke && stroke !== 'none') {
      color_array.push(stroke);
    }
  }
  if (color_array.length) {
    theme.additional_selection_color = color_array;
  }

  css = CSS('grid');
  theme.grid_color = css.stroke;

  css = UA.is_windows ?
    css = window.getComputedStyle(Append(Append(node, 'cell'), 'override-windows')) :
    css = CSS('cell');

  theme.cell_font = css.fontFamily;
  theme.cell_background_color = css.fill;

  let font_size = ParseFontSize(css.fontSize);
  theme.cell_font_size_unit = font_size.unit;
  theme.cell_font_size_value = font_size.value;

  theme.border_color = css.borderColor || css.borderBottomColor;
  theme.cell_color = css.stroke;

  css = CSS('freeze-highlight');
  theme.frozen_highlight_overlay = css.fill;
  theme.frozen_highlight_border = css.stroke;

  css = CSS('interface');
  theme.interface_font_face = css.fontFamily;

  font_size = ParseFontSize(css.fontSize);
  theme.interface_font_size_value = font_size.value;
  theme.interface_font_size_unit = font_size.unit;

  css = CSS('interface dialog');
  theme.interface_dialog_color = css.stroke;
  theme.interface_dialog_background = css.fill;
  theme.interface_dialog_border = css.borderBottomColor;
  theme.interface_dialog_font_face = css.fontFamily;
  theme.interface_dialog_font_size = css.fontSize;

  css = CSS('interface mask');
  theme.interface_dialog_mask = css.fill;

  css = CSS('header');
  theme.header_background_color = css.fill;
  theme.header_text_color = css.stroke;

  css = CSS('tooltip');
  theme.tooltip_font_face = css.fontFamily;
  theme.tooltip_font_size = css.fontSize;
  theme.tooltip_background = css.fill;
  theme.tooltip_color = css.stroke;

  css = CSS('formula-bar');
  theme.formula_bar_font_face = css.fontFamily;
  theme.formula_bar_font_size = css.fontSize;
  theme.formula_bar_background_color = css.fill;
  theme.formula_bar_color = css.stroke;

  css = CSS('formula-bar locked');
  theme.formula_bar_locked_background_color = css.fill;

  css = CSS('autocomplete');
  theme.autocomplete_color = css.stroke;
  theme.autocomplete_background = css.fill;

  css = CSS('autocomplete highlight');
  theme.autocomplete_highlight_color = css.stroke;
  theme.autocomplete_highlight_background = css.fill;

  css = CSS('note-marker');
  theme.note_marker_color = css.fill;

  css = CSS('tab-bar');
  theme.tab_bar_font_face = css.fontFamily;
  theme.tab_bar_font_size = css.fontSize;
  theme.tab_bar_background = css.fill;
  theme.tab_bar_color = css.stroke;

  css = CSS('tab-bar active');
  theme.tab_bar_active_background = css.fill;
  theme.tab_bar_active_color = css.stroke;

  // console.info(theme);
  // document.body.removeChild(node);

  // this is a little odd, since we have the check above for "existing element";
  // should we switch on that? or is that never used, and we can drop it? (...)

  (node.parentElement as Element)?.removeChild(node);

  return theme;
};
