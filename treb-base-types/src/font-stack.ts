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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import { UA } from 'treb-grid';
import { Measurement } from 'treb-utils';
import { Style, type FontSize } from './style';

/**
 * these are the stacks we're currently supporting. 
 */
export const font_stack_names = [
  'default', 
  'old-style', 
  'transitional', 
  'handwritten', 
  'monospace', 
  'industrial',
  'ui',
] as const;

export type FontStackType = typeof font_stack_names[number];

export const font_stack_labels: Record<FontStackType, string> = {
  'default': 'Sans-serif',
  'old-style': 'Old style',
  'transitional': 'Serif',
  'handwritten': 'Handwritten',
  'monospace': 'Monospace',
  'industrial': 'Industrial sans',
  'ui': 'System UI',
};

/**
 * representation of a font stack as an object we can manage in themes.
 * the impetus for this is having some font "sets" we can use in a sheet
 * that we know will render in a reasonable cross-platform way.
 * 
 * we're also taking advantage of chrome supporting font features in 
 * canvas. we have to do a little bit of carve-out for ffx browsers on
 * windows but that should be it, and the fallback is OK.
 */

export interface FontStack {

  /** the font family from css. this will usually be a list. */
  family: string;

  /** the actual font used */
  font?: string;

  /** default size for grid cells. may be different for different fonts. */
  size: FontSize;

  /** 
   * font variants. we used this for sitka text to apply lining-nums and 
   * tabular-nums, although we're not using sitka anymore. atm only chrome
   * supports font variants in canvas (boo).
   */
  variants?: string;

}

const font_cache: Map<string, boolean> = new Map();

/**
 * 
 * @param name - for reporting purposes only
 * @param computed - computed css to resolve variables
 * @returns 
 */
export const GenerateFontStack = (name: string, computed: CSSStyleDeclaration): FontStack => {

  const family = computed.fontFamily;
  let font = '';

  const elements = family.split(/,/);

  for (let element of elements) {
    element = element.replace(/'"/g, '').trim();
    const lc = element.toLowerCase();

    //
    // platform-specific hacks. this is kind of unfortunate.
    //

    if (UA.is_firefox && /sitka text/i.test(lc)) {
      continue;
    }

    let check = font_cache.get(lc);
    if (typeof check === 'undefined') {
      check = Measurement.FontLoaded(element);
      font_cache.set(lc, check);
    }
 
    if (check) {
      font = element;
      break;
    }
  }

  if (!font) {
    console.warn('no font found for font stack', name);
  }

  // check the base size, and any adjustments for this font

  const variable_name = font.toLowerCase().replace(/['"]/g, '').replace(/\W+/g, '-');

  const base = computed.getPropertyValue('--treb-font-stack-default-size');
  const adjusted = computed.getPropertyValue(`--treb-font-stack-${variable_name}-size`);
  const variants = computed.getPropertyValue(`--treb-font-stack-${variable_name}-variant`);
  const size = Style.ParseFontSize(adjusted || base || '10pt').font_size || { unit: 'pt', value: 10 };

  // console.info({stack: name, family, font, base, adjusted, size, variants});

  const stack = { 
    family, 
    font, 
    variants,
    size,
  };

  return stack;

};
