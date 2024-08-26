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

/**
 * rewrite of export. we'll still use a template, but do more direct
 * writing and less DOM manipulation. this should be cleaner in the long
 * run, but it will take a bit more work.
 */

// import JSZip from 'jszip';

import * as Base64JS from 'base64-js';

import { PixelsToColumnWidth } from './column-width';

const XMLDeclaration = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;

import { template } from './template-2';
import type { SerializedModel, SerializedSheet } from 'treb-data-model';

import type { IArea, ICellAddress, CellStyle,
         AnnotationLayout, Corner as LayoutCorner, Cell, Rectangle, Color } from 'treb-base-types';
import { Area, Cells, ValueType, Style, IsHTMLColor, IsThemeColor, ThemeColorIndex } from 'treb-base-types';

// import * as xmlparser from 'fast-xml-parser';
import type { XmlBuilderOptions} from 'fast-xml-parser';
import { XMLParser } from 'fast-xml-parser';

import { SharedStrings } from './shared-strings2';
import type { XlColor, BorderEdge } from './workbook-style2';
import { StyleCache } from './workbook-style2';
import { Theme } from './workbook-theme2';

import type { RelationshipMap} from './relationship';
import { AddRel } from './relationship';
import { type DOMContent, XMLOptions2, PatchXMLBuilder } from './xml-utils';

import type { UnitAddress, UnitRange, ExpressionUnit} from 'treb-parser';
import { Parser } from 'treb-parser';

// FIXME: move
import type { ChartOptions } from './drawing2/chart2';
import { Chart } from './drawing2/chart2';
import type { ImageOptions } from './drawing2/embedded-image';
import type { TwoCellAnchor } from './drawing2/drawing2';
import { Drawing } from './drawing2/drawing2';
import { ConditionalFormatOperators, type TableDescription, type TableFooterType } from './workbook2';
import type { AnnotationData } from 'treb-data-model/src/annotation';
import { ZipWrapper } from './zip-wrapper';

/*
interface NestedDOMType {
  [index: string]: string|number|NestedDOMType|NestedDOMType[];
}
*/

/**
 * utility function. given a Color object (our Color, from Style) returns 
 * an XML structure like 
 * 
 * { a$: { rgb: '123456 }}
 * 
 * or
 * 
 * { a$: { theme: 1, tint: .5 }}
 * 
 */
const ColorAttrs = (color?: Color): DOMContent|undefined => {

  if (IsHTMLColor(color)) {
    return { 
      a$: {
        rgb: `FF` + color.text.substring(1),
      },
    };
  }
  if (IsThemeColor(color)) {
    return {
      a$: {
        theme: ThemeColorIndex(color),
        tint: color.tint,
      },
    };
  }

  return undefined;
  
};

export class Exporter {

  // public zip?: JSZip;
  public zip?: ZipWrapper;

  public xmloptions: Partial<XmlBuilderOptions> = {
    format: true,
    attributesGroupName: 'a$',
    textNodeName: 't$',
    ignoreAttributes: false,
    suppressEmptyNode: true,

    // OK so now I am turning this off altogether. not sure why we
    // were using it in the first place -- which is a problem, since
    // there's probably something I don't know.

    /*
    tagValueProcessor: (name: string, a: string) => {
     
      // we were including unsafe symbols here, but that was 
      // resulting in double-encoding. not sure why this is 
      // here at all, unless we need it for unicode? in any
      // event (atm) allowing unsafe symbols is sufficient

      return a; // ?

      return (typeof a === 'string') ? he.encode(a, { useNamedReferences: true, allowUnsafeSymbols: true }) : a;
    },
    */

    // there's a "isAttributeValue" for decode, but no option for encode?
    // we only want to encode ' and "

    // attrValueProcessor: a => (typeof a === 'string') ? he.encode(a, { useNamedReferences: true }) : a,

    // why is this double-encoding? is there arlready implicit encoding? (...)
    // there must have been a reason we used it in the first place... but I don't know what that was.
    // do we need to encode apostrophes?

    //    attributeValueProcessor: (name: string, a: string) => (typeof a === 'string') ? 
    //      a.replace(/"/g, '&quot;').replace(/'/g, '&apos;') : a,



  };

  // public xmlparser = new xmlparser.j2xParser(this.xmloptions);
  public xmlbuilder1 = PatchXMLBuilder(this.xmloptions);
  public xmlparser2 = new XMLParser(XMLOptions2);

  // FIXME: need a way to share/pass parser flags
  public parser = new Parser();

  public decorated_functions: Record<string, string> = {};

  /*
  constructor() {

  }
  */

  /**
   * init used to load the template file. we added a parameter to
   * pass in the list of functions that need decoration (_xlfn).
   * 
   * @param decorated_functions 
   */
  public Init(decorated_functions: Record<string, string> = {}) {

    for (const key of Object.keys(decorated_functions)) {
      this.decorated_functions[key.toLowerCase()] = decorated_functions[key]; // normalized
    }

    const parsed = Base64JS.toByteArray(template);
    this.zip = new ZipWrapper(parsed);

  }

  public WriteRels(rels: RelationshipMap, path: string, dump = false) {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const keys = Object.keys(rels);

    const dom: DOMContent = {
      Relationships: {
        a$: {
          xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships',
        },
        Relationship: keys.map(key => {
          const rel = rels[key];
          const a$: DOMContent = {
            Id: rel.id,
            Target: rel.target,
            Type: rel.type,
          };
          if (rel.mode) {
            a$.TargetMode = rel.mode;
          }
          return { a$ };
        }),
      },
    };

    const xml = XMLDeclaration + this.xmlbuilder1.build(dom);

    // console.info({dom, xml});

    if (dump) {
      console.info(xml);
    }
    
    this.zip.Set(path, xml);

  }

  /**
   * format and write styles
   */
  public WriteStyleCache(style_cache: StyleCache) {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const ColorAttributes = (color: XlColor) => {

      // we could just pass through except that we have argb and excel has rgb

      const attrs: XlColor & { rgb?: string } = {};

      if (color.indexed !== undefined) {
        attrs.indexed = color.indexed;
      }
      if (color.theme !== undefined) {
        attrs.theme = color.theme;
      }
      if (color.tint !== undefined) {
        attrs.tint = color.tint;
      }
      if (color.argb !== undefined) {
        attrs.rgb = color.argb;
      }

      return attrs as DOMContent;

    };

    const xfs = style_cache.cell_xfs.map(xf => {
      const block: DOMContent = {
        a$: {
          numFmtId: xf.number_format,
          fontId: xf.font,
          fillId: xf.fill,
          borderId: xf.border,
        },
      };

      if (xf.horizontal_alignment || xf.vertical_alignment || xf.wrap_text || xf.indent) {

        const attrs: DOMContent = {};

        if (xf.horizontal_alignment) {
          attrs.horizontal = xf.horizontal_alignment;
        }
        if (xf.vertical_alignment) {
          attrs.vertical = xf.vertical_alignment;
        }
        if (xf.wrap_text) {
          attrs.wrapText = 1;
        }
        if (xf.indent && xf.horizontal_alignment !== 'center') {
          attrs.indent = xf.indent;
        }

        block.alignment = { a$: attrs };

      }

      return block;
    });

    const BorderColorAttributes= (edge: BorderEdge): DOMContent|undefined  => {
      if (edge.color) {
        return { indexed: edge.color };
      }
      if (edge.rgba) {
        return { rgb: edge.rgba };
      }
      if (typeof edge.theme !== 'undefined') {
        return {
          theme: edge.theme,
          tint: edge.tint,
        };
      }
      return undefined;
    };

    const borders = style_cache.borders.map(border => {

      const top: DOMContent = {};
      const left: DOMContent = {};
      const right: DOMContent = {};
      const bottom: DOMContent = {};
      const diagonal: DOMContent = {};

      if (border.top.style) {
        top.a$ = {
          style: border.top.style,
        };
        const attrs = BorderColorAttributes(border.top);
        if (attrs) { top.color = {a$: attrs}; }
      }

      if (border.left.style) {
        left.a$ = {
          style: border.left.style,
        };
        const attrs = BorderColorAttributes(border.left);
        if (attrs) { left.color = {a$: attrs}; }
      }

      if (border.bottom.style) {
        bottom.a$ = {
          style: border.bottom.style,
        };
        const attrs = BorderColorAttributes(border.bottom);
        if (attrs) { bottom.color = {a$: attrs}; }
      }

      if (border.right.style) {
        right.a$ = {
          style: border.right.style,
        };
        const attrs = BorderColorAttributes(border.right);
        if (attrs) { right.color = {a$: attrs}; }
      }

      if (border.diagonal.style) {
        diagonal.a$ = {
          style: border.diagonal.style,
        };
        const attrs = BorderColorAttributes(border.diagonal);
        if (attrs) { diagonal.color = {a$: attrs}; }
      }

      return {
        left,
        right,
        top,
        bottom,
        diagonal,
      };

    });

    const fills: DOMContent[] = style_cache.fills.map(fill => ({
      patternFill: {
        a$: { 
          patternType: (fill.pattern_gray !== undefined) ? `gray${fill.pattern_gray}` : fill.pattern_type,
        },

        bgColor: fill.bg_color ? {
          a$: ColorAttributes(fill.bg_color),
        } : undefined,

        fgColor: fill.fg_color ? {
          a$: ColorAttributes(fill.fg_color),
        } : undefined,
      },
    }));

    const ValProp = (prop: string|number|undefined) => {
      
      if (typeof prop === 'undefined') {
        return undefined;
      }

      return {
        a$: {
          val: prop,
        },
      };

    };

    // console.info({style_cache});

    const fonts: DOMContent[] = style_cache.fonts.map(font => {

      return {

        // flags 

        b: font.bold ? '' : undefined,
        i: font.italic ? '' : undefined,
        u: font.underline ? '' : undefined,
        strike: font.strike ? '' : undefined,

        // 'val' props

        sz: ValProp(font.size),
        family: ValProp(font.family),
        name: ValProp(font.name),
        scheme: ValProp(font.scheme),

        color: font.color_argb ? {
          a$: { rgb: font.color_argb },
        } : (typeof font.color_theme !== 'undefined') ? {
          a$: { 
            theme: font.color_theme,
            tint: font.color_tint,
          },
        } : undefined,

      };

    });

    const WithCount = (key: string, source: DOMContent[]) => {
      if (source.length) {
        return {
          a$: { count: source.length },
          [key]: source,
        };
      }
      return undefined;
    };


    const dxf: DOMContent[] = style_cache.dxf_styles.map(style => {

      const entry: DOMContent = {};

      if (style.text || style.bold || style.italic || style.underline) {
        entry.font = {
          b: style.bold ? {} : undefined,
          i: style.italic ? {} : undefined,
          u: style.underline ? {} : undefined,
          strike: style.strike ? {} : undefined,
          color: ColorAttrs(style.text),
        };
      }

      if (style.fill) {
        entry.fill = {
          patternFill: {
            bgColor: ColorAttrs(style.fill),
          }
        }
      };

      return entry;

    });

    // console.info({dxf});

    const dom: DOMContent = {

      styleSheet: {

        a$: {
          'xmlns':        'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'xmlns:mc':     'http://schemas.openxmlformats.org/markup-compatibility/2006',
          'mc:Ignorable': 'x14ac x16r2 xr',
          'xmlns:x14ac':  'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
          'xmlns:x16r2':  'http://schemas.microsoft.com/office/spreadsheetml/2015/02/main', 
          'xmlns:xr':     'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
        },

        // we're only adding elements here if they are not empty, but in 
        // practice only numFmts can be empty (because there are implicit 
        // formats); everything else has a default 0 entry

        numFmts: style_cache.number_formats.length ? {
          a$: { count: style_cache.number_formats.length },
          numFmt: style_cache.number_formats.map(format => {
            return {
              a$: {
                numFmtId: format.id,
                formatCode: format.format,
              } as DOMContent,  
            };
          }),
        } : undefined,
  
        fonts: WithCount('font', fonts),
        fills: WithCount('fill', fills),
        borders: WithCount('border', borders),
        cellXfs: WithCount('xf', xfs),
        dxfs: WithCount('dxf', dxf),

      },

    };

    const xml = XMLDeclaration + this.xmlbuilder1.build(dom);
    // console.info(xml);

    this.zip?.Set('xl/styles.xml', xml);

  }

  /**
   * format and write shared strings file to the zip archive. this will
   * replace any existing shared strings file.
   */
  public WriteSharedStrings(shared_strings: SharedStrings) {

    // console.info({shared_strings});

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const dom: DOMContent = {
      sst: {
        a$: {
          'xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          count: shared_strings.strings.length,
          uniqueCount: shared_strings.strings.length,
        },
        si: [
          ...shared_strings.strings.map(t => { return {t}}),
        ],
      },
    };

    const xml = XMLDeclaration + this.xmlbuilder1.build(dom);

    // console.info(xml);

    this.zip.Set('xl/sharedStrings.xml', xml);

  }

  /**
   * FIXME: we might not always need this. 
   */
  public SheetStyle(sheet: SerializedSheet, style_cache: StyleCache) {

    if (!sheet.sheet_style) {
      return 0;
    }

    const options = style_cache.StyleOptionsFromProperties(sheet.sheet_style);
    return style_cache.EnsureStyle(options);
    
  }

  public RowStyle(sheet: SerializedSheet, style_cache: StyleCache, row: number) {

    const cell_style_refs = sheet.styles || sheet.cell_style_refs || [];
    const list: CellStyle[] = [sheet.sheet_style];

    if (sheet.row_style) {
      let style = sheet.row_style[row];
      if (typeof style === 'number') {
        style = cell_style_refs[style];
        if (style) {
          list.push(style); 
        }
      }
      else if (style) {
        list.push(style); 
      }
    }

    const options = style_cache.StyleOptionsFromProperties(Style.Composite(list));
    return style_cache.EnsureStyle(options);

  }

  public ColumnStyle(sheet: SerializedSheet, style_cache: StyleCache, column: number) {

    const cell_style_refs = sheet.styles || sheet.cell_style_refs || [];
    const list: CellStyle[] = [sheet.sheet_style];

    if (sheet.column_style) {
      let style = sheet.column_style[column];
      if (typeof style === 'number') {
        style = cell_style_refs[style];
        if (style) {
          list.push(style); 
        }
      }
      else if (style) {
        list.push(style); 
      }
    }

    const options = style_cache.StyleOptionsFromProperties(Style.Composite(list));
    return style_cache.EnsureStyle(options);

  }

  public StyleFromCell(sheet: SerializedSheet, style_cache: StyleCache, row: number, column: number, style: CellStyle = {}) {

    //if (row === 2 && column === 5)
    //  console.info("SFC", JSON.stringify(style, undefined, 2));

    const cell_style_refs = sheet.styles || sheet.cell_style_refs || [];

    const list: CellStyle[] = [sheet.sheet_style];

    /*
    // should apply to rows, not cells 

    if (sheet.row_pattern && sheet.row_pattern.length) {
      list.push(sheet.row_pattern[row % sheet.row_pattern.length]);
    }
    */

    // is this backwards, vis a vis our rendering? I think it might be...
    // YES: should be row pattern -> row -> column -> cell [corrected]

    // FIXME: can't we just ask the sheet? (A: no, because we don't have 
    // an actual sheet, although we could?)

    // if (sheet.row_style && sheet.row_style[row]) {
    //  list.push(sheet.row_style[row]);
    // }

    if (sheet.row_style) {
      let style = sheet.row_style[row];
      if (typeof style === 'number') {
        style = cell_style_refs[style];
        if (style) {
          list.push(style); 
        }
      }
      else if (style) {
        list.push(style);
      }
    }

    // this can now be a number, and possibly 0 (?)
    
    // actually 0 is by default a null style, although that's more of 
    // a convention than a hard rule, not sure we should rely on it

    if (sheet.column_style) {
      let style = sheet.column_style[column];
      if (typeof style === 'number') {
        style = cell_style_refs[style];
        if (style) {
          list.push(style); 
        }
      }
      else if (style) {
        list.push(style); 
      }
    }

    //if (sheet.column_style && sheet.column_style[column]) {
    //  list.push(sheet.column_style[column]);
    //}

    /*
    if (cell.ref) {
      list.push(sheet_source.cell_style_refs[cell.ref]);
    }
    else if (cell.style_ref) {
      list.push(sheet_source.cell_style_refs[cell.style_ref]);
    }
    else if (style_map[cell.column] && style_map[cell.column][cell.row]) {
      list.push(style_map[cell.column][cell.row]);
    }
    */
    list.push(style);

    const options = style_cache.StyleOptionsFromProperties(Style.Composite(list));

    return style_cache.EnsureStyle(options);

  }

  /** overload for return type */
  public NormalizeAddress(unit: UnitAddress, sheet: SerializedSheet): UnitAddress;

  /** overload for return type */
  public NormalizeAddress(unit: UnitRange, sheet: SerializedSheet): UnitRange;

  /** extra overload */
  public NormalizeAddress<UNIT = UnitAddress|UnitRange>(unit: UNIT, sheet: SerializedSheet): UNIT;

  /**
   * for charts we need addresses to be absolute ($)  and ensure there's
   * a sheet name -- use the active sheet if it's not explicitly referenced
   */
  public NormalizeAddress(unit: UnitAddress|UnitRange, sheet: SerializedSheet): UnitAddress|UnitRange {

    const addresses = (unit.type === 'address') ? [unit] : [unit.start, unit.end];

    for (const address of addresses) {
      address.absolute_row = true;
      address.absolute_column = true;
      if (!address.sheet) {
        address.sheet = sheet.name;
      }
    }
    if (unit.type === 'range') {
      unit.end.sheet = undefined;
    }

    unit.label = this.parser.Render(unit);
    return unit; // fluent

  }

  public EnsureRange(unit: UnitAddress|UnitRange): UnitRange {
    if (unit.type === 'range') {
      return unit;
    }
    return {
      type: 'range',
      start: unit,
      end: unit,
      label: unit.label,
      id: unit.id,
      position: unit.position,
    };
  }

  /** 
   * new-style annotation layout (kind of a two-cell anchor) to two-cell anchor
   */
   public AnnotationLayoutToAnchor(layout: AnnotationLayout, sheet: SerializedSheet): TwoCellAnchor {

    // our offsets are % of cell. their offsets are in excel units, 
    // but when the chart is added our method will convert from pixels.

    const address_to_anchor = (corner: LayoutCorner) => {
      
      const width = (sheet.column_width && sheet.column_width[corner.address.column]) ? 
        sheet.column_width[corner.address.column] : (sheet.default_column_width || 100);
      
      const height = (sheet.row_height && sheet.row_height[corner.address.row]) ? 
        sheet.row_height[corner.address.row] : (sheet.default_row_height || 20);

      return {
        ...corner.address,
        row_offset: Math.round(corner.offset.y * height),
        column_offset: Math.round(corner.offset.x * width),
      };

    };
    
    return {
      from: address_to_anchor(layout.tl),
      to: address_to_anchor(layout.br),
    };

  }

  /**
   * convert a rectangle (pixels) to a two-cell anchor. note that
   * our offsets are in pixels, they'll need to be changed to whatever
   * the target units are.
   */
  public AnnotationRectToAnchor(
      src_rect: Partial<Rectangle>, 
      sheet: SerializedSheet): TwoCellAnchor {
    
    const anchor: TwoCellAnchor = {
      from: {row: -1, column: -1},
      to: {row: -1, column: -1},
    };

    const annotation_rect = {
      top: 0, left: 0, width: 301, height: 301,
      ...src_rect,
    };

    const rect = {
      ...annotation_rect,  // {top, left, width, height}
      right: annotation_rect.left + annotation_rect.width,
      bottom: annotation_rect.top + annotation_rect.height,
    };
    
    for (let x = 0, column = 0; column < 1000; column++) {
      const width = (sheet.column_width && sheet.column_width[column]) ? sheet.column_width[column] : (sheet.default_column_width || 100);
      if (anchor.from.column < 0 && rect.left <= x + width) {
        anchor.from.column = column;
        anchor.from.column_offset = (rect.left - x);
      }
      if (anchor.to.column < 0 && rect.right <= x + width) {
        anchor.to.column = column;
        anchor.to.column_offset = (rect.right - x);
        break;
      }
      x += width;
    }

    for (let y = 0, row = 0; row < 1000; row++) {
      const height = (sheet.row_height && sheet.row_height[row]) ? sheet.row_height[row] : (sheet.default_row_height || 20);
      if (anchor.from.row < 0 && rect.top <= y + height) {
        anchor.from.row = row;
        anchor.from.row_offset = (rect.top - y);
      }
      if (anchor.to.row < 0 && rect.bottom <= y + height) {
        anchor.to.row = row;
        anchor.to.row_offset = (rect.bottom - y);
        break;
      }
      y += height;
    }

    return anchor;

  }

  public ParseImages(sheet_source: SerializedSheet): Array<{ anchor: TwoCellAnchor, options: ImageOptions }> {

    const images: Array<{ anchor: TwoCellAnchor, options: ImageOptions }> = [];

    for (const annotation of (sheet_source.annotations as Array<AnnotationData & {rect?: Partial<Rectangle>}>) || []) {
      if (annotation.type === 'image' && annotation.data?.src) {

        // this is (should be) a data URI in base64. at least (atm) 
        // that's all we support for exporting.

        const src = annotation.data.src;
        const match = src.match(/^data:image\/([^;]*?);base64,/);
        
        if (match) {

          const data = src.substr(match[0].length);
          const mimetype = match[1];

          const options: ImageOptions = {
            data,
            mimetype,
            encoding: 'base64',
          }

          switch (mimetype) {
            case 'svg+xml':
            case 'webp':
            case 'jpeg':
            case 'jpg':
            case 'image/png':
            case 'png':
            case 'gif':

              if (annotation.layout) {
                images.push({
                  anchor: this.AnnotationLayoutToAnchor(annotation.layout, sheet_source), options});
              }
              else if (annotation.rect) {
                images.push({
                  anchor: this.AnnotationRectToAnchor(annotation.rect, sheet_source), options});
              }
              else {
                console.warn('annotation missing layout');
              }

              break;

            default:
              console.info('unhandled image type', mimetype);
              break;
          }

        }

      }
    }

    return images;

  }

  public ParseCharts(sheet_source: SerializedSheet): Array<{ anchor: TwoCellAnchor, options: ChartOptions }> {
    
    const charts: Array<{
      anchor: TwoCellAnchor,
      options: ChartOptions,
    }> = [];

    const parse_series = (arg: ExpressionUnit, options: ChartOptions, ref?: string) => {

      if (arg.type === 'range') {
        options.data.push(this.NormalizeAddress(arg, sheet_source));
      }
      else if (arg.type === 'call') {
        if (/group/i.test(arg.name)) {
          // recurse
          for (const value of (arg.args || [])) {
            parse_series(value, options, ref ? ref + ` (recurse)` : undefined);
          }
        }
        else if (/series/i.test(arg.name)) {

          const [label, x, y, z] = arg.args; // y is required
          
          // FIXME: could be address also [x, y]

          if (y && (y.type === 'range' || y.type === 'address')) {

            options.data.push(this.EnsureRange(this.NormalizeAddress(y, sheet_source)));

            if (label) {

              if (!options.names) { options.names = []; }

              if (label.type === 'address') {
                this.NormalizeAddress(label, sheet_source);
              }
              
              if (label.type === 'range') {
                this.NormalizeAddress(label.start, sheet_source);
                options.names[options.data.length - 1] = label.start;
              }
              else {
                options.names[options.data.length - 1] = label;
              }
              
            }

            if (!options.labels2) { options.labels2 = []; }

            if (x && (x.type === 'range' || x.type === 'address')) {
              options.labels2[options.data.length - 1] = this.EnsureRange(this.NormalizeAddress(x, sheet_source));
            }

            if (z && (z.type === 'range' || z.type === 'address')) {
              if (!options.labels3) { options.labels3 = []; }
              options.labels3[options.data.length - 1] = this.EnsureRange(this.NormalizeAddress(z, sheet_source));
            }
            
          }
          else {
            console.info('invalid series missing Y', {y, arg, ref});
          }

        }
      }

    };

    for (const annotation of sheet_source.annotations || []) {

      const parse_result = this.parser.Parse(annotation.formula || '');
      if (parse_result.expression && parse_result.expression.type === 'call') {
        
        let type = ''; // FIXME

        switch (parse_result.expression.name.toLowerCase()) {
          case 'line.chart':
            type = 'scatter';
            break;

          case 'bubble.chart':
            type = 'bubble';
            break;

          case 'scatter.line':
            type = 'scatter2';
            break;

          case 'donut.chart':
            type = 'donut';
            break;

          case 'bar.chart':
            type = 'bar';
            break;

          case 'column.chart':
            type = 'column';
            break;
        }

        if (type === 'column' || type === 'donut' || type === 'bar' || type === 'scatter' || type === 'scatter2' || type === 'bubble') {

          const options: ChartOptions = { type, data: [] };

          const title_index = (type === 'scatter2' || type === 'bubble') ? 1 : 2;
          const title_arg = parse_result.expression.args[title_index];

          if (title_arg && title_arg.type === 'literal') {
            options.title = title_arg;
          }
          else if (title_arg && title_arg.type === 'address') {
            options.title = this.NormalizeAddress(title_arg, sheet_source);
          }
          else {

            // FIXME: formula here will not work. we need to bring
            // a calculator into this class? (!) or somehow cache the value...

            // console.info('chart title arg', title_arg)
          }

          // we changed our Series() to Group(), and then added a new Series()
          // function which adds data labels and per-series X values... will
          // need to incorporate somehow. for now, just s/series/group to get
          // the data in the chart

          // oh we already did that... duh

          if (parse_result.expression.args[0]) {
            const arg0 = parse_result.expression.args[0];
            if (type === 'scatter2' || type === 'bar' || type === 'column' || type === 'scatter' || type === 'bubble') {
              parse_series(arg0, options, sheet_source.name);
            }
            else if (arg0.type === 'range') {
              options.data.push(this.NormalizeAddress(arg0, sheet_source));
            }

            // so the next cases cannot happen? (...) donut? (...)

            else if (arg0.type === 'call' && /group/i.test(arg0.name)) {
              for (const series of arg0.args) {

                // in group, could be a range or a Series()
                if (series.type === 'range') {
                  options.data.push(this.NormalizeAddress(series, sheet_source));
                }
                else if (series.type === 'call' && /series/i.test(series.name)) {

                  // in Series(), args are (name, X, range of data)

                  if (series.args[2] && series.args[2].type === 'range') {
                    options.data.push(this.NormalizeAddress(series.args[2], sheet_source));
                  }
                }
              }
            }
            else if (arg0.type === 'call' && /series/i.test(arg0.name)) {

              // another case, single Series()
              if (arg0.args[2] && arg0.args[2].type === 'range') {
                options.data.push(this.NormalizeAddress(arg0.args[2], sheet_source));
              }
            }

            /*
            else if (arg0.type === 'call' && /series/i.test(arg0.name)) {
              for (const series of arg0.args) {
                if (series.type === 'range') {
                  options.data.push(this.NormalizeAddress(series, sheet_source));
                }
              }
            }
            */
          }

          if (type !== 'scatter2' && type !== 'bubble') {
            if (parse_result.expression.args[1] && parse_result.expression.args[1].type === 'range') {
              options.labels = this.NormalizeAddress(parse_result.expression.args[1], sheet_source);
            }
          }

          if (type === 'scatter' 
              && parse_result.expression.args[4]
              && parse_result.expression.args[4].type === 'literal'
              && parse_result.expression.args[4].value.toString().toLowerCase() === 'smooth') {

            options.smooth = true;
          }
          else if (type === 'scatter2' && parse_result.expression.args[2]) {
            if (parse_result.expression.args[2].type === 'literal' 
                && /smooth/i.test(parse_result.expression.args[2].value.toString())) {
              options.smooth = true;
            }
          }
          else if (type === 'bubble') {
            // ...
            // console.info({parse_result});
          }

          // FIXME: fix this type (this happened when we switched from annotation
          // class to a data interface)

          const rect = (annotation as AnnotationData & { rect?: Partial<Rectangle>}).rect;

          if (annotation.layout) {
            charts.push({
              anchor: this.AnnotationLayoutToAnchor(annotation.layout, sheet_source), options});
            // sheet.AddChart(this.AnnotationLayoutToAnchor(annotation.layout, sheet_source), options);
          }
          else if (rect) {
            charts.push({
              anchor: this.AnnotationRectToAnchor(rect, sheet_source), options});
            // sheet.AddChart(this.AnnotationRectToAnchor(annotation.rect, sheet_source), options);
          }
          else {
            console.warn('annotation missing layout');
          }

        }

      }
      

    }

    return charts;

  }

  public FormulaText(text: string, context: Cell): string {
  
    // let mared = false;

    if (text[0] !== '=') {
      return text;
    }

    const parse_result = this.parser.Parse(text);

    if (!parse_result.expression) {
      console.warn('parsing function failed');
      console.warn(text);
      return text.substring(1);
    }
    else {

      // if (this.decorated_functions.length) {
      {
        this.parser.Walk(parse_result.expression, (unit) => {
          if (unit.type === 'call') {
            // unit.name = unit.name.toUpperCase();

            const lc = unit.name.toLowerCase();

            /*
            for (const test of this.decorated_functions) {
              if (test === lc) {
                unit.name = '_xlfn.' + unit.name; 
                break;
              }
            }
            */

            if (this.decorated_functions[lc]) {
              // mared = true;
              unit.name = this.decorated_functions[lc] + '.' + unit.name;
            }

          }
          return true;
        });
      }

      //if (mared) {
      //  console.info("MARED", this.parser.Render(parse_result.expression, undefined, ''));
      //}

      // const x = this.parser.Render(parse_result.expression, undefined, '');
      // console.info("T", text, x);

      const table_name = context.table?.name || '';

      /*
      console.info('tn', table_name);
      const temp = this.parser.Render(parse_result.expression, undefined, '', undefined, undefined, undefined, true, table_name);
      console.info({temp});
      */

      return this.parser.Render(parse_result.expression, {
        missing: '', 
        long_structured_references: true, 
        table_name });
    }
   
  }

  public Export(source: SerializedModel) {
      
    // --- create a map --------------------------------------------------------

    // active_sheet, in source, is a sheet ID. we need to map
    // that to an index. luckily we preserve index order. we can
    // do that as a side effect of creating the map, although we
    // will need a loop index.

    let active_sheet = 0;

    const sheet_name_map: string[] = [];
    for (let index = 0; index < source.sheet_data.length; index++) {
      const sheet = source.sheet_data[index];

      const id = sheet.id || 0;
      if (id) {
        sheet_name_map[id] = sheet.name || '';
      }
      if (id === source.active_sheet) {
        active_sheet = index;
      }
    }

    // console.info("active sheet", source.active_sheet, active_sheet);

    // --- init workbook globals -----------------------------------------------

    // shared strings, start empty
    const shared_strings = new SharedStrings();

    // style and theme: use the template so we have the base values
    const style_cache = new StyleCache();
    const theme = new Theme();

    let data = this.zip?.Get('xl/theme/theme1.xml');
    theme.FromXML(this.xmlparser2.parse(data || ''));
    // console.info({data, xml: this.xmlparser2.parse(data)})

    data = this.zip?.Get('xl/styles.xml');
    style_cache.FromXML(this.xmlparser2.parse(data || ''), theme);

    // reset counters

    Drawing.next_drawing_index = 1;
    Chart.next_chart_index = 1;

    const drawings: Drawing[] = [];

    // we need to keep track of tables in all sheets

    const global_tables: TableDescription[] = [];

    // --- now sheets ----------------------------------------------------------

    for (let sheet_index = 0; sheet_index < source.sheet_data.length; sheet_index++) {

      const sheet = source.sheet_data[sheet_index];
      const sheet_rels: RelationshipMap = {};
      
      // FIXME: we could, in theory, type this thing...

      const sheet_attributes = {
        'xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
        'mc:Ignorable': 'x14ac xr xr2 xr3',
        'xmlns:x14ac': 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
        'xmlns:xr': 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision', 
        'xmlns:xr2': 'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2', 
        'xmlns:xr3': 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision3',
        'xr:uid': '{D37933E2-499F-4789-8D13-194E11B743FC}',
      };

      const default_row_height = sheet.default_row_height ? (sheet.default_row_height / 20 * 15) : 15;

      // data has different representations. it is either blocked into rows or 
      // columns, or a set of individual cells. we could theoretically guarantee
      // a particular encoding if we wanted to (by row would be optimal for excel).

      // but we don't do that at the moment, so let's just unwind it using the 
      // standard class (adding support for cell styles)

      const cell_style_refs = sheet.styles || sheet.cell_style_refs || [];

      const cells = new Cells();
      cells.FromJSON(sheet.data, cell_style_refs);

      // console.info({ss: sheet.sheet_style, sheet});

      // these are cells with style but no contents

      for (const entry of sheet.cell_styles) {
        const cell = cells.EnsureCell(entry); // cheating
        if (!cell.style) {
          cell.style = cell_style_refs[entry.ref];
        }
      }

      // start with an extent from (0, 0). we can shift this as necessary.

      const extent: IArea = {
        start: { row: cells.rows + 1, column: cells.columns + 1, }, 
        end: { row: cells.rows + 1, column: cells.columns + 1, }};

      // const FormulaText = (text: string) => (text[0] === '=') ? TranslateFormula(text.substr(1)) : text;
      

      // cells data is row-major, and sparse.

      // const sheet_data: any = { row: [] };
      const sheet_rows: DOMContent[] = [];

      const hyperlinks: Array<{
        rel: string,
        target: string,
        address: ICellAddress,
      }> = [];

      const sparklines: Array<{
        address: ICellAddress,
        formula: string,
        style?: CellStyle,
      }> = [];

      const merges: Area[] = [];
      const tables: TableDescription[] = [];
      
      // --

      // 
      // this is a map of column number -> column style. we need this 
      // for two things: (1) so we can skip cells that are empty, but
      // have a style from the column; and (2) so we can create the list
      // of columns, including styles.
      //
      const column_style_map: number[] = [];

      const sheet_style = this.SheetStyle(sheet, style_cache);

      for (let r = 0; r < cells.data.length; r++ ) {

        const row_style = this.RowStyle(sheet, style_cache, r);

        if (cells.data[r] && cells.data[r].length) {  

          // push out the extent (reversed)
          if (r < extent.start.row) {
            extent.start.row = r;
          }

          // row span
          const span = {start: -1, end: -1};
          const row: DOMContent[] = [];

          for (let c = 0; c < cells.data[r].length; c++) {

            if (!column_style_map[c]) {
              column_style_map[c] = this.ColumnStyle(sheet, style_cache, c);
            }

            const cell = cells.data[r][c];
            if (cell) {

              // create a table reference at the table head, we can ignore the rest

              if (cell.table &&
                  cell.table.area.start.row === r &&
                  cell.table.area.start.column === c) {

                const area = new Area(cell.table.area.start, cell.table.area.end);
                const global_count = global_tables.length + 1;
                const path = `../tables/table${global_count}.xml`;

                // column names must match the text in the column. AND, they 
                // have to be unique. case-insensitive unique! we are not (atm) 
                // enforcing those rules, so we need to enforce them on export.
                  
                // also, values (and column headers) MUST BE STRINGS. 
                
                const columns: string[] = [];
                for (let i = 0; i < area.columns; i++) {
                  const header = cells.data[r][c + i];
                  let value = '';

                  if (header.type !== ValueType.string) {
                    if (typeof header.calculated !== 'undefined') {
                      value = (header.calculated).toString();
                    }
                    else if (typeof header.value !== 'undefined') {
                      value = (header.value).toString();
                    }

                    header.type = ValueType.string;
                    header.value = value;

                  }
                  else {
                    value = (header.value as string) || '';
                  }
                 
                  if (!value) {
                    value = `Column${i + 1}`;
                  }

                  let proposed = value;
                  let success = false;
                  let index = 1;

                  while (!success) {
                    success = true;
                    inner_loop:
                    for (const check of columns) {
                      if (check.toLowerCase() === proposed.toLowerCase()) {
                        success = false;
                        proposed = `${value}${++index}`;
                        break inner_loop;
                      }
                    }
                  }

                  header.value = proposed;
                  columns.push(proposed);

                }

                let footers: TableFooterType[]|undefined = undefined;

                if (cell.table.totals_row) {

                  footers = [];

                  for (let i = 0; i < area.columns; i++) {
                    const footer = cells.data[area.end.row][area.start.column + i];
                    if (footer.type) {
                      if (footer.type === ValueType.formula) {
                        footers[i] = {
                          type: 'formula',
                          value: (footer.value || '').toString().substring(1),
                        }
                      }
                      else {

                        if (footer.type !== ValueType.string) {
                          footer.type = ValueType.string;
                          footer.value = footer.value?.toString() || '';
                        }

                        footers[i] = {
                          type: 'label',
                          value: footer.value as string,
                        }
                      }
                    }
                    // console.info({footer});
                  }
                }

                // console.info({columns});

                const description: TableDescription = {
                  rel: AddRel(
                        sheet_rels, 
                        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/table',
                        path,
                      ),
                  index: global_count,
                  ref: area.spreadsheet_label,
                  name: `Table${global_count}`,
                  display_name: `Table${global_count}`,
                  totals_row_shown: 0,
                  totals_row_count: cell.table?.totals_row? 1 : 0,
                  columns,
                  footers,
                };

                if (cell.table.totals_row) {
                  const filter_area = new Area(area.start, {
                    row: area.end.row - 1,
                    column: area.end.column,
                  });
                  description.filterRef = filter_area.spreadsheet_label;                  
                }

                // console.info({description});

                // this list is used to add tables on this sheet
                tables.push(description);

                // but we also need global references to create the files
                global_tables.push(description);
              }

              // merges

              if (cell.merge_area && 
                  cell.merge_area.start.row === r &&
                  cell.merge_area.start.column === c) {
                merges.push(new Area(cell.merge_area.start, cell.merge_area.end));
              }

              // links

              if (cell.hyperlink) {
                const rel = AddRel(sheet_rels, 
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', 
                    cell.hyperlink, 'External');
                hyperlinks.push({
                  rel, target: cell.hyperlink, address: {row: r, column: c}, 
                });
              }

              // short-circuit here
              if (cell.type === ValueType.formula && /^=?sparkline\./i.test(cell.value as string)) {
                sparklines.push({
                  address: {row: r, column: c},
                  formula: cell.value as string,
                  style: cell.style,
                })
                continue;
              }

              // push out the extent (reversed)
              if (c < extent.start.column) {
                extent.start.column = c;
              }

              // update span: end is implicit
              if (span.start < 0) {
                span.start = c;
              }
              span.end = c;

              // we have to stack the styles? what if there's no cell style?
              // there are definitely column styles... 

              // s is style, index into the style table 
              const s: number|undefined = this.StyleFromCell(sheet, style_cache, r, c, cell.style);

              if (cell.type === ValueType.undefined) {

                // you can skip if (1) there's a row style, and style === row style;
                // (2) there's a column style, no row style, and style === column style

                if ((row_style && s === row_style) || 
                    (!row_style && (column_style_map[c] && s === column_style_map[c]))) {
                  continue; // can skip
                }
              }

              // v (child element) is the value

              let v: string|number|undefined;
              let t: string|undefined;
              let f: DOMContent|string|undefined; // string|undefined;

              switch (cell.type) {
                case ValueType.formula:
                  f = this.FormulaText(cell.value as string, cell);
                  switch (cell.calculated_type) {
                    case ValueType.string:
                      v = cell.calculated as string;
                      t = 'str';
                      break;

                    case ValueType.number:
                      v = cell.calculated as number;
                      break;

                    case ValueType.boolean:
                      v = (cell.calculated ? 1 : 0);
                      t = 'b';
                      break;
                  }
                  break;

                case ValueType.string:
                  v = shared_strings.Ensure(cell.value as string);
                  t = 's'; // shared string
                  break;

                case ValueType.number:
                  v = cell.value as number;
                  break;

                case ValueType.boolean:
                  v = (cell.value ? 1 : 0);
                  t = 'b';
                  break;

                //default:
                //  v = 0;
              }
              
              if (cell.area && cell.area.start.row === r && cell.area.start.column === c) {
                if (typeof f === 'string') {
                  f = {
                    t$: f,
                    a$: {
                      t: 'array',
                      ref: cell.area.spreadsheet_label,
                    },
                  }
                }
              }

              row.push({
                a$: {

                  r: Area.CellAddressToLabel({row: r, column: c}),
                  t,

                  // old comment regarding `s`:

                  // we could skip this if it's equal to row style,
                  // or there is no row style and it's equal to column style
                  // or there is no column style and it's equal to sheet style

                  s,
                },

                f,
                v,

              });

            }
          }

          if (row.length || (row_style && row_style !== sheet_style)) {

            let customHeight: number|undefined = undefined;
            let ht: number|undefined = undefined;

            let s: number|undefined = undefined;
            let customFormat: number|undefined = undefined;

            if (sheet.row_height 
              && (typeof sheet.row_height[r] === 'number') 
              && sheet.row_height[r] !== sheet.default_row_height) {

              customHeight = 1;
              ht = sheet.row_height[r] * 3 / 4;
            }

            if (row_style && row_style !== sheet_style) {
              s = row_style;
              customFormat = 1;
            }

            // sheet_data.row.
            sheet_rows.push({
              a$: {
                r: r + 1,
                spans: `${span.start + 1}:${span.end + 1}`, // this works out to 0:0 for an empty row, will that work?
                customHeight,
                ht,
                s,
                customFormat,
              },
              c: row,
            });

          }

        }
      }

      // --- cols ----------------------------------------------------------------

      // the "cols" element represents column styles and nonstandard column 
      // widths. FIXME: should we put sheet style in here as well? I think so...

      const column_entries: Array<{
        style?: number;
        width?: number;
        index: number;
      }> = [];

      // we only need to include column style if it's !== sheet style,
      // because we'll have a default entry for columns that have the 
      // sheet style. this is only for columns that are different.

      for (let c = 0; c < sheet.columns; c++) {
        const entry: { style?: number, width?: number, index: number } = { index: c };
        if (sheet.column_width 
            && sheet.default_column_width
            && (typeof sheet.column_width[c] === 'number')
            && sheet.column_width[c] !== sheet.default_column_width) {

          entry.width = PixelsToColumnWidth(sheet.column_width[c]);
        }

        const style = column_style_map[c];
        if (style && style !== sheet_style) {
          entry.style = style;
        }

        if (entry.style !== undefined || entry.width !== undefined) {
          column_entries[c] = entry;
        }
      }

      // we're short-cutting here, these should be arranged in blocks if
      // there's overlap. not sure how much of an issue that is though.
      
      let dom_cols: DOMContent|undefined;

      if (column_entries.length || sheet_style) {

        const filled: DOMContent[] = [];
        const default_column_width = PixelsToColumnWidth(sheet.default_column_width || 90);

        // FIXME: can merge these two branches

        { // if (sheet_style) {

          let start_index = 0;
          for (const entry of column_entries) {
            if (!entry) { continue; }

            // fill with defaults

            if (sheet_style && (entry.index > start_index + 1)) {
              filled.push({
                a$: {
                  min: start_index + 1,
                  max: entry.index,
                  style: sheet_style,
                  width: default_column_width,
                },
              });
            }

            filled.push({a$: { 
              min: entry.index + 1, 
              max: entry.index + 1,
              style: entry.style === undefined ? sheet_style : entry.style,
              width: entry.width === undefined ? default_column_width : entry.width,
              customWidth: entry.width === undefined ? undefined : 1,
            }});

            start_index = entry.index;
            
          }

          if (sheet_style && (start_index < 16384)) { // OK, sure why not
            filled.push({
              a$: {
                min: start_index + 1,
                max: 16384,
                style: sheet_style,
                width: default_column_width,
              },
            });
          }

          dom_cols = { col: filled };

        }

      }

      // --- validation ----------------------------------------------------------

      let dataValidations: DOMContent|undefined;

      if (sheet.data_validations?.length) {

        dataValidations = {

          a$: { count: sheet.data_validations.length },
          dataValidation: sheet.data_validations.map(validation => {

            const sqref = validation.target.map(target => {
              return new Area(target.start, target.end).spreadsheet_label;
            }).join(' ');

            let formula1: string|undefined = undefined;

            if (validation.type === 'range') {

              const range: UnitRange = {
                id: 0,
                type: 'range',
                label: '', position: 0, 
                start: 
                  {...validation.area.start, absolute_column: true, absolute_row: true, id: 0, label: '', position: 0, type: 'address', }, 
                end: 
                  {...validation.area.end, absolute_column: true, absolute_row: true, id: 0, label: '', position: 0, type: 'address', }
                ,
              }

              if (typeof validation.area.start.sheet_id !== 'undefined') {
                range.start.sheet = sheet_name_map[validation.area.start.sheet_id];
              }

              formula1 = this.parser.Render(range);

            }
            else if (validation.type === 'list') {
              formula1 = `"${validation.list.join(',')}"`;
            }

            return { 
              a$: {
                type: 'list',
                allowBlank: 1, 
                showInputMessage: 1, 
                showErrorMessage: 1, 
                sqref, // : new Area(validation.address).spreadsheet_label,
              },
              formula1,
            };

          }),
        };

      }

      // --- tables ------------------------------------------------------------

      let tableParts: DOMContent|undefined;

      if (tables.length) {

        tableParts = {
          a$: {
            count: tables.length,
          },
          tablePart: tables.map(table => {
            return {
              a$: { 
                'r:id': table.rel || '',
              }
            };
          }),
        };

      }


      for (const table of tables) {

        const totals_attributes: { totalsRowCount?: number } = {};
        if (table.totals_row_count) {
          totals_attributes.totalsRowCount = 1;
        }
        
        const tableColumns: DOMContent = {
          a$: {
            count: (table.columns || []).length,
          },
          tableColumn: (table.columns||[]).map((column, i) => {
            const footer = (table.footers || [])[i];
            return {
              a$: {
                id: i + 1,
                name: column || `Column${i + 1}`,
                totalsRowLabel: footer?.type === 'label' ? footer.value : undefined,
                totalsRowFunction: footer?.type === 'formula' ? 'custom' : undefined,
              },
              totalsRowFormula: footer?.type === 'formula' ? footer.value : undefined,
            };
          }),
        };

        const table_dom = {
          table: {
            a$: {
              xmlns: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
              'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
              'mc:Ignorable': 'xr xr3',
              'xmlns:xr': 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
              'xmlns:xr3': 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision3',
              id: table.index || 0, 
              name: table.name, 
              displayName: table.display_name,
              ...totals_attributes,
              ref: table.ref,
            },

            autoFilter: {
              a$: {
                ref: table.filterRef || table.ref,
              },
            },

            tableColumns,

            tableStyleInfo: {
              a$: {
                name: 'TableStyleMedium2', 
                showFirstColumn: 0,
                showLastColumn: 0,
                showRowStripes: 1,
                showColumnStripes: 0,
              },
            },

          },
        };

        const xml = XMLDeclaration + this.xmlbuilder1.build(table_dom);
        // console.info(xml);

        this.zip?.Set(`xl/tables/table${table.index}.xml`, xml);

      }

      // --- conditional formats -----------------------------------------------

      let conditionalFormatting: DOMContent|DOMContent[]|undefined;

      if (sheet.conditional_formats?.length) {

        const format_list: DOMContent[] = [];
        let priority_index = 1;

        const reverse_operator_map: Record<string, string> = {};
        const operator_list: string[] = Object.entries(ConditionalFormatOperators).map(entry => {
          reverse_operator_map[entry[1]] = entry[0]; 
          return entry[1];
        });
        
        operator_list.sort((a, b) => b.length - a.length);

        for (const format of sheet.conditional_formats) {

          let dxf_index = 0;

          if (format.type !== 'gradient') {

            // these are zero-based? I thought everything in there 
            // was 1-based. [A: yes, these are indexed from 0].

            dxf_index = style_cache.dxf_styles.length;
            style_cache.dxf_styles.push(format.style);

          }

          switch (format.type) {
            case 'cell-match':
              {
                let operator = '';
                let formula = '';

                for (const test of operator_list) {
                  if (new RegExp('^' + test + '\\s').test(format.expression)) {
                    operator = reverse_operator_map[test];
                    formula = format.expression.substring(test.length).trim();
                    break;
                  }
                }
                if (operator) {

                  format_list.push({
                    a$: { sqref: new Area(format.area.start, format.area.end).spreadsheet_label },
                    cfRule: {
                      a$: { type: 'cellIs', dxfId: dxf_index, operator, priority: priority_index++ },
                      formula,
                    }
                  });
                }
              }
              break;

            case 'expression':
              format_list.push({
                a$: { sqref: new Area(format.area.start, format.area.end).spreadsheet_label },
                cfRule: {
                  a$: { type: 'expression', dxfId: dxf_index, priority: priority_index++ },
                  formula: format.expression,
                }
              });
              break;

            case 'duplicate-values':
              format_list.push({
                a$: { sqref: new Area(format.area.start, format.area.end).spreadsheet_label },
                cfRule: {
                  a$: { type: format.unique ? 'uniqueValues' : 'duplicateValues', dxfId: dxf_index, priority: priority_index++ },
                }
              });
              break;

            case 'gradient':
              {
                const cfvo: DOMContent[] = [];
                const color: DOMContent[] = [];

                for (const stop of format.stops) {

                  if (stop.value === 0) {
                    cfvo.push({ a$: { type: 'min' }}); 
                  }
                  else if (stop.value === 1) {
                    cfvo.push({ a$: { type: 'max' }}); 
                  }
                  else {
                    cfvo.push({ a$: { type: 'percentile', val: stop.value * 100 }}); 
                  }

                  const attrs = ColorAttrs(stop.color);
                  if (attrs) { color.push(attrs); }
                  
                }

                const generated: DOMContent = {
                  a$: { sqref: new Area(format.area.start, format.area.end).spreadsheet_label },
                  cfRule: {
                    a$: { type: 'colorScale', priority: priority_index++ },
                    colorScale: {
                      cfvo,
                      color,
                    }
                  } 
                };

                format_list.push(generated);

              }
              break;
          }
        }

        if (format_list.length) {
          conditionalFormatting = (format_list.length > 1) ? format_list : format_list[0];
        }

      }

      // --- merges ------------------------------------------------------------

      let mergeCells: DOMContent|undefined;
      if (merges.length) {

        mergeCells = {
          a$: { count: merges.length },
          mergeCell: merges.map(merge => {
            return {
              a$: { ref: merge.spreadsheet_label }
            };
          }),
        };

      }

      // --- hyperlinks --------------------------------------------------------

      let dom_hyperlinks: DOMContent|undefined;

      if (hyperlinks.length) {
        dom_hyperlinks = {
          hyperlink: hyperlinks.map(link => {
            return {
              a$: {
                'r:id': link.rel,
                ref: new Area(link.address).spreadsheet_label,
                'xr:uid': '{0C6B7792-7EA0-4932-BF15-D49C453C565D}',
              },
            };
          }),
        };
      }

      // --- sparklines --------------------------------------------------------

      let extLst: DOMContent|undefined;

      if (sparklines.length) {

        const groups: DOMContent = {
          a$: {
            'xmlns:xm': 'http://schemas.microsoft.com/office/excel/2006/main',
          },
          'x14:sparklineGroup': sparklines.map(sparkline => {

            const result = this.parser.Parse(sparkline.formula);
            let source = '';
            if (result.expression 
                && result.expression.type === 'call'
                && result.expression.args.length > 0) {
              const arg = result.expression.args[0];
              if (arg.type === 'range' || arg.type === 'address') {

                const start = (arg.type === 'range') ? arg.start : arg;
                if (!start.sheet) {
                  if (typeof start.sheet_id !== 'undefined') {
                    start.sheet = sheet_name_map[start.sheet_id];
                  }
                  else {
                    start.sheet = sheet.name;
                  }
                }
                source = this.parser.Render(arg);

              }
            }

            const color_series: {
              rgb?: string;
              tint?: string;
              theme?: string;
            } = {
              rgb: 'FF376092' // default
            };

            if (sparkline.style?.text) {
              if (IsHTMLColor(sparkline.style.text)) {
                color_series.rgb = sparkline.style.text.text;
              }
              else if (IsThemeColor(sparkline.style.text)) {
                color_series.rgb = undefined;
                color_series.theme = sparkline.style.text.theme.toString(); 
                color_series.tint = typeof sparkline.style.text.tint === 'number' ?
                  sparkline.style.text.tint.toString() : undefined;
              }
            }

            return {
              a$: {
                displayEmptyCellsAs: 'gap',
                displayHidden: '1',
                type: /column/i.test(sparkline.formula) ? 'column' : undefined,
              },
              'x14:colorSeries': { a$: { ...color_series }},
              'x14:sparklines': {
                'x14:sparkline': {
                  'xm:f': source,
                  'xm:sqref': new Area(sparkline.address).spreadsheet_label,
                },
              },
            }
          }),
        };

        extLst = {
          ext: {
            a$: {
              uri: '{05C60535-1F16-4fd2-B633-F4F36F0B64E0}',
              'xmlns:x14': 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main',
            },
            'x14:sparklineGroups': groups
          }
        };


      }


      // --- charts ------------------------------------------------------------

      let dom_drawing: DOMContent|undefined;

      const charts = this.ParseCharts(sheet);
      const images = this.ParseImages(sheet);
      
      // if a sheet has one or more charts, it has a single drawing. for a 
      // drawing, we need
      //
      // (1) entry in sheet xml
      // (2) drawing xml file
      // (3) relationship sheet -> drawing
      // (4) drawing rels file (for charts, later)
      // (5) entry in [ContentTypes]
      //
      // each chart in the drawing then needs
      //
      // (1) entry in drawing file
      // (2) chart xml file
      // (3) relationship drawing -> chart
      // (4) chart/colors xml file
      // (5) chart/style xml file
      // (6) chart rels file
      // (7) relationship chart -> colors
      // (8) relationship chart -> style
      // (9) entry in [ContentTypes]
      //
      // check: we can get away with not including colors or style, which
      // will revert to defaults -- let's do that for the time being if we can
      //
      // merging in images, which use the same drawing (and in a single 
      // sheet, a single drawing holds both charts and images).

      if (charts.length || images.length) {

        const drawing = new Drawing();

        for (const chart of charts) {
          drawing.AddChart(chart.options, chart.anchor);
        }

        for (const image of images) {
          drawing.AddImage(image.options, image.anchor);
        }

        for (const {image} of drawing.images) {
          if (image.options.data) {
            this.zip?.SetBinary(
              `xl/media/image${image.index}.${image.extension}`, 
              image.options.data, 
              image.options.encoding);
          }
          // no media rels!
        }

        for (const {chart} of drawing.charts) {
          const dom = chart.toJSON();
          const xml = XMLDeclaration + this.xmlbuilder1.build(dom);
          this.zip?.Set(`xl/charts/chart${chart.index}.xml`, xml);
          this.WriteRels(chart.relationships, `xl/charts/_rels/chart${chart.index}.xml.rels`);
        }

        this.WriteRels(drawing.relationships, `xl/drawings/_rels/drawing${drawing.index}.xml.rels`);

        const xml = XMLDeclaration + this.xmlbuilder1.build(drawing.toJSON());

        this.zip?.Set(`xl/drawings/drawing${drawing.index}.xml`, xml);

        drawings.push(drawing); // for [ContentTypes]

        const drawing_rel = AddRel(sheet_rels, 
            `http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing`, 
            `../drawings/drawing${drawing.index}.xml`);

        // dom.worksheet.drawing = {
        dom_drawing = {
          a$: {
            'r:id': drawing_rel,
          },
        };

      }
      else {
        // delete dom.worksheet.drawing;
      }

      // --- tab color ---------------------------------------------------------

      const tab_color_block: DOMContent = {};
      if (sheet.tab_color) {
        if (IsThemeColor(sheet.tab_color)) {
          tab_color_block.sheetPr = {
            tabColor: {
              a$: {
                theme: sheet.tab_color.theme,
                tint: sheet.tab_color.tint,
              }
            }
          };
        }
        else if (IsHTMLColor(sheet.tab_color)) {
          const color = sheet.tab_color.text || ''; 
          if (/^#[0-9a-fA-F]*$/.test(color)) {
            tab_color_block.sheetPr = {
              tabColor: {
                a$: {
                  rgb: `FF` + color.substring(1)
                }
              }
            };
          }
        }
      }

      // --- move page margins -------------------------------------------------

      // const margins = dom.worksheet.pageMargins;
      // delete dom.worksheet.pageMargins;
      // dom.worksheet.pageMargins = margins;

      // --- end? --------------------------------------------------------------

      const sheetFormatPr: DOMContent = {
        a$: {
          'x14ac:dyDescent': 0.25,
          defaultRowHeight: default_row_height === 15 ? undefined : default_row_height,
          customHeight: default_row_height === 15 ? undefined : 1,
          defaultColWidth: sheet.default_column_width ? PixelsToColumnWidth(sheet.default_column_width) : undefined,
        },
      }

      //------------------------------------------------------------------------
      //
      // NOTE: order matters. that's why we define the layout here. we 
      // can't just append entries to the worksheet object. 
      //
      //------------------------------------------------------------------------

      const dom: DOMContent = {

        worksheet: {
          a$: { ...sheet_attributes },

          ...tab_color_block,

          dimension: {
            a$: {
              ref: new Area(extent.start, extent.end).spreadsheet_label,
            },
          },
          sheetViews: {
            sheetView: {
              a$: {
                workbookViewId: 0,
              },
            },
          },

          sheetFormatPr,
          cols: dom_cols,
          sheetData: { row: sheet_rows },

          mergeCells,
          conditionalFormatting,
          dataValidations,
          hyperlinks: dom_hyperlinks,

          pageMargins: {
            a$: {
              left: 0.7,
              right: 0.7,
              top: 0.75,
              bottom: 0.75,
              header: 0.3,
              footer: 0.3,
            },
          },
          drawing: dom_drawing,
          tableParts,
          extLst,

        },
      };

      // -----------------------------------------------------------------------

      // it seems like chrome, at least, will maintain order. but this is 
      // not gauranteed and we can't rely on it. the best thing to do might
      // be to use the renderer on blocks and then assemble the blocks ourselves.
     
      const xml = XMLDeclaration + this.xmlbuilder1.build(dom);

      // console.info(xml);

      // write this into the file

       this.zip?.Set(`xl/worksheets/sheet${sheet_index + 1}.xml`, xml);
      if (Object.keys(sheet_rels).length) {
        this.WriteRels(sheet_rels, `xl/worksheets/_rels/sheet${sheet_index + 1}.xml.rels`);
      }

    }



    // these are workbook global so after all sheets are done

    this.WriteSharedStrings(shared_strings);
    this.WriteStyleCache(style_cache);

    // now have to write/update
    //
    // (1) contentTypes
    // (2) workbook.xml
    // (3) workbook.xml.rels
    //

    const workbook_rels: RelationshipMap = {};
    AddRel(workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', 'styles.xml');
    AddRel(workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', 'theme/theme1.xml');
    AddRel(workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings', 'sharedStrings.xml');

    const worksheet_rels_map = source.sheet_data.map((sheet, index) => AddRel(
      workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
      `worksheets/sheet${index + 1}.xml`,
    ));

    this.WriteRels(workbook_rels, `xl/_rels/workbook.xml.rels`);

    const definedNames: DOMContent|undefined = source.named?.length ? {
      definedName: (source.named||[]).map(entry => {

        let scope: string|undefined = undefined;

        if (entry.scope) {
          const test = entry.scope.toLowerCase();
          for (const [index, sheet] of source.sheet_data.entries()) {
            if (sheet.name?.toLowerCase() === test) {
              scope = index.toString();
              break;
            }
          }
        }

        return {
          a$: { name: entry.name, localSheetId: scope },
          t$: entry.expression,
        };

      }),
    } : undefined;
    
    
    const workbook_dom: DOMContent = {
      workbook: {
        a$: {
          'xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
          'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
          'mc:Ignorable': 'x15 xr xr6 xr10 xr2',
          'xmlns:x15': 'http://schemas.microsoft.com/office/spreadsheetml/2010/11/main',
          'xmlns:xr': 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
          'xmlns:xr6': 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision6', 
          'xmlns:xr10': 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision10', 
          'xmlns:xr2': 'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2',
        },
        workbookPr: {
          a$: {
            defaultThemeVersion: '166925',
          },
        },
        bookViews: {
          workbookView: {
            a$: {
              activeTab: (active_sheet || 0),
            },
          },
        },
        sheets: {
          sheet: source.sheet_data.map((sheet, index) => ({
            a$: {
              name: sheet.name || `Sheet${index + 1}`,
              sheetId: index + 1,
              'r:id': worksheet_rels_map[index],
              state: (sheet.visible === false) ? 'hidden' : undefined,
            }
          })),
        },
        definedNames,
      },
    };

    const workbook_xml = XMLDeclaration + this.xmlbuilder1.build(workbook_dom);
    // console.info(workbook_xml);
    this.zip?.Set(`xl/workbook.xml`, workbook_xml);

    // const extensions: Array<{ Extension: string, ContentType: string }> = [];
    const extensions: Record<string, string> = {};
    for (const drawing of drawings) {
      for (const image of drawing.images) {
        switch (image.image.extension) {
          case 'gif':
          case 'png':
          case 'jpeg':
            extensions[image.image.extension] = 'image/' + image.image.extension;
            break;

          case 'svg':
            extensions['svg'] = 'image/svg+xml';
            break;
        }
      }
    }

    const content_types_dom: DOMContent = {
      Types: {
        a$: {
          'xmlns': 'http://schemas.openxmlformats.org/package/2006/content-types',
        },
        Default: [
          {a$: { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' }},
          {a$: { Extension: 'xml', ContentType: 'application/xml' }},
          ...Object.keys(extensions).map(key => ({
            a$: { Extension: key, ContentType: extensions[key] },
          })),
        ],
        Override: [
          { a$: { PartName: '/xl/workbook.xml', ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml' }},

          // sheets
          ...source.sheet_data.map((sheet, index) => {
            return { a$: {
                ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
                PartName: `/xl/worksheets/sheet${index + 1}.xml`,
            }};
          }),

          // charts and drawings
          ...drawings.reduce((a: DOMContent[], drawing) => {
            return a.concat([
              ...drawing.charts.map(chart => {
                return { a$: {
                    ContentType: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml',
                    PartName: `/xl/charts/chart${chart.chart.index}.xml`,
                  }};
              }),
              { a$: {
                ContentType: 'application/vnd.openxmlformats-officedocument.drawing+xml',
                PartName: `/xl/drawings/drawing${drawing.index}.xml`,
              }},
            ]);
          }, []),

          { a$: { PartName: '/xl/theme/theme1.xml', ContentType: 'application/vnd.openxmlformats-officedocument.theme+xml' }},
          { a$: { PartName: '/xl/styles.xml', ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml' }},
          { a$: { PartName: '/xl/sharedStrings.xml', ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml' }},

          // tables
          ...global_tables.map(table => {
            return { a$: {
              ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml',
              PartName: `/xl/tables/table${table.index || 0}.xml`,
            }};
          }),

          { a$: { PartName: '/docProps/core.xml', ContentType: 'application/vnd.openxmlformats-package.core-properties+xml' }},
          { a$: { PartName: '/docProps/app.xml', ContentType: 'application/vnd.openxmlformats-officedocument.extended-properties+xml' }},
        
        ],
      },
    };

    const content_types_xml = XMLDeclaration + this.xmlbuilder1.build(content_types_dom);
    // console.info(content_types_xml);
    this.zip?.Set(`[Content_Types].xml`, content_types_xml);

  }

  public ArrayBuffer() {
    if (!this.zip) {
      throw new Error('missing zip');
    }
    return this.zip.ArrayBuffer();
  }

  public Blob() {
    if (!this.zip) {
      throw new Error('missing zip');
    }
    const buffer = this.zip.ArrayBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

}
