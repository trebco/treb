
import { Measurement, Color } from 'treb-utils';
import { UA } from '../util/ua';

/** theme options - colors and fonts */
export interface Theme {

  /** ui font */
  interface_font_face?: string;

  /** ui font size */
  interface_font_size?: number|string;

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
  cell_font_size?: number|string;

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

export const LoadThemeProperties = (container?: HTMLElement): Theme => {
  const theme: Theme = {};
  let node!: HTMLElement;

  const TestNode = (
      class_name: string|string[],
      properties: string|string[],
      remove = false) => {

    const subelement = document.createElement('div');

    if (typeof class_name === 'string') class_name = [class_name];
    // subelement.classList.add(...class_name); // IE11
    subelement.setAttribute('class', class_name.join(' '));
    node.appendChild(subelement);

    const css = (window.getComputedStyle(subelement) || {}) as any;

    if (typeof properties === 'string') properties = [properties];
    const results = properties.map((property) => {
      return css[property];
    });

    if (remove) {
      node.removeChild(subelement);
    }

    return results;
  };

  const parent = container || document;
  const existing_node = parent.querySelector('.treb-theme-container');

  if (existing_node) {
    node = existing_node as HTMLElement;
  }

  if (!node) {
    node = document.createElement('div');
    if (!node) {
      throw new Error('could not create node');
    }
    // node.setAttribute('id', 'treb-theme-container');
    node.classList.add('treb-theme-container');

    // IE11 can't do two classes at once... ?
    node.classList.add('treb-theme');
    node.classList.add('override');

    if (container) {
      container.appendChild(node);
    }
    else {
      document.body.appendChild(node);
    }
  }

  const primary_selection = TestNode('primary-selection', ['stroke', 'stroke-dasharray']);

  theme.primary_selection_color = primary_selection[0];
  theme.primary_selection_line_dash_array = primary_selection[1];
  theme.additional_selection_line_dash_array = TestNode('additional-selections', 'stroke-dasharray')[0];

  const color_array = [];
  for (let i = 0; i < 32; i++ ){
    const stroke = TestNode('additional-selection-' + (i + 1), 'stroke')[0];
    if (stroke && stroke !== 'none') {
      color_array.push(stroke);
    }
  }
  if (color_array.length) {
    theme.additional_selection_color = color_array;
  }

  theme.grid_color = TestNode('grid', 'stroke')[0];

  // NOTE: ffx doesn't have "border-color", it needs to pick a side. also IE11.

  const cell_classes = ['cell'];

  if (UA.is_windows) {
    cell_classes.push('override-windows');
  }

  const cell = TestNode(cell_classes,
    ['font-family', 'fill', 'font-size', 'border-color', 'stroke', 'border-bottom-color']);

  theme.cell_font = cell[0];
  theme.cell_background_color = cell[1];
  theme.cell_font_size = cell[2]; // FontSize(cell[2]);
  theme.border_color = cell[3];
  theme.cell_color = cell[4];

  if (!theme.border_color && cell[5]) theme.border_color = cell[5];

  const highlight = TestNode('freeze-highlight', ['fill', 'stroke']);
  theme.frozen_highlight_overlay = highlight[0];
  theme.frozen_highlight_border = highlight[1];
  
  // tslint:disable-next-line:variable-name
  const interface_ = TestNode('interface', ['font-family', 'font-size']);
  theme.interface_font_face = interface_[0];
  theme.interface_font_size = interface_[1]; // FontSize(interface_[1]);

  const dialog = TestNode(['interface', 'dialog'], ['stroke', 'fill', 'border-bottom-color']);
  theme.interface_dialog_color = dialog[0];
  theme.interface_dialog_background = dialog[1];
  theme.interface_dialog_border = dialog[2];

  const mask = TestNode(['interface', 'mask'], ['fill']);
  theme.interface_dialog_mask = mask[0];

  const header = TestNode('header', ['fill', 'stroke']);
  theme.header_background_color = header[0];
  theme.header_text_color = header[1];

  const tooltip = TestNode('tooltip', ['font-family', 'font-size', 'fill', 'stroke']);
  theme.tooltip_font_face = tooltip[0];
  theme.tooltip_font_size = tooltip[1]; // FontSize(tooltip[1]);
  theme.tooltip_background = tooltip[2];
  theme.tooltip_color = tooltip[3];

  const formula_bar = TestNode('formula-bar', ['font-family', 'font-size', 'fill', 'stroke']);
  theme.formula_bar_font_face = formula_bar[0];
  theme.formula_bar_font_size = formula_bar[1];
  theme.formula_bar_background_color = formula_bar[2];
  theme.formula_bar_color = formula_bar[3];

  const locked = TestNode(['formula-bar', 'locked'], ['fill']);
  theme.formula_bar_locked_background_color = locked[0];

  const ac = TestNode('autocomplete', ['stroke', 'fill']);
  theme.autocomplete_color = ac[0];
  theme.autocomplete_background = ac[1];

  const ac_highlight = TestNode(['autocomplete', 'highlight'], ['stroke', 'fill']);
  theme.autocomplete_highlight_color = ac_highlight[0];
  theme.autocomplete_highlight_background = ac_highlight[1];

  const note_marker = TestNode(['note-marker'], ['fill']);
  theme.note_marker_color = note_marker[0];

  // console.info(theme);
  // document.body.removeChild(node);

  (node.parentElement as Element).removeChild(node);

  return theme;
};
