
import * as ElementTree from 'elementtree';
import { Element, ElementTree as Tree } from 'elementtree';
import { Style } from 'treb-base-types';
import { Theme } from './theme';
import { NumberFormatCache } from 'treb-format';

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
}

export interface NumberFormat {
  id?: number;
  format?: string;
}

export interface Fill {
  color_argb?: string;
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

/**
 * this is flat so we can map/copy better, even thought it makes
 * more sense as a map of simple objects
 */
export interface BorderStyle {
  left_style?: string; // 'thin' | ??
  left_color?: number; // indexed // FIXME: argb

  right_style?: string;
  right_color?: number;

  top_style?: string;
  top_color?: number;

  bottom_style?: string;
  bottom_color?: number;

  diagonal_style?: string;
  diagonal_color?: number;
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

  public dom?: Tree;

  public modified = false;

  public Clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(value, max));
  }

  public TintColor(base: string, tint: number) {

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

  public StyleOptionsFromProperties(source: Style.Properties): StyleOptions {

    const composite: Style.Properties = // Style.Composite(list);
      JSON.parse(JSON.stringify(source));

    for (const key of Object.keys(composite) as Style.PropertyKeys[]) {
      if (composite[key] === 'none') {
        delete composite[key];
      }
    }

    const font: Font = {};
    const fill: Fill = {};
    const border: BorderStyle = {};
    const options: StyleOptions = {
      font, border,
    };

    if (composite.number_format) {

      // we have some symbolic number formats that we'll need to
      // translate. these are defined by the cache.

      options.number_format = { format: NumberFormatCache.Translate(composite.number_format) };
    }

    if (composite.font_bold) font.bold = true;
    if (composite.font_italic) font.italic = true;
    if (composite.font_underline) font.underline = true;
    if (composite.text_color && composite.text_color !== Style.DefaultProperties.text_color) {
      font.color_argb = composite.text_color;
    }

    if (composite.border_top) {
      border.top_color = 64;
      border.top_style = 'thin';
    }
    if (composite.border_bottom) {
      border.bottom_color = 64;
      if (composite.border_bottom > 1) {
        border.bottom_style = 'double';
      }
      else {
        border.bottom_style = 'thin';
      }
    }
    if (composite.border_left) {
      border.left_color = 64;
      border.left_style = 'thin';
    }
    if (composite.border_right) {
      border.right_color = 64;
      border.right_style = 'thin';
    }

    // leave blank for bottom, default

    switch (composite.vertical_align) {
      case Style.VerticalAlign.Top:
        options.vertical_alignment = 'top';
        break;
      case Style.VerticalAlign.Middle:
        options.vertical_alignment = 'center';
        break;
    }

    switch (composite.horizontal_align) {
      case Style.HorizontalAlign.Center:
        options.horizontal_alignment = 'center';
        break;
      case Style.HorizontalAlign.Left:
        options.horizontal_alignment = 'left';
        break;
      case Style.HorizontalAlign.Right:
        options.horizontal_alignment = 'right';
        break;
    }

    if (composite.background) {
      fill.color_argb = composite.background;
      options.fill = fill;
    }

    if (composite.wrap) {
      options.wrap = true;
    }

    return options;

  }

  ///

  public CellXfToStyle(xf: CellXf): Style.Properties {

    const props: Style.Properties = {};

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

    const font = this.fonts[xf.font || 0];
    if (font) {
      if (font.bold) props.font_bold = true;
      if (font.italic) props.font_italic = true;
      if (font.underline) props.font_underline = true;
      if (font.color_argb) {
        props.text_color = '#' + (
          font.color_argb.length > 6 ?
          font.color_argb.substr(font.color_argb.length - 6) :
          font.color_argb);
      }
      else if (typeof font.color_theme === 'number') {
        const index = Theme.color_map[font.color_theme];
        const color = this.theme.colors[index];
        if (color && color.type !== 'system' && color.value) {
          if (typeof font.color_tint === 'number') {
            props.text_color = '#' + this.TintColor(color.value, font.color_tint);
          }
          else {
            props.text_color = '#' + color.value;
          }
        }
      }
    }

    // alignments (TODO: valign)

    switch (xf.horizontal_alignment) {
      case 'center':
        props.horizontal_align = Style.HorizontalAlign.Center;
        break;
      case 'right':
        props.horizontal_align = Style.HorizontalAlign.Right;
        break;
      case 'left':
        props.horizontal_align = Style.HorizontalAlign.Left;
        break;
    }

    switch (xf.vertical_alignment) {
      case 'center':
        props.vertical_align = Style.VerticalAlign.Middle;
        break;
      case 'top':
        props.vertical_align = Style.VerticalAlign.Top;
        break;
      case 'bottom':
        props.vertical_align = Style.VerticalAlign.Bottom;
        break;
    }

    // wrap

    if (xf.wrap_text) {
      props.wrap = true;
    }

    // borders

    const border = this.borders[xf.border || 0];
    if (border) {
      if (border.bottom_style) {
        if (border.bottom_style === 'double') {
          props.border_bottom = 2;
        }
        else {
          props.border_bottom = 1;
        }
      }
      if (border.left_style) props.border_left = 1;
      if (border.top_style) props.border_top = 1;
      if (border.right_style) props.border_right = 1;
    }

    return props;
  }

  /** map all cell xfs to styles; retain order */
  public CellXfToStyles() {
    return this.cell_xfs.map((xf) => this.CellXfToStyle(xf));
  }

  public EnsureNumberFormat(number_format: NumberFormat) {

    // there are a lot of default, implicit number formats.
    // we should probably find out what they are. for the time
    // being, just use 0 for no properties.

    if (typeof number_format.format === 'undefined') return 0;

    for (const candidate of this.number_formats) {
      if (candidate.format === number_format.format) return candidate.id || 0;
    }

    this.modified = true;

    const new_format = {
      id: this.base_number_format_id++,
      format: number_format.format,
    };
    this.number_formats.push(new_format);

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

    return new_format.id;

  }

  public EnsureBorder(border: BorderStyle) {

    const props = Object.keys(border).filter((key) => typeof (border as any)[key] !== 'undefined');
    const prop_count = Object.keys(props).length;

    for (let i = 0; i < this.borders.length; i++ ){
      const candidate = this.borders[i];

      // this matches the existing props but ignores _other_ props, which is bad.
      // need to add another check. length should do it.
      //
      // FIXME: is any other routine doing it the same way?
      // TODO: check

      if (Object.keys(candidate).length === prop_count) {

        let match = true;
        for (const prop of props) {
          match = match && (border as any)[prop] === (candidate as any)[prop];
        }
        if (match) {
          return i;
        }
      }

    }

    this.modified = true;

    const new_border: BorderStyle = {...border};
    this.borders.push(new_border);

    if (!this.dom) throw new Error('missing dom');
    const borders = this.dom.find('./borders');

    if (!borders) throw new Error('borders not found');
    borders.attrib.count = (Number(borders.attrib.count || 0) + 1).toString();

    const new_element = Element('border');

    const left = Element('left');
    if (border.left_style) {
      left.attrib.style = border.left_style;
      left.append(Element('color', {indexed: (border.left_color || 0).toString() }));
    }
    new_element.append(left);

    const right = Element('right');
    if (border.right_style) {
      right.attrib.style = border.right_style;
      right.append(Element('color', {indexed: (border.right_color || 0).toString() }));
    }
    new_element.append(right);

    const top = Element('top');
    if (border.top_style) {
      top.attrib.style = border.top_style;
      top.append(Element('color', {indexed: (border.top_color || 0).toString() }));
    }
    new_element.append(top);

    const bottom = Element('bottom');
    if (border.bottom_style) {
      bottom.attrib.style = border.bottom_style;
      bottom.append(Element('color', {indexed: (border.bottom_color || 0).toString() }));
    }
    new_element.append(bottom);

    const diagonal = Element('diagonal');
    if (border.diagonal_style) {
      diagonal.attrib.style = border.diagonal_style;
      diagonal.append(Element('color', {indexed: (border.diagonal_color || 0).toString() }));
    }
    new_element.append(diagonal);

    borders.append(new_element);

    return this.borders.length - 1;
  }

  public EnsureFill(fill: Fill) {

    const props = Object.keys(fill).filter((key) => typeof (fill as any)[key] !== 'undefined');
    for (let i = 0; i < this.fills.length; i++ ){
      const candidate = this.fills[i];

      let match = true;
      for (const prop of props) {
        match = match && (fill as any)[prop] === (candidate as any)[prop];
      }
      if (match) {
        return i;
      }
    }

    this.modified = true;

    const new_fill: Fill = {...fill};
    this.fills.push(new_fill);

    // add the node structure

    if (!this.dom) throw new Error('missing dom');
    const fills = this.dom.find('./fills');

    if (!fills) throw new Error('fills not found');
    fills.attrib.count = (Number(fills.attrib.count || 0) + 1).toString();

    const new_element = Element('fill');
    const pattern_fill = Element('patternFill', { patternType: 'solid' });
    new_element.append(pattern_fill);

    pattern_fill.append(Element('fgColor', { rgb: fill.color_argb }));
    // pattern_fill.append(Element('bgColor', { indexed: '64' }));

    fills.append(new_element);
    return this.fills.length - 1;
  }

  /**
   * for the time being we are ignoring font face, family, size, color and
   * scheme (whatever that is). every font is based on font 0, the default.
   * we add bold/italic/underline as necessary.
   */
  public EnsureFont(font: Font){

    const props = Object.keys(font).filter((key) => typeof (font as any)[key] !== 'undefined');
    for (let i = 0; i < this.fonts.length; i++ ){
      const candidate = this.fonts[i];
      let match = true;
      for (const prop of props) {
        match = match && (font as any)[prop] === (candidate as any)[prop];
      }
      if (match) {
        return i;
      }
    }

    this.modified = true;

    const new_font: Font = {...this.fonts[0], ...font};
    this.fonts.push(new_font);

    // add the node structure

    if (!this.dom) throw new Error('missing dom');
    const fonts = this.dom.find('./fonts');

    if (!fonts) throw new Error('fonts not found');
    fonts.attrib.count = (Number(fonts.attrib.count || 0) + 1).toString();

    const new_element = Element('font');
    new_element.append(Element('sz', { val: (new_font.size || 0).toString() }));

    // new_element.append(Element('color', { theme: (new_font.color_theme || 0).toString() }));
    // new_element.append(Element('color', { theme: (new_font.color_theme || 0).toString() }));

    if (typeof new_font.color_argb !== 'undefined') {
      new_element.append(Element('color', { rgb: new_font.color_argb }));
    }
    else {
      new_element.append(Element('color', { theme: (new_font.color_theme || 0).toString() }));
    }

    new_element.append(Element('name', { val: new_font.name }));
    new_element.append(Element('family', { val: (new_font.family || 0).toString() }));
    new_element.append(Element('scheme', { val: new_font.scheme }));

    if (new_font.bold) new_element.append(Element('b'));
    if (new_font.underline) new_element.append(Element('u'));
    if (new_font.italic) new_element.append(Element('i'));

    fonts.append(new_element);

    return this.fonts.length - 1;

  }


  public EnsureStyle(options: StyleOptions) {

    // find indexes for props
    const font_index = this.EnsureFont(options.font || {});
    const border_index = this.EnsureBorder(options.border || {});
    const number_format_index = this.EnsureNumberFormat(options.number_format || {});
    const fill_index = this.EnsureFill(options.fill || {});

    // now find an XF that matches
    for (let i = 0; i < this.cell_xfs.length; i++){
      const xf = this.cell_xfs[i];
      if (xf.font === font_index &&
          xf.fill === fill_index &&
          xf.border === border_index &&
          xf.number_format === number_format_index &&
          !!xf.wrap_text === !!options.wrap &&
          (!options.horizontal_alignment || options.horizontal_alignment === xf.horizontal_alignment) &&
          (!options.vertical_alignment || options.vertical_alignment === xf.vertical_alignment)) {
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

    return this.cell_xfs.length - 1;

  }

  public Init(data: string, theme: Theme){

    this.theme = theme;

    this.dom = ElementTree.parse(data);

    this.number_formats = this.dom.findall('./numFmts/numFmt').map((element) => {
      const number_format: NumberFormat = {
        id: Number(element.attrib.numFmtId),
        format: element.attrib.formatCode,
      };
      return number_format;
    });

    this.borders = this.dom.findall('./borders/border').map((element) => {
      const border: BorderStyle = {};
      for (const child of element.getchildren()){
        const style: string|undefined = child.attrib.style;
        const child_color = child.getchildren()[0];
        let color_index: number|undefined;

        if (child_color && child_color.tag === 'color') {
          if (child_color.attrib.indexed) {
            color_index = Number(child_color.attrib.indexed);
          }
        }

        if (style && typeof color_index !== 'undefined') {
          switch (child.tag) {
          case 'left':
            border.left_style = style;
            border.left_color = color_index;
            break;
          case 'right':
            border.right_style = style;
            border.right_color = color_index;
            break;
          case 'top':
            border.top_style = style;
            border.top_color = color_index;
            break;
          case 'bottom':
            border.bottom_style = style;
            border.bottom_color = color_index;
            break;
          case 'diagonal':
            border.diagonal_style = style;
            border.diagonal_color = color_index;
            break;
          }
        }
      }
      return border;
    });

    this.cell_xfs = this.dom.findall('./cellXfs/xf').map((element, index) => {
      const xf: CellXf = {
        number_format: Number(element.attrib.numFmtId),
        font: Number(element.attrib.fontId),
        fill: Number(element.attrib.fillId),
        border: Number(element.attrib.borderId),
        xfid: Number(element.attrib.xfId),
      };

      for (const child of element.getchildren()) {
        if (child.tag === 'alignment') {
          if (child.attrib.horizontal) {
            xf.horizontal_alignment = child.attrib.horizontal;
            if (child.attrib.wrapText) {
              xf.wrap_text = true;
            }
          }
          if (child.attrib.vertical) {
            xf.vertical_alignment = child.attrib.vertical;
          }
        }
      }

      return xf;
    });

    this.fills = this.dom.findall('./fills/fill').map((element) => {
      const fill: Fill = {};
      for (const child of element.getchildren()){
        switch (child.tag) {
          case 'fgColor':
            {
              const argb = child.attrib.rgb;
              const indexed = child.attrib.indexed;
              if (typeof argb !== 'undefined') fill.color_argb = argb;
            }
            break;
        }
      }
      return fill;
    });

    this.fonts = this.dom.findall('./fonts/font').map((element) => {
      const font: Font = {};
      for (const child of element.getchildren()){
        switch (child.tag) {
          case 'sz':
            font.size = Number(child.attrib.val);
            break;
          case 'color':
            if (child.attrib.theme) font.color_theme = Number(child.attrib.theme);
            if (child.attrib.tint) font.color_tint = Number(child.attrib.tint);
            if (child.attrib.rgb) font.color_argb = child.attrib.rgb;
            break;
          case 'name':
            font.name = child.attrib.val;
            break;
          case 'family':
            font.family = Number(child.attrib.val);
            break;
          case 'scheme':
            font.scheme = child.attrib.val;
            break;
          case 'b':
            font.bold = true;
            break;
          case 'i':
            font.italic = true;
            break;
          case 'u':
            font.underline = true;
            break;
        }
      }
      return font;
    });

  }

}
