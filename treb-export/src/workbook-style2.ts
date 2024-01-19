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

// import * as ElementTree from 'elementtree';
// import { Element, ElementTree as Tree } from 'elementtree';

import { type CompositeBorderEdge, Style, type CellStyle, type PropertyKeys, type Color } from 'treb-base-types';
import { Theme } from './workbook-theme2';
import { NumberFormatCache } from 'treb-format';
import { XMLUtils } from './xml-utils';

import { Unescape } from './unescape_xml';

// what's the default font size? ... 11pt?
const DEFAULT_FONT_SIZE = 11;

export interface Font {
  size?: number;
  name?: string;
  family?: number;
  color_theme?: number;
  color_argb?: string;
  color_tint?: number;
  scheme?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export interface NumberFormat {
  id?: number;
  symbolic_name?: string;
  format?: string;
}

export interface XlColor {
  theme?: number;
  tint?: number;
  indexed?: number;
  argb?: string;
}

export interface Fill {
  pattern_type: 'none'|'solid'|'gray';
  pattern_gray?: number;
  fg_color?: XlColor;
  bg_color?: XlColor;
  // color_argb?: string;
}

export interface CellXf {
  number_format: number;
  font: number;
  fill: number;
  border: number;
  wrap_text?: boolean;
  horizontal_alignment?: string;
  vertical_alignment?: string;
  xfid?: number;

  // FIXME // apply_font?: boolean;
  // FIXME // apply_border?: boolean;
  // FIXME // apply_number_format?: boolean;
  // FIXME // apply_alignment?: boolean;

}

interface ColorAttributes {
  indexed?: string;
  rgb?: string;
  theme?: string;
  tint?: string;
}

export interface BorderEdge {
  style?: string;
  color?: number; // indexed
  rgba?: string;
  theme?: number;
  tint?: number;
}

/**
 * this is flat so we can map/copy better, even thought it makes
 * more sense as a map of simple objects
 */
export interface BorderStyle {

  top: BorderEdge,
  left: BorderEdge,
  bottom: BorderEdge,
  right: BorderEdge,
  diagonal: BorderEdge,

  /*
  left_style?: string; // 'thin' | ??
  left_color?: number; // indexed // FIXME: argb
  left_color_rgba?: string;
  left_color_theme?: number;
  left_color_tint?: number;

  right_style?: string;
  right_color?: number;
  right_color_rgba?: string;
  right_color_theme?: number;
  right_color_tint?: number;

  top_style?: string;
  top_color?: number;
  top_color_rgba?: string;
  top_color_theme?: number;
  top_color_tint?: number;

  bottom_style?: string;
  bottom_color?: number;
  bottom_color_rgba?: string;
  bottom_color_theme?: number;
  bottom_color_tint?: number;

  diagonal_style?: string;
  diagonal_color?: number;
  diagonal_color_rgba?: string;
  diagonal_color_theme?: number;
  diagonal_color_tint?: number;
  */

}

const default_border = {
  top: {}, left: {}, bottom: {}, right: {}, diagonal: {},
}

export interface StyleOptions {
  font?: Font;
  border?: BorderStyle;
  number_format?: NumberFormat;
  horizontal_alignment?: string;
  vertical_alignment?: string;
  wrap?: boolean;
  fill?: Fill;
}


export class StyleCache {

  /**
   * thanks to
   * http://polymathprogrammer.com/2011/02/15/built-in-styles-for-excel-open-xml/
   */
  public static default_styles: {[index: number]: string} = {
    0:	'General',
    1:	'0',
    2:	'0.00',
    3:	'#,##0',
    4:	'#,##0.00',
    9:	'0%',
    10:	'0.00%',
    11:	'0.00E+00',
    12:	'# ?/?',
    13:	'# ??/??',
    14:	'mm-dd-yy',
    15:	'd-mmm-yy',
    16:	'd-mmm',
    17:	'mmm-yy',
    18:	'h:mm AM/PM',
    19:	'h:mm:ss AM/PM',
    20:	'h:mm',
    21:	'h:mm:ss',
    22:	'm/d/yy h:mm',
    37:	'#,##0 ;(#,##0)',
    38:	'#,##0 ;[Red](#,##0)',
    39:	'#,##0.00;(#,##0.00)',
    40:	'#,##0.00;[Red](#,##0.00)',
    45:	'mm:ss',
    46:	'[h]:mm:ss',
    47:	'mmss.0',
    48:	'##0.0E+0',
    49:	'@',
  };

  public theme = new Theme();

  public cell_xfs: CellXf[] = [];
  public fonts: Font[] = [];
  public borders: BorderStyle[] = [];
  public fills: Fill[] = [];
  public number_formats: NumberFormat[] = [];
  public base_number_format_id = 200; // ?
  public dxf_styles: CellStyle[] = [];

  // public dom?: Tree;

  public modified = false;

  public Clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }

  public TintColor(base: string, tint: number): string {

    let r = parseInt(base.substr(0, 2), 16);
    let g = parseInt(base.substr(2, 2), 16);
    let b = parseInt(base.substr(4, 2), 16);

    if (tint < 0) {
      r = Math.round(r * tint + r);
      g = Math.round(g * tint + g);
      b = Math.round(b * tint + b);
    }
    else {
      r = Math.round((255 - r) * tint + r);
      g = Math.round((255 - g) * tint + g);
      b = Math.round((255 - b) * tint + b);
    }

    return [r, g, b].map((x) => {
      const s = this.Clamp(x, 0, 255).toString(16);
      return s.length < 2 ? ('0' + s) : s;
    }).join('');

  }

  /// 

  public StyleOptionsFromProperties(source: CellStyle): StyleOptions {

    const composite: CellStyle = // Style.Composite(list);
      JSON.parse(JSON.stringify(source));

    for (const key of Object.keys(composite) as PropertyKeys[]) {
      if (composite[key] === 'none') {
        delete composite[key];
      }
    }

    const font: Font = {};
    const fill: Fill = { pattern_type: 'none' };
    const border: BorderStyle = JSON.parse(JSON.stringify(default_border));

    const options: StyleOptions = {
      font, border,
    };

    if (composite.number_format) {

      // we have some symbolic number formats that we'll need to
      // translate. these are defined by the cache.

      options.number_format = { 
        format: NumberFormatCache.Translate(composite.number_format),
        symbolic_name: composite.number_format, // for reference later
      };

    }


    if (composite.font_size?.unit && composite.font_size.value) {
      if (composite.font_size.unit === 'em') {
        font.size = composite.font_size.value * DEFAULT_FONT_SIZE;
      }
      else if (composite.font_size.unit === '%') {
        font.size = composite.font_size.value * DEFAULT_FONT_SIZE / 100;
      }
      else if (composite.font_size.unit === 'pt' ){
        font.size = composite.font_size.value;
      }
      else if (composite.font_size.unit === 'px' ){
        font.size = composite.font_size.value * .75; // ?
      }
      else {
        console.warn(`Unhandled font size unit`, composite.font_size);
      }

    }

    if (composite.bold) font.bold = true;
    if (composite.italic) font.italic = true;
    if (composite.underline) font.underline = true;

    //if (composite.text_color && composite.text_color !== Style.DefaultProperties.text_color) {
    //  font.color_argb = composite.text_color;
    //}

    if (composite.text) {
      if (composite.text.text) {
        font.color_argb = composite.text.text;
      }
      else if (typeof composite.text.theme === 'number') {
        font.color_theme = composite.text.theme;
        if (composite.text.tint) {
          font.color_tint = composite.text.tint;
        }
      }
    }

    const TranslateBorder = (src: CompositeBorderEdge, dest: BorderEdge) => {
      if (src.width) {
        dest.style = 'thin';
        if (src.color.text) {
          dest.rgba =src.color.text;
        }
        else if (typeof src.color.theme === 'number') {
          dest.theme = src.color.theme;
          if (src.color.tint) {
            dest.tint = src.color.tint;
          }
        }
        else {
          dest.color = 64;
        }
      }
    };

    const composite_borders = Style.CompositeBorders(composite);
    TranslateBorder(composite_borders.top, border.top);
    TranslateBorder(composite_borders.left, border.left);
    TranslateBorder(composite_borders.right, border.right);
    TranslateBorder(composite_borders.bottom, border.bottom);

    /*
    if (composite.border_top) { // && composite.border_top_fill) {

      border.top.style = 'thin';
      if (composite.border_top_fill?.text) {
        border.top.rgba = composite.border_top_fill.text;
      }
      else if (typeof composite.border_top_fill?.theme === 'number') {
        border.top.theme = composite.border_top_fill.theme;
        if (composite.border_top_fill.tint) {
          border.top.tint = composite.border_top_fill.tint;
        }
      }
      else {
        border.top.color = 64;
      }
    }
    if (composite.border_bottom) { // && composite.border_bottom_fill) {

      if (composite.border_bottom > 1) {
        border.bottom.style = 'double';
      }
      else {
        border.bottom.style = 'thin';
      }
      if (composite.border_bottom_fill?.text) {
        border.bottom.rgba = composite.border_bottom_fill.text;
      }
      else if (typeof composite.border_bottom_fill?.theme === 'number') {
        border.bottom.theme = composite.border_bottom_fill.theme;
        if (composite.border_bottom_fill.tint) {
          border.bottom.tint = composite.border_bottom_fill.tint;
        }
      }
      else {
        border.bottom.color = 64;
      }
    }
    if (composite.border_left) { // && composite.border_left_fill) {

      border.left.style = 'thin';
      if (composite.border_left_fill?.text) {
        border.left.rgba = composite.border_left_fill.text;
      }
      else if (typeof composite.border_left_fill?.theme === 'number') {
        border.left.theme = composite.border_left_fill.theme;
        if (composite.border_left_fill.tint) {
          border.left.tint = composite.border_left_fill.tint;
        }
      }
      else {
        border.left.color = 64;
      }
    }
    if (composite.border_right) { // && composite.border_right_fill) {

      border.right.style = 'thin';
      if (composite.border_right_fill?.text) {
        border.right.rgba = composite.border_right_fill.text;
      }
      else if (typeof composite.border_right_fill?.theme === 'number') {
        border.right.theme = composite.border_right_fill.theme;
        if (composite.border_right_fill.tint) {
          border.right.tint = composite.border_right_fill.tint;
        }
      }
      else {
        border.right.color = 64;
      }

      // console.info("BXX", JSON.stringify(composite, undefined, 2), JSON.stringify(border, undefined, 2));

    }
    */

    // leave blank for bottom, default

    switch (composite.vertical_align) {
      case 'top': // Style.VerticalAlign.Top:
        options.vertical_alignment = 'top';
        break;
      case 'middle': // Style.VerticalAlign.Middle:
        options.vertical_alignment = 'center';
        break;
    }

    switch (composite.horizontal_align) {
      case 'center': // Style.HorizontalAlign.Center:
        options.horizontal_alignment = 'center';
        break;
      case 'left': // Style.HorizontalAlign.Left:
        options.horizontal_alignment = 'left';
        break;
      case 'right': // Style.HorizontalAlign.Right:
        options.horizontal_alignment = 'right';
        break;
    }

    if (composite.fill) {
      fill.pattern_type = 'solid';
      if (composite.fill.text) {
        fill.fg_color = { argb: composite.fill.text };  
        options.fill = fill;
      }
      else if (typeof composite.fill.theme === 'number') {
        fill.fg_color = { theme: composite.fill.theme };
        if (composite.fill.tint) {
          fill.fg_color.tint = composite.fill.tint;
        }
        options.fill = fill;
      }
      else {
        // fill.fg_color = { theme: 1 };
      }
    }

    if (composite.wrap) {
      options.wrap = true;
    }

    return options;

  }

  ///

  public CellXfToStyle(xf: CellXf): CellStyle {

    const props: CellStyle = {};

    // number format

    let format_string = StyleCache.default_styles[xf.number_format];
    if (!format_string) {
      for (const candidate of this.number_formats) {
        if (candidate.id === xf.number_format) {
          if (candidate.format) {
            format_string = candidate.format;
            break;
          }
        }
      }
    }

    if (format_string) {

      // Excel uses number formats like 

      // #,##0.00\ [$€-40C];[Red]\-#,##0.00\ [$€-40C]
      // [$¥-411]#,##0;[Red]\-[$¥-411]#,##0
      // _("$"* #,##0_);_("$"* \(#,##0\);_("$"* "-"??_);_(@_)

      // where [$¥-411] encodes a yen symbol, [$€-40C] is the euro, &c.
      // I have no idea what that encoding is, or where it comes from
      // (can't find it in Excel documentation; should probably check OOo).

      // for the time being we will just drop, and assume the symbol
      // (in position 2) is correct. are we sure there are always 3 hex
      // characters? and always negative? (...)

      // OK, got it, these are Microsoft LCIDs in hex. so the format seems to be:
      // 
      // square bracket, dollar sign, symbol, hyphen, hex LCID, square bracket
      //
      // we can safely drop this for now, AFAIAC. LCID seems to be (in hex) 
      // usually 3-4 digits, but I suppose lower is conceivable.

      const encoding_regex = /\[\$(.)-[0-9A-Za-z]{1,4}\]/g;
      format_string = format_string.replace(encoding_regex, '$1');

      // there are also locale indicators with no symbol -- we can remove these
      // for now, but we need to consider how to deal with them. (...)

      // also this could be merged with the above.

      const locale_regex = /\[\$-[0-9A-Za-z]{1,4}\]/g;
      format_string = format_string.replace(locale_regex, '');

      props.number_format = format_string;
    }

    // font attributes (atm we are ignoring size, face)

    const base_font = this.fonts[0];
    const font = this.fonts[xf.font || 0];

    if (font) {
      if (font.bold) props.bold = true;
      if (font.italic) props.italic = true;
      if (font.underline) props.underline = true;
      if (font.strike) props.strike = true;

      // implement font size... experimental. treat font size as % of 
      // base size, which we assume is in slot 0.

      if (base_font && base_font.size && font.size && base_font.size !== font.size) {
        props.font_size = {
          value: 100 * font.size / base_font.size,
          unit: '%',
        };
      }

      if (font.color_argb) {
        props.text = { 
          text: '#' + (
            font.color_argb.length > 6 ?
            font.color_argb.substr(font.color_argb.length - 6) :
            font.color_argb)
        };
      }

      else if (typeof font.color_theme === 'number') {

        // const index = Theme.color_map[];

        // skipping 0, it's implicit
        // no it is not (1 is implicit?)

        props.text = { theme: font.color_theme };

        /*
        // FIXME: update to theme
        console.warn('update to theme colors');

        const index = Theme.color_map[font.color_theme];
        const color = this.theme.colors[index];

        // why was I _not_ accepting system here? (...) there's an argument
        // against system 1 -> default... 
        
        if (color && color.type !== 'system' && color.value) {
          if (typeof font.color_tint === 'number') {
            props.text = '#' + this.TintColor(color.value, font.color_tint);
          }
          else {
            props.text = '#' + color.value;
          }
        }

        else if (color && color.type === 'system' && color.value) {

          // let's drop color index 1, as that should be default? (...)
          // should do this higher up

          if (font.color_theme !== 1) {
            props.text = '#' + color.value;
          }
        }
        */

      }

    }

    const fill = this.fills[xf.fill || 0];
    if (fill && fill.pattern_type !== 'none') {

      if (fill.pattern_type === 'gray') {
        const value = Math.round((fill.pattern_gray || 0) / 1000 * 255);
        // props.background = `rgb(${value}, ${value}, ${value})`;
        props.fill = { text: `rgb(${value}, ${value}, ${value})` };
      }
      if (fill.pattern_type === 'solid') {
        if (fill.fg_color) {
          if (fill.fg_color.argb) {
            props.fill = { text: '#' + (
                fill.fg_color.argb.length > 6 ?
                fill.fg_color.argb.substr(fill.fg_color.argb.length - 6) :
                fill.fg_color.argb)
              };
          }
          else if (typeof fill.fg_color.theme === 'number') {

            props.fill = { 
              theme: fill.fg_color.theme,
              // tint: fill.fg_color.tint,
            };

            if (fill.fg_color.tint) {
              props.fill.tint = Math.round(fill.fg_color.tint * 1000) / 1000;
            }

            /*
            const index = Theme.color_map[fill.fg_color.theme];
            const color = this.theme.colors[index];
            // if (color && color.type !== 'system' && color.value) {
            if (color && color.value) {
              if (typeof fill.fg_color.tint === 'number') {
                props.background = '#' + this.TintColor(color.value, fill.fg_color.tint);
              }
              else {
                props.background = '#' + color.value;
              }
            }
            */

          }
        }
      }
    }

    // alignments (TODO: valign)

    switch (xf.horizontal_alignment) {
      case 'center':
        props.horizontal_align = 'center'; // Style.HorizontalAlign.Center;
        break;
      case 'right':
        props.horizontal_align = 'right'; // Style.HorizontalAlign.Right;
        break;
      case 'left':
        props.horizontal_align = 'left'; // Style.HorizontalAlign.Left;
        break;
    }

    switch (xf.vertical_alignment) {
      case 'center':
        props.vertical_align = 'middle'; // Style.VerticalAlign.Middle;
        break;
      case 'top':
        props.vertical_align = 'top'; // Style.VerticalAlign.Top;
        break;
      case 'bottom':
        props.vertical_align = 'bottom'; // Style.VerticalAlign.Bottom;
        break;
    }

    // wrap

    if (xf.wrap_text) {
      props.wrap = true;
    }

    // borders

    const border = this.borders[xf.border || 0];
    if (border) {
      if (border.bottom.style) {
        if (border.bottom.style === 'double') {
          props.border_bottom = 2;
        }
        else {
          props.border_bottom = 1;
        }
      }
      if (border.left.style) props.border_left = 1;
      if (border.top.style) props.border_top = 1;
      if (border.right.style) props.border_right = 1;
    }

    return props;
  }

  /** map all cell xfs to styles; retain order */
  public CellXfToStyles(): CellStyle[] {
    return this.cell_xfs.map((xf) => this.CellXfToStyle(xf));
  }


  public EnsureNumberFormat(number_format: NumberFormat): number {

    // there are a lot of default, implicit number formats.
    // we should probably find out what they are. for the time
    // being, just use 0 for no properties.

    if (typeof number_format.format === 'undefined') return 0;

    // we changed the casing on this at some point, so let's be
    // broad here. general is important because it has the magic
    // decimal point, we don't want to revert to an explicit style
    // because there's no description syntax for that

    if (number_format.symbolic_name) {
      if (/^general$/i.test(number_format.symbolic_name)) {
        return 0;
      }
    }

    // check the rest of the built-in types... note this is not an array?
    // (why not?) also, is the length guaranteed?

    for (let i = 0; i < 100; i++) {
      const check = StyleCache.default_styles[i];
      if (check && check === number_format.format) {
        return i;
      }
    }

    for (const candidate of this.number_formats) {
      if (candidate.format === number_format.format) return candidate.id || 0;
    }

    this.modified = true;

    const new_format = {
      id: this.base_number_format_id++,
      format: number_format.format,
    };
    this.number_formats.push(new_format);

    /*
    if (!this.dom) throw new Error('missing dom');
    let number_formats = this.dom.find('./numFmts');

    if (!number_formats){
      number_formats = Element('numFmts', {count: '1'});
      const root = this.dom.getroot();
      (root as any)._children = [number_formats].concat((root as any)._children);
      // this.dom.getroot().append(number_formats);
    }
    else {
      number_formats.attrib.count = (Number(number_formats.attrib.count || 0) + 1).toString();
    }

    number_formats.append(Element('numFmt', {
      numFmtId: new_format.id.toString(),
      formatCode: new_format.format,
    }));
    */

    return new_format.id;

  }

  public CompareBorderEdge(a: BorderEdge, b: BorderEdge) {
    return a.color === b.color
      && a.rgba === b.rgba
      && a.style === b.style
      && a.theme === b.theme
      && a.tint === b.tint;
  }

  public CompareBorder(a: BorderStyle, b: BorderStyle) {
    return this.CompareBorderEdge(a.top, b.top)
      && this.CompareBorderEdge(a.left, b.left)
      && this.CompareBorderEdge(a.bottom, b.bottom)
      && this.CompareBorderEdge(a.right, b.right)
      && this.CompareBorderEdge(a.diagonal, b.diagonal);
  }

  public EnsureBorder(border: BorderStyle): number {

    for (let i = 0; i < this.borders.length; i++ ){
      const candidate = this.borders[i];

      if (this.CompareBorder(candidate, border)){
        return i;
      }

    }
    
    this.modified = true;

    const new_border: BorderStyle = JSON.parse(JSON.stringify(border)); // {...border};
    this.borders.push(new_border);

    /*

    if (!this.dom) throw new Error('missing dom');
    const borders = this.dom.find('./borders');

    if (!borders) throw new Error('borders not found');
    borders.attrib.count = (Number(borders.attrib.count || 0) + 1).toString();

    const new_element = Element('border');

    const left = Element('left');
    if (border.left_style) {
      left.attrib.style = border.left_style;
      // left.append(Element('color', {indexed: (border.left_color || 0).toString() }));
      const attrs: ColorAttributes = {};
      if (border.left_color_rgba) {
        attrs.rgb = border.left_color_rgba;
      }
      else if (typeof border.left_color_theme === 'number') {
        attrs.theme = border.left_color_theme.toString();
        if (border.left_color_tint) {
          attrs.tint = border.left_color_tint.toString();
        }
      }
      else {
        attrs.indexed = (border.left_color || 0).toString();
      } 
      left.append(Element('color', attrs as ElementTree.Attributes));
    }
    new_element.append(left);

    const right = Element('right');
    if (border.right_style) {
      right.attrib.style = border.right_style;
      // right.append(Element('color', {indexed: (border.right_color || 0).toString() }));
      const attrs: ColorAttributes = {};
      if (border.right_color_rgba) {
        attrs.rgb = border.right_color_rgba;
      }
      else if (typeof border.right_color_theme === 'number') {
        attrs.theme = border.right_color_theme.toString();
        if (border.right_color_tint) {
          attrs.tint = border.right_color_tint.toString();
        }
      }
      else {
        attrs.indexed = (border.right_color || 0).toString();
      } 
      right.append(Element('color', attrs as ElementTree.Attributes));

    }
    new_element.append(right);

    const top = Element('top');
    if (border.top_style) {
      top.attrib.style = border.top_style;
      const attrs: ColorAttributes = {};
      if (border.top_color_rgba) {
        attrs.rgb = border.top_color_rgba;
      }
      else if (typeof border.top_color_theme === 'number') {
        attrs.theme = border.top_color_theme.toString();
        if (border.top_color_tint) {
          attrs.tint = border.top_color_tint.toString();
        }
      }
      else {
        attrs.indexed = (border.top_color || 0).toString();
      } 
      top.append(Element('color', attrs as ElementTree.Attributes));
    }
    new_element.append(top);

    const bottom = Element('bottom');
    if (border.bottom_style) {

      // console.info("BOTTOM STYLE", border);

      bottom.attrib.style = border.bottom_style;
      // bottom.append(Element('color', {indexed: (border.bottom_color || 0).toString() }));
      const attrs: ColorAttributes = {};
      if (border.bottom_color_rgba) {
        attrs.rgb = border.bottom_color_rgba;
      }
      else if (typeof border.bottom_color_theme === 'number') {
        attrs.theme = border.bottom_color_theme.toString();
        if (border.bottom_color_tint) {
          attrs.tint = border.bottom_color_tint.toString();
        }
      }
      else {
        attrs.indexed = (border.bottom_color || 0).toString();
      } 
      bottom.append(Element('color', attrs as ElementTree.Attributes));
    }
    new_element.append(bottom);

    const diagonal = Element('diagonal');
    if (border.diagonal_style) {
      diagonal.attrib.style = border.diagonal_style;
      diagonal.append(Element('color', {indexed: (border.diagonal_color || 0).toString() }));
    }
    new_element.append(diagonal);

    borders.append(new_element);
    */

    return this.borders.length - 1;
  }


  public MatchColor(a: XlColor|undefined, b: XlColor|undefined): boolean {

    if (!a && !b) { return true; }
    if (!a || !b) { return false; }

    return ( a.argb === b.argb
          && a.indexed === b.indexed
          && a.theme === b.theme
          && a.tint === b.tint);

  }

  public EnsureFill(fill: Fill): number {

    for (let i = 0; i < this.fills.length; i++) {
      const candidate = this.fills[i];
      if ( this.MatchColor(fill.bg_color, candidate.bg_color)
        && this.MatchColor(fill.fg_color, candidate.fg_color)
        && fill.pattern_gray === candidate.pattern_gray
        && fill.pattern_type === candidate.pattern_type ) {
        return i;
      }
    }

    this.modified = true;

    const new_fill: Fill = {...fill};
    this.fills.push(new_fill);

    /*
    // add the node structure

    if (!this.dom) throw new Error('missing dom');
    const fills = this.dom.find('./fills');

    if (!fills) throw new Error('fills not found');
    fills.attrib.count = (Number(fills.attrib.count || 0) + 1).toString();

    const new_element = Element('fill');
    const pattern_fill = Element('patternFill', { patternType: fill.pattern_type });

    switch (fill.pattern_type) {
      case 'none':
        break;
      case 'solid':
        if (fill.fg_color) {
          const attrs: Record<string, string> = {};

          if (fill.fg_color.argb) { attrs.rgb = fill.fg_color.argb; }
          if (fill.fg_color.indexed) { attrs.indexed = fill.fg_color.indexed.toString(); }
          if (fill.fg_color.tint) { attrs.tint = fill.fg_color.tint.toString(); }
          if (typeof fill.fg_color.theme !== 'undefined') { attrs.theme = fill.fg_color.theme.toString(); }

          pattern_fill.append(Element('fgColor', attrs));
        }
        break;
      case 'gray':

        // ...

        break;
    }

    new_element.append(pattern_fill);

    fills.append(new_element);
    */

    return this.fills.length - 1;
  }

  /**
   * for the time being we are ignoring font face, family, size, color and
   * scheme (whatever that is). every font is based on font 0, the default.
   * we add bold/italic/underline as necessary.
   */
  public EnsureFont(font: Font): number {

    // this is what we create, so we need to test against it

    const composite_font: Font = {...this.fonts[0], ...font};

    // const props = Object.keys(font).filter((key) => typeof (font as any)[key] !== 'undefined');
    for (let i = 0; i < this.fonts.length; i++ ){
      const candidate = this.fonts[i];
      //let match = true;
      //for (const prop of props) {
      //  match = match && (font as any)[prop] === (candidate as any)[prop];
      //}

      const match = (candidate.bold === composite_font.bold) 
        && (candidate.italic === composite_font.italic)
        && (candidate.underline === composite_font.underline)
        && (candidate.size === composite_font.size)
        && (candidate.strike === composite_font.strike)
        && (candidate.color_argb === composite_font.color_argb)
        && (candidate.color_theme === composite_font.color_theme)
        && (candidate.color_tint === composite_font.color_tint)
        && (candidate.family === composite_font.family);

      if (match) {
        return i;
      }

    }

    this.modified = true;

    // const composite_font = test; // {...this.fonts[0], ...font};
    this.fonts.push(composite_font);

    /*
    // add the node structure

    if (!this.dom) throw new Error('missing dom');
    const fonts = this.dom.find('./fonts');

    if (!fonts) throw new Error('fonts not found');
    fonts.attrib.count = (Number(fonts.attrib.count || 0) + 1).toString();

    const new_element = Element('font');
    new_element.append(Element('sz', { val: (composite_font.size || 0).toString() }));

    // new_element.append(Element('color', { theme: (new_font.color_theme || 0).toString() }));
    // new_element.append(Element('color', { theme: (new_font.color_theme || 0).toString() }));

    if (typeof composite_font.color_argb !== 'undefined') {
      new_element.append(Element('color', { rgb: composite_font.color_argb }));
    }
    else {
      new_element.append(Element('color', { theme: (composite_font.color_theme || 0).toString() }));
    }

    new_element.append(Element('name', { val: composite_font.name }));
    new_element.append(Element('family', { val: (composite_font.family || 0).toString() }));
    new_element.append(Element('scheme', { val: composite_font.scheme }));

    if (composite_font.bold) new_element.append(Element('b'));
    if (composite_font.underline) new_element.append(Element('u'));
    if (composite_font.italic) new_element.append(Element('i'));
    if (composite_font.strike) new_element.append(Element('strike'));

    fonts.append(new_element);
    */

    return this.fonts.length - 1;

  }

  public EnsureStyle(options: StyleOptions): number {

    // find indexes for props
    const font_index = this.EnsureFont(options.font || {});
    const border_index = this.EnsureBorder(options.border || default_border);
    const number_format_index = this.EnsureNumberFormat(options.number_format || {});
    const fill_index = this.EnsureFill(options.fill || { pattern_type: 'none' });

    // now find an XF that matches
    for (let i = 0; i < this.cell_xfs.length; i++){
      const xf = this.cell_xfs[i];
      if (xf.font === font_index &&
          xf.fill === fill_index &&
          xf.border === border_index &&
          xf.number_format === number_format_index &&
          !!xf.wrap_text === !!options.wrap &&
          ((!options.horizontal_alignment && !xf.horizontal_alignment) || options.horizontal_alignment === xf.horizontal_alignment) &&
          ((!options.vertical_alignment && !xf.vertical_alignment) || options.vertical_alignment === xf.vertical_alignment)) {
          
        return i;
      }
    }

    this.modified = true;

    // need a new XF -- defaults?
    const new_xf: CellXf = {
      font: font_index,
      fill: fill_index,
      border: border_index,
      number_format: number_format_index,
    };

    if (options.horizontal_alignment) {
      new_xf.horizontal_alignment = options.horizontal_alignment;
    }
    if (options.vertical_alignment) {
      new_xf.vertical_alignment = options.vertical_alignment;
    }
    if (options.wrap) {
      new_xf.wrap_text = true;
    }

    this.cell_xfs.push(new_xf);

    /*

    // add the node structure

    if (!this.dom) throw new Error('missing dom');
    const xfs = this.dom.find('./cellXfs');

    if (!xfs) throw new Error('xfs not found');
    xfs.attrib.count = (Number(xfs.attrib.count || 0) + 1).toString();

    const new_element = Element('xf', {
      borderId: new_xf.border.toString(),
      fillId: new_xf.fill.toString(),
      fontId: new_xf.font.toString(),
      numFmtId: new_xf.number_format.toString(),
    });

    if (new_xf.horizontal_alignment || new_xf.vertical_alignment) {
      const attrs: {[index: string]: string} = {};
      if (new_xf.horizontal_alignment) {
        attrs.horizontal = new_xf.horizontal_alignment;
      }
      if (new_xf.vertical_alignment) {
        attrs.vertical = new_xf.vertical_alignment;
      }
      if (new_xf.wrap_text) {
        attrs.wrapText = '1';
      }
      new_element.append(Element('alignment', attrs));
    }

    if (typeof new_xf.xfid !== 'undefined') {
      new_element.attrib.xfId = new_xf.xfid.toString();
    }

    xfs.append(new_element);
    */

    return this.cell_xfs.length - 1;

  }

  public FromXML(xml: any, theme: Theme): void {

    const FindAll = XMLUtils.FindAll.bind(XMLUtils, xml);

    this.theme = theme;

    // ---

    let composite = FindAll('styleSheet/numFmts/numFmt');

    this.number_formats = composite.map(element => ({
        id: Number(element.a$?.numFmtId || 0),
        format: Unescape(element.a$?.formatCode || ''),
      }));

    // ---

    composite = FindAll('styleSheet/borders/border');

    this.borders = composite.map(element => {

      const border: BorderStyle = JSON.parse(JSON.stringify(default_border));

      // we're relying on these being empty strings -> falsy, not a good look

      if (element.left) {
        border.left.style = element.left.a$.style;
        border.left.color = Number(element.left.color?.a$?.indexed);
      }

      if (element.right) {
        border.right.style = element.right.a$.style;
        border.right.color = Number(element.right.color?.a$?.indexed);
      }

      if (element.top) {
        border.top.style = element.top.a$.style;
        border.top.color = Number(element.top.color?.a$?.indexed);
      }

      if (element.bottom) {
        border.bottom.style = element.bottom.a$.style;
        border.bottom.color = Number(element.bottom.color?.a$?.indexed);
      }
      
      return border;

    });

    // ---

    composite = FindAll('styleSheet/cellXfs/xf');
    this.cell_xfs = composite.map(element => {

      const xf: CellXf = {
        number_format: Number(element.a$.numFmtId),
        font: Number(element.a$.fontId),
        fill: Number(element.a$.fillId),
        border: Number(element.a$.borderId),
        xfid: Number(element.a$.xfId),
      };

      if (element.alignment) {
        xf.horizontal_alignment = element.alignment.a$.horizontal;
        xf.vertical_alignment = element.alignment.a$.vertical;
        xf.wrap_text = !!element.alignment.a$.wrapText;
      }

      return xf;

    });

    // ---

    const ParseFill = (element: any) => {

      const fill: Fill = { pattern_type: 'none' };
      if (element.patternFill) {
        const type = element.patternFill.a$?.patternType;
        switch (type) {
          case 'none':
          case undefined:
            break;

          case 'solid':
            fill.pattern_type = 'solid';
            if (element.patternFill.fgColor) {
              fill.fg_color = {
                theme: element.patternFill.fgColor.a$?.theme ? Number(element.patternFill.fgColor.a$.theme) : undefined,
                indexed: element.patternFill.fgColor.a$?.indexed ? Number(element.patternFill.fgColor.a$.indexed) : undefined,
                tint: element.patternFill.fgColor.a$?.tint ? Number(element.patternFill.fgColor.a$.tint) : undefined,
                argb: element.patternFill.fgColor.a$?.rgb,
              };
            }
            break;

          default:
            {
              const match = type?.match(/^gray(\d+)$/);
              if (match) {
                fill.pattern_type = 'gray';
                fill.pattern_gray = Number(match[1]);
                break;
              }
            }

        }
      }

      return fill;

    };

    composite = FindAll('styleSheet/fills/fill');

    this.fills = composite.map(ParseFill);

    // ---

    const ParseFont = (element: any) => {

      const font: Font = {};

      font.italic = !!(typeof element.i !== 'undefined');
      font.bold = !!(typeof element.b !== 'undefined');
      font.underline = !!(typeof element.u !== 'undefined');
      font.strike = !!(typeof element.strike !== 'undefined');

      if (element.sz) {
        font.size = Number(element.sz.a$.val);
      }
      if (element.scheme) {
        font.scheme = element.scheme.a$.val;
      }
      if (element.name) {
        font.name = element.name.a$.val;
      }
      if (element.family) {
        font.family = Number(element.family.a$.val);
      }
      
      if (element.color) {
        if (element.color.a$?.theme) {
          font.color_theme = Number(element.color.a$.theme);
        }
        if (element.color.a$?.tint) {
          font.color_tint = Number(element.color.a$.tint);
        }
        if (element.color.a$?.rgb) {
          font.color_argb = element.color.a$.rgb;
        }
      }

      return font;

    };

    composite = FindAll('styleSheet/fonts/font');
    this.fonts = composite.map(ParseFont);

    // dxfs (differential formats) are inline. because reasons? not sure
    // what's allowed in there, atm we're just looking at font color and 
    // background color.

    const ParseDXFColor = (element: any) => {
      const color: Color = {};
      if (element.a$.rgb) {
        color.text = '#' + element.a$.rgb.substring(2);
      }
      else if (element.a$.theme) {
        color.theme = Number(element.a$.theme) || 0;
        if (element.a$.tint) {
          color.tint = Math.round(element.a$.tint * 1000) / 1000;
        }
      }
      return color;
    };

    const dxfs = FindAll('styleSheet/dxfs/dxf');
    this.dxf_styles = dxfs.map(dxf => {

      const style: CellStyle = {};

      // dxf fonts are different too? this is irritating

      if (dxf.font) {
        style.bold = !!dxf.font.b;
        style.italic = !!dxf.font.i && dxf.font.i.a$.val !== '0';
      }

      // dxfs fills are different? anyway we can't reuse the above code for fill, just grab the color
     
      if (dxf.font?.color?.a$) {
        style.text = ParseDXFColor(dxf.font.color);
      }
      if (dxf.fill?.patternFill?.bgColor?.a$) {
        style.fill = ParseDXFColor(dxf.fill.patternFill.bgColor);
      }

      return style;
    });

    // console.info({dxfs: this.dxf_styles});

  }

}
