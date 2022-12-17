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

/**
 * rewrite of export. we'll still use a template, but do more direct
 * writing and less DOM manipulation. this should be cleaner in the long
 * run, but it will take a bit more work.
 */

// import * as JSZip from 'jszip';
import * as he from 'he';
import JSZip from 'jszip';

import { PixelsToColumnWidth } from './column-width';

const XMLDeclaration = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;

import { template } from './template-2';
import type { SerializedSheet } from 'treb-grid';

import { IArea, Area, ICellAddress, Cells, ValueType, CellValue, Style, DataValidation, ValidationType,
         AnnotationLayout, Corner as LayoutCorner, ICellAddress2 } from 'treb-base-types';

// import * as xmlparser from 'fast-xml-parser';
import { XMLParser, XmlBuilderOptions, XMLBuilder } from 'fast-xml-parser';

import { SharedStrings } from './shared-strings2';
import { StyleCache, XlColor, BorderEdge } from './workbook-style2';
import { Theme } from './workbook-theme2';

import { RelationshipMap, AddRel } from './relationship';
import { XMLOptions2 } from './xml-utils';

import { Parser, UnitAddress, UnitRange, ExpressionUnit, IllegalSheetNameRegex, QuotedSheetNameRegex } from 'treb-parser';

// FIXME: move
import { Chart, ChartOptions } from './drawing2/chart2';
import type { ImageOptions } from './drawing2/embedded-image';
import { Drawing, TwoCellAnchor } from './drawing2/drawing2';

export class Exporter {

  public zip?: JSZip;

  public xmloptions: Partial<XmlBuilderOptions> = {
    format: true,
    //attrNodeName: 'a$',
    attributesGroupName: 'a$',
    textNodeName: 't$',
    ignoreAttributes: false,
    suppressEmptyNode: true,

    tagValueProcessor: (name: string, a: string) => {
     
      // we were including unsafe symbols here, but that was 
      // resulting in double-encoding. not sure why this is 
      // here at all, unless we need it for unicode? in any
      // event (atm) allowing unsafe symbols is sufficient

      return (typeof a === 'string') ? he.encode(a, { useNamedReferences: true, allowUnsafeSymbols: true }) : a;
    },

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
  public xmlbuilder1 = new XMLBuilder(this.xmloptions);
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
  public async Init(decorated_functions: Record<string, string> = {}): Promise<void> {

    // this.decorated_functions = decorated_functions.map(name => name.toLowerCase()); // normalized

    for (const key of Object.keys(decorated_functions)) {
      this.decorated_functions[key.toLowerCase()] = decorated_functions[key]; // normalized
    }

    this.zip = await new JSZip().loadAsync(template, {base64: true});

  }

  public async WriteRels(rels: RelationshipMap, path: string, dump = false): Promise<void> {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const keys = Object.keys(rels);

    const dom = {
      Relationships: {
        a$: {
          xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships',
        },
        Relationship: keys.map(key => {
          const rel = rels[key];
          const a$: any = {
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
    await this.zip?.file(path, xml);

  }

  /**
   * format and write styles
   */
  public async WriteStyleCache(style_cache: StyleCache): Promise<void> {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const ColorAttributes = (color: XlColor) => {

      // we could just pass through except that we have argb and excel has rgb

      const attrs: any = {};
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
      return attrs;
    };

    const xfs = style_cache.cell_xfs.map(xf => {
      const block: any = {
        a$: {
          numFmtId: xf.number_format,
          fontId: xf.font,
          fillId: xf.fill,
          borderId: xf.border,
        },
      };

      if (xf.horizontal_alignment || xf.vertical_alignment || xf.wrap_text) {
        // block.a$.applyAlignment = 1;
        block.alignment = { a$: {}};
        if (xf.horizontal_alignment) {
          block.alignment.a$.horizontal = xf.horizontal_alignment;
        }
        if (xf.vertical_alignment) {
          block.alignment.a$.vertical = xf.vertical_alignment;
        }
        if (xf.wrap_text) {
          block.alignment.a$.wrapText = 1;
        }
      }

      return block;
    });

    const BorderColorAttributes = (edge: BorderEdge) => {
      if (edge.color) {
        return { indexed: edge.color };
      }
      if (edge.rgba) {
        return { rgb: edge.rgba };
      }
      if (edge.theme) {
        const attrs: any = {
          theme: edge.theme,
        }
        if (edge.tint) {
          attrs.tint = edge.tint;
        }
        return attrs;
      }
      return undefined;
    };

    const borders = style_cache.borders.map(border => {
      const block: any = {
        left: {},
        right: {},
        top: {},
        bottom: {},
        diagonal: {},
      };

      if (border.top.style) {
        block.top.a$ = {
          style: border.top.style,
        };
        const attrs = BorderColorAttributes(border.top);
        if (attrs) { block.top.color = {a$: attrs}; }
      }

      if (border.left.style) {
        block.left.a$ = {
          style: border.left.style,
        };
        const attrs = BorderColorAttributes(border.left);
        if (attrs) { block.left.color = {a$: attrs}; }
      }

      if (border.bottom.style) {
        block.bottom.a$ = {
          style: border.bottom.style,
        };
        const attrs = BorderColorAttributes(border.bottom);
        if (attrs) { block.bottom.color = {a$: attrs}; }
      }

      if (border.right.style) {
        block.right.a$ = {
          style: border.right.style,
        };
        const attrs = BorderColorAttributes(border.right);
        if (attrs) { block.right.color = {a$: attrs}; }
      }

      if (border.diagonal.style) {
        block.diagonal.a$ = {
          style: border.diagonal.style,
        };
        const attrs = BorderColorAttributes(border.diagonal);
        if (attrs) { block.diagonal.color = {a$: attrs}; }
      }

      return block;
    });

    // console.info("SC", style_cache);

    const fills = style_cache.fills.map(fill => {
      const block: any = {
        a$: { patternType: fill.pattern_type },
      };

      if (fill.pattern_gray !== undefined) {
        block.a$.patternType = `gray${fill.pattern_gray}`;
      }
      if (fill.bg_color) {
        block.bgColor = { a$: ColorAttributes(fill.bg_color) };
      }
      if (fill.fg_color) {
        block.fgColor = { a$: ColorAttributes(fill.fg_color) };
      }

      return {patternFill: block};
    });

    const fonts = style_cache.fonts.map(font => {
      const block: any = {};

      // flags

      if (font.bold) { block.b = ''; }
      if (font.italic) { block.i = ''; }
      if (font.underline) { block.u = ''; }
      if (font.strike) { block.strike = ''; }

      // "val" props

      if (font.size !== undefined) {
        block.sz = { a$: { val: font.size }};
      }
      if (font.family !== undefined) {
        block.family = { a$: { val: font.family }};
      }
      if (font.name !== undefined) {
        block.name = { a$: { val: font.name }};
      }
      if (font.scheme !== undefined) {
        block.scheme = { a$: { val: font.scheme }};
      }

      // color

      if (font.color_argb !== undefined) {
        block.color = { a$: { rgb: font.color_argb }};
      }
      else if (font.color_theme !== undefined) {
        block.color = { a$: { theme: font.color_theme }};
        if (font.color_tint) {
          block.color.a$.tint = font.color_tint;
        }
      }

      return block;
    });

    const dom: any = {
      styleSheet: {
        a$: {
          'xmlns':        'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'xmlns:mc':     'http://schemas.openxmlformats.org/markup-compatibility/2006',
          'mc:Ignorable': 'x14ac x16r2 xr',
          'xmlns:x14ac':  'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
          'xmlns:x16r2':  'http://schemas.microsoft.com/office/spreadsheetml/2015/02/main', 
          'xmlns:xr':     'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
        },
      },
    };

    // we're only adding elements here if they are not empty, but in 
    // practice only numFmts can be empty (because there are implicit 
    // formats); everything else has a default 0 entry

    if (style_cache.number_formats.length) {

      dom.styleSheet.numFmts = {
        a$: { count: style_cache.number_formats.length },
        numFmt: style_cache.number_formats.map(format => {
          return {
            a$: {
              numFmtId: format.id,
              formatCode: format.format,
            },  
          };
        }),
      };

      // console.info(style_cache.number_formats);
      // console.info(dom.styleSheet.numFmts);

    }

    if (fonts.length) {
      dom.styleSheet.fonts = {
        a$: { count: fonts.length },
        font: fonts,
      };
    }

    if (fills.length) {
      dom.styleSheet.fills = {
        a$: { count: fills.length },
        fill: fills,
      };
    }

    if (borders.length) {
      dom.styleSheet.borders = {
        a$: { count: borders.length },
        border: borders,
      };
    }

    // console.info("B", borders, JSON.stringify(dom.styleSheet.borders, undefined, 2))

    if (xfs.length) {
      dom.styleSheet.cellXfs = {
        a$: { count: xfs.length },
        xf: xfs,
      };
    }

    // not used:
    //
    //  cellStyleXfs
    //  cellStyles
    //  dxfs
    //  tableStyles
    
    const xml = XMLDeclaration + this.xmlbuilder1.build(dom);
    // console.info(xml);
    
    await this.zip?.file('xl/styles.xml', xml);

  }

  /**
   * format and write shared strings file to the zip archive. this will
   * replace any existing shared strings file.
   */
  public async WriteSharedStrings(shared_strings: SharedStrings): Promise<void> {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const dom: any = {
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
    await this.zip?.file('xl/sharedStrings.xml', xml);

  }

  /**
   * FIXME: merge with workbook function (put somewhere else)
   * /
  public async ReadRels(zip?: JSZip, path = ''): Promise<RelationshipMap> {

    const rels: RelationshipMap = {};
    const data = await zip?.file(path)?.async('text') as string;
    //
    // force array on <Relationship/> elements, but be slack on the rest
    // (we know they are single elements)
    //
    const xml = this.xmlparser2.parse(data || '');
    console.info(path, xml);

    for (const relationship of xml.Relationships?.Relationship || []) {
      const id = relationship.a$.Id;
      rels[id] = {
        id, 
        type: relationship.a$.Type,
        target: relationship.a$.Target,
      };
    }

    return rels;

  }
  */

  public StyleFromCell(sheet: SerializedSheet, style_cache: StyleCache, row: number, column: number, style: Style.Properties = {}) {

    //if (row === 2 && column === 5)
    //  console.info("SFC", JSON.stringify(style, undefined, 2));

    const cell_style_refs = sheet.styles || sheet.cell_style_refs || [];

    const list: Style.Properties[] = [sheet.sheet_style];

    if (sheet.row_pattern && sheet.row_pattern.length) {
      list.push(sheet.row_pattern[row % sheet.row_pattern.length]);
    }

    // is this backwards, vis a vis our rendering? I think it might be...
    // YES: should be row pattern -> row -> column -> cell [corrected]

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
      annotation_rect: { 
        left: number; 
        top: number; 
        width: number; 
        height: number; 
      }, 
      sheet: SerializedSheet): TwoCellAnchor {
    
    const anchor: TwoCellAnchor = {
      from: {row: -1, column: -1},
      to: {row: -1, column: -1},
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

    for (const annotation of sheet_source.annotations || []) {
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

              if (annotation.rect) {
                images.push({
                  anchor: this.AnnotationRectToAnchor(annotation.rect, sheet_source), options});
              }
              else if (annotation.layout) {
                images.push({
                  anchor: this.AnnotationLayoutToAnchor(annotation.layout, sheet_source), options});
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

          const [label, x, y] = arg.args; // y is required
          
          if (y && y.type === 'range') {
            options.data.push(this.NormalizeAddress(y, sheet_source));

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
            if (x && x.type === 'range') {
              options.labels2[options.data.length - 1] = this.NormalizeAddress(x, sheet_source);
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
        
        let type = '';
        switch (parse_result.expression.name.toLowerCase()) {
          case 'line.chart':
            type = 'scatter';
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

        if (type === 'column' || type === 'donut' || type === 'bar' || type === 'scatter' || type === 'scatter2') {

          const options: ChartOptions = { type, data: [] };

          const title_index = (type === 'scatter2') ? 1 : 2;
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
            if (type === 'scatter2' || type === 'bar' || type === 'column' || type === 'scatter') {
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

          if (type !== 'scatter2') {
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

          if (annotation.rect) {
            charts.push({
              anchor: this.AnnotationRectToAnchor(annotation.rect, sheet_source), options});
            // sheet.AddChart(this.AnnotationRectToAnchor(annotation.rect, sheet_source), options);
          }
          else if (annotation.layout) {
            charts.push({
              anchor: this.AnnotationLayoutToAnchor(annotation.layout, sheet_source), options});
            // sheet.AddChart(this.AnnotationLayoutToAnchor(annotation.layout, sheet_source), options);
          }
          else {
            console.warn('annotation missing layout');
          }

        }

      }
      

    }

    return charts;

  }

  public FormulaText(text: string): string {
  
    // let mared = false;

    if (text[0] !== '=') {
      return text;
    }

    const parse_result = this.parser.Parse(text);

    if (!parse_result.expression) {
      console.warn('parsing function failed');
      console.warn(text);
      return text.substr(1);
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

      return this.parser.Render(parse_result.expression, undefined, '');
    }
   
  }

  public async Export(source: {
      sheet_data: SerializedSheet[];
      active_sheet?: number;
      named_ranges?: {[index: string]: IArea};
      named_expressions?: Array<{ name: string, expression: string }>;
      decimal_mark: ','|'.';
    }): Promise<void> {
      
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

    let data = await this.zip?.file('xl/theme/theme1.xml')?.async('text') as string;
    theme.FromXML(this.xmlparser2.parse(data || ''));
    // console.info({data, xml: this.xmlparser2.parse(data)})

    data = await this.zip?.file('xl/styles.xml')?.async('text') as string;
    style_cache.FromXML(this.xmlparser2.parse(data || ''), theme);

    // reset counters

    Drawing.next_drawing_index = 1;
    Chart.next_chart_index = 1;

    const drawings: Drawing[] = [];

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

      const dom: any = {
        worksheet: {
          a$: {
            ...sheet_attributes,
          },
          dimension: {
            a$: {
              ref: 'A1',
            },
          },
          sheetViews: {
            sheetView: {
              a$: {
                // tabSelected: (sheet_index === active_sheet ? 1 : 0),
                workbookViewId: 0,
              },
            },
          },
          sheetFormatPr: {
            a$: default_row_height === 15 ? {
              'x14ac:dyDescent': 0.25,
            } : {
              defaultRowHeight: default_row_height,
              customHeight: 1,
              'x14ac:dyDescent': 0.25,
            },
          },
          cols: {},
          sheetData: {},
          mergeCells: {
            a$: { count: 0 },
          },
          dataValidations: {},
          hyperlinks: {},
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
          drawing: {},
          extLst: {
            ext: {
              a$: {
                uri: '{05C60535-1F16-4fd2-B633-F4F36F0B64E0}',
                'xmlns:x14': 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main',
              },
            },
          },

        },
      };

      /*
      const column_styles = (sheet.column_style as any) || {};

      for (const key of Object.keys(column_styles)) {
        console.info(key, '=>', column_styles[key]);

      }

      return;
      */

      // data has different representations. it is either blocked into rows or 
      // columns, or a set of individual cells. we could theoretically guarantee
      // a particular encoding if we wanted to (by row would be optimal for excel).

      // but we don't do that at the moment, so let's just unwind it using the 
      // standard class (adding support for cell styles)

      const cell_style_refs = sheet.styles || sheet.cell_style_refs || [];

      const cells = new Cells();
      cells.FromJSON(sheet.data, cell_style_refs);

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

      const sheet_data: any = { row: [] };

      const hyperlinks: Array<{
        rel: string,
        target: string,
        address: ICellAddress,
      }> = [];

      const sparklines: Array<{
        address: ICellAddress,
        formula: string,
        style?: Style.Properties,
      }> = [];

      const merges: Area[] = [];

      const validations: Array<{
        address: ICellAddress,
        validation: DataValidation,
      }> = [];

      // --



      // --

      for (let r = 0; r < cells.data.length; r++ ) {
        if (cells.data[r] && cells.data[r].length) {  

          // push out the extent (reversed)
          if (r < extent.start.row) {
            extent.start.row = r;
          }

          // row span
          const span = {start: -1, end: -1};
          const row: any = [];

          for (let c = 0; c < cells.data[r].length; c++) {
            const cell = cells.data[r][c];
            if (cell) {

              if (cell.merge_area && 
                  cell.merge_area.start.row === r &&
                  cell.merge_area.start.column === c) {
                merges.push(new Area(cell.merge_area.start, cell.merge_area.end));
              }

              if (cell.hyperlink) {
                const rel = AddRel(sheet_rels, 
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', 
                    cell.hyperlink, 'External');
                hyperlinks.push({
                  rel, target: cell.hyperlink, address: {row: r, column: c}, 
                });
              }

              if (cell.validation && (cell.validation.type === ValidationType.List || cell.validation.type === ValidationType.Range)) {
                validations.push({
                  address: {row: r, column: c},
                  validation: cell.validation,
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

              // v (child element) is the value
              let v: CellValue = undefined;
              let t: string|undefined;
              let f: any; // string|undefined;

              switch (cell.type) {
                case ValueType.formula:
                  f = this.FormulaText(cell.value as string);
                  switch (cell.calculated_type) {
                    case ValueType.string:
                      v = cell.calculated;
                      t = 'str';
                      break;

                    case ValueType.number:
                      v = cell.calculated;
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
                  v = cell.value;
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

              // zerp
              const element: any = {
                a$: {
                  r: Area.CellAddressToLabel({row: r, column: c}),
                  // t,
                  // s,
                },
                // v,
              };

              if (t !== undefined) {
                element.a$.t = t;
              }
              if (s !== undefined) {
                element.a$.s = s;
              }
              if (f !== undefined) {
                element.f = f;              
              }
              if (v !== undefined) {
                element.v = v;
              }

              row.push(element);

            }
          }

          if (row.length) {
            const row_data: any = {
              a$: {
                r: r + 1,
                spans: `${span.start + 1}:${span.end + 1}`,
              },
              c: row,
            };
            if (sheet.row_height 
                && (typeof sheet.row_height[r] === 'number') 
                && sheet.row_height[r] !== sheet.default_row_height) {
              
              row_data.a$.customHeight = 1;
              row_data.a$.ht = sheet.row_height[r] * 3 / 4;
            }

            sheet_data.row.push(row_data);
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

      if (sheet.default_column_width) {
        dom.worksheet.sheetFormatPr.a$.defaultColWidth = // sheet.default_column_width * one_hundred_pixels / 100;
          PixelsToColumnWidth(sheet.default_column_width);
      }

      for (let c = 0; c < sheet.columns; c++) {
        const entry: { style?: number, width?: number, index: number } = { index: c };
        if (sheet.column_width 
            && sheet.default_column_width
            && (typeof sheet.column_width[c] === 'number')
            && sheet.column_width[c] !== sheet.default_column_width) {

          entry.width = // sheet.column_width[c] * one_hundred_pixels / 100;
            PixelsToColumnWidth(sheet.column_width[c]);

          // console.info("COLUMN", c, 'width', sheet.column_width[c], 'calc?', entry.width, '100p', one_hundred_pixels);

        }

        let style = sheet.column_style[c];
        if (typeof style === 'number') {
          style = cell_style_refs[style];
          if (style) {
            entry.style = style_cache.EnsureStyle(style_cache.StyleOptionsFromProperties(style));
          }
        }
        else if (style) {
          entry.style = style_cache.EnsureStyle(style_cache.StyleOptionsFromProperties(style));
        }

        //if (sheet.column_style[c]) {
        //  entry.style = style_cache.EnsureStyle(style_cache.StyleOptionsFromProperties(sheet.column_style[c]));
        //}

        if (entry.style !== undefined || entry.width !== undefined) {
          column_entries[c] = entry;
        }
      }

      // we're short-cutting here, these should be arranged in blocks if
      // there's overlap. not sure how much of an issue that is though.
      
      if (column_entries.length) {
        for (const entry of column_entries) {
          dom.worksheet.cols.col = column_entries.map(entry => {
            const a$: any = { 
              min: entry.index + 1, 
              max: entry.index + 1,
            };
            if (entry.style !== undefined) {
              a$.style = entry.style;
            }
            if (entry.width !== undefined) {
              a$.width = entry.width;
              a$.customWidth = 1;
            }
            else {
              a$.width = // (sheet.default_column_width || 100) / 100 * one_hundred_pixels;
                PixelsToColumnWidth(sheet.default_column_width || 90);
            }
            return {a$};
          });
        }
      }
      else {
        delete dom.worksheet.cols;
      }

      // --- validation ----------------------------------------------------------

      if (validations.length) {

        dom.worksheet.dataValidations = {
          a$: { count: validations.length },
          dataValidation: validations.map(validation => {
            const entry: any = { 
              a$: {
                type: 'list',
                allowBlank: 1, 
                showInputMessage: 1, 
                showErrorMessage: 1, 
                sqref: new Area(validation.address).spreadsheet_label,
              },
            };
            if (validation.validation.type === ValidationType.Range) {
              const area = new Area(
                {...validation.validation.area.start, absolute_column: true, absolute_row: true}, 
                {...validation.validation.area.end, absolute_column: true, absolute_row: true},
              );
              entry.formula1 = `${area.spreadsheet_label}`;
            }
            else if (validation.validation.type === ValidationType.List) {
              entry.formula1 = `"${validation.validation.list.join(',')}"`;
            }
            return entry;
          }),
        };

      }
      else {
        delete dom.worksheet.dataValidations;
      }

      // --- merges --------------------------------------------------------------

      if (merges.length) {
        dom.worksheet.mergeCells.a$.count = merges.length;
        dom.worksheet.mergeCells.mergeCell = merges.map(merge => {
          return {
            a$: { ref: merge.spreadsheet_label }
          };
        });
      }
      else {
        delete dom.worksheet.mergeCells;
      }

      // --- hyperlinks ----------------------------------------------------------

      if (hyperlinks.length) {
        dom.worksheet.hyperlinks.hyperlink = hyperlinks.map(link => {
          return {
            a$: {
              'r:id': link.rel,
              ref: new Area(link.address).spreadsheet_label,
              'xr:uid': '{0C6B7792-7EA0-4932-BF15-D49C453C565D}',
            },
          };
        });
      }
      else {
        delete dom.worksheet.hyperlinks;
      }

      // --- sparklines ----------------------------------------------------------

      if (sparklines.length) {
        dom.worksheet.extLst.ext['x14:sparklineGroups'] = {
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

            const a$: any = {
              displayEmptyCellsAs: 'gap',
            };

            if (/column/i.test(sparkline.formula)) {
              a$.type = 'column';
            }

            return {
              a$,
              'x14:colorSeries': { a$: { rgb: 'FF376092' }},
              'x14:sparklines': {
                'x14:sparkline': {
                  'xm:f': source,
                  'xm:sqref': new Area(sparkline.address).spreadsheet_label,
                },
              },
            }
          }),
        };
      }
      else {
        delete dom.worksheet.extLst;
      }

      dom.worksheet.sheetData = sheet_data;

      // --- charts ------------------------------------------------------------

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
          // console.info({image}, `xl/media/image${image.index}.${image.extension}`);
          await this.zip?.file(`xl/media/image${image.index}.${image.extension}`, image.options.data||'', {
            base64: image.options.encoding === 'base64'
          });
          // no media rels!
        }

        for (const {chart} of drawing.charts) {
          const dom = chart.toJSON();
          const xml = XMLDeclaration + this.xmlbuilder1.build(dom);
          await this.zip?.file(`xl/charts/chart${chart.index}.xml`, xml);
          await this.WriteRels(chart.relationships, `xl/charts/_rels/chart${chart.index}.xml.rels`);
        }

        await this.WriteRels(drawing.relationships, `xl/drawings/_rels/drawing${drawing.index}.xml.rels`);

        const xml = XMLDeclaration + this.xmlbuilder1.build(drawing.toJSON());

        await this.zip?.file(`xl/drawings/drawing${drawing.index}.xml`, xml);

        drawings.push(drawing); // for [ContentTypes]

        const drawing_rel = AddRel(sheet_rels, 
            `http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing`, 
            `../drawings/drawing${drawing.index}.xml`);

        dom.worksheet.drawing = {
          a$: {
            'r:id': drawing_rel,
          },
        };

      }
      else {
        delete dom.worksheet.drawing;
      }

      // --- end? --------------------------------------------------------------

      // it seems like chrome, at least, will maintain order. but this is 
      // not gauranteed and we can't rely on it. the best thing to do might
      // be to use the renderer on blocks and then assemble the blocks ourselves.

      dom.worksheet.dimension.a$.ref = new Area(extent.start, extent.end).spreadsheet_label;
      const xml = XMLDeclaration + this.xmlbuilder1.build(dom);

      // write this into the file

      await this.zip?.file(`xl/worksheets/sheet${sheet_index + 1}.xml`, xml);
      if (Object.keys(sheet_rels).length) {
        this.WriteRels(sheet_rels, `xl/worksheets/_rels/sheet${sheet_index + 1}.xml.rels`);
      }

    }



    // these are workbook global so after all sheets are done

    await this.WriteSharedStrings(shared_strings);
    await this.WriteStyleCache(style_cache);

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

    await this.WriteRels(workbook_rels, `xl/_rels/workbook.xml.rels`);

    let definedNames: any = {definedName: []};
    if (source.named_ranges) {
      const keys = Object.keys(source.named_ranges);
      for (const key of keys) {
        let sheet_name = '';
        const area = new Area(source.named_ranges[key].start, source.named_ranges[key].end);
        area.start.absolute_column = area.start.absolute_row = true;
        area.end.absolute_column = area.end.absolute_row = true;

        if (area.start.sheet_id) {
          for (const sheet of source.sheet_data) {
            if (sheet.id === area.start.sheet_id) {
              sheet_name = sheet.name || '';
              break;
            }
          }
        }

        if (sheet_name) {
          if (QuotedSheetNameRegex.test(sheet_name)) {
            sheet_name = `'${sheet_name}'`;
          }
          sheet_name += '!';
        }

        // console.info({key, area, lx: area.spreadsheet_label, sheet_name });
        definedNames.definedName.push({
          a$: { name: key },
          t$: sheet_name + area.spreadsheet_label,
        });

      }
    }
    if (source.named_expressions) {
      for (const entry of source.named_expressions) {
        definedNames.definedName.push({
          a$: { name: entry.name },
          t$: entry.expression,
        });
      }
    }
    if (!definedNames.definedName.length) {
      definedNames = undefined;
    }

    const workbook_dom: any = {
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
          sheet: source.sheet_data.map((sheet, index) => {
            const a$: any = {
              name: sheet.name || `Sheet${index + 1}`,
              sheetId: index + 1,
              'r:id': worksheet_rels_map[index],
            };
            if (sheet.visible === false) {
              a$.state = 'hidden';
            }
            return { a$ };
          }),
        },
        definedNames,
      },
    };

    const workbook_xml = XMLDeclaration + this.xmlbuilder1.build(workbook_dom);
    // console.info(workbook_xml);
    await this.zip?.file(`xl/workbook.xml`, workbook_xml);

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

    const content_types_dom: any = {
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
          ...drawings.reduce((a: any, drawing) => {
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
          { a$: { PartName: '/docProps/core.xml', ContentType: 'application/vnd.openxmlformats-package.core-properties+xml' }},
          { a$: { PartName: '/docProps/app.xml', ContentType: 'application/vnd.openxmlformats-officedocument.extended-properties+xml' }},
        
        ],
      },
    };

    const content_types_xml = XMLDeclaration + this.xmlbuilder1.build(content_types_dom);
    // console.info(content_types_xml);
    await this.zip?.file(`[Content_Types].xml`, content_types_xml);

  }

  /** zip -> binary string */
  public async AsBinaryString(compression_level?: number) {
    if (!this.zip) {
      throw new Error('missing zip');
    }
    const opts: JSZip.JSZipGeneratorOptions = { type: 'binarystring' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compressionOptions = {level: compression_level };
    }
    const output = await this.zip.generateAsync(opts);
    return output;
  }

  /** zip -> blob */
  public async AsBlob(compression_level?: number) {
    if (!this.zip) {
      throw new Error('missing zip');
    }
    const opts: JSZip.JSZipGeneratorOptions = { type: 'blob' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compressionOptions = {level: compression_level };
    }
    const output = await this.zip.generateAsync(opts);
    return output;
  }

}